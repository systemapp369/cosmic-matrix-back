/**
 * Background3D.js
 * Fondo interactivo en 3D: una "ciudad" wireframe (estilo skyline digital) con
 * un enjambre de drones sobrevolándola. Cada dron representa un proyecto real
 * del sistema, y su color corresponde EXACTAMENTE al color del anillo de
 * criticidad de ese proyecto (mismo mapeo que getLevelColor() en app.js):
 *   CRÍTICA -> rojo · ALTA -> ámbar · NORMAL -> verde · BAJA -> morado
 *
 * app.js debe llamar a background3D.syncProjects(this.projects) cada vez que
 * la lista de proyectos cambia (carga inicial, alta, edición, baja), para que
 * el número de drones y sus colores reflejen los datos reales.
 *
 * Requiere que <script src=".../three.min.js"></script> esté cargado antes.
 */
class Background3D {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container || !window.THREE) {
            console.error('[Background3D] Contenedor o THREE.js no disponibles.');
            return;
        }

        this.mouse = { x: 0, y: 0 };
        this.time = 0;
        this.nodes = [];

        this._initScene();
        this._buildBackgroundGradient();
        this._buildCity();
        this._buildGroundPath();
        this._rebuildDrones([]); // enjambre neutro hasta que lleguen datos reales
        this._bindEvents();

        this._animate = this._animate.bind(this);
        requestAnimationFrame(this._animate);
    }

    // --- Colores oficiales de criticidad (mismo mapeo que app.js -> getLevelColor) ---
    _levelColor(level) {
        switch (level) {
            case 'CRÍTICA': return '#ef4444';
            case 'ALTA': return '#f59e0b';
            case 'NORMAL': return '#10b981';
            case 'BAJA': return '#8443c0';
            default: return '#3b82f6';
        }
    }

    _initScene() {
        const w = window.innerWidth;
        const h = window.innerHeight;

        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x040917, 0.0075);

        this.camera = new THREE.PerspectiveCamera(58, w / h, 0.1, 600);
        this.camera.position.set(0, 6, 46);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.setSize(w, h);
        this.renderer.domElement.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;display:block;';
        this.container.appendChild(this.renderer.domElement);

        const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
        this.renderer.domElement.style.opacity = isDark ? '0.9' : '0.32';

        this.scene.add(new THREE.AmbientLight(0x40506a, 1.1));
        const key = new THREE.PointLight(0x2b6bff, 1.6, 260);
        key.position.set(0, 30, 40);
        this.scene.add(key);

        this.droneGroup = new THREE.Group();
        this.scene.add(this.droneGroup);
    }

    /**
     * Fondo con degradado radial azul profundo (igual a la imagen de referencia:
     * centro más claro, bordes casi negros).
     */
    _buildBackgroundGradient() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createRadialGradient(256, 200, 40, 256, 256, 420);
        gradient.addColorStop(0, '#0a1a3d');
        gradient.addColorStop(0.5, '#050f28');
        gradient.addColorStop(1, '#02050f');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 512, 512);

        const texture = new THREE.CanvasTexture(canvas);
        this.scene.background = texture;
    }

    /**
     * Skyline wireframe a ambos lados, formando una "avenida" que se pierde en
     * la distancia, como en la imagen de referencia.
     */
    _buildCity() {
        const cityGroup = new THREE.Group();
        const buildingMat = new THREE.LineBasicMaterial({ color: 0x3b6bff, transparent: true, opacity: 0.4 });
        const roofMat = new THREE.LineBasicMaterial({ color: 0x5ad8ff, transparent: true, opacity: 0.55 });

        for (let side = -1; side <= 1; side += 2) {
            for (let i = 0; i < 16; i++) {
                const z = -6 - i * 8 - Math.random() * 3;
                const distFactor = Math.min(Math.abs(z) / 130, 1);
                const xBase = side * (9 + distFactor * 46);

                const w = 4 + Math.random() * 6;
                const h = 7 + Math.random() * 30;
                const d = 4 + Math.random() * 6;

                const geo = new THREE.BoxGeometry(w, h, d);
                const edges = new THREE.EdgesGeometry(geo);
                const building = new THREE.LineSegments(edges, buildingMat);
                building.position.set(xBase + (Math.random() - 0.5) * 3, h / 2 - 16, z);
                cityGroup.add(building);

                // pequeño "remate" brillante en la azotea, como puntos de luz del skyline
                const roofDot = new THREE.Mesh(
                    new THREE.SphereGeometry(0.18, 6, 6),
                    new THREE.MeshBasicMaterial({ color: 0x5ad8ff })
                );
                roofDot.position.set(building.position.x, h - 16, z);
                cityGroup.add(roofDot);
            }
        }

        this.scene.add(cityGroup);
        this.cityGroup = cityGroup;
    }

    /**
     * "Avenida" digital en el piso: red de puntos luminosos conectados que se
     * pierde hacia el horizonte, como en la imagen de referencia.
     */
    _buildGroundPath() {
        const grid = new THREE.GridHelper(260, 40, 0x1c3a7a, 0x14264f);
        grid.position.y = -16;
        grid.material.transparent = true;
        grid.material.opacity = 0.25;
        this.scene.add(grid);

        const waypoints = [];
        for (let i = 0; i < 14; i++) {
            const z = 30 - i * 6;
            const x = Math.sin(i * 0.6) * 6;
            waypoints.push(new THREE.Vector3(x, -15.7, z));
        }

        const dotMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
        waypoints.forEach(p => {
            const dot = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), dotMat);
            dot.position.copy(p);
            this.scene.add(dot);
        });

        const linePositions = [];
        for (let i = 0; i < waypoints.length - 1; i++) {
            linePositions.push(
                waypoints[i].x, waypoints[i].y, waypoints[i].z,
                waypoints[i + 1].x, waypoints[i + 1].y, waypoints[i + 1].z
            );
        }
        const lineGeo = new THREE.BufferGeometry();
        lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
        const lineMat = new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.5 });
        this.scene.add(new THREE.LineSegments(lineGeo, lineMat));
    }

    /**
     * Construye un dron individual (cuerpo + 4 brazos + 4 hélices + luz de
     * navegación) con el color de estatus indicado.
     */
    _createDrone(colorHex) {
        const group = new THREE.Group();

        const bodyMat = new THREE.MeshStandardMaterial({
            color: colorHex, emissive: colorHex, emissiveIntensity: 0.85,
            roughness: 0.35, metalness: 0.4
        });

        const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), bodyMat);
        body.scale.set(1, 0.5, 1.3);
        group.add(body);

        const armLen = 1.1;
        const armSpots = [
            { x: armLen, z: armLen }, { x: -armLen, z: armLen },
            { x: armLen, z: -armLen }, { x: -armLen, z: -armLen }
        ];

        const rotors = [];
        armSpots.forEach(spot => {
            const angle = Math.atan2(spot.z, spot.x);
            const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, armLen * 1.4, 5), this.armMat);
            arm.rotation.z = Math.PI / 2;
            arm.rotation.y = -angle;
            arm.position.set(spot.x * 0.5, 0, spot.z * 0.5);
            group.add(arm);

            const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.025, 10), this.rotorMat);
            rotor.position.set(spot.x, 0.07, spot.z);
            group.add(rotor);
            rotors.push(rotor);

            const led = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), bodyMat);
            led.position.set(spot.x, -0.04, spot.z);
            group.add(led);
        });

        const navLight = new THREE.PointLight(colorHex, 1.1, 8);
        navLight.position.set(0, -0.3, 0);
        group.add(navLight);

        return { group, rotors, light: navLight, bodyMat };
    }

    /**
     * Reconstruye el enjambre completo de drones a partir de la lista de
     * proyectos (uno por proyecto). Si no hay proyectos aún, arma un enjambre
     * neutro de relleno para no dejar la escena vacía.
     */
    _rebuildDrones(projects) {
        // Materiales compartidos (brazos/hélices no cambian de color, solo el cuerpo/luz)
        if (!this.armMat) {
            this.armMat = new THREE.MeshStandardMaterial({ color: 0x18202f, roughness: 0.6, metalness: 0.5 });
            this.rotorMat = new THREE.MeshStandardMaterial({ color: 0x3a4a63, transparent: true, opacity: 0.5, roughness: 0.3 });
        }

        // Limpia el enjambre anterior
        this.nodes.forEach(n => this.droneGroup.remove(n.group));
        this.nodes = [];

        const list = projects.length > 0
            ? projects.map(p => ({ id: p.id, level: p.level }))
            : Array.from({ length: 10 }, (_, i) => ({ id: `PLACEHOLDER-${i}`, level: null }));

        list.forEach((p) => {
            const colorHex = this._levelColor(p.level);
            const { group, rotors, light, bodyMat } = this._createDrone(colorHex);

            const base = new THREE.Vector3(
                (Math.random() - 0.5) * 90,
                4 + Math.random() * 22,
                (Math.random() - 0.5) * 60 - 5
            );
            group.position.copy(base);
            group.scale.setScalar(0.9 + Math.random() * 0.6);
            this.droneGroup.add(group);

            this.nodes.push({
                group, rotors, light, bodyMat,
                id: p.id, level: p.level, colorHex,
                base,
                phase: Math.random() * Math.PI * 2,
                speed: 0.35 + Math.random() * 0.5,
                amp: 1.4 + Math.random() * 2,
                driftPhase: Math.random() * Math.PI * 2
            });
        });

        // Red de líneas entre drones cercanos (fleet en formación/comunicación)
        const maxDist = 24;
        const linePositions = [];
        this.linkPairs = [];
        for (let i = 0; i < this.nodes.length; i++) {
            let links = 0;
            for (let j = i + 1; j < this.nodes.length && links < 2; j++) {
                if (this.nodes[i].base.distanceTo(this.nodes[j].base) < maxDist) {
                    this.linkPairs.push([i, j]);
                    linePositions.push(0, 0, 0, 0, 0, 0);
                    links++;
                }
            }
        }
        const lineGeo = new THREE.BufferGeometry();
        lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
        const lineMat = new THREE.LineBasicMaterial({ color: 0x8fb8ff, transparent: true, opacity: 0.15 });
        if (this.droneLines) this.droneGroup.remove(this.droneLines);
        this.droneLines = new THREE.LineSegments(lineGeo, lineMat);
        this.droneGroup.add(this.droneLines);
    }

    /**
     * Punto de entrada desde app.js: sincroniza el enjambre con los proyectos
     * reales (número de drones + color de cada uno según su criticidad).
     */
    syncProjects(projects) {
        if (!this.scene) return;

        if (projects.length !== this.nodes.length) {
            this._rebuildDrones(projects);
            return;
        }

        // Mismo número de proyectos: solo actualiza colores por si cambió la criticidad
        projects.forEach((p, i) => {
            const n = this.nodes[i];
            if (!n) return;
            const colorHex = this._levelColor(p.level);
            if (n.colorHex !== colorHex) {
                n.colorHex = colorHex;
                n.level = p.level;
                n.id = p.id;
                n.bodyMat.color.set(colorHex);
                n.bodyMat.emissive.set(colorHex);
                n.light.color.set(colorHex);
            }
        });
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
        const t = this.time;

        // Vuelo: flotación + deriva suave + hélices girando + ligero "banqueo"
        this.nodes.forEach(n => {
            const bobY = Math.sin(t * n.speed + n.phase) * n.amp;
            const driftX = Math.cos(t * 0.15 + n.driftPhase) * 7;
            const driftZ = Math.sin(t * 0.12 + n.driftPhase) * 5;
            n.group.position.set(n.base.x + driftX, n.base.y + bobY, n.base.z + driftZ);
            n.group.rotation.z = Math.sin(t * 0.18 + n.driftPhase) * 0.22;
            n.group.rotation.x = Math.cos(t * 0.14 + n.driftPhase) * 0.12;
            n.rotors.forEach(r => { r.rotation.y += 1.1; });
        });

        // Reconstruye las líneas de la red siguiendo a los drones en movimiento
        if (this.droneLines && this.linkPairs.length) {
            const posAttr = this.droneLines.geometry.attributes.position;
            let idx = 0;
            this.linkPairs.forEach(([i, j]) => {
                const a = this.nodes[i].group.position;
                const b = this.nodes[j].group.position;
                posAttr.array[idx++] = a.x; posAttr.array[idx++] = a.y; posAttr.array[idx++] = a.z;
                posAttr.array[idx++] = b.x; posAttr.array[idx++] = b.y; posAttr.array[idx++] = b.z;
            });
            posAttr.needsUpdate = true;
        }

        // Paralaje interactivo con el mouse
        const targetX = this.mouse.x * 8;
        const targetY = 6 - this.mouse.y * 4;
        this.camera.position.x += (targetX - this.camera.position.x) * 0.03;
        this.camera.position.y += (targetY - this.camera.position.y) * 0.03;
        this.camera.lookAt(0, 2, -40);

        this.renderer.render(this.scene, this.camera);
    }

    setTheme(theme) {
        if (!this.renderer) return;
        this.renderer.domElement.style.opacity = theme === 'dark' ? '0.9' : '0.32';
    }
}
