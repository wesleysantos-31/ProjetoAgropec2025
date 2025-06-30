// Importa as funções necessárias do SDK do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithEmailAndPassword, onAuthStateChanged, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
import { getFirestore, collection, onSnapshot, addDoc, doc, getDoc, setDoc, updateDoc, deleteDoc, query, where, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";

// ============= CONFIGURAÇÃO NECESSÁRIA DO FIREBASE =============
// Objeto de configuração contendo as credenciais para inicializar a conexão com o Firebase.
const firebaseConfig = {
    // Chave de API que autoriza as requisições para os serviços do Google Cloud e Firebase.
    apiKey: "AIzaSyBLeqJsQdDVYX2zKlcs9tGzdgYsvYFDog4", // Esta chave precisa ser alterada para a chave real do projeto que é de suma importância para a conexão com o Firebase.
    // O domínio oficial do projeto no Firebase, usado para os fluxos de autenticação (Firebase Auth).
    authDomain: "agropec-2025-app.firebaseapp.com", // Este domínio deve ser o mesmo que o do projeto no Firebase Console. Por tanto, esse domímio precisa ser alterado para o domínio real do projeto.
    // Identificador único e imutável do projeto no console do Google Cloud e Firebase.
    projectId: "agropec-2025-app", // Este ID é gerado precisa ser o mesmo que o do projeto no Firebase Console. Portanto, esse ID precisa ser alterado para o ID real do projeto.
    // URL do bucket padrão no Cloud Storage, utilizado para armazenar arquivos como imagens e vídeos.
    storageBucket: "agropec-2025-app.firebaseapp.com", // Este bucket é usado para armazenar arquivos e deve ser o mesmo que o do projeto no Firebase Console. Portanto, esse bucket precisa ser alterado para o bucket real do projeto.
    // ID do remetente para o Firebase Cloud Messaging (FCM), serviço de envio de notificações push.
    messagingSenderId: "203743696437", // Este ID é usado para identificar o remetente de mensagens e deve ser o mesmo que o do projeto no Firebase Console. Portanto, esse ID precisa ser alterado para o ID real do projeto.
    // Identificador único para esta aplicação web específica dentro do projeto Firebase.
    appId: "1:203743696437:web:0332c09896cc34eb14437c", // Este appId é usado para identificar a aplicação no Firebase e deve ser o mesmo que o do projeto no Firebase Console. Portanto, esse appId precisa ser alterado para o appId real do projeto.
    // ID de medição para o Google Analytics, usado para coletar dados de uso e eventos da aplicação.
    measurementId: "G-40JHQ2RPEQ" // Este measurementId é usado para identificar a aplicação no Google Analytics e deve ser o mesmo que o do projeto no Firebase Console. Portanto, esse measurementId precisa ser alterado para o measurementId real do projeto.
};
// ========== FIM DA CONFIGURAÇÃO NECESSÁRIA DO FIREBASE ==========

let currentUserId = null;
let registrationContext = 'visitor'; // 'visitor' ou 'admin'
let globalEventsCache = []; // Cache para eventos, usado para edição
let globalExpositorsCache = []; // Cache para expositores, usado para edição

// --- Novas Variáveis para Mapa Interativo com Zoom/Pan ---
let mapImage = null;
const mapImageURL = 'img/mapa-agropec-2025.svg'; // Caminho para a sua imagem SVG

// Elementos da UI do Mapa
let fairMapCanvas, fairMapCtx, adminMapCanvas, adminMapCtx;
let stands = [];
let adminMapTemporaryMarker = null;

// Estado de transformação do mapa (zoom e pan)
let scale = 1.0;
let offsetX = 0;
let offsetY = 0;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
const minZoom = 1.0; // Zoom mínimo permitido
const maxZoom = 5.0; // Zoom máximo permitido

// Variáveis para a animação de pulso dos hotspots
let pulseValue = 0;
let pulseDirection = 1;
let initialPinchDistance = null;
// --- Fim das Novas Variáveis ---

// Força o redimensionamento do canvas ao mostrar a guia do mapa
function resizeFairMapCanvas() {
    const canvas = document.getElementById('fairMapCanvas');
    if (!canvas) return;
    const wrapper = canvas.parentElement;
    canvas.width = wrapper.clientWidth;
    canvas.height = Math.max(300, wrapper.clientHeight);
    // Redesenhe o mapa aqui se necessário
    if (window.drawFairMap) window.drawFairMap();
}

// Detecta quando a seção do mapa é exibida
const mapaSection = document.getElementById('mapa');
if (mapaSection) {
    const observer = new MutationObserver(() => {
        if (mapaSection.classList.contains('active')) {
            setTimeout(() => {
                // Redimensiona o canvas do mapa público quando a seção se torna ativa
                handleMapResize('fairMapCanvas');
            }, 100);
        }
    });
    observer.observe(mapaSection, { attributes: true, attributeFilter: ['class'] });
}

// detectar quando a seção do painel de administração se torna visível.
const adminDashboardSection = document.getElementById('admin-dashboard');
if (adminDashboardSection) {
    // Cria um observador que reage a mudanças nos atributos da seção.
    const adminMapObserver = new MutationObserver(() => {
        // Verifica se a seção agora está ativa (visível).
        if (adminDashboardSection.classList.contains('active')) {
            // Se estiver ativa, chama a função 'handleMapResize' para o canvas do admin.
            // Um pequeno atraso (100ms) garante que a animação de transição da tela
            // termine e o canvas tenha o tamanho correto para ser desenhado.
            setTimeout(() => {
                handleMapResize('adminMapCanvas');
            }, 100);
        }
    });
    // Configura o observador para monitorar especificamente o atributo 'class'.
    adminMapObserver.observe(adminDashboardSection, {
        attributes: true,
        attributeFilter: ['class']
    });
}

// Também ajusta ao redimensionar a janela
window.addEventListener('resize', resizeFairMapCanvas);

// Ajuste dos pinos (bolinhas) verdes/vermelhas
window.FAIR_MAP_PIN_RADIUS = 10; // Diminua para 10px (antes era maior)

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

// Função para exibir/ocultar a sidebar no mobile
document.getElementById('closeSidebarBtn').onclick = function() {
    document.querySelector('.sidebar').classList.add('-translate-x-full');
};

window.showSection = function(sectionId, clickedLink) {
    // Seleciona os elementos de layout principais
    const header = document.querySelector('header');
    const sidebar = document.querySelector('.sidebar');
    const mainContentArea = document.querySelector('.main-content');
    const isAuthScreen = sectionId === 'welcome-role-selection' || sectionId === 'login';

    // Controla a visibilidade do header, sidebar e do espaçamento do topo
    if (header && sidebar && mainContentArea) {
        header.classList.toggle('hidden', isAuthScreen);
        sidebar.classList.toggle('hidden', isAuthScreen);
    }

    // --- ESTA É A PARTE MAIS IMPORTANTE PARA CORRIGIR A SOBREPOSIÇÃO ---
    // Este seletor encontra TODAS as seções, não importa a estrutura do HTML
    const sections = document.querySelectorAll('main > div > section, main > section');

    // Primeiro, ele esconde TODAS as seções
    sections.forEach(section => {
        section.classList.remove('active');
    });

    // Depois, ele mostra APENAS a seção correta
    const activeSection = document.getElementById(sectionId);
    if (activeSection) {
        activeSection.classList.add('active');
    }

    // O resto da lógica para os links do menu continua igual
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.classList.remove('active', 'bg-green-700');
    });

    if (clickedLink) {
        clickedLink.classList.add('active', 'bg-green-700');
    }

    if (window.innerWidth < 768 && sidebar && !sidebar.classList.contains('-translate-x-full')) {
        sidebar.classList.add('-translate-x-full');
    }
};

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

