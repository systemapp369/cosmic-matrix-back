/**
 * Background3D.js
 * Fondo interactivo en 3D: una ciudad "holográfica" (torres glow + wireframe)
 * sobre un piso tipo mapa/blueprint de calles, sobrevolada por un enjambre de
 * drones. La cámara recorre la ciudad de forma AUTÓNOMA Y CONTINUA (órbita +
 * variación de altitud), pasando de vista a nivel de calle a vista aérea y
 * viceversa, dando la sensación de estar "recorriendo" la ciudad. El mouse
 * añade un paralaje adicional sutil por encima de ese recorrido.
 *
 * Cada dron representa un proyecto real del sistema; su color corresponde
 * EXACTAMENTE al color del anillo de criticidad de ese proyecto (mismo mapeo
 * que getLevelColor() en app.js):
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
        this.cityCenter = new THREE.Vector3(10, 0, -10);

        this._initScene();
        this._buildBackgroundGradient();
        this._buildStreetMap();
        this._buildCityCluster();
        this._buildParks();
        this._buildCranes();
        this._buildTraffic();
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
        this.scene.fog = new THREE.FogExp2(0x030814, 0.0065);

        this.camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 700);
        this.camera.position.set(0, 20, 70);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.setSize(w, h);
        this.renderer.domElement.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;display:block;';
        this.container.appendChild(this.renderer.domElement);

        const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
        this.renderer.domElement.style.opacity = isDark ? '0.92' : '0.32';

        this.scene.add(new THREE.AmbientLight(0x3a4a6a, 1.2));
        const key = new THREE.PointLight(0x3b82f6, 2, 300);
        key.position.set(this.cityCenter.x, 60, this.cityCenter.z);
        this.scene.add(key);

        this.droneGroup = new THREE.Group();
        this.scene.add(this.droneGroup);
    }

    /**
     * Degradado radial azul profundo de fondo (igual espíritu que las
     * imágenes de referencia: centro más claro, bordes casi negros).
     */
    _buildBackgroundGradient() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createRadialGradient(256, 220, 30, 256, 256, 430);
        gradient.addColorStop(0, '#0c1c40');
        gradient.addColorStop(0.5, '#050f28');
        gradient.addColorStop(1, '#02040d');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 512, 512);
        this.scene.background = new THREE.CanvasTexture(canvas);
    }

    /**
     * Piso tipo "mapa/blueprint de calles" (como la vista aérea de
     * referencia): una textura de calles finas + un par de avenidas más
     * gruesas, aplicada a un plano grande a nivel de piso.
     */
    _buildStreetMap() {
        const size = 1024;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#040a1c';
        ctx.fillRect(0, 0, size, size);

        // Calles finas (grid irregular, como un plano de ciudad)
        ctx.strokeStyle = 'rgba(60, 110, 220, 0.35)';
        ctx.lineWidth = 1;
        let x = 0;
        while (x < size) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, size);
            ctx.stroke();
            x += 22 + Math.random() * 26;
        }
        let y = 0;
        while (y < size) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(size, y);
            ctx.stroke();
            y += 22 + Math.random() * 26;
        }

        // Avenidas principales, más brillantes
        ctx.strokeStyle = 'rgba(90, 216, 255, 0.55)';
        ctx.lineWidth = 3;
        for (let i = 0; i < 5; i++) {
            const vx = 120 + i * 190 + (Math.random() - 0.5) * 30;
            ctx.beginPath(); ctx.moveTo(vx, 0); ctx.lineTo(vx, size); ctx.stroke();
        }
        for (let i = 0; i < 4; i++) {
            const hy = 150 + i * 220 + (Math.random() - 0.5) * 30;
            ctx.beginPath(); ctx.moveTo(0, hy); ctx.lineTo(size, hy); ctx.stroke();
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(1, 1);

        const geo = new THREE.PlaneGeometry(420, 420);
        const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.85 });
        const ground = new THREE.Mesh(geo, mat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.set(this.cityCenter.x, -0.2, this.cityCenter.z);
        this.scene.add(ground);
    }

    /**
     * Clúster de torres "holográficas" (glass glow + contorno wireframe),
     * agrupadas como en la vista aérea de referencia, sobre el mapa de calles.
     */
    _buildCityCluster() {
        const cityGroup = new THREE.Group();
        const towerCount = 34;

        for (let i = 0; i < towerCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.pow(Math.random(), 0.6) * 32; // más denso al centro
            const x = this.cityCenter.x + Math.cos(angle) * radius;
            const z = this.cityCenter.z + Math.sin(angle) * radius;

            const distFactor = radius / 32;
            const w = 2 + Math.random() * 3.5;
            const d = 2 + Math.random() * 3.5;
            const h = (6 + Math.random() * 26) * (1 - distFactor * 0.4);

            const geo = new THREE.BoxGeometry(w, h, d);

            const glassMat = new THREE.MeshStandardMaterial({
                color: 0x2f6bff, emissive: 0x2f6bff, emissiveIntensity: 0.55,
                transparent: true, opacity: 0.28, roughness: 0.3, metalness: 0.6
            });
            const tower = new THREE.Mesh(geo, glassMat);
            tower.position.set(x, h / 2, z);
            cityGroup.add(tower);

            const edges = new THREE.EdgesGeometry(geo);
            const edgeMat = new THREE.LineBasicMaterial({ color: 0x8fd6ff, transparent: true, opacity: 0.7 });
            const outline = new THREE.LineSegments(edges, edgeMat);
            outline.position.copy(tower.position);
            cityGroup.add(outline);

            const roofDot = new THREE.Mesh(
                new THREE.SphereGeometry(0.16, 6, 6),
                new THREE.MeshBasicMaterial({ color: 0x5ad8ff })
            );
            roofDot.position.set(x, h + 0.2, z);
            cityGroup.add(roofDot);
        }

        this.scene.add(cityGroup);
        this.cityGroup = cityGroup;
    }

    /**
     * Parques: parches verdes con árboles esparcidos entre las torres,
     * como en la imagen de referencia con áreas verdes junto a los edificios.
     */
    _buildParks() {
        const parksGroup = new THREE.Group();
        const grassMat = new THREE.MeshStandardMaterial({
            color: 0x14532d, emissive: 0x0f3d22, emissiveIntensity: 0.35, roughness: 0.9
        });
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3222, roughness: 0.9 });
        const leafMat = new THREE.MeshStandardMaterial({
            color: 0x22c55e, emissive: 0x14532d, emissiveIntensity: 0.4, roughness: 0.7
        });

        this.trees = [];

        for (let i = 0; i < 9; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = 14 + Math.random() * 30;
            const cx = this.cityCenter.x + Math.cos(angle) * radius;
            const cz = this.cityCenter.z + Math.sin(angle) * radius;

            const patch = new THREE.Mesh(new THREE.CircleGeometry(3 + Math.random() * 2, 16), grassMat);
            patch.rotation.x = -Math.PI / 2;
            patch.position.set(cx, -0.15, cz);
            parksGroup.add(patch);

            const treeCount = 3 + Math.floor(Math.random() * 4);
            for (let j = 0; j < treeCount; j++) {
                const tAngle = Math.random() * Math.PI * 2;
                const tRadius = Math.random() * 2.4;
                const tx = cx + Math.cos(tAngle) * tRadius;
                const tz = cz + Math.sin(tAngle) * tRadius;

                const treeGroup = new THREE.Group();
                const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 1.1, 6), trunkMat);
                trunk.position.y = 0.55;
                treeGroup.add(trunk);

                const foliage = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.6, 7), leafMat);
                foliage.position.y = 1.5;
                treeGroup.add(foliage);

                treeGroup.position.set(tx, 0, tz);
                treeGroup.scale.setScalar(0.8 + Math.random() * 0.6);
                parksGroup.add(treeGroup);

                this.trees.push({ group: treeGroup, phase: Math.random() * Math.PI * 2 });
            }
        }

        this.scene.add(parksGroup);
    }

    /**
     * Grúas torre de construcción (como en las imágenes de referencia): mástil
     * + pluma que gira lentamente + gancho que sube y baja simulando trabajo.
     */
    _buildCranes() {
        const craneMat = new THREE.MeshStandardMaterial({ color: 0xf5b942, roughness: 0.5, metalness: 0.4 });
        const cabinMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.6 });
        const cableMat = new THREE.LineBasicMaterial({ color: 0x94a3b8 });

        this.cranes = [];

        for (let i = 0; i < 3; i++) {
            const angle = (i / 3) * Math.PI * 2 + Math.random();
            const radius = 20 + Math.random() * 12;
            const cx = this.cityCenter.x + Math.cos(angle) * radius;
            const cz = this.cityCenter.z + Math.sin(angle) * radius;
            const mastHeight = 28 + Math.random() * 8;

            const craneRoot = new THREE.Group();
            craneRoot.position.set(cx, 0, cz);

            // Mástil vertical
            const mast = new THREE.Mesh(new THREE.BoxGeometry(0.5, mastHeight, 0.5), craneMat);
            mast.position.y = mastHeight / 2;
            craneRoot.add(mast);

            // Cabina + pluma (grupo que rota para simular la grúa trabajando)
            const jibGroup = new THREE.Group();
            jibGroup.position.y = mastHeight;
            craneRoot.add(jibGroup);

            const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.9), cabinMat);
            jibGroup.add(cabin);

            const jibLen = 11;
            const jib = new THREE.Mesh(new THREE.BoxGeometry(jibLen, 0.35, 0.35), craneMat);
            jib.position.set(jibLen / 2 - 1, 0.4, 0);
            jibGroup.add(jib);

            const counterJib = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.35, 0.35), craneMat);
            counterJib.position.set(-2.5, 0.4, 0);
            jibGroup.add(counterJib);

            const counterWeight = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), cabinMat);
            counterWeight.position.set(-4, 0, 0);
            jibGroup.add(counterWeight);

            // Cable + gancho (se mueve verticalmente)
            const hookAnchorX = jibLen - 2;
            const cableGeo = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(hookAnchorX, 0.4, 0), new THREE.Vector3(hookAnchorX, -6, 0)
            ]);
            const cable = new THREE.Line(cableGeo, cableMat);
            jibGroup.add(cable);

            const hook = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), cabinMat);
            hook.position.set(hookAnchorX, -6, 0);
            jibGroup.add(hook);

            this.scene.add(craneRoot);
            this.cranes.push({
                jibGroup, cable, hook, cableGeo, hookAnchorX,
                rotSpeed: (Math.random() > 0.5 ? 1 : -1) * (0.05 + Math.random() * 0.05),
                hookPhase: Math.random() * Math.PI * 2
            });
        }
    }

    /**
     * Pequeños vehículos de obra recorriendo las avenidas principales, para
     * dar más movimiento a nivel de calle.
     */
    _buildTraffic() {
        const vehicleMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.5, metalness: 0.3 });
        this.vehicles = [];

        for (let i = 0; i < 5; i++) {
            const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 0.8), vehicleMat);
            body.position.y = 0.4;
            this.scene.add(body);

            this.vehicles.push({
                mesh: body,
                radius: 18 + i * 6,
                speed: 0.08 + Math.random() * 0.06,
                phase: Math.random() * Math.PI * 2,
                dir: Math.random() > 0.5 ? 1 : -1
            });
        }
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
     * proyectos (uno por proyecto), sobrevolando el clúster de torres.
     */
    _rebuildDrones(projects) {
        if (!this.armMat) {
            this.armMat = new THREE.MeshStandardMaterial({ color: 0x18202f, roughness: 0.6, metalness: 0.5 });
            this.rotorMat = new THREE.MeshStandardMaterial({ color: 0x3a4a63, transparent: true, opacity: 0.5, roughness: 0.3 });
        }

        this.nodes.forEach(n => this.droneGroup.remove(n.group));
        this.nodes = [];

        const list = projects.length > 0
            ? projects.map(p => ({ id: p.id, level: p.level }))
            : Array.from({ length: 10 }, (_, i) => ({ id: `PLACEHOLDER-${i}`, level: null }));

        list.forEach((p) => {
            const colorHex = this._levelColor(p.level);
            const { group, rotors, light, bodyMat } = this._createDrone(colorHex);

            const angle = Math.random() * Math.PI * 2;
            const radius = 8 + Math.random() * 34;
            const base = new THREE.Vector3(
                this.cityCenter.x + Math.cos(angle) * radius,
                14 + Math.random() * 20,
                this.cityCenter.z + Math.sin(angle) * radius
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

        // --- Vuelo de los drones (flotación + deriva + hélices + banqueo) ---
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

        // --- Recorrido continuo de la cámara: órbita alrededor de la ciudad,
        // subiendo y bajando entre vista a nivel de calle y vista aérea ---
        const orbitAngle = t * 0.045;
        const orbitRadius = 58 + Math.sin(t * 0.05) * 22;
        const altitude = 22 + Math.sin(t * 0.065) * 18; // sube/baja: calle <-> aérea

        const flightX = this.cityCenter.x + Math.cos(orbitAngle) * orbitRadius;
        const flightZ = this.cityCenter.z + Math.sin(orbitAngle) * orbitRadius;

        // Paralaje del mouse, como capa extra sutil sobre el recorrido
        const mouseOffsetX = this.mouse.x * 6;
        const mouseOffsetY = -this.mouse.y * 4;

        this.camera.position.x += (flightX + mouseOffsetX - this.camera.position.x) * 0.02;
        this.camera.position.y += (altitude + mouseOffsetY - this.camera.position.y) * 0.02;
        this.camera.position.z += (flightZ - this.camera.position.z) * 0.02;
        this.camera.lookAt(this.cityCenter.x, altitude * 0.25, this.cityCenter.z);

        // Rotación lenta del clúster completo, para reforzar la sensación de movimiento
        if (this.cityGroup) this.cityGroup.rotation.y = Math.sin(t * 0.02) * 0.04;

        // --- Árboles: leve balanceo, como si los moviera el viento ---
        if (this.trees) {
            this.trees.forEach(tr => {
                tr.group.rotation.z = Math.sin(t * 0.8 + tr.phase) * 0.05;
            });
        }

        // --- Grúas de construcción: la pluma gira y el gancho sube/baja trabajando ---
        if (this.cranes) {
            this.cranes.forEach(c => {
                c.jibGroup.rotation.y += c.rotSpeed * 0.016;

                const hookY = -3 - (Math.sin(t * 0.6 + c.hookPhase) * 0.5 + 0.5) * 5;
                c.hook.position.y = hookY;
                const positions = c.cableGeo.attributes.position;
                positions.setY(1, hookY + 0.4);
                positions.needsUpdate = true;
            });
        }

        // --- Vehículos de obra: recorren las avenidas en bucle ---
        if (this.vehicles) {
            this.vehicles.forEach(v => {
                const a = t * v.speed * v.dir + v.phase;
                v.mesh.position.set(
                    this.cityCenter.x + Math.cos(a) * v.radius,
                    0.4,
                    this.cityCenter.z + Math.sin(a) * v.radius
                );
                v.mesh.rotation.y = -a + (v.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
            });
        }

        this.renderer.render(this.scene, this.camera);
    }

    setTheme(theme) {
        if (!this.renderer) return;
        this.renderer.domElement.style.opacity = theme === 'dark' ? '0.92' : '0.32';
    }
}
