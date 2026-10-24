import assert from 'node:assert/strict';
import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { neon } from '@neondatabase/serverless';

const standalone = !process.env.API_BASE_URL;
const port = standalone ? randomInt(32_000, 49_000) : undefined;
const baseUrl = process.env.API_BASE_URL || `http://localhost:${port}`;
const moderatorToken = process.env.MODERATOR_TOKEN || randomBytes(32).toString('base64url');
const originHeaders = { Origin: baseUrl };
const sql = neon(process.env.DATABASE_URL);
let server;
let serverOutput = '';
let listingId;
let testUserId;
let moderatorCookie;
const moderatorHeaders = { 'Content-Type': 'application/json' };

if (standalone) {
  server = spawn(process.execPath, ['--env-file=.env.local', 'backend/server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), MODERATOR_TOKEN: moderatorToken, NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (chunk) => { serverOutput += chunk.toString(); });
  server.stderr.on('data', (chunk) => { serverOutput += chunk.toString(); });
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  if (response.status === 204) return { response, body: null };
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`Expected JSON from ${options.method || 'GET'} ${path}; got HTTP ${response.status}: ${text.slice(0, 180)}`);
  }
  return { response, body };
}

try {
  let health;
  const deadline = Date.now() + 30_000;
  do {
    if (server?.exitCode !== null && server?.exitCode !== undefined) throw new Error(`App exited before becoming ready:\n${serverOutput}`);
    try {
      health = await request('/api/health');
      if (health.response.status === 200) break;
    } catch { /* App or Neon is still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  } while (Date.now() < deadline);
  assert.equal(health?.response.status, 200, `Health endpoint failed: ${JSON.stringify(health?.body)}\n${serverOutput}`);
  assert.equal(health.body.database, 'connected');
  console.log('PASS: API connects to Neon Postgres');

  const points = await request('/api/collection-points');
  assert.equal(points.response.status, 200, `Collection point query failed: ${JSON.stringify(points.body)}`);
  assert.ok(Array.isArray(points.body), 'Collection point response is not a list');
  console.log('PASS: verified collection-point endpoint queries Neon');

const authEmail = `e2e-${Date.now()}-${randomInt(1000, 9999)}@example.invalid`;
const password = `E2E-${randomUUID()}-Strong!`;
const unauthenticatedPost = await request('/api/listings', {
  method: 'POST',
  headers: { ...originHeaders, 'Content-Type': 'application/json' },
  body: JSON.stringify({ title: 'No session', category: 'Utilidades', neighborhood: 'Test', description: 'Should not be accepted', phone: '5511999999999' }),
});
assert.equal(unauthenticatedPost.response.status, 401, 'Unauthenticated listing submission was not blocked');
console.log('PASS: anonymous users cannot post listings');

const registration = await request('/api/auth/register', {
  method: 'POST',
  headers: { ...originHeaders, 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'E2E Test User', email: authEmail, password }),
});
assert.equal(registration.response.status, 201, `Registration failed: ${JSON.stringify(registration.body)}`);
testUserId = registration.body.user.id;
const sessionCookie = registration.response.headers.getSetCookie().find((cookie) => cookie.startsWith('ecocomunidade_session='))?.split(';')[0];
assert.ok(sessionCookie, 'Registration did not set a session cookie');
console.log('PASS: registration creates a session cookie');

const restoredSession = await request('/api/auth/session', { headers: { Cookie: sessionCookie } });
assert.equal(restoredSession.response.status, 200);
assert.equal(restoredSession.body.user.email, authEmail);
console.log('PASS: session is restored from the server-side session store');

const memberModeration = await request('/api/moderation/listings', { headers: { Cookie: sessionCookie } });
assert.equal(memberModeration.response.status, 403, 'Ordinary member was allowed to moderate');
await sql`UPDATE app_users SET role = 'moderator' WHERE id = ${testUserId}`;
moderatorCookie = sessionCookie;
moderatorHeaders.Cookie = moderatorCookie;
const moderatorSession = await request('/api/auth/session', { headers: { Cookie: moderatorCookie } });
assert.equal(moderatorSession.body.user.role, 'moderator');
console.log('PASS: moderation endpoints are role-protected for normal members');

const marker = `E2E test listing ${Date.now()}`;
const created = await request('/api/listings', {
  method: 'POST',
  headers: { ...originHeaders, Cookie: sessionCookie, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: marker,
    category: 'Utilidades',
    neighborhood: 'Test neighborhood',
    description: 'Automated integration test; not a real offer.',
    phone: '5511999999999',
    photo: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2Q==',
  }),
});
assert.equal(created.response.status, 201, `Create listing failed: ${JSON.stringify(created.body)}`);
assert.equal(created.body.status, 'pending');
listingId = created.body.id;
console.log('PASS: authenticated listing is stored as pending moderation');

  const publicBefore = await request('/api/listings');
  assert.equal(publicBefore.response.status, 200);
  assert.equal(publicBefore.body.some((item) => item.id === listingId), false, 'Pending item leaked to public list');

  const queue = await request('/api/moderation/listings', { headers: moderatorHeaders });
  assert.equal(queue.response.status, 200, `Moderation queue failed: ${JSON.stringify(queue.body)}`);
  const queuedListing = queue.body.find((item) => item.id === listingId);
  assert.ok(queuedListing, 'Listing missing from moderator queue');
  assert.ok(queuedListing.photo?.startsWith('data:image/jpeg;base64,'), 'Listing photo was not stored');
  console.log('PASS: only authorized moderator can access pending listings and its photo');

  const approved = await request(`/api/moderation/listings/${listingId}`, {
    method: 'PATCH', headers: moderatorHeaders, body: JSON.stringify({ status: 'approved' }),
  });
  assert.equal(approved.response.status, 200, `Approval failed: ${JSON.stringify(approved.body)}`);

  const publicAfter = await request('/api/listings');
  assert.equal(publicAfter.body.some((item) => item.id === listingId), true, 'Approved item missing from public list');
  console.log('PASS: approved listing appears in public results');

  const reported = await request(`/api/listings/${listingId}/reports`, {
    method: 'POST', headers: { ...originHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'Automated integration-test report.' }),
  });
  assert.equal(reported.response.status, 201, `Report creation failed: ${JSON.stringify(reported.body)}`);

  const reports = await request('/api/moderation/reports', { headers: moderatorHeaders });
  assert.equal(reports.response.status, 200, `Reports queue failed: ${JSON.stringify(reports.body)}`);
  assert.equal(reports.body.some((report) => report.listing_id === listingId), true);
  console.log('PASS: report is stored and visible to moderators');

  const logout = await request('/api/auth/logout', { method: 'POST', headers: { ...originHeaders, Cookie: sessionCookie } });
  assert.equal(logout.response.status, 204, 'Logout failed');
  const sessionAfterLogout = await request('/api/auth/session', { headers: { Cookie: sessionCookie } });
  assert.equal(sessionAfterLogout.body.user, null, 'Server-side session remained active after logout');
  const login = await request('/api/auth/login', {
    method: 'POST', headers: { ...originHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: authEmail, password }),
  });
  assert.equal(login.response.status, 200, `Login failed: ${JSON.stringify(login.body)}`);
  const loginCookie = login.response.headers.getSetCookie().find((cookie) => cookie.startsWith('ecocomunidade_session='))?.split(';')[0];
  assert.ok(loginCookie, 'Login did not set a session cookie');
  console.log('PASS: registered user can sign in');

  await request('/api/auth/logout', { method: 'POST', headers: { ...originHeaders, Cookie: loginCookie } });
  const postAfterLogout = await request('/api/listings', {
    method: 'POST', headers: { ...originHeaders, Cookie: loginCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Logged out', category: 'Utilidades', neighborhood: 'Test', description: 'Should be denied', phone: '5511999999999' }),
  });
  assert.equal(postAfterLogout.response.status, 401, 'Logged-out user was allowed to post');
  console.log('PASS: logout invalidates the session and blocks posting');
} finally {
  if (listingId) await sql`DELETE FROM listings WHERE id = ${listingId}`;
  if (testUserId) await sql`DELETE FROM app_users WHERE id = ${testUserId}`;
  if (server && server.exitCode === null) server.kill();
}