// --- INÍCIO DO NOVO BLOCO DE FUNÇÕES DO MAPA ---
// Inicia a animação de pulsação que será usada para os hotspots
function startPulseAnimation() {
    function animate() {
        // Lógica simples para criar um valor que oscila entre 0 e 1
        pulseValue += 0.05 * pulseDirection;
        if (pulseValue >= 1 || pulseValue <= 0) {
            pulseDirection *= -1; // Inverte a direção da animação
        }
        // Redesenha os mapas em cada quadro da animação
        drawAllMaps();
        requestAnimationFrame(animate);
    }
    // Inicia o loop da animação
    if (window.requestAnimationFrame) {
        animate();
    }
}

// Inicializa um canvas específico
function initMap(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) { console.error(`Canvas '${canvasId}' não encontrado.`); return; }

    // Carrega a imagem do mapa (apenas uma vez para todo o app)
    if (!mapImage) {
        mapImage = new Image();
        mapImage.src = mapImageURL;
        mapImage.onload = () => {
            console.log("Imagem do mapa SVG carregada!");
            drawAllMaps(); // Desenha todos os mapas quando a imagem estiver pronta
            startPulseAnimation(); // Inicia a animação de pulso
        };
        mapImage.onerror = () => console.error("Falha ao carregar a imagem do mapa. Verifique o caminho: " + mapImageURL);
    }

    if (canvasId === 'fairMapCanvas') {
        fairMapCanvas = canvas;
        fairMapCtx = canvas.getContext('2d');
    } else if (canvasId === 'adminMapCanvas') {
        adminMapCanvas = canvas;
        adminMapCtx = canvas.getContext('2d');
    }

    // Adiciona os listeners de eventos para zoom e pan no canvas
    canvas.addEventListener('wheel', handleWheel);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp); // Cancela o arrastar se o mouse sair

    // Adiciona os listeners de eventos para zoom e pan no canvas
    canvas.addEventListener('wheel', handleWheel);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp); // Cancela o arrastar se o mouse sair

    // Adiciona os listeners para eventos de toque (celulares e tablets)
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);
    canvas.addEventListener('touchcancel', handleTouchEnd); // Cancela se o toque for interrompido
    // A lógica de clique que existia aqui foi movida para o handleMouseUp/handleTouchEnd
    // ...

// ...
    // Listener de clique específico para cada tipo de mapa
    window.addEventListener('resize', () => handleMapResize(canvasId));
    handleMapResize(canvasId); // Configuração inicial do tamanho
}

// Redimensiona o canvas quando a janela muda de tamanho
function handleMapResize(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    // Pega o tamanho do .map-wrapper, que agora controla as dimensões
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    drawMap(canvasId, ctx, rect.width, rect.height);
}

// Função para redesenhar ambos os mapas (útil para animação e eventos)
function drawAllMaps() {
    if (fairMapCanvas && fairMapCtx) {
        drawMap('fairMapCanvas', fairMapCtx, fairMapCanvas.parentElement.clientWidth, fairMapCanvas.parentElement.clientHeight);
    }
    if (adminMapCanvas && adminMapCtx) {
        drawMap('adminMapCanvas', adminMapCtx, adminMapCanvas.parentElement.clientWidth, adminMapCanvas.parentElement.clientHeight);
    }
}

