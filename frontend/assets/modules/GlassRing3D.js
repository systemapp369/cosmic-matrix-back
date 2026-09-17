/**
 * GlassRing3D.js
 * Anillos de progreso en 3D con material de VIDRIO real (THREE.MeshPhysicalMaterial
 * con transmission/clearcoat, no un truco visual), para el Panel de Indicadores.
 * Mismo patrón seguro que Gauge3D: un mini WebGLRenderer independiente dentro de
 * cada contenedor (nada de cálculos manuales de posición en pantalla).
 *
 * Requiere que <script src=".../three.min.js"></script> esté cargado antes.
 */
class GlassRing3D {
    constructor() {
        this.instances = new Map(); // elementId -> instancia
        this._animate = this._animate.bind(this);
        requestAnimationFrame(this._animate);
    }

    /**
     * Registra/actualiza el anillo de vidrio de un elemento del DOM.
     * @param {string} elementId - id del div contenedor
     * @param {number} percent - 0 a 100
     * @param {string} colorHex - color de criticidad del proyecto
     */
    register(elementId, percent, colorHex) {
        const currentEl = document.getElementById(elementId);
        if (!currentEl) return;

        let inst = this.instances.get(elementId);

        // Si el HTML del panel se reconstruyó (innerHTML), el <div> original
        // fue reemplazado por uno NUEVO con el mismo id. La instancia vieja
        // sigue "viva" en el mapa pero apunta a un nodo ya desconectado del
        // DOM — hay que descartarla y crear una nueva sobre el nodo actual.
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

        inst.percent = percent;
        inst.colorHex = colorHex;
        this._applyValue(inst);
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
        const height = container.clientHeight || 100;
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
        const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 20);
        camera.position.set(0, 2.1, 3.6);
        camera.lookAt(0, 0, 0);

        // Luces: una blanca principal + una de "acento" con el color de criticidad,
        // necesarias para que el vidrio (clearcoat + transmisión) luzca real.
        scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        const keyLight = new THREE.PointLight(0xffffff, 1.8, 30);
        keyLight.position.set(2, 3, 4);
        scene.add(keyLight);
        const accentLight = new THREE.PointLight(0xffffff, 1.4, 30);
        accentLight.position.set(-2, -1, 3);
        scene.add(accentLight);

        const ringGroup = new THREE.Group();
        ringGroup.rotation.x = Math.PI / 2.5;
        scene.add(ringGroup);

        // Pista de fondo: vidrio esmerilado tenue, neutro
        const trackMesh = new THREE.Mesh(
            new THREE.TorusGeometry(1, 0.09, 20, 80),
            new THREE.MeshPhysicalMaterial({
                color: 0xaeb9cc, transparent: true, opacity: 0.18,
                roughness: 0.25, transmission: 0.55, thickness: 0.4,
                clearcoat: 1, clearcoatRoughness: 0.15, ior: 1.45
            })
        );
        ringGroup.add(trackMesh);

        // Arco de progreso: vidrio de color real (criticidad), con clearcoat brillante
        const progressMesh = new THREE.Mesh(
            new THREE.TorusGeometry(1, 0.115, 20, 80, 0.001),
            new THREE.MeshPhysicalMaterial({
                color: 0x22d3ee, transparent: true, opacity: 0.72,
                roughness: 0.1, transmission: 0.4, thickness: 0.5,
                clearcoat: 1, clearcoatRoughness: 0.05, ior: 1.5,
                emissive: 0x22d3ee, emissiveIntensity: 0.25
            })
        );
        ringGroup.add(progressMesh);

        // Disco de fondo, muy tenue, solo para dar algo de profundidad detrás del vidrio
        const backDisc = new THREE.Mesh(
            new THREE.CircleGeometry(1.05, 48),
            new THREE.MeshBasicMaterial({ color: 0x0b1830, transparent: true, opacity: 0.25 })
        );
        backDisc.position.z = -0.06;
        ringGroup.add(backDisc);

        return {
            container, renderer, scene, camera, ringGroup, progressMesh, accentLight,
            percent: 0, colorHex: '#22d3ee', arcCache: new Map()
        };
    }

    _getArcGeometry(inst, percent) {
        const key = Math.max(0, Math.min(100, Math.round(percent)));
        if (!inst.arcCache.has(key)) {
            const arc = Math.max(0.001, (key / 100) * Math.PI * 2 - 0.001);
            inst.arcCache.set(key, new THREE.TorusGeometry(1, 0.115, 20, 80, arc));
        }
        return inst.arcCache.get(key);
    }

    _applyValue(inst) {
        inst.progressMesh.geometry = this._getArcGeometry(inst, inst.percent);
        inst.progressMesh.material.color.set(inst.colorHex);
        inst.progressMesh.material.emissive.set(inst.colorHex);
        inst.accentLight.color.set(inst.colorHex);
    }

    _animate(ts) {
        requestAnimationFrame(this._animate);
        this.instances.forEach(inst => {
            if (!inst.container.isConnected) return;
            inst.ringGroup.rotation.z = ts * 0.0001;
            inst.renderer.render(inst.scene, inst.camera);
        });
    }
}
