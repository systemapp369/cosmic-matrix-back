(function(){'use strict';
const STYLE_ID='cm-crystal-bars-v1';
function install(){
  if(!document.head.querySelector('#'+STYLE_ID)){
    const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
#cm-towers-grid-v2 .cm-project{min-width:0}
#cm-towers-grid-v2 .cm-cylinder-wrap{height:255px;position:relative;display:flex;align-items:flex-end;justify-content:center}
#cm-towers-grid-v2 .cm-crystal-tower{position:relative;width:92px;height:220px;--c:#19d9ff;--fill:120px;filter:drop-shadow(0 0 12px color-mix(in srgb,var(--c) 55%,transparent));}
#cm-towers-grid-v2 .cm-crystal-stem{position:absolute;z-index:4;left:18px;top:3px;width:56px;height:132px;border-radius:13px 13px 8px 8px;border:2px solid #dce8ef;background:linear-gradient(90deg,#ffffffd8 0%,#f4f7f8 22%,#d9e0e4 53%,#ffffff 100%);box-shadow:inset 7px 0 10px #ffffffaa,inset -7px 0 9px #7b879033,0 0 4px #fff;}
#cm-towers-grid-v2 .cm-crystal-stem:before{content:"";position:absolute;left:-3px;right:-3px;top:-7px;height:15px;border:2px solid #cbd5da;border-radius:50%;background:linear-gradient(#f9fbfc,#d8dfe3);box-shadow:inset 0 3px 4px #fff,0 0 5px #fff;}
#cm-towers-grid-v2 .cm-crystal-stem:after{content:"";position:absolute;left:8px;top:10px;width:7px;height:108px;border-radius:8px;background:linear-gradient(180deg,#ffffffcc,#ffffff12);opacity:.8}
#cm-towers-grid-v2 .cm-crystal-body{position:absolute;z-index:3;left:7px;bottom:18px;width:78px;height:var(--fill);min-height:43px;border-radius:12px 12px 17px 17px;border:1px solid color-mix(in srgb,var(--c) 75%,#fff);background:linear-gradient(90deg,color-mix(in srgb,var(--c) 78%,#111) 0%,var(--c) 23%,color-mix(in srgb,var(--c) 72%,#fff) 52%,color-mix(in srgb,var(--c) 82%,#111) 100%);box-shadow:inset 7px 0 10px #fff2,inset -8px 0 12px #0005,0 0 18px color-mix(in srgb,var(--c) 70%,transparent);transition:height .55s ease;}
#cm-towers-grid-v2 .cm-crystal-body:before{content:"";position:absolute;left:-2px;right:-2px;top:-6px;height:13px;border:1px solid #f2ffffcc;border-radius:50%;background:linear-gradient(180deg,color-mix(in srgb,var(--c) 72%,#fff),var(--c));box-shadow:0 0 10px var(--c),inset 0 2px 3px #fff8;}
#cm-towers-grid-v2 .cm-crystal-body:after{content:"";position:absolute;left:9px;top:10px;width:6px;height:calc(100% - 20px);border-radius:8px;background:linear-gradient(#fff8,#fff0);}
#cm-towers-grid-v2 .cm-crystal-base{position:absolute;z-index:5;left:4px;bottom:8px;width:84px;height:16px;border-radius:50%;border:2px solid #dfe8ec;background:linear-gradient(180deg,#ffffff,#bfc8cd 55%,#f7fafb);box-shadow:0 2px 4px #0008,0 0 5px #fff6;}
#cm-towers-grid-v2 .cm-crystal-base:before{content:"";position:absolute;left:8px;right:8px;top:2px;height:7px;border-radius:50%;background:#f6f8f9;box-shadow:inset 0 2px 3px #9ca7ad55;}
#cm-towers-grid-v2 .cm-crystal-base:after{content:"";position:absolute;left:13px;right:13px;bottom:-4px;height:5px;border-radius:50%;background:#7e8a90aa;filter:blur(2px)}
#cm-towers-grid-v2 .cm-cylinder-value{position:absolute;z-index:8;top:-28px;left:0;right:0;color:#eaf8ff;font-size:15px;font-weight:900;text-align:center;text-shadow:0 0 12px var(--c)}
@media(max-width:1200px){#cm-towers-grid-v2 .cm-crystal-tower{transform:scale(.9)}}
@media(max-width:760px){#cm-towers-grid-v2 .cm-crystal-tower{transform:scale(.82)}}`;
    document.head.appendChild(s);
  }
}
function transform(){
  const grid=document.getElementById('cm-towers-grid-v2');if(!grid)return;
  grid.querySelectorAll('.cm-project').forEach(project=>{
    const old=project.querySelector('.cm-cylinder');if(!old||old.classList.contains('cm-crystal-tower'))return;
    const valueEl=old.querySelector('.cm-cylinder-value');
    const value=Math.max(0,Math.min(100,parseFloat((valueEl?.textContent||'0').replace('%',''))||0));
    const c=(old.style.getPropertyValue('--c')||'#19d9ff').trim();
    const tower=document.createElement('div');tower.className='cm-crystal-tower';tower.style.setProperty('--c',c);tower.style.setProperty('--fill',`${43+(value*1.15)}px`);
    tower.innerHTML=`<div class="cm-crystal-stem"></div><div class="cm-crystal-body"></div><div class="cm-crystal-base"></div><span class="cm-cylinder-value">${value}%</span>`;
    old.replaceWith(tower);
  });
}
function boot(){install();transform();const grid=document.getElementById('cm-towers-grid-v2');if(grid&&!grid.__cmCrystalObserver){const mo=new MutationObserver(()=>{install();transform()});mo.observe(grid,{childList:true,subtree:true});grid.__cmCrystalObserver=mo;} }
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
const timer=setInterval(()=>{if(document.getElementById('cm-towers-grid-v2')){boot();clearInterval(timer)}},250);
})();
