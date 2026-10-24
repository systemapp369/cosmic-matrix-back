/**
 * scene-manager.js — Administra los fondos 3D seleccionables del Dashboard.
 *
 * Cada escenario se registra con:  CMScenes.register({ id, label, desc, icon, start(canvas, opts) -> api })
 * El usuario elige desde el encabezado del dashboard; la elección se recuerda en localStorage.
 *
 *   CMScenes.mount()          arranca el escenario guardado (por defecto el primero en escritorio, ninguno en móvil)
 *   CMScenes.select(id|'off') cambia de escenario (o lo apaga)
 *   CMScenes.list() / current() / isOn() / api()
 * Dispara el evento  'cm:scene-changed'  con detail { id, on }.
 */
(function () {
  'use strict';

  const KEY = 'cm_dash_scene';
  const registry = new Map();
  let cur = null, inst = null, canvas = null, host = null;
  const body = () => document.body;

  function injectStyle() {
    if (document.getElementById('cm-scene-style')) return;
    const st = document.createElement('style'); st.id = 'cm-scene-style';
    st.textContent = `
      #cmSceneHost{position:fixed;inset:0;z-index:-1;pointer-events:none;overflow:hidden;background:#020a13}
      #cmDashScene{position:absolute;inset:0;width:100%;height:100%;display:block}
      body.cm-scene-on,body.cm-scene-on.cm-professional-dashboard{background:transparent!important}
      /* Con un escenario activo, el panel principal y las tarjetas se vuelven translúcidos para dejarlo ver sin perder legibilidad */
      body.cm-scene-on #cm-radical-dashboard{background:linear-gradient(180deg,rgba(2,10,19,.58) 0%,rgba(2,10,19,.18) 22%,rgba(2,10,19,.14) 40%,rgba(2,10,19,.50) 100%)!important}
      body.cm-scene-on #cm-radical-dashboard .cm-panel{background:linear-gradient(180deg,rgba(5,29,45,.56),rgba(2,14,25,.66))!important;-webkit-backdrop-filter:blur(5px) saturate(1.15);backdrop-filter:blur(5px) saturate(1.15)}
      body.cm-scene-on #cm-radical-dashboard .cm-radical-header{text-shadow:0 1px 10px rgba(0,0,0,.9)}
      body.cm-scene-on #cm-radical-dashboard .cm-radical-header small{color:#d3ecf7!important}
      body.cm-scene-on #cm-radical-dashboard .cm-kpi,body.cm-scene-on #cm-radical-dashboard .cm-crit-side{-webkit-backdrop-filter:blur(7px);backdrop-filter:blur(7px)}
      body.cm-scene-on #cm-radical-dashboard .cm-rings-grid{background:rgba(3,19,31,.30)}
      body.cm-scene-on #cm-radical-dashboard .cm-kpi{background:rgba(4,22,36,.55)!important}
      body.cm-scene-on #cm-radical-dashboard .cm-crit-side{background:rgba(3,19,31,.42)!important}
      @media (prefers-reduced-transparency:reduce){body.cm-scene-on #cm-radical-dashboard .cm-panel{background:linear-gradient(180deg,rgba(5,29,45,.96),rgba(2,14,25,.99))!important;backdrop-filter:none}}`;
    document.head.appendChild(st);
  }

  // El fondo 3D antiguo (Background3D) queda oculto por el dashboard; se detiene para no gastar GPU en vano.
  function stopLegacy() {
    try {
      const b = window.monitor && window.monitor.background3D;
      if (b) { b._animate = () => {}; if (b.renderer && b.renderer.domElement) b.renderer.domElement.style.display = 'none'; }
    } catch (e) { /* noop */ }
  }

  const isMobile = () => window.matchMedia('(max-width:760px)').matches || /Android|iPhone|iPad|Mobi/i.test(navigator.userAgent);
  const emit = () => document.dispatchEvent(new CustomEvent('cm:scene-changed', { detail: { id: cur || 'off', on: !!inst } }));
  const read = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  const save = v => { try { localStorage.setItem(KEY, v); } catch (e) { /* noop */ } };

  function startScene(id) {
    const def = registry.get(id);
    if (!def || !window.THREE || !window.CMSceneKit) return false;
    injectStyle(); stopLegacy();
    host = document.createElement('div'); host.id = 'cmSceneHost'; body().appendChild(host);
    canvas = document.createElement('canvas'); canvas.id = 'cmDashScene'; canvas.setAttribute('aria-hidden', 'true'); host.appendChild(canvas);
    const mobile = isMobile();
    try {
      inst = def.start(canvas, { fps: 30, shadows: false, quality: mobile ? 'low' : 'medium', pixelRatioCap: mobile ? 1 : 1.15, shiftY: 0.2, pause: () => body().classList.contains('modal-open') });
    } catch (e) {
      console.warn('Fondo 3D no disponible (' + id + '):', e && e.message);
      host.remove(); host = null; canvas = null; inst = null; return false;
    }
    cur = id; body().classList.add('cm-scene-on'); return true;
  }

  function stopScene() {
    if (inst) { try { inst.dispose(); } catch (e) { /* noop */ } inst = null; }
    if (host) { host.remove(); host = null; }
    canvas = null; cur = null; body().classList.remove('cm-scene-on');
  }

  const api = {
    register(def) { registry.set(def.id, def); document.dispatchEvent(new CustomEvent('cm:scene-registered', { detail: { id: def.id } })); },
    list() { return [...registry.values()].map(d => ({ id: d.id, label: d.label, desc: d.desc || '', icon: d.icon || 'ti-movie' })); },
    current() { return cur || 'off'; },
    isOn() { return !!inst; },
    api() { return inst; },
    select(id) {
      stopScene();
      if (id && id !== 'off') startScene(id);
      save(cur || 'off'); emit(); return cur || 'off';
    },
    mount() {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      let pref = read();
      if (pref === 'on') pref = 'journey';                                  // compatibilidad con la versión anterior
      if (!pref) pref = (reduce || isMobile()) ? 'off' : (registry.has('journey') ? 'journey' : [...registry.keys()][0] || 'off');
      if (pref !== 'off' && registry.has(pref)) startScene(pref);
      emit(); return cur || 'off';
    }
  };
  window.CMScenes = api;
})();
