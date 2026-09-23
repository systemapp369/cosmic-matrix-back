(function(){
'use strict';

const getMonitor=()=>{
  if(window.monitor) return window.monitor;
  try { return typeof monitor !== 'undefined' ? monitor : null; } catch(e) { return null; }
};
const projects=()=>{const m=getMonitor();return m&&Array.isArray(m.projects)?m.projects:[];};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const toast=(msg)=>{try{getMonitor()?.showToast?.(msg);}catch(e){console.log(msg);}};

function showBootstrapModal(id){
  const el=document.getElementById(id); if(!el)return false;
  if(window.bootstrap?.Modal){ window.bootstrap.Modal.getOrCreateInstance(el).show(); return true; }
  el.classList.add('show'); el.style.display='block'; el.removeAttribute('aria-hidden'); return true;
}

function openNew(){
  const m=getMonitor(); if(!m)return;
  try{
    if(typeof m.openCreateModal==='function'){m.openCreateModal();return;}
    const form=document.getElementById('nodeForm'); form?.reset();
    const idx=document.getElementById('nodeIndex'); if(idx)idx.value='NEW';
    const title=document.getElementById('modalTitle'); if(title)title.textContent='Nuevo Proyecto';
    const sub=document.getElementById('modalSub'); if(sub)sub.textContent='Registrar nuevo proyecto en Cosmic Matrix';
    const del=document.getElementById('deleteBtn'); if(del)del.style.display='none';
    if(m.bsCrudModal?.show)m.bsCrudModal.show(); else showBootstrapModal('crudModal');
  }catch(e){console.error('Nuevo Proyecto',e);toast('No se pudo abrir Nuevo Proyecto');}
}

function deselect(){
  const m=getMonitor();
  projects().forEach(p=>p.selected=false);
  document.querySelectorAll('.selected,.active-project,.is-selected').forEach(x=>x.classList.remove('selected','active-project','is-selected'));
  if(m){m.currentProjectId=null;m.indexToDelete=null;try{m.renderDashboard?.();m.hexTower3D?.renderDashboardShell?.();}catch(e){}}
  window.dispatchEvent(new CustomEvent('cm:deselect-all'));
  toast('Todas las selecciones fueron desmarcadas');
}

function excel(){
  const ps=projects();
  if(!ps.length){toast('No hay proyectos para exportar');return;}
  const rows=ps.map(p=>[p.id,p.name,p.level,p.progress,p.lead,p.description]);
  const escCell=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const html='<html><head><meta charset="UTF-8"></head><body><table border="1"><tr><th>ID</th><th>Proyecto</th><th>Nivel</th><th>Progreso</th><th>Responsable</th><th>Descripción</th></tr>'+rows.map(r=>'<tr>'+r.map(v=>'<td>'+escCell(v)+'</td>').join('')+'</tr>').join('')+'</table></body></html>';
  const blob=new Blob([html],{type:'application/vnd.ms-excel;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='cosmic-matrix-proyectos.xls';document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Excel generado correctamente');
}

function ensureReportModal(){
  let modal=document.getElementById('cmReportActionModal');
  if(modal)return modal;
  modal=document.createElement('div');modal.id='cmReportActionModal';modal.className='modal fade';modal.tabIndex=-1;modal.innerHTML='<div class="modal-dialog modal-lg modal-dialog-centered"><div class="modal-content" style="background:#06182b;color:#dcefff;border:1px solid #1473a8;border-radius:18px"><div class="modal-header"><h5 class="modal-title">Reporte de Proyectos</h5><button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button></div><div class="modal-body" id="cmReportActionBody"></div><div class="modal-footer"><button type="button" class="btn btn-outline-info" data-bs-dismiss="modal">Cerrar</button></div></div></div>';
  document.body.appendChild(modal);return modal;
}

function report(){
  const ps=projects(),avg=ps.length?Math.round(ps.reduce((s,p)=>s+Number(p.progress||0),0)/ps.length):0;
  const attention=ps.filter(p=>p.level==='CRÍTICA'||p.level==='ALTA'||Number(p.progress||0)<40).length;
  const modal=ensureReportModal(),body=modal.querySelector('#cmReportActionBody');
  body.innerHTML='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:18px">'+[['Proyectos',ps.length],['Avance promedio',avg+'%'],['Requieren atención',attention]].map(x=>'<div style="padding:18px;border:1px solid #15517a;border-radius:12px;background:#081f35"><div style="font-size:28px;font-weight:800">'+x[1]+'</div><div style="opacity:.7">'+x[0]+'</div></div>').join('')+'</div><div style="max-height:360px;overflow:auto"><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;padding:8px">Proyecto</th><th>Progreso</th><th>Estado</th></tr></thead><tbody>'+ps.map(p=>'<tr><td style="padding:8px;border-top:1px solid #12334c">'+esc(p.name)+'</td><td style="text-align:center;border-top:1px solid #12334c">'+Number(p.progress||0)+'%</td><td style="text-align:center;border-top:1px solid #12334c">'+esc(p.level||'—')+'</td></tr>').join('')+'</tbody></table></div>';
  showBootstrapModal('cmReportActionModal');
}

function ensureCriticalModal(){
  let modal=document.getElementById('cmCriticalActionModal');
  if(modal)return modal;
  modal=document.createElement('div');modal.id='cmCriticalActionModal';modal.className='modal fade';modal.tabIndex=-1;modal.innerHTML='<div class="modal-dialog modal-lg modal-dialog-centered"><div class="modal-content" style="background:#06182b;color:#dcefff;border:1px solid #ff3155;border-radius:18px"><div class="modal-header"><h5 class="modal-title">🔔 Proyectos críticos y en atención</h5><button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button></div><div class="modal-body" id="cmCriticalActionBody"></div><div class="modal-footer"><button type="button" class="btn btn-outline-info" data-bs-dismiss="modal">Cerrar</button></div></div></div>';
  document.body.appendChild(modal);return modal;
}

function critical(){
  const ps=projects(),list=ps.filter(p=>p.level==='CRÍTICA'||p.level==='ALTA'||Number(p.progress||0)<40).sort((a,b)=>Number(a.progress||0)-Number(b.progress||0));
  const modal=ensureCriticalModal(),body=modal.querySelector('#cmCriticalActionBody');
  body.innerHTML=list.length?list.map(p=>{const i=ps.indexOf(p);return '<button type="button" class="cm-critical-row" data-index="'+i+'" style="width:100%;margin-bottom:8px;padding:12px;border:1px solid #173b55;border-radius:10px;background:#081f35;color:#dcefff;display:flex;align-items:center;gap:10px;cursor:pointer"><span style="width:10px;height:10px;border-radius:50%;background:#ff3155;box-shadow:0 0 10px #ff3155"></span><span style="flex:1;text-align:left"><strong>'+esc(p.name)+'</strong><small style="display:block;opacity:.65">'+esc(p.description||p.lead||'Sin descripción')+'</small></span><b>'+Number(p.progress||0)+'%</b></button>';}).join(''):'<div style="padding:30px;text-align:center;opacity:.7">No hay proyectos críticos.</div>';
  body.querySelectorAll('[data-index]').forEach(x=>x.onclick=()=>{try{window.bootstrap?.Modal.getInstance(modal)?.hide();getMonitor()?.openModal?.(Number(x.dataset.index));}catch(e){}});
  showBootstrapModal('cmCriticalActionModal');
}

function findHost(){
  const input=[...document.querySelectorAll('input')].find(x=>/Buscar proyecto, responsable, etiqueta/i.test(x.placeholder||''));
  if(!input)return null;
  let node=input;
  for(let i=0;i<7&&node;i++,node=node.parentElement){if(node.tagName==='HEADER'||node.classList.contains('header')||node.classList.contains('topbar')||node.querySelector?.('.avatar'))return node;}
  return input.parentElement?.parentElement||input.parentElement;
}

function mountInlineActions(){
  if(document.getElementById('cm-inline-actions'))return true;
  const host=findHost();if(!host)return false;
  const style=document.createElement('style');style.id='cm-inline-actions-style';style.textContent='#cm-inline-actions{position:absolute;right:245px;top:50%;transform:translateY(-50%);display:flex;align-items:center;gap:9px;z-index:80;white-space:nowrap}#cm-inline-actions .cm-inline-btn{height:40px;padding:0 15px;border:1px solid #315e83;border-radius:21px;background:linear-gradient(180deg,#092944,#061b2f);color:#bdd9ed;font-size:13px;font-weight:700;display:inline-flex;align-items:center;gap:7px;cursor:pointer}#cm-inline-actions .primary,#cm-inline-actions .report{background:linear-gradient(135deg,#087cf4,#1687ff);border-color:#1ca5ff;color:#fff}#cm-production-commandbar{display:none!important}@media(max-width:1450px){#cm-inline-actions{right:245px;gap:6px}#cm-inline-actions .cm-inline-btn{padding:0 11px;font-size:12px}}';document.head.appendChild(style);
  const wrap=document.createElement('div');wrap.id='cm-inline-actions';wrap.innerHTML='<button class="cm-inline-btn primary" id="cm-inline-new"><i class="ti ti-plus"></i> Nuevo Proyecto</button><button class="cm-inline-btn" id="cm-inline-deselect"><i class="ti ti-checkbox"></i> Desmarcar Todos</button><button class="cm-inline-btn" id="cm-inline-excel"><i class="ti ti-file-spreadsheet"></i> Excel</button><button class="cm-inline-btn report" id="cm-inline-report"><i class="ti ti-file-text"></i> Reporte (<span id="cm-inline-report-count">0</span>)</button>';
  host.style.position=host.style.position||'relative';host.appendChild(wrap);
  wrap.querySelector('#cm-inline-new').onclick=openNew;wrap.querySelector('#cm-inline-deselect').onclick=deselect;wrap.querySelector('#cm-inline-excel').onclick=excel;wrap.querySelector('#cm-inline-report').onclick=report;
  return true;
}

function attachBell(){
  if(document.getElementById('cm-bell-bound'))return true;
  const scope=document.querySelector('#cm-dashboard')||document;
  const candidates=[...scope.querySelectorAll('button,a,[role="button"]')].filter(x=>{const t=(x.getAttribute('aria-label')||x.title||x.textContent||'').toLowerCase();return t.includes('notific')||!!x.querySelector?.('.ti-bell,.fa-bell,.bi-bell');});
  const bell=candidates[0];if(!bell)return false;
  bell.dataset.cmBellBound='1';bell.addEventListener('click',function(e){e.preventDefault();e.stopImmediatePropagation();critical();},true);
  const mark=document.createElement('span');mark.id='cm-bell-bound';mark.style.display='none';document.body.appendChild(mark);return true;
}

function update(){
  const ps=projects();
  const el=document.getElementById('cm-inline-report-count');if(el)el.textContent=ps.length;
  const count=ps.filter(p=>p.level==='CRÍTICA'||p.level==='ALTA'||Number(p.progress||0)<40).length;
  const bell=(document.querySelector('#cm-dashboard .ti-bell')||{}).closest?.('button');
  if(bell){const badge=bell.querySelector('.badge');if(badge)badge.textContent=count;}
  document.querySelectorAll('[data-cm-critical-count]').forEach(x=>x.textContent=count);
}

function installDashboard(){
  const m=getMonitor();if(!m||!m.hexTower3D||typeof m.hexTower3D.injectProfessionalDashboard!=='function'){setTimeout(installDashboard,200);return;}
  // Expose the live instances for the legacy inline controls used by the dashboard.
  window.monitor=m;
  window.hexTower3D=m.hexTower3D;
  try{m.hexTower3D.injectProfessionalDashboard();}catch(e){console.error(e);}
  mountInlineActions();attachBell();update();
}

function boot(){installDashboard();mountInlineActions();attachBell();update();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
window.addEventListener('load',boot);
window.addEventListener('cm:projects-updated',()=>{update();attachBell();});
setInterval(()=>{mountInlineActions();attachBell();update();},1200);
})();