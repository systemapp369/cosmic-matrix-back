/**
 * dashboard-project-detail.js
 * Agrega al dashboard dos opciones:
 *   1) "Detalle del Proyecto": ventana de solo lectura con TODOS los datos del proyecto,
 *      sus archivos anexados y los avances registrados (con sus archivos).
 *   2) "Bitácora": pantalla completa con la lista de proyectos; al abrir uno se pueden
 *      editar todos sus datos, anexar archivos y registrar avances.
 * Reutiliza monitor.apiClient (FetchManager) y monitor.storageManager (Supabase Storage).
 */
(function () {
  'use strict';

  const API = 'https://cosmic-matrix-back.vercel.app/api';
  const LEVELS = ['BAJA', 'NORMAL', 'ALTA', 'CRÍTICA'];
  const STATUSES = ['ACTIVO', 'EN PROGRESO', 'EN ESPERA', 'COMPLETADO', 'CANCELADO'];
  const COLORS = { 'CRÍTICA': '#ff3155', ALTA: '#ffb51b', NORMAL: '#00d7a7', BAJA: '#a259ff' };

  const M = () => window.monitor || (typeof monitor !== 'undefined' ? monitor : null);
  const projects = () => { const m = M(); return m && Array.isArray(m.projects) ? m.projects : []; };
  const byId = id => projects().find(p => String(p.id) === String(id));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  const toast = msg => { try { M()?.showToast?.(msg); } catch (e) { console.log(msg); } };
  const lvlColor = l => COLORS[String(l || '').toUpperCase()] || '#7ca5c4';
  const isClosed = p => /^(COMPLETAD|CANCELAD)/i.test(String(p && p.status || '').trim());
  const pct = p => Math.max(0, Math.min(100, Number(p?.progress || 0)));
  const safeUrl = u => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? esc(x.href) : ''; } catch (e) { return ''; } };

  function fmtDate(v, withTime) {
    if (!v) return '—';
    const d = new Date(v);
    if (isNaN(d)) return esc(v);
    const o = { day: '2-digit', month: 'short', year: 'numeric' };
    if (withTime) { o.hour = '2-digit'; o.minute = '2-digit'; }
    return d.toLocaleString('es-MX', o);
  }

  async function getJson(path) {
    const r = await fetch(API + path, { cache: 'no-store' });
    if (!r.ok) throw new Error('Error ' + r.status);
    return r.json();
  }

  function fileCard(f, removable) {
    const url = safeUrl(f.fileUrl || f.url);
    if (!url) return '';
    const name = esc(f.fileName || f.name || 'Archivo');
    const type = String(f.fileType || f.type || '');
    let thumb = '<i class="ti ti-file-description"></i>';
    if (type.startsWith('image/')) thumb = `<img src="${url}" alt="${name}" loading="lazy">`;
    else if (type.startsWith('video/')) thumb = '<i class="ti ti-player-play"></i>';
    else if (type === 'application/pdf') thumb = '<i class="ti ti-file-type-pdf"></i>';
    else if (/sheet|excel|csv/.test(type)) thumb = '<i class="ti ti-file-spreadsheet"></i>';
    const link = `<a class="cmx-file" href="${url}" target="_blank" rel="noopener" title="${name}"><span class="cmx-thumb">${thumb}</span><span class="cmx-fname">${name}</span></a>`;
    if (!removable || f.id == null) return link;
    return `<div class="cmx-file-wrap" data-file-id="${esc(f.id)}">${link}
      <button type="button" class="cmx-file-del" data-act="ask" title="Quitar archivo" aria-label="Quitar ${name}"><i class="ti ti-trash"></i></button>
      <div class="cmx-file-confirm"><span>¿Quitar este archivo?</span><div><button type="button" class="cmx-btn cmx-danger" data-act="yes">Quitar</button><button type="button" class="cmx-btn" data-act="no">Cancelar</button></div></div>
    </div>`;
  }
  const filesGrid = (list, empty, removable) => list && list.length
    ? `<div class="cmx-files">${list.map(f => fileCard(f, removable)).join('')}</div>`
    : `<div class="cmx-empty">${empty}</div>`;

  function updatesHtml(ups, removable) {
    if (!ups || !ups.length) return '<div class="cmx-empty">Aún no hay avances registrados.</div>';
    return ups.map(u => {
      const canDel = removable && u.id != null;
      return `<article class="cmx-update" data-update-id="${esc(u.id)}">
        <div class="cmx-update-head">
          <div class="cmx-update-date"><i class="ti ti-clock"></i> ${fmtDate(u.createdAt, true)}</div>
          ${canDel ? '<button type="button" class="cmx-up-del" data-act="ask-up" title="Eliminar avance completo" aria-label="Eliminar avance completo"><i class="ti ti-trash"></i></button>' : ''}
        </div>
        <div class="cmx-update-note">${esc(u.note)}</div>
        ${(u.files || []).length ? `<div class="cmx-files cmx-files-sm">${u.files.map(f => fileCard(f, canDel)).join('')}</div>` : ''}
        ${canDel ? '<div class="cmx-up-confirm"><span>¿Eliminar este avance y sus archivos?</span><div><button type="button" class="cmx-btn cmx-danger" data-act="yes-up">Eliminar</button><button type="button" class="cmx-btn" data-act="no-up">Cancelar</button></div></div>' : ''}
      </article>`;
    }).join('');
  }

  /* ---------- Utilidades de modal ---------- */
  function ensureModal(id, dialogClass, html) {
    let el = document.getElementById(id);
    if (el) return el;
    el = document.createElement('div');
    el.className = 'modal fade cmx-modal';
    el.id = id;
    el.tabIndex = -1;
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `<div class="modal-dialog ${dialogClass}"><div class="modal-content">${html}</div></div>`;
    document.body.appendChild(el);
    return el;
  }
  const inst = el => window.bootstrap.Modal.getOrCreateInstance(el);
  function switchTo(fromEl, openFn) {
    if (fromEl && fromEl.classList.contains('show')) {
      fromEl.addEventListener('hidden.bs.modal', openFn, { once: true });
      inst(fromEl).hide();
    } else openFn();
  }

  /* =====================================================================
     1) DETALLE DEL PROYECTO
     ===================================================================== */
  let detailId = null, detailToken = 0;

  function detailModal() {
    const el = ensureModal('cmxDetailModal', 'modal-xl modal-dialog-centered modal-dialog-scrollable', `
      <div class="modal-header">
        <div><div class="cmx-kicker">PROJECT DETAIL</div><h5 class="modal-title">Detalle del Proyecto</h5></div>
        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Cerrar"></button>
      </div>
      <div class="modal-body">
        <label class="cmx-label" for="cmxDetailSelect">Proyecto</label>
        <select id="cmxDetailSelect" class="cmx-input"></select>
        <div id="cmxDetailBody" class="cmx-detail-body"></div>
      </div>
      <div class="modal-footer">
        <button type="button" class="cmx-btn" data-bs-dismiss="modal">Cerrar</button>
        <button type="button" class="cmx-btn primary" id="cmxDetailEdit"><i class="ti ti-edit"></i> Editar en Bitácora</button>
      </div>`);
    if (!el.dataset.bound) {
      el.dataset.bound = '1';
      el.querySelector('#cmxDetailSelect').addEventListener('change', e => renderDetail(e.target.value));
      el.querySelector('#cmxDetailEdit').addEventListener('click', () => { const id = detailId; switchTo(el, () => openBitacora(id)); });
    }
    return el;
  }

  function openDetail(id) {
    const list = projects();
    if (!list.length) return toast('Aún no hay proyectos cargados');
    const el = detailModal();
    const sel = el.querySelector('#cmxDetailSelect');
    sel.innerHTML = list.map(p => `<option value="${esc(p.id)}">${esc(p.name)} · ${esc(p.id)}</option>`).join('');
    const target = id && byId(id) ? id : (detailId && byId(detailId) ? detailId : list[0].id);
    sel.value = target;
    inst(el).show();
    renderDetail(target);
  }

  async function renderDetail(id) {
    const p = byId(id);
    const body = document.getElementById('cmxDetailBody');
    if (!p || !body) return;
    detailId = p.id;
    const token = ++detailToken;
    const c = lvlColor(p.level);
    body.innerHTML = `
      <section class="cmx-hero" style="--c:${c}">
        <div class="cmx-hero-top">
          <div class="cmx-hero-name">${esc(p.name)}</div>
          <div class="cmx-badges"><span class="cmx-badge" style="--c:${c}">${esc(p.level || '—')}</span><span class="cmx-badge">${esc(p.status || 'ACTIVO')}</span></div>
        </div>
        <div class="cmx-progress"><span style="width:${pct(p)}%"></span></div>
        <div class="cmx-progress-label">${pct(p)}% de avance</div>
      </section>
      <section class="cmx-grid">
        <div class="cmx-card"><small>ID</small><b>${esc(p.id)}</b></div>
        <div class="cmx-card"><small>Responsable</small><b>${esc(p.lead || '—')}</b></div>
        <div class="cmx-card"><small>Criticidad</small><b style="color:${c}">${esc(p.level || '—')}</b></div>
        <div class="cmx-card"><small>Estatus</small><b>${esc(p.status || 'ACTIVO')}</b></div>
        <div class="cmx-card"><small>Avance</small><b>${pct(p)}%</b></div>
        <div class="cmx-card"><small>Última actualización</small><b>${fmtDate(p.lastUpdate)}</b></div>
        <div class="cmx-card cmx-wide"><small>Descripción</small><p>${p.description ? esc(p.description) : '<span class="cmx-muted">Sin descripción</span>'}</p></div>
      </section>
      <h6 class="cmx-h"><i class="ti ti-paperclip"></i> Archivos anexados al proyecto</h6>
      <div id="cmxDetailFiles" class="cmx-empty">Cargando archivos…</div>
      <h6 class="cmx-h"><i class="ti ti-notebook"></i> Avances y archivos de la bitácora</h6>
      <div id="cmxDetailUpdates" class="cmx-empty">Cargando avances…</div>`;
    const [files, ups] = await Promise.allSettled([getJson(`/projects/${encodeURIComponent(p.id)}/files`), getJson(`/projects/${encodeURIComponent(p.id)}/updates`)]);
    if (token !== detailToken) return; // el usuario cambió de proyecto mientras cargaba
    const fEl = document.getElementById('cmxDetailFiles'), uEl = document.getElementById('cmxDetailUpdates');
    if (fEl) fEl.outerHTML = files.status === 'fulfilled'
      ? `<div id="cmxDetailFiles">${filesGrid(files.value, 'Este proyecto no tiene archivos anexados.')}</div>`
      : '<div id="cmxDetailFiles" class="cmx-empty cmx-err">No se pudieron cargar los archivos.</div>';
    if (uEl) uEl.outerHTML = ups.status === 'fulfilled'
      ? `<div id="cmxDetailUpdates" class="cmx-updates">${updatesHtml(ups.value)}</div>`
      : '<div id="cmxDetailUpdates" class="cmx-empty cmx-err">No se pudieron cargar los avances.</div>';
  }

  /* =====================================================================
     2) BITÁCORA (pantalla completa con edición de proyectos)
     ===================================================================== */
  let btId = null, btQuery = '', btLevel = null, btActiveOnly = false;

  function bitacoraScreen() {
    const el = ensureModal('cmxBitacoraScreen', 'modal-fullscreen', `
      <div class="modal-header">
        <div><div class="cmx-kicker">PROJECT LOG</div><h5 class="modal-title">Bitácora</h5></div>
        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Cerrar"></button>
      </div>
      <div class="modal-body cmx-bt" id="cmxBt">
        <aside class="cmx-bt-list">
          <div class="cmx-search"><i class="ti ti-search"></i><input id="cmxBtSearch" type="search" placeholder="Buscar proyecto o responsable…" autocomplete="off"></div>
          <div id="cmxBtFilter" class="cmx-filter" hidden></div>
          <div id="cmxBtItems" class="cmx-bt-items"></div>
        </aside>
        <section class="cmx-bt-editor" id="cmxBtEditor"></section>
      </div>`);
    if (!el.dataset.bound) {
      el.dataset.bound = '1';
      el.querySelector('#cmxBtSearch').addEventListener('input', e => { btQuery = e.target.value || ''; renderBtList(); });
      el.querySelector('#cmxBtFilter').addEventListener('click', e => { if (e.target.closest('[data-clear]')) { btLevel = null; btActiveOnly = false; renderBtList(); } });
      el.querySelector('#cmxBtItems').addEventListener('click', e => { const b = e.target.closest('[data-id]'); if (b) selectBt(b.dataset.id); });
    }
    return el;
  }

  function openBitacora(id, opts) {
    if (!projects().length) return toast('Aún no hay proyectos cargados');
    const el = bitacoraScreen();
    btQuery = '';
    btLevel = opts && opts.level ? String(opts.level) : null;
    btActiveOnly = !!(opts && opts.activeOnly);
    el.querySelector('#cmxBtSearch').value = '';
    inst(el).show();
    renderBtList();
    if (!id && btLevel) {                       // filtro por criticidad: si solo hay un proyecto, se abre directo
      const only = projects().filter(p => p.level === btLevel && (!btActiveOnly || !isClosed(p)));
      if (only.length === 1) id = only[0].id;
    }
    if (id && byId(id)) selectBt(id);
    else { btId = null; el.querySelector('#cmxBt').classList.remove('cmx-editing'); showEditorPlaceholder(); }
  }

  function showEditorPlaceholder() {
    document.getElementById('cmxBtEditor').innerHTML = '<div class="cmx-placeholder"><i class="ti ti-pointer"></i><p>Selecciona un proyecto de la lista para abrirlo y editar sus datos.</p></div>';
  }

  function renderBtList() {
    const q = btQuery.trim().toLowerCase();
    const list = projects().filter(p => (!btLevel || p.level === btLevel) && (!btActiveOnly || !isClosed(p)) && (!q || `${p.name} ${p.lead} ${p.id} ${p.status} ${p.level}`.toLowerCase().includes(q)));
    const fb = document.getElementById('cmxBtFilter');
    if (fb) {
      fb.hidden = !btLevel;
      fb.innerHTML = btLevel ? `<span><i class="ti ti-filter"></i> Criticidad: <b>${esc(btLevel)}</b>${btActiveOnly ? ' · activos' : ''} · ${list.length} proyecto${list.length === 1 ? '' : 's'}</span><button type="button" data-clear title="Quitar filtro"><i class="ti ti-x"></i> Ver todos</button>` : '';
    }
    document.getElementById('cmxBtItems').innerHTML = list.length ? list.map(p => `
      <button type="button" class="cmx-bt-item${String(p.id) === String(btId) ? ' active' : ''}" data-id="${esc(p.id)}" style="--c:${lvlColor(p.level)}">
        <span class="cmx-bt-name">${esc(p.name)}</span>
        <span class="cmx-bt-meta">${esc(p.lead && p.lead !== 'UNASSIGNED' ? p.lead : 'Sin responsable')} · ${esc(p.status || 'ACTIVO')}</span>
        <span class="cmx-progress cmx-progress-sm"><span style="width:${pct(p)}%"></span></span>
      </button>`).join('') : '<div class="cmx-empty">Sin resultados.</div>';
  }

  function optionList(values, current) {
    const all = values.includes(current) || !current ? values : [current, ...values];
    return all.map(v => `<option value="${esc(v)}"${v === current ? ' selected' : ''}>${esc(v.charAt(0) + v.slice(1).toLowerCase())}</option>`).join('');
  }

  function selectBt(id) {
    const p = byId(id);
    if (!p) return;
    btId = p.id;
    renderBtList();
    document.getElementById('cmxBt').classList.add('cmx-editing');
    const ed = document.getElementById('cmxBtEditor');
    ed.scrollTop = 0;
    ed.innerHTML = `
      <div class="cmx-ed-top">
        <button type="button" class="cmx-btn cmx-back" id="cmxBtBack"><i class="ti ti-arrow-left"></i> Proyectos</button>
        <div class="cmx-ed-title"><span class="cmx-kicker">${esc(p.id)}</span><h6>${esc(p.name)}</h6></div>
        <button type="button" class="cmx-btn" id="cmxBtView"><i class="ti ti-file-info"></i> Ver detalle</button>
      </div>
      <form id="cmxBtForm" class="cmx-form" novalidate>
        <div class="cmx-f cmx-full"><label class="cmx-label" for="cmxName">Nombre del proyecto</label><input id="cmxName" class="cmx-input" maxlength="255" value="${esc(p.name)}" required></div>
        <div class="cmx-f"><label class="cmx-label" for="cmxLevel">Criticidad</label><select id="cmxLevel" class="cmx-input">${optionList(LEVELS, p.level || 'NORMAL')}</select></div>
        <div class="cmx-f"><label class="cmx-label" for="cmxProgress">Avance (%)</label><input id="cmxProgress" class="cmx-input" type="number" min="0" max="100" step="1" inputmode="numeric" value="${pct(p)}"></div>
        <div class="cmx-f"><label class="cmx-label" for="cmxStatus">Estatus</label><select id="cmxStatus" class="cmx-input">${optionList(STATUSES, p.status || 'ACTIVO')}</select></div>
        <div class="cmx-f"><label class="cmx-label" for="cmxLead">Responsable del proyecto</label><input id="cmxLead" class="cmx-input" maxlength="100" value="${esc(p.lead && p.lead !== 'UNASSIGNED' ? p.lead : '')}" placeholder="Nombre o área responsable"></div>
        <div class="cmx-f cmx-full"><label class="cmx-label" for="cmxDesc">Descripción breve</label><textarea id="cmxDesc" class="cmx-input cmx-ta" maxlength="500" placeholder="Objetivo, alcance o contexto del proyecto">${esc(p.description || '')}</textarea></div>
        <div class="cmx-f cmx-full"><label class="cmx-label" for="cmxFiles"><i class="ti ti-paperclip"></i> Anexar archivos</label>
          <div class="cmx-drop"><input id="cmxFiles" class="cmx-input cmx-file-input" type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"></div></div>
        <div class="cmx-actions cmx-full cmx-actions-split">
          <button type="button" class="cmx-btn cmx-danger-outline" id="cmxDelAsk"><i class="ti ti-trash"></i> Eliminar proyecto</button>
          <button type="submit" class="cmx-btn primary" id="cmxSave"><i class="ti ti-device-floppy"></i> Guardar cambios</button>
        </div>
        <div class="cmx-del-confirm cmx-full" id="cmxDelConfirm" hidden role="alertdialog" aria-labelledby="cmxDelTitle">
          <i class="ti ti-alert-triangle"></i>
          <div class="cmx-del-text"><b id="cmxDelTitle">¿Eliminar el proyecto «${esc(p.name)}»?</b><span>Se borrarán también sus avances y archivos anexados. Esta acción no se puede deshacer.</span></div>
          <div class="cmx-del-btns"><button type="button" class="cmx-btn" id="cmxDelNo">Cancelar</button><button type="button" class="cmx-btn cmx-danger" id="cmxDelYes"><i class="ti ti-trash"></i> Sí, eliminar</button></div>
        </div>
      </form>
      <h6 class="cmx-h"><i class="ti ti-paperclip"></i> Archivos anexados</h6>
      <div id="cmxBtFiles" class="cmx-empty">Cargando archivos…</div>
      <h6 class="cmx-h"><i class="ti ti-notebook"></i> Avances</h6>
      <div class="cmx-addupd">
        <textarea id="cmxNote" class="cmx-input cmx-ta" placeholder="Describe el avance, incidencia u observación…"></textarea>
        <input id="cmxNoteFiles" class="cmx-input cmx-file-input" type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt">
        <div class="cmx-actions"><button type="button" class="cmx-btn" id="cmxAddUpd"><i class="ti ti-plus"></i> Agregar avance</button></div>
      </div>
      <div id="cmxBtUpdates" class="cmx-updates"><div class="cmx-empty">Cargando avances…</div></div>`;

    ed.querySelector('#cmxBtBack').addEventListener('click', () => document.getElementById('cmxBt').classList.remove('cmx-editing'));
    ed.querySelector('#cmxBtView').addEventListener('click', () => switchTo(document.getElementById('cmxBitacoraScreen'), () => openDetail(p.id)));
    ed.querySelector('#cmxBtForm').addEventListener('submit', e => { e.preventDefault(); saveProject(p.id); });
    ed.querySelector('#cmxAddUpd').addEventListener('click', () => addUpdate(p.id));
    const delBox = ed.querySelector('#cmxDelConfirm');
    ed.querySelector('#cmxDelAsk').addEventListener('click', () => { delBox.hidden = false; delBox.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); ed.querySelector('#cmxDelNo').focus(); });
    ed.querySelector('#cmxDelNo').addEventListener('click', () => { delBox.hidden = true; });
    ed.querySelector('#cmxDelYes').addEventListener('click', () => deleteProject(p.id));
    ed.addEventListener('click', onFilesClick);
    loadBtFiles(p.id);
    loadBtUpdates(p.id);
  }

  async function loadBtFiles(id) {
    try {
      const files = await getJson(`/projects/${encodeURIComponent(id)}/files`);
      if (String(btId) !== String(id)) return;
      const el = document.getElementById('cmxBtFiles');
      if (el) el.outerHTML = `<div id="cmxBtFiles">${filesGrid(files, 'Este proyecto no tiene archivos anexados.', true)}</div>`;
    } catch (e) { const el = document.getElementById('cmxBtFiles'); if (el) { el.className = 'cmx-empty cmx-err'; el.textContent = 'No se pudieron cargar los archivos.'; } }
  }

  const EMPTY_FILES = '<div class="cmx-empty">Este proyecto no tiene archivos anexados.</div>';

  async function removeFile(projectId, wrap) {
    const m = M();
    const fileId = wrap.dataset.fileId;
    const upEl = wrap.closest('.cmx-update');            // si está dentro de un avance
    wrap.classList.remove('confirming');
    wrap.classList.add('removing');
    try {
      const res = upEl
        ? await m.apiClient.deleteUpdateFile(upEl.dataset.updateId, fileId)
        : await m.apiClient.deleteProjectFile(projectId, fileId);
      if (!res || !res.success) throw new Error('El servidor no confirmó la eliminación');
      const grid = wrap.parentElement;
      wrap.remove();
      if (upEl) { if (grid && grid.classList.contains('cmx-files') && !grid.children.length) grid.remove(); }
      else {
        const g = document.querySelector('#cmxBtFiles .cmx-files');
        if (g && !g.children.length) g.outerHTML = EMPTY_FILES;
      }
      toast(upEl ? 'Archivo quitado del avance' : 'Archivo quitado del proyecto');
      const freed = res.file && res.file.fileUrl ? await m.storageManager.removeByUrl(res.file.fileUrl) : false;
      if (!freed) console.info('El archivo se desvinculó; el objeto sigue en Storage (sin permiso de borrado o URL externa).');
    } catch (err) {
      wrap.classList.remove('removing');
      toast('No se pudo quitar el archivo: ' + (err.message || err));
    }
  }

  async function removeUpdate(art) {
    const m = M();
    art.classList.remove('confirming');
    art.classList.add('removing');
    try {
      const res = await m.apiClient.deleteProjectUpdate(art.dataset.updateId);
      if (!res || !res.success) throw new Error('El servidor no confirmó la eliminación');
      const list = art.parentElement;
      art.remove();
      if (list && !list.querySelector('.cmx-update')) list.innerHTML = updatesHtml([]);
      toast('Avance eliminado');
      for (const f of (res.files || [])) { if (f.fileUrl) await m.storageManager.removeByUrl(f.fileUrl); }
    } catch (err) {
      art.classList.remove('removing');
      toast('No se pudo eliminar el avance: ' + (err.message || err));
    }
  }

  function clearConfirms() {
    document.querySelectorAll('.cmx-file-wrap.confirming,.cmx-update.confirming').forEach(w => w.classList.remove('confirming'));
  }

  function onFilesClick(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    if (act.endsWith('-up')) {
      const art = btn.closest('.cmx-update');
      if (!art) return;
      if (act === 'ask-up') { clearConfirms(); art.classList.add('confirming'); }
      else if (act === 'no-up') art.classList.remove('confirming');
      else if (act === 'yes-up') removeUpdate(art);
      return;
    }
    const wrap = btn.closest('.cmx-file-wrap');
    if (!wrap) return;
    if (act === 'ask') { clearConfirms(); wrap.classList.add('confirming'); }
    else if (act === 'no') wrap.classList.remove('confirming');
    else if (act === 'yes' && btId != null) removeFile(btId, wrap);
  }

  async function loadBtUpdates(id) {
    const el = () => document.getElementById('cmxBtUpdates');
    try {
      const ups = await getJson(`/projects/${encodeURIComponent(id)}/updates`);
      if (String(btId) === String(id) && el()) el().innerHTML = updatesHtml(ups, true);
    } catch (e) { if (el()) el().innerHTML = '<div class="cmx-empty cmx-err">No se pudieron cargar los avances.</div>'; }
  }

  async function saveProject(id) {
    const m = M(), p = byId(id);
    if (!m || !p) return;
    const v = k => document.getElementById(k).value;
    const name = v('cmxName').trim();
    const progress = parseInt(v('cmxProgress'), 10);
    if (!name) { toast('El nombre del proyecto es obligatorio'); document.getElementById('cmxName').focus(); return; }
    if (isNaN(progress) || progress < 0 || progress > 100) { toast('El avance debe estar entre 0 y 100'); document.getElementById('cmxProgress').focus(); return; }
    const data = { id: p.id, name, level: v('cmxLevel'), progress, lead: v('cmxLead').trim() || 'UNASSIGNED', description: v('cmxDesc').trim(), status: v('cmxStatus') || 'ACTIVO', selected: p.selected ?? true };
    const btn = document.getElementById('cmxSave');
    btn.disabled = true;
    try {
      toast('Guardando cambios…');
      const res = await m.apiClient.upsertProject(data);
      if (!res || !res.success) throw new Error('El servidor no confirmó el guardado');
      const fEl = document.getElementById('cmxFiles');
      if (fEl && fEl.files.length) {
        toast('Subiendo archivos…');
        const up = await m.storageManager.uploadFiles(fEl.files, data.id);
        await m.apiClient.addProjectFiles(data.id, up);
      }
      await m.loadProjectsFromRemote();
      window.dispatchEvent(new CustomEvent('cm:projects-updated'));
      toast('Cambios guardados en la bitácora');
      if (byId(id)) selectBt(id);
    } catch (err) {
      toast('Error al guardar: ' + (err.message || err));
    } finally { const b = document.getElementById('cmxSave'); if (b) b.disabled = false; }
  }

  async function deleteProject(id) {
    const m = M(), p = byId(id);
    if (!m || !p) return;
    const yes = document.getElementById('cmxDelYes'), no = document.getElementById('cmxDelNo'), ask = document.getElementById('cmxDelAsk');
    [yes, no, ask].forEach(b => b && (b.disabled = true));
    try {
      const res = await m.apiClient.deleteProject(p.id);
      if (!res || !res.success) throw new Error('El servidor no confirmó la eliminación');
      const urls = (res.files || []).map(f => f && f.fileUrl).filter(Boolean);
      await m.loadProjectsFromRemote();
      window.dispatchEvent(new CustomEvent('cm:projects-updated'));
      if (String(detailId) === String(p.id)) detailId = null;
      btId = null;
      document.getElementById('cmxBt').classList.remove('cmx-editing');
      showEditorPlaceholder();
      renderBtList();
      toast(`Proyecto «${p.name}» eliminado`);
      for (const u of urls) { await m.storageManager.removeByUrl(u); }   // limpieza del Storage (si hay permiso)
    } catch (err) {
      [yes, no, ask].forEach(b => b && (b.disabled = false));
      toast('No se pudo eliminar el proyecto: ' + (err.message || err));
    }
  }

  async function addUpdate(id) {
    const m = M();
    const note = document.getElementById('cmxNote').value.trim();
    if (!note) return toast('Escribe una observación antes de guardar el avance');
    const btn = document.getElementById('cmxAddUpd');
    btn.disabled = true;
    try {
      const fEl = document.getElementById('cmxNoteFiles');
      let up = [];
      if (fEl.files.length) { toast('Subiendo archivos…'); up = await m.storageManager.uploadFiles(fEl.files, id); }
      await m.apiClient.addProjectUpdate(id, note, up);
      document.getElementById('cmxNote').value = '';
      fEl.value = '';
      toast('Avance registrado');
      loadBtUpdates(id);
    } catch (err) { toast('Error al registrar el avance: ' + (err.message || err)); }
    finally { const b = document.getElementById('cmxAddUpd'); if (b) b.disabled = false; }
  }

  /* =====================================================================
     3) BOTONES EN EL DASHBOARD
     ===================================================================== */
  function mountButtons() {
    const radical = document.querySelector('#cm-radical-dashboard .cm-header-actions');
    const inline = document.getElementById('cm-inline-actions');
    let mounted = false;
    if (radical && !document.getElementById('cmx-btn-detail')) {
      const anchor = radical.querySelector('#cm-radical-excel');
      const mk = (id, icon, txt) => { const b = document.createElement('button'); b.className = 'cm-head-btn'; b.id = id; b.type = 'button'; b.innerHTML = `<i class="ti ${icon}"></i> ${txt}`; return b; };
      const d = mk('cmx-btn-detail', 'ti-file-info', 'Detalle del Proyecto'), b = mk('cmx-btn-bitacora', 'ti-notebook', 'Bitácora');
      d.addEventListener('click', () => openDetail());
      b.addEventListener('click', () => openBitacora());
      radical.insertBefore(d, anchor || null);
      radical.insertBefore(b, anchor || null);
    }
    if (inline && !document.getElementById('cmx-inline-detail')) {
      const mk = (id, icon, txt, fn) => { const b = document.createElement('button'); b.className = 'cm-inline-btn'; b.id = id; b.type = 'button'; b.innerHTML = `<i class="ti ${icon}"></i> ${txt}`; b.onclick = fn; return b; };
      inline.insertBefore(mk('cmx-inline-bitacora', 'ti-notebook', 'Bitácora', () => openBitacora()), inline.firstChild);
      inline.insertBefore(mk('cmx-inline-detail', 'ti-file-info', 'Detalle del Proyecto', () => openDetail()), inline.firstChild);
    }
    mounted = !!document.getElementById('cmx-btn-detail') || !!document.getElementById('cmx-inline-detail');
    return mounted;
  }

  /* Respaldo: si el dashboard no muestra su barra de acciones, se ofrece una barra flotante */
  function fallbackBar() {
    if (document.getElementById('cmx-fallback')) return;
    const bar = document.createElement('div');
    bar.id = 'cmx-fallback';
    bar.innerHTML = '<button type="button" id="cmx-fb-detail"><i class="ti ti-file-info"></i> Detalle del Proyecto</button><button type="button" id="cmx-fb-bitacora"><i class="ti ti-notebook"></i> Bitácora</button>';
    document.body.appendChild(bar);
    bar.querySelector('#cmx-fb-detail').onclick = () => openDetail();
    bar.querySelector('#cmx-fb-bitacora').onclick = () => openBitacora();
  }

  function installStyle() {
    if (document.getElementById('cmx-style')) return;
    const s = document.createElement('style');
    s.id = 'cmx-style';
    s.textContent = `
.cmx-modal{--cmx-gap:clamp(8px,2.5vw,24px);--bs-modal-margin:var(--cmx-gap);font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif}
.cmx-modal .modal-dialog:not(.modal-fullscreen){width:calc(100% - var(--cmx-gap)*2);max-width:1100px;margin:var(--cmx-gap) auto}
.cmx-modal .modal-content{display:flex;flex-direction:column;background:linear-gradient(180deg,#071c2d,#061421);color:#eaf7ff;border:1px solid rgba(24,185,231,.42);border-radius:clamp(12px,2vw,18px);box-shadow:0 24px 80px rgba(0,0,0,.6);overflow:hidden;max-height:calc(100vh - var(--cmx-gap)*2);max-height:calc(100dvh - var(--cmx-gap)*2)}
.cmx-modal .modal-fullscreen .modal-content{max-height:none;border-radius:0;border:0;height:100%}
.cmx-modal .modal-header{position:relative;flex:0 0 auto;gap:12px;padding:clamp(14px,2.4vw,22px) clamp(14px,3vw,28px);border-bottom:1px solid rgba(46,183,224,.18);background:linear-gradient(90deg,rgba(12,146,196,.12),transparent 68%)}
.cmx-modal .modal-header:before{content:"";position:absolute;left:0;top:0;width:clamp(90px,20%,165px);height:3px;background:#18d8ee;box-shadow:0 0 16px rgba(24,216,238,.55)}
.cmx-modal .modal-title{margin:0;color:#f3fbff;font:800 clamp(20px,4.4vw,26px)/1.15 Inter,system-ui,sans-serif;text-transform:none;overflow-wrap:anywhere}
.cmx-modal .modal-body{flex:1 1 auto;min-height:0;padding:clamp(14px,3vw,28px);overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain}
.cmx-modal .modal-footer{flex:0 0 auto;flex-wrap:wrap;gap:10px;border-top:1px solid rgba(46,183,224,.18);padding:12px clamp(14px,3vw,28px);background:transparent}
.cmx-kicker{color:#27d5ed;font:700 10px/1.2 Inter,sans-serif;letter-spacing:.18em;margin-bottom:6px}
.cmx-label{display:flex;align-items:center;gap:6px;margin:0 0 8px;color:#82b6c8;font:700 11px/1.25 Inter,sans-serif;letter-spacing:.09em;text-transform:uppercase}
.cmx-input{display:block;width:100%;min-width:0;height:48px;box-sizing:border-box;padding:0 14px;border:1px solid #1b526a;border-radius:10px;background:#061a2a;color:#eefaff;font:500 max(16px,1rem)/1.2 Inter,system-ui,sans-serif}
.cmx-input:focus{outline:0;border-color:#24d7ed;box-shadow:0 0 0 3px rgba(36,215,237,.12)}
.cmx-ta{height:auto;min-height:104px;padding:12px 14px;resize:vertical;line-height:1.45}
.cmx-file-input{height:auto;padding:10px;cursor:pointer;font-size:max(14px,.875rem)}
.cmx-drop{padding:12px;border:1px dashed #235d74;border-radius:11px;background:rgba(4,22,36,.72)}
.cmx-btn{min-height:44px;padding:10px 18px;border:1px solid #24536a;border-radius:9px;background:#102c40;color:#d8edf4;font:700 13px/1 Inter,sans-serif;display:inline-flex;align-items:center;justify-content:center;gap:7px;cursor:pointer}
.cmx-btn.primary{background:#159be7;border-color:#2db7ff;color:#fff}
.cmx-btn:disabled{opacity:.6;cursor:wait}
.cmx-detail-body{margin-top:18px}
.cmx-hero{padding:clamp(14px,2.6vw,22px);border:1px solid rgba(34,211,238,.18);border-left:4px solid var(--c);border-radius:12px;background:rgba(4,25,39,.68)}
.cmx-hero-top{display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:10px}
.cmx-hero-name{font:800 clamp(18px,3.6vw,24px)/1.2 Inter,sans-serif;overflow-wrap:anywhere;min-width:0;flex:1 1 220px}
.cmx-badges{display:flex;flex-wrap:wrap;gap:8px}
.cmx-badge{padding:5px 11px;border:1px solid var(--c,#2a6f8a);border-radius:999px;color:var(--c,#9ed7ea);font:700 11px/1 Inter,sans-serif;letter-spacing:.06em}
.cmx-progress{height:10px;margin-top:14px;border-radius:99px;background:#0a2c40;overflow:hidden}
.cmx-progress>span{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#159be7,#22d3ee)}
.cmx-progress-sm{height:6px;margin-top:8px}
.cmx-bt-item .cmx-progress{display:block}
.cmx-bt-item .cmx-progress>span{display:block}
.cmx-progress-label{margin-top:8px;color:#8fc0d1;font:600 12px/1 Inter,sans-serif}
.cmx-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,200px),1fr));gap:12px;margin-top:14px}
.cmx-card{min-width:0;padding:13px 15px;border:1px solid rgba(34,211,238,.14);border-radius:10px;background:rgba(4,25,39,.68)}
.cmx-card small{display:block;margin-bottom:6px;color:#78aabd;font:700 10px/1 Inter,sans-serif;letter-spacing:.12em;text-transform:uppercase}
.cmx-card b{display:block;font:700 15px/1.3 Inter,sans-serif;overflow-wrap:anywhere}
.cmx-card p{margin:0;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere}
.cmx-wide{grid-column:1/-1}
.cmx-muted{color:#6f9caf}
.cmx-h{display:flex;align-items:center;gap:8px;margin:26px 0 12px;color:#dff7ff;font:800 14px/1.2 Inter,sans-serif;letter-spacing:.04em}
.cmx-files{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,150px),1fr));gap:10px}
.cmx-files-sm{grid-template-columns:repeat(auto-fill,minmax(min(100%,120px),1fr));margin-top:8px}
.cmx-file{display:flex;flex-direction:column;gap:8px;min-width:0;padding:8px;border:1px solid rgba(34,211,238,.16);border-radius:10px;background:rgba(4,25,39,.68);color:#cfeaf5;text-decoration:none}
.cmx-file:hover{border-color:#24d7ed;color:#fff}
.cmx-thumb{display:flex;align-items:center;justify-content:center;height:88px;border-radius:8px;background:#061a2a;overflow:hidden;font-size:34px;color:#22d3ee}
.cmx-thumb img{width:100%;height:100%;object-fit:cover}
.cmx-fname{font:600 12px/1.3 Inter,sans-serif;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.cmx-file-wrap{position:relative;min-width:0}
.cmx-file-wrap>.cmx-file{height:100%}
.cmx-file-del{position:absolute;top:6px;right:6px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,62,104,.55);border-radius:8px;background:rgba(6,20,33,.86);color:#ff6f91;cursor:pointer;font-size:16px}
.cmx-file-del:hover{background:#ff3e68;color:#fff}
.cmx-file-confirm{display:none;position:absolute;inset:0;z-index:2;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:8px;border:1px solid #ff3e68;border-radius:10px;background:#061421;text-align:center;font:600 12px/1.3 Inter,sans-serif}
.cmx-file-wrap.confirming .cmx-file-confirm{display:flex}
.cmx-file-confirm>div{display:flex;flex-wrap:wrap;gap:6px;justify-content:center}
.cmx-file-confirm .cmx-btn{min-height:34px;padding:6px 12px;font-size:12px}
.cmx-danger{background:#c92a4d;border-color:#ff3e68;color:#fff}
.cmx-file-wrap.removing{opacity:.45;pointer-events:none}
@media(hover:none){.cmx-file-del{width:38px;height:38px}}
.cmx-updates{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr));gap:12px}
.cmx-update{position:relative;min-width:0;padding:13px;border:1px solid rgba(34,211,238,.14);border-radius:10px;background:rgba(4,25,39,.68)}
.cmx-update-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
.cmx-update-date{color:#78aabd;font:600 12px/1 Inter,sans-serif}
.cmx-up-del{flex:0 0 auto;width:34px;height:34px;display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,62,104,.55);border-radius:8px;background:rgba(6,20,33,.86);color:#ff6f91;cursor:pointer;font-size:16px}
.cmx-up-del:hover{background:#ff3e68;color:#fff}
.cmx-up-confirm{display:none;position:absolute;inset:0;z-index:3;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:12px;border:1px solid #ff3e68;border-radius:10px;background:#061421;text-align:center;font:600 13px/1.35 Inter,sans-serif}
.cmx-update.confirming>.cmx-up-confirm{display:flex}
.cmx-up-confirm>div{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
.cmx-update.removing{opacity:.45;pointer-events:none}
@media(hover:none){.cmx-up-del{width:40px;height:40px}}
.cmx-update-note{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.5}
.cmx-empty{padding:14px;border:1px dashed #1f4d63;border-radius:10px;color:#6f9caf;font:500 13px/1.4 Inter,sans-serif;text-align:center}
.cmx-err{color:#ff8fa5;border-color:#7a2b3d}
.cmx-bt{display:grid;grid-template-columns:minmax(240px,340px) minmax(0,1fr);gap:clamp(12px,2vw,22px);padding:clamp(10px,2vw,20px)!important;overflow:hidden!important}
.cmx-bt-list,.cmx-bt-editor{min-height:0;overflow-y:auto;overscroll-behavior:contain}
.cmx-search{display:flex;align-items:center;gap:8px;padding:0 12px;border:1px solid #1b526a;border-radius:10px;background:#061a2a;margin-bottom:12px;position:sticky;top:0;z-index:2}
.cmx-search input{flex:1;min-width:0;height:44px;border:0;background:transparent;color:#eefaff;font:500 max(16px,1rem) Inter,sans-serif;outline:0}
.cmx-bt-items{display:flex;flex-direction:column;gap:8px}
.cmx-filter{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:-2px 0 10px;padding:8px 10px;border:1px solid #1b526a;border-radius:9px;background:rgba(21,155,231,.10);color:#cfeaf5;font:600 12px/1.3 Inter,sans-serif}
.cmx-filter[hidden]{display:none}
.cmx-filter button{flex:none;border:1px solid #24536a;border-radius:7px;background:#102c40;color:#d8edf4;font:700 11px Inter,sans-serif;padding:6px 9px;cursor:pointer}
.cmx-bt-item{display:block;width:100%;text-align:left;padding:12px 14px;border:1px solid rgba(34,211,238,.14);border-left:4px solid var(--c);border-radius:10px;background:rgba(4,25,39,.68);color:#eaf7ff;cursor:pointer}
.cmx-bt-item.active,.cmx-bt-item:hover{border-color:#24d7ed;background:rgba(12,60,84,.6)}
.cmx-bt-name{display:block;font:700 14px/1.3 Inter,sans-serif;overflow-wrap:anywhere}
.cmx-bt-meta{display:block;margin-top:4px;color:#78aabd;font:500 12px/1.3 Inter,sans-serif}
.cmx-ed-top{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-bottom:18px}
.cmx-ed-title{flex:1 1 200px;min-width:0}.cmx-ed-title h6{margin:0;font:800 clamp(17px,3.4vw,22px)/1.2 Inter,sans-serif;overflow-wrap:anywhere}
.cmx-back{display:none}
.cmx-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.cmx-f{min-width:0}.cmx-full{grid-column:1/-1}
.cmx-actions{display:flex;justify-content:flex-end;gap:10px}
.cmx-actions-split{justify-content:space-between;flex-wrap:wrap}
.cmx-danger-outline{border-color:rgba(255,62,104,.6);background:rgba(255,62,104,.06);color:#ff7a96}
.cmx-danger-outline:hover:not(:disabled){background:#ff3e68;color:#fff}
.cmx-danger{background:#e0314f;border-color:#ff5b78;color:#fff}
.cmx-del-confirm{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:14px 16px;border:1px solid #ff3e68;border-radius:11px;background:rgba(255,62,104,.08)}
.cmx-del-confirm[hidden]{display:none}
.cmx-del-confirm>i{flex:none;font-size:26px;color:#ff5b78}
.cmx-del-text{flex:1 1 240px;min-width:0;display:flex;flex-direction:column;gap:4px;font:500 13px/1.4 Inter,sans-serif;color:#f1d5db}
.cmx-del-text b{font-size:14px;color:#fff;overflow-wrap:anywhere}
.cmx-del-btns{display:flex;gap:8px;flex-wrap:wrap}
.cmx-addupd{display:flex;flex-direction:column;gap:10px;margin-bottom:14px}
.cmx-placeholder{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-height:40vh;color:#6f9caf;text-align:center}
.cmx-placeholder i{font-size:40px;color:#22d3ee}
@media(max-width:820px){
  .cmx-bt{grid-template-columns:minmax(0,1fr)}
  .cmx-bt .cmx-bt-editor{display:none}
  .cmx-bt.cmx-editing .cmx-bt-editor{display:block}
  .cmx-bt.cmx-editing .cmx-bt-list{display:none}
  .cmx-back{display:inline-flex}
}
@media(max-width:640px){
  .cmx-form{grid-template-columns:minmax(0,1fr)}
  .cmx-f{grid-column:1/-1}
  .cmx-actions .cmx-btn,.cmx-modal .modal-footer .cmx-btn,.cmx-del-btns,.cmx-del-btns .cmx-btn{width:100%}
}
#cm-radical-dashboard .cm-radical-header,#cm-radical-dashboard .cm-header-actions{flex-wrap:wrap}
#cmx-fallback{position:fixed;right:14px;bottom:14px;z-index:1090;display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;max-width:calc(100vw - 28px)}
#cmx-fallback button{height:42px;padding:0 15px;border:1px solid #1ca5ff;border-radius:21px;background:linear-gradient(135deg,#087cf4,#1687ff);color:#fff;font:700 13px Inter,sans-serif;display:inline-flex;align-items:center;gap:7px;cursor:pointer}
`;
    document.head.appendChild(s);
  }

  /* API pública (por si se quiere abrir desde otros módulos) */
  window.cmOpenProjectDetail = openDetail;
  window.cmOpenBitacora = openBitacora;

  installStyle();
  let tries = 0;
  const timer = setInterval(() => {
    tries++;
    const ok = mountButtons();
    if (!ok && tries === 12) fallbackBar();          // ~6 s sin barra de acciones -> barra flotante
    if (ok) { const fb = document.getElementById('cmx-fallback'); if (fb) fb.remove(); }
  }, 500);
  // La barra puede re-renderizarse: se re-monta sin duplicar
  setInterval(mountButtons, 1500);
})();
