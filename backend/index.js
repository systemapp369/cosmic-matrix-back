require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de CORS para permitir peticiones desde tu frontend
app.use(cors({
origin: '*',
methods: ['GET', 'POST', 'DELETE', 'PUT', 'OPTIONS'],
allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

const pool = new Pool({
connectionString: process.env.DATABASE_URL,
ssl: { rejectUnauthorized: false }
});

// Función para inicializar automáticamente las tablas en la Base de Datos
async function initDB() {
try {
// 1. Tabla principal de proyectos
await pool.query(CREATE TABLE IF NOT EXISTS projects ( id VARCHAR(50) PRIMARY KEY, name VARCHAR(255) NOT NULL, level VARCHAR(50) NOT NULL, progress INT NOT NULL, lead VARCHAR(100), last_update DATE DEFAULT CURRENT_DATE, selected BOOLEAN DEFAULT TRUE ););

    // 2. Tabla de Avances / Bitácora
    await pool.query(`
      CREATE TABLE IF NOT EXISTS project_updates (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        project_id VARCHAR(50) NOT NULL,
        author VARCHAR(150) NOT NULL DEFAULT 'Sistema',
        content TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_project_updates_project_id ON project_updates(project_id);
    `);

    // 3. Tabla de Archivos Adjuntos a los Avances
    await pool.query(`
      CREATE TABLE IF NOT EXISTS project_update_files (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        update_id UUID NOT NULL REFERENCES project_updates(id) ON DELETE CASCADE,
        file_name VARCHAR(255) NOT NULL,
        file_size VARCHAR(50),
        file_type VARCHAR(100),
        file_url TEXT NOT NULL,
        storage_path TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
      );
    `);

    console.log("Tablas 'projects', 'project_updates' y 'project_update_files' verificadas y listas.");
} catch (err) {
    console.error("Error al inicializar la base de datos:", err.message);
}


}
initDB();

// ==========================================
// 1. RUTAS DE PROYECTOS
// ==========================================

// LISTAR PROYECTOS (GET)
app.get('/api/projects', async (req, res) => {
try {
const result = await pool.query('SELECT id, name, level, progress, lead, last_update AS "lastUpdate", selected FROM projects ORDER BY id ASC');
res.json(result.rows);
} catch (err) {
res.status(500).json({ error: err.message });
}
});

// INSERTAR / ACTUALIZAR PROYECTO (POST)
app.post('/api/projects', async (req, res) => {
const { id, name, level, progress, lead, selected } = req.body;
try {
const query = INSERT INTO projects (id, name, level, progress, lead, selected)  VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id)  DO UPDATE SET name = $2, level = $3, progress = $4, lead = $5, selected = $6 RETURNING *;;
const result = await pool.query(query, [id, name, level, progress, lead, selected ?? true]);
res.json({ success: true, project: result.rows[0] });
} catch (err) {
res.status(500).json({ error: err.message });
}
});

// ELIMINAR PROYECTO (DELETE)
app.delete('/api/projects/:id', async (req, res) => {
const { id } = req.params;
try {
await pool.query('DELETE FROM projects WHERE id = $1', [id]);
res.json({ success: true, message: Nodo ${id} desconectado. });
} catch (err) {
res.status(500).json({ error: err.message });
}
});

// ==========================================
// 2. RUTAS DE BITÁCORA DE AVANCES Y ARCHIVOS
// ==========================================

// OBTENER AVANCES DE UN PROYECTO (GET)
app.get('/api/projects/:projectId/updates', async (req, res) => {
const { projectId } = req.params;
try {
const query = SELECT  u.id,  u.project_id,  u.author,  u.content,  u.created_at, COALESCE( json_agg( json_build_object( 'id', f.id, 'name', f.file_name, 'size', f.file_size, 'type', f.file_type, 'url', f.file_url, 'storage_path', f.storage_path ) ) FILTER (WHERE f.id IS NOT NULL), '[]' ) AS files FROM project_updates u LEFT JOIN project_update_files f ON u.id = f.update_id WHERE u.project_id = $1 GROUP BY u.id ORDER BY u.created_at DESC;;
const { rows } = await pool.query(query, [projectId]);
res.json(rows);
} catch (err) {
console.error('Error al obtener la bitácora:', err);
res.status(500).json({ error: err.message });
}
});

// REGISTRAR UN NUEVO AVANCE CON SUS ARCHIVOS (POST)
app.post('/api/projects/:projectId/updates', async (req, res) => {
const { projectId } = req.params;
const { author, content, files } = req.body;

if (!content && (!files || files.length === 0)) {
    return res.status(400).json({ error: 'El avance debe contener texto o al menos un archivo.' });
}

const client = await pool.connect();
try {
    await client.query('BEGIN');

    // 1. Guardar la nota de avance
    const insertUpdateQuery = `
      INSERT INTO project_updates (project_id, author, content) 
      VALUES ($1, $2, $3) 
      RETURNING *;
    `;
    const updateRes = await client.query(insertUpdateQuery, [projectId, author || 'Sistema', content || '']);
    const newUpdate = updateRes.rows[0];

    // 2. Guardar las referencias de los archivos
    const savedFiles = [];
    if (files && files.length > 0) {
        for (const file of files) {
            const insertFileQuery = `
              INSERT INTO project_update_files (update_id, file_name, file_size, file_type, file_url, storage_path)
              VALUES ($1, $2, $3, $4, $5, $6)
              RETURNING *;
            `;
            const fileRes = await client.query(insertFileQuery, [
                newUpdate.id,
                file.name,
                file.size || '',
                file.type || '',
                file.url,
                file.path || ''
            ]);
            savedFiles.push(fileRes.rows[0]);
        }
    }

    await client.query('COMMIT');

    res.status(201).json({
        ...newUpdate,
        files: savedFiles
    });
} catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al guardar avance:', err);
    res.status(500).json({ error: err.message });
} finally {
    client.release();
}


});

// ELIMINAR UN AVANCE (DELETE)
app.delete('/api/updates/:updateId', async (req, res) => {
const { updateId } = req.params;
try {
await pool.query('DELETE FROM project_updates WHERE id = $1', [updateId]);
res.json({ success: true, message: 'Avance eliminado correctamente.' });
} catch (err) {
console.error('Error al eliminar avance:', err);
res.status(500).json({ error: err.message });
}
});

app.listen(PORT, () => {
console.log(Servidor corriendo en el puerto ${PORT});
});

module.exports = app;