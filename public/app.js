// Importa as funções necessárias do SDK do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
// import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-analytics.js"; // Descomente se for usar
import { getAuth, signInAnonymously, signInWithEmailAndPassword, onAuthStateChanged, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
import { getFirestore, collection, onSnapshot, addDoc, doc, getDoc, setDoc, updateDoc, deleteDoc, query, where, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";

// Sua configuração do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBLeqJsQdDVYX2zKlcs9tGzdgYsvYFDog4", // ATENÇÃO: Considere proteger sua chave de API
    authDomain: "agropec-2025-app.firebaseapp.com",
    projectId: "agropec-2025-app",
    storageBucket: "agropec-2025-app.firebaseapp.com",
    messagingSenderId: "203743696437",
    appId: "1:203743696437:web:0332c09896cc34eb14437c",
    measurementId: "G-40JHQ2RPEQ"
};

let currentUserId = null;
let registrationContext = 'visitor'; // 'visitor' ou 'admin'
let globalEventsCache = []; // Cache para eventos, usado para edição
let globalExpositorsCache = []; // Cache para expositores, usado para edição

// Elementos da UI
const userIdDisplay = document.getElementById('user-id-display');
const sidebar = document.querySelector('.sidebar');
const navLoginLink = document.getElementById('nav-login-link'); // Link de login na sidebar
const logoutButton = document.getElementById('logout-button');
const adminDashboardLink = document.getElementById('admin-dashboard-link'); // Gerenciar Estandes
const organizadoresLink = document.getElementById('organizadores-link'); // Gerenciar Conteúdo
const adminUserRoleDisplayEstandes = document.getElementById('admin-user-role-display-estandes');
const adminUserRoleDisplayOrganizadores = document.getElementById('admin-user-role-display-organizadores');
const firebaseErrorMessage = document.getElementById('firebase-error-message');
const firebaseErrorDetails = document.getElementById('firebase-error-details');
const mobileMenuButton = document.getElementById('mobileMenuButton');

// Variáveis do Mapa Canvas
let fairMapCanvas, fairMapCtx, adminMapCanvas, adminMapCtx;
let stands = []; 
let adminMapTemporaryMarker = null;

// Função para exibir/ocultar a sidebar no mobile
document.getElementById('closeSidebarBtn').onclick = function() {
    document.querySelector('.sidebar').classList.add('-translate-x-full');
};

// Função para exibir/ocultar seções
window.showSection = function(sectionId, clickedLink) {
    console.log(`Exibindo seção: ${sectionId}`);
    const sections = document.querySelectorAll('.main-content section');
    const navLinks = document.querySelectorAll('.nav-link');
    const currentSectionTitle = document.getElementById('currentSectionTitle');

    sections.forEach(section => section.classList.remove('active'));
    const activeSection = document.getElementById(sectionId);
    if (activeSection) activeSection.classList.add('active');

    const titleMap = {
        'inicio': 'Painel Principal',
        'admin-dashboard': 'Gerenciar Estandes',
        'organizadores': 'Gerenciar Conteúdo do Evento',
        'stand-details': 'Detalhes da Estande',
        'welcome-role-selection': 'Bem-vindo!',
        'login': 'Acesso ao Evento',
        'agenda': 'Agenda do Evento',
        'expositores': 'Lista de Expositores',
        'mapa': 'Mapa da Feira'
    };
    if(currentSectionTitle) currentSectionTitle.textContent = titleMap[sectionId] || sectionId.charAt(0).toUpperCase() + sectionId.slice(1);

    navLinks.forEach(link => {
        link.classList.remove('active', 'bg-green-700', 'text-white'); // Classes mais escuras para ativo na sidebar
        if (sidebar.contains(link)) {
            link.classList.add('text-gray-300'); // Cor padrão para links da sidebar
            link.classList.remove('bg-green-500'); // Tailwind classe que pode ter sido adicionada antes
        }
    });

    if (clickedLink) {
        clickedLink.classList.add('active');
        if (sidebar.contains(clickedLink)) {
            clickedLink.classList.add('bg-green-700'); // Verde mais escuro para ativo na sidebar
            clickedLink.classList.add('text-white');
        } else {
            // Para links fora da sidebar, se houver (não é o caso atual)
            // clickedLink.classList.add('bg-green-500', 'text-white');
        }
    }
    
    if (window.innerWidth < 768 && sidebar && !sidebar.classList.contains('-translate-x-full')) {
        sidebar.classList.add('-translate-x-full');
    }
}

// Função para passar as imagens do carrossel
let carouselIndex = 0;
const totalSlides = 12; // atualize se mudar o número de imagens

let carouselInterval = null;
const intervalTime = 5000;

function moveCarousel(direction) {
    carouselIndex = (carouselIndex + direction + totalSlides) % totalSlides;
    document.getElementById("carousel-images").style.transform = `translateX(-${carouselIndex * 100}%)`;
    resetCarouselInterval(); // Reinicia o tempo sempre que o usuário clicar
}

function startCarouselInterval() {
    carouselInterval = setInterval(() => {
        carouselIndex = (carouselIndex + 1) % totalSlides;
        document.getElementById("carousel-images").style.transform = `translateX(-${carouselIndex * 100}%)`;
    }, intervalTime);
}

function resetCarouselInterval() {
    clearInterval(carouselInterval);
    startCarouselInterval();
}

// Inicia o carrossel ao carregar a página
startCarouselInterval();

//mover as imagens do carrossel
window.moveCarousel = moveCarousel;

// --- Funções do Mapa ---
function initMap(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) { console.error(`Canvas '${canvasId}' não encontrado.`); return; }
    const ctx = canvas.getContext('2d');
    
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr; // Usa a altura definida pelo CSS (.map-canvas)
    ctx.scale(dpr, dpr);

    if (canvasId === 'fairMapCanvas') { fairMapCanvas = canvas; fairMapCtx = ctx; }
    else if (canvasId === 'adminMapCanvas') { adminMapCanvas = canvas; adminMapCtx = ctx; }

    if (canvasId === 'adminMapCanvas') {
        canvas.removeEventListener('click', handleMapClick);
        canvas.addEventListener('click', handleMapClick);
    } else if (canvasId === 'fairMapCanvas') {
        canvas.removeEventListener('click', handleFairMapClick);
        canvas.addEventListener('click', handleFairMapClick);
    }
    
    window.removeEventListener('resize', () => handleMapResize(canvasId)); // Evita duplicatas
    window.addEventListener('resize', () => handleMapResize(canvasId));
    
    drawMap(canvasId, ctx, canvas.clientWidth, canvas.clientHeight); // Usa clientWidth/Height para dimensões CSS
    if (window.db) loadPublicLocations();
}

function handleMapResize(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    drawMap(canvasId, ctx, rect.width, rect.height); // Passa as dimensões CSS
}

