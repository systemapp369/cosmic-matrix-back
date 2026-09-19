/**
 * HexTower3D.js
 * Torres hexagonales en 3D real (prismas de 6 caras, THREE.CylinderGeometry
 * con radialSegments=6), una por proyecto: la altura representa su % de
 * avance y el color su criticidad (en tono pastel). Remate superior en
 * blanco/crema, como en la referencia isométrica.
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
        const camera = new THREE.PerspectiveCamera(28, width / height, 0.1, 20);
        camera.position.set(2.2, 1.6, 3.2);
        camera.lookAt(0, -0.2, 0);

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
        // Reconstruye el prisma hexagonal con la altura correspondiente al %
        if (inst.tower) {
            inst.towerGroup.remove(inst.tower);
            inst.tower.children.forEach(c => { c.geometry.dispose(); c.material.dispose(); });
        }

        const h = 0.6 + (inst.percent / 100) * 2.4;
        const radius = 0.62;

        const sideMat = new THREE.MeshStandardMaterial({ color: inst.colorHex, roughness: 0.45, metalness: 0.15 });
        const capMat = new THREE.MeshStandardMaterial({ color: 0xfdfdfd, roughness: 0.5, metalness: 0.05 });

        const geo = new THREE.CylinderGeometry(radius, radius, h, 6, 1, false);
        const tower = new THREE.Mesh(geo, [sideMat, capMat, capMat]);
        tower.position.y = h / 2 - 1.5;

        const group = new THREE.Group();
        group.add(tower);

        const edges = new THREE.LineSegments(
            new THREE.EdgesGeometry(geo),
            new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 })
        );
        edges.position.copy(tower.position);
        group.add(edges);

        inst.towerGroup.add(group);
        inst.tower = group;
    }

    _animate() {
        requestAnimationFrame(this._animate);
        this.instances.forEach(inst => {
            if (!inst.container.isConnected) return;
            inst.towerGroup.rotation.y += 0.003;
            inst.renderer.render(inst.scene, inst.camera);
        });
    }
}
