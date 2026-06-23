/**
 * FetchManager.js
 * Clase encargada exclusivamente de la comunicación HTTP con el backend de Render.
 * Maneja el token (si lo hubiera en el futuro), los headers y las excepciones.
 */
class FetchManager {
    /**
     * @param {string} baseUrl - La URL base de tu Web Service en Render (ej. 'https://tu-app.onrender.com')
     */
    constructor(baseUrl) {
        // Asegurar que la URL base termine con /api para comodidad
        this.baseUrl = `${baseUrl.replace(/\/$/, '')}/api`;

        // Headers por defecto (CORS y JSON siempre activados)
        this.headers = {
            'Content-Type': 'application/json'
            // 'Authorization': 'Bearer ' + localStorage.getItem('token') // Opcional futuro
        };
    }

    /**
     * Método genérico y privado para realizar peticiones fetch controladas.
     */
    async _request(endpoint, options = {}) {
        const url = `${this.baseUrl}/${endpoint.replace(/^\//, '')}`;

        // Unir headers base con los específicos de la petición
        const config = {
            ...options,
            headers: {
                ...this.headers,
                ...(options.headers || {})
            }
        };

        try {
            const response = await fetch(url, config);

            // Manejo estricto de errores HTTP (404, 500, etc.)
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw {
                    status: response.status,
                    message: errorData.error || `Error en servidor (${response.statusText})`,
                    originalError: errorData
                };
            }

            // Si la respuesta es exitosa pero vacía (ej. 204 No Content), devolver null
            if (response.status === 204) return null;

            // Devolver los datos parseados a JSON
            return await response.json();

        } catch (err) {
            // Re-lanzar el error enriquecido para que la UI lo maneje
            console.error(`FetchManager [${config.method || 'GET'}] ${url} failed:`, err);
            throw err;
        }
    }

    // --- MÉTODOS PÚBLICOS ESPECÍFICOS DEL DOMINIO 'PROJECTS' ---

    /**
     * Obtiene todos los proyectos mapeados.
     * @returns {Promise<Array>}
     */
    async getAllProjects() {
        return await this._request('projects');
    }

    /**
     * Inserta o Actualiza un proyecto (Upsert).
     * El backend decide basándose en el ID.
     * @param {Object} projectData - Datos completos del nodo.
     * @returns {Promise<Object>}
     */
    async upsertProject(projectData) {
        return await this._request('projects', {
            method: 'POST',
            body: JSON.stringify(projectData)
        });
    }

    /**
     * Elimina físicamente un proyecto del clúster central.
     * @param {string} projectId - El ID (ej. 'NODE-001').
     * @returns {Promise<Object>}
     */
    async deleteProject(projectId) {
        // Asumiendo que el backend soporta DELETE /api/projects/:id
        return await this._request(`projects/${projectId}`, {
            method: 'DELETE'
        });
    }
}