function drawMap(canvasId, ctx, cssWidth, cssHeight) {
    if (!ctx) return;
    if (!mapImage || !mapImage.complete) return;

    ctx.clearRect(0, 0, cssWidth, cssHeight);
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    if (mapImage && mapImage.complete) {
        ctx.drawImage(mapImage, 0, 0);
    }

    // --- LÓGICA DE DESENHO DOS ESTANDES E SEUS IDs ---
    stands.forEach(stand => {
        const baseRadius = 8 / scale;
        const pulseRadius = baseRadius + (pulseValue * 4 / scale);

        // Desenha o pulso externo
        ctx.beginPath();
        ctx.arc(stand.x, stand.y, pulseRadius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(22, 163, 74, ${0.5 * (1 - pulseValue)})`;
        ctx.fill();

        // Desenha o ponto central
        ctx.beginPath();
        ctx.arc(stand.x, stand.y, baseRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(22, 163, 74, 1)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 1.5 / scale;
        ctx.fill();
        ctx.stroke();
        
        // --- NOVO: LÓGICA PARA DESENHAR O ID DO ESTANDE ---
        if (stand.id) {
            // Configurações do texto
            const fontSize = 10 / scale;
            ctx.font = `bold ${fontSize}px Inter, sans-serif`;
            ctx.textAlign = 'center';
            
            // Adiciona um contorno branco para legibilidade
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2 / scale;
            ctx.strokeText(stand.id, stand.x, stand.y - (baseRadius + 5 / scale));
            
            // Preenche o texto com cor escura
            ctx.fillStyle = '#1E293B'; // Cor escura (slate-800)
            ctx.fillText(stand.id, stand.x, stand.y - (baseRadius + 5 / scale));
        }
        // --- FIM DA LÓGICA DE DESENHO DO ID ---
    });

    // --- LÓGICA DE DESENHO DO MARCADOR TEMPORÁRIO E SUAS COORDENADAS ---
    if (canvasId === 'adminMapCanvas' && adminMapTemporaryMarker) {
        const markerRadius = 10 / scale;
        
        // Desenha o marcador vermelho
        ctx.fillStyle = 'rgba(220, 38, 38, 0.8)';
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2 / scale;
        ctx.beginPath();
        ctx.arc(adminMapTemporaryMarker.x, adminMapTemporaryMarker.y, markerRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // --- NOVO: LÓGICA PARA DESENHAR AS COORDENADAS ---
        const coordText = `(X:${Math.round(adminMapTemporaryMarker.x)}, Y:${Math.round(adminMapTemporaryMarker.y)})`;
        const fontSize = 10 / scale;
        ctx.font = `600 ${fontSize}px Inter, sans-serif`;
        ctx.textAlign = 'left';

        // Contorno branco para legibilidade
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 3 / scale;
        ctx.strokeText(coordText, adminMapTemporaryMarker.x + markerRadius + (5 / scale), adminMapTemporaryMarker.y + (fontSize / 3));

        // Preenchimento do texto
        ctx.fillStyle = '#B91C1C'; // Cor vermelha escura (red-800)
        ctx.fillText(coordText, adminMapTemporaryMarker.x + markerRadius + (5 / scale), adminMapTemporaryMarker.y + (fontSize / 3));
        // --- FIM DA LÓGICA DE DESENHO DAS COORDENADAS ---
    }
    ctx.restore();
    updateCustomScrollbars(canvasId);
}

// --- Funções de Eventos do Mouse para Zoom e Pan ---
function handleWheel(event) {
    event.preventDefault();
    const scaleAmount = 1.1;
    const rect = event.target.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    let newScale;
    if (event.deltaY < 0) { // Zoom In
        newScale = Math.min(maxZoom, scale * scaleAmount);
    } else { // Zoom Out
        newScale = Math.max(minZoom, scale / scaleAmount);
    }

    // Ajusta o offset para que o zoom seja centrado no mouse
    offsetX = mouseX - (mouseX - offsetX) * (newScale / scale);
    offsetY = mouseY - (mouseY - offsetY) * (newScale / scale);
    scale = newScale;
    drawAllMaps();
}

function handleMouseDown(event) {
    if (event.button !== 0) return; // Apenas botão esquerdo
    // Armazena a posição exata do início do clique
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    isDragging = false; // Começa como 'não arrastando'
    event.target.style.cursor = 'grabbing';
}

function handleMouseMove(event) {
    // A verificação 'buttons' é mais confiável que uma flag booleana
    if (event.buttons !== 1) return;
    isDragging = true; // Marca que um arraste está ocorrendo

    const dx = event.clientX - dragStartX;
    const dy = event.clientY - dragStartY;

    let newOffsetX = offsetX + dx;
    let newOffsetY = offsetY + dy;

    // Calcula os limites para não arrastar o mapa para fora da tela
    if (mapImage && mapImage.complete) {
        const canvasWidth = event.target.clientWidth;
        const canvasHeight = event.target.clientHeight;
        const mapRenderedWidth = mapImage.width * scale;
        const mapRenderedHeight = mapImage.height * scale;

        // Limite máximo (não arrastar para a direita/baixo demais, deixando espaço em branco)
        const maxOffsetX = 0;
        const maxOffsetY = 0;

        // Limite mínimo (não arrastar para a esquerda/cima demais)
        const minOffsetX = canvasWidth - mapRenderedWidth;
        const minOffsetY = canvasHeight - mapRenderedHeight;

        // Aplica os limites
        newOffsetX = Math.max(minOffsetX, Math.min(newOffsetX, maxOffsetX));
        newOffsetY = Math.max(minOffsetY, Math.min(newOffsetY, maxOffsetY));
    }

    offsetX = newOffsetX;
    offsetY = newOffsetY;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    drawAllMaps(); // Redesenha o mapa na nova posição
}

function handleMouseUp(event) {
    event.target.style.cursor = 'grab';
    const dx = Math.abs(event.clientX - dragStartX);
    const dy = Math.abs(event.clientY - dragStartY);

    // Se o mouse se moveu menos que 5 pixels, considera um clique.
    if (dx < 5 && dy < 5) {
        // Chama a função de clique apropriada com base no canvas
        if (event.target.id === 'fairMapCanvas') {
            handleFairMapClick(event);
        } else if (event.target.id === 'adminMapCanvas') {
            handleAdminMapClick(event);
        }
    }
    // Reseta o estado de 'isDragging' ao final
    isDragging = false;
}

// --- Funções de Clique Atualizadas ---
function handleAdminMapClick(event) {
    if (isDragging) return; // Ignora cliques que foram parte de um arraste

    const rect = event.target.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // Converte as coordenadas do clique (na tela) para coordenadas do "mundo" (no mapa)
    // Esta é a fórmula crucial que corrige o posicionamento dos hotspots
    const worldX = (mouseX - offsetX) / scale;
    const worldY = (mouseY - offsetY) / scale;

    // Atualiza o formulário com as coordenadas corretas e independentes do zoom
    document.getElementById('standX').value = Math.round(worldX);
    document.getElementById('standY').value = Math.round(worldY);
    document.getElementById('standCoordinatesDisplay').value = `X: ${Math.round(worldX)}, Y: ${Math.round(worldY)}`;

    adminMapTemporaryMarker = { x: worldX, y: worldY };
    drawAllMaps();
}

function handleFairMapClick(event) {
    if (isDragging) return; // Ignora cliques que foram parte de um arraste

    const rect = event.target.getBoundingClientRect();
    // Converte o clique na tela para coordenadas do "mundo" (mapa)
    const clickX = (event.clientX - rect.left - offsetX) / scale;
    const clickY = (event.clientY - rect.top - offsetY) / scale;

    let clickedStand = null;
    for (const stand of [...stands].reverse()) {
        const radius = 12 / scale; // Área de clique um pouco maior que o ponto visual
        const distance = Math.sqrt(Math.pow(clickX - stand.x, 2) + Math.pow(clickY - stand.y, 2));
        if (distance <= radius) {
            clickedStand = stand;
            break;
        }
    }

    if (clickedStand) {
        const expositorInfo = globalExpositorsCache.find(expo => expo.name === clickedStand.occupant);
        const fullStandData = { ...expositorInfo, ...clickedStand };
        showInfoModal(fullStandData);
    }
}

// A função `showInfoModal` permanece a mesma que você já tem
function showInfoModal(data) {
    const modal = document.getElementById('info-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalDescription = document.getElementById('modal-description');
    const modalCategory = document.getElementById('modal-category');
    const modalImage = document.getElementById('modal-image');

    if (!modal) return;

    modalTitle.textContent = data.name || data.id || "Informação Indisponível";
    modalDescription.textContent = data.description || "Nenhuma descrição detalhada fornecida.";
    modalCategory.textContent = data.category || "Sem categoria";
    modalImage.src = data.logoUrl || 'https://placehold.co/100x100/388E3C/FFFFFF?text=Logo&font=Inter';

    modal.style.display = 'flex';
}

// Função para atualizar as barras de rolagem personalizadas
// Esta função deve ser chamada sempre que o mapa for desenhado ou redimensionado
// app.js (SUBSTITUA a função updateCustomScrollbars inteira)
function updateCustomScrollbars(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !mapImage || !mapImage.complete) return;

    // CORREÇÃO: Remove a parte 'Canvas' do ID para encontrar os elementos corretos.
    const baseId = canvasId.replace('Canvas', '');
    const scrollbarH = document.getElementById(`${baseId}ScrollbarH`);
    const thumbH = document.getElementById(`${baseId}ThumbH`);
    const scrollbarV = document.getElementById(`${baseId}ScrollbarV`);
    const thumbV = document.getElementById(`${baseId}ThumbV`);

    // Adicionamos uma verificação para garantir que todos os elementos existem antes de continuar.
    if (!scrollbarH || !thumbH || !scrollbarV || !thumbV) {
        // Isso evita o erro caso os elementos não estejam no HTML.
        // console.warn(`Elementos de scrollbar para '${canvasId}' não encontrados.`);
        return;
    }

    const canvasWidth = canvas.clientWidth;
    const canvasHeight = canvas.clientHeight;
    const mapRenderedWidth = mapImage.width * scale;
    const mapRenderedHeight = mapImage.height * scale;

    // Lógica para a barra de rolagem horizontal
    if (mapRenderedWidth > canvasWidth) {
        scrollbarH.style.display = 'block';
        const thumbWidth = (canvasWidth / mapRenderedWidth) * 100;
        const thumbLeft = (-offsetX / (mapRenderedWidth - canvasWidth)) * (100 - thumbWidth);
        thumbH.style.width = `${thumbWidth}%`;
        thumbH.style.left = `${thumbLeft}%`;
    } else {
        scrollbarH.style.display = 'none';
    }

    // Lógica para a barra de rolagem vertical
    if (mapRenderedHeight > canvasHeight) {
        scrollbarV.style.display = 'block';
        const thumbHeight = (canvasHeight / mapRenderedHeight) * 100;
        const thumbTop = (-offsetY / (mapRenderedHeight - canvasHeight)) * (100 - thumbHeight);
        thumbV.style.height = `${thumbHeight}%`;
        thumbV.style.top = `${thumbTop}%`;
    } else {
        scrollbarV.style.display = 'none';
    }
}
// --- FIM DO NOVO BLOCO DE FUNÇÕES DO MAPA ---

// app.js (Adicione este novo bloco de funções)
// --- INÍCIO DAS NOVAS FUNÇÕES DE TOQUE PARA O MAPA ---
function handleTouchStart(event) {
    event.preventDefault(); // Previne o comportamento padrão do navegador (como rolar a página)
    const touches = event.touches;

    if (touches.length === 1) {
        // Início de um arraste com um dedo
        dragStartX = touches[0].clientX;
        dragStartY = touches[0].clientY;
        isDragging = false; // Começa como não arrastando, será 'true' se mover
    } else if (touches.length === 2) {
        // Início de um gesto de pinça com dois dedos
        initialPinchDistance = Math.hypot(
            touches[0].clientX - touches[1].clientX,
            touches[0].clientY - touches[1].clientY
        );
        isDragging = true; // Um gesto de pinça é considerado um "arraste" para não virar clique
    }
}

function handleTouchMove(event) {
    event.preventDefault();
    const touches = event.touches;

    if (touches.length === 1) {
        // Lógica para arrastar (pan) com um dedo
        if (isDragging || Math.abs(touches[0].clientX - dragStartX) > 5 || Math.abs(touches[0].clientY - dragStartY) > 5) {
            isDragging = true;
            const dx = touches[0].clientX - dragStartX;
            const dy = touches[0].clientY - dragStartY;

            let newOffsetX = offsetX + dx;
            let newOffsetY = offsetY + dy;

            // Aplica os mesmos limites do arraste com o mouse
            if (mapImage && mapImage.complete) {
                const canvas = event.target;
                const canvasWidth = canvas.clientWidth;
                const canvasHeight = canvas.clientHeight;
                const mapRenderedWidth = mapImage.width * scale;
                const mapRenderedHeight = mapImage.height * scale;

                const minOffsetX = canvasWidth - mapRenderedWidth;
                const minOffsetY = canvasHeight - mapRenderedHeight;

                newOffsetX = Math.max(minOffsetX, Math.min(newOffsetX, 0));
                newOffsetY = Math.max(minOffsetY, Math.min(newOffsetY, 0));
            }

            offsetX = newOffsetX;
            offsetY = newOffsetY;

            // Atualiza a posição inicial para o próximo movimento
            dragStartX = touches[0].clientX;
            dragStartY = touches[0].clientY;

            drawAllMaps();
        }
    } else if (touches.length === 2 && initialPinchDistance) {
        // Lógica para zoom (gesto de pinça) com dois dedos
        const currentPinchDistance = Math.hypot(
            touches[0].clientX - touches[1].clientX,
            touches[0].clientY - touches[1].clientY
        );

        // Calcula o fator de escala
        const zoomFactor = currentPinchDistance / initialPinchDistance;
        const newScale = Math.max(minZoom, Math.min(maxZoom, scale * zoomFactor));

        // Calcula o ponto médio entre os dedos para centralizar o zoom
        const midX = (touches[0].clientX + touches[1].clientX) / 2;
        const midY = (touches[0].clientY + touches[1].clientY) / 2;

        // Ajusta o offset para que o zoom pareça vir do centro dos dedos
        offsetX = midX - (midX - offsetX) * (newScale / scale);
        offsetY = midY - (midY - offsetY) * (newScale / scale);
        scale = newScale;

        initialPinchDistance = currentPinchDistance; // Atualiza para o próximo movimento
        drawAllMaps();
    }
}

function handleTouchEnd(event) {
    // Se a ação de toque terminou, resetamos as variáveis de controle
    const wasDragging = isDragging;
    isDragging = false;
    initialPinchDistance = null;

    // Lógica de clique: se o toque terminou sem ser um arraste, processa o clique
    if (!wasDragging && event.changedTouches.length === 1) {
        const touch = event.changedTouches[0];
        const fakeMouseEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        // Chama a função de clique apropriada baseada no canvas
        if (event.target.id === 'fairMapCanvas') {
            handleFairMapClick(fakeMouseEvent);
        } else if (event.target.id === 'adminMapCanvas') {
            handleAdminMapClick(fakeMouseEvent);
        }
    }
}
// --- FIM DAS NOVAS FUNÇÕES DE TOQUE PARA O MAPA ---

// Listener para fechar o modal
const infoModal = document.getElementById('info-modal');
if(infoModal) {
    const modalCloseBtn = document.getElementById('modal-close-btn');
    // Fecha ao clicar no botão 'X'
    modalCloseBtn.addEventListener('click', () => {
        infoModal.style.display = 'none';
    });

    // Fecha ao clicar no fundo escuro (overlay)
    infoModal.addEventListener('click', (event) => {
        if (event.target === infoModal) {
            infoModal.style.display = 'none';
        }
    });
}


// --- Funções de Gerenciamento de Conteúdo (Organizadores) ---

async function submitNewsForm(newsData, newsIdToUpdate = null) {
    if (!currentUserId || !window.db) { console.error("Usuário ou DB não disponível"); return; }
    const messageEl = document.getElementById('news-message');
    try {
        if (newsIdToUpdate) {
            // ATUALIZAR notícia existente
            const newsDocRef = doc(window.db, `artifacts/${firebaseConfig.appId}/public/data/news`, newsIdToUpdate);
            await updateDoc(newsDocRef, { ...newsData, updatedAt: serverTimestamp() });
            messageEl.textContent = 'Notícia atualizada com sucesso!';
        } else {
            // ADICIONAR nova notícia
            const newsCollectionRef = collection(window.db, `artifacts/${firebaseConfig.appId}/public/data/news`);
            await addDoc(newsCollectionRef, { ...newsData, publishedAt: serverTimestamp(), authorId: currentUserId });
            messageEl.textContent = 'Notícia publicada!';
        }
        messageEl.className = 'text-green-600 text-sm mt-2';
        document.getElementById('news-form').reset();
        document.getElementById('newsIdToUpdate').value = ''; // Limpa o ID
        document.getElementById('news-submit-button').textContent = 'Publicar Notícia';
        document.getElementById('news-cancel-edit-button').classList.add('hidden');
    } catch (error) {
        console.error("Erro ao salvar notícia:", error);
        messageEl.textContent = 'Erro ao salvar.'; messageEl.className = 'text-red-500 text-sm mt-2';
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

async function submitInfoForm(infoData, infoIdToUpdate = null) {
    if (!currentUserId || !window.db) return;
    const messageEl = document.getElementById('info-message');
    try {
        if (infoIdToUpdate) {
            // ATUALIZAR informação existente
            const infoDocRef = doc(window.db, `artifacts/${firebaseConfig.appId}/public/data/generalInfo`, infoIdToUpdate);
            await updateDoc(infoDocRef, { ...infoData, updatedAt: serverTimestamp() });
            messageEl.textContent = 'Informação atualizada com sucesso!';
        } else {
            // ADICIONAR nova informação
            const infoCollectionRef = collection(window.db, `artifacts/${firebaseConfig.appId}/public/data/generalInfo`);
            await addDoc(infoCollectionRef, { ...infoData, createdAt: serverTimestamp(), authorId: currentUserId });
            messageEl.textContent = 'Informação publicada!';
        }
        messageEl.className = 'text-green-600 text-sm mt-2';
        document.getElementById('info-form').reset();
        document.getElementById('infoIdToUpdate').value = '';
        document.getElementById('info-submit-button').textContent = 'Publicar Informação';
        document.getElementById('info-cancel-edit-button').classList.add('hidden');
    } catch (error) {
        console.error("Erro ao salvar informação:", error);
        messageEl.textContent = 'Erro ao salvar.'; messageEl.className = 'text-red-500 text-sm mt-2';
    }
}

// --- Funções de Carregamento de Dados Públicos ---

function loadPublicNews() {
    // Garante que a conexão com o banco de dados esteja disponível.
    if (!window.db) return;

    // Localiza o contêiner de notícias na página inicial.
    const newsContainer = document.getElementById('public-news-container');
    if (!newsContainer) return;

    // Referência à coleção de notícias no Firestore.
    const newsCollectionRef = collection(window.db, `artifacts/${firebaseConfig.appId}/public/data/news`);

    // Escuta por atualizações em tempo real na coleção de notícias.
    onSnapshot(newsCollectionRef, (snapshot) => {
        // Limpa o contêiner da página inicial antes de adicionar o conteúdo atualizado.
        newsContainer.innerHTML = '';
        if (snapshot.empty) {
            newsContainer.innerHTML = '<p class="text-gray-500 col-span-full">Nenhuma notícia recente.</p>';
        }

        let newsList = [];
        // Converte os documentos do Firestore em uma lista de objetos.
        snapshot.forEach(doc => {
            newsList.push({ id: doc.id, ...doc.data() });
        });

        // Ordena as notícias da mais recente para a mais antiga.
        newsList.sort((a, b) => (b.publishedAt?.toMillis() || 0) - (a.publishedAt?.toMillis() || 0));

        // Atualiza a lista de notícias no painel de administração.
        displayAdminNewsList(newsList);

        // Preenche o contêiner da página inicial com um resumo das notícias.
        if (!snapshot.empty) {
            newsList.forEach(news => {
                const displayDate = news.date || new Date(news.publishedAt?.toMillis() || Date.now()).toLocaleDateString('pt-br');
                const newsCard = `
                    <div class="card p-6">
                        <h4 class="font-semibold text-lg mb-1 text-green-700">${news.title}</h4>
                        <p class="text-xs text-gray-400 mb-2">Publicado em: ${displayDate}</p>
                        <p class="text-gray-600 text-sm">${news.content.substring(0, 150)}${news.content.length > 150 ? '...' : ''}</p>
                    </div>`;
                newsContainer.innerHTML += newsCard;
            });
        }
        
        // Localiza o contêiner na página de arquivo de notícias.
        const newsArchiveContainer = document.getElementById('news-archive');
        if (newsArchiveContainer) {
            newsArchiveContainer.innerHTML = '';
            if (newsList.length === 0) {
                newsArchiveContainer.innerHTML = '<p class="text-gray-500 col-span-full">Nenhuma notícia publicada.</p>';
            } else {
                // Preenche o arquivo de notícias com o conteúdo completo de cada notícia.
                newsList.forEach(news => {
                    const displayDate = news.date || new Date(news.publishedAt?.toMillis() || Date.now()).toLocaleDateString('pt-br');
                    const newsCard = `
                        <div class="card p-6">
                            <h4 class="font-semibold text-lg mb-1 text-green-700">${news.title}</h4>
                            <p class="text-xs text-gray-400 mb-2">Publicado em: ${displayDate}</p>
                            <p class="text-gray-600 text-sm">${news.content}</p>
                        </div>`;
                    newsArchiveContainer.innerHTML += newsCard;
                });
            }
        }
    }, error => {
        console.error("Erro ao carregar notícias:", error);
        newsContainer.innerHTML = '<p class="text-red-500 col-span-full">Erro ao carregar notícias.</p>';
        const newsArchiveContainer = document.getElementById('news-archive');
        if (newsArchiveContainer) {
            newsArchiveContainer.innerHTML = '<p class="text-red-500 col-span-full">Erro ao carregar notícias.</p>';
        }
    });
}


// app.js (Adicione estas 3 novas funções)
function displayAdminInfoList(infoList) {
    const listContainer = document.getElementById('admin-info-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    if (infoList.length === 0) {
        listContainer.innerHTML = '<p class="text-gray-500">Nenhuma informação publicada.</p>';
        return;
    }

    infoList.forEach(info => {
        const item = document.createElement('div');
        item.className = 'p-3 border rounded-md bg-gray-50 flex justify-between items-center';
        item.innerHTML = `
            <div class="flex-1 min-w-0 pr-4">
                <h4 class="font-semibold text-md text-green-700">${info.title}</h4>
            </div>
            <div class="flex-shrink-0">
                <button class="text-blue-500 hover:text-blue-700 text-sm mr-2 edit-info-btn" data-info-id="${info.id}">Editar</button>
                <button class="text-red-500 hover:text-red-700 text-sm delete-info-btn" data-info-id="${info.id}">Excluir</button>
            </div>`;
        listContainer.appendChild(item);
    });
}

async function handleDeleteInfo(infoId) {
    if (!window.db || !infoId) return;
    if (confirm('Tem certeza que deseja excluir esta informação? Esta ação não pode ser desfeita.')) {
        try {
            const infoDocRef = doc(window.db, `artifacts/${firebaseConfig.appId}/public/data/generalInfo`, infoId);
            await deleteDoc(infoDocRef);
        } catch (error) {
            console.error('Erro ao excluir informação:', error);
            alert('Ocorreu um erro ao excluir a informação.');
        }
    }
}

function populateInfoFormForEdit(infoId) {
    const infoDocRef = doc(window.db, `artifacts/${firebaseConfig.appId}/public/data/generalInfo`, infoId);
    getDoc(infoDocRef).then(docSnap => {
        if (docSnap.exists()) {
            const info = docSnap.data();
            document.getElementById('infoIdToUpdate').value = infoId;
            document.getElementById('infoTitle').value = info.title;
            document.getElementById('infoContent').value = info.content;
            document.getElementById('info-submit-button').textContent = 'Atualizar Informação';
            document.getElementById('info-cancel-edit-button').classList.remove('hidden');
            document.getElementById('info-form').scrollIntoView({ behavior: 'smooth' });
        } else {
            alert('Erro: informação não encontrada.');
        }
    });
}


function loadPublicGeneralInfo() {
    if (!window.db) return;
    const infoContainer = document.getElementById('public-info-container');
    const infoCollectionRef = collection(window.db, `artifacts/${firebaseConfig.appId}/public/data/generalInfo`);

    onSnapshot(infoCollectionRef, (snapshot) => {
        let infoList = [];
        snapshot.forEach(doc => {
            infoList.push({ id: doc.id, ...doc.data() });
        });
        // Ordena por data de criação
        infoList.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));

        // ATUALIZA A LISTA NO PAINEL DE ADMIN
        displayAdminInfoList(infoList);

        // Renderiza as informações na tela inicial
        if (infoContainer) {
            infoContainer.innerHTML = '';
            if (infoList.length === 0) {
                infoContainer.innerHTML = '<p class="text-gray-500">Nenhuma informação geral disponível.</p>';
            } else {
                infoList.forEach(info => {
                    const infoItem = `
                        <div class="mb-3 pb-3 border-b border-gray-200 last:border-b-0">
                            <h5 class="font-medium text-md text-green-600">${info.title}</h5>
                            <p class="text-gray-600 text-sm">${info.content}</p>
                        </div>`;
                    infoContainer.innerHTML += infoItem;
                });
            }
        }
    }, error => {
        console.error("Erro ao carregar informações gerais:", error);
        if(infoContainer) infoContainer.innerHTML = '<p class="text-red-500">Erro ao carregar informações.</p>';
    });
}


function displayAdminNewsList(newsList) {
    const listContainer = document.getElementById('admin-news-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    if (newsList.length === 0) {
        listContainer.innerHTML = '<p class="text-gray-500">Nenhuma notícia publicada.</p>';
        return;
    }
    // Ordena para mostrar as mais recentes primeiro
    const sortedNews = newsList.sort((a, b) => (b.publishedAt?.toMillis() || 0) - (a.publishedAt?.toMillis() || 0));

    sortedNews.forEach(news => {
        const item = document.createElement('div');
        item.className = 'p-3 border rounded-md bg-gray-50 flex justify-between items-center';
        item.innerHTML = `
            <div>
                <h4 class="font-semibold text-green-700 text-md">${news.title}</h4>
                <p class="text-sm text-gray-600">Publicado em: ${news.date}</p>
            </div>
            <div>
                <button class="text-blue-500 hover:text-blue-700 text-sm mr-2 edit-news-btn" data-news-id="${news.id}">Editar</button>
                <button class="text-red-500 hover:text-red-700 text-sm delete-news-btn" data-news-id="${news.id}">Excluir</button>
            </div>`;
        listContainer.appendChild(item);
    });
}

// app.js (Adicione estas duas novas funções)
async function handleDeleteNews(newsId) {
    if (!window.db || !newsId) return;
    if (confirm('Tem certeza que deseja excluir esta notícia? Esta ação não pode ser desfeita.')) {
        try {
            const newsDocRef = doc(window.db, `artifacts/${firebaseConfig.appId}/public/data/news`, newsId);
            await deleteDoc(newsDocRef);
            // A lista se atualizará automaticamente graças ao onSnapshot.
        } catch (error) {
            console.error('Erro ao excluir notícia:', error);
            alert('Ocorreu um erro ao excluir a notícia.');
        }
    }
}

function populateNewsFormForEdit(newsId) {
    // Busca a notícia no nosso cache global (que precisa ser criado)
    // Vamos assumir que a 'newsList' dentro de loadPublicNews é nosso cache por enquanto.
    // Para uma solução mais robusta, teríamos um globalNewsCache.
    // Por simplicidade, vamos buscar direto do Firestore por agora.
    const newsDocRef = doc(window.db, `artifacts/${firebaseConfig.appId}/public/data/news`, newsId);
    getDoc(newsDocRef).then(docSnap => {
        if (docSnap.exists()) {
            const news = docSnap.data();
            document.getElementById('newsIdToUpdate').value = newsId;
            document.getElementById('newsTitle').value = news.title;
            document.getElementById('newsContent').value = news.content;

            const submitButton = document.getElementById('news-submit-button');
            const cancelButton = document.getElementById('news-cancel-edit-button');
            submitButton.textContent = 'Atualizar Notícia';
            cancelButton.classList.remove('hidden');

            // Rola a página para o formulário para facilitar a edição
            document.getElementById('news-form').scrollIntoView({ behavior: 'smooth' });
        } else {
            console.error("Notícia não encontrada para edição.");
        }
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
                <p class="text-sm text-gray-600">${event.date} - ${event.time} - ${event.location}</p>
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

// --- Funções de Configuração de Abas do Admin ---
function setupAdminTabs() {
    const tabsContainer = document.querySelector('[aria-label="Tabs"]');
    if (!tabsContainer) return;

    const tabButtons = tabsContainer.querySelectorAll('.admin-tab');
    const tabPanels = document.querySelectorAll('.admin-tab-panel');

    tabsContainer.addEventListener('click', (e) => {
        const clickedTab = e.target.closest('.admin-tab');
        if (!clickedTab) return;

        // Remove a classe 'active' de todas as abas e painéis
        tabButtons.forEach(button => button.classList.remove('active'));
        tabPanels.forEach(panel => panel.classList.remove('active'));

        // Adiciona a classe 'active' na aba clicada
        clickedTab.classList.add('active');

        // Mostra o painel de conteúdo correspondente
        const targetPanelId = clickedTab.dataset.tabTarget;
        const activePanel = document.getElementById(targetPanelId);
        if (activePanel) {
            activePanel.classList.add('active');
        }
    });
}


// --- Funções de Autenticação ---
// (handleRegister, handleLogin, handleVisitorLogin, handleLogout - adaptadas)

// --- Inicialização e Listeners Globais ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM carregado. App Agropec inicializando...");
    
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

    //chamar a função de abas do admin
    setupAdminTabs();

    // Listener para a lista de notícias do admin (Editar/Excluir)
    const adminNewsList = document.getElementById('admin-news-list');
    if (adminNewsList) {
        adminNewsList.addEventListener('click', (e) => {
            if (e.target.classList.contains('edit-news-btn')) {
                const newsId = e.target.dataset.newsId;
                populateNewsFormForEdit(newsId);
            }
            if (e.target.classList.contains('delete-news-btn')) {
                const newsId = e.target.dataset.newsId;
                handleDeleteNews(newsId);
            }
        });
    }

    // Listener para o botão "Cancelar Edição"
    const newsCancelEditBtn = document.getElementById('news-cancel-edit-button');
    if(newsCancelEditBtn) newsCancelEditBtn.addEventListener('click', () => {
        document.getElementById('news-form').reset();
        document.getElementById('newsIdToUpdate').value = '';
        document.getElementById('news-submit-button').textContent = 'Publicar Notícia';
        newsCancelEditBtn.classList.add('hidden');
    });

    // Ativa o calendário (date picker) no campo de data
    const eventDateInput = document.getElementById('eventDate');
    if (eventDateInput) {
        flatpickr(eventDateInput, {
            "locale": "pt", // Usa a tradução para Português que importamos
            "dateFormat": "d/m/Y", // Define o formato da data como DD/MM/AAAA
            "allowInput": true // Permite que o usuário também digite a data
        });
        const eventTimeInput = document.getElementById('eventTime');
        if (eventTimeInput) {
            flatpickr(eventTimeInput, {
                enableTime: true,      // Habilita a seleção de hora
                noCalendar: true,      // Desabilita o calendário, mostrando APENAS o seletor de hora
                dateFormat: "H:i",     // Define o formato para 24 horas (ex: 14:30)
                time_24hr: true,       // Força o uso do formato 24h
                minuteIncrement: 15,   // Opcional: faz os minutos pularem de 15 em 15, facilitando a seleção
                allowInput: true       // Permite que o usuário também digite a hora
            });
        }
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
                const adminNavSection = document.getElementById('admin-nav-section');
                // Em vez de mostrar/ocultar cada link individualmente, mostre/oculte a seção inteira
                if (adminNavSection) {
                    adminNavSection.classList.toggle('hidden', !isAdmin);
                }
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
    // app.js
    const newsForm = document.getElementById('news-form');
    if (newsForm) newsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newsIdToUpdate = document.getElementById('newsIdToUpdate').value;
        const formattedDate = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        await submitNewsForm({
            title: document.getElementById('newsTitle').value,
            content: document.getElementById('newsContent').value,
            date: formattedDate
        }, newsIdToUpdate || null);
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
        const infoIdToUpdate = document.getElementById('infoIdToUpdate').value;
        await submitInfoForm({
            title: document.getElementById('infoTitle').value,
            content: document.getElementById('infoContent').value
        }, infoIdToUpdate || null);
    });

    // Outros Listeners (login, logout, forms de estande, etc.)
    // ... (código de listeners de handleRegister, handleLogin, etc. do seu script original)

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

    if (locationForm) {
        locationForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleSubmitStandForm(); // Chama a nova função unificada
        });
    }

    // botões de editar e excluir
    const standsListContainer = document.getElementById('registered-stands-display');
    if (standsListContainer) {
        standsListContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('edit-stand-btn')) {
                populateStandFormForEdit(e.target);
            }
            if (e.target.classList.contains('delete-stand-btn')) {
                handleDeleteStand(e.target.dataset.docId);
            }
        });
    }

    // botão "Cancelar Edição"
    const cancelEditButton = document.getElementById('stand-cancel-edit-button');
    if (cancelEditButton) {
        cancelEditButton.addEventListener('click', () => {
            // Limpa e reseta o formulário
            document.getElementById('location-form').reset();
            document.getElementById('standDocIdToUpdate').value = '';
            document.getElementById('standCoordinatesDisplay').value = '';
            document.getElementById('stand-submit-button').textContent = 'Salvar Localização';
            cancelEditButton.classList.add('hidden');
            document.getElementById('location-message').textContent = '';
            
            adminMapTemporaryMarker = null; // Limpa marcador temporário do mapa
            drawAllMaps();
        });
    }
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
    const loginButton = document.getElementById('login-button'); // Obtenha o botão de login
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

    // Mostrar spinner e desabilitar o botão
    loginButton.innerHTML = '<span class="spinner"></span> Entrando...';
    loginButton.disabled = true;

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
    } finally {
        // Remover spinner e reabilitar o botão
        loginButton.innerHTML = 'Entrar';
        loginButton.disabled = false;
    }
}

async function handleVisitorLogin() {
    if (!window.auth) { console.error("Firebase Auth não inicializado."); return; }
    // Não é necessário spinner para login de visitante, pois é instantâneo na maioria dos casos
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

/**
 * Adiciona um evento ao calendário do usuário usando o formato .ics.
 * @param {object} event - O objeto do evento contendo title, description, date, time, location.
 */
function addToCalendar(event) {
    const title = event.title || 'Evento';
    const description = event.description || 'Descrição do evento';
    const location = event.location || 'Local do Evento';
    const eventDate = event.date; // Ex: "DD/MM/AAAA"
    const eventTime = event.time; // Ex: "HH:MM"

    if (!eventDate || !eventTime) {
        console.error("Dados de data ou hora do evento ausentes.");
        alert("Não foi possível adicionar ao calendário: dados de data ou hora incompletos.");
        return;
    }

    // Formata a data e hora para o formato iCalendar (YYYYMMDDTHHMMSSZ)
    const [day, month, year] = eventDate.split('/');
    const [hours, minutes] = eventTime.split(':');

    // Cria um objeto Date no fuso horário local e depois converte para UTC para o .ics
    const startDateTime = new Date(year, month - 1, day, hours, minutes);
    const endDateTime = new Date(startDateTime.getTime() + (60 * 60 * 1000)); // Adiciona 1 hora de duração

    const formatDateForICS = (dateObj) => {
        const pad = (num) => num < 10 ? '0' + num : num;
        return [
            dateObj.getUTCFullYear(),
            pad(dateObj.getUTCMonth() + 1),
            pad(dateObj.getUTCDate()),
            'T',
            pad(dateObj.getUTCHours()),
            pad(dateObj.getUTCMinutes()),
            pad(dateObj.getUTCSeconds()),
            'Z' // Indica UTC
        ].join('');
    };

    const dtstart = formatDateForICS(startDateTime);
    const dtend = formatDateForICS(endDateTime);

    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//AGROPEC 2025//NONSGML v1.0//EN
BEGIN:VEVENT
UID:${Date.now()}@agropec2025.com
DTSTAMP:${formatDateForICS(new Date())}
DTSTART:${dtstart}
DTEND:${dtend}
SUMMARY:${title}
DESCRIPTION:${description}
LOCATION:${location}
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, '_')}.ics`; // Nome do arquivo seguro
    document.body.appendChild(a);
    a.click(); // Simula um clique para iniciar o download/abertura
    document.body.removeChild(a);
    URL.revokeObjectURL(url); // Limpa a URL do objeto após o uso
    
    alert(`Evento "${title}" preparado para ser adicionado ao seu calendário.`);
}

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
                    const eventCard = document.createElement('div');
                    eventCard.className = 'card p-6';
                    eventCard.innerHTML = `
                        <h4 class="font-semibold text-lg mb-1 text-green-700">${event.title || 'N/A'}</h4>
                        <p class="text-sm text-gray-500 mb-2">${event.type || 'Tipo'} | ${event.date || 'Data'}, ${event.time || 'Hora'} | ${event.location || 'Local'}</p>
                        <p class="text-gray-700 mb-3">${event.description || 'Sem descrição.'}</p>
                        <button class="btn-accent text-sm py-1 px-3 rounded-md add-to-calendar-btn">Adicionar ao Calendário</button>
                    `;
                    // Adiciona o event listener ao botão "Adicionar ao Calendário"
                    const addToCalendarBtn = eventCard.querySelector('.add-to-calendar-btn');
                    if (addToCalendarBtn) {
                        addToCalendarBtn.addEventListener('click', () => addToCalendar(event));
                    }
                    container.appendChild(eventCard);
                });
            }
        }
        updateAgendaChart(globalEventsCache); // Usa o cache global
        displayAdminEventsList(globalEventsCache); // Atualiza lista no painel de organizadores
        // Chama a função para atualizar o card da próxima palestra na tela inicial.
        displayNextUpcomingEvent();
    }, (error) => {
        console.error("Erro ao carregar eventos:", error);
        const container = document.getElementById('agenda-events-container');
        if (container) container.innerHTML = '<p class="text-center text-red-500 col-span-full">Erro ao carregar eventos.</p>';
    });

    //Encontra o próximo evento futuro e atualiza o card na página inicial.
    //Se nenhum evento for encontrado, o card permanece oculto.
    function displayNextUpcomingEvent() {
        const cardEl = document.getElementById('next-event-card');
        const titleEl = document.getElementById('next-event-title');
        const detailsEl = document.getElementById('next-event-details');

        if (!cardEl || !titleEl || !detailsEl) {
            console.error("Elementos do card 'Próximo Evento' não foram encontrados. Verifique os IDs no HTML.");
            return;
        }

        const now = new Date();
        const upcomingEvents = globalEventsCache
            .map(event => {
                if (!event.date || !event.time) return null;
                const [day, month, year] = event.date.split('/');
                const [hours, minutes] = event.time.split(':');
                if (isNaN(day) || isNaN(month) || isNaN(year) || isNaN(hours) || isNaN(minutes)) {
                    return null;
                }
                return { ...event, eventDate: new Date(year, month - 1, day, hours, minutes) };
            })
            .filter(event => event && event.eventDate > now)
            .sort((a, b) => a.eventDate - b.eventDate);

        if (upcomingEvents.length > 0) {
            const nextEvent = upcomingEvents[0];
            
            titleEl.textContent = nextEvent.title;
            detailsEl.textContent = `${nextEvent.date}, ${nextEvent.time} - ${nextEvent.location}`;
            cardEl.style.display = 'block'; // Garante que o card esteja visível
        } else {
            // Se não houver eventos futuros, garante que o card permaneça oculto.
            cardEl.style.display = 'none'; 
        }
    }
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