function drawMap(canvasId, ctx, cssWidth, cssHeight) {
    if (!ctx) return;
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    ctx.fillStyle = '#F0F0F0'; 
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    // Desenho simplificado do mapa para focar na funcionalidade das estandes
    const streetColor = '#A0A0A0';
    ctx.fillStyle = streetColor;
    ctx.fillRect(cssWidth * 0.1, 0, cssWidth * 0.08, cssHeight); // Rua vertical 1
    ctx.fillRect(cssWidth * 0.82, 0, cssWidth * 0.08, cssHeight); // Rua vertical 2
    ctx.fillRect(0, cssHeight * 0.2, cssWidth, cssHeight * 0.08); // Rua horizontal 1
    ctx.fillRect(0, cssHeight * 0.72, cssWidth, cssHeight * 0.08); // Rua horizontal 2

    stands.forEach(stand => {
        // As coordenadas X, Y são salvas relativas ao tamanho CSS do mapa de admin (400px de altura)
        // Precisamos escalar para o tamanho atual do mapa de visualização, se diferente.
        // Para simplificar, vamos assumir que o mapa de admin e visualização têm a mesma proporção de altura
        // e que as coordenadas são salvas em pixels absolutos para um mapa de altura 400px.
        const originalMapHeightForCoords = 400; // A altura base para a qual as coords foram salvas
        const scaleFactor = cssHeight / originalMapHeightForCoords;

        const displayX = stand.x * scaleFactor;
        const displayY = stand.y * scaleFactor;
        
        const standSize = Math.min(20 * scaleFactor, cssWidth * 0.03, cssHeight * 0.04);
        const halfSize = standSize / 2;

        ctx.fillStyle = '#4CAF50'; 
        ctx.strokeStyle = '#388E3C'; 
        ctx.lineWidth = 2 * scaleFactor;
        ctx.fillRect(displayX - halfSize, displayY - halfSize, standSize, standSize);
        ctx.strokeRect(displayX - halfSize, displayY - halfSize, standSize, standSize);

        ctx.fillStyle = '#FFFFFF'; 
        ctx.font = `bold ${Math.max(8, standSize * 0.4)}px Inter`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(stand.id, displayX, displayY);

        if (stand.occupant) {
            ctx.fillStyle = '#424242'; 
            ctx.font = `${Math.max(7, standSize * 0.35)}px Inter`;
            ctx.fillText(stand.occupant, displayX, displayY + halfSize + Math.max(7, standSize * 0.35));
        }
    });

    if (canvasId === 'adminMapCanvas' && adminMapTemporaryMarker) {
        ctx.fillStyle = 'red';
        ctx.beginPath();
        ctx.arc(adminMapTemporaryMarker.x, adminMapTemporaryMarker.y, 5, 0, Math.PI * 2); // Marcador usa coords diretas do clique
        ctx.fill();
    }
}

function handleMapClick(event) { // Admin map click
    const currentActiveSection = document.querySelector('.main-content section.active');
    if (!adminMapCanvas || (currentActiveSection && currentActiveSection.id !== 'admin-dashboard')) return;

    const rect = adminMapCanvas.getBoundingClientRect();
    const x = event.clientX - rect.left; // Coordenada X relativa ao elemento canvas CSS
    const y = event.clientY - rect.top; // Coordenada Y relativa ao elemento canvas CSS

    document.getElementById('standX').value = Math.round(x);
    document.getElementById('standY').value = Math.round(y);
    document.getElementById('standCoordinatesDisplay').value = `X: ${Math.round(x)}, Y: ${Math.round(y)}`;

    adminMapTemporaryMarker = { x, y };
    drawMap('adminMapCanvas', adminMapCtx, adminMapCanvas.clientWidth, adminMapCanvas.clientHeight);
}

function handleFairMapClick(event) { // Visitor map click
    if (!fairMapCanvas || stands.length === 0) return;
    const rect = fairMapCanvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    const originalMapHeightForCoords = 400;
    const scaleFactor = fairMapCanvas.clientHeight / originalMapHeightForCoords;

    let clickedStand = null;
    for (const stand of stands) {
        const displayX = stand.x * scaleFactor;
        const displayY = stand.y * scaleFactor;
        const standSize = Math.min(20 * scaleFactor, fairMapCanvas.clientWidth * 0.03, fairMapCanvas.clientHeight * 0.04);
        const halfSize = standSize / 2;

        if (clickX >= displayX - halfSize && clickX <= displayX + halfSize &&
            clickY >= displayY - halfSize && clickY <= displayY + halfSize) {
            clickedStand = stand;
            break;
        }
    }
    if (clickedStand) window.location.hash = `#stand-details?id=${clickedStand.id}`;
}

// --- Funções de Gerenciamento de Conteúdo (Organizadores) ---
async function addNewNews(newsData) {
    if (!currentUserId || !window.db) { console.error("Usuário ou DB não disponível"); return; }
    const messageEl = document.getElementById('news-message');
    try {
        const newsCollectionRef = collection(window.db, `artifacts/${firebaseConfig.appId}/public/data/news`);
        await addDoc(newsCollectionRef, { ...newsData, publishedAt: serverTimestamp(), authorId: currentUserId });
        messageEl.textContent = 'Notícia publicada!'; messageEl.className = 'text-green-600 text-sm mt-2';
        document.getElementById('news-form').reset();
    } catch (error) {
        console.error("Erro ao publicar notícia:", error);
        messageEl.textContent = 'Erro ao publicar.'; messageEl.className = 'text-red-500 text-sm mt-2';
    }
}

async function submitEventForm(eventData, eventIdToUpdate = null) {
    if (!currentUserId || !window.db) { console.error("Usuário ou DB não disponível"); return; }
    const messageEl = document.getElementById('event-message');
    const eventsCollectionRef = collection(window.db, `artifacts/${firebaseConfig.appId}/public/data/events`);
    
    try {
        if (eventIdToUpdate) { // Atualizando evento existente
            const eventDocRef = doc(window.db, `artifacts/${firebaseConfig.appId}/public/data/events`, eventIdToUpdate);
            await updateDoc(eventDocRef, { ...eventData, updatedAt: serverTimestamp() });
            messageEl.textContent = 'Evento atualizado!';
        } else { // Adicionando novo evento
            await addDoc(eventsCollectionRef, { ...eventData, createdAt: serverTimestamp(), createdBy: currentUserId });
            messageEl.textContent = 'Evento adicionado!';
        }
        messageEl.className = 'text-green-600 text-sm mt-2';
        document.getElementById('event-form').reset();
        document.getElementById('eventIdToUpdate').value = ''; // Limpa ID de edição
        document.getElementById('event-submit-button').textContent = 'Adicionar Evento';
        document.getElementById('event-cancel-edit-button').classList.add('hidden');
    } catch (error) {
        console.error("Erro ao salvar evento:", error);
        messageEl.textContent = 'Erro ao salvar evento.'; messageEl.className = 'text-red-500 text-sm mt-2';
    }
}

