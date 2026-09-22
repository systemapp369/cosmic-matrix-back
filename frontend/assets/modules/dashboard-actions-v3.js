(function(){
'use strict';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const projects=()=>window.monitor&&Array.isArray(window.monitor.projects)?window.monitor.projects:[];

function install(){
  const monitor=window.monitor;
  if(!monitor || !monitor.hexTower3D || typeof monitor.hexTower3D.injectProfessionalDashboard!=='function'){
    setTimeout(install,200);
    return;
  }

  // Punto que faltaba: el dashboard V2 define el render, pero nadie lo inyectaba.
  monitor.hexTower3D.injectProfessionalDashboard();

  const root=document.getElementById('cm-dashboard-v2');
  if(!root){setTimeout(install,200);return;}
  if(root.dataset.actionsV4==='1')return;
  root.dataset.actionsV4='1';

  const style=document.createElement('style');
  style.textContent=`
    #cm-dashboard-v2 .cm-saturn-v4{position:absolute;left:10px;bottom:18px;width:180px;height:125px;object-fit:contain;opacity:.92;filter:drop-shadow(0 0 16px #19d9ff38);pointer-events:none;z-index:4}
    #cm-dashboard-v2 .cm-saturn-caption-v4{position:absolute;left:22px;bottom:8px;color:#4f86a7;font:600 8px/1 system-ui,sans-serif;letter-spacing:2px;z-index:5}
    #cm-dashboard-v2 .cm-top-actions .cm-action,#cm-dashboard-v2 .cm-top-actions .cm-notify{cursor:pointer}
    #cm-dashboard-v2 .cm-notify{display:grid;place-items:center}
    #cm-dashboard-v2 .cm-critical-pop{max-height:65vh;overflow:auto}
  `;
  document.head.appendChild(style);

  // Saturno como prueba visual de que esta versión del dashboard está activa.
  const sidebar=root.querySelector('.cm-sidebar');
  if(sidebar && !sidebar.querySelector('.cm-saturn-v4')){
    const img=document.createElement('img');
    img.className='cm-saturn-v4';
    img.src='./Images/saturn-dashboard.svg?v=20260922-4';
    img.alt='Saturno';
    sidebar.appendChild(img);
    const cap=document.createElement('div');
    cap.className='cm-saturn-caption-v4';
    cap.textContent='COSMIC MATRIX';
    sidebar.appendChild(cap);
  }

  const byId=id=>root.querySelector('#'+id);

  const newBtn=byId('cm-new-project');
  if(newBtn)newBtn.onclick=()=>{
    if(typeof monitor.openCreateModal==='function') monitor.openCreateModal();
    else if(window.cmNewProject) window.cmNewProject();
  };

  const deselect=byId('cm-deselect');
  if(deselect)deselect.onclick=()=>{
    projects().forEach(p=>p.selected=false);
    monitor.updateSelectedCount?.();
    monitor.showToast?.('Selecciones limpiadas');
  };

  const excel=byId('cm-excel');
  if(excel)excel.onclick=()=>{
    if(typeof monitor.exportToExcel==='function') monitor.exportToExcel();
    else if(window.XLSX){
      const rows=projects().map(p=>({ID:p.id,Proyecto:p.name,Criticidad:p.level,Progreso:p.progress,Responsable:p.lead,Descripcion:p.description}));
      const wb=XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),'Proyectos');
      XLSX.writeFile(wb,'cosmic-matrix-proyectos.xlsx');
    }
  };

  const report=byId('cm-reports');
  if(report)report.onclick=()=>{
    if(window.cmOpenReports) window.cmOpenReports();
    else if(typeof monitor.generateReport==='function'){
      projects().forEach(p=>p.selected=true);
      monitor.generateReport();
    }
  };

  const bell=byId('cm-notify');
  if(bell)bell.onclick=()=>{
    const list=projects().filter(p=>p.level==='CRÍTICA'||Number(p.progress||0)<40)
      .sort((a,b)=>Number(a.progress||0)-Number(b.progress||0));
    const modal=document.getElementById('criticalityModal');
    const body=document.getElementById('criticalityModalBody');
    const title=document.getElementById('criticalityModalTitle');
    if(!modal||!body)return;
    if(title)title.textContent='Proyectos críticos';
    body.classList.add('cm-critical-pop');
    body.innerHTML=list.length?list.map(p=>{
      const idx=projects().findIndex(x=>x.id===p.id);
      const critical=p.level==='CRÍTICA';
      const c=critical?'#ff3d68':'#ffb82e';
      return `<button type="button" class="cm-critical-row" data-index="${idx}" style="width:100%;margin-bottom:7px">
        <span class="cm-critical-dot" style="background:${c};box-shadow:0 0 12px ${c}"></span>
        <span class="cm-critical-main"><strong>${esc(p.name)}</strong><small>${esc(p.description||p.lead||'Sin descripción')}</small></span>
        <b>${Number(p.progress||0)}%</b>
        <span class="cm-critical-tag" style="color:${c};border-color:${c}">${critical?'Crítico':'Atención'}</span>
      </button>`;
    }).join(''):'<div class="cm-empty">No hay proyectos críticos.</div>';
    body.querySelectorAll('[data-index]').forEach(row=>row.onclick=()=>{
      const idx=Number(row.dataset.index);
      monitor.bsCriticalityModal?.hide();
      setTimeout(()=>monitor.openModal?.(idx),220);
    });
    monitor.bsCriticalityModal?.show();
  };

  const updateHeader=()=>{
    const ps=projects();
    const critical=ps.filter(p=>p.level==='CRÍTICA'||Number(p.progress||0)<40).length;
    const n=byId('cm-notify-count');
    const r=byId('cm-report-count');
    if(n)n.textContent=critical;
    if(r)r.textContent=ps.length;
  };
  updateHeader();
  window.addEventListener('cm:projects-updated',updateHeader);

  // Re-render del dashboard cuando llegan los proyectos desde el backend.
  const originalLoad=monitor.loadProjectsFromRemote;
  if(typeof originalLoad==='function' && !monitor.__dashboardLoadWrapped){
    monitor.__dashboardLoadWrapped=true;
    monitor.loadProjectsFromRemote=async function(){
      const result=await originalLoad.apply(this,arguments);
      this.hexTower3D?.injectProfessionalDashboard?.();
      updateHeader();
      this.hexTower3D?.renderV2?.();
      return result;
    };
  }

  updateHeader();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
window.addEventListener('load',install);
})();
