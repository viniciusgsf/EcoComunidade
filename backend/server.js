import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { neon } from '@neondatabase/serverless';
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const app = express();
const port = Number(process.env.PORT || 3000);
const sql = neon(process.env.DATABASE_URL);
const frontDirectory = fileURLToPath(new URL('../front/', import.meta.url));
const scrypt = promisify(scryptCallback);
const sessionCookieName = 'ecocomunidade_session';
const sessionDurationSeconds = 60 * 60 * 24 * 7;

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '700kb' }));
app.use('/api/', rateLimit({ windowMs: 60_000, limit: 40, standardHeaders: 'draft-8', legacyHeaders: false }));
app.use('/api/auth/', rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false }));

function requireSameOrigin(req, res, next) {
  const origin = req.get('origin');
  if (!origin) return res.status(403).json({ error: 'Origem da solicitação não verificada.' });
  try {
    const parsedOrigin = new URL(origin);
    if (!['http:', 'https:'].includes(parsedOrigin.protocol) || parsedOrigin.host !== req.get('host')) {
      return res.status(403).json({ error: 'Origem da solicitação não permitida.' });
    }
  } catch {
    return res.status(403).json({ error: 'Origem da solicitação inválida.' });
  }
  next();
}

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map((part) => {
    const separator = part.indexOf('=');
    if (separator < 0) return ['', ''];
    const key = part.slice(0, separator).trim();
    try {
      return [key, decodeURIComponent(part.slice(separator + 1).trim())];
    } catch {
      return [key, ''];
    }
  }).filter(([key]) => key));
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${salt.toString('base64url')}$${Buffer.from(derived).toString('base64url')}`;
}

async function verifyPassword(password, storedHash) {
  const [algorithm, saltText, hashText] = String(storedHash).split('$');
  if (algorithm !== 'scrypt' || !saltText || !hashText) return false;
  const expected = Buffer.from(hashText, 'base64url');
  const actual = Buffer.from(await scrypt(password, Buffer.from(saltText, 'base64url'), expected.length, {
    N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024,
  }));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${sessionCookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sessionDurationSeconds}${secure}`);
}

function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${sessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
}

async function createSession(user, res) {
  const token = randomBytes(32).toString('base64url');
  await sql`INSERT INTO auth_sessions (user_id, token_hash, expires_at) VALUES (${user.id}, ${hashToken(token)}, NOW() + INTERVAL '7 days')`;
  setSessionCookie(res, token);
}

async function loadUser(req) {
  const token = parseCookies(req.get('cookie'))[sessionCookieName];
  if (!token || token.length > 100) return null;
  const [user] = await sql`
    SELECT u.id, u.email, u.display_name, u.role
    FROM auth_sessions s JOIN app_users u ON u.id = s.user_id
    WHERE s.token_hash = ${hashToken(token)} AND s.expires_at > NOW()
    LIMIT 1
  `;
  return user || null;
}

async function requireUser(req, res, next) {
  try {
    req.user = await loadUser(req);
    if (!req.user) return res.status(401).json({ error: 'Entre na sua conta para publicar.' });
    next();
  } catch (error) {
    console.error('Could not verify session:', error.message);
    res.status(500).json({ error: 'Não foi possível verificar a sessão.' });
  }
}

