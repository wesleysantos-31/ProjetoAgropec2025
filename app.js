// Importa as funções necessárias do SDK do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-analytics.js";
// Importa createUserWithEmailAndPassword para registro
import { getAuth, signInAnonymously, signInWithEmailAndPassword, onAuthStateChanged, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
import { getFirestore, collection, onSnapshot, addDoc, doc, getDoc, setDoc, updateDoc, deleteDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";

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

const userIdDisplay = document.getElementById('user-id-display');
const sidebar = document.querySelector('.sidebar');
const logoutButton = document.getElementById('logout-button');
const adminDashboardLink = document.getElementById('admin-dashboard-link');
const adminUserRoleDisplay = document.getElementById('admin-user-role-display'); 
const firebaseErrorMessage = document.getElementById('firebase-error-message');
const firebaseErrorDetails = document.getElementById('firebase-error-details');
const mobileMenuButton = document.getElementById('mobileMenuButton'); // Adicionado para o botão do menu

// Variáveis do Mapa Canvas
let fairMapCanvas;
let fairMapCtx;
let adminMapCanvas;
let adminMapCtx;
let stands = []; // Array para armazenar as estandes cadastradas
let adminMapTemporaryMarker = null; // Para o ponto de clique no mapa do admin

// Função para exibir/ocultar seções (tornada explicitamente global)
window.showSection = function(sectionId, clickedLink) {
    console.log(`Tentando mostrar seção: ${sectionId}`);
    const sections = document.querySelectorAll('.main-content section');
    const navLinks = document.querySelectorAll('.nav-link');
    const currentSectionTitle = document.getElementById('currentSectionTitle');

    sections.forEach(section => {
        section.classList.remove('active');
        if (section.id === sectionId) {
            section.classList.add('active');
            let title = sectionId.charAt(0).toUpperCase() + sectionId.slice(1);
            // Mapeamento de IDs de seção para títulos
            const titleMap = {
                'inicio': 'Painel Principal',
                'admin-dashboard': 'Painel Administrativo',
                'stand-details': 'Detalhes da Estande',
                'welcome-role-selection': 'Bem-vindo!',
                'login': 'Acesso ao Evento',
                'agenda': 'Agenda do Evento',
                'expositores': 'Lista de Expositores',
                'mapa': 'Mapa da Feira'
            };
            currentSectionTitle.textContent = titleMap[sectionId] || title;
        }
    });
    navLinks.forEach(link => {
        link.classList.remove('active');
        link.classList.remove('bg-green-500'); // Remove a classe ativa do Tailwind
        link.classList.remove('text-white');
         // Ajuste para o tema da sidebar (se texto é branco por padrão e o fundo muda)
        if (sidebar.contains(link)) { // Se o link está na sidebar
            link.classList.add('text-white'); // Garante que o texto seja branco
        }

    });
    if (clickedLink) {
        clickedLink.classList.add('active');
         if (sidebar.contains(clickedLink)) { // Se o link clicado está na sidebar
            // Não precisa adicionar text-white aqui, pois já deve ser branco
            // e o CSS da sidebar cuida do fundo ativo/hover
        } else {
            // Para links fora da sidebar, se houver
            clickedLink.classList.add('bg-green-500');
            clickedLink.classList.add('text-white');
        }
    }
    // Fecha a barra lateral móvel após a navegação
    if (window.innerWidth < 768 && sidebar && !sidebar.classList.contains('-translate-x-full')) {
        sidebar.classList.add('-translate-x-full');
    }
}

// Função para inicializar um mapa específico
function initMap(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        console.error(`Canvas com ID '${canvasId}' não encontrado.`);
        return;
    }

    const ctx = canvas.getContext('2d');
    // Ajusta o tamanho do canvas com base no CSS (importante para a densidade de pixels correta)
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    // Armazena as referências globais
    if (canvasId === 'fairMapCanvas') {
        fairMapCanvas = canvas;
        fairMapCtx = ctx;
    } else if (canvasId === 'adminMapCanvas') {
        adminMapCanvas = canvas;
        adminMapCtx = ctx;
    }

    // Adiciona o listener de clique apenas para o mapa do admin
    if (canvasId === 'adminMapCanvas') {
        canvas.removeEventListener('click', handleMapClick); // Remove para evitar múltiplos listeners
        canvas.addEventListener('click', handleMapClick);
    } else {
        canvas.removeEventListener('click', handleMapClick); // Garante que o mapa do visitante não tenha listener de clique
        // Adicionar listener de clique para o mapa do visitante (fairMapCanvas) para interagir com estandes
        canvas.addEventListener('click', handleFairMapClick);
    }
    
    window.removeEventListener('resize', () => handleMapResize(canvasId));
    window.addEventListener('resize', () => handleMapResize(canvasId));
    
    drawMap(canvasId, ctx);

    if (window.db) { 
        loadPublicLocations();
    }
}

function handleMapResize(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (canvas) {
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect(); // Usa getBoundingClientRect para obter as dimensões reais conforme o CSS
        
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr; // A altura do canvas agora vem do CSS
        
        ctx.scale(dpr, dpr); // Escala o contexto para o DPR
        
        // Redesenha o mapa usando as dimensões CSS (escaladas internamente pelo DPR)
        drawMap(canvasId, ctx, rect.width, rect.height);
    }
}


// Função para desenhar o mapa fictício e as estandes em um contexto específico
// Modificado para aceitar width e height como parâmetros para o resize
function drawMap(canvasId, ctx, cssWidth, cssHeight) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !ctx) {
        console.error(`[drawMap] Canvas ou contexto não encontrado para ${canvasId}.`);
        return;
    }

    // Usa as dimensões CSS fornecidas ou obtém do canvas se não fornecidas (para a chamada inicial)
    const currentCssWidth = cssWidth || canvas.clientWidth;
    const currentCssHeight = cssHeight || canvas.clientHeight;

    ctx.clearRect(0, 0, currentCssWidth, currentCssHeight); // Limpa usando as dimensões CSS

    // Fundo geral do evento
    ctx.fillStyle = '#F0F0F0'; 
    ctx.fillRect(0, 0, currentCssWidth, currentCssHeight);

    // Desenha as ruas principais (ajustar as proporções se necessário)
    const streetWidth = Math.max(50, currentCssWidth * 0.1); // Ex: 10% da largura, mínimo 50px
    const streetHeight = Math.max(40, currentCssHeight * 0.1); // Ex: 10% da altura, mínimo 40px

    ctx.fillStyle = '#A0A0A0'; 
    ctx.fillRect(currentCssWidth * 0.1, 0, streetWidth, currentCssHeight); // Rua vertical esquerda
    ctx.fillRect(currentCssWidth * 0.8 - streetWidth, 0, streetWidth, currentCssHeight); // Rua vertical direita
    ctx.fillRect(0, currentCssHeight * 0.15, currentCssWidth, streetHeight); // Rua horizontal superior
    ctx.fillRect(0, currentCssHeight * 0.75 - streetHeight, currentCssWidth, streetHeight); // Rua horizontal inferior

    // Áreas verdes (gramado, jardins)
    ctx.fillStyle = '#8BC34A'; 
    ctx.fillRect(10, 10, 30, 60); 
    // ... (ajustar outras coordenadas para serem relativas ou responsivas se necessário)

    // Edifícios
    ctx.fillStyle = '#B0BEC5'; 
    ctx.fillRect(10, currentCssHeight * 0.3, 40, 100); 
    // ...

    // Desenha as estandes
    stands.forEach(stand => {
        ctx.fillStyle = '#4CAF50'; 
        ctx.strokeStyle = '#388E3C'; 
        ctx.lineWidth = 2;

        const standSize = Math.min(20, currentCssWidth * 0.03, currentCssHeight * 0.04); // Tamanho adaptável
        const halfSize = standSize / 2;

        // As coordenadas (stand.x, stand.y) devem ser normalizadas (0-1) ou relativas
        // Se as coordenadas forem absolutas em pixels para um tamanho de mapa fixo,
        // elas precisarão ser escaladas para o tamanho atual do canvas.
        // Exemplo: se stand.x e stand.y foram salvas para um mapa de 800x400
        // const originalMapWidth = 800;
        // const originalMapHeight = 400;
        // const scaledX = (stand.x / originalMapWidth) * currentCssWidth;
        // const scaledY = (stand.y / originalMapHeight) * currentCssHeight;

        // Por enquanto, vamos assumir que stand.x e stand.y são coordenadas de clique diretas
        // e podem não escalar perfeitamente sem uma lógica de escalonamento/normalização.
        const displayX = stand.x; 
        const displayY = stand.y;

        ctx.fillRect(displayX - halfSize, displayY - halfSize, standSize, standSize);
        ctx.strokeRect(displayX - halfSize, displayY - halfSize, standSize, standSize);

        ctx.fillStyle = '#FFFFFF'; 
        ctx.font = `bold ${Math.max(8, standSize * 0.4)}px Inter`; // Fonte adaptável
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(stand.id, displayX, displayY);

        if (stand.occupant) {
            ctx.fillStyle = '#424242'; 
            ctx.font = `${Math.max(7, standSize * 0.35)}px Inter`; // Fonte adaptável
            ctx.fillText(stand.occupant, displayX, displayY + halfSize + Math.max(7, standSize * 0.35));
        }
    });

    // Desenha o marcador temporário do admin, se houver
    if (canvasId === 'adminMapCanvas' && adminMapTemporaryMarker) {
        ctx.fillStyle = 'red';
        ctx.beginPath();
        // Usa as coordenadas do marcador temporário, que já devem estar corretas para o clique
        ctx.arc(adminMapTemporaryMarker.x, adminMapTemporaryMarker.y, 5, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Função para lidar com o clique no mapa (apenas para o mapa do admin)
function handleMapClick(event) {
    const currentActiveSection = document.querySelector('.main-content section.active');
    if (currentActiveSection && currentActiveSection.id === 'admin-dashboard') {
        const rect = adminMapCanvas.getBoundingClientRect(); // Coordenadas relativas ao viewport
        const scaleX = adminMapCanvas.width / (rect.width * window.devicePixelRatio); // Fator de escala se o canvas for maior que o CSS
        const scaleY = adminMapCanvas.height / (rect.height * window.devicePixelRatio);

        // Coordenadas do clique relativas ao elemento canvas
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        // Ajusta para a escala interna do canvas, se houver (para desenho)
        // Para salvar, você pode querer as coordenadas relativas ao tamanho CSS
        const canvasX = x * scaleX * window.devicePixelRatio;
        const canvasY = y * scaleY * window.devicePixelRatio;


        document.getElementById('standX').value = Math.round(x); // Salva coordenadas relativas ao CSS
        document.getElementById('standY').value = Math.round(y);
        document.getElementById('standCoordinatesDisplay').value = `X: ${Math.round(x)}, Y: ${Math.round(y)}`;

        adminMapTemporaryMarker = { x: x, y: y }; // Usa coordenadas relativas ao CSS para o marcador
        drawMap('adminMapCanvas', adminMapCtx, adminMapCanvas.clientWidth, adminMapCanvas.clientHeight);
    }
}

// Nova função para clique no mapa do visitante
function handleFairMapClick(event) {
    if (!fairMapCanvas || !fairMapCtx || stands.length === 0) return;

    const rect = fairMapCanvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Verificar se o clique foi em alguma estande
    // Lógica similar à de desenho, mas para detecção de colisão
    const standSize = 20; // Ou o tamanho dinâmico usado no drawMap
    const halfSize = standSize / 2;

    let clickedStand = null;
    for (const stand of stands) {
        // Supondo que stand.x e stand.y são as coordenadas CSS salvas
        const standRect = {
            left: stand.x - halfSize,
            top: stand.y - halfSize,
            right: stand.x + halfSize,
            bottom: stand.y + halfSize
        };
        if (x >= standRect.left && x <= standRect.right && y >= standRect.top && y <= standRect.bottom) {
            clickedStand = stand;
            break;
        }
    }

    if (clickedStand) {
        console.log("Estande clicada:", clickedStand);
        // Redireciona para a página de detalhes da estande
        window.location.hash = `#stand-details?id=${clickedStand.id}`;
    }
}


// Função para exibir dados coletados (agora mostra as estandes do array 'stands')
function displayCollectedData() {
    const displayArea = document.getElementById('registered-stands-display');
    if (!displayArea) return;

    displayArea.innerHTML = ''; // Limpa a área
    if (stands.length === 0) {
        displayArea.innerHTML = '<p class="text-gray-500">Nenhuma estande cadastrada ainda.</p>';
    } else {
        const ul = document.createElement('ul');
        ul.className = 'divide-y divide-gray-200'; // Tailwind classes
        stands.forEach(stand => {
            const li = document.createElement('li');
            li.classList.add('flex', 'items-center', 'justify-between', 'py-3');
            li.innerHTML = `
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-green-700 truncate">ID: ${stand.id || 'N/A'}</p>
                    <p class="text-sm text-gray-600 truncate">Ocupante: ${stand.occupant || 'N/A'}</p>
                    <p class="text-xs text-gray-500 truncate">Coords: (${stand.x || 'N/A'}, ${stand.y || 'N/A'})</p>
                </div>
                <button class="btn-accent text-xs py-1 px-2 rounded generate-qr-btn" data-stand-doc-id="${stand.docId}">Gerar QR</button>
            `;
            ul.appendChild(li);
        });
        displayArea.appendChild(ul);

        document.querySelectorAll('.generate-qr-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                console.log("Botão Gerar QR Code clicado!"); 
                const standDocId = event.target.dataset.standDocId;
                const stand = stands.find(s => s.docId === standDocId); 
                if (stand) {
                    generateAndShowQrCode(stand);
                } else {
                    console.error("Estande não encontrada para gerar QR Code.");
                }
            });
        });
    }
}

