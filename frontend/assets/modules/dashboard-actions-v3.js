(function(){
'use strict';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const projects=()=>window.monitor&&Array.isArray(window.monitor.projects)?window.monitor.projects:[];

function ensureProductionCommandBar(){
  if(document.getElementById('cm-production-commandbar')) return;
  const style=document.createElement('style');
  style.id='cm-production-commandbar-style';
  style.textContent=`
    #cm-production-commandbar{position:fixed;top:8px;left:0;right:0;height:78px;z-index:3000;display:flex;align-items:center;padding:0 22px;background:linear-gradient(180deg,rgba(3,17,31,.97),rgba(4,24,42,.94));border-bottom:1px solid #174b70;box-shadow:0 8px 30px rgba(0,0,0,.32),inset 0 -1px 0 #19d9ff22;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    #cm-production-commandbar .cm-pc-left{display:flex;align-items:center;gap:10px;min-width:0}
    #cm-production-commandbar .cm-pc-theme{width:44px;height:44px;border:0;background:transparent;color:#d8f2ff;font-size:25px;cursor:pointer;display:grid;place-items:center}
    #cm-production-commandbar .cm-pc-divider{width:1px;height:38px;background:#123e5e;margin:0 10px}
    #cm-production-commandbar .cm-pc-btn{height:42px;padding:0 18px;border:1px solid #315e83;border-radius:22px;background:linear-gradient(180deg,#092944,#061b2f);color:#bdd9ed;font-size:14px;font-weight:650;display:inline-flex;align-items:center;gap:8px;cursor:pointer;white-space:nowrap;transition:.18s ease}
    #cm-production-commandbar .cm-pc-btn:hover{border-color:#20d7ff;color:#fff;box-shadow:0 0 16px #19d9ff33;transform:translateY(-1px)}
    #cm-production-commandbar .cm-pc-btn.primary{background:linear-gradient(135deg,#087cf4,#149ff0);border-color:#1e9fff;color:#fff}
    #cm-production-commandbar .cm-pc-btn.report{background:linear-gradient(135deg,#087cf4,#1687ff);border-color:#1ca5ff;color:#fff}
    #cm-production-commandbar .cm-pc-btn.excel{border-color:#315e83}
    #cm-production-commandbar .cm-pc-spacer{flex:1}
    #cm-production-commandbar .cm-pc-bell{position:relative;width:44px;height:44px;border:1px solid #315e83;border-radius:50%;background:#061d32;color:#dff5ff;display:grid;place-items:center;font-size:22px;cursor:pointer}
    #cm-production-commandbar .cm-pc-bell:hover{border-color:#19d9ff;box-shadow:0 0 18px #19d9ff44}
    #cm-production-commandbar .cm-pc-badge{position:absolute;right:-2px;top:-4px;min-width:19px;height:19px;padding:0 5px;border-radius:12px;background:#ff3155;color:#fff;font-size:10px;font-weight:900;display:grid;place-items:center;box-shadow:0 0 12px #ff315588}
    #cm-production-commandbar .cm-pc-profile{height:50px;margin-left:12px;padding-left:14px;border-left:1px solid #123e5e;display:flex;align-items:center;gap:10px;color:#e8f6ff}
    #cm-production-commandbar .cm-pc-avatar{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,#1c8cff,#7b52ff);font-weight:800}
    #cm-production-commandbar .cm-pc-name{font-size:13px;line-height:1.15;white-space:nowrap}.cm-pc-name small{display:block;color:#759bb5;font-size:10px;margin-top:3px}
    #cm-production-commandbar .cm-pc-chevron{color:#9cb8ca;margin-left:3px}
    body{padding-top:86px}
    @media(max-width:1100px){#cm-production-commandbar{padding:0 12px}#cm-production-commandbar .cm-pc-btn{padding:0 12px}#cm-production-commandbar .cm-pc-profile{display:none}}
    @media(max-width:760px){#cm-production-commandbar{height:64px;top:0;padding:0 8px}.cm-pc-divider,.cm-pc-theme,.cm-pc-profile{display:none!important}#cm-production-commandbar .cm-pc-btn{display:none}#cm-production-commandbar .cm-pc-btn.primary{display:inline-flex}body{padding-top:70px}}
  `;
  document.head.appendChild(style);
  const bar=document.createElement('div');
  bar.id='cm-production-commandbar';
  bar.innerHTML=`
    <div class="cm-pc-left">
      <button class="cm-pc-theme" id="cm-pc-theme" title="Cambiar tema"><i class="ti ti-sun"></i></button>
      <span class="cm-pc-divider"></span>
      <button class="cm-pc-btn primary" id="cm-pc-new"><i class="ti ti-plus"></i> Nuevo Proyecto</button>
      <button class="cm-pc-btn" id="cm-pc-deselect"><i class="ti ti-checkbox"></i> Desmarcar Todos</button>
      <button class="cm-pc-btn excel" id="cm-pc-excel"><i class="ti ti-file-spreadsheet"></i> Excel</button>
      <button class="cm-pc-btn report" id="cm-pc-report"><i class="ti ti-file-text"></i> Reporte (<span id="cm-pc-report-count">0</span>)</button>
    </div>
    <div class="cm-pc-spacer"></div>
    <button class="cm-pc-bell" id="cm-pc-bell" title="Proyectos críticos"><i class="ti ti-bell"></i><span class="cm-pc-badge" id="cm-pc-bell-count">0</span></button>
    <div class="cm-pc-profile"><div class="cm-pc-avatar">CA</div><div class="cm-pc-name">Carlos Alberto<small>Administrador</small></div><i class="ti ti-chevron-down cm-pc-chevron"></i></div>`;
  document.body.appendChild(bar);

  const callNew=()=>{if(window.monitor?.openCreateModal) return monitor.openCreateModal();const f=document.getElementById('nodeForm');if(f){f.reset();const i=document.getElementById('nodeIndex');if(i)i.value='NEW';const t=document.getElementById('modalTitle');if(t)t.textContent='Nuevo Proyecto';const s=document.getElementById('modalSub');if(s)s.textContent='Registrar nuevo proyecto en Cosmic Matrix';document.getElementById('deleteBtn')?.style.setProperty('display','none');monitor?.bsCrudModal?.show?.()}};
  const callDeselect=()=>{projects().forEach(p=>p.selected=false);monitor?.updateSelectedCount?.();document.querySelectorAll('.selected,.active-project,.is-selected').forEach(x=>x.classList.remove('selected','active-project','is-selected'));window.dispatchEvent(new CustomEvent('cm:deselect-all'));monitor?.showToast?.('Selecciones limpiadas');};
  const callExcel=()=>{if(monitor?.generateExcelReport)return monitor.generateExcelReport();if(monitor?.exportToExcel)return monitor.exportToExcel();if(window.XLSX){const rows=projects().map(p=>({ID:p.id,Proyecto:p.name,Criticidad:p.level,Progreso:p.progress,Responsable:p.lead,Descripcion:p.description}));const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),'Proyectos');XLSX.writeFile(wb,'cosmic-matrix-proyectos.xlsx')}};
  const callReport=()=>{if(window.cmOpenReports)return window.cmOpenReports();const modal=document.getElementById('reportModal');if(modal&&window.bootstrap){const body=document.getElementById('reportModalBody');const ps=projects();const avg=ps.length?Math.round(ps.reduce((s,p)=>s+Number(p.progress||0),0)/ps.length):0;if(body)body.innerHTML=`<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px"><div><b>${ps.length}</b><br>Proyectos</div><div><b>${avg}%</b><br>Avance promedio</div><div><b>${ps.filter(p=>p.level==='CRÍTICA'||Number(p.progress||0)<40).length}</b><br>Atención</div></div>`;new bootstrap.Modal(modal).show();}};
  const callBell=()=>{const modal=document.getElementById('criticalityModal'),body=document.getElementById('criticalityModalBody');if(!modal||!body)return;const list=projects().filter(p=>p.level==='CRÍTICA'||p.level==='ALTA'||Number(p.progress||0)<40).sort((a,b)=>Number(a.progress||0)-Number(b.progress||0));body.innerHTML=list.length?list.map(p=>{const i=projects().indexOf(p);return `<button type="button" class="cm-critical-row" style="width:100%;margin-bottom:7px" data-index="${i}"><span class="cm-critical-dot" style="background:#ff3155;box-shadow:0 0 12px #ff3155"></span><span class="cm-critical-main"><strong>${esc(p.name)}</strong><small>${esc(p.description||p.lead||'Sin descripción')}</small></span><b>${Number(p.progress||0)}%</b></button>`}).join(''):'<div class="cm-empty">No hay proyectos críticos.</div>';body.querySelectorAll('[data-index]').forEach(x=>x.onclick=()=>{bootstrap.Modal.getInstance(modal)?.hide();monitor?.openModal?.(Number(x.dataset.index))});new bootstrap.Modal(modal).show();};
  document.getElementById('cm-pc-new').onclick=callNew;
  document.getElementById('cm-pc-deselect').onclick=callDeselect;
  document.getElementById('cm-pc-excel').onclick=callExcel;
  document.getElementById('cm-pc-report').onclick=callReport;
  document.getElementById('cm-pc-bell').onclick=callBell;
  document.getElementById('cm-pc-theme').onclick=()=>document.documentElement.classList.toggle('cm-theme-light');
  const update=()=>{const ps=projects();const n=ps.filter(p=>p.level==='CRÍTICA'||p.level==='ALTA'||Number(p.progress||0)<40).length;document.getElementById('cm-pc-bell-count').textContent=n;document.getElementById('cm-pc-report-count').textContent=ps.length};
  update();window.addEventListener('cm:projects-updated',update);setInterval(update,1500);
}

function installDashboard(){
  if(!window.monitor || !monitor.hexTower3D || typeof monitor.hexTower3D.injectProfessionalDashboard!=='function'){
    setTimeout(installDashboard,200);return;
  }
  monitor.hexTower3D.injectProfessionalDashboard();
  const root=document.getElementById('cm-dashboard-v2');
  if(root&&!root.dataset.actionsV5){root.dataset.actionsV5='1';}
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{ensureProductionCommandBar();installDashboard()});else{ensureProductionCommandBar();installDashboard()}
window.addEventListener('load',()=>{ensureProductionCommandBar();installDashboard()});
})();