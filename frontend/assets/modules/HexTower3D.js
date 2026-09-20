/**
 * HexTower3D.js
 * "Torres" en 3D real: un contenedor hexagonal de altura fija (representa
 * 100%), relleno con líquido de color hasta el % real de avance, y VIDRIO
 * real (MeshPhysicalMaterial) en la parte vacía de arriba. La superficie del
 * líquido tiene un ligero vaivén animado (oleaje). Sin rotación continua,
 * para que se puedan apreciar bien de frente.
 *
 * Mismo patrón seguro que Gauge3D/GlassRing3D: un mini WebGLRenderer
 * independiente dentro de cada contenedor, sin cálculos manuales de
 * posición en pantalla, y detectando contenedores reemplazados por
 * innerHTML para reconstruir la instancia cuando haga falta.
 *
 * Requiere que <script src=".../three.min.js"></script> esté cargado antes.
 */
class HexTower3D {
    constructor() {
        this.instances = new Map();
        this._animate = this._animate.bind(this);
        requestAnimationFrame(this._animate);
    }

    register(elementId, percent, colorHex) {
        const currentEl = document.getElementById(elementId);
        if (!currentEl) return;

        let inst = this.instances.get(elementId);

        if (inst && (inst.container !== currentEl || !inst.container.isConnected)) {
            inst.renderer.dispose();
            if (inst.renderer.domElement.parentNode) {
                inst.renderer.domElement.parentNode.removeChild(inst.renderer.domElement);
            }
            this.instances.delete(elementId);
            inst = null;
        }

        if (!inst) {
            inst = this._createInstance(currentEl);
            if (!inst) return;
            this.instances.set(elementId, inst);
        }

        if (!inst.initialized || inst.percent !== percent || inst.colorHex !== colorHex) {
            inst.percent = percent;
            inst.colorHex = colorHex;
            inst.initialized = true;
            this._applyValue(inst);
        }
    }

    pruneTo(activeIds) {
        for (const [id, inst] of this.instances.entries()) {
            if (!activeIds.includes(id)) {
                inst.renderer.dispose();
                if (inst.renderer.domElement.parentNode) {
                    inst.renderer.domElement.parentNode.removeChild(inst.renderer.domElement);
                }
                this.instances.delete(id);
            }
        }
    }

    _createInstance(container) {
        const width = container.clientWidth || 100;
        const height = container.clientHeight || 180;
        if (width < 2 || height < 2) return null;

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(width, height);
        renderer.setClearColor(0x000000, 0);
        renderer.domElement.style.cssText = 'position:absolute; inset:0; width:100%; height:100%; pointer-events:none;';

        if (getComputedStyle(container).position === 'static') {
            container.style.position = 'relative';
        }
        container.insertBefore(renderer.domElement, container.firstChild);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(22, width / height, 0.1, 20);
        camera.position.set(2.6, 1.9, 2.6);
        camera.lookAt(0, -0.15, 0);

        scene.add(new THREE.AmbientLight(0xffffff, 0.85));
        const key = new THREE.DirectionalLight(0xffffff, 0.9);
        key.position.set(3, 5, 4);
        scene.add(key);
        const fill = new THREE.PointLight(0xffffff, 0.6, 20);
        fill.position.set(-2, 1, 3);
        scene.add(fill);

        const towerGroup = new THREE.Group();
        scene.add(towerGroup);

        // Base/sombra suave bajo la torre
        const shadowDisc = new THREE.Mesh(
            new THREE.CircleGeometry(0.85, 32),
            new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.08 })
        );
        shadowDisc.rotation.x = -Math.PI / 2;
        shadowDisc.position.y = -1.55;
        towerGroup.add(shadowDisc);

        return {
            container, renderer, scene, camera, towerGroup,
            percent: 0, colorHex: '#60a5fa', tower: null, initialized: false
        };
    }

    _applyValue(inst) {
        // Reconstruye el contenedor: líquido de color (según %) + vidrio real
        // arriba, con una superficie que "ondula" ligeramente (oleaje).
        if (inst.tower) {
            inst.towerGroup.remove(inst.tower);
            inst.tower.traverse(c => {
                if (c.geometry) c.geometry.dispose();
                if (c.material) c.material.dispose();
            });
        }

        const maxH = 3.0; // altura fija del "contenedor" (representa 100%)
        const fillH = Math.max(0.08, (inst.percent / 100) * maxH);
        const radius = 0.62;
        const baseY = -1.5;

        const group = new THREE.Group();

        // --- Líquido de color, hasta la altura del % ---
        const liquidMat = new THREE.MeshStandardMaterial({
            color: inst.colorHex, roughness: 0.35, metalness: 0.15,
            emissive: inst.colorHex, emissiveIntensity: 0.12
        });
        const liquidGeo = new THREE.CylinderGeometry(radius, radius, fillH, 6, 1, false);
        const liquid = new THREE.Mesh(liquidGeo, liquidMat);
        liquid.position.y = baseY + fillH / 2;
        group.add(liquid);

        // --- Vidrio real en la parte vacía (arriba del líquido) ---
        const glassH = Math.max(0.001, maxH - fillH);
        if (glassH > 0.02) {
            const glassMat = new THREE.MeshPhysicalMaterial({
                color: 0xdfeaf7, transparent: true, opacity: 0.35,
                roughness: 0.1, transmission: 0.7, thickness: 0.4,
                clearcoat: 1, clearcoatRoughness: 0.05, ior: 1.45
            });
            const glassGeo = new THREE.CylinderGeometry(radius, radius, glassH, 6, 1, false);
            const glass = new THREE.Mesh(glassGeo, glassMat);
            glass.position.y = baseY + fillH + glassH / 2;
            group.add(glass);

            const glassEdges = new THREE.LineSegments(
                new THREE.EdgesGeometry(glassGeo),
                new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 })
            );
            glassEdges.position.copy(glass.position);
            group.add(glassEdges);
        }

        // --- Superficie del líquido (oleaje): disco que "respira" con el tiempo ---
        const waveMat = new THREE.MeshStandardMaterial({
            color: inst.colorHex, roughness: 0.25, metalness: 0.1,
            emissive: inst.colorHex, emissiveIntensity: 0.35, transparent: true, opacity: 0.9
        });
        const wave = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.98, 24), waveMat);
        wave.rotation.x = -Math.PI / 2;
        wave.position.y = baseY + fillH + 0.01;
        group.add(wave);

        const edges = new THREE.LineSegments(
            new THREE.EdgesGeometry(liquidGeo),
            new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2 })
        );
        edges.position.copy(liquid.position);
        group.add(edges);

        inst.towerGroup.add(group);
        inst.tower = group;
        inst.wave = wave;
        inst.wavePhase = Math.random() * Math.PI * 2;
        inst.waveBaseY = wave.position.y;
    }

    _animate(ts) {
        requestAnimationFrame(this._animate);
        const t = (ts || 0) * 0.001;
        this.instances.forEach(inst => {
            if (!inst.container.isConnected) return;
            // Sin rotación: las torres quedan fijas para poder apreciarlas bien.
            // El "oleaje" se simula con un ligero vaivén vertical + brillo pulsante
            // en la superficie del líquido.
            if (inst.wave) {
                const bob = Math.sin(t * 1.6 + inst.wavePhase) * 0.025;
                inst.wave.position.y = inst.waveBaseY + bob;
                inst.wave.material.emissiveIntensity = 0.3 + Math.sin(t * 2 + inst.wavePhase) * 0.1;
            }
            inst.renderer.render(inst.scene, inst.camera);
        });
    }
}
