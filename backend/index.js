require('dotenv').config();
const express = require('express');
const { Pool, types } = require('pg');

// Las columnas DATE (OID 1082) se devuelven como texto 'AAAA-MM-DD'. Por defecto node-pg las convierte a un Date
// en la zona horaria del servidor (UTC), y al mostrarlas en México (UTC-6) retrocedían un día.
types.setTypeParser(1082, value => value);
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');

// --- CORS: solo los orígenes permitidos (antes era '*') ---
// Se pueden añadir más con la variable de entorno ALLOWED_ORIGINS (separados por coma),
// p. ej. dominios propios o de previsualización de Vercel.
const ALLOWED_ORIGINS = new Set([
    'https://cosmic-matrix-front-iqsf.vercel.app',
    ...(process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim().replace(/\/$/, '')).filter(Boolean)
]);
const isAllowedOrigin = origin =>
    !origin || // peticiones sin origen (curl, servidor a servidor)
    ALLOWED_ORIGINS.has(origin) ||
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin); // desarrollo local

app.use(cors({
    origin: (origin, cb) => cb(null, isAllowedOrigin(origin)),
    methods: ['GET', 'POST', 'DELETE', 'PUT', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600
}));

// --- Cabeceras de seguridad básicas ---
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', 'no-store');
    next();
});

app.use(express.json({ limit: '100kb' }));

// --- Validación y utilidades ---
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const LABEL_RE = /^[\p{L}\p{N} _.-]{1,30}$/u;
// Solo se aceptan URLs https del almacenamiento del proyecto (Supabase). Ampliable con FILE_HOSTS.
const FILE_HOSTS = new Set([
    'owjssvxtzhwqedwigaux.supabase.co',
    ...(process.env.FILE_HOSTS || '').split(',').map(h => h.trim().toLowerCase()).filter(Boolean)
]);

['id', 'updateId', 'fileId'].forEach(name =>
    app.param(name, (req, res, next, value) =>
        ID_RE.test(value) ? next() : res.status(400).json({ error: 'Identificador no válido.' })
    )
);

// Los detalles internos (mensajes de la base de datos) se registran en el servidor, no se envían al cliente.
function serverError(res, err) {
    console.error('[API]', err && err.message ? err.message : err);
    res.status(500).json({ error: 'Error interno del servidor.' });
}

function validateFiles(files) {
    if (!Array.isArray(files) || files.length > 20) return 'Lista de archivos no válida (máximo 20).';
    for (const f of files) {
        if (!f || typeof f.url !== 'string' || f.url.length > 2048) return 'URL de archivo no válida.';
        let u;
        try { u = new URL(f.url); } catch (e) { return 'URL de archivo no válida.'; }
        if (u.protocol !== 'https:' || !FILE_HOSTS.has(u.hostname.toLowerCase())) return 'La URL del archivo no pertenece al almacenamiento permitido.';
        if (f.name != null && (typeof f.name !== 'string' || f.name.length > 255)) return 'Nombre de archivo no válido.';
        if (f.type != null && (typeof f.type !== 'string' || f.type.length > 100)) return 'Tipo de archivo no válido.';
    }
    return null;
}

// Fecha de calendario enviada por el navegador (su "hoy" local). Se acepta solo si es una fecha real y cercana a la actual.
function validDateStr(v) {
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
    const d = new Date(v + 'T00:00:00Z');
    if (isNaN(d) || d.toISOString().slice(0, 10) !== v) return false;
    return Math.abs(d.getTime() - Date.now()) <= 3 * 86400000;
}

