/**
 * GlassRing3D.js (parche visual 2026-09-14)
 *
 * Anillos de progreso en VIDRIO 3D con material físico real
 * (MeshPhysicalMaterial con transmission / iridescence / clearcoat / sheen),
 * IBL (environment map PMREM generado proceduralmente), tone mapping
 * ACESFilmic, animación de valor y color, partículas fluyentes y halo
 * aditivo. Mismo patrón seguro que Gauge3D: cada anillo en su propio
 * WebGLRenderer, env map compartido construido una sola vez.
 *
 * Cleanup del bug anterior PRESERVADO byte-a-byte:
 *   - register() valida que el <div> cacheado siga siendo el mismo nodo vivo
 *     (si no, dispose + recrear).
 *   - pruneTo() elimina instancias cuyo contenedor ya no esté conectado.
 *   - _disposeInstance() libera geometrías, materiales, canvas y contexto WebGL.
 *   - IntersectionObserver pausa el render cuando el anillo sale del viewport.
 *
 * Requiere: <script src=".../three.min.js"></script> antes (three >= 0.152
 * para iridescence / outputColorSpace).
 */
class GlassRing3D {
    constructor() {
        this.instances = new Map();          // elementId -> inst
        this.disposedIds = new Set();         // ids sin contenedor
        this._visibleSet = new Set();         // ids actualmente visibles
        this._envMap = null;                  // PMREM env map (compartido, lazy)

        this._io = ('IntersectionObserver' in window)
            ? new IntersectionObserver((entries) => this._onIntersect(entries),
                { threshold: 0.01 })
            : null;

        this._animate = this._animate.bind(this);
        requestAnimationFrame(this._animate);
    }

    /**
     * Registra/actualiza el anillo de vidrio de un elemento del DOM.
     * Es seguro llamarlo tras un innerHTML que haya reemplazado el <div>.
     * Si percent o colorHex cambiaron respecto al último registro, se inicia
     * una animación suave (700 ms valor / 500 ms color) hacia el nuevo estado.
     */
    register(elementId, percent, colorHex) {
        const liveContainer = document.getElementById(elementId);
        if (!liveContainer) {
            // El <div> no existe en este momento (refresh muy rápido o error)
            this._disposeById(elementId);
            return;
        }

        let inst = this.instances.get(elementId);
        const isStale = inst && (!inst.container.isConnected || inst.container !== liveContainer);

        if (!inst || isStale) {
            if (inst) this._disposeInstance(inst);
            inst = this._createInstance(liveContainer, elementId);
            if (!inst) return;
            this.instances.set(elementId, inst);
            if (this._io) this._io.observe(liveContainer);
            // ----- Snap inicial sin animación cuando recién se crea -----
            this._applyInitialValue(inst, percent, colorHex);
        } else {
            const now = performance.now();
            const valueChanged = inst.targetPercent !== percent;
            const colorChanged = inst.colorHex !== colorHex;
            if (valueChanged) {
                inst.startPercent = inst.percent;
                inst.targetPercent = percent;
                inst.animStart = now;
                inst.lastIntP = -1;             // fuerza recálculo de geometría
            }
            if (colorChanged) {
                inst.startColorObj.copy(inst.progressMesh.material.color);
                inst.targetColorObj.set(colorHex);
                inst.colorAnimStart = now;
                inst.colorHex = colorHex;
            }
        }
        // 3. Asegurar tamaño correcto si el contenedor cambió de medidas
        this._fitIfResized(inst);
    }

    /**
     * Quita del cache las instancias que ya no correspondan a la lista activa.
     * Llamar después de renderizar la lista de proyectos.
     */
    pruneTo(activeIds) {
        const keep = new Set(activeIds);
        for (const [id, inst] of Array.from(this.instances.entries())) {
            if (!keep.has(id) || !inst.container.isConnected) {
                this._disposeInstance(inst);
                this.instances.delete(id);
                this._visibleSet.delete(id);
            }
        }
    }

    /** Crea una nueva instancia: renderer + escena + cámara + geometrías de vidrio. */
    _createInstance(container, elementId) {
        const width = container.clientWidth || 100;
        const height = container.clientHeight || 100;
        if (width < 2 || height < 2) return null;

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(width, height);
        renderer.setClearColor(0x000000, 0);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.15;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.domElement.style.cssText =
            'position:absolute; inset:0; width:100%; height:100%; pointer-events:none; z-index:1;';

        if (getComputedStyle(container).position === 'static') {
            container.style.position = 'relative';
        }
        container.insertBefore(renderer.domElement, container.firstChild);

        const scene = new THREE.Scene();
        // IBL — el environment map compartido da reflejos/transmisión realistas
        if (!this._envMap) this._envMap = this._buildEnvMap(renderer);
        scene.environment = this._envMap;

        const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 20);
        camera.position.set(0, 2.0, 3.5);
        camera.lookAt(0, 0, 0);

