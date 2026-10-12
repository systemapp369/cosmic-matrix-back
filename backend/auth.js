'use strict';
/**
 * auth.js — Autenticación, roles/atributos y administración de usuarios.
 * - Contraseñas: scrypt (módulo nativo 'crypto', sin dependencias externas).
 * - Sesión: token firmado HS256 (formato JWT) enviado en "Authorization: Bearer ...".
 * - Cada petición se valida contra la base (usuario activo + atributos vigentes), por lo que
 *   desactivar a un usuario o quitarle un atributo surte efecto de inmediato.
 * - Tabla `app_users` en la base de datos de Supabase (con RLS activado: no es accesible con la clave pública).
 */
const crypto = require('crypto');
const { promisify } = require('util');
const scrypt = promisify(crypto.scrypt);

/* ----------------------------- Atributos y roles ----------------------------- */
const PERMISSIONS = ['ver', 'crear', 'editar', 'eliminar', 'exportar', 'usuarios'];
const ROLES = ['admin', 'editor', 'viewer'];
const ROLE_PRESETS = {
    admin: [...PERMISSIONS],
    editor: ['ver', 'crear', 'editar', 'exportar'],
    viewer: ['ver', 'exportar']
};

/* ------------------------------- Contraseñas -------------------------------- */
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64, maxmem: 64 * 1024 * 1024 };