async function submitExpositorInfoForm(expositorData, expositorIdToUpdate = null) {
    if (!currentUserId || !window.db) { console.error("Usuário ou DB não disponível"); return; }
    const messageEl = document.getElementById('expositor-info-message');
    const expositorsCollectionRef = collection(window.db, `artifacts/${firebaseConfig.appId}/public/data/expositores`);
    
    try {
        if (expositorIdToUpdate) {
            const expositorDocRef = doc(window.db, `artifacts/${firebaseConfig.appId}/public/data/expositores`, expositorIdToUpdate);
            await updateDoc(expositorDocRef, { ...expositorData, updatedAt: serverTimestamp() });
            messageEl.textContent = 'Informações do expositor atualizadas!';
        } else {
            await addDoc(expositorsCollectionRef, { ...expositorData, createdAt: serverTimestamp(), createdBy: currentUserId });
            messageEl.textContent = 'Expositor adicionado!';
        }
        messageEl.className = 'text-green-600 text-sm mt-2';
        document.getElementById('expositor-info-form').reset();
        document.getElementById('expositorIdToUpdate').value = '';
        document.getElementById('expositor-info-submit-button').textContent = 'Adicionar Expositor';
        document.getElementById('expositor-info-cancel-edit-button').classList.add('hidden');
    } catch (error) {
        console.error("Erro ao salvar expositor:", error);
        messageEl.textContent = 'Erro ao salvar expositor.'; messageEl.className = 'text-red-500 text-sm mt-2';
    }
}


async function addNewInfo(infoData) {
    if (!currentUserId || !window.db) { console.error("Usuário ou DB não disponível"); return; }
    const messageEl = document.getElementById('info-message');
    try {
        const infoCollectionRef = collection(window.db, `artifacts/${firebaseConfig.appId}/public/data/generalInfo`);
        await addDoc(infoCollectionRef, { ...infoData, createdAt: serverTimestamp(), authorId: currentUserId });
        messageEl.textContent = 'Informação publicada!'; messageEl.className = 'text-green-600 text-sm mt-2';
        document.getElementById('info-form').reset();
    } catch (error) {
        console.error("Erro ao publicar informação:", error);
        messageEl.textContent = 'Erro ao publicar.'; messageEl.className = 'text-red-500 text-sm mt-2';
    }
}

// --- Funções de Carregamento de Dados Públicos ---
function loadPublicNews() {
    if (!window.db) return;
    const newsContainer = document.getElementById('public-news-container');
    if (!newsContainer) return;
    const newsCollectionRef = collection(window.db, `artifacts/${firebaseConfig.appId}/public/data/news`);
    const qNews = query(newsCollectionRef, where("date", "<=", new Date().toISOString().split('T')[0])); // Exemplo de filtro
    
    onSnapshot(qNews, (snapshot) => {
        newsContainer.innerHTML = '';
        if (snapshot.empty) {
            newsContainer.innerHTML = '<p class="text-gray-500 col-span-full">Nenhuma notícia recente.</p>';
            return;
        }
        snapshot.forEach(doc => {
            const news = doc.data();
            const newsCard = `
                <div class="card p-6">
                    <h4 class="font-semibold text-lg mb-1 text-green-700">${news.title}</h4>
                    <p class="text-xs text-gray-400 mb-2">Publicado em: ${new Date(news.date).toLocaleDateString('pt-BR')}</p>
                    <p class="text-gray-600 text-sm">${news.content.substring(0,150)}${news.content.length > 150 ? '...' : ''}</p>
                    </div>`;
            newsContainer.innerHTML += newsCard;
        });
    }, error => {
        console.error("Erro ao carregar notícias:", error);
        newsContainer.innerHTML = '<p class="text-red-500 col-span-full">Erro ao carregar notícias.</p>';
    });
}

function loadPublicGeneralInfo() {
    if (!window.db) return;
    const infoContainer = document.getElementById('public-info-container');
    if (!infoContainer) return;
    const infoCollectionRef = collection(window.db, `artifacts/${firebaseConfig.appId}/public/data/generalInfo`);
    
    onSnapshot(infoCollectionRef, (snapshot) => {
        infoContainer.innerHTML = '';
        if (snapshot.empty) {
            infoContainer.innerHTML = '<p class="text-gray-500">Nenhuma informação geral disponível.</p>';
            return;
        }
        snapshot.forEach(doc => {
            const info = doc.data();
            const infoItem = `
                <div class="mb-3 pb-3 border-b border-gray-200 last:border-b-0">
                    <h5 class="font-medium text-md text-green-600">${info.title}</h5>
                    <p class="text-gray-600 text-sm">${info.content}</p>
                </div>`;
            infoContainer.innerHTML += infoItem;
        });
    }, error => {
        console.error("Erro ao carregar informações gerais:", error);
        infoContainer.innerHTML = '<p class="text-red-500">Erro ao carregar informações.</p>';
    });
}


// --- Funções de Carregamento e Exibição (Agenda, Expositores, Estandes) ---
// (loadPublicEvents, loadPublicExpositores, loadPublicLocations, displayCollectedData, etc., adaptadas)

