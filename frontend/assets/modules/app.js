class InfrastructureMonitor {
    constructor() {
        // Datos base del clúster (30 registros)
        this.apiClient = new FetchManager('https://cosmic-matrix-back.onrender.com');
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

        // --- PALETAS ULTRA-CONTRASTE PARA MODO OSCURO ---
        const DARK_PALETTES = [
            { head: '#ffffff', body: '#00f2ff', trail: 'rgba(0,242,255,' },   // cian cyber
            { head: '#fff0ff', body: '#b46bff', trail: 'rgba(180,107,255,' }, // violeta neon
            { head: '#fffae0', body: '#ffb84d', trail: 'rgba(255,184,77,' },  // dorado premium
        ];

        // --- PALETAS ELEGANTES DE ALTO CONTRASTE PARA MODO CLARO ---
        const LIGHT_PALETTES = [
            { head: '#0f172a', body: '#0284c7', trail: 'rgba(2,132,199,' },   // azul corporativo profundo
            { head: '#1e1b4b', body: '#7c3aed', trail: 'rgba(124,58,237,' },  // indigo/violeta ejecutivo
            { head: '#1c1917', body: '#d97706', trail: 'rgba(217,119,6,' },   // bronce/ámbar sofisticado
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
            if (dt < 28) return; // ~35 fps
            lastTime = ts;

            const isDarkNow = document.documentElement.getAttribute('data-bs-theme') === 'dark';

            // 1. Seleccionar paleta basándose en el estado exacto del DOM
            const activePalettes = isDarkNow ? DARK_PALETTES : LIGHT_PALETTES;

            // Limpieza controlada de rastro (Evita la sobresaturación de gris en light mode)
            ctx.fillStyle = isDarkNow ? 'rgba(1,5,9,0.18)' : 'rgba(247,249,251,0.28)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.font = `${FONT_SIZE}px "Fira Code", monospace`;

            for (let i = 0; i < cols; i++) {
                const pal = activePalettes[dropPalette[i]]; // <-- Usa la paleta correspondiente
                const y = drops[i] * FONT_SIZE;
                const char = CHARS[Math.floor(Math.random() * CHARS.length)];

                // Carácter cabeza (Líder de la gota)
                if (y > 0 && y < canvas.height) {
                    ctx.shadowBlur = isDarkNow ? 8 : 0; // El modo claro no lleva resplandor (glow)
                    ctx.shadowColor = pal.body;
                    ctx.fillStyle = pal.head;
                    ctx.fillText(char, i * FONT_SIZE, y);
                    ctx.shadowBlur = 0;
                }

                // Estela / Rastro ascendente
                for (let k = 1; k < dropLength[i]; k++) {
                    const ky = y - k * FONT_SIZE;
                    if (ky < 0) continue;
                    const alpha = Math.max(0, 1 - k / dropLength[i]);
                    const trailChar = CHARS[Math.floor(Math.random() * CHARS.length)];

                    // Modificamos la opacidad base multiplicadora para que en light mode sea legible pero fino
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

        // Ajustar dinámicamente la opacidad física del lienzo
        const matrixCanvas = document.getElementById('matrix-canvas');
        if (matrixCanvas) {
            // Le damos 0.15 al modo claro para compensar la falta de brillo de los colores oscuros
            matrixCanvas.style.opacity = nextTheme === 'dark' ? '0.35' : '0.15';

            // Limpieza inmediata del búfer de dibujo previo
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
                borderClass = 'border-start border-danger border-1';}
                if(p.level === 'NORMAL') {
                    colorHex='#10b981';
                    borderClass='border-start border-success border-1';
                }
                if(p.level === 'BAJA'){
                    colorHex='#8443c0';
                    borderClass='border-start border-success border-1';
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
            { label: 'Proyectos Bajo', count: counts.BAJA, style: 'stat-baja', icon: 'ti-circle-check text-success'},
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
        const counts = { CRÍTICA: 0, ALTA: 0, NORMAL: 0 , BAJA: 0};
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
                    { value: counts.BAJA, name: 'Baja', itemStyle: {color:' #7010b9'} } 

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
        document.getElementById('nodeIndex').value = index;
        document.getElementById('nodeName').value = p.name;
        document.getElementById('nodeLevel').value = p.level;
        document.getElementById('nodeProgress').value = p.progress;
        document.getElementById('nodeLead').value = p.lead;
        document.getElementById('deleteBtn').classList.remove('d-none');
        this.bsCrudModal.show();
    }

    openCreateModal() {
        document.getElementById('modalTitle').textContent = "Nuevo Proyecto";
        document.getElementById('nodeIndex').value = "NEW";
        document.getElementById('nodeName').value = "";
        document.getElementById('nodeLevel').value = "NORMAL";
        document.getElementById('nodeProgress').value = "0";
        document.getElementById('nodeLead').value = "";
        document.getElementById('deleteBtn').classList.add('d-none');
        this.bsCrudModal.show();
    }

    closeModal() {
        this.bsCrudModal.hide();
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

    executeDeleteNode() {
        if (this.indexToDelete !== null && this.indexToDelete !== "NEW") {
            this.projects.splice(this.indexToDelete, 1);
            this.showToast("Activo desconectado del clúster");
            this.closeConfirmModal();
            this.closeModal();

            const maxPage = Math.ceil(this.projects.length / this.itemsPerPage) - 1;
            if (this.currentPage > maxPage && this.currentPage > 0) {
                this.currentPage = maxPage;
            }

            this.renderDashboard();
        }
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

        // Seleccionamos el cuerpo del nuevo modal de reporte
        const modalBody = document.getElementById('reportModalBody');
        if (!modalBody) return;

        // Inyectamos la tabla (removimos los botones de cierre manual/impresión de aquí, 
        // ya que ahora viven de forma fija en el footer y el header del modal del HTML)
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
                            <th>Ingeniero a Cargo</th>
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

        // Mostramos el modal de forma interactiva
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