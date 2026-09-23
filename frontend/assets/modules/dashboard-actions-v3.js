(function(){
'use strict';

const projects=()=>window.monitor&&Array.isArray(window.monitor.projects)?window.monitor.projects:[];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

function openNew(){
  if(!window.monitor)return;
  if(typeof monitor.openCreateModal==='function') return monitor.openCreateModal();
  const form=document.getElementById('nodeForm');
  if(form)form.reset();
  const idx=document.getElementById('nodeIndex'); if(idx)idx.value='NEW';
  const title=document.getElementById('modalTitle'); if(title)title.textContent='Nuevo Proyecto';
  const sub=document.getElementById('modalSub'); if(sub)sub.textContent='Registrar nuevo proyecto en Cosmic Matrix';
  const del=document.getElementById('deleteBtn'); if(del)del.style.display='none';
  monitor.bsCrudModal?.show?.();
}

function deselect(){
  projects().forEach(p=>p.selected=false);
  document.querySelectorAll('.selected,.active-project,.is-selected').forEach(x=>x.classList.remove('selected','active-project','is-selected'));
  if(window.monitor){monitor.currentProjectId=null;monitor.indexToDelete=null;}
  window.dispatchEvent(new CustomEvent('cm:deselect-all'));
  monitor?.showToast?.('Selecciones limpiadas');
}

function excel(){
  if(monitor?.generateExcelReport)return monitor.generateExcelReport();
  if(monitor?.exportToExcel)return monitor.exportToExcel();
  if(window.XLSX){
    const rows=projects().map(p=>({ID:p.id,Proyecto:p.name,Criticidad:p.level,Progreso:p.progress,Responsable:p.lead,Descripcion:p.description}));
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),'Proyectos');
    XLSX.writeFile(wb,'cosmic-matrix-proyectos.xlsx');
  }
}

function report(){
  if(window.cmOpenReports)return window.cmOpenReports();
  const modal=document.getElementById('reportModal');
  if(!modal)return;
  const body=document.getElementById('reportModalBody');
  const ps=projects();
  const avg=ps.length?Math.round(ps.reduce((s,p)=>s+Number(p.progress||0),0)/ps.length):0;
  const attention=ps.filter(p=>p.level==='CRÍTICA'||p.level==='ALTA'||Number(p.progress||0)<40).length;
  if(body)body.innerHTML=`<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px"><div><b>${ps.length}</b><br>Proyectos</div><div><b>${avg}%</b><br>Avance promedio</div><div><b>${attention}</b><br>Atención</div></div>`;
  window.bootstrap?.Modal.getOrCreateInstance(modal).show();
}

function critical(){
  const modal=document.getElementById('criticalityModal'),body=document.getElementById('criticalityModalBody');
  if(!modal||!body)return;
  const list=projects().filter(p=>p.level==='CRÍTICA'||p.level==='ALTA'||Number(p.progress||0)<40).sort((a,b)=>Number(a.progress||0)-Number(b.progress||0));
  body.innerHTML=list.length?list.map(p=>{
    const i=projects().indexOf(p);
    return `<button type="button" class="cm-critical-row" data-index="${i}" style="width:100%;margin-bottom:7px;display:flex;align-items:center;gap:10px"><span style="width:9px;height:9px;border-radius:50%;background:#ff3155;box-shadow:0 0 10px #ff3155"></span><span style="flex:1;text-align:left"><strong>${esc(p.name)}</strong><small style="display:block;opacity:.65">${esc(p.description||p.lead||'Sin descripción')}</small></span><b>${Number(p.progress||0)}%</b></button>`;
  }).join(''):'<div class="cm-empty">No hay proyectos críticos.</div>';
  body.querySelectorAll('[data-index]').forEach(x=>x.onclick=()=>{window.bootstrap?.Modal.getInstance(modal)?.hide();monitor?.openModal?.(Number(x.dataset.index));});
  window.bootstrap?.Modal.getOrCreateInstance(modal).show();
}

