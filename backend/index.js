require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Reemplaza app.use(cors()); con esta configuración completa:
app.use(cors({
    origin: '*', // Permite peticiones desde cualquier origen (tu frontend en Vercel)
    methods: ['GET', 'POST', 'DELETE', 'PUT', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Función para inicializar la base de datos automáticamente
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
        selected BOOLEAN DEFAULT TRUE
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
        // Estas líneas agregan cualquier columna que falte, sin tocar datos existentes.
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
        const result = await pool.query('SELECT id, name, level, progress, lead, last_update AS "lastUpdate", selected FROM projects ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. INSERTAR / ACTUALIZAR PROYECTO (POST)
app.post('/api/projects', async (req, res) => {
    const { id, name, level, progress, lead, selected } = req.body;
    try {
        const query = `
      INSERT INTO projects (id, name, level, progress, lead, selected) 
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) 
      DO UPDATE SET name = $2, level = $3, progress = $4, lead = $5, selected = $6
      RETURNING *;
    `;
        const result = await pool.query(query, [id, name, level, progress, lead, selected ?? true]);
        res.json({ success: true, project: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. ELIMINAR PROYECTO (DELETE)
app.delete('/api/projects/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM projects WHERE id = $1', [id]);
        res.json({ success: true, message: `Nodo ${id} desconectado.` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. LISTAR AVANCES DE UN PROYECTO (GET)
app.get('/api/projects/:id/updates', async (req, res) => {
    const { id } = req.params;
    try {
        const updatesResult = await pool.query(
            'SELECT id, note, created_at AS "createdAt" FROM project_updates WHERE project_id = $1 ORDER BY created_at DESC',
            [id]
        );
        const updates = updatesResult.rows;

        if (updates.length > 0) {
            const updateIds = updates.map(u => u.id);
            const filesResult = await pool.query(
                'SELECT id, update_id AS "updateId", file_url AS "fileUrl", file_name AS "fileName", file_type AS "fileType" FROM project_update_files WHERE update_id = ANY($1::int[])',
                [updateIds]
            );
            const filesByUpdate = {};
            filesResult.rows.forEach(f => {
                if (!filesByUpdate[f.updateId]) filesByUpdate[f.updateId] = [];
                filesByUpdate[f.updateId].push(f);
            });
            updates.forEach(u => { u.files = filesByUpdate[u.id] || []; });
        }

        res.json(updates);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. REGISTRAR UN AVANCE (POST) - la fecha/hora la pone el servidor automáticamente (created_at = NOW())
app.post('/api/projects/:id/updates', async (req, res) => {
    const { id } = req.params;
    const { note, files } = req.body; // files: [{ url, name, type }], ya subidos a Supabase Storage

    if (!note || !note.trim()) {
        return res.status(400).json({ error: 'La nota de avance no puede estar vacía.' });
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
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// 6. ELIMINAR UN AVANCE PUNTUAL (DELETE) - por si el usuario se equivoca al capturar
app.delete('/api/updates/:updateId', async (req, res) => {
    const { updateId } = req.params;
    try {
        await pool.query('DELETE FROM project_updates WHERE id = $1', [updateId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});

module.exports = app;