class InfrastructureMonitor {
    constructor() {
        // Datos base del clúster (30 registros)
        this.apiClient = new FetchManager('https://cosmic-matrix-back.vercel.app/');

        // --- Supabase Storage (solo para subir archivos de la bitácora de avances) ---
        // Reemplaza estos 3 valores con los de tu proyecto Supabase (Settings > API)
        this.storageManager = new StorageManager(
            'https://owjssvxtzhwqedwigaux.supabase.co',   // <-- Project URL
            'sb_publishable__fXpBwtZCmfW6jLKjzKHRg_who9vVlJ',                 // <-- anon / public key (NO la service_role)
            'project-attachments'                 // <-- nombre del bucket que crearás en Storage
        );
        this.currentProjectId = null; // proyecto abierto actualmente en el modal (para la bitácora)

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
    }

    /**
     * Inicializa el monitor acoplándolo al ciclo de vida y eventos del DOM
     */
    async init() {
        this.bsCrudModal = new bootstrap.Modal(document.getElementById('crudModal'));
        this.bsConfirmModal = new bootstrap.Modal(document.getElementById('confirmModal'));
        this.bsToast = new bootstrap.Toast(document.getElementById('toastNotification'), { delay: 2500 });
        this.bsReportModal = new bootstrap.Modal(document.getElementById('reportModal'));
        this.bsCriticalityModal = new bootstrap.Modal(document.getElementById('criticalityModal'));


        const nodeForm = document.getElementById('nodeForm');
        if (nodeForm) {
            nodeForm.onsubmit = (e) => this.handleFormSubmit(e);
        }

        // --- ACTIVACIÓN DEL FONDO 3D INTERACTIVO (red de proyectos) ---
        this.background3D = new Background3D('canvas-container');
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
     * LISTAR: Usa el manager para traer datos de Render
     */
    async loadProjectsFromRemote() {
        try {
            console.log("loadProjectsFromRemote ****");
            this.showToast("Mapeando clúster central...");

            // --- USO DEL MANAGER ---
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

        // Preparar el objeto de datos (Igual que antes)
        const data = {
            name: document.getElementById('nodeName').value,
            level: document.getElementById('nodeLevel').value,
            progress: parseInt(document.getElementById('nodeProgress').value),
            lead: document.getElementById('nodeLead').value || 'UNASSIGNED',
            selected: true
        };

        console.log("handleFormSubmit---------");
        console.log(data);

        if (idx === "NEW") {
            const nextId = this.projects.length > 0 ? Math.max(...this.projects.map(p => parseInt(p.id.split('-')[1]))) + 1 : 1;
            data.id = `NODE-${String(nextId).padStart(3, '0')}`;
        } else {
            data.id = this.projects[idx].id;
        }


        console.log("handleFormSubmit---------");
        console.log(data);

        try {

            console.log("handleFormSubmit---------1");
            this.showToast("Sincronizando cambios en la nube...");

            console.log("handleFormSubmit--------2");
            // --- USO DEL MANAGER (UPSERT) ---
            const result = await this.apiClient.upsertProject(data);

            console.log(result);


            if (result.success) {
                this.closeModal();
                // Recarga y renderiza limpio desde la nube
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

                // --- USO DEL MANAGER (DELETE) ---
                const result = await this.apiClient.deleteProject(targetId);

                if (result.success) {
                    this.closeConfirmModal();
                    this.closeModal();

                    await this.loadProjectsFromRemote(); // Actualiza local y gráficos

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

    showToast(message) {
        document.getElementById('toastMessage').textContent = message;
        this.bsToast.show();
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

        // Ajustar la intensidad visual del fondo 3D según el tema
        if (this.background3D) {
            this.background3D.setTheme(nextTheme);
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
                            <div class="d-flex align-items-center gap-2">
                                <button onclick="monitor.openBitacora(${originalIndex})" title="Bitácora de Avances"
                                    class="btn btn-link btn-sm p-0 text-decoration-none fw-semibold small text-info">
                                    <i class="ti ti-folder"></i> Bitácora
                                </button>
                                <button onclick="monitor.openModal(${originalIndex})" class="btn btn-link btn-sm p-0 text-decoration-none fw-semibold small text-primary">
                                    <i class="ti ti-edit"></i> Editar
                                </button>
                            </div>
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
            { label: 'Proyectos Críticos', count: counts.CRÍTICA, style: 'stat-critica', icon: 'ti-alert-hexagon text-danger', level: 'CRÍTICA' },
            { label: 'Proyectos Advertencia', count: counts.ALTA, style: 'stat-alta', icon: 'ti-alert-triangle text-warning', level: 'ALTA' },
            { label: 'Proyectos Estables', count: counts.NORMAL, style: 'stat-normal', icon: 'ti-circle-check text-success', level: 'NORMAL' },
            { label: 'Proyectos Baja', count: counts.BAJA, style: 'stat-baja', icon: 'ti-cube-3d-sphere text-success', level: 'BAJA' },
            { label: 'Total de Proyectos Activos', count: this.projects.length, style: 'stat-global', icon: 'ti-server text-primary', level: null }
        ];

        const container = document.getElementById('statsContainer');
        if (!container) return;

        container.innerHTML = cardsData.map(c => `
            <div class="col-3">
                <div class="card h-100 card-stat ${c.style} border shadow-sm" role="button" style="cursor:pointer;"
                    onclick="monitor.openCriticalityModal(${c.level ? `'${c.level}'` : 'null'})"
                    title="Ver proyectos">
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

    /**
     * Abre el modal flotante con los proyectos de una criticidad específica
     * (o todos, si level es null). Se dispara al hacer clic en las tarjetas
     * de resumen (Críticos / Advertencia / Estables / Baja / Total).
     */
    openCriticalityModal(level) {
        const list = level ? this.projects.filter(p => p.level === level) : this.projects;

        const titleEl = document.getElementById('criticalityModalTitle');
        if (titleEl) {
            titleEl.innerHTML = level
                ? `Proyectos &mdash; Criticidad <span style="color:${this.getLevelColor(level)};">${level}</span>`
                : 'Todos los Proyectos';
        }

        const bodyEl = document.getElementById('criticalityModalBody');
        if (bodyEl) bodyEl.innerHTML = this.buildCriticalityListHtml(list);

        if (this.bsCriticalityModal) this.bsCriticalityModal.show();
    }

    /**
     * HTML de la lista de proyectos dentro del modal de criticidad.
     * Cada fila es clicable y lleva al detalle completo (con bitácora).
     */
    buildCriticalityListHtml(list) {
        if (!list.length) {
            return `<div class="text-center text-muted small py-4">No hay proyectos con esta criticidad.</div>`;
        }

        return `
            <div class="d-flex flex-column gap-2">
                ${list.map(p => {
                    const idx = this.projects.findIndex(pr => pr.id === p.id);
                    return `
                    <button type="button" onclick="monitor.openProjectFromCriticality(${idx})"
                        class="btn text-start border rounded p-3 d-flex justify-content-between align-items-center w-100">
                        <div>
                            <div class="font-monospace small text-muted">${p.id}</div>
                            <div class="fw-bold">${this.escapeHtml(p.name)}</div>
                            <div class="small text-muted"><i class="ti ti-user"></i> ${this.escapeHtml(p.lead || '-')}</div>
                        </div>
                        <div class="text-end">
                            <span class="badge rounded-1 small mb-1 d-inline-block" style="background:${this.getLevelColor(p.level)};color:#0a0e17;">${p.level}</span>
                            <div class="fw-bold">${p.progress}%</div>
                        </div>
                    </button>
                `;
                }).join('')}
            </div>
        `;
    }

    /**
     * Desde el modal de criticidad, cierra esa ventana y abre el detalle
     * completo del proyecto elegido (incluye su bitácora de avances).
     */
    openProjectFromCriticality(index) {
        const modalEl = document.getElementById('criticalityModal');
        const openDetail = () => this.openModal(index);

        if (this.bsCriticalityModal && modalEl) {
            modalEl.addEventListener('hidden.bs.modal', openDetail, { once: true });
            this.bsCriticalityModal.hide();
        } else {
            openDetail();
        }
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

    openModal(index) {
        const p = this.projects[index];
        document.getElementById('modalTitle').textContent = "Módulo de Edición";
        document.getElementById('modalSub').textContent = "Editor de Proyecto";
        document.getElementById('nodeForm').classList.remove('d-none');
        document.getElementById('nodeIndex').value = index;
        document.getElementById('nodeName').value = p.name;
        document.getElementById('nodeLevel').value = p.level;
        document.getElementById('nodeProgress').value = p.progress;
        document.getElementById('nodeLead').value = p.lead;
        document.getElementById('deleteBtn').classList.remove('d-none');

        // Bitácora de avances: solo aplica a proyectos ya existentes
        this.currentProjectId = p.id;
        document.getElementById('updatesSection').classList.remove('d-none');
        this.loadUpdates(p.id);

        this.bsCrudModal.show();
    }

    /**
     * Acceso directo SOLO a la Bitácora de Avances de un proyecto, sin mostrar
     * los campos de edición (nombre, criticidad, progreso, etc.)
     */
    openBitacora(index) {
        const p = this.projects[index];
        document.getElementById('modalTitle').textContent = "Bitácora de Avances";
        document.getElementById('modalSub').textContent = p.name;
        document.getElementById('nodeIndex').value = index;

        // Oculta el formulario de edición: en este acceso solo interesa la bitácora
        document.getElementById('nodeForm').classList.add('d-none');

        this.currentProjectId = p.id;
        document.getElementById('updatesSection').classList.remove('d-none');
        this.loadUpdates(p.id);

        this.bsCrudModal.show();
    }

    openCreateModal() {
        document.getElementById('modalTitle').textContent = "Nuevo Proyecto";
        document.getElementById('modalSub').textContent = "Editor de Proyecto";
        document.getElementById('nodeForm').classList.remove('d-none');
        document.getElementById('nodeIndex').value = "NEW";
        document.getElementById('nodeName').value = "";
        document.getElementById('nodeLevel').value = "NORMAL";
        document.getElementById('nodeProgress').value = "0";
        document.getElementById('nodeLead').value = "";
        document.getElementById('deleteBtn').classList.add('d-none');

        // Aún no existe el proyecto, no se puede documentar avances todavía
        this.currentProjectId = null;
        document.getElementById('updatesSection').classList.add('d-none');
        document.getElementById('updatesList').innerHTML = '';
        document.getElementById('updateNote').value = '';
        document.getElementById('updateFiles').value = '';

        this.bsCrudModal.show();
    }

    closeModal() {
        // Restaura el formulario por si se cerró desde el modo "solo bitácora"
        document.getElementById('nodeForm').classList.remove('d-none');
        this.bsCrudModal.hide();
    }

    /**
     * BITÁCORA: Carga los avances de un proyecto desde el backend
     */
    async loadUpdates(projectId) {
        const listEl = document.getElementById('updatesList');
        listEl.innerHTML = `<div class="small text-muted text-center py-2">Cargando bitácora...</div>`;
        try {
            const updates = await this.apiClient.getProjectUpdates(projectId);
            this.renderUpdates(updates);
        } catch (err) {
            listEl.innerHTML = `<div class="small text-danger text-center py-2">No se pudo cargar la bitácora: ${this.escapeHtml(err.message || '')}</div>`;
        }
    }

    /**
     * BITÁCORA: Pinta la lista de avances con sus archivos adjuntos (imagen, video o documento)
     */
    renderUpdates(updates) {
        const listEl = document.getElementById('updatesList');
        if (!updates || updates.length === 0) {
            listEl.innerHTML = `<div class="small text-muted text-center py-2">Aún no hay avances registrados.</div>`;
            return;
        }

        listEl.innerHTML = updates.map(u => {
            const dateStr = new Date(u.createdAt).toLocaleString('es-MX', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });

            const filesHtml = (u.files || []).map(f => {
                const type = f.fileType || '';
                const name = this.escapeHtml(f.fileName || 'Archivo');
                if (type.startsWith('image/')) {
                    return `<a href="${f.fileUrl}" target="_blank" rel="noopener" class="d-inline-block me-1 mb-1">
                        <img src="${f.fileUrl}" alt="${name}" class="rounded border" style="width:56px;height:56px;object-fit:cover;">
                    </a>`;
                }
                if (type.startsWith('video/')) {
                    return `<a href="${f.fileUrl}" target="_blank" rel="noopener"
                        class="d-inline-flex align-items-center justify-content-center border rounded me-1 mb-1"
                        style="width:56px;height:56px;" title="${name}">
                        <i class="ti ti-player-play fs-4"></i>
                    </a>`;
                }
                return `<a href="${f.fileUrl}" target="_blank" rel="noopener"
                    class="d-inline-flex align-items-center gap-1 border rounded px-2 py-1 me-1 mb-1 small text-decoration-none">
                    <i class="ti ti-file-description"></i> ${name}
                </a>`;
            }).join('');

            return `
                <div class="border rounded p-2 small">
                    <div class="d-flex justify-content-between align-items-start mb-1">
                        <span class="text-muted"><i class="ti ti-clock fs-6"></i> ${dateStr}</span>
                        <button type="button" class="btn btn-link btn-sm text-danger p-0" title="Eliminar avance"
                            onclick="monitor.deleteUpdate('${u.id}')">
                            <i class="ti ti-trash fs-6"></i>
                        </button>
                    </div>
                    <div class="mb-1" style="white-space: pre-wrap;">${this.escapeHtml(u.note)}</div>
                    ${filesHtml ? `<div class="d-flex flex-wrap mt-1">${filesHtml}</div>` : ''}
                </div>
            `;
        }).join('');
    }

    /**
     * BITÁCORA: Sube archivos (si el usuario adjuntó alguno) y registra la nota.
     * La fecha/hora la asigna el servidor de forma automática (created_at).
     */
    async submitUpdate() {
        if (!this.currentProjectId) return;

        const noteEl = document.getElementById('updateNote');
        const filesEl = document.getElementById('updateFiles');
        const note = noteEl.value.trim();

        if (!note) {
            this.showToast("Escribe una observación antes de guardar el avance");
            return;
        }

        const btn = document.getElementById('addUpdateBtn');
        btn.disabled = true;

        try {
            let uploadedFiles = [];
            if (filesEl.files && filesEl.files.length > 0) {
                this.showToast("Subiendo archivos adjuntos...");
                uploadedFiles = await this.storageManager.uploadFiles(filesEl.files, this.currentProjectId);
            }

            this.showToast("Guardando avance...");
            await this.apiClient.addProjectUpdate(this.currentProjectId, note, uploadedFiles);

            noteEl.value = '';
            filesEl.value = '';

            await this.loadUpdates(this.currentProjectId);
            this.showToast("Avance registrado en la bitácora");
        } catch (err) {
            this.showToast(`Error al registrar el avance: ${err.message || err}`);
        } finally {
            btn.disabled = false;
        }
    }

    /**
     * BITÁCORA: Elimina un avance puntual (ej. si el usuario se equivocó al capturar)
     */
    async deleteUpdate(updateId) {
        if (!confirm("¿Eliminar este avance de la bitácora? Esta acción no se puede deshacer.")) return;
        try {
            await this.apiClient.deleteProjectUpdate(updateId);
            await this.loadUpdates(this.currentProjectId);
            this.showToast("Avance eliminado");
        } catch (err) {
            this.showToast(`Error al eliminar avance: ${err.message || err}`);
        }
    }

    /**
     * Utilidad: escapa HTML para evitar inyección al pintar texto capturado por el usuario
     */
    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str ?? '';
        return div.innerHTML;
    }

    /*

    handleFormSubmit(e) {
        e.preventDefault();
        const idx = document.getElementById('nodeIndex').value;
        const data = {
            name: document.getElementById('nodeName').value,
            level: document.getElementById('nodeLevel').value,
            progress: parseInt(document.getElementById('nodeProgress').value),
            lead: document.getElementById('nodeLead').value || 'UNASSIGNED',
            lastUpdate: new Date().toISOString().split('T')[0],
            selected: true
        };

        if (idx === "NEW") {
            const nextId = this.projects.length > 0 ? Math.max(...this.projects.map(p => parseInt(p.id.split('-')[1]))) + 1 : 1;
            data.id = `NODE-${String(nextId).padStart(3, '0')}`;
            this.projects.push(data);
            this.showToast("Activo registrado en el clúster central");
        } else {
            this.projects[idx] = { ...this.projects[idx], ...data };
            this.showToast("Modificación guardada exitosamente");
        }
        this.closeModal();
        this.renderDashboard();
    }
    */

    confirmDeleteNode() {
        this.indexToDelete = document.getElementById('nodeIndex').value;
        this.bsConfirmModal.show();
    }

    closeConfirmModal() {
        this.bsConfirmModal.hide();
        this.indexToDelete = null;
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

        // "Foto" fija de qué proyectos entran a esta sesión de reporte. Los checks
        // dentro del modal solo prenden/apagan p.selected, pero la fila se queda
        // visible aquí (no desaparece) para poder afinar la selección con calma.
        this.reportProjectIds = selected.map(p => p.id);

        const modalBody = document.getElementById('reportModalBody');
        if (!modalBody) return;
        modalBody.innerHTML = this.buildReportTableHtml();

        if (this.bsReportModal) {
            this.bsReportModal.show();
        }
    }

    /**
     * Arma el HTML de la tabla de resumen del modal de Reporte, con un checkbox
     * por fila para incluir/excluir ese proyecto del Excel/PDF a generar.
     */
    buildReportTableHtml() {
        const list = (this.reportProjectIds || [])
            .map(id => this.projects.find(p => p.id === id))
            .filter(Boolean);

        const includedCount = list.filter(p => p.selected).length;

        return `
            <div class="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
                <span class="small fw-bold text-uppercase tracking-wider text-primary">Resumen de Proyectos Seleccionados</span>
                <span class="small font-monospace badge bg-secondary-subtle text-secondary-emphasis p-2">${new Date().toLocaleDateString()}</span>
            </div>
            <div class="table-responsive">
                <table class="table table-striped table-bordered align-middle small mb-0">
                    <thead class="table-light">
                        <tr>
                            <th style="width:38px;"></th>
                            <th>ID Core</th>
                            <th>Proyecto</th>
                            <th>Criticidad</th>
                            <th>Progreso</th>
                            <th>Responsable a Cargo</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${list.map(p => `
                            <tr style="${p.selected ? '' : 'opacity:0.45;'}">
                                <td class="text-center">
                                    <input type="checkbox" class="form-check-input m-0" ${p.selected ? 'checked' : ''}
                                        onchange="monitor.toggleReportRow('${p.id}')">
                                </td>
                                <td class="font-monospace fw-bold small">${p.id}</td>
                                <td class="fw-medium">${this.escapeHtml(p.name)}</td>
                                <td>
                                    <span class="badge ${p.level === 'CRÍTICA' ? 'bg-danger' : (p.level === 'ALTA' ? 'bg-warning text-dark' : 'bg-success')} rounded-1 small">
                                        ${p.level}
                                    </span>
                                </td>
                                <td class="fw-bold">${p.progress}%</td>
                                <td class="text-muted">${this.escapeHtml(p.lead || '')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div class="small text-muted mt-2">
                <span id="reportSelectedSummary">${includedCount} de ${list.length}</span> proyecto(s) se incluirán en el Excel/PDF.
            </div>
        `;
    }

    /**
     * Prende/apaga un proyecto puntual dentro del modal de Reporte, sin que
     * desaparezca de la tabla ni se cierre el modal.
     */
    toggleReportRow(id) {
        const p = this.projects.find(pr => pr.id === id);
        if (!p) return;
        p.selected = !p.selected;
        this.updateSelectedCount();

        const modalBody = document.getElementById('reportModalBody');
        if (modalBody) modalBody.innerHTML = this.buildReportTableHtml();
    }

    closeReportView() {
        const reportView = document.getElementById('reportView');
        if (reportView) reportView.classList.add('d-none');
        document.querySelectorAll('.no-print').forEach(el => el.classList.remove('d-none'));
    }

    // --- REPORTES: helpers ---

    /**
     * Color oficial según el nivel de criticidad (mismos tonos que las tarjetas del dashboard)
     */
    getLevelColor(level) {
        switch (level) {
            case 'CRÍTICA': return '#ef4444';
            case 'ALTA': return '#f59e0b';
            case 'NORMAL': return '#10b981';
            case 'BAJA': return '#8443c0';
            default: return '#3b82f6';
        }
    }

    /**
     * Aclara un color hex un % dado (para generar el degradado del gauge)
     */
    shadeColor(hex, percent) {
        const num = parseInt(hex.replace('#', ''), 16);
        let r = (num >> 16) + Math.round((255 * percent) / 100);
        let g = ((num >> 8) & 0x00ff) + Math.round((255 * percent) / 100);
        let b = (num & 0x0000ff) + Math.round((255 * percent) / 100);
        r = Math.min(255, Math.max(0, r));
        g = Math.min(255, Math.max(0, g));
        b = Math.min(255, Math.max(0, b));
        return `#${(0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1)}`;
    }

    /**
     * Genera la imagen (dataURL PNG) de un gauge con efecto 3D (degradado + sombra + relieve),
     * usado en el reporte PDF. ECharts no soporta gauges nativos en WebGL/3D real (ver nota
     * al usuario); este efecto simula profundidad con gradiente + shadowBlur, muy usado en
     * dashboards para dar sensación "3D" sin depender de librerías pesadas adicionales.
     */
    renderGaugeImage(percent, colorHex) {
        return new Promise((resolve) => {
            const holder = document.createElement('div');
            holder.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:260px;height:260px;';
            document.body.appendChild(holder);

            const chart = echarts.init(holder, null, { width: 260, height: 260 });
            chart.setOption({
                animation: false,
                backgroundColor: 'transparent',
                series: [{
                    type: 'gauge',
                    startAngle: 210,
                    endAngle: -30,
                    min: 0,
                    max: 100,
                    radius: '85%',
                    pointer: { show: false },
                    progress: {
                        show: true,
                        width: 22,
                        roundCap: true,
                        itemStyle: {
                            color: {
                                type: 'linearGradient',
                                x: 0, y: 0, x2: 1, y2: 1,
                                colorStops: [
                                    { offset: 0, color: this.shadeColor(colorHex, 30) },
                                    { offset: 1, color: colorHex }
                                ]
                            },
                            shadowBlur: 14,
                            shadowColor: 'rgba(0,0,0,0.6)',
                            shadowOffsetY: 6
                        }
                    },
                    axisLine: {
                        lineStyle: {
                            width: 22,
                            color: [[1, 'rgba(148,163,184,0.15)']],
                            shadowBlur: 6,
                            shadowColor: 'rgba(0,0,0,0.4)'
                        }
                    },
                    axisTick: { show: false },
                    splitLine: { show: false },
                    axisLabel: { show: false },
                    anchor: { show: false },
                    detail: {
                        fontSize: 42,
                        fontWeight: 'bold',
                        color: '#f8fafc',
                        offsetCenter: [0, 0],
                        formatter: '{value}%'
                    },
                    data: [{ value: percent }]
                }]
            });

            // animation:false ya renderiza el valor final de inmediato; un pequeño
            // margen asegura que el canvas terminó de pintar antes de exportarlo.
            setTimeout(() => {
                const url = chart.getDataURL({ pixelRatio: 3, backgroundColor: 'transparent' });
                chart.dispose();
                document.body.removeChild(holder);
                resolve(url);
            }, 80);
        });
    }

    // --- REPORTES: Excel (incluye Bitácora de Avances) ---

    async generateExcelReport() {
        const ids = this.reportProjectIds || this.projects.filter(p => p.selected).map(p => p.id);
        const selected = this.projects.filter(p => ids.includes(p.id) && p.selected);
        if (!selected.length) return this.showToast("Marca al menos un proyecto en la tabla");

        const includeBitacora = document.getElementById('includeBitacoraCheck')?.checked ?? true;
        const btn = document.getElementById('excelReportBtn');
        if (btn) btn.disabled = true;
        this.showToast("Generando Excel...");

        try {
            const infraData = selected.map(p => ({
                'ID Core': p.id,
                'Proyecto': p.name,
                'Criticidad': p.level,
                'Progreso': `${p.progress}%`,
                'Responsable': p.lead
            }));

            const wb = XLSX.utils.book_new();
            const wsInfra = XLSX.utils.json_to_sheet(infraData);
            XLSX.utils.book_append_sheet(wb, wsInfra, "Infraestructura");

            if (includeBitacora) {
                const bitacoraRows = [];
                for (const p of selected) {
                    try {
                        const updates = await this.apiClient.getProjectUpdates(p.id);
                        if (!updates || updates.length === 0) {
                            bitacoraRows.push({
                                'ID Proyecto': p.id,
                                'Proyecto': p.name,
                                'Fecha': '',
                                'Hora': '',
                                'Nota': '(Sin avances registrados)',
                                'Archivos Adjuntos': ''
                            });
                        } else {
                            updates.forEach(u => {
                                const d = new Date(u.createdAt);
                                bitacoraRows.push({
                                    'ID Proyecto': p.id,
                                    'Proyecto': p.name,
                                    'Fecha': d.toLocaleDateString('es-MX'),
                                    'Hora': d.toLocaleTimeString('es-MX'),
                                    'Nota': u.note,
                                    'Archivos Adjuntos': (u.files || []).map(f => f.fileName || f.fileUrl).join('; ')
                                });
                            });
                        }
                    } catch (err) {
                        bitacoraRows.push({
                            'ID Proyecto': p.id,
                            'Proyecto': p.name,
                            'Fecha': '',
                            'Hora': '',
                            'Nota': `(Error al cargar bitácora: ${err.message})`,
                            'Archivos Adjuntos': ''
                        });
                    }
                }
                const wsBitacora = XLSX.utils.json_to_sheet(bitacoraRows);
                XLSX.utils.book_append_sheet(wb, wsBitacora, "Bitácora de Avances");
            }

            XLSX.writeFile(wb, `Reporte_Infraestructura_${Date.now()}.xlsx`);
            this.showToast("Excel generado con éxito");
        } catch (err) {
            this.showToast(`Error al generar Excel: ${err.message}`);
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    // --- REPORTES: PDF con tema de ciberseguridad + gauges 3D ---

    buildBitacoraHtml(updates) {
        if (!updates || updates.length === 0) {
            return `<div style="margin-top:10px;padding-top:8px;border-top:1px solid #1f2f47;color:#64748b;font-size:11px;font-style:italic;">Sin avances registrados en la bitácora.</div>`;
        }
        const rows = updates.map(u => {
            const d = new Date(u.createdAt).toLocaleString('es-MX');
            const files = (u.files || [])
                .map(f => `<span style="color:#22d3ee;">&#128206; ${this.escapeHtml(f.fileName || 'archivo')}</span>`)
                .join(' &nbsp; ');
            return `
                <div style="padding:5px 0;border-bottom:1px dashed #1f2f47;font-size:11px;">
                    <span style="color:#94a3b8;font-family:monospace;">${d}</span>
                    <div style="color:#e2e8f0;margin-top:2px;">${this.escapeHtml(u.note)}</div>
                    ${files ? `<div style="margin-top:2px;">${files}</div>` : ''}
                </div>
            `;
        }).join('');

        return `
            <div style="margin-top:10px;padding-top:8px;border-top:1px solid #1f2f47;">
                <div style="color:#22d3ee;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">
                    &#128203; Bitácora de Avances
                </div>
                ${rows}
            </div>
        `;
    }

    buildPdfHtml(selected, gaugeImages, bitacoraByProject, includeBitacora) {
        const now = new Date().toLocaleString('es-MX');

        const levelBadge = (level) => {
            const color = this.getLevelColor(level);
            return `<span style="background:${color};color:#0a0e17;font-weight:700;font-size:10px;padding:3px 10px;border-radius:4px;letter-spacing:0.5px;">${level}</span>`;
        };

        const cards = selected.map(p => `
            <div style="background:#111c2e;border:1px solid #1f2f47;border-left:4px solid ${this.getLevelColor(p.level)};border-radius:8px;padding:16px;margin-bottom:14px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                    <div>
                        <div style="font-family:monospace;color:#22d3ee;font-size:11px;letter-spacing:1px;">${p.id}</div>
                        <div style="color:#f8fafc;font-size:16px;font-weight:700;">${this.escapeHtml(p.name)}</div>
                    </div>
                    ${levelBadge(p.level)}
                </div>
                <div style="display:flex;gap:16px;align-items:center;margin-top:8px;">
                    <img src="${gaugeImages[p.id]}" style="width:100px;height:100px;" />
                    <div style="flex:1;color:#94a3b8;font-size:12px;">
                        <div><strong style="color:#e2e8f0;">Responsable:</strong> ${this.escapeHtml(p.lead || '-')}</div>
                        <div><strong style="color:#e2e8f0;">Progreso:</strong> ${p.progress}%</div>
                    </div>
                </div>
                ${includeBitacora ? this.buildBitacoraHtml(bitacoraByProject[p.id]) : ''}
            </div>
        `).join('');

        return `
            <div style="font-family:'Inter',Arial,sans-serif;background:#0a0e17;color:#f8fafc;padding:28px;width:756px;">
                <div style="display:flex;align-items:center;gap:10px;border-bottom:2px solid #22d3ee;padding-bottom:14px;margin-bottom:18px;">
                    <div>
                        <div style="font-size:20px;font-weight:800;color:#22d3ee;letter-spacing:1px;">
                            &#128737; REPORTE DE INFRAESTRUCTURA
                        </div>
                        <div style="color:#64748b;font-size:11px;">Ecosistema Global de Proyectos &middot; Generado ${now}</div>
                    </div>
                </div>
                ${cards}
            </div>
        `;
    }

    async generatePdfReport() {
        const ids = this.reportProjectIds || this.projects.filter(p => p.selected).map(p => p.id);
        const selected = this.projects.filter(p => ids.includes(p.id) && p.selected);
        if (!selected.length) return this.showToast("Marca al menos un proyecto en la tabla");

        if (!window.jspdf || !window.html2canvas) {
            return this.showToast("No se pudo cargar el motor de PDF (revisa tu conexión a internet)");
        }

        const includeBitacora = document.getElementById('includeBitacoraCheck')?.checked ?? true;
        const btn = document.getElementById('pdfReportBtn');
        if (btn) btn.disabled = true;
        this.showToast("Generando PDF...");

        const container = document.getElementById('pdfReportContainer');

        try {
            // 1. Gauges 3D por proyecto
            const gaugeImages = {};
            for (const p of selected) {
                gaugeImages[p.id] = await this.renderGaugeImage(p.progress, this.getLevelColor(p.level));
            }

            // 2. Bitácora por proyecto (opcional)
            const bitacoraByProject = {};
            if (includeBitacora) {
                for (const p of selected) {
                    try {
                        bitacoraByProject[p.id] = await this.apiClient.getProjectUpdates(p.id);
                    } catch (err) {
                        bitacoraByProject[p.id] = [];
                    }
                }
            }

            // 3. Armar el HTML con el tema de ciberseguridad
            container.innerHTML = this.buildPdfHtml(selected, gaugeImages, bitacoraByProject, includeBitacora);

            // Pequeño margen para que el navegador termine de pintar/decodificar
            // las imágenes de los gauges antes de capturar el contenedor.
            await new Promise(resolve => setTimeout(resolve, 150));

            // 4. Capturar el contenedor como imagen (respeta colores/estilos reales)
            const canvas = await html2canvas(container, {
                scale: 2,
                backgroundColor: '#0a0e17',
                useCORS: true,
                windowWidth: container.scrollWidth,
                windowHeight: container.scrollHeight
            });

            // 5. Insertar la imagen en el PDF, partiéndola en páginas A4 si es necesario
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'pt', 'a4');
            const imgData = canvas.toDataURL('image/png');

            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const imgWidth = pageWidth;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            let heightLeft = imgHeight;
            let position = 0;

            doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            while (heightLeft > 0) {
                position -= pageHeight;
                doc.addPage();
                doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            doc.save(`Reporte_Infraestructura_${Date.now()}.pdf`);
            this.showToast("PDF generado con éxito");
        } catch (err) {
            this.showToast(`Error al generar PDF: ${err.message}`);
        } finally {
            container.innerHTML = '';
            if (btn) btn.disabled = false;
        }
    }
}

const monitor = new InfrastructureMonitor();
window.onload = () => monitor.init();