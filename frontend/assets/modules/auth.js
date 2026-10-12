/**
 * auth.js — Sesión del usuario en el navegador.
 * - Guarda el token (localStorage si "Recordarme", si no sessionStorage).
 * - Añade "Authorization: Bearer ..." a TODAS las peticiones al backend (envuelve window.fetch).
 * - Si el servidor responde 401 (sesión expirada/usuario desactivado) cierra la sesión y vuelve al login.
 * - Expone window.cmAuth: getUser(), can(permiso), logout(), requireLogin(), etc.
 * La seguridad real está en el servidor; estos controles solo adaptan la interfaz.
 */
(function () {
  'use strict';
  const API_BASE = 'https://cosmic-matrix-back.vercel.app/api';
  const KEY = 'cm_session';
  const origFetch = window.fetch.bind(window);

  function read() {
    for (const st of [window.localStorage, window.sessionStorage]) {
      try {
        const v = JSON.parse(st.getItem(KEY) || 'null');
        if (v && v.token && v.exp > Date.now()) return v;
      } catch (e) { /* almacenamiento no disponible */ }
    }
    return null;
  }
  function clear() { try { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); } catch (e) { /* noop */ } }
  function safeNext(n) { return /^[a-z0-9_.-]+\.html$/i.test(n || '') ? n : 'index.html'; }

  const auth = {
    API_BASE,
    session: read(),
    getToken() { return this.session ? this.session.token : null; },
    getUser() { return this.session ? this.session.user : null; },
    can(perm) {
      const u = this.getUser();
      return !!u && (u.role === 'admin' || (u.permissions || []).includes(perm));
    },
    setSession(data, remember) {
      clear();
      const s = { token: data.token, exp: data.expiresAt, user: data.user };
      try { (remember ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(s)); } catch (e) { /* noop */ }
      this.session = s;
    },
    updateUser(user) {
      if (!this.session) return;
      this.session.user = user;
      for (const st of [localStorage, sessionStorage]) {
        try { if (st.getItem(KEY)) st.setItem(KEY, JSON.stringify(this.session)); } catch (e) { /* noop */ }
      }
    },
    logout(reason) {
      clear(); this.session = null;
      const q = reason ? `?m=${encodeURIComponent(reason)}` : '';
      location.replace('login.html' + q);
    },
    /** Exige sesión (y, opcionalmente, un atributo). Muestra la página solo cuando la sesión es válida. */
    requireLogin(opts) {
      opts = opts || {};
      if (!this.session) {
        location.replace('login.html?next=' + encodeURIComponent(safeNext(location.pathname.split('/').pop())));
        return;
      }
      const reveal = () => document.documentElement.classList.remove('cm-auth-pending');
      origFetch(API_BASE + '/auth/me', { headers: { Authorization: 'Bearer ' + this.session.token }, cache: 'no-store' })
        .then(async r => {
          if (r.status === 401) return this.logout('expired');
          if (r.status === 403) { const j = await r.json().catch(() => ({})); if (j.code === 'PASSWORD_CHANGE_REQUIRED') return location.replace('login.html?change=1'); }
          if (!r.ok) return reveal();
          const j = await r.json();
          this.updateUser(j.user);
          if (opts.permission && !this.can(opts.permission)) return location.replace('index.html');
          reveal();
          document.dispatchEvent(new CustomEvent('cm:auth-ready', { detail: j.user }));
        })
        .catch(reveal); // sin conexión: se muestra la página; el servidor seguirá exigiendo sesión
    },
    safeNext
  };
  window.cmAuth = auth;

  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    if (!url.startsWith(API_BASE) || url.startsWith(API_BASE + '/auth/login')) return origFetch(input, init);
    const tok = auth.getToken();
    if (tok) {
      init = init || {};
      const h = new Headers(init.headers || (typeof input !== 'string' && input.headers) || {});
      h.set('Authorization', 'Bearer ' + tok);
      init = Object.assign({}, init, { headers: h });
    }
    return origFetch(input, init).then(res => {
      if (res.status === 401 && tok) auth.logout('expired');
      else if (res.status === 403 && tok) {
        res.clone().json().then(j => { if (j && j.code === 'PASSWORD_CHANGE_REQUIRED') location.replace('login.html?change=1'); }).catch(() => {});
      }
      return res;
    });
  };
})();
