// ========== CONFIGURAÇÕES ==========
const CONFIG = {
    gridSize: 24,
    cellSize: 2.71,
    beadRadius: 1.25,
    holeRadius: 0.35,
    colors: [
        '#FFFFFF', '#000000', '#E60013', '#F9B231',
        '#0B8FE6', '#1CAC78', '#FF7F00', '#8B1C8E',
        '#FFB3D7', '#DA2A39', '#2B3694', '#0D8552',
        '#FFCCD2', '#B7E3F6', '#C7E5D0', '#FFF3AA',
        '#A87C5D', '#6B3F2A', '#8B8680', '#D3D3D3',
        '#FF69B4', '#4ECDC4', '#FFD700', '#C0C0C0',
    ]
};

// ========== ESTADO DA APLICAÇÃO ==========
const state = {
    grid: Array(CONFIG.gridSize).fill(null).map(() => Array(CONFIG.gridSize).fill(null)),
    selectedColor: CONFIG.colors[0],
    tool: 'pencil',   // 'pencil' | 'eraser' | 'fill'
    meltedView: false,
    isDrawing: false,  // para drag drawing
    lastCell: null,    // última célula tocada no drag

    // Undo/Redo
    undoStack: [],
    redoStack: [],
};

// ========== ELEMENTOS DO DOM ==========
const canvas        = document.getElementById('beadsCanvas');
const ctx           = canvas.getContext('2d');
const colorPalette  = document.getElementById('colorPalette');
const toolIndicator = document.getElementById('toolIndicator');
const toolLabel     = document.getElementById('toolLabel');
const eraserBtn     = document.getElementById('eraserBtn');
const pencilBtn     = document.getElementById('pencilBtn');
const fillBtn       = document.getElementById('fillBtn');
const undoBtn       = document.getElementById('undoBtn');
const redoBtn       = document.getElementById('redoBtn');
const meltBtn       = document.getElementById('meltBtn');
const clearBtn      = document.getElementById('clearBtn');
const exportBtn     = document.getElementById('exportBtn');
const saveBtn       = document.getElementById('saveBtn');
const loadBtn       = document.getElementById('loadBtn');
const loadInput     = document.getElementById('loadInput');
const saveLocalBtn  = document.getElementById('saveLocalBtn');
const projectsBtn   = document.getElementById('projectsBtn');

// ========== UNDO / REDO ==========
function saveSnapshot() {
    state.undoStack.push(JSON.stringify(state.grid));
    if (state.undoStack.length > 50) state.undoStack.shift(); // limitar a 50 passos
    state.redoStack = []; // limpa redo ao fazer nova ação
    updateUndoRedoBtns();
}

function undo() {
    if (!state.undoStack.length) return;
    state.redoStack.push(JSON.stringify(state.grid));
    state.grid = JSON.parse(state.undoStack.pop());
    updateUndoRedoBtns();
    drawGrid();
}

function redo() {
    if (!state.redoStack.length) return;
    state.undoStack.push(JSON.stringify(state.grid));
    state.grid = JSON.parse(state.redoStack.pop());
    updateUndoRedoBtns();
    drawGrid();
}

function updateUndoRedoBtns() {
    undoBtn.disabled = state.undoStack.length === 0;
    redoBtn.disabled = state.redoStack.length === 0;
    undoBtn.style.opacity = undoBtn.disabled ? '0.4' : '1';
    redoBtn.style.opacity = redoBtn.disabled ? '0.4' : '1';
}

// ========== FILL (balde) ==========
function floodFill(startRow, startCol, fillColor) {
    const targetColor = state.grid[startRow][startCol];

    // Não faz nada se já tem a mesma cor
    if (targetColor === fillColor) return;

    saveSnapshot();

    const queue = [[startRow, startCol]];
    const visited = Array(CONFIG.gridSize).fill(null).map(() => Array(CONFIG.gridSize).fill(false));
    visited[startRow][startCol] = true;

    while (queue.length) {
        const [r, c] = queue.shift();
        state.grid[r][c] = fillColor;

        const neighbors = [[r-1,c],[r+1,c],[r,c-1],[r,c+1]];
        for (const [nr, nc] of neighbors) {
            if (
                nr >= 0 && nr < CONFIG.gridSize &&
                nc >= 0 && nc < CONFIG.gridSize &&
                !visited[nr][nc] &&
                state.grid[nr][nc] === targetColor
            ) {
                visited[nr][nc] = true;
                queue.push([nr, nc]);
            }
        }
    }

    drawGrid();
}

