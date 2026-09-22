(function(){'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const projects=()=>window.monitor&&Array.isArray(window.monitor.projects)?window.monitor.projects:[];
function install(){
 const root=document.getElementById('cm-dashboard-v2');
 const monitor=window.monitor;
 if(!root||!monitor){setTimeout(install,300);return;}
 if(document.getElementById('cm-actions-v3'))return;
 const style=document.createElement('style');
 style.textContent=`
 #cm-dashboard-v2 .cm-top-actions{display:flex!important;align-items:center!important;gap:9px!important;white-space:nowrap}
 #cm-dashboard-v2 .cm-action-v3{height:40px;border:1px solid #23547c;border-radius:12px;background:linear-gradient(180deg,#092944,#061a2c);color:#b9d8ed;padding:0 14px;display:inline-flex;align-items:center;gap:7px;font:600 12px/1 system-ui,sans-serif;cursor:pointer;box-shadow:inset 0 1px #ffffff10,0 0 14px #00cfff0d;transition:.18s}
 #cm-dashboard-v2 .cm-action-v3:hover{border-color:#19d9ff;color:#fff;box-shadow:0 0 18px #19d9ff28;transform:translateY(-1px)}
 #cm-dashboard-v2 .cm-action-v3.primary{background:linear-gradient(135deg,#087cff,#16cfff);border-color:#35ddff;color:#fff;box-shadow:0 0 20px #008cff35}
 #cm-dashboard-v2 .cm-action-v3.report{background:linear-gradient(135deg,#087cff,#1269ff);border-color:#3497ff;color:#fff}
 #cm-dashboard-v2 .cm-action-v3 i{font-size:17px}
 #cm-dashboard-v2 .cm-bell-v3{position:relative;width:42px!important;padding:0!important;justify-content:center}
 #cm-dashboard-v2 .cm-alert-count-v3{position:absolute;right:-2px;top:-5px;min-width:18px;height:18px;padding:0 5px;border-radius:20px;background:#ff315d;color:#fff;border:2px solid #061729;font:800 10px/14px system-ui;text-align:center;box-shadow:0 0 12px #ff315d77}
 #cm-dashboard-v2 .cm-saturn-v3{position:absolute;left:10px;bottom:18px;width:180px;height:128px;object-fit:contain;opacity:.9;filter:drop-shadow(0 0 16px #19d9ff38);pointer-events:none;z-index:2}
 #cm-dashboard-v2 .cm-saturn-caption{position:absolute;left:22px;bottom:8px;color:#4f86a7;font:600 8px/1 system-ui,sans-serif;letter-spacing:2px;z-index:3}
 #cm-dashboard-v2 .cm-critical-item{display:flex;align-items:center;gap:10px;padding:11px 8px;border-bottom:1px solid #12334b;cursor:pointer;border-radius:8px}
 #cm-dashboard-v2 .cm-critical-item:hover{background:#0b2940}
 #cm-dashboard-v2 .cm-critical-dot{width:8px;height:8px;border-radius:50%;background:#ff315d;box-shadow:0 0 10px #ff315d;flex:0 0 auto}
 #cm-dashboard-v2 .cm-critical-meta{margin-left:auto;text-align:right}
 #cm-dashboard-v2 .cm-critical-meta strong{display:block;color:#eaf7ff;font-size:12px}
 #cm-dashboard-v2 .cm-critical-meta small{color:#7fa9c2;font-size:10px}
 @media(max-width:1100px){#cm-dashboard-v2 .cm-action-v3 .cm-action-label{display:none}#cm-dashboard-v2 .cm-action-v3{padding:0 10px}#cm-dashboard-v2 .cm-saturn-v3{width:140px;height:100px}}
 `;
 document.head.appendChild(style);
 const actions=document.createElement('div');actions.id='cm-actions-v3';
 const top=root.querySelector('.cm-top-actions');
 const newBtn=top?.querySelector('#cm-new-project');
 if(top&&newBtn){
   newBtn.classList.add('cm-action-v3','primary');
   newBtn.innerHTML='<i class="ti ti-plus"></i><span class="cm-action-label">Nuevo Proyecto</span>';
   newBtn.onclick=()=>window.cmOpenNewProject?.();
   const make=(id,icon,label,cls,fn)=>{const b=document.createElement('button');b.id=id;b.type='button';b.className='cm-action-v3 '+(cls||'');b.innerHTML='<i class="ti '+icon+'"></i><span class="cm-action-label">'+label+'</span>';b.onclick=fn;return b};
   const deselect=make('cm-deselect-v3','ti-square-check','Desmarcar Todos','',()=>{projects().forEach(p=>p.selected=false);try{monitor.updateSelectedCount?.()}catch(e){};monitor.renderDashboard?.();monitor.showToast?.('Selecciones limpiadas');});
   const excel=make('cm-excel-v3','ti-file-spreadsheet','Excel','',()=>{if(typeof monitor.generateExcelReport==='function'){monitor.generateExcelReport();}else if(window.XLSX){const rows=projects().map(p=>({ID:p.id,Proyecto:p.name,Nivel:p.level,Progreso:p.progress,Responsable:p.lead,Descripcion:p.description}));const wb=XLSX.utils.book_new();const ws=XLSX.utils.json_to_sheet(rows);XLSX.utils.book_append_sheet(wb,ws,'Proyectos');XLSX.writeFile(wb,'cosmic-matrix-proyectos.xlsx');}else monitor.showToast?.('Generador Excel no disponible');});
   const report=make('cm-report-v3','ti-file-description','Reporte ('+projects().length+')','report',()=>openReport());
   top.insertBefore(deselect,newBtn.nextSibling);top.insertBefore(excel,deselect.nextSibling);top.insertBefore(report,excel.nextSibling);
   const oldBell=top.querySelector('.cm-icon-btn:nth-of-type(2)')||Array.from(top.querySelectorAll('.cm-icon-btn')).find(x=>x.querySelector('.ti-bell'));
   if(oldBell){oldBell.id='cm-bell-v3';oldBell.classList.add('cm-bell-v3');oldBell.title='Proyectos críticos';oldBell.onclick=()=>openCriticals();oldBell.innerHTML='<i class="ti ti-bell"></i><span class="cm-alert-count-v3" id="cm-alert-count-v3">0</span>';}
 }
 const sidebar=root.querySelector('.cm-sidebar');
 if(sidebar&&!sidebar.querySelector('.cm-saturn-v3')){const img=document.createElement('img');img.className='cm-saturn-v3';img.src='./Images/saturn-dashboard.svg';img.alt='Saturno';sidebar.appendChild(img);const cap=document.createElement('div');cap.className='cm-saturn-caption';cap.textContent='COSMIC MATRIX';sidebar.appendChild(cap);}
 updateAlertCount();
 window.addEventListener('cm:projects-updated',updateAlertCount);
 function updateAlertCount(){const n=projects().filter(p=>p.level==='CRÍTICA').length;const el=document.getElementById('cm-alert-count-v3');if(el)el.textContent=n;const rb=document.getElementById('cm-report-v3');if(rb)rb.querySelector('.cm-action-label').textContent='Reporte ('+projects().length+')';}
 function openCriticals(){
   const list=projects().filter(p=>p.level==='CRÍTICA'||Number(p.progress||0)<40).sort((a,b)=>Number(a.progress||0)-Number(b.progress||0));
   const modal=document.getElementById('criticalityModal');const body=document.getElementById('criticalityModalBody');
   if(!modal||!body)return;
   document.getElementById('criticalityModalTitle').textContent='Proyectos críticos';
   body.innerHTML=list.length?list.map(p=>{const i=projects().findIndex(x=>x.id===p.id);return '<div class="cm-critical-item" data-index="'+i+'"><span class="cm-critical-dot"></span><div><strong>'+esc(p.name)+'</strong><small class="d-block text-muted">'+esc(p.description||'Sin descripción')+'</small></div><div class="cm-critical-meta"><strong>'+Number(p.progress||0)+'%</strong><small>'+(p.level==='CRÍTICA'?'CRÍTICO':'ATENCIÓN')+'</small></div></div>'}).join(''):'<div class="text-center text-muted py-5">No hay proyectos críticos.</div>';
   body.querySelectorAll('[data-index]').forEach(el=>el.onclick=()=>{const i=Number(el.dataset.index);monitor.bsCriticalityModal?.hide();setTimeout(()=>monitor.openModal?.(i),250)});
   monitor.bsCriticalityModal?.show();
 }
 function openReport(){
   const modal=document.getElementById('reportModal'),body=document.getElementById('reportModalBody');if(!modal||!body)return;
   const ps=projects(),avg=ps.length?Math.round(ps.reduce((s,p)=>s+Number(p.progress||0),0)/ps.length):0,risk=ps.filter(p=>p.level==='CRÍTICA'||p.level==='ALTA').length;
   document.getElementById('reportModalTitle').innerHTML='<i class="ti ti-report-analytics text-primary me-1"></i> Reporte de Proyectos';
   body.innerHTML='<div class="row g-3 mb-3"><div class="col-md-4"><div class="p-3 rounded border"><small>Total</small><h3 class="mb-0">'+ps.length+'</h3></div></div><div class="col-md-4"><div class="p-3 rounded border"><small>Avance promedio</small><h3 class="mb-0">'+avg+'%</h3></div></div><div class="col-md-4"><div class="p-3 rounded border"><small>Requieren atención</small><h3 class="mb-0">'+risk+'</h3></div></div></div><div class="table-responsive"><table class="table table-sm align-middle"><thead><tr><th>Proyecto</th><th>Nivel</th><th>Avance</th><th>Responsable</th></tr></thead><tbody>'+ps.map(p=>'<tr><td>'+esc(p.name)+'</td><td>'+esc(p.level)+'</td><td>'+Number(p.progress||0)+'%</td><td>'+esc(p.lead||'—')+'</td></tr>').join('')+'</tbody></table></div>';
   monitor.bsReportModal?.show();
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();