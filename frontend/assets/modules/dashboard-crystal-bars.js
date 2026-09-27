(function(){
  'use strict';
  const STYLE_ID='cm-reference-bars-v8';
  const GRID_ID='cm-cylinders';
  function installStyles(){
    if(document.getElementById(STYLE_ID)) return;
    const style=document.createElement('style'); style.id=STYLE_ID;
    style.textContent=`
      #${GRID_ID} .cm-cylinder,#${GRID_ID} .cm-liquid,#${GRID_ID} .cm-cylinder-value{display:none!important}
      #${GRID_ID}{height:390px!important;min-height:390px!important;padding:30px 28px 10px!important;display:grid!important;grid-template-columns:repeat(7,minmax(90px,1fr))!important;gap:10px!important;align-items:end!important;overflow:hidden!important}
      #${GRID_ID} .cm-project{min-width:0!important;position:relative!important;text-align:center!important;cursor:pointer!important}
      #${GRID_ID} .cm-reference-wrap{height:304px!important;display:flex!important;align-items:flex-end!important;justify-content:center!important;position:relative!important}
      #${GRID_ID} .cm-reference-tower{position:relative!important;width:116px!important;height:190px!important;--c:#19d9ff;--fill:150px;overflow:visible!important;filter:drop-shadow(0 9px 7px rgba(0,0,0,.30))!important}
      #${GRID_ID} .cm-reference-sleeve{position:absolute!important;z-index:3!important;left:6px!important;bottom:28px!important;width:104px!important;height:var(--fill)!important;min-height:62px!important;box-sizing:border-box!important;border:2px solid color-mix(in srgb,var(--c) 76%,#fff 24%)!important;border-radius:21px 21px 16px 16px!important;background:linear-gradient(90deg,color-mix(in srgb,var(--c) 63%,#20262b) 0%,color-mix(in srgb,var(--c) 84%,#fff) 15%,var(--c) 38%,color-mix(in srgb,var(--c) 92%,#fff) 55%,color-mix(in srgb,var(--c) 70%,#11181d) 82%,color-mix(in srgb,var(--c) 52%,#10161b) 100%)!important;box-shadow:inset 8px 0 9px rgba(255,255,255,.25),inset -10px 0 12px rgba(0,0,0,.28),0 4px 7px rgba(0,0,0,.24)!important}
      #${GRID_ID} .cm-reference-sleeve:before{content:"";position:absolute!important;left:-2px!important;right:-2px!important;top:-9px!important;height:18px!important;box-sizing:border-box!important;border:2px solid color-mix(in srgb,var(--c) 62%,#fff 38%)!important;border-radius:50%!important;background:linear-gradient(180deg,color-mix(in srgb,var(--c) 66%,#fff 34%) 0%,var(--c) 48%,color-mix(in srgb,var(--c) 72%,#10161b) 100%)!important;box-shadow:inset 0 2px 3px rgba(255,255,255,.58),inset 0 -2px 3px rgba(0,0,0,.20),0 1px 3px rgba(0,0,0,.16)!important}
      #${GRID_ID} .cm-reference-sleeve:after{content:"";position:absolute!important;left:11px!important;top:13px!important;width:7px!important;height:calc(100% - 27px)!important;border-radius:8px!important;background:linear-gradient(180deg,rgba(255,255,255,.55),rgba(255,255,255,.10))!important;opacity:.75!important}
      #${GRID_ID} .cm-reference-base{position:absolute!important;z-index:7!important;left:0!important;bottom:4px!important;width:116px!important;height:25px!important;box-sizing:border-box!important;border:2px solid #aeb6bb!important;border-radius:50%!important;background:linear-gradient(180deg,#fff 0%,#d6dbde 48%,#f8fafb 100%)!important;box-shadow:0 3px 6px rgba(0,0,0,.42),inset 0 2px 2px rgba(255,255,255,.95)!important}
      #${GRID_ID} .cm-reference-base:before{content:"";position:absolute!important;left:25px!important;right:25px!important;top:3px!important;height:10px!important;border-radius:50%!important;background:linear-gradient(180deg,#fff,#dfe4e6)!important;box-shadow:inset 0 2px 3px rgba(92,104,111,.26)!important}
      #${GRID_ID} .cm-reference-base:after{content:"";position:absolute!important;left:19px!important;right:19px!important;bottom:-7px!important;height:7px!important;border-radius:50%!important;background:rgba(43,52,58,.42)!important;filter:blur(3px)!important}
      #${GRID_ID} .cm-reference-value{position:absolute!important;z-index:12!important;top:-21px!important;left:0!important;right:0!important;color:#edf5fb!important;font-size:15px!important;line-height:1!important;font-weight:800!important;text-align:center!important;text-shadow:none!important}
      #${GRID_ID} .cm-reference-tower:hover{transform:translateY(-1px)!important}
      @media(max-width:1200px){#${GRID_ID}{grid-template-columns:repeat(4,minmax(90px,1fr))!important;height:auto!important;min-height:390px!important}}
      @media(max-width:760px){#${GRID_ID}{grid-template-columns:repeat(2,minmax(90px,1fr))!important;min-height:540px!important;padding:30px 8px 12px!important}#${GRID_ID} .cm-reference-tower{transform:scale(.82)!important}}

      /* EDITOR DE PROYECTO — HUD RECTANGULAR, SIN CIRCULOS */
      #crudModal .modal-dialog{max-width:1080px!important;width:calc(100% - 28px)!important}
      #crudModal .modal-content{background:#071426!important;border:1px solid rgba(34,211,238,.42)!important;border-radius:2px!important;overflow:hidden!important;box-shadow:0 0 0 1px rgba(34,211,238,.08),0 0 35px rgba(0,170,255,.12)!important;position:relative!important}
      #crudModal .modal-content:before{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(rgba(34,211,238,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(34,211,238,.025) 1px,transparent 1px);background-size:24px 24px;mask-image:linear-gradient(to bottom,black,transparent 90%)}
      #crudModal .modal-header{position:relative!important;padding:22px 26px 18px!important;background:linear-gradient(90deg,rgba(7,29,52,.98),rgba(7,20,38,.92))!important;border-bottom:1px solid rgba(34,211,238,.28)!important}
      #crudModal .modal-header:after{content:"SYSTEM / PROJECT EDITOR";position:absolute;right:58px;top:12px;color:rgba(34,211,238,.55);font:10px 'Share Tech Mono',monospace;letter-spacing:.16em}
      #crudModal .modal-title{font-family:'Orbitron',sans-serif!important;font-size:1.18rem!important;letter-spacing:.08em!important;text-transform:uppercase!important;color:#f1f7ff!important}
      #crudModal .modal-header p{font-family:'Share Tech Mono',monospace!important;color:#5ddff5!important;letter-spacing:.12em!important;text-transform:uppercase!important}
      #crudModal .btn-close{filter:invert(1)!important;opacity:.65!important}
      #crudModal .modal-body{padding:24px 26px 26px!important;background:rgba(5,17,31,.94)!important;position:relative!important}
      #crudModal #nodeForm{display:grid!important;grid-template-columns:minmax(0,2fr) minmax(240px,1fr)!important;gap:18px 20px!important;margin:0!important}
      #crudModal #nodeForm>.col-12:first-of-type{grid-column:1/-1!important}
      #crudModal #nodeForm>.col-12:nth-last-of-type(3){grid-column:1/-1!important}
      #crudModal #nodeForm>.col-md-6{width:auto!important;padding:0!important}
      #crudModal #nodeForm>.col-12.d-flex{grid-column:1/-1!important;margin:2px 0 0!important;padding:18px 0 0!important;border-top:1px solid rgba(34,211,238,.2)!important}
      #crudModal .form-label{display:block!important;margin:0 0 7px!important;color:#78a4bf!important;font:600 11px 'Share Tech Mono',monospace!important;letter-spacing:.16em!important;text-transform:uppercase!important}
      #crudModal .form-control,#crudModal .form-select{height:44px!important;border-radius:1px!important;background:#09182b!important;border:1px solid #21405a!important;color:#e9f7ff!important;box-shadow:inset 0 0 12px rgba(0,0,0,.2)!important;padding:9px 12px!important}
      #crudModal textarea.form-control{height:auto!important;min-height:92px!important}
      #crudModal .form-control:focus,#crudModal .form-select:focus{border-color:#22d3ee!important;box-shadow:0 0 0 1px rgba(34,211,238,.25),inset 0 0 12px rgba(0,0,0,.25)!important}
      #crudModal #nodeProgress{font-family:'Share Tech Mono',monospace!important;font-size:1.1rem!important;color:#22d3ee!important}
      #crudModal .id-delete-btn,#crudModal #submitBtn,#crudModal .btn-light{border-radius:1px!important;min-height:40px!important;padding:8px 18px!important;font-family:'Share Tech Mono',monospace!important;text-transform:uppercase!important;letter-spacing:.08em!important}
      #crudModal #submitBtn{background:#0b86e8!important;border-color:#22aef3!important;box-shadow:0 0 14px rgba(34,174,243,.2)!important}
      #crudModal .id-delete-btn{background:transparent!important;border-color:#ef476f!important;color:#ff6686!important}
      #crudModal .btn-light{background:#dbe8f1!important;color:#071426!important;border-color:#dbe8f1!important}
      #crudModal #updatesSection{display:block!important;grid-column:1/-1!important;margin:6px 0 0!important;padding:22px 0 0!important;border-top:1px solid rgba(34,211,238,.28)!important}
      #crudModal #updatesSection h6{font-family:'Orbitron',sans-serif!important;color:#dceeff!important;letter-spacing:.1em!important;font-size:.82rem!important;margin-bottom:16px!important}
      #crudModal #updatesSection h6:before{content:"//";color:#22d3ee;margin-right:8px}
      #crudModal #updateNote{min-height:96px!important;border-color:#21405a!important}
      #crudModal #updateFiles{height:42px!important;padding:8px!important}
      #crudModal #addUpdateBtn{border-radius:1px!important;background:#062a43!important;border:1px solid #22d3ee!important;color:#5de8ff!important;min-height:40px!important;padding:8px 18px!important;font-family:'Share Tech Mono',monospace!important;text-transform:uppercase!important;letter-spacing:.07em!important}
      #crudModal #updatesList{max-height:280px!important;overflow-y:auto!important;margin-top:14px!important;padding-right:4px!important;gap:8px!important}
      #crudModal #updatesList>*{border-radius:1px!important;background:linear-gradient(90deg,rgba(9,31,51,.96),rgba(7,20,35,.96))!important;border:1px solid #1e4059!important;border-left:3px solid #22d3ee!important;padding:12px 14px!important;box-shadow:none!important}
      #crudModal #updatesList::-webkit-scrollbar{width:5px}
      #crudModal #updatesList::-webkit-scrollbar-thumb{background:#1f718b}
      @media(max-width:760px){#crudModal .modal-dialog{width:calc(100% - 12px)!important}#crudModal #nodeForm{grid-template-columns:1fr!important}#crudModal #nodeForm>*{grid-column:1!important}#crudModal .modal-body,#crudModal .modal-header{padding-left:16px!important;padding-right:16px!important}}
    `;
    document.head.appendChild(style);
  }
  function transformProject(project){
    if(!project||project.querySelector('.cm-reference-tower')) return;
    const old=project.querySelector('.cm-cylinder'); if(!old) return;
    const valueEl=old.querySelector('.cm-cylinder-value');
    const value=Math.max(0,Math.min(100,parseFloat((valueEl?.textContent||'0').replace('%',''))||0));
    const c=(old.style.getPropertyValue('--c')||'#19d9ff').trim();
    const wrap=document.createElement('div'); wrap.className='cm-reference-wrap';
    const tower=document.createElement('div'); tower.className='cm-reference-tower';
    tower.style.setProperty('--c',c); tower.style.setProperty('--fill',`${70+value*0.95}px`);
    tower.innerHTML=`<span class="cm-reference-value">${value}%</span><div class="cm-reference-sleeve"></div><div class="cm-reference-base"></div>`;
    wrap.appendChild(tower); old.replaceWith(wrap);
  }
  function boot(){installStyles();const grid=document.getElementById(GRID_ID);if(grid)grid.querySelectorAll('.cm-project').forEach(transformProject)}
  boot();document.addEventListener('DOMContentLoaded',boot);const observer=new MutationObserver(()=>boot());observer.observe(document.body,{childList:true,subtree:true});setTimeout(boot,100);setTimeout(boot,500);setTimeout(boot,1200);
})();