        // ============ ILUMINACIÓN 3-PUNTOS + ACENTO ============
        scene.add(new THREE.AmbientLight(0xa8bcd8, 0.4));

        const keyLight = new THREE.PointLight(0xffffff, 2.4, 30);
        keyLight.position.set(2.5, 3.5, 4.0);
        scene.add(keyLight);

        const fillLight = new THREE.PointLight(0x88b4d8, 1.0, 30);
        fillLight.position.set(-2.8, -1.5, 3.0);
        scene.add(fillLight);

        const accentLight = new THREE.PointLight(0x22d3ee, 2.4, 30);
        accentLight.position.set(0, 2.0, 2.5);
        scene.add(accentLight);

        // ============ GRUPO DEL ANILLO ============
        const ringGroup = new THREE.Group();
        ringGroup.rotation.x = Math.PI / 2.5;
        scene.add(ringGroup);

        // ============ PISTA — vidrio esmerilado neutro ============
        const trackMesh = new THREE.Mesh(
            new THREE.TorusGeometry(1, 0.085, 24, 96),
            new THREE.MeshPhysicalMaterial({
                color: 0xd6deeb, transparent: true, opacity: 0.35,
                roughness: 0.22, transmission: 0.65, thickness: 0.5,
                clearcoat: 1, clearcoatRoughness: 0.12, ior: 1.45,
                envMapIntensity: 1.5
            })
        );
        ringGroup.add(trackMesh);

        // ============ ARCO DE PROGRESO — vidrio iridiscente de color ============
        const progressMesh = new THREE.Mesh(
            new THREE.TorusGeometry(1, 0.13, 24, 96, 0.001),
            new THREE.MeshPhysicalMaterial({
                color: 0x22d3ee, transparent: true, opacity: 0.88,
                roughness: 0.04, transmission: 0.55, thickness: 0.7,
                clearcoat: 1, clearcoatRoughness: 0.03, ior: 1.52,
                metalness: 0,
                sheen: 1, sheenRoughness: 0.25, sheenColor: 0xffffff,
                iridescence: 0.5, iridescenceIOR: 1.3,
                iridescenceThicknessRange: [200, 600],
                emissive: 0x22d3ee, emissiveIntensity: 0.55,
                envMapIntensity: 2.0
            })
        );
        ringGroup.add(progressMesh);

