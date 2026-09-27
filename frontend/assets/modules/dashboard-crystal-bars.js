(function(){
  'use strict';

  const STYLE_ID='cm-crystal-bars-v4';
  const GRID_ID='cm-towers-grid-v2';

  function installStyles(){
    if(document.getElementById(STYLE_ID)) return;
    const s=document.createElement('style');
    s.id=STYLE_ID;
    s.textContent=`
#${GRID_ID} .cm-project{min-width:0;position:relative}
#${GRID_ID} .cm-cylinder-wrap{height:285px!important;display:flex!important;align-items:flex-end!important;justify-content:center!important;position:relative}

/* Barra 3D: camisa de color + tubo blanco interior + base metálica, siguiendo la referencia adjunta. */
#${GRID_ID} .cm-crystal-tower{
  position:relative!important;
  width:112px!important;
  height:270px!important;
  --c:#19d9ff;
  --fill:145px;
  overflow:visible!important;
  filter:drop-shadow(0 8px 8px rgba(0,0,0,.34));
}

#${GRID_ID} .cm-crystal-sleeve{
  position:absolute!important;
  z-index:2!important;
  left:6px!important;
  bottom:22px!important;
  width:100px!important;
  height:var(--fill)!important;
  min-height:82px!important;
  border-radius:20px 20px 14px 14px!important;
  border:2px solid color-mix(in srgb,var(--c) 88%,#ffffff 12%)!important;
  background:
    linear-gradient(90deg,
      color-mix(in srgb,var(--c) 66%,#101820) 0%,
      color-mix(in srgb,var(--c) 90%,#ffffff) 18%,
      var(--c) 43%,
      color-mix(in srgb,var(--c) 78%,#ffffff) 62%,
      color-mix(in srgb,var(--c) 58%,#101820) 100%)!important;
  box-shadow:
    inset 8px 0 10px rgba(255,255,255,.28),
    inset -10px 0 12px rgba(0,0,0,.24),
    0 5px 12px rgba(0,0,0,.25)!important;
}
#${GRID_ID} .cm-crystal-sleeve:before{
  content:"";
  position:absolute;
  left:-2px!important;
  right:-2px!important;
  top:-8px!important;
  height:18px!important;
  border:2px solid color-mix(in srgb,var(--c) 75%,#ffffff 25%)!important;
  border-radius:50%!important;
  background:linear-gradient(180deg,
    color-mix(in srgb,var(--c) 72%,#ffffff 28%),
    color-mix(in srgb,var(--c) 88%,#ffffff 12%))!important;
  box-shadow:inset 0 2px 3px rgba(255,255,255,.65),0 2px 5px rgba(0,0,0,.16)!important;
}
#${GRID_ID} .cm-crystal-sleeve:after{
  content:"";
  position:absolute;
  left:11px!important;
  top:14px!important;
  width:7px!important;
  height:calc(100% - 28px)!important;
  border-radius:8px!important;
  background:linear-gradient(180deg,rgba(255,255,255,.62),rgba(255,255,255,.06))!important;
}

#${GRID_ID} .cm-crystal-stem{
  position:absolute!important;
  z-index:3!important;
  left:25px!important;
  top:0!important;
  width:62px!important;
  height:198px!important;
  border:2px solid #c5ccd0!important;
  border-radius:9px 9px 6px 6px!important;
  background:linear-gradient(90deg,#d8dde0 0%,#ffffff 18%,#f3f5f6 48%,#cbd2d6 72%,#ffffff 100%)!important;
  box-shadow:
    inset 7px 0 10px rgba(255,255,255,.9),
    inset -8px 0 10px rgba(91,103,110,.28),
    0 2px 5px rgba(0,0,0,.18)!important;
}
#${GRID_ID} .cm-crystal-stem:before{
  content:"";
  position:absolute;
  left:-5px!important;
  right:-5px!important;
  top:-8px!important;
  height:18px!important;
  border:2px solid #b9c1c6!important;
  border-radius:50%!important;
  background:linear-gradient(180deg,#ffffff 0%,#e0e5e8 100%)!important;
  box-shadow:inset 0 2px 4px rgba(255,255,255,.95),0 1px 3px rgba(0,0,0,.2)!important;
}
#${GRID_ID} .cm-crystal-stem:after{
  content:"";
  position:absolute;
  left:8px!important;
  top:10px!important;
  width:6px!important;
  height:172px!important;
  border-radius:8px!important;
  background:linear-gradient(180deg,rgba(255,255,255,.92),rgba(255,255,255,.04))!important;
  opacity:.85!important;
}

#${GRID_ID} .cm-crystal-base{
  position:absolute!important;
  z-index:5!important;
  left:1px!important;
  bottom:5px!important;
  width:110px!important;
  height:24px!important;
  border:2px solid #b8c0c4!important;
  border-radius:50%!important;
  background:linear-gradient(180deg,#ffffff 0%,#d1d6d9 55%,#f8fafb 100%)!important;
  box-shadow:0 3px 6px rgba(0,0,0,.48),0 0 5px rgba(255,255,255,.65)!important;
}
#${GRID_ID} .cm-crystal-base:before{
  content:"";
  position:absolute;
  left:13px!important;
  right:13px!important;
  top:3px!important;
  height:10px!important;
  border-radius:50%!important;
  background:#f5f7f8!important;
  box-shadow:inset 0 2px 3px rgba(128,139,146,.28)!important;
}
#${GRID_ID} .cm-crystal-base:after{
  content:"";
  position:absolute;
  left:18px!important;
  right:18px!important;
  bottom:-7px!important;
  height:7px!important;
  border-radius:50%!important;
  background:rgba(61,72,80,.42)!important;
  filter:blur(3px)!important;
}

#${GRID_ID} .cm-crystal-value{
  position:absolute!important;
  z-index:8!important;
  top:-31px!important;
  left:0!important;
  right:0!important;
  color:#eaf8ff!important;
  font-size:15px!important;
  font-weight:900!important;
  text-align:center!important;
  text-shadow:0 0 12px var(--c)!important;
}

@media(max-width:1200px){#${GRID_ID} .cm-crystal-tower{transform:scale(.9)!important}}
@media(max-width:760px){#${GRID_ID} .cm-crystal-tower{transform:scale(.78)!important}}
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
      // La referencia usa una camisa inferior que crece con el porcentaje.
      tower.style.setProperty('--fill',`${88+(value*1.02)}px`);
      tower.innerHTML=
        '<div class="cm-crystal-stem"></div>'+ 
        '<div class="cm-crystal-sleeve"></div>'+ 
        '<div class="cm-crystal-base"></div>'+ 
        '<span class="cm-crystal-value">'+value+'%</span>';
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