function findHost(){
  const input=[...document.querySelectorAll('input')].find(x=>/Buscar proyecto, responsable, etiqueta/i.test(x.placeholder||''));
  if(!input)return null;
  let node=input;
  for(let i=0;i<5&&node;i++,node=node.parentElement){
    if(node.tagName==='HEADER'||node.classList.contains('header')||node.classList.contains('topbar')||node.querySelector?.('.avatar'))return node;
  }
  return input.parentElement?.parentElement||input.parentElement;
}

function mountInlineActions(){
  if(document.getElementById('cm-inline-actions'))return true;
  const host=findHost();
  if(!host)return false;
  host.style.position=host.style.position||'relative';
  const style=document.createElement('style');
  style.id='cm-inline-actions-style';
  style.textContent=`
    #cm-inline-actions{position:absolute;right:245px;top:50%;transform:translateY(-50%);display:flex;align-items:center;gap:9px;z-index:80;white-space:nowrap}
    #cm-inline-actions .cm-inline-btn{height:40px;padding:0 15px;border:1px solid #315e83;border-radius:21px;background:linear-gradient(180deg,#092944,#061b2f);color:#bdd9ed;font-size:13px;font-weight:700;display:inline-flex;align-items:center;gap:7px;cursor:pointer;transition:.18s ease;box-shadow:inset 0 1px #ffffff08}
    #cm-inline-actions .cm-inline-btn:hover{border-color:#20d7ff;color:#fff;box-shadow:0 0 15px #19d9ff33;transform:translateY(-1px)}
    #cm-inline-actions .primary{background:linear-gradient(135deg,#087cf4,#149ff0);border-color:#1e9fff;color:#fff}
    #cm-inline-actions .report{background:linear-gradient(135deg,#087cf4,#1687ff);border-color:#1ca5ff;color:#fff}
    #cm-inline-actions .badge{font-size:10px;color:#fff;background:transparent;padding:0}
    #cm-inline-actions .cm-inline-btn:focus{outline:none}
    #cm-dashboard-v2 .cm-top-actions{display:none!important}
    #cm-production-commandbar{display:none!important}
    @media(max-width:1450px){#cm-inline-actions{right:235px;gap:6px}#cm-inline-actions .cm-inline-btn{padding:0 11px;font-size:12px}}
    @media(max-width:1100px){#cm-inline-actions{position:relative;right:auto;top:auto;transform:none;margin-left:auto;flex-wrap:wrap}.cm-inline-btn{height:36px!important}}
  `;
  document.head.appendChild(style);
  const wrap=document.createElement('div');wrap.id='cm-inline-actions';
  wrap.innerHTML=`<button class="cm-inline-btn primary" id="cm-inline-new"><i class="ti ti-plus"></i> Nuevo Proyecto</button><button class="cm-inline-btn" id="cm-inline-deselect"><i class="ti ti-checkbox"></i> Desmarcar Todos</button><button class="cm-inline-btn" id="cm-inline-excel"><i class="ti ti-file-spreadsheet"></i> Excel</button><button class="cm-inline-btn report" id="cm-inline-report"><i class="ti ti-file-text"></i> Reporte (<span id="cm-inline-report-count">0</span>)</button>`;
  host.appendChild(wrap);
  document.getElementById('cm-inline-new').onclick=openNew;
  document.getElementById('cm-inline-deselect').onclick=deselect;
  document.getElementById('cm-inline-excel').onclick=excel;
  document.getElementById('cm-inline-report').onclick=report;
  return true;
}

function updateCount(){
  const el=document.getElementById('cm-inline-report-count');
  if(el)el.textContent=projects().length;
}

function installDashboard(){
  if(!window.monitor||!monitor.hexTower3D||typeof monitor.hexTower3D.injectProfessionalDashboard!=='function'){
    setTimeout(installDashboard,200);return;
  }
  monitor.hexTower3D.injectProfessionalDashboard();
  updateCount();
  if(!mountInlineActions())setTimeout(mountInlineActions,500);
}

function boot(){
  installDashboard();
  mountInlineActions();
  updateCount();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
window.addEventListener('load',boot);
window.addEventListener('cm:projects-updated',updateCount);
setInterval(()=>{mountInlineActions();updateCount();},1200);
})();