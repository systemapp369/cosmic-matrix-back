/* Cosmic Matrix - final dashboard + project editor */
(function () {
  'use strict';

  const DASH_STYLE = 'cm-dashboard-final-v4';
  const EDITOR_STYLE = 'cm-project-editor-final-v4';

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  function getProjects(instance) {
    try {
      const raw = instance?.getProjects ? instance.getProjects() : window.monitor?.projects;
      if (Array.isArray(raw)) return raw;
      if (Array.isArray(raw?.data)) return raw.data;
      if (Array.isArray(raw?.projects)) return raw.projects;
    } catch (_) {}
    return [];
  }

  function indexOfProject(project) {
    const ps = getProjects(window.hexTower3D);
    let i = ps.findIndex(p => String(p.id) === String(project?.id));
    if (i < 0) i = ps.findIndex(p => String(p.name) === String(project?.name));
    return i;
  }

  function openBitacora(project) {
    const i = indexOfProject(project);
    if (i >= 0 && typeof window.monitor?.openBitacora === 'function') window.monitor.openBitacora(i);
  }

  function projectColor(project, index) {
    const level = String(project?.level || '').toUpperCase();
    if (level === 'CRÍTICA' || level === 'CRITICA') return '#ff3d63';
    if (level === 'ALTA') return '#ffbd3f';
    if (level === 'BAJA') return '#a45cff';
    return ['#20d7f0','#a7e63a','#ff4f8b','#ffbd3f','#23d2c4'][index % 5];
  }

  function projectIcon(project, index) {
    const text = `${project?.name || ''} ${project?.description || ''}`.toLowerCase();
    if (/seguridad|firewall|protecci|acceso/.test(text)) return 'ti-shield-lock';
    if (/red|network|internet|wifi|conect/.test(text)) return 'ti-wifi';
    if (/usuario|personal|equipo/.test(text)) return 'ti-user';
    if (/finanz|dinero|costo|pago/.test(text)) return 'ti-currency-dollar';
    if (/energ|electri|planta|generador/.test(text)) return 'ti-bolt';
    if (/datos|database|sql/.test(text)) return 'ti-database';
    return ['ti-file-text','ti-settings','ti-user','ti-bulb','ti-search'][index % 5];
  }

  function arcPath(cx, cy, r, start, end) {
    const point = a => { const t=(a-90)*Math.PI/180; return [cx+r*Math.cos(t),cy+r*Math.sin(t)]; };
    const s=point(start), e=point(end);
    return `M ${s[0].toFixed(2)} ${s[1].toFixed(2)} A ${r} ${r} 0 0 1 ${e[0].toFixed(2)} ${e[1].toFixed(2)}`;
  }

  function installDashboardStyle() {
    if (document.getElementById(DASH_STYLE)) return;
    const style=document.createElement('style'); style.id=DASH_STYLE;
    style.textContent=`
      body.cm-professional-dashboard{overflow-x:hidden!important;background:#020a13!important}
      body.cm-professional-dashboard>.cm-shell{display:block!important;min-height:100vh!important;background:radial-gradient(circle at 50% 0%,rgba(0,185,230,.12),transparent 42%),#020a13!important}
      body.cm-professional-dashboard .cm-sidebar,body.cm-professional-dashboard .cm-topbar{display:none!important}
      body.cm-professional-dashboard .cm-main{width:100%!important;max-width:none!important;margin:0!important;padding:26px 30px 34px!important}
      body.cm-professional-dashboard .cm-kpis{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:14px!important;margin:0 0 16px!important}
      body.cm-professional-dashboard .cm-panel{border:1px solid rgba(28,151,190,.42)!important;background:linear-gradient(180deg,rgba(5,29,45,.96),rgba(2,14,25,.99))!important;box-shadow:inset 0 0 30px rgba(0,196,255,.035),0 10px 34px rgba(0,0,0,.18)!important}
      body.cm-professional-dashboard #cm-projects-panel{min-height:620px!important;border-radius:18px!important}
      body.cm-professional-dashboard #cm-projects-panel .cm-panel-head{padding:20px 24px 10px!important}
      body.cm-professional-dashboard #cm-projects-panel .cm-cylinders{padding:8px 24px 22px!important;display:block!important;height:auto!important;min-height:0!important;background:transparent!important}
      body.cm-professional-dashboard .cm-project-analytics{display:grid!important;grid-template-columns:minmax(350px,430px) minmax(520px,1fr)!important;grid-template-rows:auto auto auto!important;gap:20px 44px!important;min-height:530px!important;align-items:center!important}
      body.cm-professional-dashboard .cm-project-ring-area{position:relative!important;display:grid!important;place-items:center!important;min-height:370px!important}
      body.cm-professional-dashboard .cm-project-ring{width:min(370px,100%)!important;aspect-ratio:1!important;display:block!important;filter:drop-shadow(0 0 26px rgba(0,218,255,.15))!important}
      body.cm-professional-dashboard .cm-ring-track{fill:none!important;stroke:#0c2335!important;stroke-width:38!important}
      body.cm-professional-dashboard .cm-ring-segment{fill:none!important;stroke-width:38!important;cursor:pointer!important;transition:filter .2s,opacity .2s!important}
      body.cm-professional-dashboard .cm-ring-segment:hover{filter:drop-shadow(0 0 10px currentColor)!important;opacity:1!important}
      body.cm-professional-dashboard .cm-ring-center{position:absolute!important;inset:0!important;display:grid!important;place-items:center!important;pointer-events:none!important;text-align:center!important}
      body.cm-professional-dashboard .cm-ring-center-inner{width:142px!important;height:142px!important;border-radius:50%!important;display:grid!important;place-items:center!important;align-content:center!important;background:radial-gradient(circle,#0c2d44,#061522 72%)!important;border:1px solid rgba(50,208,239,.32)!important;box-shadow:inset 0 0 28px rgba(0,198,255,.12),0 0 28px rgba(0,198,255,.08)!important}
      body.cm-professional-dashboard .cm-ring-center-value{font-size:40px!important;font-weight:800!important;line-height:1!important;color:#edf9ff!important}
      body.cm-professional-dashboard .cm-ring-center-label{margin-top:6px!important;font-size:10px!important;line-height:1.4!important;letter-spacing:.13em!important;text-transform:uppercase!important;color:#78a9c0!important}
      body.cm-professional-dashboard .cm-ring-icon{position:absolute!important;display:grid!important;place-items:center!important;width:48px!important;height:48px!important;margin:-24px 0 0 -24px!important;border-radius:50%!important;border:1px solid rgba(255,255,255,.25)!important;background:#092337!important;color:#fff!important;box-shadow:0 0 17px currentColor!important;cursor:pointer!important;z-index:3!important;transition:transform .18s!important}
      body.cm-professional-dashboard .cm-ring-icon:hover{transform:scale(1.1)!important}
      body.cm-professional-dashboard .cm-ring-icon i{font-size:21px!important}
      body.cm-professional-dashboard .cm-project-bars{display:flex!important;flex-direction:column!important;gap:12px!important;min-width:0!important}
      body.cm-professional-dashboard .cm-project-bar{display:grid!important;grid-template-columns:minmax(150px,190px) minmax(160px,1fr) 58px!important;align-items:center!important;gap:13px!important;min-height:54px!important;padding:8px 12px!important;border:1px solid rgba(39,125,160,.25)!important;border-radius:10px!important;background:rgba(4,22,36,.52)!important;cursor:pointer!important;color:inherit!important;text-align:left!important}
      body.cm-professional-dashboard .cm-project-bar:hover{border-color:rgba(45,215,239,.58)!important;background:rgba(6,31,49,.78)!important;transform:translateX(2px)!important}
      body.cm-professional-dashboard .cm-project-bar-name{display:flex!important;align-items:center!important;gap:9px!important;min-width:0!important;color:#dceefa!important;font-size:13px!important;font-weight:700!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
      body.cm-professional-dashboard .cm-project-bar-dot{width:9px!important;height:9px!important;flex:0 0 9px!important;border-radius:50%!important;box-shadow:0 0 9px currentColor!important}
      body.cm-professional-dashboard .cm-progress-track{height:15px!important;overflow:hidden!important;border-radius:999px!important;background:#10283a!important;box-shadow:inset 0 1px 4px rgba(0,0,0,.45)!important}
      body.cm-professional-dashboard .cm-progress-fill{height:100%!important;border-radius:999px!important;min-width:2px!important;box-shadow:0 0 10px currentColor!important;transition:width .45s ease!important}
      body.cm-professional-dashboard .cm-project-bar-value{text-align:right!important;color:#eaf8ff!important;font-size:13px!important;font-weight:800!important}
      body.cm-professional-dashboard .cm-project-mini-rings{grid-column:1/-1!important;display:grid!important;grid-template-columns:repeat(5,minmax(100px,1fr))!important;gap:0!important;border-top:1px solid rgba(43,163,192,.20)!important;padding-top:18px!important}
      body.cm-professional-dashboard .cm-mini-ring-card{display:flex!important;align-items:center!important;justify-content:center!important;gap:9px!important;min-width:0!important;padding:3px 10px!important;border:0!important;border-right:1px solid rgba(43,163,192,.16)!important;background:transparent!important;color:inherit!important;cursor:pointer!important}
      body.cm-professional-dashboard .cm-mini-ring-card:last-child{border-right:0!important}
      body.cm-professional-dashboard .cm-mini-ring{--p:0%;--c:#12c9ff;--track:color-mix(in srgb,var(--c) 20%,#0a2233);position:relative!important;width:76px!important;height:76px!important;flex:0 0 76px!important;border-radius:50%!important;display:grid!important;place-items:center!important;background:conic-gradient(from 0deg,color-mix(in srgb,var(--c) 55%,#04121c) 0,var(--c) calc(var(--p)*.55),color-mix(in srgb,var(--c) 62%,#ffffff) var(--p),var(--track) 0)!important;box-shadow:0 0 0 1px color-mix(in srgb,var(--c) 45%,transparent),0 0 24px color-mix(in srgb,var(--c) 55%,transparent),inset 0 0 10px rgba(0,0,0,.45)!important;filter:saturate(1.25)}
      body.cm-professional-dashboard .cm-mini-ring:after{content:""!important;position:absolute!important;inset:9px!important;width:auto!important;height:auto!important;border-radius:50%!important;background:radial-gradient(circle at 38% 30%,color-mix(in srgb,var(--c) 22%,#0d2a3f),#04121d 72%)!important;border:1px solid color-mix(in srgb,var(--c) 40%,transparent)!important;box-shadow:inset 0 0 14px rgba(0,0,0,.65)!important}
      body.cm-professional-dashboard .cm-mini-ring b{position:relative!important;inset:auto!important;z-index:2!important;font-size:14px!important;font-weight:800!important;color:#fff!important;text-shadow:0 0 10px var(--c),0 0 3px rgba(0,0,0,.8)!important}
      body.cm-professional-dashboard .cm-mini-ring:hover{filter:saturate(1.45) brightness(1.12);transform:translateY(-2px);transition:.18s}
      body.cm-professional-dashboard .cm-mini-ring-value{position:relative!important;grid-area:1/1!important;z-index:2!important;font-size:14px!important;font-weight:800!important;color:#f1fbff!important}
      body.cm-professional-dashboard .cm-mini-ring-name{max-width:110px!important;min-width:0!important;color:#9fc0d2!important;font-size:12px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
      body.cm-professional-dashboard .cm-project-pager{grid-column:1/-1!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:12px!important;padding-top:0!important}
      body.cm-professional-dashboard .cm-project-pager button{border:1px solid #1b607b!important;border-radius:7px!important;background:#092236!important;color:#ccecf5!important;padding:8px 13px!important;font-size:12px!important;cursor:pointer!important}
      body.cm-professional-dashboard .cm-project-pager button:hover:not(:disabled){border-color:#20d8ef!important;background:#0b2e45!important}
      body.cm-professional-dashboard .cm-project-pager button:disabled{opacity:.35!important;cursor:not-allowed!important}
      body.cm-professional-dashboard .cm-project-pager span{color:#6f98ad!important;font-size:11px!important}
      body.cm-professional-dashboard .cm-ring-empty{grid-column:1/-1!important;min-height:420px!important;display:grid!important;place-items:center!important;color:#7898aa!important;font-size:14px!important}
      body.cm-professional-dashboard .cm-lower{margin-top:16px!important}
      @media(max-width:1100px){body.cm-professional-dashboard .cm-main{padding:18px!important}body.cm-professional-dashboard .cm-kpis{grid-template-columns:repeat(2,minmax(0,1fr))!important}body.cm-professional-dashboard .cm-project-analytics{grid-template-columns:1fr!important;gap:18px!important}body.cm-professional-dashboard .cm-project-ring-area{min-height:330px!important}body.cm-professional-dashboard .cm-project-mini-rings{grid-template-columns:repeat(5,120px)!important;overflow-x:auto!important;justify-content:start!important}}
      @media(max-width:650px){body.cm-professional-dashboard .cm-kpis{grid-template-columns:1fr!important}body.cm-professional-dashboard .cm-main{padding:12px!important}body.cm-professional-dashboard .cm-project-ring{width:290px!important}body.cm-professional-dashboard .cm-project-bar{grid-template-columns:1fr 56px!important}body.cm-professional-dashboard .cm-project-bar .cm-progress-track{grid-column:1/-1!important;grid-row:2!important}body.cm-professional-dashboard .cm-project-bar-value{grid-column:2!important;grid-row:1!important}}
    `;
    document.head.appendChild(style);
  }

  function patchDashboard() {
    if (typeof HexTower3D === 'undefined') return false;
    installDashboardStyle();
    HexTower3D.prototype.getProjects=function(){return getProjects(this)};
    HexTower3D.prototype.renderHexTowerPanel=function(){this.renderDashboardShell?.()};
    HexTower3D.prototype.hexNextPage=function(){};
    HexTower3D.prototype.hexPrevPage=function(){};
    HexTower3D.prototype.waitForLiveData=function(){
      if(this.dashboardDataTimer)clearInterval(this.dashboardDataTimer);
      this.dashboardDataTimer=null;let previous='';let attempts=0;
      const read=()=>{attempts++;const ps=getProjects(this);let signature='';try{signature=JSON.stringify(ps.map(p=>[p.id,p.name,p.progress,p.level,p.status]))}catch(_){}
        if(signature!==previous){previous=signature;this.renderDashboardShell?.()}
        if(ps.length||attempts>=120){clearInterval(this.dashboardDataTimer);this.dashboardDataTimer=null}
      };
      read();if(!getProjects(this).length)this.dashboardDataTimer=setInterval(read,500);
    };
    HexTower3D.prototype.renderCylinders=function(){
      const box=document.getElementById('cm-cylinders');if(!box)return;
      const source=Array.isArray(this.filteredProjects)?this.filteredProjects:getProjects(this);const total=source.length;const pages=Math.max(1,Math.ceil(total/5));this.page=Math.max(0,Math.min(Number(this.page)||0,pages-1));const start=this.page*5;const visible=source.slice(start,start+5);
      if(!visible.length){box.innerHTML='<div class="cm-ring-empty"><div><strong style="font-size:17px;color:#c7dce6">Sin proyectos registrados</strong><div style="margin-top:7px;font-size:12px;color:#6e91a5">Esperando sincronización con el servidor.</div></div></div>';return}
      const colors=visible.map((p,i)=>projectColor(p,i));const values=visible.map(p=>Math.max(0,Math.min(100,Number(p.progress)||0)));const seg=360/visible.length;const gap=3.5;
      const paths=visible.map((p,i)=>`<path class="cm-ring-segment" data-project-index="${i}" d="${arcPath(180,180,125, i*seg+gap/2,(i+1)*seg-gap/2)}" stroke="${colors[i]}" style="color:${colors[i]}" tabindex="0" aria-label="${esc(p.name)} ${values[i]}%"></path>`).join('');
      const icons=visible.map((p,i)=>{const a=(i+.5)*seg,t=(a-90)*Math.PI/180,x=50+43*Math.cos(t),y=50+43*Math.sin(t);return `<button type="button" class="cm-ring-icon" data-project-index="${i}" style="left:${x}%;top:${y}%;color:${colors[i]}" title="Abrir bitácora de ${esc(p.name)}"><i class="ti ${projectIcon(p,i)}"></i></button>`}).join('');
      const bars=visible.map((p,i)=>`<button type="button" class="cm-project-bar" data-project-index="${i}" title="Abrir bitácora de ${esc(p.name)}"><span class="cm-project-bar-name"><span class="cm-project-bar-dot" style="color:${colors[i]};background:${colors[i]}"></span>${esc(p.name)}</span><span class="cm-progress-track"><span class="cm-progress-fill" style="width:${values[i]}%;background:${colors[i]};color:${colors[i]}"></span></span><span class="cm-project-bar-value">${values[i]}%</span></button>`).join('');
      const minis=visible.map((p,i)=>`<button type="button" class="cm-mini-ring-card" data-project-index="${i}" title="Abrir bitácora de ${esc(p.name)}"><span class="cm-mini-ring" style="--p:${values[i]}%;--c:${colors[i]}"><span class="cm-mini-ring-value">${values[i]}%</span></span><span class="cm-mini-ring-name">${esc(p.name)}</span></button>`).join('');
      const pager=total>5?`<div class="cm-project-pager"><button type="button" id="cm-project-prev" ${this.page===0?'disabled':''}>‹ Anterior</button><span>${start+1}–${Math.min(start+5,total)} de ${total} proyectos</span><button type="button" id="cm-project-next" ${this.page>=pages-1?'disabled':''}>Siguiente ›</button></div>`:`<div class="cm-project-pager"><span>${total} ${total===1?'proyecto activo':'proyectos activos'}</span></div>`;
      box.innerHTML=`<div class="cm-project-analytics"><div class="cm-project-ring-area"><svg class="cm-project-ring" viewBox="0 0 360 360" role="img" aria-label="Proyectos activos"><circle class="cm-ring-track" cx="180" cy="180" r="125"></circle>${paths}</svg>${icons}<div class="cm-ring-center"><div class="cm-ring-center-inner"><div class="cm-ring-center-value">${visible.length}</div><div class="cm-ring-center-label">PROYECTOS<br>ACTIVOS</div></div></div></div><div class="cm-project-bars">${bars}</div><div class="cm-project-mini-rings">${minis}</div>${pager}</div>`;
      box.querySelectorAll('[data-project-index]').forEach(el=>el.addEventListener('click',()=>openBitacora(visible[Number(el.dataset.projectIndex)])));
      box.querySelectorAll('.cm-ring-segment').forEach(el=>el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openBitacora(visible[Number(el.dataset.projectIndex)])}}));
      box.querySelector('#cm-project-prev')?.addEventListener('click',()=>{this.page=Math.max(0,this.page-1);this.renderCylinders()});
      box.querySelector('#cm-project-next')?.addEventListener('click',()=>{this.page=Math.min(pages-1,this.page+1);this.renderCylinders()});
    };
    HexTower3D.prototype.filterProjects=function(term){const q=String(term||'').trim().toLowerCase();this.filteredProjects=q?getProjects(this).filter(p=>`${p.name||''} ${p.lead||''} ${p.description||''} ${p.status||''} ${p.level||''}`.toLowerCase().includes(q)):null;this.page=0;this.renderCylinders()};
    return true;
  }

  function installEditorStyle(){
    return; /* estilos del editor ahora viven solo en index.html (#cm-modals-responsive) */
    if(document.getElementById(EDITOR_STYLE))return;
    const style=document.createElement('style');style.id=EDITOR_STYLE;
    style.textContent=`
      #crudModal .cm-editor-dialog{width:min(980px,calc(100vw - 34px))!important;max-width:min(980px,calc(100vw - 34px))!important;margin:20px auto!important}
      #crudModal .cm-project-form{border:1px solid rgba(24,185,231,.42)!important;border-radius:18px!important;background:linear-gradient(180deg,#071c2d,#061421)!important;box-shadow:0 24px 80px rgba(0,0,0,.62),0 0 36px rgba(0,193,255,.10)!important;overflow:hidden!important;color:#eaf7ff!important;font-family:Arial,system-ui,sans-serif!important}
      #crudModal .cm-project-form .modal-header{min-height:112px!important;padding:25px 32px 20px!important;border-bottom:1px solid rgba(46,183,224,.18)!important;background:linear-gradient(90deg,rgba(12,146,196,.12),transparent 68%)!important}
      #crudModal .cm-project-form .modal-title{margin:0!important;color:#f3fbff!important;font:800 28px/1.15 Arial,sans-serif!important;letter-spacing:.01em!important;text-transform:none!important}
      #crudModal .cm-project-form .modal-body{padding:30px!important;overflow:visible!important}
      #crudModal .cm-project-form #nodeForm{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;gap:22px 20px!important;margin:0!important}
      #crudModal .cm-project-form #nodeForm>.cm-field{min-width:0!important;width:auto!important;padding:0!important;margin:0!important}
      #crudModal .cm-project-form #nodeForm>.cm-field-name,#crudModal .cm-project-form #nodeForm>.cm-field-description,#crudModal .cm-project-form #nodeForm>.cm-field-files,#crudModal .cm-project-form #nodeForm>.cm-form-actions{grid-column:1/-1!important}
      #crudModal .cm-project-form .form-label{display:block!important;margin:0 0 8px!important;color:#82b6c8!important;font:700 11px/1.25 Arial,sans-serif!important;letter-spacing:.09em!important;text-transform:uppercase!important}
      #crudModal .cm-project-form .form-control,#crudModal .cm-project-form .form-select{width:100%!important;height:50px!important;box-sizing:border-box!important;padding:0 15px!important;border:1px solid #1b526a!important;border-radius:10px!important;background:#061a2a!important;color:#eefaff!important;font:500 15px/1.2 Arial,sans-serif!important}
      #crudModal .cm-project-form #nodeDescription{height:105px!important;resize:vertical!important;padding:13px 15px!important}
      #crudModal .cm-project-form #nodeFiles{height:auto!important;padding:10px 12px!important}
      #crudModal .cm-project-form .cm-form-actions{display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:12px!important;padding-top:22px!important;border-top:1px solid rgba(42,190,215,.22)!important}
      #crudModal .cm-project-form .cm-form-actions:before{content:'PROJECT CONTROL';margin-right:auto;color:#4f8792;font:11px/1 Arial,sans-serif;letter-spacing:.15em}
      #crudModal .cm-project-form .btn{min-height:48px!important;padding:12px 22px!important;border-radius:8px!important;font:700 13px/1 Arial,sans-serif!important}
      #crudModal .cm-project-form #submitBtn{background:#12bfd4!important;border:1px solid #5af3ff!important;color:#00151c!important}
      #crudModal .cm-project-form .btn-light{background:#102b3c!important;border:1px solid #31586c!important;color:#e7f8fc!important}
      #crudModal .cm-project-form .id-delete-btn{background:transparent!important;border:1px solid #ff3e68!important;color:#ff6485!important}
      @media(max-width:720px){#crudModal .cm-editor-dialog{width:calc(100vw - 14px)!important;max-width:calc(100vw - 14px)!important;margin:7px auto!important}#crudModal .cm-project-form .modal-body{padding:18px!important}#crudModal .cm-project-form #nodeForm{grid-template-columns:1fr!important}#crudModal .cm-project-form #nodeForm>.cm-field{grid-column:1/-1!important}}
    `;document.head.appendChild(style);
  }

  function labelFor(id){const el=document.getElementById(id);return document.querySelector(`label[for="${id}"]`)||el?.parentElement?.querySelector('label')}
  function makeField(id,cls){const el=document.getElementById(id);if(!el)return null;const box=document.createElement('div');box.className='cm-field '+cls;const label=labelFor(id);if(label)box.appendChild(label);box.appendChild(el);return box}

  function normalizeProjectForm(){
    const form=document.getElementById('nodeForm');if(!form)return;
    const idx=document.getElementById('nodeIndex');if(!idx)return;
    installEditorStyle();
    if(form.querySelector('.field-name')){ /* el HTML ya trae la estructura final: solo se actualizan los textos */
      const c0=form.closest('.modal-content');if(c0){const t0=c0.querySelector('.modal-title');if(t0)t0.textContent=idx.value==='NEW'?'Nuevo Proyecto':'Editar Proyecto';const s0=c0.querySelector('#modalSub');if(s0)s0.textContent='Gestión de proyectos · Project management'}
      return;
    }
    if(form.dataset.cmFinalNormalized==='1')return;
    const ids=['nodeName','nodeLevel','nodeProgress','nodeStatus','nodeLead','nodeDescription','nodeFiles'];
    const classes=['cm-field-name','cm-field-level','cm-field-progress','cm-field-status','cm-field-lead','cm-field-description','cm-field-files'];
    const fields=ids.map((id,i)=>makeField(id,classes[i])).filter(Boolean);
    if(!fields.length)return;
    const submit=document.getElementById('submitBtn');const cancel=document.getElementById('cancelBtn')||Array.from(form.querySelectorAll('button')).find(b=>/cancelar/i.test(b.textContent||''));const del=document.getElementById('deleteBtn')||form.querySelector('.id-delete-btn');
    const actions=document.createElement('div');actions.className='cm-form-actions';if(del && idx.value!=='NEW')actions.appendChild(del);if(cancel)actions.appendChild(cancel);if(submit)actions.appendChild(submit);
    form.innerHTML='';idx.classList.add('d-none');form.appendChild(idx);fields.forEach(f=>form.appendChild(f));form.appendChild(actions);form.dataset.cmFinalNormalized='1';
    const content=form.closest('.modal-content');if(content){content.classList.add('cm-project-form');const title=content.querySelector('.modal-title');if(title)title.textContent=idx.value==='NEW'?'Nuevo Proyecto':'Editar Proyecto';const sub=content.querySelector('#modalSub');if(sub)sub.textContent='Gestión de proyectos · Project management'}
  }

  function bindEditor(){
    installEditorStyle();
    const modal=document.getElementById('crudModal');if(!modal||modal.dataset.cmFinalEditor==='1')return;
    modal.dataset.cmFinalEditor='1';
    modal.addEventListener('shown.bs.modal',()=>setTimeout(normalizeProjectForm,0));
    modal.addEventListener('hidden.bs.modal',()=>{const f=document.getElementById('nodeForm');if(f)f.dataset.cmFinalNormalized='0'});
  }

  function patch(){
    const dashboardReady=patchDashboard();
    bindEditor();
    return dashboardReady;
  }

  if(!patch()){
    const timer=setInterval(()=>{if(patch())clearInterval(timer)},100);
    setTimeout(()=>clearInterval(timer),15000);
  }
})();
