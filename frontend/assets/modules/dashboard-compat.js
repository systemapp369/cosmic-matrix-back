/* Stable compatibility + editor layout layer. */
(function () {
  'use strict';

  if (typeof HexTower3D !== 'undefined') {
    HexTower3D.prototype.renderHexTowerPanel = function () { this.renderDashboardShell(); };
    HexTower3D.prototype.hexNextPage = function () {};
    HexTower3D.prototype.hexPrevPage = function () {};

    /* FIX: the old 250ms full-dashboard loop repeatedly rebuilt DOM/ECharts. */
    HexTower3D.prototype.waitForLiveData = function () {
      if (this.dashboardDataTimer) clearInterval(this.dashboardDataTimer);
      this.dashboardDataTimer = null;
      let previous = '';
      let attempts = 0;
      const maxAttempts = 20;
      const getSignature = () => {
        try {
          return JSON.stringify(this.getProjects().map(p => [p.id,p.name,p.level,p.progress,p.lead,p.description]));
        } catch (_) { return ''; }
      };
      const hydrate = () => {
        attempts++;
        const signature = getSignature();
        if (signature !== previous) {
          previous = signature;
          this.renderDashboardShell();
        }
        if (this.getProjects().length || attempts >= maxAttempts) {
          clearInterval(this.dashboardDataTimer);
          this.dashboardDataTimer = null;
        }
      };
      hydrate();
      if (!this.getProjects().length) this.dashboardDataTimer = setInterval(hydrate, 500);
    };

    /* Keep the chart cheap during dashboard refreshes. */
    HexTower3D.prototype.renderEvolution = function () {
      const el = document.getElementById('cm-evolution');
      if (!el || typeof echarts === 'undefined') return;
      const ps = this.getProjects();
      const avg = ps.length ? Math.round(ps.reduce((s,p)=>s+Number(p.progress||0),0)/ps.length) : 0;
      let chart = echarts.getInstanceByDom(el);
      if (!chart) chart = echarts.init(el);
      const data = ps.length ? [Math.max(0,avg-18),Math.max(0,avg-15),Math.max(0,avg-12),Math.max(0,avg-9),Math.max(0,avg-6),Math.max(0,avg-3),avg] : [0,0,0,0,0,0,0];
      chart.setOption({
        animation:false,
        grid:{left:35,right:10,top:12,bottom:28},
        xAxis:{type:'category',data:['-30d','-25d','-20d','-15d','-10d','-5d','Hoy'],axisLabel:{color:'#6f91ad',fontSize:9}},
        yAxis:{type:'value',min:0,max:100,axisLabel:{color:'#6f91ad',fontSize:9,formatter:'{value}%'}},
        series:[{type:'line',smooth:.35,symbol:'circle',symbolSize:5,data,lineStyle:{color:'#16d9ff',width:2},itemStyle:{color:'#16d9ff'},areaStyle:{color:'rgba(22,217,255,.10)'}}]
      },{lazyUpdate:true});
      if (!chart.__cmResize) {
        window.addEventListener('resize',()=>{if(!document.hidden&&document.body.contains(el))chart.resize()},{passive:true});
        chart.__cmResize = true;
      }
    };
  }

  const STYLE_ID = 'cm-editor-stable-v4';

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #crudModal .cm-editor-dialog{width:min(1500px,calc(100vw - 24px))!important;max-width:min(1500px,calc(100vw - 24px))!important;margin:12px auto!important}
      #crudModal .cm-editor-hud{border:1px solid rgba(32,231,244,.7)!important;border-radius:0!important;background:linear-gradient(rgba(32,231,244,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(32,231,244,.025) 1px,transparent 1px),linear-gradient(180deg,#071c2a,#020d18)!important;background-size:24px 24px,24px 24px,100% 100%!important;box-shadow:inset 0 0 60px rgba(0,210,240,.06),0 0 30px rgba(0,210,240,.12)!important;overflow:hidden!important}
      #crudModal .cm-editor-hud .modal-header{min-height:100px!important;padding:24px 34px!important;border-bottom:1px solid rgba(32,231,244,.3)!important;background:linear-gradient(90deg,rgba(32,231,244,.08),transparent 55%)!important}
      #crudModal .cm-editor-hud .modal-title{font:700 27px Orbitron,sans-serif!important;letter-spacing:.07em!important;color:#f4fdff!important}
      #crudModal .cm-editor-hud #modalSub{font:13px 'Share Tech Mono',monospace!important;letter-spacing:.24em!important;color:#61c8d6!important}
      #crudModal .cm-editor-hud .modal-body{padding:18px!important}
      #crudModal .cm-editor-tripanel{display:grid!important;grid-template-columns:minmax(250px,.85fr) minmax(480px,1.6fr) minmax(250px,.85fr)!important;gap:12px!important;min-height:620px!important}
      #crudModal .cm-panel{min-width:0;position:relative;border:1px solid rgba(45,208,229,.38);background:linear-gradient(180deg,rgba(7,31,45,.88),rgba(2,15,27,.96));padding:20px;box-shadow:inset 0 0 28px rgba(0,205,235,.035)}
      #crudModal .cm-panel:before{content:'';position:absolute;top:-1px;left:18px;width:92px;height:2px;background:#18e5f3;box-shadow:0 0 12px rgba(24,229,243,.5)}
      #crudModal .cm-panel-title{display:flex;gap:10px;align-items:center;margin:0 0 18px;color:#eefcff;font:700 15px Orbitron,sans-serif;letter-spacing:.11em;text-transform:uppercase}
      #crudModal .cm-panel-title span{color:#3be5f1;font:11px 'Share Tech Mono',monospace;letter-spacing:.16em}
      #crudModal .cm-form-panel #nodeForm{display:grid!important;grid-template-columns:repeat(12,minmax(0,1fr))!important;gap:16px!important;margin:0!important}
      #crudModal .cm-form-panel #nodeForm>div{width:auto!important;padding:0!important;margin:0!important}
      #crudModal .cm-form-panel #nodeForm>div:nth-child(2){grid-column:1/-1}
      #crudModal .cm-form-panel #nodeForm>div:nth-child(3){grid-column:1/7}
      #crudModal .cm-form-panel #nodeForm>div:nth-child(4){grid-column:7/-1}
      #crudModal .cm-form-panel #nodeForm>div:nth-child(5){grid-column:1/-1}
      #crudModal .cm-form-panel #nodeForm>div:nth-child(6){grid-column:1/-1}
      #crudModal .cm-form-panel #nodeForm>div:nth-child(7){grid-column:1/-1;display:flex!important;align-items:center;gap:10px;border-top:1px solid rgba(44,194,215,.25);padding-top:18px!important;margin-top:2px!important}
      #crudModal .cm-form-panel #nodeForm>div:nth-child(7):before{content:'SYSTEM CONTROL';margin-right:auto;color:#3c7f89;font:10px 'Share Tech Mono',monospace;letter-spacing:.2em}
      #crudModal .cm-panel .form-label{display:block!important;color:#61c8d6!important;font:11px 'Share Tech Mono',monospace!important;letter-spacing:.17em!important;text-transform:uppercase!important;margin:0 0 7px!important}
      #crudModal .cm-panel .form-control,#crudModal .cm-panel .form-select{height:48px!important;border-radius:0!important;border:1px solid rgba(44,194,215,.42)!important;background:#031522!important;color:#f0fcff!important;font:15px 'Share Tech Mono',monospace!important;box-shadow:inset 0 0 18px rgba(0,200,230,.045)!important}
      #crudModal .cm-panel .form-control:focus,#crudModal .cm-panel .form-select:focus{border-color:#2be4f2!important;box-shadow:0 0 0 1px rgba(43,228,242,.22),0 0 18px rgba(43,228,242,.1)!important}
      #crudModal .cm-form-panel #nodeDescription{height:72px!important}
      #crudModal .cm-panel .btn{min-height:44px!important;border-radius:0!important;font:12px 'Share Tech Mono',monospace!important;letter-spacing:.1em!important;text-transform:uppercase!important}
      #crudModal .cm-panel #submitBtn{background:#12bfd4!important;border:1px solid #5af3ff!important;color:#00151c!important}
      #crudModal .cm-panel .id-delete-btn{border-color:#ff3e68!important;color:#ff6485!important}
      #crudModal .cm-panel .btn-light{background:#0c2638!important;border-color:#31566b!important;color:#e2f7fb!important}
      #crudModal .cm-advances-panel #updatesSection{display:flex!important;flex-direction:column!important;gap:12px!important;margin:0!important;padding:0!important;border:0!important;min-height:100%!important}
      #crudModal .cm-advances-panel #updatesSection>h6{margin:0!important;color:#eefcff!important;font:700 15px Orbitron,sans-serif!important;letter-spacing:.1em!important}
      #crudModal .cm-advances-panel #updatesSection>h6:before{content:'//';color:#1de4f1;margin-right:8px}
      #crudModal .cm-advances-panel #updateNote{width:100%!important;height:130px!important;resize:vertical;border-radius:0!important;margin:0!important}
      #crudModal .cm-advances-panel #updatesList{display:flex!important;flex-direction:column!important;gap:8px!important;max-height:350px!important;overflow:auto!important;padding-right:3px!important}
      #crudModal .cm-advances-panel #updatesList>*{border-radius:0!important;border:1px solid rgba(38,202,224,.25)!important;background:rgba(2,20,32,.78)!important}
      #crudModal .cm-advances-panel #addUpdateBtn{width:100%!important;background:#0a91a6!important;border:1px solid #36e6f3!important;color:#eaffff!important}
      #crudModal .cm-advances-panel .cm-file-input-wrap{display:none!important}
      #crudModal .cm-files-panel .cm-files-caption{margin:0 0 14px;color:#5ca9b5;font:11px 'Share Tech Mono',monospace;letter-spacing:.12em}
      #crudModal .cm-files-panel #updateFiles{width:100%!important;min-height:46px!important;height:auto!important;margin:0 0 16px!important;border-radius:0!important;border:1px solid rgba(44,194,215,.42)!important;background:#031522!important;color:#d9f9fd!important;font:11px 'Share Tech Mono',monospace!important;padding:8px!important}
      #crudModal .cm-files-list{display:flex;flex-direction:column;gap:7px;max-height:480px;overflow:auto}
      #crudModal .cm-file-item{display:flex;gap:8px;padding:10px;border:1px solid rgba(45,208,229,.22);background:rgba(2,19,31,.7);color:#bdebf0;font:11px 'Share Tech Mono',monospace}
      #crudModal .cm-file-mark{color:#24e3f1}.cm-file-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      @media(max-width:1050px){#crudModal .cm-editor-tripanel{grid-template-columns:1fr 1.4fr!important}#crudModal .cm-files-panel{grid-column:1/-1}}
      @media(max-width:760px){#crudModal .cm-editor-dialog{width:calc(100vw - 12px)!important;max-width:calc(100vw - 12px)!important}#crudModal .cm-editor-tripanel{grid-template-columns:1fr!important}#crudModal .cm-files-panel{grid-column:auto}}
    `;
    document.head.appendChild(style);
  }

  function refreshAttachedFiles() {
    const target=document.getElementById('cmAttachedFiles');
    const list=document.getElementById('updatesList');
    if(!target||!list)return;
    const names=[];
    list.querySelectorAll('a[href],[data-file-name]').forEach(el=>{
      const name=el.getAttribute('data-file-name')||el.textContent.trim();
      if(name&&!names.includes(name))names.push(name);
    });
    target.innerHTML=names.length?names.map(name=>`<div class="cm-file-item"><span class="cm-file-mark">▣</span><span class="cm-file-name" title="${String(name).replace(/"/g,'&quot;')}">${String(name).replace(/</g,'&lt;')}</span></div>`).join(''):'<div class="cm-file-item"><span class="cm-file-mark">▣</span><span class="cm-file-name">Sin archivos registrados</span></div>';
  }

  function rebuildTripanel() {
    const modal=document.getElementById('crudModal');
    const body=modal?.querySelector('.modal-body');
    const form=document.getElementById('nodeForm');
    const updates=document.getElementById('updatesSection');
    if(!modal||!body||!form||!updates||body.dataset.cmTripanel==='1')return;
    installStyle();
    updates.classList.remove('d-none');

    const layout=document.createElement('div');layout.className='cm-editor-tripanel';
    const left=document.createElement('section');left.className='cm-panel cm-advances-panel';
    const center=document.createElement('section');center.className='cm-panel cm-form-panel';
    const right=document.createElement('section');right.className='cm-panel cm-files-panel';
    center.innerHTML='<div class="cm-panel-title">DATOS DEL PROYECTO <span>PROJECT DATA</span></div>';
    right.innerHTML='<div class="cm-panel-title">ARCHIVOS <span>ATTACHED FILES</span></div><div class="cm-files-caption">DOCUMENTOS ASOCIADOS A LA BITÁCORA</div><div id="cmAttachedFiles" class="cm-files-list"><div class="cm-file-item"><span class="cm-file-mark">▣</span><span class="cm-file-name">Sin archivos registrados</span></div></div>';
    body.dataset.cmTripanel='1';
    body.innerHTML='';body.appendChild(layout);layout.append(left,center,right);center.appendChild(form);left.appendChild(updates);

    const note=document.getElementById('updateNote');
    const files=document.getElementById('updateFiles');
    const add=document.getElementById('addUpdateBtn');
    if(files){right.insertBefore(files,right.querySelector('#cmAttachedFiles'));}
    if(add){left.appendChild(add);}
    if(note){left.insertBefore(note,document.getElementById('updatesList'));}

    refreshAttachedFiles();
  }

  function boot(){
    installStyle();
    rebuildTripanel();
    const modal=document.getElementById('crudModal');
    if(!modal||modal.dataset.cmStableBound==='1')return;
    modal.dataset.cmStableBound='1';
    modal.addEventListener('shown.bs.modal',()=>setTimeout(refreshAttachedFiles,120));
    document.getElementById('addUpdateBtn')?.addEventListener('click',()=>setTimeout(refreshAttachedFiles,700));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