function displayCollectedData() {
    const displayArea = document.getElementById('registered-stands-display');
    if (!displayArea) return;

    displayArea.innerHTML = ''; // Limpa a lista antes de recriar

    if (stands.length === 0) {
        displayArea.innerHTML = '<p class="text-gray-500">Nenhuma estande cadastrada.</p>';
        return;
    }

    const ul = document.createElement('ul');
    ul.className = 'divide-y divide-gray-200';

    // Ordena as estandes pelo ID para uma visualização mais consistente
    const sortedStands = [...stands].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

    sortedStands.forEach(stand => {
        const li = document.createElement('li');
        li.className = 'py-3 flex justify-between items-center';
        // Adicionamos os botões de Editar e Excluir com data-attributes
        li.innerHTML = `
            <div class="flex-1 min-w-0 pr-2">
                <p class="text-sm font-medium text-green-700 truncate">ID: ${stand.id || 'N/A'}</p>
                <p class="text-sm text-gray-600 truncate">Ocupante: ${stand.occupant || 'N/A'}</p>
                <p class="text-xs text-gray-500 truncate">Coords: (X:${stand.x || 'N/A'}, Y:${stand.y || 'N/A'})</p>
            </div>
            <div class="flex-shrink-0">
                <button class="text-blue-500 hover:text-blue-700 text-sm mr-3 edit-stand-btn" 
                        data-doc-id="${stand.docId}" 
                        data-id="${stand.id}" 
                        data-occupant="${stand.occupant}" 
                        data-x="${stand.x}" 
                        data-y="${stand.y}">Editar</button>
                <button class="text-red-500 hover:text-red-700 text-sm delete-stand-btn" 
                        data-doc-id="${stand.docId}">Excluir</button>
            </div>
        `;
        ul.appendChild(li);
    });
    displayArea.appendChild(ul);
}