// ========== INICIALIZAÇÃO ==========
function init() {
    const mmToPixels = 3.7795;
    const spaceBetweenHoles = 65 / 23;
    const totalGridSize = spaceBetweenHoles * 23;
    const padding = spaceBetweenHoles;

    CONFIG.cellSize = spaceBetweenHoles;

    canvas.width  = (totalGridSize + padding * 2) * mmToPixels;
    canvas.height = (totalGridSize + padding * 2) * mmToPixels;

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

    // Ferramentas
    pencilBtn.addEventListener('click', () => selectTool('pencil'));
    eraserBtn.addEventListener('click', () => selectTool('eraser'));
    fillBtn.addEventListener('click',   () => selectTool('fill'));

    // Undo / Redo
    undoBtn.addEventListener('click', undo);
    redoBtn.addEventListener('click', redo);
    updateUndoRedoBtns();

    // Toggle melted
    meltBtn.addEventListener('click', toggleMeltedView);

    // Outros botões
    clearBtn.addEventListener('click', clearAll);
    exportBtn.addEventListener('click', exportPreview);
    saveBtn.addEventListener('click', saveProject);
    loadBtn.addEventListener('click', () => loadInput.click());
    loadInput.addEventListener('change', loadProject);
    saveLocalBtn.onclick = openSaveLocalModal;
    projectsBtn.onclick  = openProjectsModal;

    // Canvas — mouse
    canvas.addEventListener('mousedown',  onCanvasMouseDown);
    canvas.addEventListener('mousemove',  onCanvasMouseMove);
    canvas.addEventListener('mouseup',    onCanvasMouseUp);
    canvas.addEventListener('mouseleave', onCanvasMouseUp);

    // Canvas — touch
    canvas.addEventListener('touchstart', onCanvasTouchStart, { passive: false });
    canvas.addEventListener('touchmove',  onCanvasTouchMove,  { passive: false });
    canvas.addEventListener('touchend',   onCanvasMouseUp);

    selectTool('pencil');
    drawGrid();
}

