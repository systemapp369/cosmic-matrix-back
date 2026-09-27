/* Stable compatibility + editor layout layer. */
(function () {
  'use strict';

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
      const maxAttempts = 20;
      const getSignature = () => {
        try {
          return JSON.stringify(this.getProjects().map(p => [p.id, p.name, p.level, p.progress, p.lead, p.description]));
        } catch (_) { return ''; }
      };
      const hydrate = () => {
        attempts++;
        const signature = getSignature();
        if (signature !== previous) {
          previous = signature;
          if (typeof this.renderDashboardShell === 'function') this.renderDashboardShell();
        }
        if (this.getProjects().length || attempts >= maxAttempts) {
          clearInterval(this.dashboardDataTimer);
          this.dashboardDataTimer = null;
        }
      };
      hydrate();
      if (!this.getProjects().length) this.dashboardDataTimer = setInterval(hydrate, 500);
    };

    HexTower3D.prototype.renderEvolution = function () {
      const el = document.getElementById('cm-evolution');
      if (!el || typeof echarts === 'undefined') return;
      const ps = this.getProjects();
      const avg = ps.length ? Math.round(ps.reduce((s, p) => s + Number(p.progress || 0), 0) / ps.length) : 0;
      let chart = echarts.getInstanceByDom(el);
      if (!chart) chart = echarts.init(el);
      const data = ps.length
        ? [Math.max(0, avg - 18), Math.max(0, avg - 15), Math.max(0, avg - 12), Math.max(0, avg - 9), Math.max(0, avg - 6), Math.max(0, avg - 3), avg]
        : [0, 0, 0, 0, 0, 0, 0];
      chart.setOption({
        animation: false,
        grid: { left: 35, right: 10, top: 12, bottom: 28 },
        xAxis: { type: 'category', data: ['-30d', '-25d', '-20d', '-15d', '-10d', '-5d', 'Hoy'], axisLabel: { color: '#6f91ad', fontSize: 9 } },
        yAxis: { type: 'value', min: 0, max: 100, axisLabel: { color: '#6f91ad', fontSize: 9, formatter: '{value}%' } },
        series: [{ type: 'line', smooth: .35, symbol: 'circle', symbolSize: 5, data, lineStyle: { color: '#16d9ff', width: 2 }, itemStyle: { color: '#16d9ff' }, areaStyle: { color: 'rgba(22,217,255,.10)' } }]
      }, { lazyUpdate: true });
      if (!chart.__cmResize) {
        window.addEventListener('resize', () => {
          if (!document.hidden && document.body.contains(el)) chart.resize();
        }, { passive: true });
        chart.__cmResize = true;
      }
    };
  }

  const STYLE_ID = 'cm-editor-stable-v5';

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      /* ---------- EDITOR SHELL ---------- */
      #crudModal .cm-editor-dialog {
        width: min(1500px, calc(100vw - 40px)) !important;
        max-width: min(1500px, calc(100vw - 40px)) !important;
        margin: 20px auto !important;
      }
      #crudModal .cm-editor-hud {
        color: #eafcff !important;
        border: 1px solid rgba(34, 213, 235, .52) !important;
        border-radius: 14px !important;
        overflow: hidden !important;
        background:
          linear-gradient(rgba(32,231,244,.025) 1px, transparent 1px),
          linear-gradient(90deg, rgba(32,231,244,.025) 1px, transparent 1px),
          linear-gradient(180deg, #071c2a 0%, #03111d 100%) !important;
        background-size: 28px 28px, 28px 28px, 100% 100% !important;
        box-shadow: inset 0 0 70px rgba(0,210,240,.06), 0 18px 50px rgba(0,0,0,.35) !important;
      }
      #crudModal .cm-editor-hud .modal-header {
        min-height: 92px !important;
        padding: 22px 30px !important;
        border-bottom: 1px solid rgba(42, 205, 225, .22) !important;
        background: linear-gradient(90deg, rgba(20,229,244,.08), transparent 60%) !important;
      }
      #crudModal .cm-editor-hud .modal-title {
        margin: 0 !important;
        font: 700 26px/1.15 Orbitron, sans-serif !important;
        letter-spacing: .055em !important;
        color: #f5fdff !important;
      }
      #crudModal .cm-editor-hud #modalSub {
        margin-top: 7px !important;
        color: #62c6d3 !important;
        font: 13px/1.2 Arial, sans-serif !important;
        letter-spacing: .18em !important;
        text-transform: uppercase !important;
      }
      #crudModal .cm-editor-hud .modal-body {
        padding: 22px !important;
      }

      /* ---------- THREE CLEAN PANELS ---------- */
      #crudModal .cm-editor-tripanel {
        display: grid !important;
        grid-template-columns: minmax(285px, .9fr) minmax(520px, 1.65fr) minmax(285px, .9fr) !important;
        gap: 18px !important;
        align-items: stretch !important;
        min-height: 640px !important;
      }
      #crudModal .cm-panel {
        min-width: 0 !important;
        position: relative !important;
        border: 1px solid rgba(45,208,229,.30) !important;
        border-radius: 10px !important;
        background: linear-gradient(180deg, rgba(7,31,45,.86), rgba(2,15,27,.96)) !important;
        padding: 22px !important;
        box-shadow: inset 0 0 35px rgba(0,205,235,.035) !important;
      }
      #crudModal .cm-panel:before {
        content: '';
        position: absolute;
        top: -1px;
        left: 22px;
        width: 105px;
        height: 3px;
        background: #18e5f3;
        box-shadow: 0 0 12px rgba(24,229,243,.5);
      }
      #crudModal .cm-panel-title {
        display: flex !important;
        align-items: baseline !important;
        gap: 10px !important;
        margin: 0 0 22px !important;
        color: #eefcff !important;
        font: 700 17px/1.2 Orbitron, sans-serif !important;
        letter-spacing: .075em !important;
        text-transform: uppercase !important;
      }
      #crudModal .cm-panel-title span {
        color: #35dbe8 !important;
        font: 11px/1 Arial, sans-serif !important;
        letter-spacing: .16em !important;
      }

      /* ---------- FORM: NO NTH-CHILD / NO COLLISIONS ---------- */
      #crudModal .cm-form-panel #nodeForm {
        display: grid !important;
        grid-template-columns: 1fr 1fr !important;
        gap: 20px !important;
        margin: 0 !important;
        width: 100% !important;
        min-width: 0 !important;
      }
      #crudModal .cm-form-panel #nodeForm > div {
        display: block !important;
        width: auto !important;
        min-width: 0 !important;
        padding: 0 !important;
        margin: 0 !important;
        float: none !important;
      }
      #crudModal .cm-form-panel #nodeForm > input[type="hidden"] { display: none !important; }
      #crudModal .cm-form-panel .cm-field-name,
      #crudModal .cm-form-panel .cm-field-lead,
      #crudModal .cm-form-panel .cm-field-description,
      #crudModal .cm-form-panel .cm-form-actions { grid-column: 1 / -1 !important; }
      #crudModal .cm-panel .form-label {
        display: block !important;
        margin: 0 0 8px !important;
        color: #68bdca !important;
        font: 600 12px/1.25 Arial, sans-serif !important;
        letter-spacing: .11em !important;
        text-transform: uppercase !important;
      }
      #crudModal .cm-panel .form-control,
      #crudModal .cm-panel .form-select {
        display: block !important;
        width: 100% !important;
        min-width: 0 !important;
        height: 52px !important;
        border-radius: 6px !important;
        border: 1px solid rgba(55,190,210,.40) !important;
        background: #041723 !important;
        color: #f2fbfd !important;
        padding: 0 15px !important;
        font: 16px/1.2 Arial, sans-serif !important;
        letter-spacing: .01em !important;
        box-shadow: inset 0 0 18px rgba(0,200,230,.035) !important;
      }
      #crudModal .cm-panel .form-select { cursor: pointer !important; }
      #crudModal .cm-panel .form-control:focus,
      #crudModal .cm-panel .form-select:focus {
        border-color: #29e2f1 !important;
        box-shadow: 0 0 0 2px rgba(43,228,242,.12), 0 0 18px rgba(43,228,242,.08) !important;
        outline: none !important;
      }
      #crudModal .cm-form-panel #nodeProgress { font-size: 18px !important; font-weight: 600 !important; }
      #crudModal .cm-form-panel #nodeDescription { height: 82px !important; padding-top: 15px !important; }
      #crudModal .cm-form-panel .cm-form-actions {
        display: flex !important;
        align-items: center !important;
        gap: 12px !important;
        border-top: 1px solid rgba(44,194,215,.24) !important;
        padding-top: 20px !important;
        margin-top: 2px !important;
      }
      #crudModal .cm-form-panel .cm-form-actions:before {
        content: 'SYSTEM CONTROL' !important;
        margin-right: auto !important;
        color: #477f89 !important;
        font: 11px/1 Arial, sans-serif !important;
        letter-spacing: .16em !important;
      }
      #crudModal .cm-panel .btn {
        min-height: 46px !important;
        border-radius: 6px !important;
        padding: 10px 18px !important;
        font: 600 12px/1 Arial, sans-serif !important;
        letter-spacing: .08em !important;
        text-transform: uppercase !important;
      }
      #crudModal .cm-panel #submitBtn {
        background: #10bfd4 !important;
        border: 1px solid #5af3ff !important;
        color: #00151c !important;
      }
      #crudModal .cm-panel .id-delete-btn {
        border-color: #ff3e68 !important;
        color: #ff6b88 !important;
        background: transparent !important;
      }
      #crudModal .cm-panel .btn-light {
        background: #102c3e !important;
        border-color: #355d72 !important;
        color: #e2f7fb !important;
      }

      /* ---------- LEFT: ADVANCES ---------- */
      #crudModal .cm-advances-panel #updatesSection {
        display: flex !important;
        flex-direction: column !important;
        gap: 14px !important;
        min-height: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        border: 0 !important;
      }
      #crudModal .cm-advances-panel #updatesSection > h6 {
        margin: 0 0 2px !important;
        color: #eefcff !important;
        font: 700 17px/1.2 Orbitron, sans-serif !important;
        letter-spacing: .07em !important;
        text-transform: uppercase !important;
      }
      #crudModal .cm-advances-panel #updatesSection > h6:before {
        content: '// ' !important;
        color: #1de4f1 !important;
      }
      #crudModal .cm-advances-panel #updateNote {
        width: 100% !important;
        height: 145px !important;
        min-height: 145px !important;
        resize: vertical !important;
        margin: 0 !important;
        border-radius: 6px !important;
        padding: 14px !important;
        font: 15px/1.45 Arial, sans-serif !important;
      }
      #crudModal .cm-advances-panel #addUpdateBtn {
        width: 100% !important;
        background: #0bb9ce !important;
        border: 1px solid #42eaf4 !important;
        color: #00151c !important;
      }
      #crudModal .cm-advances-panel #updatesList {
        display: grid !important;
        grid-template-columns: 1fr !important;
        gap: 10px !important;
        max-height: 360px !important;
        overflow-y: auto !important;
        padding-right: 4px !important;
        margin-top: 4px !important;
      }
      #crudModal .cm-advances-panel #updatesList > * {
        border-radius: 7px !important;
        border: 1px solid rgba(38,202,224,.22) !important;
        background: rgba(2,20,32,.78) !important;
      }
      #crudModal .cm-advances-panel .cm-file-input-wrap { display: none !important; }

      /* ---------- RIGHT: FILES ---------- */
      #crudModal .cm-files-panel .cm-files-caption {
        margin: 0 0 14px !important;
        color: #69aeb9 !important;
        font: 11px/1.35 Arial, sans-serif !important;
        letter-spacing: .08em !important;
        text-transform: uppercase !important;
      }
      #crudModal .cm-files-panel #updateFiles {
        width: 100% !important;
        height: auto !important;
        min-height: 48px !important;
        margin: 0 0 18px !important;
        border-radius: 6px !important;
        border: 1px solid rgba(44,194,215,.40) !important;
        background: #041723 !important;
        color: #d9f9fd !important;
        padding: 8px !important;
        font: 13px/1.2 Arial, sans-serif !important;
      }
      #crudModal .cm-files-list {
        display: flex !important;
        flex-direction: column !important;
        gap: 8px !important;
        max-height: 480px !important;
        overflow: auto !important;
      }
      #crudModal .cm-file-item {
        display: flex !important;
        align-items: center !important;
        gap: 9px !important;
        min-width: 0 !important;
        padding: 12px !important;
        border: 1px solid rgba(45,208,229,.22) !important;
        border-radius: 6px !important;
        background: rgba(2,19,31,.72) !important;
        color: #c8edf1 !important;
        font: 13px/1.35 Arial, sans-serif !important;
      }
      #crudModal .cm-file-mark { color: #24e3f1 !important; }
      #crudModal .cm-file-name { overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; }

      @media (max-width: 1100px) {
        #crudModal .cm-editor-tripanel { grid-template-columns: minmax(250px,.9fr) minmax(430px,1.4fr) !important; }
        #crudModal .cm-files-panel { grid-column: 1 / -1 !important; }
        #crudModal .cm-files-panel .cm-files-list { display: grid !important; grid-template-columns: repeat(2,minmax(0,1fr)) !important; }
      }
      @media (max-width: 760px) {
        #crudModal .cm-editor-dialog { width: calc(100vw - 16px) !important; max-width: calc(100vw - 16px) !important; margin: 8px auto !important; }
        #crudModal .cm-editor-tripanel { grid-template-columns: 1fr !important; min-height: auto !important; }
        #crudModal .cm-files-panel { grid-column: auto !important; }
        #crudModal .cm-form-panel #nodeForm { grid-template-columns: 1fr !important; }
        #crudModal .cm-form-panel .cm-field-name,
        #crudModal .cm-form-panel .cm-field-lead,
        #crudModal .cm-form-panel .cm-field-description,
        #crudModal .cm-form-panel .cm-form-actions { grid-column: 1 !important; }
        #crudModal .cm-files-panel .cm-files-list { grid-template-columns: 1fr !important; }
        #crudModal .cm-form-panel .cm-form-actions { flex-wrap: wrap !important; }
        #crudModal .cm-form-panel .cm-form-actions:before { width: 100% !important; }
      }
    `;
    document.head.appendChild(style);
  }

  function markFormFields(form) {
    const map = [
      ['#nodeName', 'cm-field-name'],
      ['#nodeLevel', 'cm-field-level'],
      ['#nodeProgress', 'cm-field-progress'],
      ['#nodeLead', 'cm-field-lead'],
      ['#nodeDescription', 'cm-field-description']
    ];
    map.forEach(([selector, className]) => {
      const input = form.querySelector(selector);
      const wrapper = input && input.closest('div');
      if (wrapper) wrapper.classList.add(className);
    });
    const deleteButton = form.querySelector('#deleteBtn');
    if (deleteButton) {
      const actions = deleteButton.closest('div');
      if (actions) actions.classList.add('cm-form-actions');
    }
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
      ? names.map(name => `<div class="cm-file-item"><span class="cm-file-mark">▣</span><span class="cm-file-name" title="${String(name).replace(/"/g,'&quot;')}">${String(name).replace(/</g,'&lt;')}</span></div>`).join('')
      : '<div class="cm-file-item"><span class="cm-file-mark">▣</span><span class="cm-file-name">Sin archivos registrados</span></div>';
  }

  function rebuildTripanel() {
    const modal = document.getElementById('crudModal');
    const body = modal && modal.querySelector('.modal-body');
    const form = document.getElementById('nodeForm');
    const updates = document.getElementById('updatesSection');
    if (!modal || !body || !form || !updates || body.dataset.cmTripanel === '1') return;

    installStyle();
    updates.classList.remove('d-none');

    const layout = document.createElement('div');
    layout.className = 'cm-editor-tripanel';
    const left = document.createElement('section');
    left.className = 'cm-panel cm-advances-panel';
    const center = document.createElement('section');
    center.className = 'cm-panel cm-form-panel';
    const right = document.createElement('section');
    right.className = 'cm-panel cm-files-panel';

    center.innerHTML = '<div class="cm-panel-title">DATOS DEL PROYECTO <span>PROJECT DATA</span></div>';
    right.innerHTML = '<div class="cm-panel-title">ARCHIVOS <span>ATTACHED FILES</span></div><div class="cm-files-caption">DOCUMENTOS ASOCIADOS A LA BITÁCORA</div><div id="cmAttachedFiles" class="cm-files-list"><div class="cm-file-item"><span class="cm-file-mark">▣</span><span class="cm-file-name">Sin archivos registrados</span></div></div>';

    body.dataset.cmTripanel = '1';
    body.innerHTML = '';
    body.appendChild(layout);
    layout.append(left, center, right);
    center.appendChild(form);
    left.appendChild(updates);

    const note = document.getElementById('updateNote');
    const files = document.getElementById('updateFiles');
    const add = document.getElementById('addUpdateBtn');
    const list = document.getElementById('updatesList');

    if (files) right.insertBefore(files, right.querySelector('#cmAttachedFiles'));
    if (note && list) left.insertBefore(note, list);
    if (add) left.appendChild(add);

    markFormFields(form);
    refreshAttachedFiles();
  }

  function boot() {
    installStyle();
    rebuildTripanel();
    const modal = document.getElementById('crudModal');
    if (!modal || modal.dataset.cmStableBound === '1') return;
    modal.dataset.cmStableBound = '1';
    modal.addEventListener('shown.bs.modal', () => {
      markFormFields(document.getElementById('nodeForm'));
      setTimeout(refreshAttachedFiles, 120);
    });
    document.getElementById('addUpdateBtn')?.addEventListener('click', () => setTimeout(refreshAttachedFiles, 700));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