// Função para gerar e exibir o QR Code em um modal
function generateAndShowQrCode(stand) {
    const qrCodeModal = document.getElementById('qrCodeModal');
    const qrcodeDiv = document.getElementById('qrcode');

    qrcodeDiv.innerHTML = ''; // Limpa qualquer QR Code anterior

    // Usa window.location.origin para garantir que a URL seja correta
    const standDetailsUrl = `${window.location.origin}${window.location.pathname}#stand-details?id=${stand.id}`;

    console.log("Gerando QR Code para URL:", standDetailsUrl);

    try {
        new window.QRCode(qrcodeDiv, { 
            text: standDetailsUrl,
            width: 200,
            height: 200,
            colorDark : "#000000",
            colorLight : "#ffffff",
            correctLevel : window.QRCode.CorrectLevel.H 
        });
        qrCodeModal.style.display = 'flex'; // Mostra o modal
    } catch (e) {
        console.error("Erro ao gerar QR Code:", e);
        qrcodeDiv.innerHTML = "Erro ao gerar QR Code. Verifique se a biblioteca está carregada.";
        qrCodeModal.style.display = 'flex';
    }
}

// Fecha o modal do QR Code
document.querySelector('.qr-modal-close').addEventListener('click', () => {
    document.getElementById('qrCodeModal').style.display = 'none';
});

