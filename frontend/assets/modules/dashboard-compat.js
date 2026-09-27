/* Cosmic Matrix - stable dashboard compatibility + clean editor layout */
(function () {
  'use strict';

  /* Keep the dashboard compatibility hooks lightweight. */
  if (typeof HexTower3D !== 'undefined') {
    HexTower3D.prototype.renderHexTowerPanel = function () {
      if (typeof this.renderDashboardShell === 'function') this.renderDashboardShell();
    };
    HexTower3D.prototype.hexNextPage = function () {};
    HexTower3D.prototype.hexPrevPage = function () {};

    HexTower3D.prototype.waitForLiveData = function () {
      if (this.dashboardDataTimer) clearInterval(this.dashboardDataTimer);
      this.dashboardDataTimer = null;
      let previous = '';
      let attempts = 0;
      const read = () => {
        attempts++;
        let signature = '';
        try {
          signature = JSON.stringify((this.getProjects?.() || []).map(p => [p.id,p.name,p.level,p.progress,p.lead,p.description]));
        } catch (_) {}
        if (signature !== previous) {
          previous = signature;
          this.renderDashboardShell?.();
        }
        if ((this.getProjects?.() || []).length || attempts >= 20) {
          clearInterval(this.dashboardDataTimer);
          this.dashboardDataTimer = null;
        }
      };
      read();
      if (!(this.getProjects?.() || []).length) this.dashboardDataTimer = setInterval(read, 500);
    };

    HexTower3D.prototype.renderEvolution = function () {
      const el = document.getElementById('cm-evolution');
      if (!el || typeof echarts === 'undefined') return;
      const ps = this.getProjects?.() || [];
      const avg = ps.length ? Math.round(ps.reduce((s,p) => s + Number(p.progress || 0), 0) / ps.length) : 0;
      let chart = echarts.getInstanceByDom(el);
      if (!chart) chart = echarts.init(el);
      chart.setOption({
        animation: false,
        grid: { left: 35, right: 10, top: 12, bottom: 28 },
        xAxis: { type:'category', data:['-30d','-25d','-20d','-15d','-10d','-5d','Hoy'], axisLabel:{color:'#6f91ad',fontSize:9} },
        yAxis: { type:'value', min:0, max:100, axisLabel:{color:'#6f91ad',fontSize:9,formatter:'{value}%'} },
        series: [{ type:'line', smooth:.35, symbol:'circle', symbolSize:5,
          data: ps.length ? [avg-18,avg-15,avg-12,avg-9,avg-6,avg-3,avg].map(v=>Math.max(0,v)) : [0,0,0,0,0,0,0],
          lineStyle:{color:'#16d9ff',width:2}, itemStyle:{color:'#16d9ff'}, areaStyle:{color:'rgba(22,217,255,.10)'}
        }]
      }, { lazyUpdate:true });
      if (!chart.__cmResize) {
        const resize = () => { if (!document.hidden && document.body.contains(el)) chart.resize(); };
        window.addEventListener('resize', resize, {passive:true});
        chart.__cmResize = resize;
      }
    };
  }

  const STYLE_ID = 'cm-editor-clean-v6';

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      /* ===== MODAL / HUD ===== */
      #crudModal .cm-editor-dialog{width:min(1440px,calc(100vw - 48px))!important;max-width:min(1440px,calc(100vw - 48px))!important;margin:24px auto!important}
      #crudModal .cm-editor-hud{color:#eafcff!important;border:1px solid rgba(32,210,232,.55)!important;border-radius:12px!important;overflow:hidden!important;background:linear-gradient(rgba(24,208,230,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(24,208,230,.025) 1px,transparent 1px),#041522!important;background-size:32px 32px,32px 32px,100% 100%!important;box-shadow:0 20px 70px rgba(0,0,0,.42),inset 0 0 70px rgba(0,200,230,.05)!important}
      #crudModal .cm-editor-hud .modal-header{min-height:96px!important;padding:24px 36px!important;border-bottom:1px solid rgba(40,200,220,.25)!important;background:linear-gradient(90deg,rgba(21,215,235,.08),transparent 65%)!important}
      #crudModal .cm-editor-hud .modal-title{margin:0!important;font:700 28px/1.15 Arial,sans-serif!important;letter-spacing:.02em!important;color:#f4fbff!important}
      #crudModal .cm-editor-hud #modalSub{margin-top:7px!important;color:#58c6d5!important;font:14px/1.2 Arial,sans-serif!important;letter-spacing:.14em!important;text-transform:uppercase!important}
      #crudModal .cm-editor-hud .modal-body{padding:24px!important}
      #crudModal .cm-editor-tripanel{display:grid!important;grid-template-columns:minmax(310px,.9fr) minmax(580px,1.7fr) minmax(300px,.9fr)!important;gap:20px!important;align-items:stretch!important;min-height:620px!important}
      #crudModal .cm-panel{min-width:0!important;position:relative!important;border:1px solid rgba(48,194,216,.34)!important;border-radius:10px!important;background:linear-gradient(180deg,#071f2e,#03131f)!important;padding:24px!important;box-shadow:inset 0 0 34px rgba(0,205,235,.035)!important}
      #crudModal .cm-panel:before{content:'';position:absolute;top:-1px;left:24px;width:110px;height:3px;background:#17dce9;box-shadow:0 0 14px rgba(23,220,233,.5)}
      #crudModal .cm-panel-title{display:flex!important;align-items:baseline!important;gap:10px!important;margin:0 0 26px!important;color:#f0fbff!important;font:700 18px/1.2 Arial,sans-serif!important;letter-spacing:.02em!important;text-transform:uppercase!important}
      #crudModal .cm-panel-title span{color:#38d9e7!important;font:11px/1 Arial,sans-serif!important;letter-spacing:.16em!important}

      /* ===== FORM ===== */
      #crudModal .cm-form-panel #nodeForm{display:grid!important;grid-template-columns:minmax(0,1.45fr) minmax(220px,.55fr)!important;gap:22px 20px!important;width:100%!important;margin:0!important;padding:0!important;align-items:start!important}
      #crudModal .cm-form-panel #nodeForm>.cm-field{display:block!important;min-width:0!important;width:auto!important;margin:0!important;padding:0!important;float:none!important}
      #crudModal .cm-form-panel #nodeForm>.cm-field-name,#crudModal .cm-form-panel #nodeForm>.cm-field-lead,#crudModal .cm-form-panel #nodeForm>.cm-field-description,#crudModal .cm-form-panel #nodeForm>.cm-form-actions{grid-column:1/-1!important}
      #crudModal .cm-form-panel #nodeForm>.cm-hidden{display:none!important}
      #crudModal .cm-form-panel .form-label{display:block!important;margin:0 0 9px!important;color:#6bc5d0!important;font:600 12px/1.25 Arial,sans-serif!important;letter-spacing:.08em!important;text-transform:uppercase!important}
      #crudModal .cm-form-panel .form-control,#crudModal .cm-form-panel .form-select{display:block!important;width:100%!important;box-sizing:border-box!important;height:54px!important;min-width:0!important;padding:0 16px!important;border:1px solid rgba(58,190,210,.42)!important;border-radius:6px!important;background:#061a28!important;color:#f2fbff!important;font:16px/1.2 Arial,sans-serif!important;letter-spacing:0!important;outline:none!important;box-shadow:inset 0 0 20px rgba(0,190,220,.025)!important}
      #crudModal .cm-form-panel .form-control:focus,#crudModal .cm-form-panel .form-select:focus{border-color:#26e1ef!important;box-shadow:0 0 0 2px rgba(38,225,239,.12)!important}
      #crudModal .cm-form-panel #nodeProgress{text-align:left!important;font-size:17px!important;font-weight:700!important}
      #crudModal .cm-form-panel #nodeDescription{height:92px!important;min-height:92px!important;padding:15px 16px!important;resize:vertical!important}
      #crudModal .cm-form-panel .cm-form-actions{display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:12px!important;margin-top:4px!important;padding-top:22px!important;border-top:1px solid rgba(42,190,215,.22)!important}
      #crudModal .cm-form-panel .cm-form-actions:before{content:'SYSTEM CONTROL'!important;margin-right:auto!important;color:#4f8792!important;font:11px/1 Arial,sans-serif!important;letter-spacing:.15em!important}
      #crudModal .cm-panel .btn{min-height:48px!important;padding:12px 20px!important;border-radius:6px!important;font:600 13px/1 Arial,sans-serif!important;letter-spacing:.04em!important;text-transform:uppercase!important}
      #crudModal .cm-panel #submitBtn{background:#12bfd4!important;border:1px solid #5af3ff!important;color:#00151c!important}
      #crudModal .cm-panel .id-delete-btn{background:transparent!important;border:1px solid #ff3e68!important;color:#ff6485!important}
      #crudModal .cm-panel .btn-light{background:#102b3c!important;border:1px solid #31586c!important;color:#e7f8fc!important}

      /* ===== BITÁCORA ===== */
      #crudModal .cm-advances-panel #updatesSection{display:flex!important;flex-direction:column!important;gap:14px!important;min-height:100%!important;margin:0!important;padding:0!important;border:0!important}
      #crudModal .cm-advances-panel #updatesSection>h6{margin:0!important;color:#effcff!important;font:700 18px/1.2 Arial,sans-serif!important;letter-spacing:.02em!important;text-transform:uppercase!important}
      #crudModal .cm-advances-panel #updatesSection>h6:before{content:'// '!important;color:#18ddea!important}
      #crudModal .cm-advances-panel #updateNote{width:100%!important;height:130px!important;min-height:130px!important;box-sizing:border-box!important;resize:vertical!important;margin:0!important;padding:14px!important;border:1px solid rgba(58,190,210,.40)!important;border-radius:6px!important;background:#061a28!important;color:#effcff!important;font:15px/1.45 Arial,sans-serif!important}
      #crudModal .cm-advances-panel #addUpdateBtn{width:100%!important;min-height:48px!important;background:#10b9ce!important;border:1px solid #46eaf3!important;color:#00151c!important;border-radius:6px!important;font:700 13px/1 Arial,sans-serif!important;letter-spacing:.03em!important}
      #crudModal .cm-advances-panel #updatesList{display:flex!important;flex-direction:column!important;gap:10px!important;max-height:360px!important;overflow:auto!important;margin:2px 0 0!important;padding-right:4px!important}
      #crudModal .cm-advances-panel #updatesList>*{border:1px solid rgba(48,190,215,.24)!important;border-radius:7px!important;background:#061b2a!important}
      #crudModal .cm-advances-panel .cm-file-input-wrap{display:none!important}

      /* ===== FILES ===== */
      #crudModal .cm-files-panel .cm-files-caption{margin:0 0 14px!important;color:#70adb8!important;font:11px/1.4 Arial,sans-serif!important;letter-spacing:.08em!important;text-transform:uppercase!important}
      #crudModal .cm-files-panel #updateFiles{display:block!important;width:100%!important;box-sizing:border-box!important;min-height:50px!important;height:auto!important;margin:0 0 18px!important;padding:8px!important;border:1px solid rgba(58,190,210,.40)!important;border-radius:6px!important;background:#061a28!important;color:#dffaff!important;font:13px Arial,sans-serif!important}
      #crudModal .cm-files-list{display:flex!important;flex-direction:column!important;gap:9px!important;max-height:480px!important;overflow:auto!important}
      #crudModal .cm-file-item{display:flex!important;align-items:center!important;gap:10px!important;min-width:0!important;padding:12px!important;border:1px solid rgba(48,190,215,.22)!important;border-radius:6px!important;background:#061b2a!important;color:#c8eef3!important;font:13px/1.3 Arial,sans-serif!important}
      #crudModal .cm-file-mark{flex:0 0 auto;color:#22dfea!important}.cm-file-name{min-width:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}

      /* ===== RESPONSIVE ===== */
      @media(max-width:1200px){#crudModal .cm-editor-dialog{width:calc(100vw - 28px)!important;max-width:calc(100vw - 28px)!important}#crudModal .cm-editor-tripanel{grid-template-columns:minmax(270px,.8fr) minmax(500px,1.6fr)!important}#crudModal .cm-files-panel{grid-column:1/-1;min-height:260px!important}}
      @media(max-width:820px){#crudModal .cm-editor-dialog{width:calc(100vw - 14px)!important;max-width:calc(100vw - 14px)!important;margin:7px auto!important}#crudModal .cm-editor-hud .modal-header{padding:20px!important}#crudModal .cm-editor-hud .modal-body{padding:14px!important}#crudModal .cm-editor-tripanel{grid-template-columns:1fr!important;gap:14px!important}.cm-form-panel #nodeForm{grid-template-columns:1fr!important}.cm-form-panel #nodeForm>.cm-field{grid-column:1/-1!important}#crudModal .cm-files-panel{grid-column:auto}}
    `;
    document.head.appendChild(style);
  }

  function control(id) { return document.getElementById(id); }

  function labelFor(id) {
    const c = control(id);
    if (!c) return null;
    return document.querySelector('label[for="' + id + '"]') || c.parentElement?.querySelector('label');
  }

  function field(id, className) {
    const c = control(id);
    if (!c) return null;
    const box = document.createElement('div');
    box.className = 'cm-field ' + (className || '');
    const label = labelFor(id);
    if (label) box.appendChild(label);
    box.appendChild(c);
    return box;
  }

  function normalizeForm(form) {
    if (!form || form.dataset.cmNormalized === '1') return;
    const ids = ['nodeName','nodeLevel','nodeProgress','nodeLead','nodeDescription'];
    if (!ids.every(id => control(id))) return;

    const fields = [
      field('nodeName','cm-field-name'),
      field('nodeLevel','cm-field-level'),
      field('nodeProgress','cm-field-progress'),
      field('nodeLead','cm-field-lead'),
      field('nodeDescription','cm-field-description')
    ].filter(Boolean);

    const index = control('nodeIndex');
    const deleteBtn = control('deleteBtn') || form.querySelector('.id-delete-btn');
    const submitBtn = control('submitBtn');
    const cancelBtn = control('cancelBtn') || Array.from(form.querySelectorAll('button')).find(b => /cancelar/i.test(b.textContent || ''));

    const actions = document.createElement('div');
    actions.className = 'cm-form-actions';
    if (deleteBtn) actions.appendChild(deleteBtn);
    if (cancelBtn) actions.appendChild(cancelBtn);
    if (submitBtn) actions.appendChild(submitBtn);

    form.innerHTML = '';
    if (index) { index.classList.add('cm-hidden'); form.appendChild(index); }
    fields.forEach(x => form.appendChild(x));
    form.appendChild(actions);
    form.dataset.cmNormalized = '1';
  }

  function refreshAttachedFiles() {
    const target = document.getElementById('cmAttachedFiles');
    const list = document.getElementById('updatesList');
    if (!target || !list) return;
    const names = [];
    list.querySelectorAll('a[href],[data-file-name]').forEach(el => {
      const name = el.getAttribute('data-file-name') || el.textContent.trim();
      if (name && !names.includes(name)) names.push(name);
    });
    target.innerHTML = names.length
      ? names.map(name => '<div class="cm-file-item"><span class="cm-file-mark">▣</span><span class="cm-file-name" title="' + String(name).replace(/"/g,'&quot;') + '">' + String(name).replace(/</g,'&lt;') + '</span></div>').join('')
      : '<div class="cm-file-item"><span class="cm-file-mark">▣</span><span class="cm-file-name">Sin archivos registrados</span></div>';
  }

  function buildTripanel() {
    const modal = document.getElementById('crudModal');
    const body = modal?.querySelector('.modal-body');
    const form = document.getElementById('nodeForm');
    const updates = document.getElementById('updatesSection');
    if (!modal || !body || !form || !updates) return false;

    installStyle();
    normalizeForm(form);
    if (body.dataset.cmTripanel === '1') {
      refreshAttachedFiles();
      return true;
    }

    updates.classList.remove('d-none');
    const layout = document.createElement('div');
    layout.className = 'cm-editor-tripanel';
    const left = document.createElement('section'); left.className = 'cm-panel cm-advances-panel';
    const center = document.createElement('section'); center.className = 'cm-panel cm-form-panel';
    const right = document.createElement('section'); right.className = 'cm-panel cm-files-panel';

    center.innerHTML = '<div class="cm-panel-title">Datos del proyecto <span>PROJECT DATA</span></div>';
    right.innerHTML = '<div class="cm-panel-title">Archivos <span>ATTACHED FILES</span></div><div class="cm-files-caption">Documentos asociados a la bitácora</div><div id="cmAttachedFiles" class="cm-files-list"><div class="cm-file-item"><span class="cm-file-mark">▣</span><span class="cm-file-name">Sin archivos registrados</span></div></div>';

    body.innerHTML = '';
    body.appendChild(layout);
    layout.append(left, center, right);
    center.appendChild(form);
    left.appendChild(updates);

    const files = control('updateFiles');
    if (files) right.insertBefore(files, right.querySelector('#cmAttachedFiles'));

    refreshAttachedFiles();
    body.dataset.cmTripanel = '1';
    return true;
  }

  function bindModal() {
    installStyle();
    const modal = document.getElementById('crudModal');
    if (!modal || modal.dataset.cmCleanBound === '1') return;
    modal.dataset.cmCleanBound = '1';
    modal.addEventListener('shown.bs.modal', () => setTimeout(() => { buildTripanel(); refreshAttachedFiles(); }, 0));
    modal.addEventListener('hidden.bs.modal', () => {
      const body = modal.querySelector('.modal-body');
      if (body) body.dataset.cmTripanel = '0';
      const form = document.getElementById('nodeForm');
      if (form) form.dataset.cmNormalized = '0';
    });
    document.addEventListener('click', e => {
      if (e.target.closest('#addUpdateBtn')) setTimeout(refreshAttachedFiles, 500);
    });
  }

  function boot() {
    installStyle();
    bindModal();
    setTimeout(buildTripanel, 0);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();
