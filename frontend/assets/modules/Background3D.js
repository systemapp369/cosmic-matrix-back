/**
 * Background3D.js
 * Fondo interactivo en 3D: una red de nodos flotantes conectados por líneas,
 * representando el ecosistema de proyectos (cada nodo = un "activo"), con
 * colores tomados de la misma paleta de criticidad de la app. Reacciona al
 * mouse con un efecto de paralaje sutil y tiene movimiento continuo (rotación
 * lenta + flotación individual de cada nodo).
 *
 * Requiere que <script src=".../three.min.js"></script> esté cargado antes.
 */
class Background3D {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container || !window.THREE) {
            console.error('[Background3D] Contenedor o THREE.js no disponibles.');
            return;
        }

        this.nodeCount = options.nodeCount || 46;
        this.palette = options.palette || ['#22d3ee', '#8443c0', '#10b981', '#f59e0b', '#ef4444'];
        this.mouse = { x: 0, y: 0 };
        this.time = 0;
        this.nodes = [];

        this._initScene();
        this._buildNetwork();
        this._bindEvents();
        this._animate = this._animate.bind(this);
        requestAnimationFrame(this._animate);
    }

    _initScene() {
        const w = window.innerWidth;
        const h = window.innerHeight;

        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x05070d, 0.0055);

        this.camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 500);
        this.camera.position.set(0, 0, 42);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.setSize(w, h);
        this.renderer.domElement.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;display:block;';
        this.container.appendChild(this.renderer.domElement);

        const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
        this.renderer.domElement.style.opacity = isDark ? '0.85' : '0.30';

        this.scene.add(new THREE.AmbientLight(0x404040, 1.3));
        const pointLight = new THREE.PointLight(0x22d3ee, 1.8, 220);
        pointLight.position.set(0, 10, 60);
        this.scene.add(pointLight);

        this.group = new THREE.Group();
        this.scene.add(this.group);
    }

    _buildNetwork() {
        // --- Nodos: cada uno representa un "proyecto/activo" flotando en el espacio ---
        const geometry = new THREE.IcosahedronGeometry(1.15, 0);

        for (let i = 0; i < this.nodeCount; i++) {
            const color = this.palette[Math.floor(Math.random() * this.palette.length)];
            const material = new THREE.MeshStandardMaterial({
                color, emissive: color, emissiveIntensity: 0.55,
                roughness: 0.35, metalness: 0.45
            });
            const mesh = new THREE.Mesh(geometry, material);

            const base = new THREE.Vector3(
                (Math.random() - 0.5) * 110,
                (Math.random() - 0.5) * 65,
                (Math.random() - 0.5) * 70 - 15
            );
            mesh.position.copy(base);
            mesh.scale.setScalar(0.6 + Math.random() * 0.9);

            this.group.add(mesh);
            this.nodes.push({
                mesh,
                base,
                phase: Math.random() * Math.PI * 2,
                speed: 0.4 + Math.random() * 0.6,
                amp: 1.5 + Math.random() * 2.5
            });
        }

        // --- Conexiones: une cada nodo con sus vecinos más cercanos (mapa de dependencias) ---
        const maxDist = 26;
        const linePositions = [];
        for (let i = 0; i < this.nodes.length; i++) {
            let links = 0;
            for (let j = i + 1; j < this.nodes.length && links < 2; j++) {
                const d = this.nodes[i].base.distanceTo(this.nodes[j].base);
                if (d < maxDist) {
                    linePositions.push(
                        this.nodes[i].base.x, this.nodes[i].base.y, this.nodes[i].base.z,
                        this.nodes[j].base.x, this.nodes[j].base.y, this.nodes[j].base.z
                    );
                    this.nodes[i].links = this.nodes[i].links || [];
                    this.nodes[i].links.push(j);
                    links++;
                }
            }
        }

        const lineGeo = new THREE.BufferGeometry();
        lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
        const lineMat = new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.18 });
        this.lines = new THREE.LineSegments(lineGeo, lineMat);
        this.group.add(this.lines);
    }

    _bindEvents() {
        this._onResize = () => {
            const w = window.innerWidth;
            const h = window.innerHeight;
            this.camera.aspect = w / h;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(w, h);
        };
        window.addEventListener('resize', this._onResize);

        this._onMouseMove = (e) => {
            this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
        };
        window.addEventListener('mousemove', this._onMouseMove);
    }

    _animate(ts) {
        requestAnimationFrame(this._animate);
        this.time = ts * 0.001;

        // Flotación individual de cada nodo (movimiento tipo "actividad de proyecto")
        const posAttr = this.lines.geometry.attributes.position;
        this.nodes.forEach((n) => {
            n.mesh.position.y = n.base.y + Math.sin(this.time * n.speed + n.phase) * n.amp;
            n.mesh.position.x = n.base.x + Math.cos(this.time * n.speed * 0.6 + n.phase) * (n.amp * 0.4);
            n.mesh.rotation.x += 0.002;
            n.mesh.rotation.y += 0.003;
        });

        // Reconstruye las líneas para que sigan a los nodos en movimiento
        let idx = 0;
        this.nodes.forEach((n, i) => {
            if (!n.links) return;
            n.links.forEach((j) => {
                const a = this.nodes[i].mesh.position;
                const b = this.nodes[j].mesh.position;
                posAttr.array[idx++] = a.x; posAttr.array[idx++] = a.y; posAttr.array[idx++] = a.z;
                posAttr.array[idx++] = b.x; posAttr.array[idx++] = b.y; posAttr.array[idx++] = b.z;
            });
        });
        posAttr.needsUpdate = true;

        // Rotación lenta y continua de toda la red
        this.group.rotation.y += 0.0009;
        this.group.rotation.x = Math.sin(this.time * 0.05) * 0.05;

        // Paralaje interactivo: la cámara "sigue" al mouse suavemente
        const targetX = this.mouse.x * 9;
        const targetY = -this.mouse.y * 6;
        this.camera.position.x += (targetX - this.camera.position.x) * 0.03;
        this.camera.position.y += (targetY - this.camera.position.y) * 0.03;
        this.camera.lookAt(0, 0, 0);

        this.renderer.render(this.scene, this.camera);
    }

    /**
     * Ajusta la intensidad visual del fondo según el tema claro/oscuro de la app.
     */
    setTheme(theme) {
        if (!this.renderer) return;
        this.renderer.domElement.style.opacity = theme === 'dark' ? '0.85' : '0.30';
    }
}
