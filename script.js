// ========== CONFIGURAÇÕES ==========
const CONFIG = {
    gridSize: 24,
    cellSize: 2.71, // 65mm / 24 = 2.708mm por célula (escala real!)
    beadRadius: 1.25, // Raio do bead em escala real
    holeRadius: 0.35, // Furinho em escala real
    colors: [
        // Linha 1 - Básicas
        '#FFFFFF', // 01 Branco
        '#000000', // 18 Preto
        '#E60013', // 05 Vermelho
        '#F9B231', // 03 Amarelo

        // Linha 2 - Primárias e secundárias
        '#0B8FE6', // 09 Azul
        '#1CAC78', // 10 Verde
        '#FF7F00', // 04 Laranja
        '#8B1C8E', // 07 Roxo

        // Linha 3 - Variações
        '#FFB3D7', // 06 Rosa
        '#DA2A39', // 29 Vermelho Escuro
        '#2B3694', // 08 Azul Escuro
        '#0D8552', // 47 Verde Escuro

        // Linha 4 - Tons pastéis
        '#FFCCD2', // 48 Rosa Claro
        '#B7E3F6', // 31 Azul Claro
        '#C7E5D0', // 11 Verde Claro
        '#FFF3AA', // 43 Amarelo Claro

        // Linha 5 - Tons terrosos
        '#A87C5D', // 27 Bege
        '#6B3F2A', // 12 Marrom
        '#8B8680', // 17 Cinza
        '#D3D3D3', // 71 Cinza Claro

        // Linha 6 - Especiais
        '#FF69B4', // 26 Rosa Neon
        '#4ECDC4', // 49 Turquesa
        '#FFD700', // 83 Dourado
        '#C0C0C0', // 62 Prata
    ]
};

// ========== ESTADO DA APLICAÇÃO ==========
const state = {
    grid: Array(CONFIG.gridSize).fill(null).map(() => Array(CONFIG.gridSize).fill(null)),
    selectedColor: CONFIG.colors[0],
    isEraser: false
};

// ========== ELEMENTOS DO DOM ==========
const canvas = document.getElementById('beadsCanvas');
const ctx = canvas.getContext('2d');
const colorPalette = document.getElementById('colorPalette');
const toolIndicator = document.getElementById('toolIndicator');
const toolLabel = document.getElementById('toolLabel');
const eraserBtn = document.getElementById('eraserBtn');
const clearBtn = document.getElementById('clearBtn');
const exportBtn = document.getElementById('exportBtn');
const saveBtn = document.getElementById('saveBtn');
const loadBtn = document.getElementById('loadBtn');
const loadInput = document.getElementById('loadInput');
const saveLocalBtn = document.getElementById('saveLocalBtn');
const projectsBtn = document.getElementById('projectsBtn');

saveLocalBtn.onclick = openSaveLocalModal;
projectsBtn.onclick = openProjectsModal;
function openSaveLocalModal() {
    openModal('Salvar Projeto', `
        <input id="projectNameInput" placeholder="Nome do projeto">
        <button id="confirmSaveLocal">Salvar</button>
    `);

    document.getElementById('confirmSaveLocal').onclick = () => {
        const name = document.getElementById('projectNameInput').value.trim();
        if (!name) return alert('Digite um nome');

        const projects = getProjects();

        projects[name] = {
            grid: state.grid,
            gridSize: CONFIG.gridSize,
            savedAt: Date.now()
        };

        setProjects(projects);
        closeModal();
    };
}
function openProjectsModal() {
    const projects = getProjects();
    const names = Object.keys(projects);

    if (!names.length) {
        openModal('Projetos', `<p>Nenhum projeto salvo.</p>`);
        return;
    }

    const listHtml = names.map(n =>
        `<div class="project-item" data-name="${n}">${n}</div>`
    ).join('');

    openModal('Projetos', `
        <div id="projectsList">${listHtml}</div>

        <div class="modal-actions">
            <button id="loadSelectedBtn" disabled>Carregar</button>
            <button id="deleteSelectedBtn" disabled>Excluir</button>
        </div>
    `);

    let selected = null;

    document.querySelectorAll('.project-item').forEach(el => {
        el.onclick = () => {
            document.querySelectorAll('.project-item')
                .forEach(x => x.classList.remove('selected'));

            el.classList.add('selected');
            selected = el.dataset.name;

            document.getElementById('loadSelectedBtn').disabled = false;
            document.getElementById('deleteSelectedBtn').disabled = false;
        };
    });

    // carregar
    document.getElementById('loadSelectedBtn').onclick = () => {
        if (!selected) return;

        const data = getProjects()[selected];
        state.grid = data.grid;
        drawGrid();
        closeModal();
    };

    // excluir
    document.getElementById('deleteSelectedBtn').onclick = () => {
        if (!selected) return;

        if (!confirm(`Excluir projeto "${selected}"?`)) return;

        const p = getProjects();
        delete p[selected];
        setProjects(p);

        // reabrir lista atualizada
        openProjectsModal();
    };
}


