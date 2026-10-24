const viewLinks = document.querySelectorAll('[data-view-link]');
const views = document.querySelectorAll('.view');
const navLinks = document.querySelectorAll('.nav-link');
const listingForm = document.querySelector('#listing-form');
const listingGrid = document.querySelector('#listing-grid');
const listingEmpty = document.querySelector('#listing-empty');
const categoryFilter = document.querySelector('#category-filter');
const listingStatus = document.querySelector('#listing-status');
const pointsList = document.querySelector('#points-list');
const pointsEmpty = document.querySelector('#points-empty');
const pointsFilter = document.querySelector('#points-filter');
const locateButton = document.querySelector('#locate-button');
const locationStatus = document.querySelector('#location-status');
const authDialog = document.querySelector('#auth-dialog');
const authStatus = document.querySelector('#auth-status');
const loginForm = document.querySelector('#login-form');
const registerForm = document.querySelector('#register-form');
const publishPanel = document.querySelector('#publish-panel');
const postingGate = document.querySelector('#posting-gate');
const accountName = document.querySelector('#account-name');
const logoutButton = document.querySelector('#logout-button');
let currentUser = null;
let currentCoordinates = null;

const API_BASE_URL = (window.ECO_API_BASE_URL || '').replace(/\/+$/, '');