function validateProject(b) {
    if (!b || typeof b !== 'object') return 'Datos no válidos.';
    if (typeof b.id !== 'string' || !ID_RE.test(b.id)) return 'ID de proyecto no válido.';
    if (typeof b.name !== 'string' || !b.name.trim() || b.name.length > 255) return 'El nombre es obligatorio (máximo 255 caracteres).';
    if (typeof b.level !== 'string' || !LABEL_RE.test(b.level)) return 'Criticidad no válida.';
    const prog = Number(b.progress);
    if (!Number.isInteger(prog) || prog < 0 || prog > 100) return 'El avance debe ser un entero entre 0 y 100.';
    if (b.lead != null && (typeof b.lead !== 'string' || b.lead.length > 100)) return 'Responsable no válido (máximo 100 caracteres).';
    if (b.description != null && (typeof b.description !== 'string' || b.description.length > 500)) return 'Descripción no válida (máximo 500 caracteres).';
    if (b.status != null && b.status !== '' && (typeof b.status !== 'string' || !LABEL_RE.test(b.status))) return 'Estatus no válido.';
    if (b.selected != null && typeof b.selected !== 'boolean') return 'Valor "selected" no válido.';
    return null;
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Función para inicializar la base de datos automáticamente
// --- MIGRACIÓN: la columna "status" podía existir como ENUM (p. ej. node_status con ONLINE/OFFLINE...),
// lo que rechaza los estatus del formulario (ACTIVO, EN PROGRESO, EN ESPERA, COMPLETADO, CANCELADO).
// Se convierte a VARCHAR conservando los valores existentes. Solo actúa si la columna es un ENUM.
// Se ejecuta al arrancar y, como respaldo, la primera vez que un guardado falla por ese motivo.
async function migrateStatusColumn() {
    await pool.query(`
      DO $$
      DECLARE col_type text;
      BEGIN
        SELECT data_type INTO col_type
        FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'projects' AND column_name = 'status';
        IF col_type = 'USER-DEFINED' THEN
          ALTER TABLE projects ALTER COLUMN status DROP DEFAULT;
          ALTER TABLE projects ALTER COLUMN status TYPE VARCHAR(50) USING status::text;
          UPDATE projects SET status = 'ACTIVO' WHERE status IS NULL;
          ALTER TABLE projects ALTER COLUMN status SET DEFAULT 'ACTIVO';
          ALTER TABLE projects ALTER COLUMN status SET NOT NULL;
        END IF;
      END $$;
    `);
}

async function initDB() {
    try {
        await pool.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        level VARCHAR(50) NOT NULL,
        progress INT NOT NULL,
        lead VARCHAR(100),
        last_update DATE DEFAULT CURRENT_DATE,
        selected BOOLEAN DEFAULT TRUE,
        status VARCHAR(50) NOT NULL DEFAULT 'ACTIVO'
      );
    `);

        // Bitácora de avances/observaciones por proyecto
        await pool.query(`
      CREATE TABLE IF NOT EXISTS project_updates (
        id SERIAL PRIMARY KEY,
        project_id VARCHAR(50) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        note TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

        // Archivos adjuntos a cada avance (ya subidos a Supabase Storage; aquí solo guardamos la referencia)
        await pool.query(`
      CREATE TABLE IF NOT EXISTS project_update_files (
        id SERIAL PRIMARY KEY,
        update_id INTEGER NOT NULL REFERENCES project_updates(id) ON DELETE CASCADE,
        file_url TEXT,
        file_name TEXT,
        file_type TEXT
      );
    `);

        // --- MIGRACIÓN AUTOCURABLE ---
        // Si alguna de estas tablas ya existía en la BD (de un despliegue/prueba anterior)
        // con una estructura distinta o incompleta, CREATE TABLE IF NOT EXISTS la deja intacta.
        // Estas líneas la reconcilian automáticamente, sin tocar datos existentes.

        // Caso detectado: la tabla ya traía una columna "content" (NOT NULL) en vez de "note".
        // Si existe "content" y todavía no existe "note", renombramos para no perder esa columna.
        await pool.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'project_updates' AND column_name = 'content'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'project_updates' AND column_name = 'note'
        ) THEN
          ALTER TABLE project_updates RENAME COLUMN content TO note;
        END IF;
      END $$;
    `);

        // Por si "content" sigue existiendo junto a "note" (o el rename no aplicó por alguna razón),
        // quitamos su restricción NOT NULL para que ya no pueda tumbar los inserts nuevos.
        await pool.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'project_updates' AND column_name = 'content'
        ) THEN
          ALTER TABLE project_updates ALTER COLUMN content DROP NOT NULL;
        END IF;
      END $$;
    `);

        // Catch-all: cualquier otra columna NOT NULL inesperada (heredada de una versión
        // previa que no conocemos) en estas dos tablas se vuelve opcional automáticamente,
        // para que nunca vuelva a tumbar un INSERT nuevo.
        await pool.query(`
      DO $$
      DECLARE
        col RECORD;
      BEGIN
        FOR col IN
          SELECT column_name FROM information_schema.columns
          WHERE table_name = 'project_updates'
            AND is_nullable = 'NO'
            AND column_name NOT IN ('id', 'project_id')
        LOOP
          EXECUTE format('ALTER TABLE project_updates ALTER COLUMN %I DROP NOT NULL', col.column_name);
        END LOOP;

        FOR col IN
          SELECT column_name FROM information_schema.columns
          WHERE table_name = 'project_update_files'
            AND is_nullable = 'NO'
            AND column_name NOT IN ('id', 'update_id')
        LOOP
          EXECUTE format('ALTER TABLE project_update_files ALTER COLUMN %I DROP NOT NULL', col.column_name);
        END LOOP;
      END $$;
    `);

        await pool.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS description TEXT;`);
        await pool.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'ACTIVO';`);

        await migrateStatusColumn();

        // Archivos asociados directamente al proyecto (independientes de la bitácora).
        await pool.query(`
          CREATE TABLE IF NOT EXISTS project_files (
            id SERIAL PRIMARY KEY,
            project_id VARCHAR(50) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            file_url TEXT NOT NULL,
            file_name TEXT,
            file_type TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
          );
        `);

        await pool.query(`ALTER TABLE project_updates ADD COLUMN IF NOT EXISTS project_id VARCHAR(50);`);
        await pool.query(`ALTER TABLE project_updates ADD COLUMN IF NOT EXISTS note TEXT;`);
        await pool.query(`ALTER TABLE project_updates ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();`);

        await pool.query(`ALTER TABLE project_update_files ADD COLUMN IF NOT EXISTS update_id INTEGER;`);
        await pool.query(`ALTER TABLE project_update_files ADD COLUMN IF NOT EXISTS file_url TEXT;`);
        await pool.query(`ALTER TABLE project_update_files ADD COLUMN IF NOT EXISTS file_name TEXT;`);
        await pool.query(`ALTER TABLE project_update_files ADD COLUMN IF NOT EXISTS file_type TEXT;`);

        console.log("Tablas 'projects', 'project_updates' y 'project_update_files' verificadas/creadas/migradas con éxito.");
    } catch (err) {
        console.error("Error al inicializar la base de datos:", err.message);
    }
}
initDB();

