/**
 * Gauge3D.js
 * Gauges EN 3D real para cada tarjeta de proyecto. A diferencia del primer
 * intento (un solo canvas gigante con "scissor/viewport" recortado por
 * tarjeta, que resultó frágil y con bugs de posicionamiento), esta versión
 * crea un mini WebGLRenderer independiente DENTRO de cada contenedor
 * "gauge-<id>", aprovechando el flujo normal del navegador para el tamaño y
 * la posición — nada de cálculos manuales de coordenadas en pantalla.
 *
 * Con pocas tarjetas visibles a la vez (paginación ya limita esto), el
 * número de contextos WebGL creados está muy por debajo del límite típico
 * de los navegadores (~16 o más), así que es seguro en la práctica.
 *
 * Requiere que <script src=".../three.min.js"></script> esté cargado antes.
 */
class Gauge3D {
    constructor() {
        this.instances = new Map(); // elementId -> instancia { renderer, scene, camera, ... }
        this._animate = this._animate.bind(this);
        requestAnimationFrame(this._animate);
    }

    /**
     * Registra/actualiza el gauge de un elemento del DOM. Si el contenedor
     * todavía no tenía un gauge, lo crea; si ya existía, solo actualiza el
     * valor y el color.
     * @param {string} elementId - id del div contenedor (ej. 'gauge-NODE-001')
     * @param {number} percent - 0 a 100
     * @param {string} colorHex - color de criticidad del proyecto
     */
    register(elementId, percent, colorHex) {
        let inst = this.instances.get(elementId);

        if (!inst) {
            const container = document.getElementById(elementId);
            if (!container) return;
            inst = this._createInstance(container);
            if (!inst) return;
            this.instances.set(elementId, inst);
        }

        inst.percent = percent;
        inst.colorHex = colorHex;
        this._applyValue(inst);
    }

    /**
     * Elimina y libera (dispose) cualquier gauge que ya no esté activo
     * (ej. tras cambiar de página o filtrar proyectos).
     */
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
        const width = container.clientWidth || 140;
        const height = container.clientHeight || 140;
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
        const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 20);
        camera.position.set(0, 2.3, 3.6);
        camera.lookAt(0, 0, 0);

        scene.add(new THREE.AmbientLight(0xffffff, 0.75));
        const pointLight = new THREE.PointLight(0xffffff, 1.6, 30);
        pointLight.position.set(2, 3, 4);
        scene.add(pointLight);

        const ringGroup = new THREE.Group();
        ringGroup.rotation.x = Math.PI / 2.5;
        scene.add(ringGroup);

        // Pista de fondo (track) del anillo
        const trackMesh = new THREE.Mesh(
            new THREE.TorusGeometry(1, 0.085, 16, 72),
            new THREE.MeshStandardMaterial({ color: 0x2a3549, transparent: true, opacity: 0.55, roughness: 0.6, metalness: 0.3 })
        );
        ringGroup.add(trackMesh);

        // Arco de progreso (geometría real, no relleno CSS)
        const progressMesh = new THREE.Mesh(
            new THREE.TorusGeometry(1, 0.105, 16, 72, 0.001),
            new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x22d3ee, emissiveIntensity: 0.85, roughness: 0.3, metalness: 0.5 })
        );
        ringGroup.add(progressMesh);

        // Marcas tipo carátula alrededor del anillo
        const tickMat = new THREE.MeshBasicMaterial({ color: 0x64748b });
        for (let i = 0; i < 24; i++) {
            const tick = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.14, 0.018), tickMat);
            const a = (i / 24) * Math.PI * 2;
            tick.position.set(Math.cos(a) * 1.24, Math.sin(a) * 1.24, 0);
            tick.rotation.z = a;
            ringGroup.add(tick);
        }

        // Disco de fondo sutil, para dar profundidad detrás del anillo
        const backDisc = new THREE.Mesh(
            new THREE.CircleGeometry(1.1, 48),
            new THREE.MeshBasicMaterial({ color: 0x0b1830, transparent: true, opacity: 0.35 })
        );
        backDisc.position.z = -0.05;
        ringGroup.add(backDisc);

        return {
            container, renderer, scene, camera, ringGroup, progressMesh, pointLight,
            percent: 0, colorHex: '#22d3ee', arcCache: new Map()
        };
    }

    _getArcGeometry(inst, percent) {
        const key = Math.max(0, Math.min(100, Math.round(percent)));
        if (!inst.arcCache.has(key)) {
            const arc = Math.max(0.001, (key / 100) * Math.PI * 2 - 0.001);
            inst.arcCache.set(key, new THREE.TorusGeometry(1, 0.105, 16, 72, arc));
        }
        return inst.arcCache.get(key);
    }

    _applyValue(inst) {
        inst.progressMesh.geometry = this._getArcGeometry(inst, inst.percent);
        inst.progressMesh.material.color.set(inst.colorHex);
        inst.progressMesh.material.emissive.set(inst.colorHex);
        inst.pointLight.color.set(inst.colorHex);
    }

    _animate(ts) {
        requestAnimationFrame(this._animate);
        this.instances.forEach(inst => {
            // Verifica que el contenedor siga visible/en el DOM; si ya no
            // está (ej. se cerró un modal o cambió la vista), no renderiza.
            if (!inst.container.isConnected) return;
            inst.ringGroup.rotation.z = ts * 0.00012;
            inst.renderer.render(inst.scene, inst.camera);
        });
    }
}
