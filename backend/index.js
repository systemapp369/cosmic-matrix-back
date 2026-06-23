const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
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
        console.log("Tabla 'projects' verificada/creada con éxito.");
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

app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});