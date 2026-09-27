(function(){
  'use strict';

  const STYLE_ID = 'cm-reference-bars-v5';
  const GRID_ID = 'cm-cylinders';

  function installStyles(){
    if(document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      /* El diseño anterior de cilindros queda completamente fuera de uso. */
      #${GRID_ID} .cm-cylinder,
      #${GRID_ID} .cm-liquid,
      #${GRID_ID} .cm-cylinder-value { display:none!important; }

      #${GRID_ID}{
        height:390px!important;
        min-height:390px!important;
        padding:38px 28px 12px!important;
        display:grid!important;
        grid-template-columns:repeat(7,minmax(88px,1fr))!important;
        gap:12px!important;
        align-items:end!important;
        overflow:hidden!important;
      }

      #${GRID_ID} .cm-project{
        min-width:0!important;
        position:relative!important;
        text-align:center!important;
        cursor:pointer!important;
      }

      #${GRID_ID} .cm-reference-wrap{
        height:300px!important;
        display:flex!important;
        align-items:flex-end!important;
        justify-content:center!important;
        position:relative!important;
      }

      #${GRID_ID} .cm-reference-tower{
        position:relative!important;
        width:112px!important;
        height:278px!important;
        --c:#19d9ff;
        --fill:150px;
        overflow:visible!important;
        filter:drop-shadow(0 7px 7px rgba(0,0,0,.38))!important;
      }

      /* Tubo blanco superior, igual que la pieza de referencia. */
      #${GRID_ID} .cm-reference-stem{
        position:absolute!important;
        z-index:4!important;
        left:27px!important;
        top:1px!important;
        width:58px!important;
        height:196px!important;
        box-sizing:border-box!important;
        border:2px solid #b9c1c6!important;
        border-radius:9px 9px 7px 7px!important;
        background:linear-gradient(90deg,#d7dcdf 0%,#ffffff 18%,#f5f7f8 47%,#c7cfd3 73%,#ffffff 100%)!important;
        box-shadow:inset 7px 0 10px rgba(255,255,255,.92),inset -8px 0 10px rgba(82,95,104,.30),0 2px 5px rgba(0,0,0,.22)!important;
      }

      #${GRID_ID} .cm-reference-stem:before{
        content:"";
        position:absolute!important;
        left:-5px!important;
        right:-5px!important;
        top:-8px!important;
        height:18px!important;
        border:2px solid #aeb7bc!important;
        border-radius:50%!important;
        background:linear-gradient(180deg,#ffffff 0%,#dce1e4 100%)!important;
        box-shadow:inset 0 2px 4px rgba(255,255,255,.95),0 1px 3px rgba(0,0,0,.22)!important;
      }

      #${GRID_ID} .cm-reference-stem:after{
        content:"";
        position:absolute!important;
        left:8px!important;
        top:10px!important;
        width:5px!important;
        height:170px!important;
        border-radius:8px!important;
        background:linear-gradient(180deg,rgba(255,255,255,.95),rgba(255,255,255,.05))!important;
      }

      /* Camisa de color: su altura sí representa el porcentaje. */
      #${GRID_ID} .cm-reference-sleeve{
        position:absolute!important;
        z-index:3!important;
        left:5px!important;
        bottom:24px!important;
        width:102px!important;
        height:var(--fill)!important;
        min-height:58px!important;
        box-sizing:border-box!important;
        border:2px solid color-mix(in srgb,var(--c) 88%,#fff 12%)!important;
        border-radius:20px 20px 15px 15px!important;
        background:linear-gradient(90deg,
          color-mix(in srgb,var(--c) 72%,#111820) 0%,
          color-mix(in srgb,var(--c) 92%,#fff) 18%,
          var(--c) 43%,
          color-mix(in srgb,var(--c) 82%,#fff) 62%,
          color-mix(in srgb,var(--c) 62%,#111820) 100%)!important;
        box-shadow:inset 9px 0 11px rgba(255,255,255,.27),inset -10px 0 12px rgba(0,0,0,.25),0 4px 10px rgba(0,0,0,.25)!important;
      }

      #${GRID_ID} .cm-reference-sleeve:before{
        content:"";
        position:absolute!important;
        left:-2px!important;
        right:-2px!important;
        top:-9px!important;
        height:18px!important;
        border:2px solid color-mix(in srgb,var(--c) 70%,#fff 30%)!important;
        border-radius:50%!important;
        background:linear-gradient(180deg,color-mix(in srgb,var(--c) 75%,#fff 25%),color-mix(in srgb,var(--c) 90%,#fff 10%))!important;
        box-shadow:inset 0 2px 4px rgba(255,255,255,.68),0 2px 5px rgba(0,0,0,.16)!important;
      }

      #${GRID_ID} .cm-reference-sleeve:after{
        content:"";
        position:absolute!important;
        left:12px!important;
        top:14px!important;
        width:6px!important;
        height:calc(100% - 28px)!important;
        border-radius:8px!important;
        background:linear-gradient(180deg,rgba(255,255,255,.62),rgba(255,255,255,.04))!important;
      }

      /* Base metálica de la referencia. */
      #${GRID_ID} .cm-reference-base{
        position:absolute!important;
        z-index:6!important;
        left:1px!important;
        bottom:5px!important;
        width:110px!important;
        height:25px!important;
        box-sizing:border-box!important;
        border:2px solid #b6bec3!important;
        border-radius:50%!important;
        background:linear-gradient(180deg,#ffffff 0%,#cdd3d6 54%,#f8fafb 100%)!important;
        box-shadow:0 3px 6px rgba(0,0,0,.50),0 0 5px rgba(255,255,255,.62)!important;
      }

      #${GRID_ID} .cm-reference-base:before{
        content:"";
        position:absolute!important;
        left:13px!important;
        right:13px!important;
        top:3px!important;
        height:10px!important;
        border-radius:50%!important;
        background:#f6f8f9!important;
        box-shadow:inset 0 2px 3px rgba(120,132,140,.28)!important;
      }

      #${GRID_ID} .cm-reference-base:after{
        content:"";
        position:absolute!important;
        left:18px!important;
        right:18px!important;
        bottom:-7px!important;
        height:7px!important;
        border-radius:50%!important;
        background:rgba(48,59,67,.43)!important;
        filter:blur(3px)!important;
      }

      #${GRID_ID} .cm-reference-value{
        position:absolute!important;
        z-index:10!important;
        top:-20px!important;
        left:0!important;
        right:0!important;
        color:#eaf8ff!important;
        font-size:15px!important;
        line-height:1!important;
        font-weight:900!important;
        text-align:center!important;
        text-shadow:0 0 10px var(--c)!important;
      }

      @media(max-width:1200px){
        #${GRID_ID}{grid-template-columns:repeat(4,minmax(88px,1fr))!important;height:auto!important;min-height:390px!important}
      }
      @media(max-width:760px){
        #${GRID_ID}{grid-template-columns:repeat(2,minmax(88px,1fr))!important;min-height:540px!important;padding:30px 8px 12px!important}
        #${GRID_ID} .cm-reference-tower{transform:scale(.82)!important}
      }
    `;
    document.head.appendChild(style);
  }

  function transformProject(project){
    if(!project || project.querySelector('.cm-reference-tower')) return;
    const old=project.querySelector('.cm-cylinder');
    if(!old) return;

    const valueEl=old.querySelector('.cm-cylinder-value');
    const value=Math.max(0,Math.min(100,parseFloat((valueEl?.textContent||'0').replace('%',''))||0));
    const c=(old.style.getPropertyValue('--c')||'#19d9ff').trim();

    const wrap=document.createElement('div');
    wrap.className='cm-reference-wrap';

    const tower=document.createElement('div');
    tower.className='cm-reference-tower';
    tower.style.setProperty('--c',c);
    tower.style.setProperty('--fill',`${58 + value*1.22}px`);
    tower.innerHTML=`
      <span class="cm-reference-value">${value}%</span>
      <div class="cm-reference-stem"></div>
      <div class="cm-reference-sleeve"></div>
      <div class="cm-reference-base"></div>
    `;
    wrap.appendChild(tower);
    old.replaceWith(wrap);
  }

  function boot(){
    installStyles();
    const grid=document.getElementById(GRID_ID);
    if(!grid) return;
    grid.querySelectorAll('.cm-project').forEach(transformProject);
  }

  boot();
  document.addEventListener('DOMContentLoaded',boot);
  const observer=new MutationObserver(()=>boot());
  observer.observe(document.body,{childList:true,subtree:true});
  setTimeout(boot,100);
  setTimeout(boot,500);
  setTimeout(boot,1200);
})();