function displayAdminEventsList(events) {
    const listContainer = document.getElementById('admin-events-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';
    if (events.length === 0) {
        listContainer.innerHTML = '<p class="text-gray-500">Nenhum evento cadastrado.</p>'; return;
    }
    events.forEach(event => {
        const item = document.createElement('div');
        item.className = 'p-3 border rounded-md bg-gray-50 flex justify-between items-center';
        item.innerHTML = `
            <div>
                <h4 class="font-semibold text-md text-green-700">${event.title}</h4>
                <p class="text-sm text-gray-600">${event.date} - ${event.time} @ ${event.location}</p>
            </div>
            <div>
                <button class="text-blue-500 hover:text-blue-700 text-sm mr-2 edit-event-btn" data-event-id="${event.id}">Editar</button>
                <button class="text-red-500 hover:text-red-700 text-sm delete-event-btn" data-event-id="${event.id}">Excluir</button>
            </div>`;
        listContainer.appendChild(item);
    });
    // Adicionar listeners para botões de editar/excluir
    listContainer.querySelectorAll('.edit-event-btn').forEach(btn => btn.addEventListener('click', (e) => populateEventFormForEdit(e.target.dataset.eventId)));
    listContainer.querySelectorAll('.delete-event-btn').forEach(btn => btn.addEventListener('click', (e) => handleDeleteEvent(e.target.dataset.eventId)));
}

function populateEventFormForEdit(eventId) {
    const event = globalEventsCache.find(e => e.id === eventId);
    if (!event) return;
    document.getElementById('eventIdToUpdate').value = event.id;
    document.getElementById('eventTitle').value = event.title;
    document.getElementById('eventType').value = event.type;
    document.getElementById('eventDate').value = event.date;
    document.getElementById('eventTime').value = event.time;
    document.getElementById('eventLocation').value = event.location;
    document.getElementById('eventDescription').value = event.description;
    document.getElementById('event-submit-button').textContent = 'Atualizar Evento';
    document.getElementById('event-cancel-edit-button').classList.remove('hidden');
    document.getElementById('event-form').scrollIntoView({ behavior: 'smooth' });
}

async function handleDeleteEvent(eventId) {
    if (!window.db || !eventId) return;
    // Substituir confirm por um modal customizado no futuro
    if (window.confirm('Tem certeza que deseja excluir este evento?')) {
        try {
            await deleteDoc(doc(window.db, `artifacts/${firebaseConfig.appId}/public/data/events`, eventId));
            console.log('Evento excluído:', eventId); // Lista será atualizada pelo onSnapshot
        } catch (error) { console.error('Erro ao excluir evento:', error); alert('Erro ao excluir.'); }
    }
}

function displayAdminExpositorsList(expositors) {
    const listContainer = document.getElementById('admin-expositors-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';
    if (expositors.length === 0) {
        listContainer.innerHTML = '<p class="text-gray-500">Nenhum expositor cadastrado.</p>'; return;
    }
    expositors.forEach(expo => {
        const item = document.createElement('div');
        item.className = 'p-3 border rounded-md bg-gray-50 flex justify-between items-center';
        item.innerHTML = `
            <div>
                <h4 class="font-semibold text-md text-green-700">${expo.name}</h4>
                <p class="text-sm text-gray-600">${expo.category || 'Sem categoria'}</p>
            </div>
            <div>
                <button class="text-blue-500 hover:text-blue-700 text-sm mr-2 edit-expositor-btn" data-expositor-id="${expo.id}">Editar</button>
                <button class="text-red-500 hover:text-red-700 text-sm delete-expositor-btn" data-expositor-id="${expo.id}">Excluir</button>
            </div>`;
        listContainer.appendChild(item);
    });
    listContainer.querySelectorAll('.edit-expositor-btn').forEach(btn => btn.addEventListener('click', (e) => populateExpositorFormForEdit(e.target.dataset.expositorId)));
    listContainer.querySelectorAll('.delete-expositor-btn').forEach(btn => btn.addEventListener('click', (e) => handleDeleteExpositor(e.target.dataset.expositorId)));
}

function populateExpositorFormForEdit(expositorId) {
    const expo = globalExpositorsCache.find(e => e.id === expositorId);
    if (!expo) return;
    document.getElementById('expositorIdToUpdate').value = expo.id;
    document.getElementById('expositorName').value = expo.name;
    document.getElementById('expositorCategory').value = expo.category || '';
    document.getElementById('expositorDescription').value = expo.description || '';
    document.getElementById('expositorLogoUrl').value = expo.logoUrl || '';
    document.getElementById('expositor-info-submit-button').textContent = 'Atualizar Expositor';
    document.getElementById('expositor-info-cancel-edit-button').classList.remove('hidden');
    document.getElementById('expositor-info-form').scrollIntoView({ behavior: 'smooth' });
}

async function handleDeleteExpositor(expositorId) {
    if (!window.db || !expositorId) return;
    if (window.confirm('Tem certeza que deseja excluir este expositor?')) {
        try {
            await deleteDoc(doc(window.db, `artifacts/${firebaseConfig.appId}/public/data/expositores`, expositorId));
            console.log('Expositor excluído:', expositorId);
        } catch (error) { console.error('Erro ao excluir expositor:', error); alert('Erro ao excluir.'); }
    }
}


// --- Funções de Autenticação ---
// (handleRegister, handleLogin, handleVisitorLogin, handleLogout - adaptadas)

// --- Inicialização e Listeners Globais ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM carregado. App Agropec inicializando...");

    const qrCodeModal = document.getElementById('qrCodeModal');
    if (qrCodeModal) qrCodeModal.style.display = 'none';

    let app, db, auth; // analytics;
    try {
        app = initializeApp(firebaseConfig);
        // analytics = getAnalytics(app);
        db = getFirestore(app);
        auth = getAuth(app);
        window.db = db; window.auth = auth;
        console.log("Firebase inicializado.");
        if(firebaseErrorMessage) firebaseErrorMessage.classList.add('hidden');
    } catch (error) {
        console.error("Erro CRUCIAL ao inicializar Firebase:", error);
        if(firebaseErrorDetails) firebaseErrorDetails.textContent = error.message;
        if(firebaseErrorMessage) firebaseErrorMessage.classList.remove('hidden');
        return; 
    }
    
    initMap('fairMapCanvas');
    initMap('adminMapCanvas');

    if (window.auth) {
        onAuthStateChanged(window.auth, async (user) => {
            if (user) {
                currentUserId = user.uid;
                if (userIdDisplay) {
                    userIdDisplay.textContent = user.isAnonymous ? `Visitante` : (user.email || 'Usuário');
                    userIdDisplay.classList.remove('hidden');
                }
                if(navLoginLink) navLoginLink.classList.add('hidden'); // Esconde link de login
                if(sidebar) { sidebar.classList.remove('sidebar-initial-hidden', '-translate-x-full'); }
                if(logoutButton) logoutButton.classList.remove('hidden');

                loadPublicEvents(); loadPublicExpositores(); loadPublicLocations();
                loadPublicNews(); loadPublicGeneralInfo(); // Carrega novo conteúdo

                let userRole = 'visitor';
                if (!user.isAnonymous) {
                    const userProfileDocRef = doc(window.db, `artifacts/${firebaseConfig.appId}/users/${user.uid}/profile/details`);
                    try {
                        const userProfileSnap = await getDoc(userProfileDocRef);
                        if(userProfileSnap.exists()) userRole = userProfileSnap.data().role || 'visitor';
                    } catch (e) { console.error("Erro perfil:", e); }
                }
                
                const isAdmin = userRole === 'admin';
                if(adminDashboardLink) adminDashboardLink.classList.toggle('hidden', !isAdmin);
                if(organizadoresLink) organizadoresLink.classList.toggle('hidden', !isAdmin);
                
                const adminRoleText = `Logado como: Administrador (${user.email || 'N/A'})`;
                if(adminUserRoleDisplayEstandes) adminUserRoleDisplayEstandes.textContent = isAdmin ? adminRoleText : '';
                if(adminUserRoleDisplayOrganizadores) adminUserRoleDisplayOrganizadores.textContent = isAdmin ? adminRoleText : '';

                const hash = window.location.hash;
                if (hash.startsWith('#stand-details?id=')) {
                    window.showSection('stand-details', null); loadStandDetails(hash.split('id=')[1]);
                } else if (isAdmin && (hash === '' || hash === '#login' || hash === '#welcome-role-selection')) {
                    window.showSection('organizadores', document.querySelector('a[href="#organizadores"]'));
                } else if (!isAdmin && (hash === '' || hash === '#login' || hash === '#welcome-role-selection' || hash === '#admin-dashboard' || hash === '#organizadores')) {
                    window.showSection('inicio', document.querySelector('a[href="#inicio"]'));
                } else if (hash) {
                    const sectionIdFromHash = hash.substring(1).split('?')[0];
                    const linkForHash = document.querySelector(`.nav-link[href="#${sectionIdFromHash}"]`);
                    if (linkForHash && (!linkForHash.classList.contains('hidden') || isAdmin)) { // Admins podem ver seções ocultas se o link existir
                         window.showSection(sectionIdFromHash, linkForHash);
                    } else {
                         window.showSection(isAdmin ? 'organizadores' : 'inicio', document.querySelector(isAdmin ? 'a[href="#organizadores"]' : 'a[href="#inicio"]'));
                    }
                } else {
                     window.showSection(isAdmin ? 'organizadores' : 'inicio', document.querySelector(isAdmin ? 'a[href="#organizadores"]' : 'a[href="#inicio"]'));
                }

            } else { // Usuário deslogado
                currentUserId = null;
                if (userIdDisplay) { userIdDisplay.textContent = ''; userIdDisplay.classList.add('hidden'); }
                if(navLoginLink) navLoginLink.classList.remove('hidden'); // Mostra link de login
                if(sidebar) { sidebar.classList.add('-translate-x-full'); } // Esconde sidebar (não usar sidebar-initial-hidden aqui para permitir animação)
                if(logoutButton) logoutButton.classList.add('hidden');
                if(adminDashboardLink) adminDashboardLink.classList.add('hidden');
                if(organizadoresLink) organizadoresLink.classList.add('hidden');
                if(adminUserRoleDisplayEstandes) adminUserRoleDisplayEstandes.textContent = '';
                if(adminUserRoleDisplayOrganizadores) adminUserRoleDisplayOrganizadores.textContent = '';
                
                const hash = window.location.hash;
                if (hash.startsWith('#stand-details?id=')) {
                    window.showSection('stand-details', null); loadStandDetails(hash.split('id=')[1]);
                } else {
                    window.showSection('welcome-role-selection', null);
                }
            }
        });
    }

    // --- Listeners de Formulários de Conteúdo (Organizadores) ---
    const newsForm = document.getElementById('news-form');
    if (newsForm) newsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await addNewNews({ title: document.getElementById('newsTitle').value, content: document.getElementById('newsContent').value, date: document.getElementById('newsDate').value });
    });

    const eventForm = document.getElementById('event-form');
    if (eventForm) eventForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const eventIdToUpdate = document.getElementById('eventIdToUpdate').value;
        await submitEventForm({
            title: document.getElementById('eventTitle').value, type: document.getElementById('eventType').value,
            date: document.getElementById('eventDate').value, time: document.getElementById('eventTime').value,
            location: document.getElementById('eventLocation').value, description: document.getElementById('eventDescription').value
        }, eventIdToUpdate || null);
    });
    const eventCancelEditBtn = document.getElementById('event-cancel-edit-button');
    if(eventCancelEditBtn) eventCancelEditBtn.addEventListener('click', () => {
        document.getElementById('event-form').reset();
        document.getElementById('eventIdToUpdate').value = '';
        document.getElementById('event-submit-button').textContent = 'Adicionar Evento';
        eventCancelEditBtn.classList.add('hidden');
    });


    const expositorInfoForm = document.getElementById('expositor-info-form');
    if (expositorInfoForm) expositorInfoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const expositorIdToUpdate = document.getElementById('expositorIdToUpdate').value;
        await submitExpositorInfoForm({
            name: document.getElementById('expositorName').value,
            category: document.getElementById('expositorCategory').value,
            description: document.getElementById('expositorDescription').value,
            logoUrl: document.getElementById('expositorLogoUrl').value
        }, expositorIdToUpdate || null);
    });
    const expositorCancelEditBtn = document.getElementById('expositor-info-cancel-edit-button');
    if(expositorCancelEditBtn) expositorCancelEditBtn.addEventListener('click', () => {
        document.getElementById('expositor-info-form').reset();
        document.getElementById('expositorIdToUpdate').value = '';
        document.getElementById('expositor-info-submit-button').textContent = 'Adicionar Expositor';
        expositorCancelEditBtn.classList.add('hidden');
    });


    const infoForm = document.getElementById('info-form');
    if (infoForm) infoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await addNewInfo({ title: document.getElementById('infoTitle').value, content: document.getElementById('infoContent').value });
    });
    
    // Outros Listeners (login, logout, forms de estande, etc.)
    // ... (código de listeners de handleRegister, handleLogin, etc. do seu script original) ...
    // Adaptei alguns para melhor clareza e consistência.

    if(mobileMenuButton && sidebar) {
        mobileMenuButton.addEventListener('click', () => sidebar.classList.toggle('-translate-x-full'));
    }
    document.addEventListener('click', function(event) {
        if(sidebar && mobileMenuButton && window.innerWidth < 768 && !sidebar.classList.contains('-translate-x-full')) {
            if (!sidebar.contains(event.target) && !mobileMenuButton.contains(event.target)) {
                sidebar.classList.add('-translate-x-full');
            }
        }
    });

    const registerLink = document.getElementById('register-link');
    if (registerLink) registerLink.addEventListener('click', (e) => { e.preventDefault(); handleRegister(); });
    const loginButtonEl = document.getElementById('login-button');
    if (loginButtonEl) loginButtonEl.addEventListener('click', (e) => { e.preventDefault(); handleLogin(); });
    const visitorButton = document.getElementById('visitor-button');
    if (visitorButton) visitorButton.addEventListener('click', (e) => { e.preventDefault(); registrationContext = 'visitor'; handleVisitorLogin(); });
    const adminButton = document.getElementById('admin-button');
    if (adminButton) adminButton.addEventListener('click', (e) => { e.preventDefault(); registrationContext = 'admin'; window.showSection('login', document.querySelector('a[href="#login"]')); });
    if (logoutButton) logoutButton.addEventListener('click', handleLogout);

    const locationForm = document.getElementById('location-form');
    if (locationForm) locationForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const standX = parseInt(document.getElementById('standX').value, 10);
        const standY = parseInt(document.getElementById('standY').value, 10);
        const messageEl = document.getElementById('location-message');
        if (isNaN(standX) || isNaN(standY)) {
            messageEl.textContent = 'Clique no mapa para coords.'; messageEl.className = 'text-red-500 text-sm mt-2'; return;
        }
        await addNewLocation({ 
            id: document.getElementById('standId').value, 
            occupant: document.getElementById('standOccupant').value, 
            x: standX, y: standY 
        });
    });
    
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash;
        console.log("Hash alterado para:", hash);
        const user = window.auth ? window.auth.currentUser : null; // Verifica se auth está definido
        const isAdminUser = user && !user.isAnonymous && user.role === 'admin'; // Supondo que user.role é setado

        if (hash.startsWith('#stand-details?id=')) {
            window.showSection('stand-details', null); loadStandDetails(hash.split('id=')[1]);
        } else if (user) {
            const sectionIdFromHash = hash ? hash.substring(1).split('?')[0] : (isAdminUser ? 'organizadores' : 'inicio');
            const linkForHash = document.querySelector(`.nav-link[href="#${sectionIdFromHash}"]`);
             if (linkForHash && (!linkForHash.classList.contains('hidden') || isAdminUser )) {
                 window.showSection(sectionIdFromHash, linkForHash);
             } else { // Fallback se o link estiver oculto ou não existir
                 window.showSection(isAdminUser ? 'organizadores' : 'inicio', document.querySelector(isAdminUser ? 'a[href="#organizadores"]' : 'a[href="#inicio"]'));
             }
        } else { // Usuário deslogado
            window.showSection('welcome-role-selection', null);
        }
    });
});