// ADICIONE ESTAS DUAS NOVAS FUNÇÕES
/**
 * Preenche o formulário de estande com os dados de um item existente para edição.
 */
function populateStandFormForEdit(button) {
    // Pega os dados armazenados no botão "Editar"
    const docId = button.dataset.docId;
    const id = button.dataset.id;
    const occupant = button.dataset.occupant;
    const x = button.dataset.x;
    const y = button.dataset.y;

    // Preenche os campos do formulário
    document.getElementById('standDocIdToUpdate').value = docId;
    document.getElementById('standId').value = id;
    document.getElementById('standOccupant').value = occupant;
    document.getElementById('standX').value = x;
    document.getElementById('standY').value = y;
    document.getElementById('standCoordinatesDisplay').value = `X: ${x}, Y: ${y}`;

    // Atualiza a UI do formulário para o modo de edição
    document.getElementById('stand-submit-button').textContent = 'Atualizar Localização';
    document.getElementById('stand-cancel-edit-button').classList.remove('hidden');

    // Remove o marcador temporário do mapa, se houver
    adminMapTemporaryMarker = null;
    drawAllMaps();

    // Rola a página para o formulário
    document.getElementById('location-form').scrollIntoView({ behavior: 'smooth' });
}


// Exclui uma estande do Firestore após confirmação.
async function handleDeleteStand(standDocId) {
    if (!window.db || !standDocId) return;

    if (confirm('Tem certeza que deseja excluir esta estande? Esta ação não pode ser desfeita.')) {
        try {
            const standDocRef = doc(window.db, `artifacts/${firebaseConfig.appId}/public/data/locations`, standDocId);
            await deleteDoc(standDocRef);
            // A lista na tela será atualizada automaticamente pelo onSnapshot.
        } catch (error) {
            console.error('Erro ao excluir estande:', error);
            alert('Ocorreu um erro ao excluir a estande.');
        }
    }
}


