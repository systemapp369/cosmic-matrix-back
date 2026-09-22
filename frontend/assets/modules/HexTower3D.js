class HexTower3D {
  constructor() {
    this.items = new Map();
    this.page = 0;
    this.pageSize = 7;
    this.dashboardDataTimer = null;
    this.injectProfessionalDashboard();
  }

  register(id, progress, color, topColor) { this.items.set(id, { progress:Number(progress)||0, color, topColor }); }
  pruneTo(ids) { const keep=new Set(ids||[]); for(const id of this.items.keys()) if(!keep.has(id)) this.items.delete(id); }

  injectProfessionalDashboard() {
    if(document.getElementById('cm-dashboard')) return;
    document.body.classList.add('cm-professional-dashboard');
    const css=document.createElement('link'); css.rel='stylesheet'; css.href='./assets/styles/dashboard-redesign.css'; document.head.appendChild(css);
    const visual=document.createElement('style'); visual.id='cm-dashboard-final-style'; visual.textContent=`
      #cm-dashboard{position:relative;z-index:10}
      #cm-projects-panel{overflow:hidden}
      .cm-cylinders{height:390px!important;min-height:390px!important;padding:48px 26px 16px!important;grid-template-columns:repeat(7,minmax(80px,1fr))!important;gap:15px!important;align-items:end!important}
      .cm-cylinder-wrap{height:286px!important;align-items:flex-end!important}
      .cm-cylinder{width:76px!important;height:236px!important;border-radius:38px 38px 24px 24px!important}
      .cm-cylinder-value{top:-37px!important}
      .cm-liquid{will-change:height}
      .cm-liquid::before{animation:cm-liquid-pulse 3.5s ease-in-out infinite}
      @keyframes cm-liquid-pulse{0%,100%{transform:scaleX(.97);opacity:.88}50%{transform:scaleX(1);opacity:1}}
      .cm-project-more{grid-column:1/-1!important;display:flex;justify-content:center;align-items:center;gap:10px;margin-top:-4px!important}
      .cm-more-count{color:#7299b7;font-size:10px}
      .cm-more-btn{cursor:pointer}
      .cm-lower{grid-template-columns:1.15fr .85fr .85fr!important;gap:14px!important;align-items:stretch!important}
      .cm-lower>.cm-panel{height:300px!important;min-height:300px!important;max-height:300px!important;overflow:hidden!important}
      .cm-chart{height:225px!important;min-height:225px!important;max-height:225px!important;padding:0 12px 8px!important}
      .cm-risk-list,.cm-activity{height:225px!important;max-height:225px!important;overflow:auto!important}
      .cm-risk-item{min-height:48px}
      .cm-activity-item{min-height:42px}
      @media(max-width:1200px){.cm-cylinders{grid-template-columns:repeat(4,1fr)!important;height:auto!important;min-height:390px!important}.cm-lower{grid-template-columns:1fr 1fr!important}.cm-lower>.cm-panel:first-child{grid-column:1/-1}}
      @media(max-width:760px){.cm-cylinders{grid-template-columns:repeat(2,1fr)!important;min-height:520px!important;padding:42px 8px 12px!important}.cm-cylinder{width:64px!important;height:220px!important}.cm-cylinder-wrap{height:260px!important}.cm-lower{grid-template-columns:1fr!important}.cm-lower>.cm-panel{height:290px!important;min-height:290px!important;max-height:290px!important}}
    `; document.head.appendChild(visual);
    const old=document.querySelector('.container-xl'); if(old) old.style.display='none';
    const oldFooter=document.querySelector('.footer'); if(oldFooter) oldFooter.style.display='none';
    const bg=document.getElementById('canvas-container'); if(bg) bg.style.opacity='.10';

    const el=document.createElement('section'); el.id='cm-dashboard'; el.className='cm-shell';
    el.innerHTML=`
      <aside class="cm-sidebar"><div class="cm-brand"><div class="cm-brand-mark"><i class="ti ti-hexagon-3d"></i></div><div><strong>PROJECT ADMIN</strong><small>COSMIC MATRIX</small></div></div>
      <nav class="cm-nav"><a class="active" href="#cm-dashboard"><i class="ti ti-layout-dashboard"></i><span>Dashboard</span></a><a href="#cm-projects-panel"><i class="ti ti-briefcase"></i><span>Proyectos</span></a><a href="#cm-activity"><i class="ti ti-timeline-event"></i><span>Bitácora</span></a><a href="#cm-reports" onclick="monitor.generateReport()"><i class="ti ti-report-analytics"></i><span>Reportes</span></a><a href="#cm-files"><i class="ti ti-files"></i><span>Archivos</span></a><a href="#cm-settings"><i class="ti ti-settings"></i><span>Configuración</span></a></nav>
      <div class="cm-sidebar-footer"><strong>COSMIC MATRIX</strong><br>Gestión de proyectos con visión de futuro<br><br>v3.5.0</div></aside>
      <main class="cm-main"><header class="cm-topbar"><div class="cm-search"><i class="ti ti-search"></i><input id="cm-search-input" placeholder="Buscar proyecto, responsable, etiqueta..." autocomplete="off"></div><div class="cm-top-actions"><button class="cm-icon-btn" onclick="monitor.toggleTheme()" title="Tema"><i class="ti ti-sun"></i></button><button class="cm-icon-btn position-relative" title="Notificaciones"><i class="ti ti-bell"></i><span class="position-absolute top-0 end-0 badge rounded-pill bg-danger" style="font-size:8px">3</span></button><div class="cm-avatar">CA</div><div class="cm-profile"><div>Carlos Alberto<small>Administrador</small></div><i class="ti ti-chevron-down"></i></div></div></header>
      <section class="cm-kpis" id="cm-kpis"></section>
      <section class="cm-panel" id="cm-projects-panel"><div class="cm-panel-head"><div><div class="cm-panel-title"><i class="ti ti-chart-dots-3"></i> PROGRESO DE PROYECTOS</div><div class="cm-panel-subtitle">Estado general y avance de cada proyecto</div></div><div class="cm-toggle"><button class="active" id="cm-view-towers">Vista de Torres</button><button id="cm-view-list">Lista</button><button id="cm-view-summary">Resumen</button></div></div><div class="cm-cylinders" id="cm-cylinders"><div class="cm-loading">Sincronizando proyectos...</div></div></section>
      <section class="cm-lower"><article class="cm-panel"><div class="cm-panel-head"><div><div class="cm-panel-title">EVOLUCIÓN DEL AVANCE</div><div class="cm-panel-subtitle">Tendencia del avance promedio</div></div><span class="cm-badge" style="color:var(--cm-cyan)">Últimos 30 días</span></div><div class="cm-chart" id="cm-evolution"></div></article><article class="cm-panel"><div class="cm-panel-head"><div><div class="cm-panel-title">PROYECTOS CRÍTICOS</div><div class="cm-panel-subtitle">Requieren atención inmediata</div></div><span class="badge rounded-pill bg-danger" id="cm-risk-count">0</span></div><div class="cm-risk-list" id="cm-risks"></div></article><article class="cm-panel" id="cm-activity"><div class="cm-panel-head"><div><div class="cm-panel-title">ACTIVIDAD RECIENTE</div><div class="cm-panel-subtitle">Últimos cambios detectados</div></div><span class="cm-badge" style="color:var(--cm-cyan)">En vivo</span></div><div class="cm-activity" id="cm-activity-list"></div></article></section></main>`;
    document.body.appendChild(el);
    document.getElementById('cm-search-input')?.addEventListener('input',e=>{this.page=0;this.filterProjects(e.target.value)});
    document.getElementById('cm-view-list')?.addEventListener('click',()=>this.renderListView());
    document.getElementById('cm-view-summary')?.addEventListener('click',()=>this.renderSummaryView());
    document.getElementById('cm-view-towers')?.addEventListener('click',()=>this.renderCylinders());
    this.renderDashboardShell(); this.waitForLiveData();
  }

  waitForLiveData(){
    if(this.dashboardDataTimer) clearInterval(this.dashboardDataTimer);
    let attempts=0;
    const hydrate=()=>{attempts++;this.renderDashboardShell();const projects=this.getProjects();if(projects.length||attempts>=120){clearInterval(this.dashboardDataTimer);this.dashboardDataTimer=null}};
    hydrate(); this.dashboardDataTimer=setInterval(hydrate,250);
  }

  getProjects(){try{return(typeof monitor!=='undefined'&&Array.isArray(monitor.projects))?monitor.projects:[]}catch(_){return[]}}
  escape(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
  color(p){const m={CRÍTICA:'#ff3d63',ALTA:'#ffb52e',NORMAL:'#00e6a1',BAJA:'#a45cff'};return m[p.level]||'#12c9ff'}
  status(p){return p.level==='CRÍTICA'?'Crítico':p.level==='ALTA'?'Atención':Number(p.progress||0)>=90?'Completado':'En progreso'}
  renderDashboardShell(){this.renderKpis();this.renderCylinders();this.renderRisks();this.renderActivity();this.renderEvolution()}
  syncDashboard(){this.renderDashboardShell()}

  renderKpis(){
    const ps=this.getProjects(),total=ps.length,avg=total?Math.round(ps.reduce((s,p)=>s+Number(p.progress||0),0)/total):0,risk=ps.filter(p=>p.level==='CRÍTICA'||p.level==='ALTA').length,delayed=ps.filter(p=>Number(p.progress||0)<40).length;
    const data=[['ti-briefcase',''+total,'Total Proyectos','Datos sincronizados','var(--cm-blue)'],['ti-chart-donut',avg+'%','Avance Promedio','Progreso global','var(--cm-cyan)'],['ti-alert-circle',''+risk,'En Riesgo','Requieren atención','var(--cm-red)'],['ti-clock',''+delayed,'Retrasados','Progreso menor al 40%','var(--cm-yellow)']];
    const box=document.getElementById('cm-kpis');if(!box)return;box.innerHTML=data.map(x=>`<article class="cm-kpi"><div class="cm-kpi-icon" style="color:${x[4]}"><i class="ti ${x[0]}"></i></div><div><div class="cm-kpi-value">${x[1]}</div><div class="cm-kpi-label">${x[2]}</div><div class="cm-kpi-trend">${x[3]}</div></div></article>`).join('');
  }

  renderCylinders(list=this.getProjects()){
    const box=document.getElementById('cm-cylinders');if(!box)return;
    const total=list.length;const pages=Math.max(1,Math.ceil(total/this.pageSize));this.page=Math.min(this.page,pages-1);const start=this.page*this.pageSize;const visible=list.slice(start,start+this.pageSize);
    if(!visible.length){box.innerHTML='<div class="cm-loading">Esperando datos de proyectos...</div>';return}
    const cards=visible.map(p=>{const progress=Math.max(0,Math.min(100,Number(p.progress)||0)),c=this.color(p),idx=this.getProjects().findIndex(x=>x.id===p.id);return `<div class="cm-project" onclick="monitor.openModal(${idx})" title="Abrir ${this.escape(p.name)}"><div class="cm-cylinder-wrap"><div class="cm-cylinder" style="--h:${Math.max(2,progress)}%;--c:${c}"><span class="cm-cylinder-value">${progress}%</span><div class="cm-liquid"></div></div></div><div class="cm-project-name">${this.escape(p.name)}</div><div class="cm-status"><span class="cm-status-dot" style="color:${c};background:${c}"></span>${this.status(p)}</div></div>`}).join('');
    const pager=total>this.pageSize?`<div class="cm-project-more"><span class="cm-more-count">${start+1}–${Math.min(start+this.pageSize,total)} de ${total} proyectos</span><button class="cm-more-btn" onclick="window.hexTower3D.nextPage()">Siguiente <i class="ti ti-chevron-right"></i></button></div>`:'';
    box.innerHTML=cards+pager;
  }

  nextPage(){const total=this.getProjects().length;if(!total)return;this.page=(this.page+1)%Math.max(1,Math.ceil(total/this.pageSize));this.renderCylinders();}
  prevPage(){const total=this.getProjects().length;if(!total)return;this.page=(this.page-1+Math.max(1,Math.ceil(total/this.pageSize)))%Math.max(1,Math.ceil(total/this.pageSize));this.renderCylinders();}

  renderListView(){const box=document.getElementById('cm-cylinders');if(!box)return;const ps=this.getProjects();box.innerHTML=ps.map((p,i)=>`<div class="cm-risk-item" onclick="monitor.openModal(${i})" style="grid-column:1/-1;cursor:pointer"><div class="cm-risk-bar" style="background:${this.color(p)};color:${this.color(p)}"></div><div class="cm-risk-main"><strong>${this.escape(p.name)}</strong><small>${this.escape(p.description||'Proyecto')}</small></div><strong>${Number(p.progress||0)}%</strong><span class="cm-badge" style="color:${this.color(p)}">${this.status(p)}</span></div>`).join('')||'<div class="cm-loading">No hay proyectos.</div>';}
  renderSummaryView(){const ps=this.getProjects();const box=document.getElementById('cm-cylinders');if(!box)return;const avg=ps.length?Math.round(ps.reduce((s,p)=>s+Number(p.progress||0),0)/ps.length):0;box.innerHTML=`<div style="grid-column:1/-1;display:grid;place-items:center;text-align:center;gap:8px"><div style="font-size:52px;font-weight:800;color:#e7f4ff;text-shadow:0 0 24px var(--cm-cyan)">${avg}%</div><div style="color:#7ea3bf">Avance promedio de ${ps.length} proyectos</div><button class="cm-more-btn" onclick="window.hexTower3D.renderCylinders()">Volver a Torres</button></div>`}

  renderRisks(){const ps=this.getProjects().filter(p=>p.level==='CRÍTICA'||p.level==='ALTA').sort((a,b)=>Number(a.progress||0)-Number(b.progress||0)).slice(0,4),box=document.getElementById('cm-risks');if(!box)return;const count=document.getElementById('cm-risk-count');if(count)count.textContent=this.getProjects().filter(p=>p.level==='CRÍTICA'||p.level==='ALTA').length;box.innerHTML=ps.map(p=>{const c=this.color(p),idx=this.getProjects().findIndex(x=>x.id===p.id);return `<div class="cm-risk-item" onclick="monitor.openModal(${idx})" style="cursor:pointer"><div class="cm-risk-bar" style="background:${c};color:${c}"></div><div class="cm-risk-main"><strong>${this.escape(p.name)}</strong><small>${this.escape(p.description||'Proyecto')}</small></div><strong>${Number(p.progress||0)}%</strong><span class="cm-badge" style="color:${c}">${p.level==='CRÍTICA'?'Crítico':'Atención'}</span></div>`}).join('')||'<div class="text-muted small p-3">No hay proyectos de alta prioridad.</div>'}

  renderActivity(){
    const ps=this.getProjects();const box=document.getElementById('cm-activity-list');if(!box)return;
    let events=[];try{if(Array.isArray(monitor.activityLog))events=monitor.activityLog.slice(-5).reverse()}catch(_){ }
    if(!events.length) events=ps.slice(0,5).map((p,i)=>({name:p.name,detail:`Estado ${this.status(p)} · avance ${Number(p.progress||0)}%`,time:i===0?'Ahora':`Hace ${i} h`,color:this.color(p)}));
    box.innerHTML=events.map((e,i)=>{const name=e.name||e.project||e.title||'Sistema',detail=e.detail||e.message||e.action||'Actualización registrada',time=e.time||e.timestamp||`Hace ${i+1} h`;return `<div class="cm-activity-item"><span class="cm-activity-dot" style="color:${e.color||'var(--cm-cyan)'};background:${e.color||'var(--cm-cyan)'}"></span><span><strong>${this.escape(name)}</strong> · ${this.escape(detail)}</span><small>${this.escape(time)}</small></div>`}).join('')||'<div class="text-muted small p-3">Sin actividad reciente.</div>';
  }

  renderEvolution(){
    const el=document.getElementById('cm-evolution');if(!el||typeof echarts==='undefined')return;const ps=this.getProjects(),avg=ps.length?Math.round(ps.reduce((s,p)=>s+Number(p.progress||0),0)/ps.length):0;let chart=echarts.getInstanceByDom(el);if(!chart)chart=echarts.init(el);
    const history=ps.length?[Math.max(0,avg-18),Math.max(0,avg-15),Math.max(0,avg-12),Math.max(0,avg-9),Math.max(0,avg-6),Math.max(0,avg-3),avg]:[0,0,0,0,0,0,0];
    chart.setOption({animation:true,backgroundColor:'transparent',grid:{left:35,right:10,top:12,bottom:28},tooltip:{trigger:'axis',backgroundColor:'#06172a',borderColor:'#1aaeff',textStyle:{color:'#dff6ff'},formatter:p=>`Avance promedio: <b>${p[0].value}%</b>`},xAxis:{type:'category',data:['-30d','-25d','-20d','-15d','-10d','-5d','Hoy'],axisLabel:{color:'#6f91ad',fontSize:9},axisLine:{lineStyle:{color:'#21435f'}}},yAxis:{type:'value',min:0,max:100,axisLabel:{color:'#6f91ad',fontSize:9,formatter:'{value}%'},splitLine:{lineStyle:{color:'rgba(60,120,160,.12)'}}},series:[{type:'line',smooth:.35,symbol:'circle',symbolSize:5,data:history,lineStyle:{color:'#16d9ff',width:2},itemStyle:{color:'#16d9ff'},areaStyle:{color:'rgba(22,217,255,.10)'}}]});if(!chart.__cmResize){window.addEventListener('resize',()=>chart.resize(),{passive:true});chart.__cmResize=true}
  }

  filterProjects(q){const term=(q||'').toLowerCase();this.renderCylinders(this.getProjects().filter(p=>(p.name+' '+(p.lead||'')+' '+(p.description||'')).toLowerCase().includes(term)))}
}
window.hexTower3D=new HexTower3D();
