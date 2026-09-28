(function () {
  'use strict';

  const PAGE_SIZE = 5;
  const COLORS = ['#28b8ff', '#b7ef35', '#ff4f8b', '#ffb52e', '#18d7bd'];
  const CRIT = { CRÍTICA: '#ff3d68', ALTA: '#ffb52e', NORMAL: '#18d7bd', BAJA: '#a45cff' };

  const projects = () => window.monitor && Array.isArray(monitor.projects) ? monitor.projects : [];
  const pct = p => Math.max(0, Math.min(100, Number(p && p.progress) || 0));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const color = (p, i) => CRIT[p && p.level] || COLORS[i % COLORS.length];
  const status = p => p && p.level === 'CRÍTICA' ? 'Crítico' :
    p && p.level === 'ALTA' ? 'Atención' : pct(p) >= 90 ? 'Completado' : 'En progreso';

  let page = 0;
  let query = '';
  let mode = 'graphs';

  function filtered() {
    const q = query.trim().toLowerCase();
    if (!q) return projects();
    return projects().filter(p => `${p.name || ''} ${p.lead || ''} ${p.description || ''}`.toLowerCase().includes(q));
  }

  function average(list) {
    return list.length ? Math.round(list.reduce((s, p) => s + pct(p), 0) / list.length) : 0;
  }

  function criticalCount() {
    return projects().filter(p => p && (p.level === 'CRÍTICA' || p.level === 'ALTA' || pct(p) < 40)).length;
  }

  function openProject(p) {
    const i = projects().findIndex(x => x.id === p.id);
    if (i >= 0 && window.monitor && monitor.openModal) monitor.openModal(i);
  }

  function installStyles() {
    if (document.getElementById('cm-radical-dashboard-style')) return;

    const style = document.createElement('style');
    style.id = 'cm-radical-dashboard-style';
    style.textContent = `
      :root{
        --cm-bg:#020b15;--cm-panel:#061827;--cm-panel2:#081f31;--cm-line:#10425e;
        --cm-cyan:#19d9ff;--cm-blue:#1687ff;--cm-green:#16e6a6;--cm-yellow:#ffb82e;
        --cm-red:#ff3d68;--cm-text:#eafaff;--cm-muted:#789db5;
      }
      html,body{margin:0!important;min-height:100%;background:#020b15!important}
      body.cm-radical-active{overflow-x:hidden}
      body.cm-radical-active #canvas-container,
      body.cm-radical-active .scanner-bar,
      body.cm-radical-active .scanline-overlay{display:none!important}
      body.cm-radical-active > #cm-dashboard,
      body.cm-radical-active > #cm-dashboard-v2,
      body.cm-radical-active > .container-xl,
      body.cm-radical-active > .footer{display:none!important}

      #cm-radical-dashboard{
        min-height:100vh;width:100%;position:relative;z-index:50;color:var(--cm-text);
        font-family:Arial,Helvetica,sans-serif;
        background:radial-gradient(circle at 18% 16%,rgba(17,104,151,.12),transparent 30%),radial-gradient(circle at 82% 8%,rgba(20,214,255,.07),transparent 28%),linear-gradient(180deg,#03101d 0%,#020b15 100%);
      }
      #cm-radical-dashboard *{box-sizing:border-box}
      .cm-radical-inner{width:min(1480px,calc(100vw - 44px));margin:0 auto;padding:18px 0 24px}
      .cm-radical-header{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:14px}
      .cm-brand-title{display:flex;align-items:center;gap:12px}
      .cm-brand-mark{width:42px;height:42px;border:1px solid var(--cm-cyan);display:grid;place-items:center;color:var(--cm-cyan);border-radius:10px;box-shadow:0 0 20px rgba(25,217,255,.2);background:#061a2a}
      .cm-brand-title strong{display:block;font-size:18px;letter-spacing:.04em}
      .cm-brand-title small{display:block;margin-top:3px;color:#61a9bf;font-size:9px;letter-spacing:.2em;text-transform:uppercase}
      .cm-header-actions{display:flex;align-items:center;gap:8px}
      .cm-head-btn{height:38px;border:1px solid #1b5875;background:#061c2d;color:#c9efff;border-radius:8px;padding:0 13px;font-size:11px;font-weight:700;cursor:pointer}
      .cm-head-btn:hover{border-color:var(--cm-cyan);box-shadow:0 0 14px rgba(25,217,255,.15)}
      .cm-head-btn.primary{background:linear-gradient(135deg,#087cff,#11c8ff);border-color:#3beaff;color:#fff}
      .cm-search{position:relative;width:min(410px,34vw)}
      .cm-search i{position:absolute;left:13px;top:11px;color:var(--cm-cyan)}
      .cm-search input{width:100%;height:38px;border:1px solid #164a68;border-radius:8px;background:#051a2a;color:#eafaff;padding:0 14px 0 38px;outline:none}
      .cm-search input:focus{border-color:var(--cm-cyan);box-shadow:0 0 0 1px rgba(25,217,255,.2)}

      .cm-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px}
      .cm-kpi{min-height:88px;border:1px solid #124c69;border-radius:11px;background:linear-gradient(145deg,#071f32,#041522);display:flex;align-items:center;padding:14px 18px;box-shadow:inset 0 0 30px rgba(10,216,255,.035)}
      .cm-kpi-icon{width:48px;height:48px;border:1px solid currentColor;border-radius:50%;display:grid;place-items:center;font-size:22px;margin-right:13px;box-shadow:0 0 17px currentColor}
      .cm-kpi-value{font-size:28px;font-weight:900;line-height:1;color:#f2fbff}
      .cm-kpi-label{font-size:12px;color:#91b5c8;margin-top:5px}.cm-kpi-trend{font-size:9px;color:#12e8aa;margin-top:5px}

      .cm-panel{border:1px solid #0d7394;border-radius:12px;background:linear-gradient(160deg,#061e30,#03131f 76%);box-shadow:inset 0 0 45px rgba(10,216,255,.035);overflow:hidden}
      .cm-panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:15px;padding:16px 18px 11px}
      .cm-panel-title{font-size:17px;font-weight:900;letter-spacing:.025em;color:#eafaff}.cm-panel-title i{color:var(--cm-cyan);margin-right:7px}.cm-panel-subtitle{font-size:10px;color:#719bb2;margin-top:4px}
      .cm-toggle{display:flex;border:1px solid #174e69;border-radius:8px;overflow:hidden;flex:none}.cm-toggle button{height:34px;border:0;border-right:1px solid #174e69;background:#061a2a;color:#83aabd;padding:0 13px;font-size:10px;cursor:pointer}.cm-toggle button:last-child{border-right:0}.cm-toggle button.active{background:#098fe8;color:#fff}

      .cm-project-layout{display:grid;grid-template-columns:390px minmax(0,1fr);gap:20px;padding:8px 18px 14px}
      .cm-ring-zone{min-height:405px;display:grid;place-items:center;position:relative}
      .cm-ring-wrap{position:relative;width:335px;height:335px;display:grid;place-items:center}.cm-ring-glow{position:absolute;inset:7%;border-radius:50%;background:radial-gradient(circle,rgba(25,217,255,.08),transparent 63%);filter:blur(7px)}
      .cm-ring{position:absolute;inset:0;border-radius:50%;transform:rotate(-90deg);background:var(--ring);box-shadow:0 0 35px rgba(25,217,255,.11),inset 0 0 16px rgba(0,0,0,.7)}
      .cm-ring:after{content:"";position:absolute;inset:2px;border-radius:50%;border:1px solid rgba(124,235,255,.2)}
      .cm-ring-hole{position:absolute;inset:25%;border-radius:50%;display:grid;place-items:center;text-align:center;background:radial-gradient(circle at 42% 34%,#0c314b,#03121e 70%);border:1px solid #1a5a76;box-shadow:inset 0 0 35px rgba(0,0,0,.8),0 0 25px rgba(0,198,255,.12)}
      .cm-ring-hole b{font-size:38px;line-height:1;color:#f0fbff}.cm-ring-hole span{display:block;margin-top:5px;color:#79a8be;font-size:9px;letter-spacing:.15em;text-transform:uppercase}
      .cm-ring-icon{position:absolute;width:50px;height:50px;border-radius:50%;display:grid;place-items:center;z-index:5;background:#061a2a;color:#fff;border:2px solid var(--ic);box-shadow:0 0 18px var(--ic);font-size:21px;cursor:pointer}
      .cm-ring-icon.i0{left:50%;top:-1px;transform:translate(-50%,-10%)}.cm-ring-icon.i1{right:2%;top:28%;transform:translate(15%,-50%)}.cm-ring-icon.i2{right:5%;bottom:19%;transform:translate(20%,50%)}.cm-ring-icon.i3{left:50%;bottom:-1px;transform:translate(-50%,10%)}.cm-ring-icon.i4{left:0;top:57%;transform:translate(-12%,-50%)}
      .cm-ring-caption{position:absolute;bottom:4px;color:#7199b1;font-size:10px;text-align:center}.cm-ring-caption b{color:#d9f7ff}

      .cm-bars-zone{min-width:0;padding-top:2px}.cm-bars{border:1px solid #0f3f59;border-radius:9px;overflow:hidden;background:rgba(3,16,27,.4)}
      .cm-bar-row{display:grid;grid-template-columns:175px minmax(120px,1fr) 52px;gap:14px;align-items:center;padding:13px 14px;border-bottom:1px solid #0d3349}.cm-bar-row:last-child{border-bottom:0}
      .cm-bar-name{display:flex;align-items:center;gap:9px;min-width:0;font-size:12px;font-weight:800;color:#dff4fb}.cm-bar-name span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .cm-dot{width:9px;height:9px;border-radius:50%;flex:none;box-shadow:0 0 10px currentColor}.cm-bar-track{height:16px;border-radius:999px;background:linear-gradient(180deg,#0e2a3c,#071925);box-shadow:inset 0 1px 5px #000b;overflow:hidden}
      .cm-bar-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,var(--c),rgba(255,255,255,.88));box-shadow:0 0 13px var(--c);transition:width .45s ease}.cm-bar-value{text-align:right;font-size:13px;font-weight:900;color:#f0fbff}
      .cm-mini-rings{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));border-top:1px solid #103b53;margin-top:13px;padding-top:13px}.cm-mini-item{display:flex;align-items:center;justify-content:center;gap:9px;min-width:0;border-right:1px solid #10384d}.cm-mini-item:last-child{border-right:0}
      .cm-mini-ring{width:64px;height:64px;border-radius:50%;position:relative;flex:none;background:conic-gradient(var(--c) calc(var(--p)*1%),#182f40 0);box-shadow:0 0 13px rgba(25,217,255,.06)}.cm-mini-ring:after{content:"";position:absolute;inset:10px;border-radius:50%;background:#061a29;border:1px solid #1b465c}.cm-mini-ring b{position:absolute;inset:0;display:grid;place-items:center;z-index:2;font-size:10px;color:#fff}.cm-mini-label{font-size:9px;color:#a0c4d5;max-width:85px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

      .cm-project-footer{display:flex;justify-content:center;align-items:center;gap:10px;padding:3px 18px 13px;color:#789db4;font-size:10px}.cm-next-btn{height:32px;border:1px solid #1d698b;background:#08253a;color:#d6f7ff;border-radius:7px;padding:0 12px;cursor:pointer}.cm-next-btn:hover{border-color:var(--cm-cyan);box-shadow:0 0 12px rgba(25,217,255,.14)}.cm-next-btn:disabled{opacity:.35;cursor:default}.cm-page-note{color:#779bb2}

      .cm-lower{display:grid;grid-template-columns:1.25fr .9fr .9fr;gap:10px;margin-top:10px}.cm-lower .cm-panel{min-height:245px;height:245px}.cm-chart{height:195px}.cm-list{height:195px;overflow:auto;padding:0 14px 8px}
      .cm-risk-item,.cm-activity-item{display:flex;align-items:center;gap:9px;padding:9px 2px;border-bottom:1px solid #0d3046}.cm-risk-item{cursor:pointer}.cm-risk-item:hover{background:#06243a}.cm-risk-bar{width:3px;height:31px;border-radius:4px;box-shadow:0 0 8px currentColor}.cm-risk-main{flex:1;min-width:0;display:flex;flex-direction:column}.cm-risk-main strong{font-size:10px;color:#e9f8ff}.cm-risk-main small{font-size:8px;color:#7198af;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cm-badge{font-size:9px;font-weight:800;white-space:nowrap}.cm-activity-dot{width:8px;height:8px;border-radius:50%;background:var(--cm-cyan);box-shadow:0 0 9px var(--cm-cyan);flex:none}.cm-activity-item b{font-size:10px}.cm-activity-item div{font-size:8px;color:#789db5}
      .cm-empty{padding:35px 15px;text-align:center;color:#6f96ad;font-size:11px}.cm-loading{grid-column:1/-1;display:grid;place-items:center;min-height:300px;color:#6f96ad;font-size:13px}.cm-summary{min-height:380px;display:grid;place-items:center;text-align:center}.cm-summary-number{font-size:68px;font-weight:900;color:#effbff;text-shadow:0 0 26px rgba(25,217,255,.35)}.cm-summary-sub{color:#789db5;font-size:12px}.cm-list-view{min-height:380px;padding:10px 18px}.cm-list-row{display:flex;align-items:center;gap:12px;padding:12px;border-bottom:1px solid #0d3046;cursor:pointer}.cm-list-row:hover{background:#06243a}.cm-list-row .grow{flex:1;display:flex;flex-direction:column}.cm-list-row small{color:#7198af;margin-top:3px}

      @media(max-width:1100px){.cm-radical-inner{width:min(100% - 28px,1100px)}.cm-project-layout{grid-template-columns:300px minmax(0,1fr)}.cm-ring-wrap{width:270px;height:270px}.cm-ring-icon{width:42px;height:42px;font-size:18px}.cm-bar-row{grid-template-columns:140px minmax(90px,1fr) 48px}.cm-lower{grid-template-columns:1fr 1fr}.cm-lower .cm-panel:last-child{grid-column:1/-1}}
      @media(max-width:760px){.cm-radical-inner{width:calc(100% - 18px);padding-top:10px}.cm-radical-header{align-items:flex-start}.cm-brand-title small{display:none}.cm-header-actions{flex-wrap:wrap;justify-content:flex-end}.cm-search{order:3;width:100%}.cm-kpis{grid-template-columns:1fr 1fr}.cm-kpi{min-height:78px;padding:11px}.cm-kpi-icon{width:40px;height:40px;font-size:18px}.cm-kpi-value{font-size:22px}.cm-kpi-label{font-size:10px}.cm-project-layout{grid-template-columns:1fr;padding:5px 10px 12px}.cm-ring-zone{min-height:310px}.cm-ring-wrap{width:260px;height:260px}.cm-bar-row{grid-template-columns:100px minmax(60px,1fr) 40px;gap:8px;padding:9px}.cm-bar-name{font-size:9px}.cm-bar-track{height:13px}.cm-mini-rings{grid-template-columns:repeat(5,105px);overflow:auto;justify-content:start}.cm-mini-item{border-right:0}.cm-lower{grid-template-columns:1fr}.cm-lower .cm-panel:last-child{grid-column:auto}}
    `;
    document.head.appendChild(style);
  }

  function hideLegacy() {
    document.body.classList.add('cm-radical-active');
    document.getElementById('cm-dashboard')?.remove();
    document.getElementById('cm-dashboard-v2')?.remove();
    document.querySelectorAll('.container-xl,.footer').forEach(el => el.style.display = 'none');
  }

  function shell() {
    let root = document.getElementById('cm-radical-dashboard');
    if (root) return root;
    hideLegacy();
    root = document.createElement('section');
    root.id = 'cm-radical-dashboard';
    root.innerHTML = `
      <div class="cm-radical-inner">
        <header class="cm-radical-header">
          <div class="cm-brand-title"><div class="cm-brand-mark"><i class="ti ti-chart-donut-4"></i></div><div><strong>COSMIC MATRIX</strong><small>PROJECT CONTROL / ANALYTICS</small></div></div>
          <div class="cm-header-actions"><div class="cm-search"><i class="ti ti-search"></i><input id="cm-radical-search" placeholder="Buscar proyecto, responsable..." autocomplete="off"></div><button class="cm-head-btn primary" id="cm-radical-new"><i class="ti ti-plus"></i> Nuevo Proyecto</button><button class="cm-head-btn" id="cm-radical-excel"><i class="ti ti-file-spreadsheet"></i> Excel</button><button class="cm-head-btn" id="cm-radical-report"><i class="ti ti-report-analytics"></i> Reporte</button></div>
        </header>
        <section class="cm-kpis" id="cm-radical-kpis"></section>
        <section class="cm-panel" id="cm-radical-projects">
          <div class="cm-panel-head"><div><div class="cm-panel-title"><i class="ti ti-chart-donut"></i> PROGRESO DE PROYECTOS</div><div class="cm-panel-subtitle">Anillo central por proyectos · barras de avance · porcentaje individual</div></div><div class="cm-toggle"><button class="active" id="cm-radical-graphs">Gráficas</button><button id="cm-radical-list">Lista</button><button id="cm-radical-summary">Resumen</button></div></div>
          <div id="cm-radical-body"></div>
          <div class="cm-project-footer"><span class="cm-page-note" id="cm-radical-page"></span><button class="cm-next-btn" id="cm-radical-next">Siguiente <i class="ti ti-chevron-right"></i></button></div>
        </section>
        <section class="cm-lower">
          <article class="cm-panel"><div class="cm-panel-head"><div><div class="cm-panel-title">EVOLUCIÓN DEL AVANCE</div><div class="cm-panel-subtitle">Tendencia del avance promedio</div></div><span class="cm-badge" style="color:var(--cm-cyan)">Últimos 30 días</span></div><div class="cm-chart" id="cm-radical-evolution"></div></article>
          <article class="cm-panel"><div class="cm-panel-head"><div><div class="cm-panel-title">PROYECTOS CRÍTICOS</div><div class="cm-panel-subtitle">Requieren atención inmediata</div></div><span class="badge rounded-pill bg-danger" id="cm-radical-risk-count">0</span></div><div class="cm-list" id="cm-radical-risks"></div></article>
          <article class="cm-panel"><div class="cm-panel-head"><div><div class="cm-panel-title">ACTIVIDAD RECIENTE</div><div class="cm-panel-subtitle">Últimos cambios detectados</div></div><span class="cm-badge" style="color:var(--cm-cyan)">● En vivo</span></div><div class="cm-list" id="cm-radical-activity"></div></article>
        </section>
      </div>`;
    document.body.appendChild(root);
    bind(root);
    return root;
  }

  function bind(root) {
    root.querySelector('#cm-radical-search').addEventListener('input', e => { query = e.target.value || ''; page = 0; render(); });
    root.querySelector('#cm-radical-next').addEventListener('click', () => { const totalPages = Math.max(1, Math.ceil(filtered().length / PAGE_SIZE)); if (page < totalPages - 1) { page += 1; render(); } });
    root.querySelector('#cm-radical-graphs').addEventListener('click', () => { mode = 'graphs'; page = 0; render(); });
    root.querySelector('#cm-radical-list').addEventListener('click', () => { mode = 'list'; render(); });
    root.querySelector('#cm-radical-summary').addEventListener('click', () => { mode = 'summary'; render(); });
    root.querySelector('#cm-radical-new').addEventListener('click', () => {
      if (window.monitor?.openCreateModal) return monitor.openCreateModal();
      document.getElementById('nodeForm')?.reset(); const idx = document.getElementById('nodeIndex'); if (idx) idx.value = 'NEW'; const del = document.getElementById('deleteBtn'); if (del) del.style.display = 'none'; monitor.bsCrudModal?.show();
    });
    root.querySelector('#cm-radical-excel').addEventListener('click', () => { if (window.monitor?.generateExcelReport) monitor.generateExcelReport(); });
    root.querySelector('#cm-radical-report').addEventListener('click', () => { if (window.cmOpenReports) return window.cmOpenReports(); if (window.monitor?.generateReport) monitor.generateReport(); });
  }

  function renderKpis() {
    const ps = projects(), total = ps.length, avg = average(ps), risk = ps.filter(p => p.level === 'CRÍTICA' || p.level === 'ALTA').length, late = ps.filter(p => pct(p) < 40).length;
    const data = [['ti-briefcase', total, 'Total Proyectos', 'Datos sincronizados', 'var(--cm-blue)'],['ti-chart-donut', `${avg}%`, 'Avance Promedio', 'Progreso global', 'var(--cm-cyan)'],['ti-alert-circle', risk, 'En Riesgo', 'Requieren atención', 'var(--cm-red)'],['ti-clock', late, 'Retrasados', 'Progreso menor al 40%', 'var(--cm-yellow)']];
    const box = document.getElementById('cm-radical-kpis'); if (!box) return;
    box.innerHTML = data.map(x => `<article class="cm-kpi"><div class="cm-kpi-icon" style="color:${x[4]}"><i class="ti ${x[0]}"></i></div><div><div class="cm-kpi-value">${x[1]}</div><div class="cm-kpi-label">${x[2]}</div><div class="cm-kpi-trend">● ${x[3]}</div></div></article>`).join('');
  }

  function renderGraphs(list) {
    const total = list.length, pages = Math.max(1, Math.ceil(total / PAGE_SIZE)); page = Math.min(page, pages - 1);
    const start = page * PAGE_SIZE, visible = list.slice(start, start + PAGE_SIZE), body = document.getElementById('cm-radical-body'), next = document.getElementById('cm-radical-next'), label = document.getElementById('cm-radical-page');
    if (!visible.length) { body.innerHTML = '<div class="cm-loading">Esperando datos de proyectos...</div>'; label.textContent = '0 proyectos'; next.disabled = true; return; }
    const cols = visible.map((p, i) => color(p, i)), stops = [];
    visible.forEach((p, i) => { const a = i * 72, b = a + 69; stops.push(`${cols[i]} ${a}deg ${b}deg`); stops.push(`#071a2a ${b}deg ${a + 72}deg`); });
    while (stops.length < 10) { const i = stops.length / 2; stops.push(`#071a2a ${i * 72}deg ${(i + 1) * 72}deg`); }
    body.innerHTML = `<div class="cm-project-layout"><div class="cm-ring-zone"><div class="cm-ring-wrap"><div class="cm-ring-glow"></div><div class="cm-ring" style="background:conic-gradient(${stops.join(',')})"></div><div class="cm-ring-hole"><div><b>${visible.length}</b><span>Proyectos<br>activos</span></div></div>${visible.map((p, i) => `<button class="cm-ring-icon i${i}" style="--ic:${cols[i]}" data-project="${esc(p.id)}" title="${esc(p.name)}"><i class="ti ${['ti-file-description','ti-settings','ti-user','ti-bulb','ti-search'][i]}"></i></button>`).join('')}</div><div class="cm-ring-caption">Avance promedio: <b>${average(visible)}%</b></div></div><div class="cm-bars-zone"><div class="cm-bars">${visible.map((p, i) => `<div class="cm-bar-row" data-project="${esc(p.id)}"><div class="cm-bar-name"><span class="cm-dot" style="color:${cols[i]};background:${cols[i]}"></span><span title="${esc(p.name)}">${esc(p.name)}</span></div><div class="cm-bar-track"><div class="cm-bar-fill" style="--c:${cols[i]};width:${pct(p)}%"></div></div><div class="cm-bar-value">${pct(p)}%</div></div>`).join('')}</div><div class="cm-mini-rings">${visible.map((p, i) => `<div class="cm-mini-item"><div class="cm-mini-ring" style="--c:${cols[i]};--p:${pct(p)}"><b>${pct(p)}%</b></div><span class="cm-mini-label" title="${esc(p.name)}">${esc(p.name)}</span></div>`).join('')}</div></div></div>`;
    body.querySelectorAll('[data-project]').forEach(el => el.addEventListener('click', () => { const p = projects().find(x => String(x.id) === String(el.dataset.project)); if (p) openProject(p); }));
    label.textContent = `${start + 1}–${Math.min(start + PAGE_SIZE, total)} de ${total} proyectos`; next.disabled = page >= pages - 1;
  }

  function renderList(list) {
    const body = document.getElementById('cm-radical-body');
    body.innerHTML = `<div class="cm-list-view">${list.map(p => `<div class="cm-list-row" data-project="${esc(p.id)}"><span class="cm-dot" style="color:${color(p, 0)};background:${color(p, 0)}"></span><div class="grow"><strong>${esc(p.name)}</strong><small>${esc(p.description || p.lead || 'Sin descripción')}</small></div><strong>${pct(p)}%</strong><span class="cm-badge" style="color:${color(p, 0)}">${status(p)}</span></div>`).join('') || '<div class="cm-empty">No hay proyectos.</div>'}</div>`;
    body.querySelectorAll('[data-project]').forEach(el => el.addEventListener('click', () => { const p = projects().find(x => String(x.id) === String(el.dataset.project)); if (p) openProject(p); }));
    document.getElementById('cm-radical-page').textContent = `${list.length} proyectos`; document.getElementById('cm-radical-next').disabled = true;
  }

  function renderSummary(list) {
    document.getElementById('cm-radical-body').innerHTML = `<div class="cm-summary"><div><div class="cm-summary-number">${average(list)}%</div><div class="cm-summary-sub">Avance promedio de ${list.length} proyectos</div></div></div>`;
    document.getElementById('cm-radical-page').textContent = 'Resumen'; document.getElementById('cm-radical-next').disabled = true;
  }

  function renderRisks() {
    const list = projects().filter(p => p.level === 'CRÍTICA' || p.level === 'ALTA' || pct(p) < 40).sort((a,b) => pct(a) - pct(b)).slice(0, 5), box = document.getElementById('cm-radical-risks'), count = document.getElementById('cm-radical-risk-count');
    if (!box) return; if (count) count.textContent = criticalCount();
    box.innerHTML = list.length ? list.map(p => { const c = color(p, 0); return `<div class="cm-risk-item" data-project="${esc(p.id)}"><div class="cm-risk-bar" style="background:${c};color:${c}"></div><div class="cm-risk-main"><strong>${esc(p.name)}</strong><small>${pct(p)}% · ${esc(p.description || 'Proyecto')}</small></div><strong>${pct(p)}%</strong><span class="cm-badge" style="color:${c}">${status(p)}</span></div>`; }).join('') : '<div class="cm-empty">No hay proyectos de alta prioridad.</div>';
    box.querySelectorAll('[data-project]').forEach(el => el.addEventListener('click', () => { const p = projects().find(x => String(x.id) === String(el.dataset.project)); if (p) openProject(p); }));
  }

  function renderActivity() {
    const box = document.getElementById('cm-radical-activity'); if (!box) return; let events = [];
    try { if (Array.isArray(monitor.activityLog)) events = monitor.activityLog.slice(-5).reverse(); } catch (_) {}
    if (!events.length) events = projects().slice(0, 5).map((p, i) => ({name:p.name, detail:`Estado ${status(p)} · avance ${pct(p)}%`, time:i ? `Hace ${i} h` : 'Ahora'}));
    box.innerHTML = events.length ? events.map(e => `<div class="cm-activity-item"><span class="cm-activity-dot"></span><div><b>${esc(e.name || e.project || 'Sistema')}</b><div>${esc(e.detail || e.text || e.action || 'Actualización')} · ${esc(e.time || 'Ahora')}</div></div></div>`).join('') : '<div class="cm-empty">Sin actividad reciente.</div>';
  }

  function renderEvolution() {
    const el = document.getElementById('cm-radical-evolution'); if (!el || !window.echarts) return; const avg = average(projects()); let chart = echarts.getInstanceByDom(el); if (!chart) chart = echarts.init(el);
    chart.setOption({animation:false,grid:{left:36,right:12,top:12,bottom:28},tooltip:{trigger:'axis'},xAxis:{type:'category',data:['-30d','-25d','-20d','-15d','-10d','-5d','Hoy'],axisLabel:{color:'#7198b0',fontSize:9}},yAxis:{type:'value',min:0,max:100,axisLabel:{color:'#7198b0',fontSize:9,formatter:'{value}%'}},series:[{type:'line',smooth:.35,data:[Math.max(0,avg-28),Math.max(0,avg-22),Math.max(0,avg-16),Math.max(0,avg-11),Math.max(0,avg-7),Math.max(0,avg-3),avg],symbol:'circle',symbolSize:5,lineStyle:{color:'#19d9ff',width:2},itemStyle:{color:'#19d9ff'},areaStyle:{color:'rgba(25,217,255,.08)'}}]});
    if (!chart.__cmRadicalResize) { const fn = () => { if (!document.hidden && document.body.contains(el)) chart.resize(); }; window.addEventListener('resize', fn, {passive:true}); chart.__cmRadicalResize = fn; }
  }

  function setActiveButton() { document.querySelectorAll('#cm-radical-projects .cm-toggle button').forEach(b => b.classList.remove('active')); document.getElementById(`cm-radical-${mode}`)?.classList.add('active'); }

  function render() {
    shell(); renderKpis(); const list = filtered(); if (mode === 'graphs') renderGraphs(list); else if (mode === 'list') renderList(list); else renderSummary(list); renderRisks(); renderActivity(); renderEvolution(); setActiveButton();
  }

  function connectMonitor() {
    const m = window.monitor; if (!m) return;
    if (m.hexTower3D) {
      m.hexTower3D.pageSize = PAGE_SIZE;
      m.hexTower3D.renderHexTowerPanel = render;
      m.hexTower3D.renderDashboardShell = render;
      m.hexTower3D.syncDashboard = render;
      m.hexTower3D.nextPage = () => { const pages = Math.max(1, Math.ceil(filtered().length / PAGE_SIZE)); if (page < pages - 1) { page++; render(); } };
      m.hexTower3D.prevPage = () => { if (page > 0) { page--; render(); } };
    }
    render();
  }

  function install() { installStyles(); hideLegacy(); connectMonitor(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
  let tries = 0;
  const timer = setInterval(() => { tries++; install(); if (window.monitor && (projects().length || tries > 40)) clearInterval(timer); if (tries > 80) clearInterval(timer); }, 250);
  window.cmRadicalDashboard = { render };
})();
