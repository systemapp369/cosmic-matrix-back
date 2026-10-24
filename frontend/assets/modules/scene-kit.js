/**
 * scene-kit.js — Piezas 3D reutilizables (procedurales, sin archivos externos):
 * camioneta táctica, dron con gimbal y rotores, sprites de brillo/etiqueta y sistema de partículas.
 * Lo usan desert-scene.js (login) y journey-scene.js (dashboard).
 *
 *   const kit = CMSceneKit.create(THREE, { hq: true });   // hq: las piezas proyectan sombras
 *   kit.buildTruck(0xb39a6c)  kit.buildDrone()  kit.makeDust(400)  kit.makeParticles(N, opciones)
 */
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const lerp = (a, b, t) => a + (b - a) * t;
  const rnd = (a, b) => a + Math.random() * (b - a);

  function create(THREE, cfg) {
    const hq = !!(cfg && cfg.hq);
    const M = THREE.MeshStandardMaterial;
    const boxG = (w, h, l) => new THREE.BoxGeometry(w, h, l);

    /* ----------------------------- Sprites auxiliares ----------------------------- */
    const glowTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(c);
    })();

    const glow = (color, size, x, y, z, parent) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      s.scale.set(size, size, 1); s.position.set(x, y, z); if (parent) parent.add(s); return s;
    };

    const labelSprite = (l1, l2, color) => {
      const col = color || '#22d3ee';
      const c = document.createElement('canvas'); c.width = 320; c.height = 96;
      const g = c.getContext('2d');
      g.fillStyle = 'rgba(4,22,36,.72)'; g.fillRect(0, 0, 320, 96);
      g.strokeStyle = col; g.lineWidth = 3; g.strokeRect(2, 2, 316, 92);
      g.fillStyle = col; g.font = 'bold 34px monospace'; g.fillText(l1, 16, 40);
      g.fillStyle = '#bfefff'; g.font = '24px monospace'; g.fillText(l2, 16, 78);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, fog: false }));
      s.scale.set(6.4, 1.92, 1); return s;
    };

    /* ------------------------------- Camioneta táctica ------------------------------- */
    function buildTruck(paintHex) {
      const g = new THREE.Group();
      const paint = new M({ color: paintHex, roughness: 0.74, metalness: 0.18 });
      const dark = new M({ color: 0x1d2125, roughness: 0.8, metalness: 0.3 });
      const olive = new M({ color: 0x3f4a30, roughness: 0.85, metalness: 0.1 });
      const glass = new M({ color: 0x0a1822, roughness: 0.12, metalness: 0.85, emissive: 0x06263b, emissiveIntensity: 0.7 });
      const add = (geo, mat, x, y, z, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = hq; m.receiveShadow = true; (parent || g).add(m); return m; };
      add(boxG(1.9, 0.5, 4.7), dark, 0, 0.78, 0);
      add(boxG(1.92, 0.4, 1.5), paint, 0, 1.12, 1.95);
      add(boxG(1.9, 0.78, 1.95), paint, 0, 1.52, 0.55);
      add(boxG(1.94, 0.4, 1.25), glass, 0, 1.6, 0.6);
      const ws = add(boxG(1.62, 0.42, 0.06), glass, 0, 1.6, 1.55); ws.rotation.x = -0.45;
      add(boxG(1.7, 0.06, 1.7), dark, 0, 1.94, 0.55);
      add(boxG(1.9, 0.12, 2.05), dark, 0, 1.0, -1.55);
      add(boxG(0.08, 0.5, 2.05), paint, 0.93, 1.28, -1.55); add(boxG(0.08, 0.5, 2.05), paint, -0.93, 1.28, -1.55);
      add(boxG(1.9, 0.5, 0.08), paint, 0, 1.28, -2.58);
      const cyl = (r, h) => new THREE.CylinderGeometry(r, r, h, 8);
      for (const z of [-0.75, -2.3]) {
        add(cyl(0.045, 0.95), dark, 0.86, 1.68, z); add(cyl(0.045, 0.95), dark, -0.86, 1.68, z);
        add(cyl(0.045, 1.72), dark, 0, 2.15, z).rotation.z = Math.PI / 2;
      }
      add(cyl(0.04, 1.55), dark, 0.86, 2.15, -1.52).rotation.x = Math.PI / 2; add(cyl(0.04, 1.55), dark, -0.86, 2.15, -1.52).rotation.x = Math.PI / 2;
      const barMat = new M({ color: 0x222222, emissive: 0xffa400, emissiveIntensity: 1.6 });
      add(boxG(1.2, 0.09, 0.2), barMat, 0, 2.03, 0.95);
      add(boxG(1.7, 0.08, 0.08), dark, 0, 0.78, 2.74); add(cyl(0.04, 0.7), dark, 0.55, 1.05, 2.72); add(cyl(0.04, 0.7), dark, -0.55, 1.05, 2.72);
      const head = new M({ color: 0x222222, emissive: 0xfff0c0, emissiveIntensity: 2.6 });
      add(boxG(0.36, 0.16, 0.05), head, 0.62, 1.16, 2.7); add(boxG(0.36, 0.16, 0.05), head, -0.62, 1.16, 2.7);
      const tail = new M({ color: 0x220000, emissive: 0xff1a1a, emissiveIntensity: 1.8 });
      add(boxG(0.22, 0.14, 0.05), tail, 0.8, 1.2, -2.63); add(boxG(0.22, 0.14, 0.05), tail, -0.8, 1.2, -2.63);
      add(boxG(0.9, 0.5, 0.7), olive, -0.4, 1.31, -1.15); add(boxG(0.7, 0.45, 0.8), dark, 0.45, 1.3, -1.85);
      add(new THREE.CylinderGeometry(0.4, 0.4, 0.24, 14), dark, 0, 1.55, -2.74).rotation.x = Math.PI / 2;
      add(boxG(0.18, 0.12, 0.1), dark, 1.06, 1.68, 1.25); add(boxG(0.18, 0.12, 0.1), dark, -1.06, 1.68, 1.25);
      const dish = add(new THREE.SphereGeometry(0.28, 12, 6, 0, TAU, 0, Math.PI / 2), new M({ color: 0xb8bcc0, roughness: 0.4, metalness: 0.6 }), 0, 2.02, 0.2);
      dish.rotation.x = -0.9;
      for (const sx of [-1, 1]) for (const z of [1.55, -1.45]) add(boxG(0.42, 0.1, 0.95), paint, sx * 0.95, 0.98, z);
      const ants = [];
      for (const sx of [-1, 1]) {
        const pivot = new THREE.Group(); pivot.position.set(sx * 0.82, 1.9, -2.5); g.add(pivot);
        add(new THREE.CylinderGeometry(0.012, 0.02, 2.3, 5), dark, 0, 1.15, 0, pivot); ants.push(pivot);
      }
      const tire = new THREE.CylinderGeometry(0.46, 0.46, 0.34, 20); tire.rotateZ(Math.PI / 2);
      const rim = new THREE.CylinderGeometry(0.27, 0.27, 0.36, 12); rim.rotateZ(Math.PI / 2);
      const tireMat = new M({ color: 0x141414, roughness: 0.95 }), rimMat = new M({ color: 0x8d9298, roughness: 0.35, metalness: 0.8 });
      const lug = boxG(0.36, 0.09, 0.12);
      const wheels = [];
      for (const [sx, z] of [[0.95, 1.55], [-0.95, 1.55], [0.95, -1.45], [-0.95, -1.45]]) {
        const w = new THREE.Group(); w.position.set(sx, 0.46, z);
        add(tire, tireMat, 0, 0, 0, w); add(rim, rimMat, 0, 0, 0, w);
        for (let k = 0; k < 10; k++) { const l = add(lug, tireMat, 0, 0, 0, w); const a = (k / 10) * TAU; l.position.set(0, Math.sin(a) * 0.47, Math.cos(a) * 0.47); l.rotation.x = -a; }
        g.add(w); wheels.push(w);
      }
      glow(0xfff0c0, 1.6, 0.62, 1.16, 2.95, g); glow(0xfff0c0, 1.6, -0.62, 1.16, 2.95, g);
      const lbGlow = glow(0xffa400, 1.5, 0, 2.15, 0.95, g);
      g.userData = { barMat, lbGlow, ants, wheels };
      return g;
    }

    /* ------------------------------------- Dron ------------------------------------- */
    function buildDrone() {
      const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
      const bodyM = new M({ color: 0x23282e, roughness: 0.5, metalness: 0.6 }), shellM = new M({ color: 0x3b434b, roughness: 0.45, metalness: 0.5 });
      const add = (geo, mat, x, y, z, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = hq; (parent || inner).add(m); return m; };
      add(boxG(0.55, 0.14, 0.55), bodyM, 0, 0, 0);
      const dome = add(new THREE.SphereGeometry(0.26, 14, 8, 0, TAU, 0, Math.PI / 2), shellM, 0, 0.06, 0); dome.scale.y = 0.55;
      const arm1 = add(boxG(1.5, 0.05, 0.07), bodyM, 0, 0.02, 0); arm1.rotation.y = Math.PI / 4;
      const arm2 = add(boxG(1.5, 0.05, 0.07), bodyM, 0, 0.02, 0); arm2.rotation.y = -Math.PI / 4;
      const rotors = [], leds = [];
      const bladeG = boxG(0.7, 0.012, 0.07), discG = new THREE.CircleGeometry(0.36, 20).rotateX(-Math.PI / 2);
      const bladeM = new M({ color: 0x15181b, roughness: 0.6 });
      const discM = new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false });
      const tips = [[0.53, 0.53], [-0.53, 0.53], [0.53, -0.53], [-0.53, -0.53]];
      tips.forEach(([x, z], i) => {
        add(new THREE.CylinderGeometry(0.075, 0.075, 0.1, 10), shellM, x, 0.06, z);
        const r = new THREE.Group(); r.position.set(x, 0.13, z); inner.add(r);
        add(bladeG, bladeM, 0, 0, 0, r); const b2 = add(bladeG, bladeM, 0, 0, 0, r); b2.rotation.y = Math.PI / 2;
        const d = new THREE.Mesh(discG, discM); r.add(d); rotors.push(r);
        const col = i < 2 ? 0xffffff : (i === 2 ? 0xff2a2a : 0x2aff6a);
        leds.push(glow(col, 0.55, x, 0.0, z, inner));
      });
      const g2 = new THREE.Group(); g2.position.set(0, -0.14, 0.2); inner.add(g2);
      add(new THREE.SphereGeometry(0.1, 12, 10), new M({ color: 0x111418, roughness: 0.3, metalness: 0.7 }), 0, 0, 0, g2);
      add(new THREE.SphereGeometry(0.045, 10, 8), new THREE.MeshBasicMaterial({ color: 0x22d3ee }), 0, -0.02, 0.07, g2);
      glow(0x22d3ee, 0.5, 0, -0.02, 0.1, g2);
      for (const sx of [-1, 1]) add(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 5), bodyM, sx * 0.2, -0.16, 0).rotation.x = Math.PI / 2;
      g.scale.setScalar(2.2);
      g.userData = { inner, rotors, leds, gimbal: g2 };
      return g;
    }

    /* ----------------------------- Partículas (polvo, agua...) ----------------------------- */
    /**
     * opciones: color [r,g,b] 0-1, size [inicio, fin], alpha (máx.), life [min,max] s,
     *           damp (frenado), rise (deriva vertical), gravity (negativa = cae), power (curva de desvanecido)
     */
    function makeParticles(N, o) {
      o = Object.assign({ color: [0.83, 0.66, 0.46], size: [2.4, 9.5], alpha: 0.42, life: [1.5, 2.6], damp: 1.1, rise: 0.35, gravity: 0, power: 1.6 }, o || {});
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(N * 3), size = new Float32Array(N), alpha = new Float32Array(N), vel = new Float32Array(N * 3), age = new Float32Array(N).fill(99), life = new Float32Array(N).fill(1);
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1)); geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false,
        uniforms: { uScale: { value: 600 }, uColor: { value: new THREE.Vector3(o.color[0], o.color[1], o.color[2]) } },
        vertexShader: 'attribute float aSize; attribute float aAlpha; varying float vA; uniform float uScale; void main(){ vA=aAlpha; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=aSize*uScale/max(-mv.z,0.1); gl_Position=projectionMatrix*mv; }',
        fragmentShader: 'uniform vec3 uColor; varying float vA; void main(){ float d=length(gl_PointCoord-0.5); float a=smoothstep(0.5,0.05,d)*vA; gl_FragColor=vec4(uColor,a); }'
      });
      const pts = new THREE.Points(geo, mat); pts.frustumCulled = false;
      let head = 0;
      return {
        pts, mat,
        emit(x, y, z, vx, vy, vz) {
          const i = head; head = (head + 1) % N;
          pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz; age[i] = 0; life[i] = rnd(o.life[0], o.life[1]);
        },
        update(dt) {
          const dmp = Math.max(0, 1 - dt * o.damp);
          for (let i = 0; i < N; i++) {
            age[i] += dt; const t = age[i] / life[i];
            if (t >= 1) { alpha[i] = 0; continue; }
            pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
            vel[i * 3] *= dmp; vel[i * 3 + 2] *= dmp; vel[i * 3 + 1] = vel[i * 3 + 1] * dmp + dt * (o.rise + o.gravity);
            size[i] = lerp(o.size[0], o.size[1], t); alpha[i] = Math.pow(1 - t, o.power) * o.alpha;
          }
          geo.attributes.position.needsUpdate = geo.attributes.aSize.needsUpdate = geo.attributes.aAlpha.needsUpdate = true;
        }
      };
    }
    const makeDust = N => makeParticles(N);

    return { M, boxG, glow, labelSprite, buildTruck, buildDrone, makeParticles, makeDust };
  }

  window.CMSceneKit = { create };
})();