function apiUrl(path) {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${API_BASE_URL}${normalizedPath}`;
}

function updateAuthUI(user) {
    currentUser = user;
    document.querySelectorAll('[data-auth-open="login"]').forEach((button) => { button.hidden = Boolean(user); });
    document.querySelectorAll('[data-auth-open="register"]').forEach((button) => { button.hidden = Boolean(user); });
    accountName.hidden = !user;
    logoutButton.hidden = !user;
    accountName.textContent = user ? `Olá, ${user.display_name}` : '';
    postingGate.hidden = Boolean(user);
    publishPanel.hidden = !user;
    document.querySelectorAll('.moderator-nav').forEach((button) => {
        button.hidden = user?.role !== 'moderator';
    });
}

function openAuth(mode) {
    loginForm.hidden = mode !== 'login';
    registerForm.hidden = mode !== 'register';
    document.querySelector('#auth-title').textContent = mode === 'register' ? 'Crie sua conta' : 'Entre na sua conta';
    authStatus.textContent = '';
    if (!authDialog.open) authDialog.showModal();
    const firstInput = (mode === 'register' ? registerForm : loginForm).querySelector('input');
    firstInput.focus();
}

document.querySelectorAll('[data-auth-open]').forEach((button) => {
    button.addEventListener('click', () => openAuth(button.dataset.authOpen));
});
document.querySelectorAll('[data-auth-close]').forEach((button) => {
    button.addEventListener('click', () => authDialog.close());
});
authDialog.addEventListener('click', (event) => {
    if (event.target === authDialog) authDialog.close();
});

async function submitAuth(form, endpoint) {
    authStatus.textContent = '';
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(Object.fromEntries(new FormData(form))),
        });
        const result = response.status === 204 ? {} : await response.json();
        if (!response.ok) throw new Error(result.error || 'Não foi possível concluir. Tente novamente.');
        updateAuthUI(result.user);
        form.reset();
        authDialog.close();
        if (document.querySelector('#mural').classList.contains('is-visible')) void renderListings();
        listingStatus.textContent = endpoint.endsWith('/register') ? 'Conta criada. Você já pode publicar um anúncio para revisão.' : 'Você entrou na sua conta.';
    } catch (error) {
        authStatus.textContent = error.message || 'Não foi possível conectar ao servidor.';
    } finally {
        submitButton.disabled = false;
    }
}

loginForm.addEventListener('submit', (event) => {
    event.preventDefault();
    void submitAuth(loginForm, '/api/auth/login');
});
registerForm.addEventListener('submit', (event) => {
    event.preventDefault();
    void submitAuth(registerForm, '/api/auth/register');
});

logoutButton.addEventListener('click', async () => {
    logoutButton.disabled = true;
    try {
        const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
        if (!response.ok) {
            const result = await response.json();
            throw new Error(result.error || 'Não foi possível sair da conta.');
        }
        updateAuthUI(null);
        publishPanel.open = false;
        listingStatus.textContent = 'Você saiu da sua conta.';
    } catch (error) {
        listingStatus.textContent = error.message || 'Não foi possível conectar ao servidor.';
    } finally {
        logoutButton.disabled = false;
    }
});

async function restoreSession() {
    try {
        const response = await fetch(apiUrl('/api/auth/session'), { credentials: 'include' });
        const result = await response.json();
        if (response.ok) updateAuthUI(result.user);
    } catch {
        updateAuthUI(null);
    }
}

function makeTextElement(tagName, className, text) {
    const element = document.createElement(tagName);
    element.className = className;
    element.textContent = text;
    return element;
}

function distanceInKm(from, to) {
    const radians = (degrees) => degrees * Math.PI / 180;
    const latitudeDelta = radians(to.latitude - from.latitude);
    const longitudeDelta = radians(to.longitude - from.longitude);
    const haversine = Math.sin(latitudeDelta / 2) ** 2
        + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude))
        * Math.sin(longitudeDelta / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

async function loadCollectionPoints() {
    const selectedCategory = pointsFilter.value;
    pointsList.replaceChildren();
    pointsEmpty.hidden = true;

    const query = selectedCategory ? `?category=${encodeURIComponent(selectedCategory)}` : '';
    try {
        const response = await fetch(`/api/collection-points${query}`);
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Não foi possível carregar os pontos.');

        const orderedPoints = result.map((point) => {
            const hasCoordinates = point.latitude !== null && point.longitude !== null
                && Number.isFinite(Number(point.latitude)) && Number.isFinite(Number(point.longitude));
            return {
                ...point,
                distance: currentCoordinates && hasCoordinates
                    ? distanceInKm(currentCoordinates, { latitude: Number(point.latitude), longitude: Number(point.longitude) })
                    : null,
            };
        }).sort((first, second) => {
            if (first.distance === null && second.distance === null) return first.name.localeCompare(second.name, 'pt-BR');
            if (first.distance === null) return 1;
            if (second.distance === null) return -1;
            return first.distance - second.distance;
        });

        orderedPoints.forEach((point) => {
            const card = document.createElement('article');
            card.className = 'point-card';
            const content = document.createElement('div');
            content.className = 'point-card-content';
            const titleRow = document.createElement('div');
            titleRow.className = 'point-title-row';
            titleRow.append(makeTextElement('span', 'point-category', point.category));
            if (point.distance !== null) titleRow.append(makeTextElement('span', 'point-distance', `${point.distance < 10 ? point.distance.toFixed(1) : Math.round(point.distance)} km`));
            content.append(titleRow);
            content.append(makeTextElement('h3', '', point.name));
            content.append(makeTextElement('p', 'point-materials', `Recebe: ${point.accepted_materials}`));
            content.append(makeTextElement('p', 'point-address', `${point.address} · ${point.neighborhood} · ${point.city}`));
            content.append(makeTextElement('p', 'point-hours', `Horário: ${point.opening_hours}`));
            const directions = document.createElement('a');
            directions.className = 'button button-dark point-directions';
            const destination = [point.address, point.neighborhood, point.city, 'SP', 'Brasil'].filter(Boolean).join(', ');
            directions.href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
            directions.target = '_blank';
            directions.rel = 'noopener noreferrer';
            directions.textContent = 'Como chegar';
            card.append(content, directions);
            if (point.source_url) {
                const source = document.createElement('a');
                source.className = 'point-source';
                source.href = point.source_url;
                source.target = '_blank';
                source.rel = 'noopener noreferrer';
                source.textContent = 'Fonte oficial';
                card.append(source);
            }
            pointsList.append(card);
        });

        pointsEmpty.hidden = orderedPoints.length > 0;
        if (!orderedPoints.length) {
            pointsEmpty.querySelector('h2').textContent = 'Nenhum ponto confirmado para este filtro.';
            pointsEmpty.querySelector('p').textContent = 'Estamos adicionando locais com endereço e horários verificados. Consulte a prefeitura enquanto isso.';
        }
        if (currentCoordinates) {
            locationStatus.textContent = orderedPoints.length
                ? `Pontos com coordenadas aparecem primeiro, do mais próximo ao mais distante. Os outros ficam abaixo sem distância estimada. Sua localização permanece neste aparelho.`
                : 'Localização ativa neste aparelho. Nenhum ponto verificado corresponde ao filtro ainda.';
        }
    } catch (error) {
        pointsEmpty.hidden = false;
        pointsEmpty.querySelector('h2').textContent = 'Não foi possível carregar os pontos.';
        pointsEmpty.querySelector('p').textContent = error.message || 'Confira sua conexão e tente novamente.';
    }
}

function locateNearbyPoints() {
    if (!navigator.geolocation) {
        locationStatus.textContent = 'Este navegador não oferece acesso à localização. Você ainda pode consultar os pontos confirmados.';
        return;
    }

    locateButton.disabled = true;
    locationStatus.textContent = 'Buscando sua localização…';
    navigator.geolocation.getCurrentPosition((position) => {
        currentCoordinates = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
        };
        locationStatus.textContent = 'Localização encontrada. Calculando os pontos mais próximos…';
        locateButton.disabled = false;
        void loadCollectionPoints();
    }, (error) => {
        locateButton.disabled = false;
        const messages = {
            1: 'Acesso à localização negado. Você pode permitir no navegador e tentar novamente.',
            2: 'Não foi possível determinar a localização. Tente novamente em alguns instantes.',
            3: 'A busca pela localização demorou demais. Tente novamente.',
        };
        locationStatus.textContent = messages[error.code] || 'Não foi possível acessar sua localização.';
    }, { enableHighAccuracy: false, timeout: 12_000, maximumAge: 60_000 });
}

async function renderListings() {
    if (!listingGrid) return;

    const selectedCategory = categoryFilter.value;
    listingGrid.replaceChildren();
    listingStatus.textContent = '';

    const query = selectedCategory ? `?category=${encodeURIComponent(selectedCategory)}` : '';
    let listings;
    try {
        const response = await fetch(`/api/listings${query}`);
        if (!response.ok) throw new Error('A resposta do servidor não foi válida.');
        listings = await response.json();
    } catch {
        listingEmpty.hidden = false;
        listingEmpty.querySelector('h2').textContent = 'Não foi possível carregar os anúncios.';
        listingEmpty.querySelector('p').textContent = 'Confira sua conexão e tente novamente.';
        return;
    }

    listings.forEach((listing) => {
        const card = document.createElement('article');
        card.className = 'idea-card listing-card';

        if (listing.photo) {
            const image = document.createElement('img');
            image.className = 'listing-photo';
            image.src = listing.photo;
            image.alt = `Foto de ${listing.title}`;
            card.append(image);
        } else {
            card.append(makeTextElement('span', 'idea-emoji', '♻'));
        }

        card.append(makeTextElement('span', 'idea-tag', listing.category));
        card.append(makeTextElement('h2', '', listing.title));
        card.append(makeTextElement('p', 'listing-neighborhood', listing.neighborhood));
        card.append(makeTextElement('p', 'listing-description', listing.description));
        card.append(makeTextElement('p', 'listing-date', `Publicado em ${new Date(listing.created_at).toLocaleDateString('pt-BR')}`));

        const contact = document.createElement('a');
        contact.className = 'button button-dark listing-contact';
        contact.href = `https://wa.me/${listing.phone}`;
        contact.target = '_blank';
        contact.rel = 'noopener noreferrer';
        contact.textContent = 'Chamar no WhatsApp';
        card.append(contact);

        const report = document.createElement('button');
        report.className = 'report-listing';
        report.type = 'button';
        report.textContent = 'Denunciar anúncio';
        report.addEventListener('click', async () => {
            const reason = window.prompt('Por que você está denunciando este anúncio?');
            if (!reason) return;
            try {
                const response = await fetch(`/api/listings/${listing.id}/reports`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reason }),
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || 'Não foi possível enviar a denúncia.');
                listingStatus.textContent = result.message;
            } catch (error) {
                listingStatus.textContent = error.message;
            }
        });
        card.append(report);
        listingGrid.append(card);
    });

    listingEmpty.hidden = listings.length > 0;
    listingEmpty.querySelector('h2').textContent = 'Ainda não há anúncios aprovados.';
    listingEmpty.querySelector('p').textContent = 'Anúncios novos passam por uma revisão rápida antes de aparecerem para a comunidade.';
}