// Funções de autenticação (adaptadas do seu script original)
async function handleRegister() {
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginMessageDiv = document.getElementById('login-message');
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    loginMessageDiv.textContent = '';

    if (!email || !password) {
        loginMessageDiv.textContent = "Preencha e-mail e senha para criar conta.";
        loginMessageDiv.className = 'text-red-500 text-center mt-4 text-sm font-medium'; return;
    }
    if (!window.auth || !window.db) {
        loginMessageDiv.textContent = "Erro: Autenticação não disponível.";
        loginMessageDiv.className = 'text-red-500 text-center mt-4 text-sm font-medium'; return;
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(window.auth, email, password);
        const user = userCredential.user;
        // Salva o perfil do usuário com a role definida por registrationContext
        const userProfileDocRef = doc(window.db, `artifacts/${firebaseConfig.appId}/users/${user.uid}/profile/details`);
        await setDoc(userProfileDocRef, {
            uid: user.uid, email: user.email, createdAt: serverTimestamp(), role: registrationContext // Usa registrationContext
        });
        loginMessageDiv.textContent = "Conta criada! Você já pode entrar.";
        loginMessageDiv.className = 'text-green-600 text-center mt-4 text-sm font-medium';
        emailInput.value = ''; passwordInput.value = '';
    } catch (error) {
        console.error("Erro ao criar conta:", error);
        let msg = "Erro ao criar conta.";
        if (error.code === 'auth/email-already-in-use') msg = "E-mail já em uso.";
        else if (error.code === 'auth/weak-password') msg = "Senha fraca (mínimo 6 caracteres).";
        else if (error.code === 'auth/invalid-email') msg = "E-mail inválido.";
        loginMessageDiv.textContent = msg;
        loginMessageDiv.className = 'text-red-500 text-center mt-4 text-sm font-medium';
    }
}

