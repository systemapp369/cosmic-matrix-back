/**
 * Gauge3D.js
 * Gauges EN 3D real (geometría, no un truco visual 2D) para cada tarjeta de
 * proyecto, sin crear un WebGLRenderer por tarjeta (los navegadores limitan
 * el número de contextos WebGL simultáneos). En su lugar, usa UN SOLO canvas
 * fijo que cubre toda la pantalla, y en cada frame:
 *   1. Ubica el rectángulo en pantalla de cada contenedor "gauge-<id>"
 *   2. Recorta el dibujo a esa región exacta (scissor + viewport)
 *   3. Dibuja ahí un anillo 3D (torus) con el arco de progreso coloreado
 *      según la criticidad del proyecto
 * El resto del canvas queda completamente transparente, así que no tapa el
 * resto de la interfaz (además pointer-events:none deja pasar los clics).
 *
 * Requiere que <script src=".../three.min.js"></script> esté cargado antes.
 */
class Gauge3D {
    constructor() {
        this.gauges = new Map(); // elementId -> { percent, colorHex }
        this._arcCache = new Map();

        this.canvas = document.createElement('canvas');
        this.canvas.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:5;';
        document.body.appendChild(this.canvas);

        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.setScissorTest(true);
        this.renderer.setClearColor(0x000000, 0);

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 20);
        this.camera.position.set(0, 2.3, 3.6);
        this.camera.lookAt(0, 0, 0);

        this.scene.add(new THREE.AmbientLight(0xffffff, 0.75));
        this.pointLight = new THREE.PointLight(0xffffff, 1.6, 30);
        this.pointLight.position.set(2, 3, 4);
        this.scene.add(this.pointLight);

        this.ringGroup = new THREE.Group();
        this.ringGroup.rotation.x = Math.PI / 2.5;
        this.scene.add(this.ringGroup);

        // Pista de fondo (track) del anillo
        this.trackMesh = new THREE.Mesh(
            new THREE.TorusGeometry(1, 0.085, 16, 72),
            new THREE.MeshStandardMaterial({ color: 0x2a3549, transparent: true, opacity: 0.55, roughness: 0.6, metalness: 0.3 })
        );
        this.ringGroup.add(this.trackMesh);

        // Arco de progreso (geometría real, no relleno CSS)
        this.progressMesh = new THREE.Mesh(
            new THREE.TorusGeometry(1, 0.105, 16, 72, 0.001),
            new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x22d3ee, emissiveIntensity: 0.85, roughness: 0.3, metalness: 0.5 })
        );
        this.ringGroup.add(this.progressMesh);

        // Marcas tipo carátula alrededor del anillo
        const tickMat = new THREE.MeshBasicMaterial({ color: 0x64748b });
        for (let i = 0; i < 24; i++) {
            const tick = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.14, 0.018), tickMat);
            const a = (i / 24) * Math.PI * 2;
            tick.position.set(Math.cos(a) * 1.24, Math.sin(a) * 1.24, 0);
            tick.rotation.z = a;
            this.ringGroup.add(tick);
        }

        // Disco de fondo sutil, para dar profundidad detrás del anillo
        this.backDisc = new THREE.Mesh(
            new THREE.CircleGeometry(1.1, 48),
            new THREE.MeshBasicMaterial({ color: 0x0b1830, transparent: true, opacity: 0.35 })
        );
        this.backDisc.position.z = -0.05;
        this.ringGroup.add(this.backDisc);

        this.time = 0;
        this._animate = this._animate.bind(this);
        requestAnimationFrame(this._animate);

        window.addEventListener('resize', () => this._resize());
        this._resize();
    }

    _resize() {
        this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    }

    /**
     * Registra/actualiza el gauge de un elemento del DOM.
     * @param {string} elementId - id del div contenedor (ej. 'gauge-NODE-001')
     * @param {number} percent - 0 a 100
     * @param {string} colorHex - color de criticidad del proyecto
     */
    register(elementId, percent, colorHex) {
        this.gauges.set(elementId, { percent, colorHex });
    }

    /**
     * Elimina del set activo cualquier gauge que ya no esté en la página
     * actual (ej. tras cambiar de página o filtrar proyectos).
     */
    pruneTo(activeIds) {
        for (const key of this.gauges.keys()) {
            if (!activeIds.includes(key)) this.gauges.delete(key);
        }
    }

    _getArcGeometry(percent) {
        const key = Math.max(0, Math.min(100, Math.round(percent)));
        if (!this._arcCache.has(key)) {
            const arc = Math.max(0.001, (key / 100) * Math.PI * 2 - 0.001);
            this._arcCache.set(key, new THREE.TorusGeometry(1, 0.105, 16, 72, arc));
        }
        return this._arcCache.get(key);
    }

    _animate(ts) {
        requestAnimationFrame(this._animate);
        this.time = ts * 0.001;

        const canvasHeight = this.renderer.domElement.clientHeight;
        const pr = this.renderer.getPixelRatio();
        this.renderer.clear();

        if (this.gauges.size === 0) return;

        this.gauges.forEach((g, elementId) => {
            const el = document.getElementById(elementId);
            if (!el) return;

            const rect = el.getBoundingClientRect();
            if (rect.width < 2 || rect.bottom < 0 || rect.top > window.innerHeight) return;

            const x = Math.round(rect.left * pr);
            const y = Math.round((canvasHeight - rect.bottom) * pr);
            const w = Math.round(rect.width * pr);
            const h = Math.round(rect.height * pr);
            if (w <= 0 || h <= 0) return;

            this.renderer.setScissor(x, y, w, h);
            this.renderer.setViewport(x, y, w, h);
            this.camera.aspect = rect.width / rect.height;
            this.camera.updateProjectionMatrix();

            this.progressMesh.geometry = this._getArcGeometry(g.percent);
            this.progressMesh.material.color.set(g.colorHex);
            this.progressMesh.material.emissive.set(g.colorHex);
            this.pointLight.color.set(g.colorHex);

            // Ligera rotación continua para reforzar la sensación "3D viva"
            this.ringGroup.rotation.z = this.time * 0.12;

            this.renderer.render(this.scene, this.camera);
        });
    }
}