        // ============ REBORDES QUE REFUERZAN LA LECTURA "CRISTAL" ============
        const outerRim = new THREE.Mesh(
            new THREE.TorusGeometry(1.085, 0.014, 12, 96),
            new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 })
        );
        ringGroup.add(outerRim);

        const innerRim = new THREE.Mesh(
            new THREE.TorusGeometry(0.915, 0.008, 8, 96),
            new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18 })
        );
        ringGroup.add(innerRim);

        // ============ DISCO DE FONDO (profundidad detrás del vidrio) ============
        const backDisc = new THREE.Mesh(
            new THREE.CircleGeometry(1.06, 48),
            new THREE.MeshBasicMaterial({ color: 0x06101f, transparent: true, opacity: 0.45 })
        );
        backDisc.position.z = -0.07;
        ringGroup.add(backDisc);

        // ============ HALO ADITIVO (aura de color en el borde) ============
        const halo = new THREE.Mesh(
            new THREE.RingGeometry(1.05, 1.25, 64),
            new THREE.MeshBasicMaterial({
                color: 0x22d3ee, transparent: true, opacity: 0.22,
                side: THREE.DoubleSide, blending: THREE.AdditiveBlending
            })
        );
        halo.position.z = -0.02;
        ringGroup.add(halo);

        // ============ PARTÍCULAS FLUYENTES (chispa viva en el arco) ============
        const particleCount = 14;
        const particleGeo = new THREE.SphereGeometry(0.024, 10, 8);
        const particles = [];
        for (let i = 0; i < particleCount; i++) {
            const mat = new THREE.MeshBasicMaterial({
                color: 0xffffff, transparent: true, opacity: 0.92,
                blending: THREE.AdditiveBlending
            });
            const p = new THREE.Mesh(particleGeo, mat);
            p.userData.phase = (i / particleCount) * Math.PI * 2;
            p.userData.speed = 0.85 + Math.random() * 0.3;
            ringGroup.add(p);
            particles.push(p);
        }

        return {
            elementId, container, renderer, scene, camera,
            ringGroup, progressMesh, accentLight, halo, particles,
            width, height,
            percent: 0, targetPercent: 0, startPercent: 0, lastIntP: -1,
            animStart: 0, animDur: 700,
            colorHex: '#22d3ee',
            startColorObj: new THREE.Color(0x22d3ee),
            targetColorObj: new THREE.Color(0x22d3ee),
            colorAnimStart: 0, colorAnimDur: 500,
            arcCache: new Map()
        };
    }

    /**
     * Construye un environment map procedural (linear gradient + luces) y
     * lo pasa por PMREMGenerator para que MeshPhysicalMaterial con transmission
     * tenga algo real que reflejar y refractar.
     * Se construye una sola vez (compartido entre todos los anillos).
     */
    _buildEnvMap(renderer) {
        const c = document.createElement('canvas');
        c.width = 512; c.height = 512;
        const ctx = c.getContext('2d');
        // Mitad superior: cielo claro → azul medio
        const sky = ctx.createLinearGradient(0, 0, 0, 256);
        sky.addColorStop(0, '#ffffff');
        sky.addColorStop(0.45, '#a8c5dc');
        sky.addColorStop(1, '#3a5a7a');
        ctx.fillStyle = sky; ctx.fillRect(0, 0, 512, 256);
        // Mitad inferior: suelo oscuro
        const ground = ctx.createLinearGradient(0, 256, 0, 512);
        ground.addColorStop(0, '#1a2845');
        ground.addColorStop(1, '#050811');
        ctx.fillStyle = ground; ctx.fillRect(0, 256, 512, 256);
        // Manchas brillantes que el vidrio reflejará como "luces" en su superficie
        const lights = [[80, 60, 140], [400, 100, 110], [340, 430, 90], [220, 280, 70], [120, 400, 60]];
        lights.forEach(([x, y, r]) => {
            const g = ctx.createRadialGradient(x, y, 1, x, y, r);
            g.addColorStop(0, 'rgba(255,255,255,0.98)');
            g.addColorStop(0.5, 'rgba(220,235,255,0.55)');
            g.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = g;
            ctx.fillRect(x - r, y - r, r * 2, r * 2);
        });
        const tex = new THREE.CanvasTexture(c);
        tex.mapping = THREE.EquirectangularReflectionMapping;
        tex.colorSpace = THREE.SRGBColorSpace;

        const pmrem = new THREE.PMREMGenerator(renderer);
        pmrem.compileEquirectangularShader();
        const envRT = pmrem.fromEquirectangular(tex);
        pmrem.dispose();
        tex.dispose();
        return envRT.texture;
    }

    _getArcGeometry(inst, percent) {
        const key = Math.max(0, Math.min(100, Math.round(percent)));
        if (!inst.arcCache.has(key)) {
            const arc = Math.max(0.001, (key / 100) * Math.PI * 2 - 0.001);
            inst.arcCache.set(key, new THREE.TorusGeometry(1, 0.13, 24, 96, arc));
        }
        return inst.arcCache.get(key);
    }

    /** Snap directo al estado inicial sin animación. */
    _applyInitialValue(inst, percent, colorHex) {
        inst.percent = percent;
        inst.targetPercent = percent;
        inst.startPercent = percent;
        inst.animStart = 0;          // t=1 inmediato en _animate
        inst.lastIntP = -1;
        inst.colorHex = colorHex;
        inst.colorAnimStart = 0;
        const c = new THREE.Color(colorHex);
        inst.startColorObj.copy(c);
        inst.targetColorObj.copy(c);
        inst.progressMesh.material.color.copy(c);
        inst.progressMesh.material.emissive.copy(c);
        inst.accentLight.color.copy(c);
        inst.halo.material.color.copy(c);
        if (inst.particles) inst.particles.forEach(p => p.material.color.copy(c));
        inst.progressMesh.geometry = this._getArcGeometry(inst, Math.round(percent));
        inst.lastIntP = Math.round(percent);
    }

    /** Si el contenedor cambió de tamaño (responsive/resize), reaplicar. */
    _fitIfResized(inst) {
        const w = inst.container.clientWidth;
        const h = inst.container.clientHeight;
        if (w > 0 && h > 0 && (w !== inst.width || h !== inst.height)) {
            inst.renderer.setSize(w, h);
            inst.camera.aspect = w / h;
            inst.camera.updateProjectionMatrix();
            inst.width = w;
            inst.height = h;
        }
    }

    _onIntersect(entries) {
        entries.forEach(entry => {
            const id = entry.target.id;
            if (!id) return;
            if (entry.isIntersecting) this._visibleSet.add(id);
            else this._visibleSet.delete(id);
        });
    }

    _disposeInstance(inst) {
        try {
            // Liberar geometrías y materiales cacheados
            if (inst.arcCache) inst.arcCache.forEach(g => g.dispose());
            inst.scene.traverse(obj => {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                    else obj.material.dispose();
                }
            });
            // Quitar canvas del DOM
            if (inst.renderer.domElement && inst.renderer.domElement.parentNode) {
                inst.renderer.domElement.parentNode.removeChild(inst.renderer.domElement);
            }
            // Quitar del IntersectionObserver
            if (this._io && inst.container) this._io.unobserve(inst.container);
            // Liberar el contexto WebGL
            inst.renderer.dispose();
            inst.renderer.forceContextLoss?.();
        } catch (e) {
            console.warn('[GlassRing3D] dispose silencioso:', e);
        }
    }

    _disposeById(elementId) {
        const inst = this.instances.get(elementId);
        if (inst) {
            this._disposeInstance(inst);
            this.instances.delete(elementId);
        }
        this._visibleSet.delete(elementId);
    }

    /** Disponer todas las instancias (útil en beforeunload). */
    disposeAll() {
        for (const id of Array.from(this.instances.keys())) this._disposeById(id);
        if (this._io) this._io.disconnect();
        if (this._envMap) { try { this._envMap.dispose?.(); } catch(e){} this._envMap = null; }
    }

    /** Loop principal: lerp de valor, lerp de color, halo, partículas y render. */
    _animate(ts) {
        requestAnimationFrame(this._animate);
        const now = performance.now();
        this.instances.forEach(inst => {
            if (!inst.container.isConnected) return;
            if (this._visibleSet.size && !this._visibleSet.has(inst.elementId)) return;

            // 1) Lerp suave del porcentaje actual hacia el objetivo (700 ms easeInOut)
            const t = Math.min(1, (now - inst.animStart) / inst.animDur);
            const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
            inst.percent = inst.startPercent + (inst.targetPercent - inst.startPercent) * ease;

            // 2) Lerp del color (500 ms easeInOut) — fluido cuando cambia criticidad
            const ct = Math.min(1, (now - inst.colorAnimStart) / inst.colorAnimDur);
            const ce = ct < 0.5 ? 2 * ct * ct : 1 - Math.pow(-2 * ct + 2, 2) / 2;
            const liveColor = inst.progressMesh.material.color
                .copy(inst.startColorObj).lerp(inst.targetColorObj, ce);
            inst.progressMesh.material.emissive.copy(liveColor);
            inst.accentLight.color.copy(liveColor);
            inst.halo.material.color.copy(liveColor);
            if (inst.particles) inst.particles.forEach(p => p.material.color.copy(liveColor));

            // 3) Geometría del arco (cache de enteros — solo recrea cuando cambia intP)
            const intP = Math.max(0, Math.min(100, Math.round(inst.percent)));
            if (intP !== inst.lastIntP) {
                inst.progressMesh.geometry = this._getArcGeometry(inst, intP);
                inst.lastIntP = intP;
            }

            // 4) Rotación principal + wobble sutil en Y + drift en X
            inst.ringGroup.rotation.z = ts * 0.00012;
            inst.ringGroup.rotation.y = Math.sin(ts * 0.0008) * 0.05;
            inst.ringGroup.rotation.x = Math.PI / 2.5 + Math.sin(ts * 0.0004) * 0.04;

            // 5) Halo: pulso de escala y opacidad sincronizado con la luz interna
            const haloPulse = 1 + Math.sin(ts * 0.0012) * 0.045;
            inst.halo.scale.setScalar(haloPulse);
            inst.halo.material.opacity = 0.20 + Math.sin(ts * 0.0014) * 0.08;

            // 6) Acent light: respiración viva (intensidad oscilante)
            inst.accentLight.intensity = 2.2 + Math.sin(ts * 0.0022) * 0.5;

            // 7) Partículas fluyen por el arco del progreso (chispa siguiendo el %)
            if (inst.particles && inst.percent > 1) {
                const totalArc = (inst.percent / 100) * Math.PI * 2;
                inst.particles.forEach(p => {
                    const speed = 0.0018 * p.userData.speed;
                    let theta = (ts * speed + p.userData.phase) % totalArc;
                    if (theta < 0) theta += totalArc;
                    p.position.set(Math.cos(theta), Math.sin(theta), 0.005);
                    const pulse = 0.7 + Math.sin(ts * 0.005 + p.userData.phase) * 0.45;
                    p.scale.setScalar(pulse);
                    p.material.opacity = 0.7 + Math.sin(ts * 0.003 + p.userData.phase) * 0.25;
                    p.visible = true;
                });
            } else if (inst.particles) {
                inst.particles.forEach(p => { p.visible = false; });
            }

            // 8) Resize + render
            this._fitIfResized(inst);
            inst.renderer.render(inst.scene, inst.camera);
        });
    }
}