window.addEventListener('click', (event) => {
    const qrCodeModal = document.getElementById('qrCodeModal');
    if (event.target === qrCodeModal) { // Se o clique for no fundo do modal
        qrCodeModal.style.display = 'none';
    }
});

// Implementações Chart.js
let agendaChartInstance = null;
let expositoresChartInstance = null;

function updateAgendaChart(events) {
    const agendaCtx = document.getElementById('agendaChart');
    if (!agendaCtx) return;

    const days = {};
    const eventTypes = ['Palestras', 'Workshops', 'Demonstrações', 'Outros'];

    events.forEach(event => {
        const date = event.date || 'Data Desconhecida';
        const type = event.type || 'Outros';
        if (!days[date]) {
            days[date] = {};
            eventTypes.forEach(t => days[date][t] = 0);
        }
        if (days[date][type] !== undefined) {
            days[date][type]++;
        } else {
            days[date]['Outros']++;
        }
    });
    
    const sortedDates = Object.keys(days).sort((a, b) => {
        if (a === 'Data Desconhecida') return 1;
        if (b === 'Data Desconhecida') return -1;
        const [dayA, monthA, yearA] = a.split('/').map(Number);
        const [dayB, monthB, yearB] = b.split('/').map(Number);
        const dateA = new Date(yearA, monthA - 1, dayA);
        const dateB = new Date(yearB, monthB - 1, dayB);
        return dateA - dateB;
    });

    const datasets = eventTypes.map(type => {
        let backgroundColor, borderColor;
        switch(type) {
            case 'Palestras': backgroundColor = 'rgba(76, 175, 80, 0.7)'; borderColor = 'rgba(76, 175, 80, 1)'; break;
            case 'Workshops': backgroundColor = 'rgba(255, 193, 7, 0.7)'; borderColor = 'rgba(255, 193, 7, 1)'; break;
            case 'Demonstrações': backgroundColor = 'rgba(66, 66, 66, 0.7)'; borderColor = 'rgba(66, 66, 66, 1)'; break;
            default: backgroundColor = 'rgba(158, 158, 158, 0.7)'; borderColor = 'rgba(158, 158, 158, 1)';
        }
        return {
            label: type,
            data: sortedDates.map(date => days[date][type] || 0),
            backgroundColor: backgroundColor,
            borderColor: borderColor,
            borderWidth: 1
        };
    });

    if (agendaChartInstance) {
        agendaChartInstance.destroy();
    }
    agendaChartInstance = new Chart(agendaCtx.getContext('2d'), {
        type: 'bar',
        data: { labels: sortedDates, datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, ticks: { color: '#424242' } }, x: { ticks: { color: '#424242' } } },
            plugins: { legend: { labels: { color: '#424242' } }, tooltip: { titleFont: { family: 'Inter' }, bodyFont: { family: 'Inter' }} }
        }
    });
}