async function moderationRequest(path, options = {}) {
    const response = await fetch(path, { ...options, credentials: 'same-origin' });
    const result = response.status === 204 ? null : await response.json();
    if (!response.ok) throw new Error(result?.error || 'Não foi possível concluir a ação.');
    return result;
}

async function loadModeration() {
    const pendingList = document.querySelector('#pending-list');
    const reportsList = document.querySelector('#reports-list');
    const status = document.querySelector('#moderation-status');
    const pendingEmpty = document.querySelector('#pending-empty');
    const reportsEmpty = document.querySelector('#reports-empty');
    status.textContent = 'Carregando fila…';
    pendingList.replaceChildren();
    reportsList.replaceChildren();

    try {
        const [pending, reports] = await Promise.all([
            moderationRequest('/api/moderation/listings'),
            moderationRequest('/api/moderation/reports'),
        ]);

        pending.forEach((listing) => {
            const card = document.createElement('article');
            card.className = 'moderation-card';
            card.append(makeTextElement('span', 'idea-tag', listing.category));
            card.append(makeTextElement('h3', '', listing.title));
            card.append(makeTextElement('p', 'moderation-meta', `${listing.neighborhood} · ${new Date(listing.created_at).toLocaleDateString('pt-BR')}`));
            card.append(makeTextElement('p', '', listing.description));
            if (listing.photo) {
                const image = document.createElement('img');
                image.className = 'listing-photo';
                image.src = listing.photo;
                image.alt = `Foto do anúncio ${listing.title}`;
                card.append(image);
            }
            card.append(makeTextElement('p', 'moderation-meta', `WhatsApp: ${listing.phone}`));
            const actions = document.createElement('div');
            actions.className = 'moderation-actions';
            actions.append(makeModerationButton('Aprovar', 'approve', async () => {
                await moderationRequest(`/api/moderation/listings/${listing.id}`, {
                    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'approved' }),
                });
                status.textContent = 'Anúncio aprovado e publicado.';
                await loadModeration();
            }));
            actions.append(makeModerationButton('Rejeitar', 'reject', async () => {
                await moderationRequest(`/api/moderation/listings/${listing.id}`, {
                    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'rejected' }),
                });
                status.textContent = 'Anúncio rejeitado.';
                await loadModeration();
            }));
            card.append(actions);
            pendingList.append(card);
        });

        reports.forEach((report) => {
            const card = document.createElement('article');
            card.className = 'moderation-card';
            card.append(makeTextElement('span', 'idea-tag', `Anúncio ${report.status === 'approved' ? 'publicado' : report.status}`));
            card.append(makeTextElement('h3', '', report.title));
            card.append(makeTextElement('p', '', `Motivo: ${report.reason}`));
            card.append(makeTextElement('p', 'moderation-meta', `Recebida em ${new Date(report.created_at).toLocaleDateString('pt-BR')}`));
            const actions = document.createElement('div');
            actions.className = 'moderation-actions';
            actions.append(makeModerationButton('Remover anúncio', 'reject', async () => {
                if (!window.confirm('Remover este anúncio e encerrar as denúncias relacionadas?')) return;
                await moderationRequest(`/api/moderation/listings/${report.listing_id}`, { method: 'DELETE' });
                status.textContent = 'Anúncio removido.';
                await loadModeration();
            }));
            actions.append(makeModerationButton('Arquivar denúncia', 'dismiss', async () => {
                await moderationRequest(`/api/moderation/reports/${report.id}`, { method: 'DELETE' });
                status.textContent = 'Denúncia arquivada; o anúncio não foi alterado.';
                await loadModeration();
            }));
            card.append(actions);
            reportsList.append(card);
        });

        document.querySelector('#pending-count').textContent = String(pending.length);
        document.querySelector('#reports-count').textContent = String(reports.length);
        pendingEmpty.hidden = pending.length > 0;
        reportsEmpty.hidden = reports.length > 0;
        if (!status.textContent || status.textContent === 'Carregando fila…') status.textContent = 'Fila atualizada.';
    } catch (error) {
        status.textContent = error.message || 'Não foi possível carregar a moderação.';
        pendingEmpty.hidden = true;
        reportsEmpty.hidden = true;
    }
}