// ========== DESENHO ==========
function drawGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const mmToPixels = 3.7795;
    const cellSizePx = CONFIG.cellSize * mmToPixels;
    const paddingPx  = cellSizePx;

    // Pinos do gabarito (só no modo normal)
    if (!state.meltedView) {
        ctx.fillStyle = '#666666';
        for (let row = 0; row < CONFIG.gridSize; row++) {
            for (let col = 0; col < CONFIG.gridSize; col++) {
                const x = paddingPx + col * cellSizePx;
                const y = paddingPx + row * cellSizePx;
                ctx.beginPath();
                ctx.arc(x, y, 0.2 * mmToPixels, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    // Beads
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
    const paddingPx  = cellSizePx;
    const x = paddingPx + col * cellSizePx;
    const y = paddingPx + row * cellSizePx;
    const r = CONFIG.beadRadius * mmToPixels;

    if (state.meltedView) {
        const left   = Math.floor(paddingPx + col * cellSizePx - cellSizePx / 2);
        const top    = Math.floor(paddingPx + row * cellSizePx - cellSizePx / 2);
        const right  = Math.ceil(paddingPx  + col * cellSizePx + cellSizePx / 2);
        const bottom = Math.ceil(paddingPx  + row * cellSizePx + cellSizePx / 2);
        ctx.fillStyle = color;
        ctx.fillRect(left, top, right - left, bottom - top);
    } else {
        // ── Modo normal: círculo com furinho ──
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 0.1 * mmToPixels;
        ctx.stroke();

        // Brilho
        const gradient = ctx.createRadialGradient(x - 0.3 * mmToPixels, y - 0.3 * mmToPixels, 0, x, y, r);
        gradient.addColorStop(0, 'rgba(255,255,255,0.4)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gradient;
        ctx.fill();

        // Furinho
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(x, y, CONFIG.holeRadius * mmToPixels, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 0.05 * mmToPixels;
        ctx.stroke();
    }
}

// ========== INTERAÇÃO MOUSE ==========
function getCellFromEvent(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const mmToPixels = 3.7795;
    const cellSizePx = CONFIG.cellSize * mmToPixels;
    const paddingPx  = cellSizePx;

    const col = Math.round((x - paddingPx) / cellSizePx);
    const row = Math.round((y - paddingPx) / cellSizePx);

    if (row >= 0 && row < CONFIG.gridSize && col >= 0 && col < CONFIG.gridSize) {
        return { row, col };
    }
    return null;
}

function applyTool(row, col, isFirstClick = false) {
    if (state.tool === 'fill') {
        if (isFirstClick) floodFill(row, col, state.selectedColor);
        return;
    }

    const cellKey = `${row},${col}`;
    if (!isFirstClick && state.lastCell === cellKey) return; // evitar redesenhar o mesmo cell
    state.lastCell = cellKey;

    if (state.tool === 'eraser') {
        if (state.grid[row][col] !== null) {
            if (isFirstClick) saveSnapshot();
            state.grid[row][col] = null;
            drawGrid();
        }
    } else {
        // pencil — toggle só no primeiro clique, drag sempre pinta
        if (isFirstClick && state.grid[row][col] === state.selectedColor) {
            saveSnapshot();
            state.grid[row][col] = null;
        } else if (state.grid[row][col] !== state.selectedColor) {
            if (isFirstClick) saveSnapshot();
            state.grid[row][col] = state.selectedColor;
        } else {
            return;
        }
        drawGrid();
    }
}

function onCanvasMouseDown(e) {
    e.preventDefault();
    state.isDrawing = true;
    state.lastCell  = null;
    const cell = getCellFromEvent(e.clientX, e.clientY);
    if (cell) applyTool(cell.row, cell.col, true);
}

function onCanvasMouseMove(e) {
    if (!state.isDrawing || state.tool === 'fill') return;
    e.preventDefault();
    const cell = getCellFromEvent(e.clientX, e.clientY);
    if (cell) applyTool(cell.row, cell.col, false);
}

function onCanvasMouseUp() {
    state.isDrawing = false;
    state.lastCell  = null;
}

function onCanvasTouchStart(e) {
    e.preventDefault();
    state.isDrawing = true;
    state.lastCell  = null;
    const t = e.touches[0];
    const cell = getCellFromEvent(t.clientX, t.clientY);
    if (cell) applyTool(cell.row, cell.col, true);
}

function onCanvasTouchMove(e) {
    if (!state.isDrawing || state.tool === 'fill') return;
    e.preventDefault();
    const t = e.touches[0];
    const cell = getCellFromEvent(t.clientX, t.clientY);
    if (cell) applyTool(cell.row, cell.col, false);
}

// ========== SELEÇÃO DE FERRAMENTAS ==========
function selectTool(tool) {
    state.tool = tool;
    state.isEraser = (tool === 'eraser');

    // Reset visual de todos os botões de ferramenta
    [pencilBtn, eraserBtn, fillBtn].forEach(btn => btn.classList.remove('selected'));
    eraserBtn.classList.remove('selected');

    if (tool === 'pencil') pencilBtn.classList.add('selected');
    if (tool === 'eraser') eraserBtn.classList.add('selected');
    if (tool === 'fill')   fillBtn.classList.add('selected');

    updateToolIndicator();
}

function selectColor(color) {
    state.selectedColor = color;
    if (state.tool === 'eraser') selectTool('pencil'); // voltar pra lápis ao escolher cor

    document.querySelectorAll('.color-btn').forEach(btn => {
        const isSelected = btn.style.backgroundColor === color ||
            rgbToHex(btn.style.backgroundColor) === color;
        btn.classList.toggle('selected', isSelected);
        btn.setAttribute('aria-checked', isSelected ? 'true' : 'false');
        btn.setAttribute('tabindex', isSelected ? '0' : '-1');
    });

    updateToolIndicator();
}

function updateToolIndicator() {
    if (state.tool === 'eraser') {
        toolIndicator.className = 'tool-indicator eraser';
        toolLabel.textContent = 'Borracha';
    } else if (state.tool === 'fill') {
        toolIndicator.className = 'tool-indicator';
        toolIndicator.style.backgroundColor = state.selectedColor;
        toolLabel.textContent = 'Balde (Fill)';
    } else {
        toolIndicator.className = 'tool-indicator';
        toolIndicator.style.backgroundColor = state.selectedColor;
        toolLabel.textContent = 'Lápis';
    }
}

// ========== TOGGLE MELTED ==========
function toggleMeltedView() {
    state.meltedView = !state.meltedView;
    meltBtn.classList.toggle('selected', state.meltedView);
    meltBtn.textContent = state.meltedView ? '🔵 Modo Normal' : '🔥 Ver Derretido';
    drawGrid();
}

// ========== FUNÇÕES AUXILIARES ==========
function clearAll() {
    if (confirm('Tem certeza que deseja apagar todos os beads?')) {
        saveSnapshot();
        state.grid = Array(CONFIG.gridSize).fill(null).map(() => Array(CONFIG.gridSize).fill(null));
        drawGrid();
    }
}

function rgbToHex(rgb) {
    if (!rgb || rgb.startsWith('#')) return rgb || '';
    const matches = rgb.match(/\d+/g);
    if (!matches) return rgb;
    return '#' + matches.map(x => parseInt(x).toString(16).padStart(2, '0')).join('').toUpperCase();
}

// ========== EXPORT PREVIEW ==========
function exportPreview() {
    const previewCanvas = document.createElement('canvas');
    const previewCtx    = previewCanvas.getContext('2d');

    const mmToPixels   = 3.7795;
    const cellSizePx   = CONFIG.cellSize * mmToPixels;
    const paddingPx    = cellSizePx;
    const totalGridSize = CONFIG.cellSize * 23;

    previewCanvas.width  = (totalGridSize + paddingPx * 2) * mmToPixels;
    previewCanvas.height = (totalGridSize + paddingPx * 2) * mmToPixels;

    previewCtx.fillStyle = 'white';
    previewCtx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);

    // Reutiliza o mesmo visual do drawBead mas no previewCtx
    const savedCtx  = ctx;  // guarda ref
    const savedMelt = state.meltedView;

    // Desenhar no previewCtx usando offscreen
    for (let row = 0; row < CONFIG.gridSize; row++) {
        for (let col = 0; col < CONFIG.gridSize; col++) {
            if (!state.grid[row][col]) continue;
            const color = state.grid[row][col];
            const x = paddingPx * mmToPixels + col * cellSizePx; // já em px
            const y = paddingPx * mmToPixels + row * cellSizePx;
            const r = CONFIG.beadRadius * mmToPixels;

            if (state.meltedView) {
                const left   = Math.floor(paddingPx * mmToPixels + col * cellSizePx - cellSizePx / 2);
                const top    = Math.floor(paddingPx * mmToPixels + row * cellSizePx - cellSizePx / 2);
                const right  = Math.ceil(paddingPx  * mmToPixels + col * cellSizePx + cellSizePx / 2);
                const bottom = Math.ceil(paddingPx  * mmToPixels + row * cellSizePx + cellSizePx / 2);
                previewCtx.fillStyle = color;
                previewCtx.fillRect(left, top, right - left, bottom - top);
            } else {
                previewCtx.fillStyle = color;
                previewCtx.beginPath();
                previewCtx.arc(x, y, r, 0, Math.PI * 2);
                previewCtx.fill();
                previewCtx.strokeStyle = 'rgba(0,0,0,0.3)';
                previewCtx.lineWidth = 0.1 * mmToPixels;
                previewCtx.stroke();
                const grad = previewCtx.createRadialGradient(x - 0.3 * mmToPixels, y - 0.3 * mmToPixels, 0, x, y, r);
                grad.addColorStop(0, 'rgba(255,255,255,0.4)');
                grad.addColorStop(1, 'rgba(255,255,255,0)');
                previewCtx.fillStyle = grad;
                previewCtx.fill();
                previewCtx.fillStyle = 'white';
                previewCtx.beginPath();
                previewCtx.arc(x, y, CONFIG.holeRadius * mmToPixels, 0, Math.PI * 2);
                previewCtx.fill();
                previewCtx.strokeStyle = 'rgba(0,0,0,0.2)';
                previewCtx.lineWidth = 0.05 * mmToPixels;
                previewCtx.stroke();
            }
        }
    }

    const link = document.createElement('a');
    link.download = `beads-preview-${Date.now()}.png`;
    link.href = previewCanvas.toDataURL();
    link.click();
}

// ========== SAVE/LOAD ==========
function saveProject() {
    const projectData = {
        version: '1.0',
        gridSize: CONFIG.gridSize,
        grid: JSON.parse(JSON.stringify(state.grid)),
        timestamp: new Date().toISOString()
    };

    const json = JSON.stringify(projectData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `beads-project-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
}

function loadProject(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!confirm('Tem certeza? O conteúdo atual será perdido.')) {
        e.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const projectData = JSON.parse(event.target.result);
            if (!projectData.grid || !Array.isArray(projectData.grid))
                throw new Error('Formato inválido');
            saveSnapshot();
            state.grid = projectData.grid;
            drawGrid();
        } catch (error) {
            alert('Erro ao carregar: ' + error.message);
        }
        e.target.value = '';
    };
    reader.readAsText(file);
}

// ========== PROJETOS LOCAIS ==========
function getProjects() { return JSON.parse(localStorage.getItem('beads_projects') || '{}'); }
function setProjects(obj) { localStorage.setItem('beads_projects', JSON.stringify(obj)); }

function openSaveLocalModal() {
    openModal('Salvar Projeto', `
        <input id="projectNameInput" placeholder="Nome do projeto">
        <button type="button" id="confirmSaveLocal">Salvar</button>
    `);
    document.getElementById('confirmSaveLocal').onclick = () => {
        const name = document.getElementById('projectNameInput').value.trim();
        if (!name) return alert('Digite um nome');
        const projects = getProjects();
        projects[name] = { grid: state.grid, gridSize: CONFIG.gridSize, savedAt: Date.now() };
        setProjects(projects);
        closeModal();
    };
}

function openProjectsModal() {
    const projects = getProjects();
    const names = Object.keys(projects);

    if (!names.length) {
        openModal('Projetos', '<p>Nenhum projeto salvo.</p>');
        return;
    }

    const listHtml = names.map(n => `<div class="project-item" data-name="${n}">${n}</div>`).join('');
    openModal('Projetos', `
        <div id="projectsList">${listHtml}</div>
        <div class="modal-actions" style="display:flex;gap:10px;margin-top:12px;">
            <button type="button" id="loadSelectedBtn" disabled>Carregar</button>
            <button type="button" id="deleteSelectedBtn" disabled>Excluir</button>
        </div>
    `);

    let selected = null;
    document.querySelectorAll('.project-item').forEach(el => {
        el.onclick = () => {
            document.querySelectorAll('.project-item').forEach(x => x.classList.remove('selected'));
            el.classList.add('selected');
            selected = el.dataset.name;
            document.getElementById('loadSelectedBtn').disabled = false;
            document.getElementById('deleteSelectedBtn').disabled = false;
        };
    });

    document.getElementById('loadSelectedBtn').onclick = () => {
        if (!selected) return;
        const data = getProjects()[selected];
        saveSnapshot();
        state.grid = data.grid;
        drawGrid();
        closeModal();
    };

    document.getElementById('deleteSelectedBtn').onclick = () => {
        if (!selected || !confirm(`Excluir "${selected}"?`)) return;
        const p = getProjects();
        delete p[selected];
        setProjects(p);
        openProjectsModal();
    };
}

// ========== MODAL ==========
const modalOverlay = document.getElementById('modalOverlay');
const modalTitle   = document.getElementById('modalTitle');
const modalBody    = document.getElementById('modalBody');
const modalClose   = document.getElementById('modalClose');

function openModal(title, html) {
    modalTitle.textContent = title;
    modalBody.innerHTML = html;
    modalOverlay.classList.remove('hidden');
}
function closeModal() { modalOverlay.classList.add('hidden'); }
modalClose.onclick = closeModal;
modalOverlay.onclick = (e) => { if (e.target === modalOverlay) closeModal(); };

// ========== PWA ==========
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
}

// ========== START ==========
init();
