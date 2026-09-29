/**
 * StorageManager.js
 * Sube archivos (imágenes, documentos, videos) directo desde el navegador
 * al bucket de Supabase Storage. El backend NUNCA ve los bytes del archivo,
 * solo guarda la URL pública resultante junto con la nota de avance.
 *
 * Requiere que <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 * esté cargado ANTES de este archivo.
 */
class StorageManager {
    /**
     * @param {string} supabaseUrl - URL de tu proyecto Supabase (ej. https://xxxx.supabase.co)
     * @param {string} supabaseAnonKey - Clave pública "anon" (segura de exponer en frontend)
     * @param {string} bucket - Nombre del bucket de Storage (ej. 'project-attachments')
     */
    constructor(supabaseUrl, supabaseAnonKey, bucket) {
        if (!window.supabase || !window.supabase.createClient) {
            console.error('[StorageManager] El SDK de Supabase no está cargado. Verifica el <script> en index.html.');
        }
        this.client = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
        this.bucket = bucket;
    }

    /**
     * Sube un solo archivo dentro de una carpeta por proyecto.
     * @param {File} file
     * @param {string} projectId
     * @returns {Promise<{url:string, name:string, type:string}>}
     */
    async uploadFile(file, projectId) {
        const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const path = `${projectId}/${Date.now()}_${safeName}`;

        const { error } = await this.client.storage
            .from(this.bucket)
            .upload(path, file, {
                cacheControl: '3600',
                upsert: false,
                contentType: file.type || 'application/octet-stream'
            });

        if (error) {
            throw new Error(`No se pudo subir "${file.name}": ${error.message}`);
        }

        const { data } = this.client.storage.from(this.bucket).getPublicUrl(path);

        return {
            url: data.publicUrl,
            name: file.name,
            type: file.type || ''
        };
    }

    /**
     * Sube varios archivos en secuencia y devuelve el arreglo de referencias.
     * @param {FileList|File[]} fileList
     * @param {string} projectId
     * @returns {Promise<Array<{url:string, name:string, type:string}>>}
     */
    async uploadFiles(fileList, projectId) {
        const files = Array.from(fileList);
        const uploaded = [];
        for (const file of files) {
            uploaded.push(await this.uploadFile(file, projectId));
        }
        return uploaded;
    }
    /**
     * Borra del bucket el objeto al que apunta una URL pública (mejor esfuerzo).
     * Devuelve true si se eliminó; false si la URL no es del bucket o la política de Storage no lo permite.
     * @param {string} publicUrl
     * @returns {Promise<boolean>}
     */
    async removeByUrl(publicUrl) {
        try {
            const marker = `/object/public/${this.bucket}/`;
            const at = String(publicUrl || '').indexOf(marker);
            if (at === -1) return false;
            const path = decodeURIComponent(publicUrl.slice(at + marker.length).split('?')[0]);
            const { data, error } = await this.client.storage.from(this.bucket).remove([path]);
            return !error && Array.isArray(data) && data.length > 0;
        } catch (e) {
            console.warn('[StorageManager] No se pudo borrar del bucket:', e);
            return false;
        }
    }
}