function makeModerationButton(label, style, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `moderation-action moderation-action-${style}`;
    button.textContent = label;
    button.addEventListener('click', async () => {
        button.disabled = true;
        try {
            await onClick();
        } catch (error) {
            document.querySelector('#moderation-status').textContent = error.message;
            button.disabled = false;
        }
    });
    return button;
}

function showView(viewId) {
    const target = document.getElementById(viewId);
    if (!target) return;

    views.forEach((view) => {
        const isActive = view.id === viewId;
        view.classList.toggle('is-visible', isActive);
        view.hidden = !isActive;
    });

    navLinks.forEach((link) => {
        const isActive = link.dataset.viewLink === viewId;
        link.classList.toggle('is-active', isActive);
        if (isActive) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
    });

    if (viewId === 'mural') renderListings();
    if (viewId === 'pontos') void loadCollectionPoints();
    if (viewId === 'moderacao' && currentUser?.role === 'moderator') void loadModeration();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const heading = target.querySelector('h1');
    if (heading) {
        heading.setAttribute('tabindex', '-1');
        heading.focus({ preventScroll: true });
    }
}

viewLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
        event.preventDefault();
        showView(link.dataset.viewLink);
    });
});

if (categoryFilter) categoryFilter.addEventListener('change', () => { void renderListings(); });
document.querySelector('#refresh-moderation').addEventListener('click', () => { void loadModeration(); });
locateButton.addEventListener('click', locateNearbyPoints);
pointsFilter.addEventListener('change', () => { void loadCollectionPoints(); });

