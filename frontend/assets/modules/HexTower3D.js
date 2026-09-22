class HexTower3D {
  constructor() {
    this.items = new Map();
    this.injectProfessionalDashboard();
  }

  register(id, progress, color, topColor) {
    this.items.set(id, { progress: Number(progress) || 0, color, topColor });
    this.syncDashboard();
  }

  pruneTo(ids) {
    const keep = new Set(ids || []);
    for (const id of this.items.keys()) if (!keep.has(id)) this.items.delete(id);
    this.syncDashboard();
  }

  injectProfessionalDashboard() {
    if (document.getElementById('cm-dashboard')) return;
    document.body.classList.add('cm-professional-dashboard');
    const old = document.querySelector('.container-xl');
    if (old) old.style.display = 'none';
    const bg = document.getElementById('canvas-container');
    if (bg) bg.style.opacity = '.22';

    const el = document.createElement('section');
    el.id = 'cm-dashboard';
    el.className = 'cm-shell';
    el.innerHTML = `
      <aside class="cm-sidebar">
        <div class="cm-brand"><div class="cm-brand-mark"><i class="ti ti-hexagon-3d"></i></div><div><strong>PROJECT ADMIN</strong><small>COSMIC MATRIX</small></div></div>
        <nav class="cm-nav">
          <a class="active" href="#cm-dashboard"><i class="ti ti-layout-dashboard"></i><span>Dashboard</span></a>
          <a href="#cm-projects" onclick="document.getElementById('cm-projects-panel')?.scrollIntoView({behavior:'smooth'})"><i class="ti ti-briefcase"></i><span>Proyectos</span></a>
          <a href="#cm-activity"><i class="ti ti-timeline-event"></i><span>Bitácora</span></a>
          <a href="#cm-reports" onclick="monitor.generateReport()"><i class="ti ti-report-analytics"></i><span>Reportes</span></a>
          <a href="#cm-files"><i class="ti ti-files"></i><span>Archivos</span></a>
          <a href="#cm-settings"><i class="ti ti-settings"></i><span>Configuración</span></a>
        </nav>
        <div class="cm-sidebar-footer"><strong>COSMIC MATRIX</strong><br>Gestión de proyectos con visión de futuro<br><br>v3.5.0</div>
      </aside>
      <main class="cm-main">
        <header class="cm-topbar">
          <div class="cm-search"><i class="ti ti-search"></i><input id="cm-search-input" placeholder="Buscar proyecto, responsable, etiqueta..." autocomplete="off"></div>
          <div class="cm-top-actions">
            <button class="cm-icon-btn" onclick="monitor.toggleTheme()" title="Tema"><i class="ti ti-sun"></i></button>
            <button class="cm-icon-btn position-relative" title="Notificaciones"><i class="ti ti-bell"></i><span class="position-absolute top-0 end-0 badge rounded-pill bg-danger" style="font-size:8px">3</span></button>
            <div class="cm-avatar">CA</div><div class="cm-profile"><div>Carlos Alberto<small>Administrador</small></div><i class="ti ti-chevron-down"></i></div>
          </div>
        </header>
        <section class="cm-kpis" id="cm-kpis"></section>
        <section class="cm-panel" id="cm-projects-panel">
          <div class="cm-panel-head"><div><div class="cm-panel-title"><i class="ti ti-chart-dots-3"></i> PROGRESO DE PROYECTOS</div><div class="cm-panel-subtitle">Estado general y avance de cada proyecto</div></div><div class="cm-toggle"><button class="active">Vista de Torres</button><button onclick="monitor.openCriticalityModal(null)">Lista</button><button onclick="monitor.openCriticalityModal(null)">Resumen</button></div></div>
          <div class="cm-cylinders" id="cm-cylinders"></div>
        </section>
        <section class="cm-lower">
          <article class="cm-panel"><div class="cm-panel-head"><div><div class="cm-panel-title">EVOLUCIÓN DEL AVANCE</div><div class="cm-panel-subtitle">Progreso promedio de los proyectos</div></div><span class="cm-badge" style="color:var(--cm-cyan)">Últimos 30 días</span></div><div class="cm-chart" id="cm-evolution"></div></article>
          <article class="cm-panel"><div class="cm-panel-head"><div><div class="cm-panel-title">PROYECTOS CRÍTICOS</div><div class="cm-panel-subtitle">Requieren atención inmediata</div></div><span class="badge rounded-pill bg-danger" id="cm-risk-count">0</span></div><div class="cm-risk-list" id="cm-risks"></div></article>
          <article class="cm-panel" id="cm-activity"><div class="cm-panel-head"><div><div class="cm-panel-title">ACTIVIDAD RECIENTE</div><div class="cm-panel-subtitle">Últimos cambios del sistema</div></div><span class="cm-badge" style="color:var(--cm-cyan)">Todas</span></div><div class="cm-activity" id="cm-activity-list"></div></article>
        </section>
      </main>`;
    document.body.appendChild(el);
    const input = document.getElementById('cm-search-input');
    input?.addEventListener('input', e => this.filterProjects(e.target.value));
    this.renderDashboardShell();
  }

  getProjects() { try { return (typeof monitor !== 'undefined' && monitor.projects) ? monitor.projects : []; } catch (_) { return []; } }
  escape(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
  color(p) { const m={CRÍTICA:'#ff5268',ALTA:'#ff9f43',NORMAL:'#14e6a5',BAJA:'#a66bff'}; return m[p.level] || '#16d9ff'; }

  renderDashboardShell() {
    this.renderKpis(); this.renderCylinders(); this.renderRisks(); this.renderActivity(); this.renderEvolution();
  }
  syncDashboard() { if (document.getElementById('cm-dashboard')) { this.renderKpis(); this.renderCylinders(); this.renderRisks(); this.renderActivity(); } }

  renderKpis() {
    const ps=this.getProjects(), total=ps.length, avg=total?Math.round(ps.reduce((s,p)=>s+Number(p.progress||0),0)/total):0;
    const risk=ps.filter(p=>p.level==='CRÍTICA'||p.level==='ALTA').length;
    const delayed=ps.filter(p=>Number(p.progress||0)<40).length;
    const data=[['ti-briefcase',''+total,'Total Proyectos','↑ datos sincronizados','var(--cm-blue)'],['ti-chart-donut',avg+'%','Avance Promedio','↑ evolución global','var(--cm-cyan)'],['ti-alert-circle',''+risk,'En Riesgo','Requieren atención','var(--cm-red)'],['ti-clock',''+delayed,'Retrasados','Progreso menor al 40%','var(--cm-yellow)']];
    const box=document.getElementById('cm-kpis'); if(!box)return;
    box.innerHTML=data.map(x=>`<article class="cm-kpi"><div class="cm-kpi-icon" style="color:${x[4]}"><i class="ti ${x[0]}"></i></div><div><div class="cm-kpi-value">${x[1]}</div><div class="cm-kpi-label">${x[2]}</div><div class="cm-kpi-trend">${x[3]}</div></div></article>`).join('');
  }

  renderCylinders(list=this.getProjects()) {
    const box=document.getElementById('cm-cylinders'); if(!box)return;
    const visible=list.slice(0,8);
    box.innerHTML=visible.map((p,i)=>{const progress=Math.max(0,Math.min(100,Number(p.progress)||0)); const c=this.color(p); const h=Math.max(8,progress); const idx=this.getProjects().findIndex(x=>x.id===p.id); const status=p.level==='CRÍTICA'?'Crítico':p.level==='ALTA'?'Atención':'En progreso'; return `<div class="cm-project" onclick="monitor.openModal(${idx})" title="Abrir ${this.escape(p.name)}"><div class="cm-cylinder-wrap"><div class="cm-cylinder" style="--h:${h}%;--c:${c}"><span class="cm-cylinder-value">${progress}%</span><div class="cm-liquid"></div></div></div><div class="cm-project-name">${this.escape(p.name)}</div><div class="cm-status"><span class="cm-status-dot" style="color:${c}"></span>${status}</div></div>`}).join('') || '<div class="text-muted p-4">Sin proyectos activos.</div>';
  }

  renderRisks() {
    const ps=this.getProjects().filter(p=>p.level==='CRÍTICA'||p.level==='ALTA').sort((a,b)=>Number(a.progress||0)-Number(b.progress||0)).slice(0,4); const box=document.getElementById('cm-risks'); if(!box)return; const count=document.getElementById('cm-risk-count'); if(count)count.textContent=ps.length;
    box.innerHTML=ps.map((p)=>{const c=this.color(p);const idx=this.getProjects().findIndex(x=>x.id===p.id);return `<div class="cm-risk-item" onclick="monitor.openModal(${idx})" style="cursor:pointer"><div class="cm-risk-bar" style="background:${c};color:${c}"></div><div class="cm-risk-main"><strong>${this.escape(p.name)}</strong><small>${this.escape(p.description||'Proyecto')}</small></div><strong>${Number(p.progress||0)}%</strong><span class="cm-badge" style="color:${c}">${p.level==='CRÍTICA'?'Crítico':'Atención'}</span></div>`}).join('')||'<div class="text-muted small p-3">No hay proyectos de alta prioridad.</div>';
  }

  renderActivity() {
    const ps=this.getProjects().slice(0,5); const box=document.getElementById('cm-activity-list'); if(!box)return; box.innerHTML=ps.map((p,i)=>`<div class="cm-activity-item"><span class="cm-activity-dot" style="color:${this.color(p)};background:${this.color(p)}"></span><span><strong>${this.escape(p.name)}</strong> · progreso ${Number(p.progress||0)}%</span><small>${i+1}h</small></div>`).join('') || '<div class="text-muted small p-3">Sin actividad reciente.</div>';
  }

  renderEvolution() {
    const el=document.getElementById('cm-evolution'); if(!el||typeof echarts==='undefined')return; const ps=this.getProjects(); const avg=ps.length?Math.round(ps.reduce((s,p)=>s+Number(p.progress||0),0)/ps.length):0; const chart=echarts.init(el); chart.setOption({backgroundColor:'transparent',grid:{left:34,right:8,top:15,bottom:28},xAxis:{type:'category',data:['-30d','-25d','-20d','-15d','-10d','-5d','Hoy'],axisLabel:{color:'#6f91ad',fontSize:9},axisLine:{lineStyle:{color:'#21435f'}}},yAxis:{type:'value',max:100,axisLabel:{color:'#6f91ad',fontSize:9,formatter:'{value}%'},splitLine:{lineStyle:{color:'rgba(60,120,160,.12)'}}},series:[{type:'line',smooth:true,symbolSize:5,data:[Math.max(0,avg-19),Math.max(0,avg-15),Math.max(0,avg-11),Math.max(0,avg-8),Math.max(0,avg-5),Math.max(0,avg-2),avg],lineStyle:{color:'#16d9ff',width:2},itemStyle:{color:'#16d9ff'},areaStyle:{color:'rgba(22,217,255,.10)'}}]}); window.addEventListener('resize',()=>chart.resize(),{passive:true});
  }

  filterProjects(q) { const term=(q||'').toLowerCase(); this.renderCylinders(this.getProjects().filter(p=>(p.name+' '+(p.lead||'')+' '+(p.description||'')).toLowerCase().includes(term))); }
}