async function handleLogin() {
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginMessageDiv = document.getElementById('login-message');
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    loginMessageDiv.textContent = '';

    if (!email || !password) {
        loginMessageDiv.textContent = "Preencha e-mail e senha para login.";
        loginMessageDiv.className = 'text-red-500 text-center mt-4 text-sm font-medium'; return;
    }
    if (!window.auth) {
        loginMessageDiv.textContent = "Erro: Autenticação não disponível.";
        loginMessageDiv.className = 'text-red-500 text-center mt-4 text-sm font-medium'; return;
    }

    try {
        await signInWithEmailAndPassword(window.auth, email, password);
        // Mensagem de sucesso não é mais necessária aqui, onAuthStateChanged cuidará do redirecionamento
        // loginMessageDiv.textContent = "Login realizado com sucesso!";
        // loginMessageDiv.className = 'text-green-600 text-center mt-4 text-sm font-medium';
    } catch (error) {
        console.error("Erro ao fazer login:", error);
        let msg = "Erro ao fazer login.";
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') msg = "E-mail ou senha inválidos.";
        else if (error.code === 'auth/invalid-email') msg = "E-mail inválido.";
        loginMessageDiv.textContent = msg;
        loginMessageDiv.className = 'text-red-500 text-center mt-4 text-sm font-medium';
    }
}

async function handleVisitorLogin() {
    if (!window.auth) { console.error("Firebase Auth não inicializado."); return; }
    try {
        await signInAnonymously(window.auth);
        console.log("Login de visitante (anônimo) realizado.");
        registrationContext = 'visitor'; // Garante o contexto correto
        // onAuthStateChanged cuidará do redirecionamento e UI update
    } catch (error) {
        console.error("Erro ao fazer login de visitante:", error);
        // Adicionar feedback de erro na UI se necessário
    }
}

async function handleLogout() {
    if (!window.auth) { console.error("Firebase Auth não inicializado."); return; }
    try {
        await window.auth.signOut();
        console.log("Usuário desconectado.");
        registrationContext = 'visitor'; // Reseta o contexto
        // onAuthStateChanged cuidará do redirecionamento para 'welcome-role-selection' e UI update
    } catch (error) {
        console.error("Erro ao desconectar:", error);
    }
}

// Funções de carregamento de dados (adaptadas do seu script original)
// (loadPublicEvents, loadPublicExpositores, loadPublicLocations, etc.)
// Certifique-se que elas usam `globalEventsCache` e `globalExpositorsCache` se necessário para edição.

function loadPublicEvents() {
    if (!window.db) return;
    const eventsCollectionRef = collection(window.db, `artifacts/${firebaseConfig.appId}/public/data/events`);
    onSnapshot(eventsCollectionRef, (snapshot) => {
        globalEventsCache = []; // Limpa cache
        snapshot.forEach((doc) => globalEventsCache.push({ id: doc.id, ...doc.data() }));
        console.log("Eventos carregados/atualizados:", globalEventsCache);

        const container = document.getElementById('agenda-events-container');
        if (container) {
            container.innerHTML = '';
            if (globalEventsCache.length === 0) {
                container.innerHTML = '<p class="text-center text-gray-500 col-span-full">Nenhum evento disponível.</p>';
            } else {
                globalEventsCache.forEach(event => { // Usa o cache global
                    const eventCard = `
                        <div class="card p-6">
                            <h4 class="font-semibold text-lg mb-1 text-green-600">${event.title || 'N/A'}</h4>
                            <p class="text-sm text-gray-500 mb-2">${event.type || 'Tipo'} | ${event.date || 'Data'}, ${event.time || 'Hora'} | ${event.location || 'Local'}</p>
                            <p class="text-gray-700 mb-3">${event.description || 'Sem descrição.'}</p>
                            <button class="btn-accent text-sm py-1 px-3 rounded-md">Adicionar ao Calendário</button>
                        </div>`;
                    container.innerHTML += eventCard;
                });
            }
        }
        updateAgendaChart(globalEventsCache); // Usa o cache global
        displayAdminEventsList(globalEventsCache); // Atualiza lista no painel de organizadores
    }, (error) => {
        console.error("Erro ao carregar eventos:", error);
        const container = document.getElementById('agenda-events-container');
        if (container) container.innerHTML = '<p class="text-center text-red-500 col-span-full">Erro ao carregar eventos.</p>';
    });
}