await sql`
  CREATE TABLE IF NOT EXISTS listings (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title VARCHAR(70) NOT NULL,
    category VARCHAR(32) NOT NULL CHECK (category IN ('Móveis', 'Sobras de obras', 'Utilidades')),
    neighborhood VARCHAR(60) NOT NULL,
    description VARCHAR(300) NOT NULL,
    phone VARCHAR(15) NOT NULL,
    photo TEXT,
    status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;
await sql`
  CREATE TABLE IF NOT EXISTS listing_reports (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    listing_id BIGINT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    reason VARCHAR(300) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;
await sql`
  CREATE TABLE IF NOT EXISTS app_users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email VARCHAR(254) NOT NULL UNIQUE,
    display_name VARCHAR(80) NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(16) NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'moderator')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;
await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS role VARCHAR(16) NOT NULL DEFAULT 'member'`;
await sql`
  DO $migration$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'app_users_role_check'
        AND conrelid = 'app_users'::regclass
    ) THEN
      ALTER TABLE app_users ADD CONSTRAINT app_users_role_check CHECK (role IN ('member', 'moderator'));
    END IF;
  END
  $migration$
`;
await sql`
  CREATE TABLE IF NOT EXISTS auth_sessions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;
await sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS owner_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL`;
await sql`
  CREATE TABLE IF NOT EXISTS collection_points (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    category VARCHAR(40) NOT NULL CHECK (category IN ('Óleo de cozinha', 'Entulho', 'Recicláveis')),
    accepted_materials VARCHAR(300) NOT NULL,
    address VARCHAR(180) NOT NULL,
    neighborhood VARCHAR(80) NOT NULL,
    opening_hours VARCHAR(160) NOT NULL,
    city VARCHAR(100) NOT NULL DEFAULT 'São José dos Campos',
    latitude DOUBLE PRECISION CHECK (latitude BETWEEN -90 AND 90),
    longitude DOUBLE PRECISION CHECK (longitude BETWEEN -180 AND 180),
    source_url TEXT,
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (name, address, city)
  )
`;
await sql`ALTER TABLE collection_points ADD COLUMN IF NOT EXISTS city VARCHAR(100) NOT NULL DEFAULT 'São José dos Campos'`;
await sql`ALTER TABLE collection_points ADD COLUMN IF NOT EXISTS source_url TEXT`;
await sql`ALTER TABLE collection_points ALTER COLUMN latitude DROP NOT NULL`;
await sql`ALTER TABLE collection_points ALTER COLUMN longitude DROP NOT NULL`;
await sql`CREATE UNIQUE INDEX IF NOT EXISTS collection_points_name_address_city_uidx ON collection_points (name, address, city)`;

app.post('/api/auth/register', requireSameOrigin, async (req, res) => {
  const displayName = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (displayName.length < 2 || displayName.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254
    || password.length < 12 || password.length > 128) {
    return res.status(400).json({ error: 'Informe nome e e-mail válidos e uma senha com 12 a 128 caracteres.' });
  }

  try {
    const passwordHash = await hashPassword(password);
    const [user] = await sql`
      INSERT INTO app_users (email, display_name, password_hash)
      VALUES (${email}, ${displayName}, ${passwordHash})
      ON CONFLICT (email) DO NOTHING
      RETURNING id, email, display_name, role
    `;
    if (!user) return res.status(409).json({ error: 'Não foi possível criar a conta com esses dados.' });
    await createSession(user, res);
    res.status(201).json({ user });
  } catch (error) {
    console.error('Could not register user:', error.message);
    res.status(500).json({ error: 'Não foi possível criar sua conta.' });
  }
});

app.post('/api/auth/login', requireSameOrigin, async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!password || password.length > 128) return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
  try {
    const [user] = await sql`SELECT id, email, display_name, role, password_hash FROM app_users WHERE email = ${email} LIMIT 1`;
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }
    await createSession(user, res);
    res.json({ user: { id: user.id, email: user.email, display_name: user.display_name, role: user.role } });
  } catch (error) {
    console.error('Could not sign in:', error.message);
    res.status(500).json({ error: 'Não foi possível entrar na conta.' });
  }
});

app.get('/api/auth/session', async (req, res) => {
  try {
    const user = await loadUser(req);
    if (!user) return res.json({ user: null });
    res.json({ user });
  } catch (error) {
    console.error('Could not restore session:', error.message);
    res.status(500).json({ error: 'Não foi possível restaurar a sessão.' });
  }
});

app.post('/api/auth/logout', requireSameOrigin, async (req, res) => {
  const token = parseCookies(req.get('cookie'))[sessionCookieName];
  try {
    if (token) await sql`DELETE FROM auth_sessions WHERE token_hash = ${hashToken(token)}`;
    clearSessionCookie(res);
    res.status(204).end();
  } catch (error) {
    console.error('Could not sign out:', error.message);
    res.status(500).json({ error: 'Não foi possível sair da conta.' });
  }
});

