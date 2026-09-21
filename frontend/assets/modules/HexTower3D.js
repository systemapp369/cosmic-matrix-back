/**
 * HexTower3D.js
 * "Torres" en 3D real, ahora en formato CILINDRO liso (32 segmentos) con
 * acabado "ejecutivo premium": degradado de color vertical (textura
 * generada por código), remates metálicos/cromados arriba y abajo, un
 * destello especular sutil (streak) como en renders de producto, e
 * iluminación de 3 puntos (key + fill + rim) para que luzca profesional.
 *
 * El contenedor tiene altura fija (representa 100%), relleno con líquido de
 * color hasta el % real de avance, y VIDRIO real (MeshPhysicalMaterial) en
 * la parte vacía de arriba, con oleaje animado en la superficie. Sin
 * rotación continua, para que se puedan apreciar bien de frente.
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
        this._textureCache = new Map();
        this._animate = this._animate.bind(this);
        requestAnimationFrame(this._animate);
    }

    register(elementId, percent, colorHex, secondColorHex) {
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

        const finalSecondColor = secondColorHex || colorHex;
        if (!inst.initialized || inst.percent !== percent || inst.colorHex !== colorHex || inst.secondColorHex !== finalSecondColor) {
            inst.secondColorHex = finalSecondColor;
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

    /**
     * Textura de degradado vertical (más clara arriba, más rica abajo) para
     * el color del líquido — look "glass tube" premium en vez de color plano.
     * Se cachea por color para no regenerar canvas de más.
     */
    _getGradientTexture(colorHex, secondColorHex) {
        if (this._textureCache.has(colorHex + secondColorHex)) return this._textureCache.get(colorHex + secondColorHex);

        const canvas = document.createElement('canvas');
        canvas.width = 8;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        const c1 = new THREE.Color(colorHex);
        const c2 = new THREE.Color(secondColorHex || colorHex);
        const top = c1.clone().lerp(new THREE.Color(0xffffff), 0.18);
        const bottom = c2.clone().lerp(new THREE.Color(0x000000), 0.08);

        const grad = ctx.createLinearGradient(0, 0, 0, 256);
        grad.addColorStop(0, `#${top.getHexString()}`);
        grad.addColorStop(0.5, `#${c1.getHexString()}`);
        grad.addColorStop(0.55, `#${c2.getHexString()}`);
        grad.addColorStop(1, `#${bottom.getHexString()}`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 8, 256);

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        this._textureCache.set(colorHex + secondColorHex, texture);
        return texture;
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

        // Iluminación de 3 puntos: key (principal), fill (relleno) y rim (contorno)
        scene.add(new THREE.AmbientLight(0xffffff, 0.55));
        const key = new THREE.DirectionalLight(0xffffff, 1);
        key.position.set(3, 5, 4);
        scene.add(key);
        const fillLight = new THREE.PointLight(0xffffff, 0.5, 20);
        fillLight.position.set(-2.5, 0.5, 2.5);
        scene.add(fillLight);
        const rim = new THREE.PointLight(0x8fd6ff, 0.7, 20);
        rim.position.set(-1, 3, -2.5);
        scene.add(rim);

        const towerGroup = new THREE.Group();
        scene.add(towerGroup);

        // Base/sombra suave bajo la torre
        const shadowDisc = new THREE.Mesh(
            new THREE.CircleGeometry(0.85, 32),
            new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.1 })
        );
        shadowDisc.rotation.x = -Math.PI / 2;
        shadowDisc.position.y = -1.56;
        towerGroup.add(shadowDisc);

        return {
            container, renderer, scene, camera, towerGroup,
            percent: 0, colorHex: '#60a5fa', tower: null, initialized: false
        };
    }

    _applyValue(inst) {
        if (inst.tower) {
            inst.towerGroup.remove(inst.tower);
            inst.tower.traverse(c => {
                if (c.geometry) c.geometry.dispose();
                if (c.material && !c.material.map) c.material.dispose();
            });
        }

        const maxH = 3.0; // altura fija del "contenedor" (representa 100%)
        const fillH = Math.max(0.08, (inst.percent / 100) * maxH);
        const radius = 0.55;
        const baseY = -1.5;
        const radialSegments = 32;

        const group = new THREE.Group();

        // --- Líquido de color con degradado vertical de DOS tonos (más vivo) ---
        const liquidMat = new THREE.MeshPhysicalMaterial({
            map: this._getGradientTexture(inst.colorHex, inst.secondColorHex),
            emissive: inst.colorHex, emissiveIntensity: 0.22,
            roughness: 0.22, metalness: 0.12, clearcoat: 0.7, clearcoatRoughness: 0.15
        });
        const liquidGeo = new THREE.CylinderGeometry(radius, radius, fillH, radialSegments, 1, false);
        const liquid = new THREE.Mesh(liquidGeo, liquidMat);
        liquid.position.y = baseY + fillH / 2;
        group.add(liquid);

        // --- Destello especular (streak), como en renders de producto ---
        const streak = new THREE.Mesh(
            new THREE.PlaneGeometry(0.05, fillH * 0.75),
            new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, side: THREE.DoubleSide })
        );
        streak.position.set(radius * 0.62, baseY + fillH / 2, radius * 0.62);
        streak.rotation.y = Math.PI / 4;
        group.add(streak);

        // --- Remates con el color de la torre (no gris/cromado, para más viveza) ---
        const rimMat = new THREE.MeshStandardMaterial({ color: inst.colorHex, roughness: 0.3, metalness: 0.55 });
        const topRim = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.03, radius * 1.03, 0.045, radialSegments), rimMat);
        topRim.position.y = baseY + fillH + 0.02;
        group.add(topRim);
        const baseRim = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.05, radius * 1.05, 0.05, radialSegments), rimMat);
        baseRim.position.y = baseY - 0.02;
        group.add(baseRim);

        // --- Vidrio en la parte vacía: SIN "transmission" (en un canvas con
        // fondo transparente no tiene nada detrás que refractar y termina
        // viéndose negro sólido). Vidrio simple translúcido + brillo. ---
        const glassH = Math.max(0.001, maxH - fillH);
        if (glassH > 0.02) {
            const glassMat = new THREE.MeshPhysicalMaterial({
                color: 0xeaf3fb, transparent: true, opacity: 0.22,
                roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05,
                metalness: 0, side: THREE.DoubleSide
            });
            const glassGeo = new THREE.CylinderGeometry(radius, radius, glassH, radialSegments, 1, false);
            const glass = new THREE.Mesh(glassGeo, glassMat);
            glass.position.y = baseY + fillH + glassH / 2;
            group.add(glass);

            const capMat = new THREE.MeshStandardMaterial({ color: 0xf4f8fc, roughness: 0.2, metalness: 0.3, transparent: true, opacity: 0.85 });
            const topCap = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.03, radialSegments), capMat);
            topCap.position.y = baseY + maxH;
            group.add(topCap);
        }

        // --- Superficie del líquido (oleaje): disco que "respira" con el tiempo ---
        const waveMat = new THREE.MeshStandardMaterial({
            color: inst.colorHex, roughness: 0.2, metalness: 0.1,
            emissive: inst.colorHex, emissiveIntensity: 0.35, transparent: true, opacity: 0.92
        });
        const wave = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.97, radialSegments), waveMat);
        wave.rotation.x = -Math.PI / 2;
        wave.position.y = baseY + fillH + 0.01;
        group.add(wave);

        inst.towerGroup.add(group);
        inst.tower = group;
        inst.wave = wave;
        inst.streak = streak;
        inst.wavePhase = Math.random() * Math.PI * 2;
        inst.waveBaseY = wave.position.y;
    }

    _animate(ts) {
        requestAnimationFrame(this._animate);
        const t = (ts || 0) * 0.001;
        this.instances.forEach(inst => {
            if (!inst.container.isConnected) return;
            // Sin rotación: las torres quedan fijas para poder apreciarlas bien.
            // El "oleaje" se simula con un ligero vaivén vertical + brillo
            // pulsante en la superficie del líquido, más un leve parpadeo del
            // destello especular para dar sensación de vida.
            if (inst.wave) {
                const bob = Math.sin(t * 1.6 + inst.wavePhase) * 0.025;
                inst.wave.position.y = inst.waveBaseY + bob;
                inst.wave.material.emissiveIntensity = 0.3 + Math.sin(t * 2 + inst.wavePhase) * 0.1;
            }
            if (inst.streak) {
                inst.streak.material.opacity = 0.28 + Math.sin(t * 1.2 + inst.wavePhase) * 0.08;
            }
            inst.renderer.render(inst.scene, inst.camera);
        });
    }
}
