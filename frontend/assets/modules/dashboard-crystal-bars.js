(function(){
  'use strict';
  const STYLE_ID='cm-reference-bars-v6';
  const GRID_ID='cm-cylinders';
  function installStyles(){
    if(document.getElementById(STYLE_ID)) return;
    const style=document.createElement('style'); style.id=STYLE_ID;
    style.textContent=`
      #${GRID_ID} .cm-cylinder,#${GRID_ID} .cm-liquid,#${GRID_ID} .cm-cylinder-value{display:none!important}
      #${GRID_ID}{height:390px!important;min-height:390px!important;padding:30px 28px 10px!important;display:grid!important;grid-template-columns:repeat(7,minmax(90px,1fr))!important;gap:10px!important;align-items:end!important;overflow:hidden!important}
      #${GRID_ID} .cm-project{min-width:0!important;position:relative!important;text-align:center!important;cursor:pointer!important}
      #${GRID_ID} .cm-reference-wrap{height:304px!important;display:flex!important;align-items:flex-end!important;justify-content:center!important;position:relative!important}
      #${GRID_ID} .cm-reference-tower{position:relative!important;width:116px!important;height:286px!important;--c:#19d9ff;--fill:180px;overflow:visible!important;filter:drop-shadow(0 9px 7px rgba(0,0,0,.30))!important}
      #${GRID_ID} .cm-reference-stem{position:absolute!important;z-index:4!important;left:29px!important;top:0!important;width:58px!important;height:198px!important;box-sizing:border-box!important;border:2px solid #aeb5ba!important;border-radius:9px 9px 8px 8px!important;background:linear-gradient(90deg,#c8ced1 0%,#f8f9fa 14%,#fff 31%,#f1f3f4 55%,#c5cdd1 78%,#f8f9fa 100%)!important;box-shadow:inset 5px 0 7px rgba(255,255,255,.92),inset -7px 0 9px rgba(78,90,99,.28),0 2px 4px rgba(0,0,0,.20)!important}
      #${GRID_ID} .cm-reference-stem:before{content:"";position:absolute!important;left:-5px!important;right:-5px!important;top:-8px!important;height:18px!important;box-sizing:border-box!important;border:2px solid #a6adb2!important;border-radius:50%!important;background:linear-gradient(180deg,#fff 0%,#e5e8ea 48%,#cbd1d4 100%)!important;box-shadow:inset 0 2px 3px rgba(255,255,255,.95),inset 0 -2px 3px rgba(100,110,117,.22),0 1px 3px rgba(0,0,0,.22)!important}
      #${GRID_ID} .cm-reference-stem:after{content:"";position:absolute!important;left:8px!important;top:12px!important;width:5px!important;height:172px!important;border-radius:6px!important;background:linear-gradient(180deg,rgba(255,255,255,.96),rgba(255,255,255,.06))!important}
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
    tower.style.setProperty('--c',c); tower.style.setProperty('--fill',`${58+value*1.22}px`);
    tower.innerHTML=`<span class="cm-reference-value">${value}%</span><div class="cm-reference-stem"></div><div class="cm-reference-sleeve"></div><div class="cm-reference-base"></div>`;
    wrap.appendChild(tower); old.replaceWith(wrap);
  }
  function boot(){installStyles();const grid=document.getElementById(GRID_ID);if(!grid)return;grid.querySelectorAll('.cm-project').forEach(transformProject)}
  boot();document.addEventListener('DOMContentLoaded',boot);const observer=new MutationObserver(()=>boot());observer.observe(document.body,{childList:true,subtree:true});setTimeout(boot,100);setTimeout(boot,500);setTimeout(boot,1200);
})();
