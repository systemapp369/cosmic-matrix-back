/**
 * Background3D.js
 * Fondo abstracto tecnológico/holográfico: degradado azul profundo + anillos
 * y paneles hexagonales flotantes (decoración tipo HUD) + un enjambre de
 * drones que representan los proyectos reales del sistema. Sin ciudad,
 * árboles ni piso de calles — ambiente limpio tipo "consola de diagnóstico".
 *
 * Cada dron representa un proyecto real; su color corresponde EXACTAMENTE
 * al color del anillo de criticidad de ese proyecto (mismo mapeo que
 * getLevelColor() en app.js):
 *   CRÍTICA -> rojo · ALTA -> ámbar · NORMAL -> verde · BAJA -> morado
 *
 * app.js debe llamar a background3D.syncProjects(this.projects) cada vez que
 * la lista de proyectos cambia, para que el enjambre refleje los datos reales.
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
        this._buildHudDecor();
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
            default: return '#22d3ee';
        }
    }

    _initScene() {
        const w = window.innerWidth;
        const h = window.innerHeight;

        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x030814, 0.006);

        this.camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 500);
        this.camera.position.set(0, 6, 46);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.setSize(w, h);
        this.renderer.domElement.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;display:block;';
        this.container.appendChild(this.renderer.domElement);

        const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
        this.renderer.domElement.style.opacity = isDark ? '0.9' : '0.3';

        this.scene.add(new THREE.AmbientLight(0x3a4a6a, 1.2));
        const key = new THREE.PointLight(0x22d3ee, 1.8, 260);
        key.position.set(0, 30, 30);
        this.scene.add(key);

        this.droneGroup = new THREE.Group();
        this.scene.add(this.droneGroup);
    }

    /**
     * Fondo con degradado radial azul/negro profundo (ambiente de consola de
     * diagnóstico, sin elementos literales como calles o edificios).
     */
    _buildBackgroundGradient() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createRadialGradient(256, 210, 20, 256, 256, 420);
        gradient.addColorStop(0, '#0b1830');
        gradient.addColorStop(0.55, '#050f24');
        gradient.addColorStop(1, '#02050d');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 512, 512);
        this.scene.background = new THREE.CanvasTexture(canvas);
    }

    /**
     * Decoración abstracta tipo HUD: anillos wireframe grandes + paneles
     * hexagonales translúcidos flotando lentamente, para dar ambiente
     * "holográfico" sin representar literalmente edificios/calles.
     */
    _buildHudDecor() {
        const decorGroup = new THREE.Group();
        this.ringMeshes = [];
        this.hexMeshes = [];

        // Anillos concéntricos grandes, como un radar/consola
        for (let i = 0; i < 3; i++) {
            const radius = 20 + i * 9;
            const ring = new THREE.Mesh(
                new THREE.TorusGeometry(radius, 0.06, 8, 96),
                new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.14 - i * 0.03 })
            );
            ring.rotation.x = Math.PI / 2.1;
            ring.position.set(0, -6, -20);
            decorGroup.add(ring);
            this.ringMeshes.push({ mesh: ring, speed: 0.02 + i * 0.01 });
        }

        // Paneles hexagonales translúcidos flotando (acento decorativo tipo HUD)
        const hexGeo = new THREE.CircleGeometry(2.2, 6);
        for (let i = 0; i < 10; i++) {
            const mat = new THREE.MeshBasicMaterial({
                color: 0x22d3ee, transparent: true, opacity: 0.06,
                side: THREE.DoubleSide
            });
            const hex = new THREE.Mesh(hexGeo, mat);
            hex.position.set(
                (Math.random() - 0.5) * 90,
                (Math.random() - 0.5) * 50,
                (Math.random() - 0.5) * 60 - 20
            );
            hex.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
            decorGroup.add(hex);
            this.hexMeshes.push({ mesh: hex, phase: Math.random() * Math.PI * 2 });

            const edges = new THREE.EdgesGeometry(hexGeo);
            const outline = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x5ad8ff, transparent: true, opacity: 0.25 }));
            outline.position.copy(hex.position);
            outline.rotation.copy(hex.rotation);
            decorGroup.add(outline);
        }

        this.scene.add(decorGroup);
        this.decorGroup = decorGroup;
    }

    /**
     * Construye un dron detallado (chasis + gimbal + patas + brazos con
     * motor/hélice con blur + antena + luces de navegación) con la baliza de
     * estatus en el color de criticidad indicado.
     */
    _createDrone(colorHex) {
        const group = new THREE.Group();

        if (!this.chassisMat) {
            this.chassisMat = new THREE.MeshStandardMaterial({ color: 0x22262f, roughness: 0.45, metalness: 0.6 });
            this.trimMat = new THREE.MeshStandardMaterial({ color: 0x484f5e, roughness: 0.4, metalness: 0.7 });
            this.lensMat = new THREE.MeshStandardMaterial({ color: 0x0a0d12, roughness: 0.15, metalness: 0.2 });
            this.legMat = new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.6, metalness: 0.3 });
            this.propMat = new THREE.MeshStandardMaterial({
                color: 0xdfe6ee, transparent: true, opacity: 0.32, roughness: 0.3, side: THREE.DoubleSide
            });
        }

        const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.14, 0.9), this.chassisMat);
        group.add(chassis);
        const trimTop = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.55), this.trimMat);
        trimTop.position.y = 0.095;
        group.add(trimTop);

        const gimbalArm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 6), this.legMat);
        gimbalArm.position.set(0, -0.12, 0.38);
        group.add(gimbalArm);
        const camBall = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), this.chassisMat);
        camBall.position.set(0, -0.2, 0.38);
        group.add(camBall);
        const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 10), this.lensMat);
        lens.rotation.x = Math.PI / 2;
        lens.position.set(0, -0.2, 0.45);
        group.add(lens);

        [[-0.28, 0.32], [0.28, 0.32], [-0.28, -0.32], [0.28, -0.32]].forEach(([lx, lz]) => {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.32, 5), this.legMat);
            leg.position.set(lx, -0.22, lz);
            leg.rotation.z = lx > 0 ? -0.18 : 0.18;
            group.add(leg);
        });

        const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 5), this.legMat);
        antenna.position.set(-0.12, 0.22, -0.3);
        group.add(antenna);

        const armLen = 1.05;
        const armSpots = [
            { x: armLen, z: armLen, navColor: 0x22c55e },
            { x: -armLen, z: armLen, navColor: 0xef4444 },
            { x: armLen, z: -armLen, navColor: 0x22c55e },
            { x: -armLen, z: -armLen, navColor: 0xef4444 }
        ];

        const rotors = [];
        armSpots.forEach(spot => {
            const angle = Math.atan2(spot.z, spot.x);
            const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, armLen * 1.38, 6), this.trimMat);
            arm.rotation.z = Math.PI / 2;
            arm.rotation.y = -angle;
            arm.position.set(spot.x * 0.5, 0, spot.z * 0.5);
            group.add(arm);

            const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.14, 10), this.chassisMat);
            motor.position.set(spot.x, 0.06, spot.z);
            group.add(motor);

            const rotorGroup = new THREE.Group();
            rotorGroup.position.set(spot.x, 0.13, spot.z);
            const blade1 = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.008, 0.05), this.trimMat);
            const blade2 = blade1.clone();
            blade2.rotation.y = Math.PI / 2;
            rotorGroup.add(blade1, blade2);
            const blurDisc = new THREE.Mesh(new THREE.CircleGeometry(0.34, 20), this.propMat);
            blurDisc.rotation.x = -Math.PI / 2;
            rotorGroup.add(blurDisc);
            group.add(rotorGroup);
            rotors.push(rotorGroup);

            const navLed = new THREE.Mesh(
                new THREE.SphereGeometry(0.045, 6, 6),
                new THREE.MeshBasicMaterial({ color: spot.navColor })
            );
            navLed.position.set(spot.x, -0.02, spot.z);
            group.add(navLed);
        });

        const bodyMat = new THREE.MeshStandardMaterial({
            color: colorHex, emissive: colorHex, emissiveIntensity: 1, roughness: 0.3, metalness: 0.2
        });
        const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), bodyMat);
        beacon.position.set(0, 0.14, -0.2);
        group.add(beacon);

        const navLight = new THREE.PointLight(colorHex, 1.1, 8);
        navLight.position.set(0, 0.2, -0.2);
        group.add(navLight);

        return { group, rotors, light: navLight, bodyMat };
    }

    _rebuildDrones(projects) {
        this.nodes.forEach(n => this.droneGroup.remove(n.group));
        this.nodes = [];

        const list = projects.length > 0
            ? projects.map(p => ({ id: p.id, level: p.level }))
            : Array.from({ length: 10 }, (_, i) => ({ id: `PLACEHOLDER-${i}`, level: null }));

        list.forEach((p) => {
            const colorHex = this._levelColor(p.level);
            const { group, rotors, light, bodyMat } = this._createDrone(colorHex);

            const angle = Math.random() * Math.PI * 2;
            const radius = 6 + Math.random() * 32;
            const base = new THREE.Vector3(
                Math.cos(angle) * radius,
                4 + Math.random() * 22,
                Math.sin(angle) * radius - 15
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

        const maxDist = 22;
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

        this.nodes.forEach(n => {
            const bobY = Math.sin(t * n.speed + n.phase) * n.amp;
            const driftX = Math.cos(t * 0.15 + n.driftPhase) * 6;
            const driftZ = Math.sin(t * 0.12 + n.driftPhase) * 4;
            n.group.position.set(n.base.x + driftX, n.base.y + bobY, n.base.z + driftZ);
            n.group.rotation.z = Math.sin(t * 0.18 + n.driftPhase) * 0.22;
            n.group.rotation.x = Math.cos(t * 0.14 + n.driftPhase) * 0.12;
            n.rotors.forEach(r => { r.rotation.y += 1.1; });
        });

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

        // Decoración: anillos girando lento + paneles hexagonales flotando
        if (this.ringMeshes) {
            this.ringMeshes.forEach(r => { r.mesh.rotation.z += r.speed * 0.01; });
        }
        if (this.hexMeshes) {
            this.hexMeshes.forEach(h => {
                h.mesh.position.y += Math.sin(t * 0.2 + h.phase) * 0.003;
                h.mesh.rotation.z += 0.0008;
            });
        }

        // Recorrido suave de cámara + paralaje del mouse
        const orbitAngle = t * 0.03;
        const orbitRadius = 46 + Math.sin(t * 0.04) * 10;
        const flightX = Math.cos(orbitAngle) * orbitRadius;
        const flightZ = Math.sin(orbitAngle) * orbitRadius - 15;
        const altitude = 10 + Math.sin(t * 0.05) * 8;

        const mouseOffsetX = this.mouse.x * 6;
        const mouseOffsetY = -this.mouse.y * 4;

        this.camera.position.x += (flightX + mouseOffsetX - this.camera.position.x) * 0.02;
        this.camera.position.y += (altitude + mouseOffsetY - this.camera.position.y) * 0.02;
        this.camera.position.z += (flightZ - this.camera.position.z) * 0.02;
        this.camera.lookAt(0, 0, -15);

        this.renderer.render(this.scene, this.camera);
    }

    setTheme(theme) {
        if (!this.renderer) return;
        this.renderer.domElement.style.opacity = theme === 'dark' ? '0.9' : '0.3';
    }
}