// ========== INICIALIZAÇÃO ==========
function init() {
    // Distância do primeiro ao último furo (centro a centro) = 6.5cm
    // São 24 furos, então há 23 espaços entre eles
    // 65mm / 23 espaços = 2.826mm por espaço
    const mmToPixels = 3.7795;
    const spaceBetweenHoles = 65 / 23; // 2.826mm
    const totalGridSize = spaceBetweenHoles * 23; // distância total entre primeiro e último
    const padding = spaceBetweenHoles; // margem ao redor

    CONFIG.cellSize = spaceBetweenHoles;

    canvas.width = (totalGridSize + padding * 2) * mmToPixels;
    canvas.height = (totalGridSize + padding * 2) * mmToPixels;

    // RESTAURAR ESTADO SE VIER DE UM SAVE (proteção contra refresh)
    console.log('Verificando se há estado para restaurar...');
    const tempState = localStorage.getItem('beads_temp_state');
    console.log('Estado encontrado:', tempState);

    if (tempState) {
        try {
            const savedState = JSON.parse(tempState);
            console.log('Estado parseado:', savedState);
            console.log('Tempo desde save:', Date.now() - savedState.savedAt, 'ms');

            // Só restaura se foi salvo há menos de 5 segundos (indicando refresh recente)
            if (Date.now() - savedState.savedAt < 5000) {
                console.log('Restaurando estado...');
                state.grid = savedState.grid;
                state.selectedColor = savedState.selectedColor;
                state.isEraser = savedState.isEraser;
                console.log('Estado restaurado com sucesso!');
            } else {
                console.log('Estado muito antigo, ignorando');
            }
            localStorage.removeItem('beads_temp_state');
        } catch (e) {
            console.error('Erro ao restaurar estado:', e);
        }
    } else {
        console.log('Nenhum estado para restaurar');
    }

    // Criar paleta de cores
    CONFIG.colors.forEach((color, index) => {
        const btn = document.createElement('div');
        btn.className = 'color-btn';
        btn.style.backgroundColor = color;
        btn.setAttribute('role', 'radio');
        btn.setAttribute('aria-label', `Cor ${index + 1}`);
        btn.setAttribute('aria-checked', index === 0 ? 'true' : 'false');
        btn.setAttribute('tabindex', index === 0 ? '0' : '-1');
        if (index === 0) btn.classList.add('selected');
        btn.onclick = () => selectColor(color);
        colorPalette.appendChild(btn);
    });

    // Adicionar event listeners para os botões
    eraserBtn.addEventListener('click', selectEraser);
    clearBtn.addEventListener('click', clearAll);
    exportBtn.addEventListener('click', exportPreview);
    saveBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        e.stopPropagation();
        console.log('CLICK SAVE — bloqueado tudo');
        saveProject(null);
        return false;
    });
    loadBtn.addEventListener('click', () => loadInput.click());
    loadInput.addEventListener('change', loadProject);

    // Desenhar gabarito inicial
    drawGrid();
    updateToolIndicator();

    // Atualizar UI se estado foi restaurado
    if (tempState) {
        if (state.isEraser) {
            selectEraser();
        } else {
            selectColor(state.selectedColor);
        }
    }
}

