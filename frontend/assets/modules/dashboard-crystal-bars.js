(function(){
  'use strict';
  const STYLE_ID='cm-crystal-bars-v3';
  const GRID_ID='cm-towers-grid-v2';

  function installStyles(){
    if(document.getElementById(STYLE_ID)) return;
    const s=document.createElement('style');
    s.id=STYLE_ID;
    s.textContent=`
#${GRID_ID} .cm-project{min-width:0;position:relative}
#${GRID_ID} .cm-cylinder-wrap{height:255px!important;display:flex!important;align-items:flex-end!important;justify-content:center!important;position:relative}
#${GRID_ID} .cm-crystal-tower{position:relative!important;width:96px!important;height:225px!important;--c:#19d9ff;--fill:100px;filter:drop-shadow(0 0 12px var(--c));overflow:visible!important}
#${GRID_ID} .cm-crystal-body{position:absolute!important;z-index:3!important;left:8px!important;bottom:17px!important;width:80px!important;height:var(--fill)!important;min-height:38px!important;border-radius:8px 8px 22px 22px!important;border:2px solid var(--c)!important;background:linear-gradient(90deg,color-mix(in srgb,var(--c) 70%,#111) 0%,var(--c) 25%,color-mix(in srgb,var(--c) 82%,#fff) 53%,color-mix(in srgb,var(--c) 65%,#111) 100%)!important;box-shadow:inset 7px 0 12px #ffffff22,inset -9px 0 12px #0006,0 0 20px var(--c)!important;overflow:visible!important}
#${GRID_ID} .cm-crystal-body:before{content:"";position:absolute;left:-2px;right:-2px;top:-7px;height:14px;border:2px solid color-mix(in srgb,var(--c) 75%,#fff)!important;border-radius:50%;background:color-mix(in srgb,var(--c) 88%,#fff)!important;box-shadow:0 0 12px var(--c),inset 0 2px 4px #fff9!important}
#${GRID_ID} .cm-crystal-body:after{content:"";position:absolute;left:9px;top:12px;width:6px;height:calc(100% - 24px);border-radius:6px;background:linear-gradient(180deg,#ffffffbb,#ffffff08)!important}
#${GRID_ID} .cm-crystal-stem{position:absolute!important;z-index:4!important;left:25px!important;top:2px!important;width:46px!important;height:125px!important;border:2px solid #d5dde1!important;border-radius:9px 9px 6px 6px!important;background:linear-gradient(90deg,#fff 0%,#eef2f4 28%,#cbd3d8 55%,#fff 100%)!important;box-shadow:inset 6px 0 9px #fff,inset -7px 0 9px #77838a55,0 0 5px #fff!important}
#${GRID_ID} .cm-crystal-stem:before{content:"";position:absolute;left:-4px;right:-4px;top:-7px;height:15px;border:2px solid #bfc8cd;border-radius:50%;background:linear-gradient(#fff,#dce2e5)!important;box-shadow:inset 0 2px 4px #fff,0 0 5px #fff!important}
#${GRID_ID} .cm-crystal-stem:after{content:"";position:absolute;left:7px;top:9px;width:5px;height:105px;border-radius:5px;background:linear-gradient(#fff,#fff0)!important;opacity:.8}
#${GRID_ID} .cm-crystal-base{position:absolute!important;z-index:5!important;left:3px!important;bottom:7px!important;width:90px!important;height:18px!important;border:2px solid #d5dde1!important;border-radius:50%!important;background:linear-gradient(180deg,#fff 0%,#c9d0d4 58%,#f8fafb 100%)!important;box-shadow:0 2px 5px #0009,0 0 6px #fff7!important}
#${GRID_ID} .cm-crystal-base:before{content:"";position:absolute;left:10px;right:10px;top:2px;height:8px;border-radius:50%;background:#f7f9fa;box-shadow:inset 0 2px 3px #a4adb255!important}
#${GRID_ID} .cm-crystal-base:after{content:"";position:absolute;left:15px;right:15px;bottom:-5px;height:5px;border-radius:50%;background:#69757baa;filter:blur(2px)!important}
#${GRID_ID} .cm-crystal-value{position:absolute!important;z-index:8!important;top:-31px!important;left:0!important;right:0!important;color:#eaf8ff!important;font-size:15px!important;font-weight:900!important;text-align:center!important;text-shadow:0 0 12px var(--c)!important}
@media(max-width:1200px){#${GRID_ID} .cm-crystal-tower{transform:scale(.9)!important}}
@media(max-width:760px){#${GRID_ID} .cm-crystal-tower{transform:scale(.82)!important}}
`;
    document.head.appendChild(s);
  }

  function transformGrid(){
    const grid=document.getElementById(GRID_ID);
    if(!grid) return false;
    grid.querySelectorAll('.cm-project').forEach(project=>{
      const old=project.querySelector('.cm-cylinder');
      if(!old || old.classList.contains('cm-crystal-source')) return;
      const valueEl=old.querySelector('.cm-cylinder-value');
      const value=Math.max(0,Math.min(100,parseFloat((valueEl?.textContent||'0').replace('%',''))||0));
      const c=(old.style.getPropertyValue('--c')||'#19d9ff').trim();
      const tower=document.createElement('div');
      tower.className='cm-crystal-tower cm-crystal-source';
      tower.style.setProperty('--c',c);
      tower.style.setProperty('--fill',`${38+(value*1.18)}px`);
      tower.innerHTML='<div class="cm-crystal-stem"></div><div class="cm-crystal-body"></div><div class="cm-crystal-base"></div><span class="cm-crystal-value">'+value+'%</span>';
      old.replaceWith(tower);
    });
    return true;
  }

  function boot(){
    installStyles();
    transformGrid();
  }

  boot();
  document.addEventListener('DOMContentLoaded',boot);
  const observer=new MutationObserver(()=>boot());
  observer.observe(document.body,{childList:true,subtree:true});
  let tries=0;
  const timer=setInterval(()=>{boot();if(++tries>80)clearInterval(timer)},250);
})();
