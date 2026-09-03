/**
 * Helper class for API calls to cosmic-matrix-back
 */
class FetchManager {
    constructor(baseUrl) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
    }

    async getAllProjects() {
        const res = await fetch(`${this.baseUrl}/api/projects`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return await res.json();
    }

    async upsertProject(project) {
        const res = await fetch(`${this.baseUrl}/api/projects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(project)
        });
        if (!res.ok) throw new Error(`Error en servidor (${res.status})`);
        return await res.json();
    }

    async deleteProject(id) {
        const res = await fetch(`${this.baseUrl}/api/projects/${id}`, {
            method: 'DELETE'
        });
        if (!res.ok) throw new Error(`Error en servidor (${res.status})`);
        return await res.json();
    }

    // --- NUEVAS RUTAS PARA LA BITÁCORA DE AVANCES ---

    async getProjectUpdates(projectId) {
        const res = await fetch(`${this.baseUrl}/api/projects/${projectId}/updates`);
        if (!res.ok) throw new Error(`Error al obtener avances (${res.status})`);
        return await res.json();
    }

    async createProjectUpdate(projectId, updateData) {
        const res = await fetch(`${this.baseUrl}/api/projects/${projectId}/updates`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });
        if (!res.ok) throw new Error(`Error al guardar avance (${res.status})`);
        return await res.json();
    }

    async deleteProjectUpdate(updateId) {
        const res = await fetch(`${this.baseUrl}/api/updates/${updateId}`, {
            method: 'DELETE'
        });
        if (!res.ok) throw new Error(`Error al eliminar avance (${res.status})`);
        return await res.json();
    }
}

class InfrastructureMonitor {
    constructor() {
        this.apiClient = new FetchManager('https://cosmic-matrix-back.vercel.app');
        this.projects = [];
        this.bsCrudModal = null;
        this.bsConfirmModal = null;
        this.bsToast = null;
        this.distributionChart = null;
        this.indexToDelete = null;
        this.bsReportModal = null;

        // Paginación del Slider
        this.currentPage = 0;
        this.itemsPerPage = 8;
        this.activeMiniCharts = [];

        // Estado para la Bitácora de Avances
        this.currentProjectId = null;
        this.currentAttachedFiles = [];
        this.isUploadingFile = false;

        // Configuración Supabase (Reemplaza con tus llaves reales)
        this.supabaseUrl = 'https://tu-proyecto.supabase.co';
        this.supabaseAnonKey = 'tu-anon-key-aqui';
        this.supabaseClient = null;
    }

    /**
     * Inicializa el monitor acoplándolo al ciclo de vida y eventos del DOM
     */
    async init() {
        this.bsCrudModal = new bootstrap.Modal(document.getElementById('crudModal'));
        this.bsConfirmModal = new bootstrap.Modal(document.getElementById('confirmModal'));
        this.bsToast = new bootstrap.Toast(document.getElementById('toastNotification'), { delay: 2500 });
        this.bsReportModal = new bootstrap.Modal(document.getElementById('reportModal'));

        // Inicializar cliente Supabase Storage si la librería CDN está cargada
        if (window.supabase) {
            this.supabaseClient = window.supabase.createClient(this.supabaseUrl, this.supabaseAnonKey);
        }

        const nodeForm = document.getElementById('nodeForm');
        if (nodeForm) {
            nodeForm.onsubmit = (e) => this.handleFormSubmit(e);
        }

        // --- ACTIVACIÓN DEL EFECTO MATRIX DE FONDO ---
        this.initMatrixRain();
        await this.loadProjectsFromRemote();

        // Renderizado Inicial
        this.renderDashboard();

        // Manejador del Resize responsivo para gráficos
        window.addEventListener('resize', () => {
            if (this.distributionChart) this.distributionChart.resize();
            this.activeMiniCharts.forEach(chart => chart.resize());
        });

        // Reloj en tiempo real
        setInterval(() => {
            const clockEl = document.getElementById('system-clock');
            if (clockEl) clockEl.textContent = new Date().toLocaleTimeString();
        }, 1000);
    }

    /**
     * LISTAR: Usa el manager para traer datos de Render / Vercel
     */
    async loadProjectsFromRemote() {
        try {
            console.log("loadProjectsFromRemote ****");
            this.showToast("Mapeando clúster central...");

            this.projects = await this.apiClient.getAllProjects();
            this.renderDashboard();
            this.showToast("Sistema sincronizado con Cosmic_Matrix");
        } catch (err) {
            console.error("Fallo al sincronizar datos:", err);
            this.showToast(`Error de conexión: ${err.message || 'Servidor remoto inalcanzable'}`);
        }
    }

    /**
     * INSERTAR / ACTUALIZAR: Delegamos el POST al manager
     */
    async handleFormSubmit(e) {
        e.preventDefault();
        const idx = document.getElementById('nodeIndex').value;

        const data = {
            name: document.getElementById('nodeName').value,
            level: document.getElementById('nodeLevel').value,
            progress: parseInt(document.getElementById('nodeProgress').value),
            lead: document.getElementById('nodeLead').value || 'UNASSIGNED',
            selected: true
        };

        if (idx === "NEW") {
            const nextId = this.projects.length > 0 ? Math.max(...this.projects.map(p => parseInt(p.id.split('-')[1]))) + 1 : 1;
            data.id = `NODE-${String(nextId).padStart(3, '0')}`;
        } else {
            data.id = this.projects[idx].id;
        }

        try {
            this.showToast("Sincronizando cambios en la nube...");
            const result = await this.apiClient.upsertProject(data);

            if (result.success) {
                this.closeModal();
                await this.loadProjectsFromRemote();
                this.showToast(idx === "NEW" ? "Activo registrado en el clúster" : "Modificación guardada exitosamente");
            }
        } catch (err) {
            this.showToast(`Error al guardar: ${err.message}`);
        }
    }

    /**
     * ELIMINAR: Delegamos el DELETE al manager
     */
    async executeDeleteNode() {
        if (this.indexToDelete !== null && this.indexToDelete !== "NEW") {
            const targetId = this.projects[this.indexToDelete].id;

            try {
                this.showToast("Desconectando activo de forma remota...");
                const result = await this.apiClient.deleteProject(targetId);

                if (result.success) {
                    this.closeConfirmModal();
                    this.closeModal();

                    await this.loadProjectsFromRemote();

                    const maxPage = Math.ceil(this.projects.length / this.itemsPerPage) - 1;
                    if (this.currentPage > maxPage && this.currentPage > 0) {
                        this.currentPage = maxPage;
                        this.renderDashboard();
                    }
                    this.showToast("Activo desconectado del clúster");
                }
            } catch (err) {
                this.showToast(`Error al eliminar: ${err.message}`);
            }
        }
    }

    // =========================================================================
    // MÓDULO DE BITÁCORA DE AVANCES Y CARGA DE ARCHIVOS
    // =========================================================================

    /**
     * Carga y renderiza el historial de avances de un proyecto en el Modal
     */
    async loadProjectUpdates(projectId) {
        const container = document.getElementById('updatesFeed');
        if (!container) return;

        container.innerHTML = '<div class="text-center py-3 text-muted small"><i class="ti ti-loader animate-spin me-1"></i> Cargando bitácora de avances...</div>';

        try {
            const updates = await this.apiClient.getProjectUpdates(projectId);
            this.renderUpdatesFeed(updates);
        } catch (err) {
            console.error('Error al cargar bitácora:', err);
            container.innerHTML = `<div class="alert alert-danger p-2 small m-0"><i class="ti ti-alert-circle me-1"></i> No se pudo obtener la bitácora: ${err.message}</div>`;
        }
    }

    /**
     * Dibuja las tarjetas del feed de observaciones
     */
    renderUpdatesFeed(updates) {
        const container = document.getElementById('updatesFeed');
        if (!container) return;

        if (!updates || updates.length === 0) {
            container.innerHTML = '<div class="text-center py-4 text-muted small"><i class="ti ti-notes-off fs-4 d-block mb-1"></i> No hay avances u observaciones registradas aún.</div>';
            return;
        }

        container.innerHTML = updates.map(upd => {
            const formattedDate = new Date(upd.created_at).toLocaleString('es-MX', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
            });

            const filesHtml = (upd.files && upd.files.length > 0) ? `
                <div class="d-flex flex-wrap gap-2 mt-2 pt-2 border-top border-secondary-subtle">
                    ${upd.files.map(f => {
                        const isImage = f.type && f.type.startsWith('image/');
                        if (isImage) {
                            return `
                                <div class="position-relative rounded overflow-hidden border border-secondary" style="max-width: 200px;">
                                    <img src="${f.url}" alt="${f.name}" class="img-fluid" style="max-height: 100px; object-fit: cover;">
                                    <a href="${f.url}" target="_blank" class="position-absolute top-0 end-0 bg-dark bg-opacity-75 text-white p-1 rounded-bottom-start text-decoration-none">
                                        <i class="ti ti-external-link"></i>
                                    </a>
                                </div>
                            `;
                        }
                        return `
                            <a href="${f.url}" target="_blank" class="btn btn-sm btn-outline-secondary d-flex items-center gap-1 text-truncate" style="max-width: 220px;" title="${f.name}">
                                <i class="ti ti-file-text text-warning"></i>
                                <span class="text-truncate">${f.name}</span>
                                <small class="text-muted">(${f.size || 'Archivo'})</small>
                            </a>
                        `;
                    }).join('')}
                </div>
            ` : '';

            return `
                <div class="card bg-body-tertiary border-0 mb-2 shadow-sm">
                    <div class="card-body p-3">
                        <div class="d-flex justify-content-between align-items-center mb-1">
                            <span class="small font-monospace text-primary fw-bold">
                                <i class="ti ti-clock me-1"></i>${formattedDate}
                            </span>
                            <div class="d-flex align-items-center gap-2">
                                <span class="badge bg-secondary-subtle text-secondary-emphasis font-monospace small">
                                    <i class="ti ti-user me-1"></i>${upd.author || 'Sistema'}
                                </span>
                                <button type="button" onclick="monitor.handleDeleteUpdate('${upd.id}')" class="btn btn-link p-0 text-danger text-decoration-none" title="Eliminar este avance">
                                    <i class="ti ti-trash"></i>
                                </button>
                            </div>
                        </div>
                        <p class="mb-0 text-wrap text-break small" style="white-space: pre-wrap;">${upd.content || '<em>Sin anotación de texto (sólo adjuntos)</em>'}</p>
                        ${filesHtml}
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Maneja la selección de archivos y subida directa a Supabase Storage
     */
    async handleFileUpload(event) {
        const files = Array.from(event.target.files);
        if (!files.length) return;

        const uploadStatusEl = document.getElementById('uploadStatus');
        if (uploadStatusEl) uploadStatusEl.classList.remove('d-none');

        for (const file of files) {
            try {
                let fileUrl = '';
                let storagePath = '';

                // Si Supabase está configurado, sube directamente al bucket
                if (this.supabaseClient) {
                    const fileExt = file.name.split('.').pop();
                    const fileName = `${this.currentProjectId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

                    const { data, error } = await this.supabaseClient.storage
                        .from('project-attachments')
                        .upload(fileName, file, { cacheControl: '3600', upsert: false });

                    if (error) throw error;

                    const { data: publicUrlData } = this.supabaseClient.storage
                        .from('project-attachments')
                        .getPublicUrl(fileName);

                    fileUrl = publicUrlData.publicUrl;
                    storagePath = data.path;
                } else {
                    // Simulación local en caso de no haber configurado API keys de Supabase
                    fileUrl = URL.createObjectURL(file);
                    storagePath = file.name;
                }

                // Formateo simple de tamaño
                const sizeKb = (file.size / 1024).toFixed(1);
                const formattedSize = file.size > 1048576 
                    ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` 
                    : `${sizeKb} KB`;

                this.currentAttachedFiles.push({
                    name: file.name,
                    size: formattedSize,
                    type: file.type,
                    url: fileUrl,
                    path: storagePath
                });

            } catch (err) {
                console.error("Error al subir archivo a Supabase:", err);
                this.showToast(`Error al subir ${file.name}: ${err.message}`);
            }
        }

        if (uploadStatusEl) uploadStatusEl.classList.add('d-none');
        this.renderAttachedFilesBadge();
        event.target.value = ''; // Reset file input
    }

    /**
     * Muestra las etiquetas de los archivos listos para guardarse junto al nuevo avance
     */
    renderAttachedFilesBadge() {
        const badgeContainer = document.getElementById('attachedFilesBadges');
        if (!badgeContainer) return;

        badgeContainer.innerHTML = this.currentAttachedFiles.map((f, idx) => `
            <span class="badge bg-primary-subtle text-primary border border-primary-subtle d-inline-flex align-items-center gap-1 p-2">
                <i class="ti ti-paperclip"></i>
                <span class="text-truncate" style="max-width: 140px;">${f.name}</span>
                <button type="button" onclick="monitor.removeAttachedFile(${idx})" class="btn-close ms-1" style="font-size: 0.65rem;" aria-label="Remover"></button>
            </span>
        `).join('');
    }

    removeAttachedFile(index) {
        this.currentAttachedFiles.splice(index, 1);
        this.renderAttachedFilesBadge();
    }

    /**
     * Guarda la nueva observación/avance en la base de datos a través del Backend
     */
    async handleAddUpdate() {
        const noteTextEl = document.getElementById('newUpdateText');
        const noteText = noteTextEl ? noteTextEl.value.trim() : '';

        if (!noteText && this.currentAttachedFiles.length === 0) {
            return this.showToast("Escribe una observación o adjunta un archivo.");
        }

        const projectLead = document.getElementById('nodeLead')?.value || 'Sistema';

        try {
            this.showToast("Registrando avance con timestamp...");
            await this.apiClient.createProjectUpdate(this.currentProjectId, {
                author: projectLead,
                content: noteText,
                files: this.currentAttachedFiles
            });

            // Limpiar formulario de avance
            if (noteTextEl) noteTextEl.value = '';
            this.currentAttachedFiles = [];
            this.renderAttachedFilesBadge();

            // Recargar la lista de la bitácora
            await this.loadProjectUpdates(this.currentProjectId);
            this.showToast("Avance registrado correctamente.");
        } catch (err) {
            this.showToast(`Error al guardar avance: ${err.message}`);
        }
    }

    /**
     * Elimina un registro de avance
     */
    async handleDeleteUpdate(updateId) {
        if (!confirm("¿Deseas eliminar esta anotación de la bitácora?")) return;

        try {
            await this.apiClient.deleteProjectUpdate(updateId);
            await this.loadProjectUpdates(this.currentProjectId);
            this.showToast("Anotación eliminada.");
        } catch (err) {
            this.showToast(`Error al eliminar: ${err.message}`);
        }
    }

    // =========================================================================

    /**
     * Abre el modal de edición y carga la bitácora del proyecto seleccionado
     */
    openModal(index) {
        const p = this.projects[index];
        this.currentProjectId = p.id;
        this.currentAttachedFiles = [];

        document.getElementById('modalTitle').textContent = "Módulo de Edición";
        document.getElementById('nodeIndex').value = index;
        document.getElementById('nodeName').value = p.name;
        document.getElementById('nodeLevel').value = p.level;
        document.getElementById('nodeProgress').value = p.progress;
        document.getElementById('nodeLead').value = p.lead;
        document.getElementById('deleteBtn').classList.remove('d-none');

        // Limpieza de campos de bitácora
        const noteTextEl = document.getElementById('newUpdateText');
        if (noteTextEl) noteTextEl.value = '';
        this.renderAttachedFilesBadge();

        // Mostrar sección de bitácora e inicializar carga
        const bitacoraSection = document.getElementById('bitacoraSection');
        if (bitacoraSection) bitacoraSection.classList.remove('d-none');
        this.loadProjectUpdates(p.id);

        this.bsCrudModal.show();
    }

    openCreateModal() {
        this.currentProjectId = null;
        this.currentAttachedFiles = [];

        document.getElementById('modalTitle').textContent = "Nuevo Proyecto";
        document.getElementById('nodeIndex').value = "NEW";
        document.getElementById('nodeName').value = "";
        document.getElementById('nodeLevel').value = "NORMAL";
        document.getElementById('nodeProgress').value = "0";
        document.getElementById('nodeLead').value = "";
        document.getElementById('deleteBtn').classList.add('d-none');

        // Ocultar sección de bitácora al crear proyecto nuevo por primera vez
        const bitacoraSection = document.getElementById('bitacoraSection');
        if (bitacoraSection) bitacoraSection.classList.add('d-none');

        this.bsCrudModal.show();
    }

    closeModal() {
        this.bsCrudModal.hide();
    }

    confirmDeleteNode() {
        this.indexToDelete = document.getElementById('nodeIndex').value;
        this.bsConfirmModal.show();
    }

    closeConfirmModal() {
        this.bsConfirmModal.hide();
        this.indexToDelete = null;
    }

    /**
     * Inyecta y ejecuta la lluvia digital en el contenedor de fondo
     */
    initMatrixRain() {
        const container = document.getElementById('canvas-container');
        if (!container) return;

        const canvas = document.createElement('canvas');
        canvas.id = 'matrix-canvas';

        const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
        canvas.style.cssText = `
            position: absolute; top: 0; left: 0;
            width: 100%; height: 100%;
            z-index: 1; pointer-events: none;
            opacity: ${isDark ? '0.35' : '0.15'};
            transition: opacity 0.3s ease;
        `;
        container.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        const FONT_SIZE = 14;

        const CHARS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF01010101><=/\\|{}[]#@%$&*!?';

        const DARK_PALETTES = [
            { head: '#ffffff', body: '#00f2ff', trail: 'rgba(0,242,255,' },
            { head: '#fff0ff', body: '#b46bff', trail: 'rgba(180,107,255,' },
            { head: '#fffae0', body: '#ffb84d', trail: 'rgba(255,184,77,' },
        ];

        const LIGHT_PALETTES = [
            { head: '#0f172a', body: '#0284c7', trail: 'rgba(2,132,199,' },
            { head: '#1e1b4b', body: '#7c3aed', trail: 'rgba(124,58,237,' },
            { head: '#1c1917', body: '#d97706', trail: 'rgba(217,119,6,' },
        ];

        let cols, drops, dropPalette, dropSpeed, dropLength;

        const resizeMatrix = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            cols = Math.floor(canvas.width / FONT_SIZE);
            drops = new Array(cols).fill(1).map(() => Math.random() * -100);
            dropPalette = new Array(cols).fill(0).map(() => Math.floor(Math.random() * DARK_PALETTES.length));
            dropSpeed = new Array(cols).fill(0).map(() => 0.3 + Math.random() * 0.7);
            dropLength = new Array(cols).fill(0).map(() => 8 + Math.floor(Math.random() * 24));
        };

        resizeMatrix();
        window.addEventListener('resize', resizeMatrix);

        let lastTime = 0;
        const draw = (ts) => {
            requestAnimationFrame(draw);
            const dt = ts - lastTime;
            if (dt < 28) return;
            lastTime = ts;

            const isDarkNow = document.documentElement.getAttribute('data-bs-theme') === 'dark';
            const activePalettes = isDarkNow ? DARK_PALETTES : LIGHT_PALETTES;

            ctx.fillStyle = isDarkNow ? 'rgba(1,5,9,0.18)' : 'rgba(247,249,251,0.28)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.font = `${FONT_SIZE}px "Fira Code", monospace`;

            for (let i = 0; i < cols; i++) {
                const pal = activePalettes[dropPalette[i]];
                const y = drops[i] * FONT_SIZE;
                const char = CHARS[Math.floor(Math.random() * CHARS.length)];

                if (y > 0 && y < canvas.height) {
                    ctx.shadowBlur = isDarkNow ? 8 : 0;
                    ctx.shadowColor = pal.body;
                    ctx.fillStyle = pal.head;
                    ctx.fillText(char, i * FONT_SIZE, y);
                    ctx.shadowBlur = 0;
                }

                for (let k = 1; k < dropLength[i]; k++) {
                    const ky = y - k * FONT_SIZE;
                    if (ky < 0) continue;
                    const alpha = Math.max(0, 1 - k / dropLength[i]);
                    const trailChar = CHARS[Math.floor(Math.random() * CHARS.length)];
                    const factorAlpha = isDarkNow ? 0.9 : 0.65;
                    ctx.fillStyle = pal.trail + (alpha * factorAlpha).toFixed(2) + ')';
                    ctx.fillText(trailChar, i * FONT_SIZE, ky);
                }

                drops[i] += dropSpeed[i];
                if (drops[i] * FONT_SIZE > canvas.height + dropLength[i] * FONT_SIZE) {
                    drops[i] = -Math.random() * 40;
                    dropPalette[i] = Math.floor(Math.random() * activePalettes.length);
                    dropSpeed[i] = 0.3 + Math.random() * 0.7;
                    dropLength[i] = 8 + Math.floor(Math.random() * 24);
                }
            }
        };
        requestAnimationFrame(draw);
    }

    showToast(message) {
        const toastMessage = document.getElementById('toastMessage');
        if (toastMessage) toastMessage.textContent = message;
        if (this.bsToast) this.bsToast.show();
    }

    toggleTheme() {
        const html = document.documentElement;
        const currentTheme = html.getAttribute('data-bs-theme');
        const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-bs-theme', nextTheme);

        const icon = document.getElementById('theme-icon');
        if (icon) {
            icon.className = nextTheme === 'dark' ? 'ti ti-sun fs-4' : 'ti ti-moon fs-4';
        }

        const matrixCanvas = document.getElementById('matrix-canvas');
        if (matrixCanvas) {
            matrixCanvas.style.opacity = nextTheme === 'dark' ? '0.35' : '0.15';
            const ctx = matrixCanvas.getContext('2d');
            ctx.clearRect(0, 0, matrixCanvas.width, matrixCanvas.height);
        }

        this.updateChartData();
        this.renderDashboard();
    }

    renderDashboard() {
        const nodesGrid = document.getElementById('nodesGrid');
        if (!nodesGrid) return;

        this.activeMiniCharts.forEach(chart => chart.dispose());
        this.activeMiniCharts = [];
        nodesGrid.innerHTML = '';

        const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
        const labelColor = isDark ? '#f8fafc' : '#1e293b';
        const trackColor = isDark ? '#334155' : '#e2e8f0';

        const startIndex = this.currentPage * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const paginatedProjects = this.projects.slice(startIndex, endIndex);

        paginatedProjects.forEach((p) => {
            const originalIndex = this.projects.findIndex(proj => proj.id === p.id);

            let colorHex = '#108fb9';
            let borderClass = 'border-start border-success border-1';

            if (p.level === 'CRÍTICA') {
                colorHex = '#ef4444';
                borderClass = 'border-start border-danger border-1';
            }
            if (p.level === 'NORMAL') {
                colorHex = '#10b981';
                borderClass = 'border-start border-success border-1';
            }
            if (p.level === 'BAJA') {
                colorHex = '#8443c0';
                borderClass = 'border-start border-success border-1';
            }
            else if (p.level === 'ALTA') {
                colorHex = '#f59e0b';
                borderClass = 'border-start border-warning border-1';
            }

            const col = document.createElement('div');
            col.className = 'col-12 col-md-6 col-lg-4 col-xl-3';
            col.innerHTML = `
                <div class="card h-100 shadow-sm ${borderClass}" style="transition: transform 0.15s ease;">
                    <div class="card-body p-3 d-flex flex-column justify-content-between">
                        <div class="d-flex align-items-center justify-content-between mb-3">
                            <div class="d-flex align-items-center gap-2">
                                <input type="checkbox" ${p.selected ? 'checked' : ''} onchange="monitor.toggleSelect(${originalIndex})" class="form-check-input m-0">
                                <span class="font-monospace text-muted small fw-bold">${p.id}</span>
                            </div>
                            <button onclick="monitor.openModal(${originalIndex})" class="btn btn-link btn-sm p-0 text-decoration-none fw-semibold small text-primary">
                                <i class="ti ti-edit"></i> Editar
                            </button>
                        </div>

                        <div class="d-flex justify-content-center my-2">
                            <div id="gauge-${p.id}" style="width: 140px; height: 140px;"></div>
                        </div>

                        <div class="border-top pt-2 mt-2">
                            <div class="fw-bold text-truncate mb-1" title="${p.name}">${p.name}</div>
                            <div class="d-flex justify-content-between align-items-center text-muted" style="font-size: 0.75rem;">
                                <span><i class="ti ti-user"></i> ${p.lead}</span>
                                <span class="badge rounded-pill bg-secondary-subtle text-secondary-emphasis fw-bold">${p.level}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            nodesGrid.appendChild(col);

            const gaugeContainer = document.getElementById(`gauge-${p.id}`);
            if (gaugeContainer) {
                const myChart = echarts.init(gaugeContainer);
                const option = {
                    series: [{
                        type: 'gauge',
                        startAngle: 240,
                        endAngle: -60,
                        radius: '100%',
                        center: ['50%', '50%'],
                        pointer: { show: false },
                        progress: { show: true, overlap: false, roundCap: true, itemStyle: { color: colorHex } },
                        axisLine: { lineStyle: { width: 10, color: [[1, trackColor]] } },
                        splitLine: { show: false },
                        axisTick: { show: false },
                        axisLabel: { show: false },
                        data: [{ value: p.progress }],
                        detail: { offsetCenter: [0, 0], fontSize: 20, fontWeight: '700', formatter: '{value}%', color: labelColor }
                    }]
                };
                myChart.setOption(option);
                this.activeMiniCharts.push(myChart);
            }
        });

        const maxPage = Math.ceil(this.projects.length / this.itemsPerPage) - 1;
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');

        if (prevBtn) prevBtn.disabled = this.currentPage === 0;
        if (nextBtn) nextBtn.disabled = this.currentPage >= maxPage;

        this.updateStats();
        this.updateSelectedCount();

        const totalSpan = document.getElementById('nodeTotalSpan');
        if (totalSpan) totalSpan.textContent = this.projects.length;

        this.updateChartData();
    }

    nextPage() {
        const maxPage = Math.ceil(this.projects.length / this.itemsPerPage) - 1;
        if (this.currentPage < maxPage) {
            this.currentPage++;
            this.renderDashboard();
        }
    }

    prevPage() {
        if (this.currentPage > 0) {
            this.currentPage--;
            this.renderDashboard();
        }
    }

    updateStats() {
        const counts = { CRÍTICA: 0, ALTA: 0, NORMAL: 0, BAJA: 0 };
        this.projects.forEach(p => counts[p.level]++);

        const cardsData = [
            { label: 'Proyectos Críticos', count: counts.CRÍTICA, style: 'stat-critica', icon: 'ti-alert-hexagon text-danger' },
            { label: 'Proyectos Advertencia', count: counts.ALTA, style: 'stat-alta', icon: 'ti-alert-triangle text-warning' },
            { label: 'Proyectos Estables', count: counts.NORMAL, style: 'stat-normal', icon: 'ti-circle-check text-success' },
            { label: 'Proyectos Baja', count: counts.BAJA, style: 'stat-baja', icon: 'ti-cube-3d-sphere text-success' },
            { label: 'Total de Proyectos Activos', count: this.projects.length, style: 'stat-global', icon: 'ti-server text-primary' }
        ];

        const container = document.getElementById('statsContainer');
        if (!container) return;

        container.innerHTML = cardsData.map(c => `
            <div class="col-3">
                <div class="card h-100 card-stat ${c.style} border shadow-sm">
                    <div class="card-body p-3 d-flex align-items-center justify-content-between">
                        <div>
                            <span class="small fw-medium text-muted d-block mb-1">${c.label}</span>
                            <h3 class="h4 mb-0 fw-bold tracking-tight">${c.count}</h3>
                        </div>
                        <i class="ti ${c.icon} fs-2 opacity-75"></i>
                    </div>
                </div>
            </div>
        `).join('');
    }

    updateChartData() {
        if (!this.distributionChart) return;
        const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
        const counts = { CRÍTICA: 0, ALTA: 0, NORMAL: 0, BAJA: 0 };
        this.projects.forEach(p => counts[p.level]++);

        const option = {
            tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
            series: [{
                name: 'Criticidad',
                type: 'pie',
                radius: ['55%', '85%'],
                avoidLabelOverlap: false,
                itemStyle: { borderRadius: 4, borderColor: isDark ? '#1e293b' : '#fff', borderWidth: 2 },
                label: { show: false },
                data: [
                    { value: counts.CRÍTICA, name: 'Crítica', itemStyle: { color: '#ef4444' } },
                    { value: counts.ALTA, name: 'Alta', itemStyle: { color: '#f59e0b' } },
                    { value: counts.NORMAL, name: 'Normal', itemStyle: { color: '#10b981' } },
                    { value: counts.BAJA, name: 'Baja', itemStyle: { color: ' #7010b9' } }
                ]
            }]
        };
        this.distributionChart.setOption(option);
    }

    toggleSelect(index) {
        this.projects[index].selected = !this.projects[index].selected;
        this.updateSelectedCount();
    }

    updateSelectedCount() {
        const selected = this.projects.filter(p => p.selected).length;
        const countEl = document.getElementById('selectedCount');
        const headerCheckbox = document.getElementById('mainHeaderCheckbox');

        if (countEl) countEl.textContent = selected;
        if (headerCheckbox) headerCheckbox.checked = selected === this.projects.length;
    }

    toggleSelectAllHeader(masterCheckbox) {
        this.projects.forEach(p => p.selected = masterCheckbox.checked);
        this.renderDashboard();
    }

    toggleSelectAll() {
        const anySelected = this.projects.some(p => p.selected);
        this.projects.forEach(p => p.selected = !anySelected);
        this.renderDashboard();
    }

    exportToExcel() {
        const data = this.projects.map(p => ({
            ID: p.id,
            Proyecto: p.name,
            Criticidad: p.level,
            Operación: `${p.progress}%`,
            Responsable: p.lead
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Infraestructura");
        XLSX.writeFile(wb, "SaaS_Network_Specs.xlsx");
    }

    generateReport() {
        const selected = this.projects.filter(p => p.selected);
        if (!selected.length) return this.showToast("Selecciona al menos un activo");

        const modalBody = document.getElementById('reportModalBody');
        if (!modalBody) return;

        modalBody.innerHTML = `
            <div class="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
                <span class="small fw-bold text-uppercase tracking-wider text-primary">Resumen de Proyectos Seleccionados</span>
                <span class="small font-monospace badge bg-secondary-subtle text-secondary-emphasis p-2">${new Date().toLocaleDateString()}</span>
            </div>
            <div class="table-responsive">
                <table class="table table-striped table-bordered align-middle small mb-0">
                    <thead class="table-light">
                        <tr>
                            <th>ID Core</th>
                            <th>Proyecto</th>
                            <th>Criticidad</th>
                            <th>Progreso</th>
                            <th>Responsable a Cargo</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${selected.map(p => `
                            <tr>
                                <td class="font-monospace fw-bold small">${p.id}</td>
                                <td class="fw-medium">${p.name}</td>
                                <td>
                                    <span class="badge ${p.level === 'CRÍTICA' ? 'bg-danger' : (p.level === 'ALTA' ? 'bg-warning text-dark' : 'bg-success')} rounded-1 small">
                                        ${p.level}
                                    </span>
                                </td>
                                <td class="fw-bold">${p.progress}%</td>
                                <td class="text-muted">${p.lead}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        if (this.bsReportModal) {
            this.bsReportModal.show();
        }
    }

    closeReportView() {
        const reportView = document.getElementById('reportView');
        if (reportView) reportView.classList.add('d-none');
        document.querySelectorAll('.no-print').forEach(el => el.classList.remove('d-none'));
    }
}

const monitor = new InfrastructureMonitor();
window.onload = () => monitor.init();

```

---

### ¿Cómo agregar la sección en tu HTML (`crudModal`)?

Dentro del cuerpo de tu modal HTML (`<div id="crudModal">`), justo debajo de los campos principales del proyecto, agrega este bloque HTML para renderizar la Bitácora de Avances:


```html
<!-- SECCIÓN NUEVA: BITÁCORA DE AVANCES -->
<div id="bitacoraSection" class="mt-4 pt-3 border-top">
    <h6 class="fw-bold mb-3 d-flex align-items-center gap-2">
        <i class="ti ti-notes text-primary"></i> Bitácora de Avances y Evidencias
    </h6>

    <!-- Formulario para agregar nuevo avance -->
    <div class="bg-body-tertiary p-3 rounded-3 border mb-3">
        <textarea id="newUpdateText" class="form-control form-control-sm mb-2" rows="2" placeholder="Escribe un avance, observación o estado del proyecto..."></textarea>
        
        <!-- Badges de archivos adjuntos -->
        <div id="attachedFilesBadges" class="d-flex flex-wrap gap-1 mb-2"></div>
        <div id="uploadStatus" class="small text-muted mb-2 d-none">
            <i class="ti ti-loader animate-spin me-1 text-primary"></i> Subiendo archivo a Supabase Storage...
        </div>

        <div class="d-flex justify-content-between align-items-center">
            <div>
                <input type="file" id="updateFileInput" multiple onchange="monitor.handleFileUpload(event)" class="d-none">
                <button type="button" onclick="document.getElementById('updateFileInput').click()" class="btn btn-sm btn-outline-secondary">
                    <i class="ti ti-paperclip me-1"></i> Adjuntar Evidencias
                </button>
            </div>
            <button type="button" onclick="monitor.handleAddUpdate()" class="btn btn-sm btn-primary">
                <i class="ti ti-plus me-1"></i> Agregar Avance
            </button>
        </div>
    </div>

    <!-- Contenedor del Historial de Avances -->
    <div id="updatesFeed" style="max-height: 250px; overflow-y: auto;"></div>
</div>
```

Y en tu `index.html` (o `index.ejs`/`main.html`), recuerda incluir el script CDN de Supabase si deseas subida directa:
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