// ========== DESENHO ==========
function drawGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const mmToPixels = 3.7795;
    const cellSizePx = CONFIG.cellSize * mmToPixels;
    const paddingPx = cellSizePx; // margem

    // Desenhar gabarito (pinos)
    ctx.fillStyle = '#666666';
    for (let row = 0; row < CONFIG.gridSize; row++) {
        for (let col = 0; col < CONFIG.gridSize; col++) {
            const x = paddingPx + col * cellSizePx;
            const y = paddingPx + row * cellSizePx;

            // Desenhar pino
            ctx.beginPath();
            ctx.arc(x, y, 0.2 * mmToPixels, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Desenhar beads
    for (let row = 0; row < CONFIG.gridSize; row++) {
        for (let col = 0; col < CONFIG.gridSize; col++) {
            if (state.grid[row][col]) {
                drawBead(row, col, state.grid[row][col]);
            }
        }
    }
}

function drawBead(row, col, color) {
    const mmToPixels = 3.7795;
    const cellSizePx = CONFIG.cellSize * mmToPixels;
    const paddingPx = cellSizePx;
    const x = paddingPx + col * cellSizePx;
    const y = paddingPx + row * cellSizePx;

    // Desenhar bead (círculo colorido)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, CONFIG.beadRadius * mmToPixels, 0, Math.PI * 2);
    ctx.fill();

    // Adicionar borda para dar profundidade
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 0.1 * mmToPixels;
    ctx.stroke();

    // Adicionar brilho
    const gradient = ctx.createRadialGradient(
        x - 0.3 * mmToPixels, y - 0.3 * mmToPixels, 0,
        x, y, CONFIG.beadRadius * mmToPixels
    );
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Desenhar furinho no meio (branco/transparente)
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(x, y, CONFIG.holeRadius * mmToPixels, 0, Math.PI * 2);
    ctx.fill();

    // Borda do furinho
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 0.05 * mmToPixels;
    ctx.stroke();
}

// ========== INTERAÇÃO ==========
function handleCanvasInteraction(e) {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();

    // Suporte tanto para mouse quanto para touch
    let clientX, clientY;
    if (e.type.startsWith('touch')) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const mmToPixels = 3.7795;
    const cellSizePx = CONFIG.cellSize * mmToPixels;
    const paddingPx = cellSizePx;

    // Encontrar o pino mais próximo (arredondando ao invés de usar floor)
    const col = Math.round((x - paddingPx) / cellSizePx);
    const row = Math.round((y - paddingPx) / cellSizePx);

    if (row >= 0 && row < CONFIG.gridSize && col >= 0 && col < CONFIG.gridSize) {
        if (state.isEraser) {
            state.grid[row][col] = null;
        } else {
            // Se já existe um bead com a mesma cor, remove (toggle)
            if (state.grid[row][col] === state.selectedColor) {
                state.grid[row][col] = null;
            } else {
                state.grid[row][col] = state.selectedColor;
            }
        }
        drawGrid();
    }
}

canvas.addEventListener('click', handleCanvasInteraction);
canvas.addEventListener('touchstart', handleCanvasInteraction, { passive: false });

// ========== SELEÇÃO DE FERRAMENTAS ==========
function selectColor(color) {
    state.selectedColor = color;
    state.isEraser = false;

    // Atualizar UI
    document.querySelectorAll('.color-btn').forEach(btn => {
        btn.classList.remove('selected');
        btn.setAttribute('aria-checked', 'false');
        btn.setAttribute('tabindex', '-1');
        if (btn.style.backgroundColor === color ||
            rgbToHex(btn.style.backgroundColor) === color) {
            btn.classList.add('selected');
            btn.setAttribute('aria-checked', 'true');
            btn.setAttribute('tabindex', '0');
        }
    });
    eraserBtn.classList.remove('selected');
    eraserBtn.setAttribute('aria-checked', 'false');
    updateToolIndicator();
}

function selectEraser() {
    state.isEraser = true;

    // Atualizar UI
    document.querySelectorAll('.color-btn').forEach(btn => {
        btn.classList.remove('selected');
        btn.setAttribute('aria-checked', 'false');
        btn.setAttribute('tabindex', '-1');
    });
    eraserBtn.classList.add('selected');
    eraserBtn.setAttribute('aria-checked', 'true');
    updateToolIndicator();
}

function updateToolIndicator() {
    if (state.isEraser) {
        toolIndicator.className = 'tool-indicator eraser';
        toolLabel.textContent = 'Borracha';
    } else {
        toolIndicator.className = 'tool-indicator';
        toolIndicator.style.backgroundColor = state.selectedColor;
        toolLabel.textContent = 'Cor Selecionada';
    }
}

// ========== FUNÇÕES AUXILIARES ==========
function clearAll() {
    if (confirm('Tem certeza que deseja apagar todos os beads?')) {
        state.grid = Array(CONFIG.gridSize).fill(null).map(() => Array(CONFIG.gridSize).fill(null));
        drawGrid();
    }
}

function exportPreview() {
    // Criar canvas temporário para preview
    const previewCanvas = document.createElement('canvas');
    const previewCtx = previewCanvas.getContext('2d');

    const mmToPixels = 3.7795;
    const cellSizePx = CONFIG.cellSize * mmToPixels;
    const paddingPx = cellSizePx;
    const totalGridSize = CONFIG.cellSize * 23; // distância do primeiro ao último

    previewCanvas.width = (totalGridSize + paddingPx * 2) * mmToPixels;
    previewCanvas.height = (totalGridSize + paddingPx * 2) * mmToPixels;

    // Fundo branco
    previewCtx.fillStyle = 'white';
    previewCtx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);

    // Desenhar apenas os beads (sem gabarito)
    for (let row = 0; row < CONFIG.gridSize; row++) {
        for (let col = 0; col < CONFIG.gridSize; col++) {
            if (state.grid[row][col]) {
                const x = paddingPx * mmToPixels + col * cellSizePx;
                const y = paddingPx * mmToPixels + row * cellSizePx;
                const color = state.grid[row][col];

                // Desenhar bead
                previewCtx.fillStyle = color;
                previewCtx.beginPath();
                previewCtx.arc(x, y, CONFIG.beadRadius * mmToPixels, 0, Math.PI * 2);
                previewCtx.fill();

                // Borda
                previewCtx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
                previewCtx.lineWidth = 0.1 * mmToPixels;
                previewCtx.stroke();

                // Brilho
                const gradient = previewCtx.createRadialGradient(
                    x - 0.3 * mmToPixels, y - 0.3 * mmToPixels, 0,
                    x, y, CONFIG.beadRadius * mmToPixels
                );
                gradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
                gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
                previewCtx.fillStyle = gradient;
                previewCtx.fill();

                // Furinho
                previewCtx.fillStyle = 'white';
                previewCtx.beginPath();
                previewCtx.arc(x, y, CONFIG.holeRadius * mmToPixels, 0, Math.PI * 2);
                previewCtx.fill();

                previewCtx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
                previewCtx.lineWidth = 0.05 * mmToPixels;
                previewCtx.stroke();
            }
        }
    }

    // Download da imagem
    const link = document.createElement('a');
    link.download = `beads-preview-${Date.now()}.png`;
    link.href = previewCanvas.toDataURL();
    link.click();
}

function rgbToHex(rgb) {
    if (rgb.startsWith('#')) return rgb;
    const matches = rgb.match(/\d+/g);
    if (!matches) return rgb;
    return '#' + matches.map(x => {
        const hex = parseInt(x).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('').toUpperCase();
}

// ========== SAVE/LOAD PROJECT ==========
function saveProject(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }

    try {
        // checkpoint anti-perda
        const currentState = {
            grid: state.grid,
            selectedColor: state.selectedColor,
            isEraser: state.isEraser,
            savedAt: Date.now()
        };
        localStorage.setItem('beads_temp_state', JSON.stringify(currentState));

        const projectData = {
            version: '1.0',
            gridSize: CONFIG.gridSize,
            grid: JSON.parse(JSON.stringify(state.grid)),
            timestamp: new Date().toISOString()
        };

        const json = JSON.stringify(projectData, null, 2);

        // 👉 método robusto
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `beads-project-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();

        // limpeza
        setTimeout(() => {
            URL.revokeObjectURL(url);
            a.remove();
            localStorage.removeItem('beads_temp_state');
        }, 1000);

    } catch (err) {
        console.error('Erro ao salvar:', err);
    }

    return false;
}


function loadProject(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!confirm('Tem certeza que deseja abrir este arquivo? O conteúdo atual será perdido.')) {
        e.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const projectData = JSON.parse(event.target.result);

            // Validar dados
            if (!projectData.grid || !Array.isArray(projectData.grid)) {
                throw new Error('Formato de arquivo inválido');
            }

            // Carregar grid
            state.grid = projectData.grid;
            drawGrid();
        } catch (error) {
            alert('Erro ao carregar arquivo: ' + error.message);
        }

        e.target.value = '';
    };

    reader.readAsText(file);
}

// ========== INICIAR APLICAÇÃO ==========
init();

// ========== PWA SERVICE WORKER ==========
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('ServiceWorker registrado com sucesso:', registration.scope);
            })
            .catch((error) => {
                console.log('Falha ao registrar ServiceWorker:', error);
            });
    });
}

window.addEventListener('beforeunload', (e) => {
    console.log('⚠️ beforeunload disparado');
});
const modalOverlay = document.getElementById('modalOverlay');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');
const modalClose = document.getElementById('modalClose');

function openModal(title, html) {
    modalTitle.textContent = title;
    modalBody.innerHTML = html;
    modalOverlay.classList.remove('hidden');
}

function closeModal() {
    modalOverlay.classList.add('hidden');
}

modalClose.onclick = closeModal;
modalOverlay.onclick = (e) => {
    if (e.target === modalOverlay) closeModal();
};


function getProjects() {
    return JSON.parse(localStorage.getItem('beads_projects') || '{}');
}

function setProjects(obj) {
    localStorage.setItem('beads_projects', JSON.stringify(obj));
}