function loadPublicExpositores() {
    if (!window.db) return;
    const expositoresCollectionRef = collection(window.db, `artifacts/${firebaseConfig.appId}/public/data/expositores`);
    onSnapshot(expositoresCollectionRef, (snapshot) => {
        globalExpositorsCache = []; // Limpa cache
        snapshot.forEach((doc) => globalExpositorsCache.push({ id: doc.id, ...doc.data() }));
        console.log("Expositores carregados/atualizados:", globalExpositorsCache);

        const container = document.getElementById('expositores-container');
        if (container) {
            container.innerHTML = '';
            if (globalExpositorsCache.length === 0) {
                container.innerHTML = '<p class="text-center text-gray-500 col-span-full">Nenhum expositor disponível.</p>';
            } else {
                globalExpositorsCache.forEach(expositor => { // Usa o cache global
                    const expositorCard = `
                        <div class="card p-6 text-center">
                            <img src="${expositor.logoUrl || 'https://placehold.co/100x100/388E3C/FFFFFF?text=Logo&font=Inter'}" alt="[Logo do Expositor]" class="mx-auto mb-3 rounded-full h-24 w-24 object-cover border-2 border-green-500">
                            <h4 class="font-semibold text-lg text-green-600">${expositor.name || 'N/A'}</h4>
                            <p class="text-sm text-gray-500 mb-2">${expositor.category || 'N/A'}</p>
                            <p class="text-gray-700 text-sm mb-3">${expositor.description || 'Sem descrição.'}</p>
                            <button class="btn-accent text-sm py-1 px-3 rounded-md">Ver Detalhes</button>
                        </div>`;
                    container.innerHTML += expositorCard;
                });
            }
        }
        updateExpositoresChart(globalExpositorsCache); // Usa o cache global
        displayAdminExpositorsList(globalExpositorsCache); // Atualiza lista no painel de organizadores
    }, (error) => {
        console.error("Erro ao carregar expositores:", error);
        const container = document.getElementById('expositores-container');
        if (container) container.innerHTML = '<p class="text-center text-red-500 col-span-full">Erro ao carregar expositores.</p>';
    });
}

async function loadPublicLocations() {
    if (!window.db) return;
    const locationsCollectionRef = collection(window.db, `artifacts/${firebaseConfig.appId}/public/data/locations`);
    onSnapshot(locationsCollectionRef, (snapshot) => {
        stands = []; 
        snapshot.forEach((doc) => stands.push({ docId: doc.id, ...doc.data() }));
        console.log("Localizações carregadas:", stands);

        if (fairMapCanvas && fairMapCtx) drawMap('fairMapCanvas', fairMapCtx, fairMapCanvas.clientWidth, fairMapCanvas.clientHeight);
        if (adminMapCanvas && adminMapCtx) drawMap('adminMapCanvas', adminMapCtx, adminMapCanvas.clientWidth, adminMapCanvas.clientHeight);
        displayCollectedData(); 

        if (stands.length === 0 && firebaseConfig.projectId === "agropec-2025-app") {
             // seedInitialMapData(); // Descomente para popular dados iniciais se necessário
        }
    }, (error) => console.error("Erro ao carregar localizações:", error));
}

function displayCollectedData() { // Estandes cadastradas no painel admin
    const displayArea = document.getElementById('registered-stands-display');
    if (!displayArea) return;
    displayArea.innerHTML = '';
    if (stands.length === 0) {
        displayArea.innerHTML = '<p class="text-gray-500">Nenhuma estande cadastrada.</p>';
    } else {
        const ul = document.createElement('ul');
        ul.className = 'divide-y divide-gray-200';
        stands.forEach(stand => {
            const li = document.createElement('li');
            li.className = 'py-3 flex justify-between items-center';
            li.innerHTML = `
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-green-700 truncate">ID: ${stand.id || 'N/A'}</p>
                    <p class="text-sm text-gray-600 truncate">Ocupante: ${stand.occupant || 'N/A'}</p>
                    <p class="text-xs text-gray-500 truncate">Coords: (X:${stand.x || 'N/A'}, Y:${stand.y || 'N/A'})</p>
                </div>
                <button class="btn-accent text-xs py-1 px-2 rounded generate-qr-btn" data-stand-doc-id="${stand.docId}">Gerar QR</button>
            `;
            ul.appendChild(li);
        });
        displayArea.appendChild(ul);
        document.querySelectorAll('.generate-qr-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                const stand = stands.find(s => s.docId === event.target.dataset.standDocId);
                if (stand) generateAndShowQrCode(stand);
            });
        });
    }
}

async function addNewLocation(locationData) { // Para o form de admin-dashboard (estandes)
    if (!currentUserId || !window.db) return;
    const messageEl = document.getElementById('location-message');
    try {
        const locationsCollectionRef = collection(window.db, `artifacts/${firebaseConfig.appId}/public/data/locations`);
        // Busca descrição do expositor associado, se houver
        let description = '';
        if (locationData.occupant) {
            const qExpo = query(collection(window.db, `artifacts/${firebaseConfig.appId}/public/data/expositores`), where("name", "==", locationData.occupant));
            const expoSnapshot = await getDocs(qExpo);
            if (!expoSnapshot.empty) description = expoSnapshot.docs[0].data().description || '';
        }
        
        await addDoc(locationsCollectionRef, { ...locationData, description });
        messageEl.textContent = 'Localização salva!'; messageEl.className = 'text-green-600 text-sm mt-2';
        document.getElementById('location-form').reset();
        document.getElementById('standCoordinatesDisplay').value = '';
        adminMapTemporaryMarker = null;
        drawMap('adminMapCanvas', adminMapCtx, adminMapCanvas.clientWidth, adminMapCanvas.clientHeight); // Redesenha para limpar marcador
    } catch (error) {
        console.error("Erro ao adicionar localização:", error);
        messageEl.textContent = 'Erro ao salvar.'; messageEl.className = 'text-red-500 text-sm mt-2';
    }
}

// Funções de QR Code, Gráficos (Chart.js), Detalhes da Estande (sem grandes alterações, mas revisadas para consistência)
// (generateAndShowQrCode, updateAgendaChart, updateExpositoresChart, loadStandDetails - adaptadas do seu script original)
function generateAndShowQrCode(stand) {
    const qrCodeModal = document.getElementById('qrCodeModal');
    const qrcodeDiv = document.getElementById('qrcode');
    if (!qrCodeModal || !qrcodeDiv) return;

    qrcodeDiv.innerHTML = ''; 
    const standDetailsUrl = `${window.location.origin}${window.location.pathname}#stand-details?id=${stand.id}`;
    console.log("Gerando QR para URL:", standDetailsUrl);

    try {
        new window.QRCode(qrcodeDiv, { 
            text: standDetailsUrl, width: 200, height: 200,
            colorDark : "#000000", colorLight : "#ffffff",
            correctLevel : window.QRCode.CorrectLevel.H 
        });
        qrCodeModal.style.display = 'flex';
    } catch (e) {
        console.error("Erro ao gerar QR Code:", e);
        qrcodeDiv.innerHTML = "Erro ao gerar QR Code.";
        qrCodeModal.style.display = 'flex';
    }
}
document.querySelector('.qr-modal-close').addEventListener('click', () => {
    const qrCodeModal = document.getElementById('qrCodeModal');
    if (qrCodeModal) qrCodeModal.style.display = 'none';
});
window.addEventListener('click', (event) => {
    const qrCodeModal = document.getElementById('qrCodeModal');
    if (qrCodeModal && event.target === qrCodeModal) {
        qrCodeModal.style.display = 'none';
    }
});