async function moderate(req, res, next) {
  try {
    req.user = await loadUser(req);
    if (req.user?.role === 'moderator') return next();
  } catch (error) {
    console.error('Could not verify moderator session:', error.message);
    return res.status(500).json({ error: 'Não foi possível verificar a permissão.' });
  }

  // Keep the local CLI credential as a non-UI fallback for smoke tests and emergency maintenance.
  const token = process.env.MODERATOR_TOKEN;
  if (token && req.get('authorization') === `Bearer ${token}`) return next();
  return res.status(403).json({ error: 'Apenas moderadores podem acessar este recurso.' });
}

function validListing(body) {
  const categories = ['Móveis', 'Sobras de obras', 'Utilidades'];
  const phone = String(body.phone || '').replace(/\D/g, '');
  return {
    title: String(body.title || '').trim(),
    category: String(body.category || ''),
    neighborhood: String(body.neighborhood || '').trim(),
    description: String(body.description || '').trim(),
    phone,
    photo: typeof body.photo === 'string' ? body.photo : '',
    valid: Boolean(body.title && body.neighborhood && body.description)
      && String(body.title).trim().length <= 70
      && String(body.neighborhood).trim().length <= 60
      && String(body.description).trim().length <= 300
      && categories.includes(body.category)
      && phone.length >= 10 && phone.length <= 15
      && (!body.photo || /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(body.photo)),
  };
}

app.get('/api/health', async (_req, res) => {
  try {
    const [result] = await sql`SELECT NOW() AS database_time`;
    res.json({ status: 'ok', database: 'connected', databaseTime: result.database_time });
  } catch (error) {
    console.error('Database health check failed:', error.message);
    res.status(503).json({ status: 'error', database: 'unavailable' });
  }
});

app.get('/api/listings', async (req, res) => {
  try {
    const category = String(req.query.category || '');
    const rows = category
      ? await sql`SELECT id, title, category, neighborhood, description, phone, photo, created_at FROM listings WHERE status = 'approved' AND category = ${category} ORDER BY created_at DESC LIMIT 100`
      : await sql`SELECT id, title, category, neighborhood, description, phone, photo, created_at FROM listings WHERE status = 'approved' ORDER BY created_at DESC LIMIT 100`;
    res.json(rows);
  } catch (error) {
    console.error('Could not load listings:', error.message);
    res.status(500).json({ error: 'Não foi possível carregar os anúncios.' });
  }
});

app.get('/api/collection-points', async (req, res) => {
  try {
    const category = String(req.query.category || '');
    const allowedCategories = ['Óleo de cozinha', 'Entulho', 'Recicláveis'];
    if (category && !allowedCategories.includes(category)) return res.status(400).json({ error: 'Tipo de resíduo inválido.' });
    const rows = category
      ? await sql`SELECT id, name, category, accepted_materials, address, neighborhood, opening_hours, city, latitude, longitude, source_url FROM collection_points WHERE verified = TRUE AND active = TRUE AND (category = ${category} OR accepted_materials ILIKE ${`%${category}%`}) ORDER BY name LIMIT 200`
      : await sql`SELECT id, name, category, accepted_materials, address, neighborhood, opening_hours, city, latitude, longitude, source_url FROM collection_points WHERE verified = TRUE AND active = TRUE ORDER BY name LIMIT 200`;
    res.json(rows);
  } catch (error) {
    console.error('Could not load collection points:', error.message);
    res.status(500).json({ error: 'Não foi possível carregar os pontos de recebimento.' });
  }
});

app.post('/api/listings', requireSameOrigin, requireUser, async (req, res) => {
  const listing = validListing(req.body);
  if (!listing.valid) return res.status(400).json({ error: 'Confira os campos e o formato dos dados.' });

  try {
    const [created] = await sql`
      INSERT INTO listings (title, category, neighborhood, description, phone, photo, owner_user_id)
      VALUES (${listing.title}, ${listing.category}, ${listing.neighborhood}, ${listing.description}, ${listing.phone}, ${listing.photo || null}, ${req.user.id})
      RETURNING id, status
    `;
    res.status(201).json({ id: created.id, status: created.status, message: 'Anúncio enviado para revisão.' });
  } catch (error) {
    console.error('Could not create listing:', error.message);
    res.status(500).json({ error: 'Não foi possível enviar o anúncio.' });
  }
});