async function prepareListingPhoto(file) {
    if (!file || !file.size) return '';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        throw new Error('Escolha uma foto JPG, PNG ou WebP.');
    }
    if (file.size > 15 * 1024 * 1024) {
        throw new Error('A foto precisa ter menos de 15 MB. Escolha uma imagem menor.');
    }
    if (typeof createImageBitmap !== 'function') {
        throw new Error('Este navegador não conseguiu preparar a foto. Tente uma imagem menor ou publique sem foto.');
    }

    let image;
    try {
        image = await createImageBitmap(file);
        const maxDimension = 1280;
        const originalScale = Math.min(1, maxDimension / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');

        for (const scaleFactor of [1, 0.8, 0.64]) {
            const scale = originalScale * scaleFactor;
            canvas.width = Math.max(1, Math.round(image.width * scale));
            canvas.height = Math.max(1, Math.round(image.height * scale));
            const context = canvas.getContext('2d');
            if (!context) throw new Error('Não foi possível preparar a foto. Você ainda pode publicar sem ela.');
            context.drawImage(image, 0, 0, canvas.width, canvas.height);

            for (const quality of [0.82, 0.72, 0.62]) {
                const compressed = await new Promise((resolve, reject) => {
                    canvas.toBlob((blob) => {
                        if (blob) resolve(blob);
                        else reject(new Error('Não foi possível comprimir a foto. Você ainda pode publicar sem ela.'));
                    }, 'image/jpeg', quality);
                });
                if (compressed.size <= 350 * 1024) {
                    return await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.addEventListener('load', () => resolve(String(reader.result)));
                        reader.addEventListener('error', () => reject(new Error('Não foi possível ler a foto. Tente novamente.')));
                        reader.readAsDataURL(compressed);
                    });
                }
            }
        }
        throw new Error('Não foi possível reduzir essa foto o suficiente. Tente outra foto ou publique sem ela.');
    } catch (error) {
        if (error instanceof Error && error.message) throw error;
        throw new Error('Não foi possível abrir essa foto. Tente JPG, PNG ou WebP, ou publique sem foto.');
    } finally {
        image?.close();
    }
}

if (listingForm) {
    listingForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        listingStatus.textContent = '';

        const formData = new FormData(listingForm);
        const phone = String(formData.get('phone')).replace(/\D/g, '');
        if (phone.length < 10 || phone.length > 15) {
            listingStatus.textContent = 'Informe o telefone com código do país, entre 10 e 15 dígitos.';
            listingForm.elements.phone.focus();
            return;
        }

        const imageFile = formData.get('photo');
        const submitButton = listingForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        let photo = '';
        try {
            photo = await prepareListingPhoto(imageFile);
            const response = await fetch('/api/listings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({
                    title: formData.get('title'),
                    category: formData.get('category'),
                    neighborhood: formData.get('neighborhood'),
                    description: formData.get('description'),
                    phone,
                    photo,
                }),
            });
            const result = await response.json();
            if (response.status === 401) {
                openAuth('login');
                throw new Error('Entre na sua conta antes de publicar.');
            }
            if (!response.ok) throw new Error(result.error || 'Não foi possível enviar o anúncio.');
            listingForm.reset();
            categoryFilter.value = '';
            await renderListings();
            listingStatus.textContent = 'Recebemos seu anúncio. Ele ficará visível no mural depois que um moderador aprovar.';
        } catch (error) {
            listingStatus.textContent = error.message || 'Não foi possível conectar ao servidor.';
        } finally {
            submitButton.disabled = false;
        }
    });
}

void restoreSession();