// 1. LISTAR PROYECTOS (GET)
app.get('/api/projects', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, name, level, progress, lead, description, status, last_update AS "lastUpdate", selected FROM projects ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        serverError(res, err);
    }
});

// 2. INSERTAR / ACTUALIZAR PROYECTO (POST)
app.post('/api/projects', async (req, res) => {
    const invalid = validateProject(req.body);
    if (invalid) return res.status(400).json({ error: invalid });
    const { id, name, level, progress, lead, description, status, selected } = req.body;
    try {
        const query = `
      INSERT INTO projects (id, name, level, progress, lead, description, status, selected, last_update) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9::date, CURRENT_DATE))
      ON CONFLICT (id) 
      DO UPDATE SET name = $2, level = $3, progress = $4, lead = $5, description = $6, status = $7, selected = $8, last_update = COALESCE($9::date, CURRENT_DATE)
      RETURNING *;
    `;
        const params = [id, name.trim(), level, Number(progress), lead ?? 'UNASSIGNED', description ?? null, status || 'ACTIVO', selected ?? true, validDateStr(req.body.lastUpdate) ? req.body.lastUpdate : null];
        let result;
        try {
            result = await pool.query(query, params);
        } catch (e) {
            // 22P02 = valor no válido para un tipo enum: la columna aún es ENUM -> se migra y se reintenta.
            if (e && e.code === '22P02' && /enum/i.test(e.message || '')) {
                await migrateStatusColumn();
                result = await pool.query(query, params);
            } else {
                throw e;
            }
        }
        res.json({ success: true, project: result.rows[0] });
    } catch (err) {
        serverError(res, err);
    }
});