function updateExpositoresChart(expositores) {
    const expositoresCtx = document.getElementById('expositoresChart');
    if(!expositoresCtx) return;

    const categories = {};
    expositores.forEach(expositor => {
        const category = expositor.category || 'Outros';
        categories[category] = (categories[category] || 0) + 1;
    });

    const labels = Object.keys(categories);
    const data = labels.map(label => categories[label]);

    if (expositoresChartInstance) {
        expositoresChartInstance.destroy();
    }
    expositoresChartInstance = new Chart(expositoresCtx.getContext('2d'), {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                label: 'Expositores por Categoria',
                data: data,
                backgroundColor: [
                    'rgba(76, 175, 80, 0.8)','rgba(56, 142, 60, 0.8)','rgba(255, 193, 7, 0.8)',
                    'rgba(255, 160, 0, 0.8)','rgba(158, 158, 158, 0.8)','rgba(189, 189, 189, 0.8)'
                ],
                borderColor: '#FFFFFF',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top', labels: { color: '#424242' } }, tooltip: { titleFont: { family: 'Inter' }, bodyFont: { family: 'Inter' }} }
        }
    });
}

async function loadPublicEvents() {
    if (!currentUserId || !window.db) {
        console.log("Aguardando autenticação ou Firebase para carregar eventos.");
        return;
    }
    const eventsCollectionRef = collection(window.db, `artifacts/${firebaseConfig.appId}/public/data/events`);
    onSnapshot(eventsCollectionRef, (snapshot) => {
        const events = [];
        snapshot.forEach((doc) => events.push({ id: doc.id, ...doc.data() }));
        console.log("Eventos carregados:", events);

        const container = document.getElementById('agenda-events-container');
        if (container) {
            container.innerHTML = '';
            if (events.length === 0) {
                container.innerHTML = '<p class="text-center text-gray-500 col-span-full">Nenhum evento disponível.</p>';
            } else {
                events.forEach(event => {
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
        updateAgendaChart(events);
    }, (error) => {
        console.error("Erro ao carregar eventos:", error);
        const container = document.getElementById('agenda-events-container');
        if (container) container.innerHTML = '<p class="text-center text-red-500 col-span-full">Erro ao carregar eventos.</p>';
    });
}

async function loadPublicExpositores() {
    if (!currentUserId || !window.db) {
        console.log("Aguardando autenticação ou Firebase para carregar expositores.");
        return;
    }
    const expositoresCollectionRef = collection(window.db, `artifacts/${firebaseConfig.appId}/public/data/expositores`);
    onSnapshot(expositoresCollectionRef, (snapshot) => {
        const expositores = [];
        snapshot.forEach((doc) => expositores.push({ id: doc.id, ...doc.data() }));
        console.log("Expositores carregados:", expositores);

        const container = document.getElementById('expositores-container');
        if (container) {
            container.innerHTML = '';
            if (expositores.length === 0) {
                container.innerHTML = '<p class="text-center text-gray-500 col-span-full">Nenhum expositor disponível.</p>';
            } else {
                expositores.forEach(expositor => {
                    const expositorCard = `
                        <div class="card p-6 text-center">
                            <img src="${expositor.logoUrl || 'https://placehold.co/100x100/388E3C/FFFFFF?text=Logo&font=Inter'}" alt="Logo" class="mx-auto mb-3 rounded-full h-24 w-24 object-cover border-2 border-green-500">
                            <h4 class="font-semibold text-lg text-green-600">${expositor.name || 'N/A'}</h4>
                            <p class="text-sm text-gray-500 mb-2">${expositor.category || 'N/A'}</p>
                            <p class="text-gray-700 text-sm mb-3">${expositor.description || 'Sem descrição.'}</p>
                            <button class="btn-accent text-sm py-1 px-3 rounded-md">Ver Detalhes</button>
                        </div>`;
                    container.innerHTML += expositorCard;
                });
            }
        }
        updateExpositoresChart(expositores);
    }, (error) => {
        console.error("Erro ao carregar expositores:", error);
        const container = document.getElementById('expositores-container');
        if (container) container.innerHTML = '<p class="text-center text-red-500 col-span-full">Erro ao carregar expositores.</p>';
    });
}

async function loadPublicLocations() {
    if (!currentUserId || !window.db) {
        console.log("Aguardando autenticação ou Firebase para carregar localizações.");
        return;
    }
    const locationsCollectionRef = collection(window.db, `artifacts/${firebaseConfig.appId}/public/data/locations`);
    onSnapshot(locationsCollectionRef, (snapshot) => {
        stands = []; 
        snapshot.forEach((doc) => {
            stands.push({ docId: doc.id, ...doc.data() });
        });
        console.log("Localizações carregadas:", stands);

        if (fairMapCanvas && fairMapCtx) {
            drawMap('fairMapCanvas', fairMapCtx, fairMapCanvas.clientWidth, fairMapCanvas.clientHeight);
        }
        if (adminMapCanvas && adminMapCtx) {
            drawMap('adminMapCanvas', adminMapCtx, adminMapCanvas.clientWidth, adminMapCanvas.clientHeight);
        }
        displayCollectedData(); 

        if (stands.length === 0 && firebaseConfig.projectId === "agropec-2025-app") { // Seed only for specific project
             seedInitialMapData();
        }
    }, (error) => {
        console.error("Erro ao carregar localizações:", error);
    });
}

async function seedInitialMapData() {
    if (!window.db) return;
    const locationsCollectionRef = collection(window.db, `artifacts/${firebaseConfig.appId}/public/data/locations`);
    const existingDocs = await getDocs(locationsCollectionRef);

    if (existingDocs.empty) {
        console.log("Adicionando dados fictícios ao mapa...");
        const initialStands = [
            { id: 'A1', occupant: 'AgroTech Sol.', x: 180, y: 180, description: 'Soluções inovadoras.' },
            { id: 'B3', occupant: 'Pecuária Mod.', x: 350, y: 200, description: 'Tecnologias avançadas.' },
            { id: 'C2', occupant: 'Máquinas XYZ', x: 500, y: 170, description: 'Tratores e equipamentos.' },
            { id: 'D4', occupant: 'Hortaliças Org.', x: 200, y: 300, description: 'Cultivo sustentável.' },
            { id: 'E5', occupant: 'Tec Rural', x: 450, y: 320, description: 'Drones e sensores.' }
        ];
        for (const stand of initialStands) {
            await addDoc(locationsCollectionRef, stand);
        }
    }
}

async function addNewExpositor(expositorData) {
    if (!currentUserId || !window.db) return;
    try {
        const userExpositoresCollectionRef = collection(window.db, `artifacts/${firebaseConfig.appId}/public/data/expositores`);
        await addDoc(userExpositoresCollectionRef, expositorData);
        console.log("Expositor adicionado!");
        document.getElementById('tent-message').textContent = 'Informações salvas!';
        document.getElementById('tent-message').className = 'text-green-600 text-sm mt-2';
        document.getElementById('tent-form').reset();
    } catch (error) {
        console.error("Erro ao adicionar expositor:", error);
        document.getElementById('tent-message').textContent = 'Erro ao salvar.';
        document.getElementById('tent-message').className = 'text-red-500 text-sm mt-2';
    }
}

async function addNewLocation(locationData) {
    if (!currentUserId || !window.db) return;
    try {
        const locationsCollectionRef = collection(window.db, `artifacts/${firebaseConfig.appId}/public/data/locations`);
        const tentName = document.getElementById('standOccupant').value;
        const expositoresCollectionRef = collection(window.db, `artifacts/${firebaseConfig.appId}/public/data/expositores`);
        const q = query(expositoresCollectionRef, where("name", "==", tentName));
        const querySnapshot = await getDocs(q);
        let description = '';
        if (!querySnapshot.empty) {
            description = querySnapshot.docs[0].data().description || '';
        }

        const dataToSave = { ...locationData, description: description };
        const docRef = await addDoc(locationsCollectionRef, dataToSave);
        
        console.log("Localização adicionada com ID:", docRef.id);
        document.getElementById('location-message').textContent = 'Localização salva!';
        document.getElementById('location-message').className = 'text-green-600 text-sm mt-2';
        document.getElementById('location-form').reset();
        document.getElementById('standCoordinatesDisplay').value = '';
        document.getElementById('standX').value = '';
        document.getElementById('standY').value = '';
        adminMapTemporaryMarker = null;
    } catch (error) {
        console.error("Erro ao adicionar localização:", error);
        document.getElementById('location-message').textContent = 'Erro ao salvar.';
        document.getElementById('location-message').className = 'text-red-500 text-sm mt-2';
    }
}

async function loadStandDetails(standId) {
    const standDetailsContent = document.getElementById('stand-details-content');
    if (!standDetailsContent) return;
    standDetailsContent.innerHTML = '<p class="text-gray-500">Carregando...</p>';

    try {
        if (!window.db) {
            standDetailsContent.innerHTML = '<p class="text-red-500">Erro: Firebase não inicializado.</p>';
            return;
        }
        const locationsCollectionRef = collection(window.db, `artifacts/${firebaseConfig.appId}/public/data/locations`);
        const q = query(locationsCollectionRef, where("id", "==", standId));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const standDoc = querySnapshot.docs[0];
            const standData = standDoc.data();
            standDetailsContent.innerHTML = `
                <h4 class="font-semibold text-2xl mb-2 text-green-700">${standData.occupant || 'Estande Sem Nome'} (ID: ${standData.id || 'N/A'})</h4>
                <p class="text-gray-700 mb-2"><span class="font-medium">Coordenadas:</span> X: ${standData.x || 'N/A'}, Y: ${standData.y || 'N/A'}</p>
                <p class="text-gray-700 mb-4"><span class="font-medium">Descrição:</span> ${standData.description || 'Nenhuma descrição.'}</p>
            `;
        } else {
            standDetailsContent.innerHTML = '<p class="text-red-500">Estande não encontrada.</p>';
        }
    } catch (error) {
        console.error("Erro ao carregar detalhes da estande:", error);
        standDetailsContent.innerHTML = '<p class="text-red-500">Erro ao carregar. Tente novamente.</p>';
    }
}

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
        const userProfileDocRef = doc(window.db, `artifacts/${firebaseConfig.appId}/users/${user.uid}/profile/details`);
        await setDoc(userProfileDocRef, {
            uid: user.uid, email: user.email, createdAt: new Date().toISOString(), role: registrationContext
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
        loginMessageDiv.textContent = "Login realizado com sucesso!";
        loginMessageDiv.className = 'text-green-600 text-center mt-4 text-sm font-medium';
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
        registrationContext = 'visitor';
    } catch (error) {
        console.error("Erro ao fazer login de visitante:", error);
    }
}

async function handleLogout() {
    if (!window.auth) { console.error("Firebase Auth não inicializado."); return; }
    try {
        await window.auth.signOut();
        console.log("Usuário desconectado.");
        registrationContext = 'visitor';
    } catch (error) {
        console.error("Erro ao desconectar:", error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM carregado. Inicializando Firebase e App...");

    const qrCodeModal = document.getElementById('qrCodeModal');
    if (qrCodeModal) qrCodeModal.style.display = 'none';

    let app, db, auth, analytics;
    try {
        app = initializeApp(firebaseConfig);
        // analytics = getAnalytics(app); // Descomente se for usar Analytics
        db = getFirestore(app);
        auth = getAuth(app);
        window.db = db; window.auth = auth;
        console.log("Firebase inicializado com sucesso.");
        if(firebaseErrorMessage) firebaseErrorMessage.classList.add('hidden');
    } catch (error) {
        console.error("Erro crucial ao inicializar Firebase:", error);
        if(firebaseErrorDetails) firebaseErrorDetails.textContent = error.message;
        if(firebaseErrorMessage) firebaseErrorMessage.classList.remove('hidden');
        return; 
    }
    
    // Inicializa mapas após Firebase e DOM prontos
    initMap('fairMapCanvas');
    initMap('adminMapCanvas');


    if (window.auth) {
        onAuthStateChanged(window.auth, async (user) => {
            console.log("Estado de autenticação:", user ? user.uid : "Deslogado");
            if (user) {
                currentUserId = user.uid;
                if (userIdDisplay) {
                    userIdDisplay.textContent = user.isAnonymous ? `Visitante` : (user.email || 'Usuário');
                    userIdDisplay.classList.remove('hidden');
                }
                if(sidebar) {
                    sidebar.classList.remove('sidebar-initial-hidden'); // Remove display:none
                    sidebar.classList.remove('-translate-x-full'); // Mostra sidebar
                }
                if(logoutButton) logoutButton.classList.remove('hidden');

                if (window.db) {
                    loadPublicEvents(); loadPublicExpositores(); loadPublicLocations();
                }

                let userRole = 'visitor';
                if (!user.isAnonymous && window.db) {
                    const userProfileDocRef = doc(window.db, `artifacts/${firebaseConfig.appId}/users/${user.uid}/profile/details`);
                    try {
                        const userProfileSnap = await getDoc(userProfileDocRef);
                        if(userProfileSnap.exists()) userRole = userProfileSnap.data().role || 'visitor';
                        console.log("Função do usuário:", userRole);
                    } catch (profileError) { console.error("Erro ao carregar perfil:", profileError); }
                } else if (user.isAnonymous) {
                    userRole = 'visitor'; // Usuários anônimos são sempre visitantes
                }


                if (userRole === 'admin') {
                    if(adminDashboardLink) adminDashboardLink.classList.remove('hidden');
                    window.showSection('admin-dashboard', document.querySelector('a[href="#admin-dashboard"]'));
                    if (adminUserRoleDisplay) adminUserRoleDisplay.textContent = `Logado como: Administrador (${user.email || 'N/A'})`;
                } else {
                    if(adminDashboardLink) adminDashboardLink.classList.add('hidden');
                    const hash = window.location.hash;
                    if (hash.startsWith('#stand-details?id=')) {
                        const standId = hash.split('id=')[1];
                        window.showSection('stand-details', null);
                        loadStandDetails(standId);
                    } else if (hash === '' || hash === '#login' || hash === '#welcome-role-selection' || hash === '#admin-dashboard') {
                        window.showSection('inicio', document.querySelector('a[href="#inicio"]'));
                    } else {
                        const currentHashSection = hash.substring(1);
                        const currentNavLink = document.querySelector(`a.nav-link[href="#${currentHashSection}"]`);
                        window.showSection(currentHashSection, currentNavLink || document.querySelector('a[href="#inicio"]'));
                    }
                    if (adminUserRoleDisplay) adminUserRoleDisplay.textContent = '';
                }

            } else { // Usuário deslogado
                currentUserId = null;
                if (userIdDisplay) { userIdDisplay.textContent = ''; userIdDisplay.classList.add('hidden'); }
                
                if(sidebar) {
                    sidebar.classList.add('sidebar-initial-hidden'); // Adiciona display:none
                    sidebar.classList.add('-translate-x-full'); // Esconde sidebar
                }
                if(logoutButton) logoutButton.classList.add('hidden');
                if(adminDashboardLink) adminDashboardLink.classList.add('hidden');
                if (adminUserRoleDisplay) adminUserRoleDisplay.textContent = '';

                const hash = window.location.hash;
                if (hash.startsWith('#stand-details?id=')) {
                    const standId = hash.split('id=')[1];
                    window.showSection('stand-details', null);
                    loadStandDetails(standId); // Permitir ver detalhes da estande mesmo deslogado
                } else {
                    window.showSection('welcome-role-selection', null);
                }
            }
        });
    } else {
        console.error("Firebase Auth não inicializado, onAuthStateChanged não será anexado.");
        if(firebaseErrorDetails) firebaseErrorDetails.textContent = "Firebase Auth não pôde ser inicializado.";
        if(firebaseErrorMessage) firebaseErrorMessage.classList.remove('hidden');
    }

    if(mobileMenuButton && sidebar) {
        mobileMenuButton.addEventListener('click', () => {
            sidebar.classList.toggle('-translate-x-full');
            sidebar.classList.toggle('sidebar-initial-hidden'); // Alterna display se estiver usando
        });
    }
    
    document.addEventListener('click', function(event) {
        if(sidebar && mobileMenuButton) {
            const isClickInsideSidebar = sidebar.contains(event.target);
            const isClickOnMenuButton = mobileMenuButton.contains(event.target);
            if (!isClickInsideSidebar && !isClickOnMenuButton && window.innerWidth < 768 && !sidebar.classList.contains('-translate-x-full')) {
                sidebar.classList.add('-translate-x-full');
            }
        }
    });

    const registerLink = document.getElementById('register-link');
    if (registerLink) registerLink.addEventListener('click', (e) => { e.preventDefault(); handleRegister(); });

    const loginButtonEl = document.getElementById('login-button'); // Renomeado para evitar conflito
    if (loginButtonEl) loginButtonEl.addEventListener('click', (e) => { e.preventDefault(); handleLogin(); });
    
    const visitorButton = document.getElementById('visitor-button');
    if (visitorButton) visitorButton.addEventListener('click', (e) => { e.preventDefault(); registrationContext = 'visitor'; handleVisitorLogin(); });

    const adminButton = document.getElementById('admin-button');
    if (adminButton) adminButton.addEventListener('click', (e) => { e.preventDefault(); registrationContext = 'admin'; window.showSection('login', document.querySelector('a[href="#login"]')); });

    if (logoutButton) logoutButton.addEventListener('click', handleLogout);

    const tentForm = document.getElementById('tent-form');
    if (tentForm) {
        tentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const tentName = document.getElementById('tentName').value;
            const tentCategory = document.getElementById('tentCategory').value;
            const tentDescription = document.getElementById('tentDescription').value;
            await addNewExpositor({ name: tentName, category: tentCategory, description: tentDescription, logoUrl: '' /* Adicionar campo para logoUrl se necessário */ });
        });
    }

    const locationForm = document.getElementById('location-form');
    if (locationForm) {
        locationForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const standId = document.getElementById('standId').value;
            const standOccupant = document.getElementById('standOccupant').value;
            const standX = parseInt(document.getElementById('standX').value, 10);
            const standY = parseInt(document.getElementById('standY').value, 10);
            const messageEl = document.getElementById('location-message');

            if (isNaN(standX) || isNaN(standY)) {
                messageEl.textContent = 'Clique no mapa para selecionar as coordenadas.';
                messageEl.className = 'text-red-500 text-sm mt-2'; return;
            }
            await addNewLocation({ id: standId, occupant: standOccupant, x: standX, y: standY });
        });
    }

    window.addEventListener('hashchange', () => {
        const hash = window.location.hash;
        console.log("Hash alterado para:", hash);
        if (hash.startsWith('#stand-details?id=')) {
            const standId = hash.split('id=')[1];
            window.showSection('stand-details', null);
            loadStandDetails(standId);
        } else if (currentUserId) { // Se logado, navega normalmente
            const newSection = hash ? hash.substring(1) : 'inicio';
            const newLink = document.querySelector(`.nav-link[href="#${newSection}"]`);
            window.showSection(newSection, newLink || document.querySelector('a[href="#inicio"]'));
        } else { // Se deslogado e não for stand-details, volta para welcome
             window.showSection('welcome-role-selection', null);
        }
    });

    // Verifica hash na carga inicial, após onAuthStateChanged ter potencialmente rodado
    // A lógica inicial de navegação agora está mais integrada com onAuthStateChanged
    const initialHash = window.location.hash;
    if (initialHash.startsWith('#stand-details?id=')) {
        const standId = initialHash.split('id=')[1];
        window.showSection('stand-details', null);
        loadStandDetails(standId);
    } else if (!currentUserId) { // Se não tem hash de detalhes e está deslogado
        window.showSection('welcome-role-selection', null);
    } else if (currentUserId && (initialHash === '' || initialHash === '#login' || initialHash === '#welcome-role-selection')) {
         // Se logado e hash é de login/welcome, redireciona para inicio ou admin-dashboard (tratado por onAuthStateChanged)
    } else if (currentUserId) {
        const sectionIdFromHash = initialHash.substring(1);
        const linkForHash = document.querySelector(`.nav-link[href="${initialHash}"]`);
        window.showSection(sectionIdFromHash, linkForHash || document.querySelector('a[href="#inicio"]'));
    }
});