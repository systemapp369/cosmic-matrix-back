/* Compatibility layer for the existing InfrastructureMonitor lifecycle. */
if (typeof HexTower3D !== 'undefined') {
  HexTower3D.prototype.renderHexTowerPanel = function () {
    this.renderDashboardShell();
  };
  HexTower3D.prototype.hexNextPage = function () {};
  HexTower3D.prototype.hexPrevPage = function () {};
}

(function () {
  'use strict';

  const STYLE_ID = 'cm-editor-tripanel-v2';

  function installEditorStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      /* ==========================================================
         PROJECT EDITOR / HUD TRIPANEL
         Left: advances | Center: project form | Right: files
         ========================================================== */
      #crudModal .cm-editor-dialog {
        width: min(1500px, calc(100vw - 28px)) !important;
        max-width: min(1500px, calc(100vw - 28px)) !important;
        margin: 14px auto !important;
      }
      #crudModal .cm-editor-hud {
        min-height: min(820px, calc(100vh - 28px));
        border: 1px solid rgba(37,226,245,.72) !important;
        border-radius: 2px !important;
        overflow: hidden !important;
        background:
          linear-gradient(rgba(22,220,240,.025) 1px, transparent 1px),
          linear-gradient(90deg, rgba(22,220,240,.025) 1px, transparent 1px),
          radial-gradient(circle at 50% 40%, rgba(0,184,221,.08), transparent 42%),
          #020d19 !important;
        background-size: 24px 24px,24px 24px,100% 100%,100% 100% !important;
        box-shadow: inset 0 0 80px rgba(0,200,230,.08), 0 0 35px rgba(0,210,240,.12) !important;
      }
      #crudModal .cm-editor-hud .modal-header {
        min-height: 108px !important;
        padding: 28px 34px 20px !important;
        border-bottom: 1px solid rgba(43,218,237,.35) !important;
        background: linear-gradient(90deg, rgba(19,205,225,.11), rgba(0,0,0,0) 48%, rgba(19,205,225,.04)) !important;
      }
      #crudModal .cm-editor-hud .modal-title {
        font: 700 28px 'Orbitron', sans-serif !important;
        letter-spacing: .08em !important;
        color: #f5fdff !important;
      }
      #crudModal .cm-editor-hud #modalSub {
        font: 13px 'Share Tech Mono', monospace !important;
        letter-spacing: .25em !important;
        color: #61c8d6 !important;
      }
      #crudModal .cm-editor-hud .modal-body {
        padding: 20px !important;
      }
      #crudModal .cm-editor-tripanel {
        display: grid !important;
        grid-template-columns: minmax(250px, .88fr) minmax(480px, 1.55fr) minmax(250px, .88fr) !important;
        gap: 12px !important;
        align-items: stretch !important;
        min-height: 625px;
      }
      #crudModal .cm-panel {
        position: relative;
        min-width: 0;
        border: 1px solid rgba(45,208,229,.36);
        background: linear-gradient(180deg, rgba(7,31,45,.82), rgba(2,15,27,.9));
        box-shadow: inset 0 0 28px rgba(0,205,235,.035);
        padding: 20px;
      }
      #crudModal .cm-panel:before {
        content: '';
        position: absolute;
        top: -1px; left: 18px;
        width: 92px; height: 2px;
        background: #18e5f3;
        box-shadow: 0 0 12px rgba(24,229,243,.5);
      }
      #crudModal .cm-panel-title {
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 0 0 18px;
        color: #eefcff;
        font: 700 15px 'Orbitron', sans-serif;
        letter-spacing: .12em;
        text-transform: uppercase;
      }
      #crudModal .cm-panel-title span {
        color: #3be5f1;
        font: 11px 'Share Tech Mono', monospace;
        letter-spacing: .18em;
      }
      #crudModal .cm-editor-tripanel #nodeForm {
        display: grid !important;
        grid-template-columns: repeat(12, minmax(0,1fr)) !important;
        gap: 18px !important;
        margin: 0 !important;
      }
      #crudModal .cm-editor-tripanel #nodeForm > div { width:auto !important; padding:0 !important; margin:0 !important; }
      #crudModal .cm-editor-tripanel #nodeForm > div:nth-of-type(1) { grid-column:1 / -1 !important; }
      #crudModal .cm-editor-tripanel #nodeForm > div:nth-of-type(2) { grid-column:1 / 7 !important; }
      #crudModal .cm-editor-tripanel #nodeForm > div:nth-of-type(3) { grid-column:7 / -1 !important; }
      #crudModal .cm-editor-tripanel #nodeForm > div:nth-of-type(4) { grid-column:1 / -1 !important; }
      #crudModal .cm-editor-tripanel #nodeForm > div:nth-of-type(5) { grid-column:1 / -1 !important; }
      #crudModal .cm-editor-tripanel #nodeForm > div:nth-of-type(6) { grid-column:1 / -1 !important; }
      #crudModal .cm-editor-tripanel .form-label {
        color:#61c8d6 !important;
        font:11px 'Share Tech Mono',monospace !important;
        letter-spacing:.19em !important;
        text-transform:uppercase !important;
        margin-bottom:7px !important;
      }
      #crudModal .cm-editor-tripanel .form-control,
      #crudModal .cm-editor-tripanel .form-select {
        height:48px !important;
        border-radius:0 !important;
        border:1px solid rgba(44,194,215,.42) !important;
        background:#031522 !important;
        color:#f0fcff !important;
        font:15px 'Share Tech Mono',monospace !important;
        box-shadow:inset 0 0 18px rgba(0,200,230,.045) !important;
      }
      #crudModal .cm-editor-tripanel .form-control:focus,
      #crudModal .cm-editor-tripanel .form-select:focus {
        border-color:#2be4f2 !important;
        box-shadow:0 0 0 1px rgba(43,228,242,.22),0 0 18px rgba(43,228,242,.1) !important;
      }
      #crudModal .cm-editor-tripanel #nodeDescription { height:72px !important; }
      #crudModal .cm-editor-tripanel #nodeForm > div:nth-of-type(6) {
        display:flex !important;
        align-items:center !important;
        gap:10px !important;
        border-top:1px solid rgba(44,194,215,.24);
        padding-top:18px !important;
        margin-top:4px !important;
      }
      #crudModal .cm-editor-tripanel #nodeForm > div:nth-of-type(6):before {
        content:'SYSTEM CONTROL';
        margin-right:auto;
        color:#3c7f89;
        font:10px 'Share Tech Mono',monospace;
        letter-spacing:.2em;
      }
      #crudModal .cm-editor-tripanel .btn {
        min-height:44px !important;
        border-radius:0 !important;
        font:12px 'Share Tech Mono',monospace !important;
        letter-spacing:.1em !important;
        text-transform:uppercase !important;
      }
      #crudModal .cm-editor-tripanel #submitBtn { background:#12bfd4 !important; border:1px solid #5af3ff !important; color:#00151c !important; }
      #crudModal .cm-editor-tripanel .id-delete-btn { border-color:#ff3e68 !important; color:#ff6485 !important; }
      #crudModal .cm-editor-tripanel .btn-light { background:#0c2638 !important; border-color:#31566b !important; color:#e2f7fb !important; }

      /* LEFT — advances */
      #crudModal .cm-advances-panel #updatesSection {
        display:flex !important;
        flex-direction:column !important;
        gap:12px !important;
        margin:0 !important;
        padding:0 !important;
        border:0 !important;
        min-height:100% !important;
      }
      #crudModal .cm-advances-panel #updatesSection > h6 {
        margin:0 !important;
        color:#eefcff !important;
        font:700 15px 'Orbitron',sans-serif !important;
        letter-spacing:.11em !important;
      }
      #crudModal .cm-advances-panel #updatesSection > h6:before { content:'//'; color:#1de4f1; margin-right:8px; }
      #crudModal .cm-advances-panel #updateNote {
        order:2; width:100% !important; height:120px !important; resize:vertical;
        border-radius:0 !important; margin:0 !important;
      }
      #crudModal .cm-advances-panel #addUpdateBtn { width:100%; order:4; background:#0a91a6 !important; border:1px solid #36e6f3 !important; color:#eaffff !important; }
      #crudModal .cm-advances-panel #updatesList {
        order:5; display:flex !important; flex-direction:column !important; gap:8px !important;
        max-height:360px !important; overflow:auto; padding-right:3px;
      }
      #crudModal .cm-advances-panel #updatesList > * {
        border-radius:0 !important; border:1px solid rgba(38,202,224,.25) !important;
        background:rgba(2,20,32,.78) !important;
      }
      #crudModal .cm-advances-panel .cm-file-input-wrap { order:3; }

      /* RIGHT — attached files */
      #crudModal .cm-files-panel .cm-files-caption {
        margin:-4px 0 16px;
        color:#5ca9b5;
        font:11px 'Share Tech Mono',monospace;
        letter-spacing:.12em;
      }
      #crudModal .cm-files-panel #updateFiles {
        width:100% !important;
        height:auto !important;
        min-height:46px !important;
        margin:0 0 14px !important;
        border-radius:0 !important;
        border:1px solid rgba(44,194,215,.42) !important;
        background:#031522 !important;
        color:#d9f9fd !important;
        font:11px 'Share Tech Mono',monospace !important;
        padding:8px !important;
      }
      #crudModal .cm-files-list {
        display:flex; flex-direction:column; gap:7px; max-height:440px; overflow:auto;
      }
      #crudModal .cm-file-item {
        display:flex; align-items:center; gap:8px; padding:10px;
        border:1px solid rgba(45,208,229,.22); background:rgba(2,19,31,.7);
        color:#bdebf0; font:11px 'Share Tech Mono',monospace;
      }
      #crudModal .cm-file-item .cm-file-mark { color:#24e3f1; }
      #crudModal .cm-file-item .cm-file-name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

      @media(max-width:1050px){
        #crudModal .cm-editor-tripanel { grid-template-columns:1fr 1.4fr !important; }
        #crudModal .cm-files-panel { grid-column:1 / -1; }
      }
      @media(max-width:760px){
        #crudModal .cm-editor-dialog { width:calc(100vw - 12px) !important; max-width:calc(100vw - 12px) !important; }
        #crudModal .cm-editor-tripanel { grid-template-columns:1fr !important; }
        #crudModal .cm-files-panel { grid-column:auto; }
        #crudModal .cm-editor-tripanel #nodeForm { grid-template-columns:1fr !important; }
        #crudModal .cm-editor-tripanel #nodeForm > div:nth-of-type(n) { grid-column:1 / -1 !important; }
      }
    `;
    document.head.appendChild(style);
  }

  function rebuildTripanel() {
    const modal = document.getElementById('crudModal');
    const body = modal?.querySelector('.modal-body');
    const form = document.getElementById('nodeForm');
    const updates = document.getElementById('updatesSection');
    if (!modal || !body || !form || !updates || body.dataset.cmTripanel === '1') return;

    installEditorStyle();

    const layout = document.createElement('div');
    layout.className = 'cm-editor-tripanel';

    const left = document.createElement('section');
    left.className = 'cm-panel cm-advances-panel';

    const center = document.createElement('section');
    center.className = 'cm-panel cm-form-panel';
    const centerTitle = document.createElement('div');
    centerTitle.className = 'cm-panel-title';
    centerTitle.innerHTML = 'DATOS DEL PROYECTO <span>PROJECT DATA</span>';
    center.appendChild(centerTitle);

    const right = document.createElement('section');
    right.className = 'cm-panel cm-files-panel';
    right.innerHTML = '<div class="cm-panel-title">ARCHIVOS <span>ATTACHED FILES</span></div><div class="cm-files-caption">DOCUMENTOS ASOCIADOS A LA BITÁCORA</div><div class="cm-files-list" id="cmAttachedFiles"><div class="cm-file-item"><span class="cm-file-mark">▣</span><span class="cm-file-name">Sin archivos registrados</span></div></div>';

    body.dataset.cmTripanel = '1';
    body.innerHTML = '';
    body.appendChild(layout);
    layout.append(left, center, right);
    center.appendChild(form);
    left.appendChild(updates);

    const note = document.getElementById('updateNote');
    const files = document.getElementById('updateFiles');
    const add = document.getElementById('addUpdateBtn');
    if (note) left.querySelector('#updatesSection').insertBefore(note, left.querySelector('#updatesList'));
    if (files) {
      const wrap = document.createElement('div');
      wrap.className = 'cm-file-input-wrap';
      const label = document.createElement('div');
      label.className = 'cm-files-caption';
      label.textContent = 'ADJUNTAR ARCHIVOS AL AVANCE';
      wrap.append(label, files);
      left.querySelector('#updatesSection').insertBefore(wrap, add?.parentElement || null);
    }

    // Keep the add button directly after the file selector.
    const addRow = add?.parentElement;
    if (addRow) {
      addRow.style.display = 'block';
      addRow.style.margin = '0';
      left.querySelector('#updatesSection').insertBefore(addRow, document.getElementById('updatesList'));
    }

    refreshAttachedFiles();
  }

  function refreshAttachedFiles() {
    const target = document.getElementById('cmAttachedFiles');
    const list = document.getElementById('updatesList');
    if (!target || !list) return;
    const candidates = Array.from(list.querySelectorAll('a[href], [data-file-name]'));
    const names = [];
    candidates.forEach(el => {
      const name = el.getAttribute('data-file-name') || el.textContent.trim();
      if (name && !names.includes(name)) names.push(name);
    });
    if (!names.length) {
      target.innerHTML = '<div class="cm-file-item"><span class="cm-file-mark">▣</span><span class="cm-file-name">Sin archivos registrados</span></div>';
      return;
    }
    target.innerHTML = names.map(name => `<div class="cm-file-item"><span class="cm-file-mark">▣</span><span class="cm-file-name" title="${String(name).replace(/"/g,'&quot;')}">${String(name).replace(/</g,'&lt;')}</span></div>`).join('');
  }

  function boot() {
    installEditorStyle();
    rebuildTripanel();
    const modal = document.getElementById('crudModal');
    if (modal) {
      modal.addEventListener('shown.bs.modal', () => setTimeout(rebuildTripanel, 0));
      modal.addEventListener('shown.bs.modal', () => setTimeout(refreshAttachedFiles, 100));
    }
    const observer = new MutationObserver(() => {
      const m = document.getElementById('crudModal');
      if (m && m.classList.contains('show')) {
        rebuildTripanel();
        refreshAttachedFiles();
      }
    });
    observer.observe(document.body, { childList:true, subtree:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