let agendaChartInstance = null;
let expositoresChartInstance = null;

function updateAgendaChart(events) {
    const agendaCtxEl = document.getElementById('agendaChart');
    if (!agendaCtxEl) return;
    const agendaCtx = agendaCtxEl.getContext('2d');

    const days = {};
    const eventTypes = ['Palestras', 'Workshops', 'Demonstrações', 'Outros'];
    events.forEach(event => {
        const date = event.date || 'Data Desconhecida';
        const type = eventTypes.includes(event.type) ? event.type : 'Outros';
        if (!days[date]) {
            days[date] = {}; eventTypes.forEach(t => days[date][t] = 0);
        }
        days[date][type]++;
    });
    
    const sortedDates = Object.keys(days).sort((a, b) => {
        if (a === 'Data Desconhecida') return 1; if (b === 'Data Desconhecida') return -1;
        const [dayA, monthA, yearA] = a.split('/').map(Number);
        const [dayB, monthB, yearB] = b.split('/').map(Number);
        return new Date(yearA, monthA - 1, dayA) - new Date(yearB, monthB - 1, dayB);
    });

    const datasets = eventTypes.map(type => {
        let bgColor, brdColor;
        switch(type) {
            case 'Palestras': bgColor = 'rgba(76, 175, 80, 0.7)'; brdColor = 'rgba(76, 175, 80, 1)'; break;
            case 'Workshops': bgColor = 'rgba(255, 193, 7, 0.7)'; brdColor = 'rgba(255, 193, 7, 1)'; break;
            case 'Demonstrações': bgColor = 'rgba(33, 150, 243, 0.7)'; brdColor = 'rgba(33, 150, 243, 1)'; break; // Azul para demonstrações
            default: bgColor = 'rgba(158, 158, 158, 0.7)'; brdColor = 'rgba(158, 158, 158, 1)';
        }
        return { label: type, data: sortedDates.map(date => days[date][type] || 0), backgroundColor: bgColor, borderColor: brdColor, borderWidth: 1 };
    });

    if (agendaChartInstance) agendaChartInstance.destroy();
    agendaChartInstance = new Chart(agendaCtx, {
        type: 'bar', data: { labels: sortedDates, datasets: datasets },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
    });
}

function updateExpositoresChart(expositores) {
    const expositoresCtxEl = document.getElementById('expositoresChart');
    if(!expositoresCtxEl) return;
    const expositoresCtx = expositoresCtxEl.getContext('2d');

    const categories = {};
    expositores.forEach(expositor => {
        const category = expositor.category || 'Outros';
        categories[category] = (categories[category] || 0) + 1;
    });
    const labels = Object.keys(categories);
    const data = labels.map(label => categories[label]);

    if (expositoresChartInstance) expositoresChartInstance.destroy();
    expositoresChartInstance = new Chart(expositoresCtx, {
        type: 'pie',
        data: { labels: labels, datasets: [{ data: data, backgroundColor: ['#4CAF50', '#FFC107', '#2196F3', '#9E9E9E', '#795548', '#FF5722'], borderWidth: 1 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
}

async function loadStandDetails(standId) {
    const contentEl = document.getElementById('stand-details-content');
    if (!contentEl) return;
    contentEl.innerHTML = '<p class="text-gray-500">Carregando...</p>';
    if (!window.db) { contentEl.innerHTML = '<p class="text-red-500">Erro: DB não disp.</p>'; return; }

    try {
        const q = query(collection(window.db, `artifacts/${firebaseConfig.appId}/public/data/locations`), where("id", "==", standId));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const data = snapshot.docs[0].data();
            contentEl.innerHTML = `
                <h4 class="font-semibold text-2xl mb-2 text-green-700">${data.occupant || 'Estande Sem Nome'} (ID: ${data.id || 'N/A'})</h4>
                <p class="text-gray-700 mb-1"><span class="font-medium">Localização no Mapa:</span> X: ${data.x || 'N/A'}, Y: ${data.y || 'N/A'}</p>
                <p class="text-gray-700 mb-4"><span class="font-medium">Descrição:</span> ${data.description || 'Nenhuma descrição disponível.'}</p>
                `;
        } else { contentEl.innerHTML = '<p class="text-red-500">Estande não encontrada.</p>'; }
    } catch (e) { console.error("Erro detalhes estande:", e); contentEl.innerHTML = '<p class="text-red-500">Erro ao carregar.</p>'; }
}

// Filtro de Eventos na Agenda
const applyEventFiltersButton = document.getElementById('applyEventFilters');
if (applyEventFiltersButton) {
    applyEventFiltersButton.addEventListener('click', () => {
        const dateFilter = document.getElementById('filterEventDate').value;
        const typeFilter = document.getElementById('filterEventType').value;
        
        let filteredEvents = globalEventsCache;

        if (dateFilter) {
            // Formata a data do filtro para DD/MM/AAAA para corresponder ao formato dos dados, se necessário
            // Ou converte ambas as datas para objetos Date para comparação
            const [year, month, day] = dateFilter.split('-');
            const formattedDateFilter = `${day}/${month}/${year}`;
            filteredEvents = filteredEvents.filter(event => event.date === formattedDateFilter);
        }
        if (typeFilter) {
            filteredEvents = filteredEvents.filter(event => event.type === typeFilter);
        }

        // Re-renderiza a lista de eventos e o gráfico com os eventos filtrados
        const container = document.getElementById('agenda-events-container');
        if (container) {
            container.innerHTML = '';
            if (filteredEvents.length === 0) {
                container.innerHTML = '<p class="text-center text-gray-500 col-span-full">Nenhum evento encontrado com os filtros aplicados.</p>';
            } else {
                filteredEvents.forEach(event => {
                    const eventCard = `
                        <div class="card p-6">
                            <h4 class="font-semibold text-lg mb-1 text-green-600">${event.title || 'N/A'}</h4>
                            <p class="text-sm text-gray-500 mb-2">${event.type || 'Tipo'} | ${event.date || 'Data'}, ${event.time || 'Hora'} | ${event.location || 'Local'}</p>
                            <p class="text-gray-700 mb-3">${event.description || 'Sem descrição.'}</p>
                            <button class="btn-accent text-sm py-1 px-3 rounded-md">Adicionar ao Calendário</button>
                        </div>`;
                    container.innerHTML += eventCard;
                });
            }
        }
        updateAgendaChart(filteredEvents);
    });
}