async function handleSubmitStandForm() {
    if (!currentUserId || !window.db) return;

    const messageEl = document.getElementById('location-message');
    const docIdToUpdate = document.getElementById('standDocIdToUpdate').value;
    const standData = {
        id: document.getElementById('standId').value,
        occupant: document.getElementById('standOccupant').value,
        x: parseInt(document.getElementById('standX').value, 10),
        y: parseInt(document.getElementById('standY').value, 10)
    };

    if (isNaN(standData.x) || isNaN(standData.y)) {
        messageEl.textContent = 'Clique no mapa para obter as coordenadas.';
        messageEl.className = 'text-red-500 text-sm mt-2';
        return;
    }

    try {
        if (docIdToUpdate) {
            // --- LÓGICA DE ATUALIZAÇÃO ---
            const standDocRef = doc(window.db, `artifacts/${firebaseConfig.appId}/public/data/locations`, docIdToUpdate);
            await updateDoc(standDocRef, standData);
            messageEl.textContent = 'Localização atualizada com sucesso!';
        } else {
            // --- LÓGICA DE ADIÇÃO (como antes) ---
            const locationsCollectionRef = collection(window.db, `artifacts/${firebaseConfig.appId}/public/data/locations`);
            await addDoc(locationsCollectionRef, standData);
            messageEl.textContent = 'Localização salva!';
        }
        messageEl.className = 'text-green-600 text-sm mt-2';
        
        // Reseta o formulário para o estado inicial
        document.getElementById('location-form').reset();
        document.getElementById('standDocIdToUpdate').value = '';
        document.getElementById('standCoordinatesDisplay').value = '';
        document.getElementById('stand-submit-button').textContent = 'Salvar Localização';
        document.getElementById('stand-cancel-edit-button').classList.add('hidden');
        
        // Limpa o marcador temporário do mapa
        adminMapTemporaryMarker = null;
        drawAllMaps();

    } catch (error) {
        console.error("Erro ao salvar localização:", error);
        messageEl.textContent = 'Erro ao salvar. Verifique o console.';
        messageEl.className = 'text-red-500 text-sm mt-2';
    }
}


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

    //tipos no SINGULAR para corresponder aos dados do banco.
    const eventTypes = ['Palestra', 'Workshop', 'Demonstração', 'Outro'];
    // Objeto para mapear o tipo singular para o plural (para a legenda do gráfico)
    const typeLabels = {
        'Palestra': 'Palestras',
        'Workshop': 'Workshops',
        'Demonstração': 'Demonstrações',
        'Outro': 'Outros'
    };

    const days = {};
    events.forEach(event => {
        const date = event.date || 'Data Desconhecida';
        if (!days[date]) {
            days[date] = {};
            eventTypes.forEach(t => days[date][t] = 0);
        }
        // Garante que o tipo seja um dos conhecidos, senão vira 'Outro'.
        const eventType = eventTypes.includes(event.type) ? event.type : 'Outro';
        days[date][eventType]++;
    });

    const sortedDates = Object.keys(days).sort((a, b) => {
        if (a === 'Data Desconhecida') return 1;
        if (b === 'Data Desconhecida') return -1;
        const [dayA, monthA, yearA] = a.split('/').map(Number);
        const [dayB, monthB, yearB] = b.split('/').map(Number);
        return new Date(yearA, monthA - 1, dayA) - new Date(yearB, monthB - 1, dayB);
    });

    const datasets = eventTypes.map(type => {
        let bgColor, brdColor;
        // Mantém as cores que você já tinha, mas usando a chave singular 'type'
        switch(type) {
            case 'Palestra':      bgColor = 'rgba(76, 175, 80, 0.7)';  brdColor = 'rgba(76, 175, 80, 1)';   break;
            case 'Workshop':      bgColor = 'rgba(255, 193, 7, 0.7)';  brdColor = 'rgba(255, 193, 7, 1)';   break;
            case 'Demonstração':  bgColor = 'rgba(33, 150, 243, 0.7)'; brdColor = 'rgba(33, 150, 243, 1)';  break;
            default:              bgColor = 'rgba(158, 158, 158, 0.7)';brdColor = 'rgba(158, 158, 158, 1)';
        }
        return {
            label: typeLabels[type], // CORREÇÃO: Usa o nome no plural para a legenda ficar mais bonita
            data: sortedDates.map(date => days[date][type] || 0),
            backgroundColor: bgColor,
            borderColor: brdColor,
            borderWidth: 1
        };
    });

    if (agendaChartInstance) agendaChartInstance.destroy();

    agendaChartInstance = new Chart(agendaCtx, {
        type: 'bar',
        data: { labels: sortedDates, datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { stacked: true }, // Empilha as barras para melhor visualização
                y: { stacked: true, beginAtZero: true }
            },
            plugins: {
                tooltip: {
                    mode: 'index'
                }
            }
        }
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
                    const eventCard = document.createElement('div');
                    eventCard.className = 'card p-6';
                    eventCard.innerHTML = `
                        <h4 class="font-semibold text-lg mb-1 text-green-700">${event.title || 'N/A'}</h4>
                        <p class="text-sm text-gray-500 mb-2">${event.type || 'Tipo'} | ${event.date || 'Data'}, ${event.time || 'Hora'} | ${event.location || 'Local'}</p>
                        <p class="text-gray-700 mb-3">${event.description || 'Sem descrição.'}</p>
                        <button class="btn-accent text-sm py-1 px-3 rounded-md add-to-calendar-btn">Adicionar ao Calendário</button>
                    `;
                    // Adiciona o event listener ao botão "Adicionar ao Calendário"
                    const addToCalendarBtn = eventCard.querySelector('.add-to-calendar-btn');
                    if (addToCalendarBtn) {
                        addToCalendarBtn.addEventListener('click', () => addToCalendar(event));
                    }
                    container.appendChild(eventCard);
                });
            }
        }
        updateAgendaChart(filteredEvents);
    });

    // Busca dinâmica de expositores
    const searchExpositorInput = document.getElementById('searchExpositor');
    if (searchExpositorInput) {
        searchExpositorInput.addEventListener('input', function () {
            const termo = this.value.trim().toLowerCase();
            const container = document.getElementById('expositores-container');
            if (!container) return;

            // Usa o cache global já carregado
            let filtrados = globalExpositorsCache;

            if (termo) {
                filtrados = globalExpositorsCache.filter(expo =>
                    (expo.name && expo.name.toLowerCase().includes(termo)) ||
                    (expo.category && expo.category.toLowerCase().includes(termo)) ||
                    (expo.description && expo.description.toLowerCase().includes(termo))
                );
            }

            container.innerHTML = '';
            if (filtrados.length === 0) {
                container.innerHTML = '<p class="text-gray-500 col-span-full">Nenhum expositor encontrado.</p>';
            } else {
                filtrados.forEach(expositor => {
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
        });
    }
}


//Estandes
// 1. Carrega estandes do Firestore
async function loadStands() {
  if (!window.db) return;
  const snapshot = await getDocs(collection(window.db, `artifacts/${firebaseConfig.appId}/public/data/stands`));
  stands = [];
  snapshot.forEach(doc => {
    stands.push({ id: doc.id, ...doc.data() });
  });
  renderStandsList(stands);
}

// 2. Exibe os estandes com botão "Excluir"
function renderStandsList(stands) {
  const container = document.getElementById('registered-stands-display');
  container.innerHTML = '';
  if (stands.length === 0) {
    container.innerHTML = '<p>Nenhuma estande cadastrada ainda.</p>';
    return;
  }
  stands.forEach(stand => {
    const div = document.createElement('div');
    div.className = 'p-3 border rounded-md bg-gray-50 flex justify-between items-center';
    div.innerHTML = `
      <div>
        <strong>${stand.id}</strong> - ${stand.occupant}
      </div>
      <button class="text-red-500 hover:text-red-700 text-sm" onclick="deleteStand('${stand.id}')">Excluir</button>
    `;
    container.appendChild(div);
  });
}

// 3. Exclui estande do Firestore
async function deleteStand(standId) {
  if (!window.db || !standId) return;
  if (confirm('Tem certeza que deseja excluir esta estande?')) {
    try {
      const standRef = doc(window.db, `artifacts/${firebaseConfig.appId}/public/data/stands`, standId);
      await deleteDoc(standRef);
      alert('Estande excluída com sucesso!');
      loadStands(); // Recarrega lista
    } catch (error) {
      console.error('Erro ao excluir estande:', error);
      alert('Erro ao excluir estande.');
    }
  }
}

// funçao de carregar estandes
     loadStands();

// Atualiza o ano no rodapé
document.getElementById('footer-year').textContent = new Date().getFullYear();