// 3. ELIMINAR PROYECTO (DELETE)
app.delete('/api/projects/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // URLs de todos los archivos del proyecto y de sus avances, para que el frontend limpie también el Storage.
        const files = await pool.query(
            `SELECT file_url AS "fileUrl" FROM project_files WHERE project_id = $1
             UNION ALL
             SELECT f.file_url FROM project_update_files f
             JOIN project_updates u ON u.id = f.update_id WHERE u.project_id = $1`,
            [id]
        );
        // Los avances y archivos asociados se eliminan en cascada (ON DELETE CASCADE).
        const result = await pool.query('DELETE FROM projects WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'El proyecto no existe.' });
        }
        res.json({ success: true, message: `Nodo ${id} desconectado.`, files: files.rows });
    } catch (err) {
        serverError(res, err);
    }
});

// 4. ARCHIVOS DIRECTOS DEL PROYECTO (GET)
app.get('/api/projects/:id/files', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, file_url AS "fileUrl", file_name AS "fileName", file_type AS "fileType", created_at AS "createdAt" FROM project_files WHERE project_id = $1 ORDER BY created_at DESC',
            [req.params.id]
        );
        res.json(result.rows);
    } catch (err) {
        serverError(res, err);
    }
});

// 5. REGISTRAR ARCHIVOS DIRECTOS DEL PROYECTO (POST)
app.post('/api/projects/:id/files', async (req, res) => {
    const { files } = req.body;
    if (!Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ error: 'No se recibieron archivos.' });
    }
    const badFiles = validateFiles(files);
    if (badFiles) return res.status(400).json({ error: badFiles });
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const saved = [];
        for (const f of files) {
            const result = await client.query(
                'INSERT INTO project_files (project_id, file_url, file_name, file_type) VALUES ($1, $2, $3, $4) RETURNING id, file_url AS "fileUrl", file_name AS "fileName", file_type AS "fileType", created_at AS "createdAt"',
                [req.params.id, f.url, f.name || null, f.type || null]
            );
            saved.push(result.rows[0]);
        }
        await client.query('COMMIT');
        res.json({ success: true, files: saved });
    } catch (err) {
        await client.query('ROLLBACK');
        serverError(res, err);
    } finally {
        client.release();
    }
});

// 5b. QUITAR UN ARCHIVO DIRECTO DEL PROYECTO (DELETE)
// Devuelve la fila eliminada (incluye fileUrl) para que el frontend pueda borrar también el objeto en Storage.
app.delete('/api/projects/:id/files/:fileId', async (req, res) => {
    try {
        const result = await pool.query(
            'DELETE FROM project_files WHERE id = $1 AND project_id = $2 RETURNING id, file_url AS "fileUrl", file_name AS "fileName", file_type AS "fileType"',
            [req.params.fileId, req.params.id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'El archivo no existe o no pertenece a este proyecto.' });
        }
        res.json({ success: true, file: result.rows[0] });
    } catch (err) {
        serverError(res, err);
    }
});

// 6. LISTAR AVANCES DE UN PROYECTO (GET)
app.get('/api/projects/:id/updates', async (req, res) => {
    const { id } = req.params;
    try {
        const updatesResult = await pool.query(
            'SELECT id, note, created_at AS "createdAt" FROM project_updates WHERE project_id = $1 ORDER BY created_at DESC',
            [id]
        );
        const updates = updatesResult.rows;

        if (updates.length > 0) {
            // Se usa un JOIN en vez de "= ANY($1::int[])" para no depender del tipo real
            // de la columna id/update_id (en esta BD son UUID, no enteros).
            const filesResult = await pool.query(
                `SELECT f.id, f.update_id AS "updateId", f.file_url AS "fileUrl", f.file_name AS "fileName", f.file_type AS "fileType"
                 FROM project_update_files f
                 INNER JOIN project_updates u ON f.update_id = u.id
                 WHERE u.project_id = $1
                 ORDER BY f.id`,
                [id]
            );
            const filesByUpdate = {};
            filesResult.rows.forEach(f => {
                const key = String(f.updateId);
                if (!filesByUpdate[key]) filesByUpdate[key] = [];
                filesByUpdate[key].push(f);
            });
            updates.forEach(u => { u.files = filesByUpdate[String(u.id)] || []; });
        }

        res.json(updates);
    } catch (err) {
        serverError(res, err);
    }
});