app.post('/api/listings/:id/reports', requireSameOrigin, async (req, res) => {
  const listingId = Number(req.params.id);
  const reason = String(req.body.reason || '').trim();
  if (!Number.isSafeInteger(listingId) || listingId < 1 || reason.length < 5 || reason.length > 300) {
    return res.status(400).json({ error: 'Informe o motivo da denúncia (5 a 300 caracteres).' });
  }

  try {
    const [report] = await sql`
      INSERT INTO listing_reports (listing_id, reason)
      SELECT id, ${reason} FROM listings WHERE id = ${listingId} AND status = 'approved'
      RETURNING id
    `;
    if (!report) return res.status(404).json({ error: 'Anúncio não encontrado.' });
    res.status(201).json({ message: 'Denúncia enviada para análise.' });
  } catch (error) {
    console.error('Could not report listing:', error.message);
    res.status(500).json({ error: 'Não foi possível enviar a denúncia.' });
  }
});

app.get('/api/moderation/listings', moderate, async (_req, res) => {
  try {
    const rows = await sql`SELECT id, title, category, neighborhood, description, phone, photo, created_at FROM listings WHERE status = 'pending' ORDER BY created_at ASC LIMIT 100`;
    res.json(rows);
  } catch (error) {
    console.error('Could not load moderation queue:', error.message);
    res.status(500).json({ error: 'Não foi possível carregar a fila de revisão.' });
  }
});

app.patch('/api/moderation/listings/:id', moderate, async (req, res) => {
  const listingId = Number(req.params.id);
  const status = req.body.status;
  if (!Number.isSafeInteger(listingId) || listingId < 1 || !['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Ação de moderação inválida.' });
  }

  try {
    const [updated] = await sql`UPDATE listings SET status = ${status} WHERE id = ${listingId} AND status = 'pending' RETURNING id, status`;
    if (!updated) return res.status(404).json({ error: 'Anúncio pendente não encontrado.' });
    res.json(updated);
  } catch (error) {
    console.error('Could not moderate listing:', error.message);
    res.status(500).json({ error: 'Não foi possível atualizar o anúncio.' });
  }
});

app.delete('/api/moderation/listings/:id', moderate, async (req, res) => {
  const listingId = Number(req.params.id);
  if (!Number.isSafeInteger(listingId) || listingId < 1) return res.status(400).json({ error: 'ID inválido.' });

  try {
    const [deleted] = await sql`DELETE FROM listings WHERE id = ${listingId} RETURNING id`;
    if (!deleted) return res.status(404).json({ error: 'Anúncio não encontrado.' });
    res.status(204).end();
  } catch (error) {
    console.error('Could not delete listing:', error.message);
    res.status(500).json({ error: 'Não foi possível remover o anúncio.' });
  }
});

app.get('/api/moderation/reports', moderate, async (_req, res) => {
  try {
    const rows = await sql`SELECT r.id, r.reason, r.created_at, l.id AS listing_id, l.title, l.status FROM listing_reports r JOIN listings l ON l.id = r.listing_id ORDER BY r.created_at ASC LIMIT 100`;
    res.json(rows);
  } catch (error) {
    console.error('Could not load reports:', error.message);
    res.status(500).json({ error: 'Não foi possível carregar as denúncias.' });
  }
});

app.delete('/api/moderation/reports/:id', moderate, async (req, res) => {
  const reportId = Number(req.params.id);
  if (!Number.isSafeInteger(reportId) || reportId < 1) return res.status(400).json({ error: 'ID inválido.' });

  try {
    const [deleted] = await sql`DELETE FROM listing_reports WHERE id = ${reportId} RETURNING id`;
    if (!deleted) return res.status(404).json({ error: 'Denúncia não encontrada.' });
    res.status(204).end();
  } catch (error) {
    console.error('Could not dismiss report:', error.message);
    res.status(500).json({ error: 'Não foi possível arquivar a denúncia.' });
  }
});

app.use(express.static(frontDirectory));
app.listen(port, () => console.log(`EcoComunidade is listening on http://localhost:${port}`));