async function hashPassword(password) {
    const salt = crypto.randomBytes(16);
    const h = await scrypt(password, salt, SCRYPT.keylen, SCRYPT);
    return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${h.toString('base64')}`;
}

async function verifyPassword(password, stored) {
    try {
        const [alg, N, r, p, s, h] = String(stored).split('$');
        if (alg !== 'scrypt') return false;
        const expected = Buffer.from(h, 'base64');
        const got = await scrypt(password, Buffer.from(s, 'base64'), expected.length, { N: +N, r: +r, p: +p, maxmem: SCRYPT.maxmem });
        return got.length === expected.length && crypto.timingSafeEqual(got, expected);
    } catch (e) { return false; }
}

/* ---------------------------------- Tokens ---------------------------------- */
const SECRET = process.env.JWT_SECRET ||
    crypto.createHash('sha256').update('cm-auth-v1:' + (process.env.DATABASE_URL || 'dev')).digest('hex');
if (!process.env.JWT_SECRET) {
    console.warn('[AUTH] JWT_SECRET no está definido: se deriva de DATABASE_URL. Se recomienda definir JWT_SECRET en las variables de entorno.');
}
const b64u = v => Buffer.from(v).toString('base64url');

function signToken(payload) {
    const head = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const body = b64u(JSON.stringify(payload));
    const sig = crypto.createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url');
    return `${head}.${body}.${sig}`;
}

function verifyToken(token) {
    if (typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    try {
        if (JSON.parse(Buffer.from(parts[0], 'base64url').toString()).alg !== 'HS256') return null;
        const expected = crypto.createHmac('sha256', SECRET).update(`${parts[0]}.${parts[1]}`).digest();
        const got = Buffer.from(parts[2], 'base64url');
        if (got.length !== expected.length || !crypto.timingSafeEqual(got, expected)) return null;
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
        if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
        return payload;
    } catch (e) { return null; }
}

/* Versión de contraseña: al cambiarla se invalidan los tokens anteriores. */
const pwVersion = hash => crypto.createHash('sha256').update(String(hash)).digest('hex').slice(0, 12);

/* --------------------------- Usuarios iniciales (hash) ------------------------ */
// Solo se guardan los HASH de las contraseñas iniciales; todos deben cambiarla en su primer ingreso.
const SEED_USERS = [
    { username: "admin", name: "Administrador", role: "admin", hash: "scrypt$16384$8$1$f7egjjle4ejcaCcz1MqDWg==$sFgIiS9+ahpMGnThnonz7wGXUTjOBhCxin5MSJQigtnTYrRP4RKf3vbxw2WeMje90tpukjEHgczBngpP9D7UHQ==" },
    { username: "editor1", name: "Editor 1", role: "editor", hash: "scrypt$16384$8$1$vJYbV3YvbF5dS7gKdTfhAQ==$Mm0z5WvzX0M5n9JiVESSuvqjQ/5k95+Nr0KypyvAAvDXT83DD3qZ6WPBN+Wemn1C2c2a3AaDHbmTdO1+3hCMGw==" },
    { username: "editor2", name: "Editor 2", role: "editor", hash: "scrypt$16384$8$1$YcOL/VHNkxx4p8Szew7BPQ==$75IYyI7Ix9OGFjzAUoPrheuPu7jmQL/gYjX7h9SZro3HFIJR5nuiUwUPvXgiTKA0dJZFBaBGI20A15SiNdhohw==" },
    { username: "consulta", name: "Consulta", role: "viewer", hash: "scrypt$16384$8$1$qb+Iwu2kZLVJTbOZCoHqbA==$1QW2pa6WzBVn9c6buhnZngnUgvxvEW4XA/xy48OtXm4O0yl9yyKJZ6DWTE1+NA4eltZCdAiLt1AeYJu07oi0PQ==" }
];

/* ---------------------------------- Setup ----------------------------------- */
function setupAuth(app, pool, serverError) {
    const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;
    const DUMMY_HASH = 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(64).toString('base64');

    const effectivePerms = u => u.role === 'admin' ? [...PERMISSIONS] : [...new Set(['ver', ...(u.permissions || []).filter(p => PERMISSIONS.includes(p))])];
    const has = (u, perm) => !!u && effectivePerms(u).includes(perm);
    const publicUser = u => ({
        id: u.id, username: u.username, name: u.name, role: u.role,
        permissions: effectivePerms(u), active: u.active,
        mustChangePassword: u.must_change_password,
        lastLoginAt: u.last_login_at, createdAt: u.created_at
    });

    /* ---- caché breve de usuarios (10 s) ---- */
    const cache = new Map();
    const CACHE_MS = 10000;
    async function loadUser(id) {
        const c = cache.get(id);
        if (c && Date.now() - c.t < CACHE_MS) return c.u;
        const r = await pool.query('SELECT * FROM app_users WHERE id = $1', [id]);
        const u = r.rows[0] || null;
        cache.set(id, { u, t: Date.now() });
        return u;
    }
    const forget = id => cache.delete(id);

    /* ---- límite de intentos de login (por IP + usuario) ---- */
    const attempts = new Map();
    const MAX_FAILS = 5, LOCK_MS = 5 * 60 * 1000;
    function lockLeft(key) {
        const a = attempts.get(key);
        return a && a.lockUntil && a.lockUntil > Date.now() ? Math.ceil((a.lockUntil - Date.now()) / 1000) : 0;
    }
    function fail(key) {
        const a = attempts.get(key) || { n: 0, lockUntil: 0 };
        a.n += 1;
        if (a.n >= MAX_FAILS) { a.lockUntil = Date.now() + LOCK_MS; a.n = 0; }
        attempts.set(key, a);
        if (attempts.size > 5000) attempts.clear();
    }

    function issue(user, remember) {
        const ttl = remember ? 7 * 24 * 3600 : 12 * 3600;
        const exp = Math.floor(Date.now() / 1000) + ttl;
        return { token: signToken({ sub: user.id, pv: pwVersion(user.password_hash), exp }), expiresAt: exp * 1000 };
    }

    /* ---------------------------- BD: tablas y semilla ---------------------------- */
    async function initAuthDB() {
        try {
            await pool.query(`
              CREATE TABLE IF NOT EXISTS app_users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                username VARCHAR(32) NOT NULL UNIQUE,
                name VARCHAR(100) NOT NULL,
                password_hash TEXT NOT NULL,
                role VARCHAR(20) NOT NULL DEFAULT 'viewer',
                permissions TEXT[] NOT NULL DEFAULT '{ver}',
                active BOOLEAN NOT NULL DEFAULT TRUE,
                must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
                last_login_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
              );`);
            // Seguridad: ninguna de estas tablas debe ser accesible con la clave pública de Supabase (API REST).
            // El backend se conecta directamente a Postgres, por lo que no se ve afectado por RLS.
            await pool.query(`
              DO $$
              DECLARE t text;
              BEGIN
                FOREACH t IN ARRAY ARRAY['app_users','projects','project_updates','project_update_files','project_files'] LOOP
                  IF to_regclass('public.' || t) IS NOT NULL THEN
                    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
                    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
                      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', t);
                    END IF;
                    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
                      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated', t);
                    END IF;
                  END IF;
                END LOOP;
              END $$;`);
            const n = await pool.query('SELECT count(*)::int AS n FROM app_users');
            if (n.rows[0].n === 0) {
                for (const u of SEED_USERS) {
                    await pool.query(
                        `INSERT INTO app_users (username, name, password_hash, role, permissions, must_change_password)
                         VALUES ($1,$2,$3,$4,$5,TRUE) ON CONFLICT (username) DO NOTHING`,
                        [u.username, u.name, u.hash, u.role, ROLE_PRESETS[u.role]]
                    );
                }
                console.log('[AUTH] Usuarios iniciales creados (admin, editor1, editor2, consulta). Deben cambiar su contraseña al ingresar.');
            }
            console.log("[AUTH] Tabla 'app_users' verificada.");
        } catch (err) {
            console.error('[AUTH] Error al inicializar usuarios:', err.message);
        }
    }

    /* ------------------------------ Rutas públicas ------------------------------ */
    app.post('/api/auth/login', async (req, res) => {
        try {
            const username = String(req.body && req.body.username || '').trim().toLowerCase();
            const password = String(req.body && req.body.password || '');
            if (!username || !password || username.length > 64 || password.length > 200) {
                return res.status(400).json({ error: 'Escribe tu usuario y contraseña.' });
            }
            const key = `${req.ip}|${username}`;
            const wait = lockLeft(key);
            if (wait) {
                res.setHeader('Retry-After', String(wait));
                return res.status(429).json({ error: `Demasiados intentos. Espera ${Math.ceil(wait / 60)} min e inténtalo de nuevo.` });
            }
            const r = await pool.query('SELECT * FROM app_users WHERE username = $1', [username]);
            const user = r.rows[0];
            // Siempre se calcula el hash (aunque el usuario no exista) para no revelar su existencia por el tiempo de respuesta.
            const ok = await verifyPassword(password, user ? user.password_hash : DUMMY_HASH);
            if (!user || !ok) {
                fail(key);
                return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
            }
            if (!user.active) {
                return res.status(403).json({ error: 'Tu cuenta está desactivada. Contacta al administrador.' });
            }
            attempts.delete(key);
            await pool.query('UPDATE app_users SET last_login_at = NOW() WHERE id = $1', [user.id]);
            forget(user.id);
            const s = issue(user, !!req.body.remember);
            res.json({ ...s, user: publicUser(user), mustChangePassword: user.must_change_password });
        } catch (err) { serverError(res, err); }
    });

    /* --------------- Desde aquí TODAS las rutas /api exigen sesión --------------- */
    const OPEN_WHEN_MUST_CHANGE = new Set(['/auth/me', '/auth/change-password']);

    async function authenticate(req, res, next) {
        try {
            const h = req.headers.authorization || '';
            const payload = h.startsWith('Bearer ') ? verifyToken(h.slice(7).trim()) : null;
            if (!payload) return res.status(401).json({ error: 'Sesión no válida o expirada.', code: 'UNAUTHENTICATED' });
            const user = await loadUser(payload.sub);
            if (!user || !user.active || pwVersion(user.password_hash) !== payload.pv) {
                return res.status(401).json({ error: 'Sesión no válida o expirada.', code: 'UNAUTHENTICATED' });
            }
            req.user = user;
            if (user.must_change_password && !OPEN_WHEN_MUST_CHANGE.has(req.path)) {
                return res.status(403).json({ error: 'Debes cambiar tu contraseña antes de continuar.', code: 'PASSWORD_CHANGE_REQUIRED' });
            }
            next();
        } catch (err) { serverError(res, err); }
    }
    app.use('/api', authenticate);

    const requirePerm = perm => (req, res, next) =>
        has(req.user, perm) ? next() : res.status(403).json({ error: 'No tienes permiso para realizar esta acción.', code: 'FORBIDDEN' });

    app.get('/api/auth/me', (req, res) => res.json({ user: publicUser(req.user) }));

    app.post('/api/auth/change-password', async (req, res) => {
        try {
            const current = String(req.body && req.body.currentPassword || '');
            const next = String(req.body && req.body.newPassword || '');
            if (next.length < 10 || next.length > 200) return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 10 caracteres.' });
            if (next.toLowerCase() === req.user.username) return res.status(400).json({ error: 'La contraseña no puede ser igual al usuario.' });
            if (!(await verifyPassword(current, req.user.password_hash))) return res.status(400).json({ error: 'La contraseña actual no es correcta.' });
            if (current === next) return res.status(400).json({ error: 'La nueva contraseña debe ser distinta a la actual.' });
            const hash = await hashPassword(next);
            const r = await pool.query(
                'UPDATE app_users SET password_hash = $1, must_change_password = FALSE, updated_at = NOW() WHERE id = $2 RETURNING *',
                [hash, req.user.id]
            );
            forget(req.user.id);
            const s = issue(r.rows[0], false);
            res.json({ success: true, ...s, user: publicUser(r.rows[0]) });
        } catch (err) { serverError(res, err); }
    });

    /* ----------------------- Administración de usuarios ----------------------- */
    const admin = requirePerm('usuarios');
    const activeAdmins = async (excludeId) =>
        (await pool.query(`SELECT count(*)::int AS n FROM app_users WHERE role = 'admin' AND active = TRUE AND id <> $1`, [excludeId || '00000000-0000-0000-0000-000000000000'])).rows[0].n;

    function cleanPerms(role, perms) {
        if (role === 'admin') return [...PERMISSIONS];
        const list = Array.isArray(perms) ? perms : ROLE_PRESETS[role];
        return [...new Set(['ver', ...list.filter(p => PERMISSIONS.includes(p))])];
    }

    function validateUser(b, creating) {
        if (!b || typeof b !== 'object') return 'Datos no válidos.';
        if (creating || b.username !== undefined) {
            if (typeof b.username !== 'string' || !USERNAME_RE.test(b.username.trim().toLowerCase())) return 'Usuario no válido (3-32 caracteres: letras, números, punto, guion o guion bajo).';
        }
        if (creating || b.name !== undefined) {
            if (typeof b.name !== 'string' || !b.name.trim() || b.name.length > 100) return 'El nombre es obligatorio (máximo 100 caracteres).';
        }
        if (creating || b.role !== undefined) {
            if (!ROLES.includes(b.role)) return 'Rol no válido.';
        }
        if (b.permissions !== undefined && (!Array.isArray(b.permissions) || b.permissions.some(p => !PERMISSIONS.includes(p)))) return 'Atributos no válidos.';
        if (b.active !== undefined && typeof b.active !== 'boolean') return 'Estado no válido.';
        if (creating || (b.password !== undefined && b.password !== '')) {
            if (typeof b.password !== 'string' || b.password.length < 10 || b.password.length > 200) return 'La contraseña debe tener al menos 10 caracteres.';
        }
        return null;
    }

    app.get('/api/users', admin, async (req, res) => {
        try {
            const r = await pool.query('SELECT * FROM app_users ORDER BY created_at ASC, username ASC');
            res.json(r.rows.map(publicUser));
        } catch (err) { serverError(res, err); }
    });

    app.post('/api/users', admin, async (req, res) => {
        const bad = validateUser(req.body, true);
        if (bad) return res.status(400).json({ error: bad });
        try {
            const b = req.body, role = b.role;
            const hash = await hashPassword(b.password);
            const r = await pool.query(
                `INSERT INTO app_users (username, name, password_hash, role, permissions, active, must_change_password)
                 VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
                [b.username.trim().toLowerCase(), b.name.trim(), hash, role, cleanPerms(role, b.permissions), b.active !== false, b.mustChange !== false]
            );
            res.status(201).json({ success: true, user: publicUser(r.rows[0]) });
        } catch (err) {
            if (err && err.code === '23505') return res.status(409).json({ error: 'Ese nombre de usuario ya existe.' });
            serverError(res, err);
        }
    });

    app.put('/api/users/:id', admin, async (req, res) => {
        const bad = validateUser(req.body, false);
        if (bad) return res.status(400).json({ error: bad });
        try {
            const cur = (await pool.query('SELECT * FROM app_users WHERE id = $1', [req.params.id])).rows[0];
            if (!cur) return res.status(404).json({ error: 'El usuario no existe.' });
            const b = req.body, self = cur.id === req.user.id;
            const role = b.role !== undefined ? b.role : cur.role;
            const active = b.active !== undefined ? b.active : cur.active;
            if (self && (role !== cur.role || active === false)) {
                return res.status(409).json({ error: 'No puedes cambiar tu propio rol ni desactivar tu propia cuenta.' });
            }
            if (cur.role === 'admin' && cur.active && (role !== 'admin' || active === false) && (await activeAdmins(cur.id)) === 0) {
                return res.status(409).json({ error: 'Debe existir al menos un administrador activo.' });
            }
            let perms = cleanPerms(role, b.permissions !== undefined ? b.permissions : (b.role !== undefined && b.role !== cur.role ? undefined : cur.permissions));
            const sets = ['name = $1', 'role = $2', 'permissions = $3', 'active = $4', 'updated_at = NOW()'];
            const vals = [b.name !== undefined ? b.name.trim() : cur.name, role, perms, active];
            if (b.username !== undefined) { vals.push(b.username.trim().toLowerCase()); sets.push(`username = $${vals.length}`); }
            if (b.password) {
                vals.push(await hashPassword(b.password)); sets.push(`password_hash = $${vals.length}`);
                vals.push(b.mustChange !== false); sets.push(`must_change_password = $${vals.length}`);
            }
            vals.push(req.params.id);
            const r = await pool.query(`UPDATE app_users SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`, vals);
            forget(cur.id);
            res.json({ success: true, user: publicUser(r.rows[0]) });
        } catch (err) {
            if (err && err.code === '23505') return res.status(409).json({ error: 'Ese nombre de usuario ya existe.' });
            serverError(res, err);
        }
    });

    app.delete('/api/users/:id', admin, async (req, res) => {
        try {
            const cur = (await pool.query('SELECT * FROM app_users WHERE id = $1', [req.params.id])).rows[0];
            if (!cur) return res.status(404).json({ error: 'El usuario no existe.' });
            if (cur.id === req.user.id) return res.status(409).json({ error: 'No puedes eliminar tu propia cuenta.' });
            if (cur.role === 'admin' && cur.active && (await activeAdmins(cur.id)) === 0) {
                return res.status(409).json({ error: 'Debe existir al menos un administrador activo.' });
            }
            await pool.query('DELETE FROM app_users WHERE id = $1', [cur.id]);
            forget(cur.id);
            res.json({ success: true });
        } catch (err) { serverError(res, err); }
    });

    return { requirePerm, has, initAuthDB, PERMISSIONS, ROLE_PRESETS };
}

module.exports = { setupAuth, hashPassword, verifyPassword, signToken, verifyToken, PERMISSIONS, ROLE_PRESETS };