// 7. REGISTRAR UN AVANCE (POST) - la fecha/hora la pone el servidor automáticamente (created_at = NOW())
app.post('/api/projects/:id/updates', async (req, res) => {
    const { id } = req.params;
    const { note, files } = req.body; // files: [{ url, name, type }], ya subidos a Supabase Storage

    if (typeof note !== 'string' || !note.trim()) {
        return res.status(400).json({ error: 'La nota de avance no puede estar vacía.' });
    }
    if (note.length > 5000) {
        return res.status(400).json({ error: 'La nota es demasiado larga (máximo 5000 caracteres).' });
    }
    if (files != null) {
        const badFiles = validateFiles(files);
        if (badFiles) return res.status(400).json({ error: badFiles });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const updateResult = await client.query(
            'INSERT INTO project_updates (project_id, note) VALUES ($1, $2) RETURNING id, note, created_at AS "createdAt"',
            [id, note.trim()]
        );
        const newUpdate = updateResult.rows[0];
        newUpdate.files = [];

        if (Array.isArray(files) && files.length > 0) {
            for (const f of files) {
                const fileResult = await client.query(
                    'INSERT INTO project_update_files (update_id, file_url, file_name, file_type) VALUES ($1, $2, $3, $4) RETURNING id, file_url AS "fileUrl", file_name AS "fileName", file_type AS "fileType"',
                    [newUpdate.id, f.url, f.name || null, f.type || null]
                );
                newUpdate.files.push(fileResult.rows[0]);
            }
        }

        await client.query('COMMIT');
        res.json({ success: true, update: newUpdate });
    } catch (err) {
        await client.query('ROLLBACK');
        serverError(res, err);
    } finally {
        client.release();
    }
});

// 8. ELIMINAR UN AVANCE PUNTUAL (DELETE) - por si el usuario se equivoca o duplica un registro
// Devuelve los archivos que tenía para que el frontend pueda limpiar también el Storage.
app.delete('/api/updates/:updateId', async (req, res) => {
    const { updateId } = req.params;
    try {
        const files = await pool.query(
            'SELECT id, file_url AS "fileUrl", file_name AS "fileName" FROM project_update_files WHERE update_id = $1',
            [updateId]
        );
        const result = await pool.query('DELETE FROM project_updates WHERE id = $1', [updateId]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'El avance no existe.' });
        }
        res.json({ success: true, files: files.rows });
    } catch (err) {
        serverError(res, err);
    }
});

// 9. QUITAR UN ARCHIVO DE UN AVANCE (DELETE) - deja el avance y solo desvincula ese archivo
app.delete('/api/updates/:updateId/files/:fileId', async (req, res) => {
    try {
        const result = await pool.query(
            'DELETE FROM project_update_files WHERE id = $1 AND update_id = $2 RETURNING id, file_url AS "fileUrl", file_name AS "fileName", file_type AS "fileType"',
            [req.params.fileId, req.params.updateId]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'El archivo no existe o no pertenece a este avance.' });
        }
        res.json({ success: true, file: result.rows[0] });
    } catch (err) {
        serverError(res, err);
    }
});

// Manejador final de errores (cuerpos inválidos o demasiado grandes, JSON mal formado, etc.)
app.use((err, req, res, next) => {
    const status = err && err.status >= 400 && err.status < 500 ? err.status : 500;
    if (status === 500) console.error('[API]', err && err.message ? err.message : err);
    res.status(status).json({ error: status === 500 ? 'Error interno del servidor.' : 'Solicitud no válida.' });
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});

module.exports = app;