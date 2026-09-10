/**
 * CommandHub3D.js
 * Panel central del "Centro de Mando" — interpretación libre e inspirada en
 * dashboards tipo consola de mando: una base con barras 3D (una por nivel de
 * criticidad, altura = cantidad real de proyectos en ese nivel), rodeada de
 * 2 anillos tipo Saturno rotando en direcciones opuestas y partículas
 * orbitando. Alrededor del panel, "badges" flotantes muestran estadísticas
 * reales del sistema (total de activos, progreso promedio, etc.).
 *
 * Requiere que <script src=".../three.min.js"></script> esté cargado antes.
 */
class CommandHub3D {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container || !window.THREE) {
            console.error('[CommandHub3D] Contenedor o THREE.js no disponibles.');
            return;
        }

        this.time = 0;
        this._initScene();
        this._bindEvents();

        this._animate = this._animate.bind(this);
        requestAnimationFrame(this._animate);
    }

    _initScene() {
        const w = this.container.clientWidth || 400;
        const h = this.container.clientHeight || 300;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
        this.camera.position.set(0, 3.3, 7.2);
        this.camera.lookAt(0, 0.6, 0);

        this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.setSize(w, h);
        this.renderer.setClearColor(0x000000, 0);
        this.container.appendChild(this.renderer.domElement);

        this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
        const light = new THREE.PointLight(0x22d3ee, 2.2, 30);
        light.position.set(3, 5, 4);
        this.scene.add(light);

        // Base circular
        const base = new THREE.Mesh(
            new THREE.CylinderGeometry(2.2, 2.4, 0.15, 48),
            new THREE.MeshStandardMaterial({ color: 0x0b1830, roughness: 0.4, metalness: 0.6, transparent: true, opacity: 0.85 })
        );
        this.scene.add(base);
        const baseEdge = new THREE.Mesh(
            new THREE.TorusGeometry(2.2, 0.02, 8, 64),
            new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.5 })
        );
        baseEdge.rotation.x = Math.PI / 2;
        baseEdge.position.y = 0.08;
        this.scene.add(baseEdge);

        // Anillos tipo "Saturno", rotando en direcciones opuestas
        this.rings = [];
        [
            { r: 2.7, tilt: 0.35, speed: 0.18, color: 0x22d3ee },
            { r: 3.3, tilt: -0.28, speed: -0.12, color: 0x8443c0 }
        ].forEach(cfg => {
            const ring = new THREE.Mesh(
                new THREE.TorusGeometry(cfg.r, 0.022, 8, 96),
                new THREE.MeshBasicMaterial({ color: cfg.color, transparent: true, opacity: 0.45 })
            );
            ring.rotation.x = Math.PI / 2 + cfg.tilt;
            this.scene.add(ring);
            this.rings.push({ mesh: ring, speed: cfg.speed });
        });

        // Grupo de barras centrales (se reconstruye con datos reales)
        this.barsGroup = new THREE.Group();
        this.scene.add(this.barsGroup);

        // Partículas orbitando
        this.dots = [];
        for (let i = 0; i < 14; i++) {
            const dot = new THREE.Mesh(
                new THREE.SphereGeometry(0.035, 6, 6),
                new THREE.MeshBasicMaterial({ color: 0x5ad8ff })
            );
            this.scene.add(dot);
            this.dots.push({
                mesh: dot,
                radius: 2.6 + Math.random() * 0.9,
                speed: 0.2 + Math.random() * 0.3,
                phase: Math.random() * Math.PI * 2,
                y: 0.2 + Math.random() * 1.3
            });
        }
    }

    /**
     * Reconstruye las barras centrales a partir de los proyectos reales:
     * una barra por nivel de criticidad, con altura proporcional a cuántos
     * proyectos hay en ese nivel.
     */
    updateStats(projects) {
        if (!this.barsGroup) return;

        // Limpia las barras anteriores
        while (this.barsGroup.children.length) {
            const child = this.barsGroup.children.pop();
            child.geometry.dispose();
            child.material.dispose();
        }

        const counts = { CRÍTICA: 0, ALTA: 0, NORMAL: 0, BAJA: 0 };
        projects.forEach(p => { if (counts[p.level] !== undefined) counts[p.level]++; });
        const colors = { CRÍTICA: 0xef4444, ALTA: 0xf59e0b, NORMAL: 0x10b981, BAJA: 0x8443c0 };
        const keys = Object.keys(counts);
        const max = Math.max(1, ...keys.map(k => counts[k]));

        const spacing = 0.55;
        const startX = -((keys.length - 1) * spacing) / 2;

        keys.forEach((key, i) => {
            const h = 0.3 + (counts[key] / max) * 2.2;
            const bar = new THREE.Mesh(
                new THREE.BoxGeometry(0.38, h, 0.38),
                new THREE.MeshStandardMaterial({
                    color: colors[key], emissive: colors[key], emissiveIntensity: 0.6,
                    roughness: 0.35, metalness: 0.4
                })
            );
            bar.position.set(startX + i * spacing, h / 2 + 0.08, 0);
            this.barsGroup.add(bar);
        });
    }

    _bindEvents() {
        window.addEventListener('resize', () => {
            const w = this.container.clientWidth || 400;
            const h = this.container.clientHeight || 300;
            this.camera.aspect = w / h;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(w, h);
        });
    }

    _animate(ts) {
        requestAnimationFrame(this._animate);
        this.time = ts * 0.001;

        this.rings.forEach(r => { r.mesh.rotation.z += r.speed * 0.01; });
        this.dots.forEach(d => {
            const a = this.time * d.speed + d.phase;
            d.mesh.position.set(Math.cos(a) * d.radius, d.y, Math.sin(a) * d.radius);
        });
        if (this.barsGroup) this.barsGroup.rotation.y = Math.sin(this.time * 0.15) * 0.15;

        if (this.container.isConnected) {
            this.renderer.render(this.scene, this.camera);
        }
    }
}
