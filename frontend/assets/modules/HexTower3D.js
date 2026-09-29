class HexTower3D {
  constructor() {
    this.items = new Map();
    this.page = 0;
    this.pageSize = 5;
    this.dashboardDataTimer = null;
    this.filteredProjects = null;
    this.injectProfessionalDashboard();
  }

  register(id, progress, color, topColor) {
    this.items.set(id, { progress: Number(progress) || 0, color, topColor });
  }

  pruneTo(ids) {
    const keep = new Set(ids || []);
    for (const id of this.items.keys()) if (!keep.has(id)) this.items.delete(id);
  }

  injectProfessionalDashboard() {
    if (document.getElementById('cm-dashboard')) return;

    document.body.classList.add('cm-professional-dashboard');

    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = './assets/styles/dashboard-redesign.css?v=20260928-1';
    document.head.appendChild(css);

    const visual = document.createElement('style');
    visual.id = 'cm-dashboard-ring-bars-style';
    visual.textContent = `
      #cm-dashboard{position:relative;z-index:10}
      #cm-projects-panel{overflow:hidden}
      #cm-projects-panel .cm-panel-head{align-items:flex-start}
      #cm-projects-panel .cm-cylinders{display:block!important;height:auto!important;min-height:0!important;padding:18px!important;background:transparent!important}
      .cm-project-analytics{display:grid;grid-template-columns:minmax(270px,330px) minmax(420px,1fr);grid-template-rows:auto auto;gap:18px 28px;align-items:center;min-height:430px}
      .cm-project-ring-area{position:relative;display:grid;place-items:center;min-height:300px}
      .cm-project-ring{width:min(300px,100%);aspect-ratio:1;display:block;filter:drop-shadow(0 0 18px rgba(0,218,255,.10))}
      .cm-ring-track{fill:none;stroke:#122a3d;stroke-width:42}
      .cm-ring-segment{fill:none;stroke-width:42;cursor:pointer;transition:filter .2s,opacity .2s;outline:none}
      .cm-ring-segment:hover{filter:drop-shadow(0 0 10px currentColor);opacity:1}
      .cm-ring-center{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none;text-align:center}
      .cm-ring-center-inner{width:120px;height:120px;border-radius:50%;display:grid;place-items:center;align-content:center;background:radial-gradient(circle,#0c2a40 0%,#061524 72%);border:1px solid rgba(50,208,239,.28);box-shadow:inset 0 0 24px rgba(0,198,255,.10),0 0 25px rgba(0,198,255,.08)}
      .cm-ring-center-value{font-size:32px;font-weight:800;line-height:1;color:#edf9ff}
      .cm-ring-center-label{margin-top:5px;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#76a6bf}
      .cm-ring-icon{position:absolute;display:grid;place-items:center;width:42px;height:42px;margin:-21px 0 0 -21px;border-radius:50%;border:1px solid rgba(255,255,255,.28);background:#0a2132;color:#fff;box-shadow:0 0 15px currentColor;pointer-events:auto;cursor:pointer;transition:transform .2s}
      .cm-ring-icon:hover{transform:scale(1.12)}
      .cm-ring-icon i{font-size:20px}
      .cm-ring-icon-0{left:50%;top:6%}.cm-ring-icon-1{left:90%;top:38%}.cm-ring-icon-2{left:74%;top:84%}.cm-ring-icon-3{left:26%;top:84%}.cm-ring-icon-4{left:10%;top:38%}
      .cm-project-bars{display:flex;flex-direction:column;gap:10px;min-width:0}
      .cm-project-bar{display:grid;grid-template-columns:minmax(125px,165px) minmax(130px,1fr) 50px;align-items:center;gap:12px;min-height:43px;padding:6px 10px;border:1px solid rgba(39,125,160,.24);border-radius:9px;background:rgba(4,22,36,.45);cursor:pointer;transition:border-color .2s,background .2s,transform .2s}
      .cm-project-bar:hover{border-color:rgba(45,215,239,.55);background:rgba(6,31,49,.72);transform:translateX(2px)}
      .cm-project-bar-name{display:flex;align-items:center;gap:9px;min-width:0;color:#dceefa;font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .cm-project-bar-dot{width:9px;height:9px;flex:0 0 9px;border-radius:50%;box-shadow:0 0 9px currentColor}
      .cm-progress-track{height:14px;overflow:hidden;border-radius:999px;background:#10283a;box-shadow:inset 0 1px 4px rgba(0,0,0,.45)}
      .cm-progress-fill{height:100%;border-radius:999px;min-width:2px;box-shadow:0 0 10px currentColor;transition:width .45s ease}
      .cm-project-bar-value{text-align:right;color:#eaf8ff;font-size:13px;font-weight:800}
      .cm-project-mini-rings{grid-column:1/-1;display:grid;grid-template-columns:repeat(5,minmax(90px,1fr));gap:0;border-top:1px solid rgba(43,163,192,.20);padding-top:16px;margin-top:0}
      .cm-mini-ring-card{display:flex;align-items:center;justify-content:center;gap:9px;min-width:0;padding:2px 10px;border-right:1px solid rgba(43,163,192,.16);cursor:pointer}
      .cm-mini-ring-card:last-child{border-right:0}
      .cm-mini-ring{--p:0%;--c:#12c9ff;width:54px;height:54px;flex:0 0 54px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(var(--c) var(--p),#173144 0);box-shadow:0 0 14px color-mix(in srgb,var(--c) 35%,transparent)}
      .cm-mini-ring:after{content:"";width:40px;height:40px;border-radius:50%;background:#071827;border:1px solid rgba(255,255,255,.08);grid-area:1/1}
      .cm-mini-ring-value{grid-area:1/1;z-index:1;font-size:10px;font-weight:800;color:#f1fbff}
      .cm-mini-ring-name{max-width:110px;min-width:0;color:#9fc0d2;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .cm-project-pager{grid-column:1/-1;display:flex;align-items:center;justify-content:center;gap:12px;padding-top:2px}
      .cm-project-pager button{border:1px solid #1b607b;border-radius:7px;background:#092236;color:#ccecf5;padding:7px 12px;font-size:12px;cursor:pointer}
      .cm-project-pager button:hover:not(:disabled){border-color:#20d8ef;background:#0b2e45}
      .cm-project-pager button:disabled{opacity:.35;cursor:not-allowed}
      .cm-project-pager span{color:#6f98ad;font-size:11px}
      .cm-ring-empty{grid-column:1/-1;min-height:300px;display:grid;place-items:center;color:#7898aa;font-size:14px}
      @media(max-width:980px){
        .cm-project-analytics{grid-template-columns:1fr;grid-template-rows:auto}
        .cm-project-ring-area{min-height:280px}
        .cm-project-ring{width:270px}
        .cm-project-bars{width:100%}
        .cm-project-mini-rings{grid-template-columns:repeat(5,minmax(80px,1fr));overflow-x:auto}
        .cm-mini-ring-card{min-width:120px}
      }
      @media(max-width:620px){
        .cm-project-analytics{gap:14px}
        .cm-project-bar{grid-template-columns:1fr 52px;gap:8px}
        .cm-progress-track{grid-column:1/-1;grid-row:2}
        .cm-project-bar-value{grid-column:2;grid-row:1}
        .cm-project-mini-rings{grid-template-columns:repeat(5,120px);overflow-x:auto}
      }
    `;
    document.head.appendChild(visual);

    const old = document.querySelector('.container-xl');
    if (old) old.style.display = 'none';
    const oldFooter = document.querySelector('.footer');
    if (oldFooter) oldFooter.style.display = 'none';
    const bg = document.getElementById('canvas-container');
    if (bg) bg.style.opacity = '.08';

    const el = document.createElement('section');
    el.id = 'cm-dashboard';
    el.className = 'cm-shell';
    el.innerHTML = `
      <aside class="cm-sidebar">
        <div class="cm-brand"><div class="cm-brand-mark"><i class="ti ti-hexagon-3d"></i></div><div><strong>PROJECT ADMIN</strong><small>COSMIC MATRIX</small></div></div>
        <nav class="cm-nav">
          <a class="active" href="#cm-dashboard"><i class="ti ti-layout-dashboard"></i><span>Dashboard</span></a>
          <a href="#cm-projects-panel"><i class="ti ti-briefcase"></i><span>Proyectos</span></a>
          <a href="#cm-activity"><i class="ti ti-timeline-event"></i><span>Bitácora</span></a>
          <a href="#cm-reports" onclick="monitor.generateReport()"><i class="ti ti-report-analytics"></i><span>Reportes</span></a>
          <a href="#cm-files"><i class="ti ti-files"></i><span>Archivos</span></a>
          <a href="#cm-settings"><i class="ti ti-settings"></i><span>Configuración</span></a>
        </nav>
        <div class="cm-sidebar-footer"><strong>COSMIC MATRIX</strong><br>Gestión de proyectos con visión de futuro<br><br>v3.5.0</div>
      </aside>
      <main class="cm-main">
        <header class="cm-topbar"><div class="cm-search"><i class="ti ti-search"></i><input id="cm-search-input" placeholder="Buscar proyecto, responsable, etiqueta..." autocomplete="off"></div><div class="cm-top-actions"><button class="cm-icon-btn" onclick="monitor.toggleTheme()" title="Tema"><i class="ti ti-sun"></i></button><button class="cm-icon-btn position-relative" title="Notificaciones"><i class="ti ti-bell"></i><span class="position-absolute top-0 end-0 badge rounded-pill bg-danger" style="font-size:8px">3</span></button><div class="cm-avatar">CA</div><div class="cm-profile"><div>Carlos Alberto<small>Administrador</small></div><i class="ti ti-chevron-down"></i></div></div></header>
        <section class="cm-kpis" id="cm-kpis"></section>
        <section class="cm-panel" id="cm-projects-panel"><div class="cm-panel-head"><div><div class="cm-panel-title"><i class="ti ti-chart-dots-3"></i> PROGRESO DE PROYECTOS</div><div class="cm-panel-subtitle">Estado general y avance de cada proyecto</div></div><div class="cm-toggle"><button class="active" id="cm-view-towers">Vista de Proyectos</button><button id="cm-view-list">Lista</button><button id="cm-view-summary">Resumen</button></div></div><div class="cm-cylinders" id="cm-cylinders"><div class="cm-loading">Sincronizando proyectos...</div></div></section>
        <section class="cm-lower"><article class="cm-panel"><div class="cm-panel-head"><div><div class="cm-panel-title">EVOLUCIÓN DEL AVANCE</div><div class="cm-panel-subtitle">Tendencia del avance promedio</div></div><span class="cm-badge" style="color:var(--cm-cyan)">Últimos 30 días</span></div><div class="cm-chart" id="cm-evolution"></div></article><article class="cm-panel"><div class="cm-panel-head"><div><div class="cm-panel-title">PROYECTOS CRÍTICOS</div><div class="cm-panel-subtitle">Requieren atención inmediata</div></div><span class="badge rounded-pill bg-danger" id="cm-risk-count">0</span></div><div class="cm-risk-list" id="cm-risks"></div></article><article class="cm-panel" id="cm-activity"><div class="cm-panel-head"><div><div class="cm-panel-title">ACTIVIDAD RECIENTE</div><div class="cm-panel-subtitle">Últimos cambios detectados</div></div><span class="cm-badge" style="color:var(--cm-cyan)">En vivo</span></div><div class="cm-activity" id="cm-activity-list"></div></article></section>
      </main>`;
    document.body.appendChild(el);

    document.getElementById('cm-search-input')?.addEventListener('input', e => {
      this.page = 0;
      this.filterProjects(e.target.value);
    });
    document.getElementById('cm-view-list')?.addEventListener('click', () => this.renderListView());
    document.getElementById('cm-view-summary')?.addEventListener('click', () => this.renderSummaryView());
    document.getElementById('cm-view-towers')?.addEventListener('click', () => this.renderCylinders());

    this.renderDashboardShell();
    this.waitForLiveData();
  }

  waitForLiveData() {
    if (this.dashboardDataTimer) clearInterval(this.dashboardDataTimer);
    let attempts = 0;
    const hydrate = () => {
      attempts++;
      this.renderDashboardShell();
      const projects = this.getProjects();
      if (projects.length || attempts >= 120) {
        clearInterval(this.dashboardDataTimer);
        this.dashboardDataTimer = null;
      }
    };
    hydrate();
    this.dashboardDataTimer = setInterval(hydrate, 250);
  }

  getProjects() {
    try {
      return (typeof monitor !== 'undefined' && Array.isArray(monitor.projects)) ? monitor.projects : [];
    } catch (_) { return []; }
  }

  escape(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[c]));
  }

  color(project) {
    const map = { CRÍTICA:'#ff3d63', ALTA:'#ffb52e', NORMAL:'#00e6a1', BAJA:'#a45cff' };
    return map[project.level] || '#12c9ff';
  }

  status(project) {
    if (project.status) return project.status;
    if (project.level === 'CRÍTICA') return 'Crítico';
    if (project.level === 'ALTA') return 'Atención';
    if (Number(project.progress || 0) >= 90) return 'Completado';
    return 'En progreso';
  }

  renderDashboardShell() {
    this.renderKpis();
    this.renderCylinders();
    this.renderRisks();
    this.renderActivity();
    this.renderEvolution();
  }

  syncDashboard() { this.renderDashboardShell(); }

  renderKpis() {
    const ps = this.getProjects();
    const total = ps.length;
    const avg = total ? Math.round(ps.reduce((s,p) => s + Number(p.progress || 0), 0) / total) : 0;
    const risk = ps.filter(p => p.level === 'CRÍTICA' || p.level === 'ALTA').length;
    const delayed = ps.filter(p => Number(p.progress || 0) < 40).length;
    const data = [
      ['ti-briefcase', total, 'Total Proyectos', 'Datos sincronizados', 'var(--cm-blue)'],
      ['ti-chart-donut', avg + '%', 'Avance Promedio', 'Progreso global', 'var(--cm-cyan)'],
      ['ti-alert-circle', risk, 'En Riesgo', 'Requieren atención', 'var(--cm-red)'],
      ['ti-clock', delayed, 'Retrasados', 'Progreso menor al 40%', 'var(--cm-yellow)']
    ];
    const box = document.getElementById('cm-kpis');
    if (!box) return;
    box.innerHTML = data.map(x => `<article class="cm-kpi"><div class="cm-kpi-icon" style="color:${x[4]}"><i class="ti ${x[0]}"></i></div><div><div class="cm-kpi-value">${x[1]}</div><div class="cm-kpi-label">${x[2]}</div><div class="cm-kpi-trend">${x[3]}</div></div></article>`).join('');
  }

  polar(cx, cy, radius, angle) {
    const rad = (angle - 90) * Math.PI / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  }

  donutPath(cx, cy, radius, startAngle, endAngle) {
    const start = this.polar(cx, cy, radius, endAngle);
    const end = this.polar(cx, cy, radius, startAngle);
    const large = endAngle - startAngle <= 180 ? 0 : 1;
    return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 ${large} 0 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
  }

  ringIconFor(index) {
    return ['ti-file-text','ti-settings','ti-user','ti-bulb','ti-search'][index] || 'ti-folder';
  }

  renderCylinders(list = null) {
    const box = document.getElementById('cm-cylinders');
    if (!box) return;

    const source = Array.isArray(list) ? list : (this.filteredProjects || this.getProjects());
    const total = source.length;
    const pages = Math.max(1, Math.ceil(total / this.pageSize));
    this.page = Math.max(0, Math.min(this.page, pages - 1));
    const start = this.page * this.pageSize;
    const visible = source.slice(start, start + this.pageSize);

    if (!visible.length) {
      box.innerHTML = '<div class="cm-ring-empty">Esperando datos de proyectos...</div>';
      return;
    }

    const cx = 150, cy = 150, radius = 108, gap = 3.2, segmentSize = 72;
    const colors = visible.map(p => this.color(p));
    const ringPaths = visible.map((p, i) => {
      const startAngle = i * segmentSize + gap / 2;
      const endAngle = (i + 1) * segmentSize - gap / 2;
      return `<path class="cm-ring-segment" data-project-index="${i}" d="${this.donutPath(cx,cy,radius,startAngle,endAngle)}" stroke="${colors[i]}" style="color:${colors[i]}" opacity=".96"></path>`;
    }).join('');

    const icons = visible.map((p, i) => `<button type="button" class="cm-ring-icon cm-ring-icon-${i}" data-project-index="${i}" title="Abrir bitácora de ${this.escape(p.name)}" style="color:${colors[i]}"><i class="ti ${this.ringIconFor(i)}"></i></button>`).join('');

    const bars = visible.map((p, i) => {
      const progress = Math.max(0, Math.min(100, Number(p.progress) || 0));
      const color = colors[i];
      const globalIndex = this.getProjects().findIndex(x => x.id === p.id);
      return `<button type="button" class="cm-project-bar" data-project-index="${globalIndex}" title="Abrir bitácora de ${this.escape(p.name)}">
        <span class="cm-project-bar-name"><span class="cm-project-bar-dot" style="color:${color};background:${color}"></span>${this.escape(p.name)}</span>
        <span class="cm-progress-track"><span class="cm-progress-fill" style="width:${progress}%;background:${color};color:${color}"></span></span>
        <span class="cm-project-bar-value">${progress}%</span>
      </button>`;
    }).join('');

    const minis = visible.map((p, i) => {
      const progress = Math.max(0, Math.min(100, Number(p.progress) || 0));
      const color = colors[i];
      const globalIndex = this.getProjects().findIndex(x => x.id === p.id);
      return `<button type="button" class="cm-mini-ring-card" data-project-index="${globalIndex}" title="Abrir bitácora de ${this.escape(p.name)}">
        <span class="cm-mini-ring" style="--p:${progress}%;--c:${color}"><span class="cm-mini-ring-value">${progress}%</span></span>
        <span class="cm-mini-ring-name">${this.escape(p.name)}</span>
      </button>`;
    }).join('');

    const pager = total > this.pageSize ? `<div class="cm-project-pager"><button type="button" id="cm-project-prev" ${this.page <= 0 ? 'disabled' : ''}>‹ Anterior</button><span>${start + 1}–${Math.min(start + this.pageSize, total)} de ${total} proyectos</span><button type="button" id="cm-project-next" ${this.page >= pages - 1 ? 'disabled' : ''}>Siguiente ›</button></div>` : '';

    box.innerHTML = `
      <div class="cm-project-analytics">
        <div class="cm-project-ring-area">
          <svg class="cm-project-ring" viewBox="0 0 300 300" role="img" aria-label="Distribución de proyectos">
            <circle class="cm-ring-track" cx="150" cy="150" r="108"></circle>
            ${ringPaths}
          </svg>
          <div class="cm-ring-center"><div class="cm-ring-center-inner"><div class="cm-ring-center-value">${visible.length}</div><div class="cm-ring-center-label">Proyectos activos</div></div></div>
          ${icons}
        </div>
        <div class="cm-project-bars">${bars}</div>
        <div class="cm-project-mini-rings">${minis}</div>
        ${pager}
      </div>`;

    box.querySelectorAll('[data-project-index]').forEach(el => {
      el.addEventListener('click', () => {
        const idx = Number(el.getAttribute('data-project-index'));
        if (Number.isInteger(idx) && typeof monitor?.openBitacora === 'function') monitor.openBitacora(idx);
      });
    });

    document.getElementById('cm-project-prev')?.addEventListener('click', () => this.prevPage());
    document.getElementById('cm-project-next')?.addEventListener('click', () => this.nextPage());
  }

  nextPage() {
    const total = (this.filteredProjects || this.getProjects()).length;
    if (!total) return;
    this.page = Math.min(this.page + 1, Math.ceil(total / this.pageSize) - 1);
    this.renderCylinders();
  }

  prevPage() {
    this.page = Math.max(0, this.page - 1);
    this.renderCylinders();
  }

  renderListView() {
    const box = document.getElementById('cm-cylinders');
    if (!box) return;
    const ps = this.filteredProjects || this.getProjects();
    box.innerHTML = ps.map((p, i) => `<button type="button" class="cm-risk-item" onclick="monitor.openBitacora(${this.getProjects().findIndex(x=>x.id===p.id)})" style="grid-column:1/-1;cursor:pointer;text-align:left"><div class="cm-risk-bar" style="background:${this.color(p)};color:${this.color(p)}"></div><div class="cm-risk-main"><strong>${this.escape(p.name)}</strong><small>${this.escape(p.description || 'Proyecto')}</small></div><strong>${Number(p.progress || 0)}%</strong><span class="cm-badge" style="color:${this.color(p)}">${this.escape(this.status(p))}</span></button>`).join('') || '<div class="cm-loading">No hay proyectos.</div>';
  }

  renderSummaryView() {
    const ps = this.filteredProjects || this.getProjects();
    const box = document.getElementById('cm-cylinders');
    if (!box) return;
    const avg = ps.length ? Math.round(ps.reduce((s,p) => s + Number(p.progress || 0), 0) / ps.length) : 0;
    box.innerHTML = `<div class="cm-ring-empty"><div style="text-align:center"><div style="font-size:56px;font-weight:800;color:#e7f4ff;text-shadow:0 0 24px var(--cm-cyan)">${avg}%</div><div style="color:#7ea3bf;margin-bottom:14px">Avance promedio de ${ps.length} proyectos</div><button type="button" class="cm-more-btn" onclick="window.hexTower3D.renderCylinders()">Volver a proyectos</button></div></div>`;
  }

  renderRisks() {
    const all = this.getProjects();
    const ps = all.filter(p => p.level === 'CRÍTICA' || p.level === 'ALTA').sort((a,b) => Number(a.progress || 0) - Number(b.progress || 0)).slice(0,4);
    const box = document.getElementById('cm-risks');
    if (!box) return;
    const count = document.getElementById('cm-risk-count');
    if (count) count.textContent = all.filter(p => p.level === 'CRÍTICA' || p.level === 'ALTA').length;
    box.innerHTML = ps.map(p => {
      const c = this.color(p);
      const idx = all.findIndex(x => x.id === p.id);
      return `<button type="button" class="cm-risk-item" onclick="monitor.openBitacora(${idx})" style="cursor:pointer;text-align:left"><div class="cm-risk-bar" style="background:${c};color:${c}"></div><div class="cm-risk-main"><strong>${this.escape(p.name)}</strong><small>${this.escape(p.description || 'Proyecto')}</small></div><strong>${Number(p.progress || 0)}%</strong><span class="cm-badge" style="color:${c}">${p.level === 'CRÍTICA' ? 'Crítico' : 'Atención'}</span></button>`;
    }).join('') || '<div class="text-muted small p-3">No hay proyectos de alta prioridad.</div>';
  }

  renderActivity() {
    const ps = this.getProjects();
    const box = document.getElementById('cm-activity-list');
    if (!box) return;
    let events = [];
    try { if (Array.isArray(monitor.activityLog)) events = monitor.activityLog.slice(-5).reverse(); } catch (_) {}
    if (!events.length) events = ps.slice(0,5).map((p,i) => ({ name:p.name, detail:`Estado ${this.status(p)} · avance ${Number(p.progress || 0)}%`, time:i === 0 ? 'Ahora' : `Hace ${i} h`, color:this.color(p) }));
    box.innerHTML = events.map((e,i) => `<button type="button" class="cm-activity-item" onclick="monitor.openBitacora(${this.getProjects().findIndex(p=>p.name===e.name)})" style="cursor:pointer;text-align:left"><span class="cm-activity-dot" style="color:${e.color || 'var(--cm-cyan)'};background:${e.color || 'var(--cm-cyan)'}"></span><div><strong>${this.escape(e.name || e.project || 'Proyecto')}</strong><small>${this.escape(e.detail || 'Actividad registrada')}</small></div><time>${this.escape(e.time || 'Ahora')}</time></button>`).join('') || '<div class="text-muted small p-3">Sin actividad reciente.</div>';
  }

  renderEvolution() {
    const el = document.getElementById('cm-evolution');
    if (!el || typeof echarts === 'undefined') return;
    const ps = this.getProjects();
    const avg = ps.length ? Math.round(ps.reduce((s,p) => s + Number(p.progress || 0), 0) / ps.length) : 0;
    if (!this.evolutionChart) this.evolutionChart = echarts.init(el);
    this.evolutionChart.setOption({
      animation:false,
      grid:{left:40,right:8,top:10,bottom:25},
      xAxis:{type:'category',data:['-30d','-25d','-20d','-15d','-10d','-5d','Hoy'],axisLabel:{color:'#6f96ad'},axisLine:{lineStyle:{color:'#29475b'}},splitLine:{show:false}},
      yAxis:{type:'value',min:0,max:100,interval:20,axisLabel:{color:'#6f96ad',formatter:'{value}%'},splitLine:{lineStyle:{color:'rgba(109,150,173,.18)'}},axisLine:{show:false}},
      series:[{type:'line',data:[Math.max(0,avg-24),Math.max(0,avg-18),Math.max(0,avg-13),Math.max(0,avg-9),Math.max(0,avg-5),Math.max(0,avg-2),avg],smooth:.35,symbol:'circle',symbolSize:5,lineStyle:{color:'#16d9ef',width:2},itemStyle:{color:'#16d9ef'},areaStyle:{color:'rgba(22,217,239,.08)'}}]
    });
  }

  filterProjects(term) {
    const q = String(term || '').trim().toLowerCase();
    this.filteredProjects = q ? this.getProjects().filter(p => `${p.name || ''} ${p.lead || ''} ${p.description || ''} ${p.status || ''}`.toLowerCase().includes(q)) : null;
    this.page = 0;
    this.renderCylinders();
  }
}
