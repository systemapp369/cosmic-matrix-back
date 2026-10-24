/**
 * ocean-scene.js — Escenario 3D "Océano": arrecifes de coral, cardúmenes, rayos de luz y dos submarinos
 * nucleares que realizan maniobras de evasión ante torpedos, lanzando señuelos que los desvían.
 * Es una representación visual estilizada: los torpedos siempre acaban atraídos por los señuelos
 * y detonan lejos de los submarinos. Todo es procedural (sin archivos externos).
 *
 *   CMOceanScene.start(canvas, opts) -> api { seek, info, stats, dispose }
 * Se registra en CMScenes (administrador de fondos del dashboard).
 */
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const mulberry32 = a => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  function start(canvas, options) {
    const THREE = window.THREE, Kit = window.CMSceneKit;
    if (!THREE || !Kit) throw new Error('Three.js o scene-kit no disponibles');
    const opts = Object.assign({ fps: 0, quality: 'high', pixelRatioCap: 1.75, pause: null, shiftY: 0 }, options || {});
    const hq = opts.quality === 'high', lite = opts.quality === 'low';
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const kit = Kit.create(THREE, { hq: false });
    const { M, glow, labelSprite, makeParticles } = kit;
    const V3 = THREE.Vector3, UP = new V3(0, 1, 0);
    const state = { shot: '', pixelRatioCap: opts.pixelRatioCap, fps: 0 };

    /* ------------------------------ Renderer / escena ------------------------------ */
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lite, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, state.pixelRatioCap));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    const scene = new THREE.Scene();
    const FOG = new THREE.Color('#0b5f82');
    scene.fog = new THREE.Fog(FOG, 25, 430);
    const camera = new THREE.PerspectiveCamera(55, 1, 0.3, 3000);

    /* Agua: degradado vertical (superficie clara arriba, abismo abajo). El horizonte coincide con la niebla. */
    const water = new THREE.Mesh(
      new THREE.SphereGeometry(1800, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, fog: false,
        uniforms: { uTop: { value: new THREE.Color('#58d0e6') }, uMid: { value: FOG.clone() }, uDeep: { value: new THREE.Color('#03233c') } },
        vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: `
          uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uDeep; varying vec3 vDir;
          void main(){
            float y = vDir.y;
            vec3 col = mix(uMid, uDeep, smoothstep(0.0, -0.75, y));
            col = mix(col, uTop, smoothstep(0.05, 0.85, y));
            gl_FragColor = vec4(col, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`
      })
    );
    scene.add(water);

    scene.add(new THREE.HemisphereLight(0x7fd8f0, 0x2a4a3a, 1.35));
    const sunL = new THREE.DirectionalLight(0xc7f1ff, 2.6); sunL.position.set(-60, 200, -40); scene.add(sunL);
    const flashLight = new THREE.PointLight(0xffd9a0, 0, 260, 1.6); scene.add(flashLight);

    /* ---------------------------------- Fondo marino ---------------------------------- */
    const FLOOR = -58, SIZE = 920;
    const mounds = [[-150, -90, 55, 12], [-60, 120, 48, 10], [20, -30, 40, 9], [110, 80, 58, 13], [170, -120, 50, 11], [-210, 60, 46, 9], [60, 190, 44, 10], [-20, -200, 52, 11], [230, 10, 40, 8]];
    const seaH = (x, z) => {
      let h = FLOOR + 6 * Math.sin(x * 0.012) * Math.cos(z * 0.015) + 3 * Math.sin(x * 0.03 + z * 0.02) + 3.2 * (1 - Math.abs(Math.sin(x * 0.02 + z * 0.007))) + 0.4 * Math.sin(x * 0.2 + z * 0.17);
      for (const [mx, mz, r, hh] of mounds) { const d = Math.hypot(x - mx, z - mz) / r; if (d < 2.2) h += hh * Math.exp(-d * d); }
      return h;
    };
    const moundK = (x, z) => { let k = 0; for (const [mx, mz, r] of mounds) { const d = Math.hypot(x - mx, z - mz) / r; k = Math.max(k, Math.exp(-d * d)); } return k; };

    const SEG = hq ? 230 : (lite ? 100 : 160);
    const tGeo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG).rotateX(-Math.PI / 2);
    {
      const pos = tGeo.attributes.position, col = new Float32Array(pos.count * 3);
      const lo = new THREE.Color('#7a6848'), hi = new THREE.Color('#bfae84'), rock = new THREE.Color('#566a5e'), alg = new THREE.Color('#4f7a52'), c = new THREE.Color();
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i), y = seaH(x, z); pos.setY(i, y);
        const n = 0.5 + 0.5 * Math.sin(x * 0.23 + z * 0.17) * Math.cos(z * 0.31 - x * 0.05), k = moundK(x, z);
        c.copy(lo).lerp(hi, clamp((y - FLOOR + 6) / 16 + (n - 0.5) * 0.25, 0, 1));
        c.lerp(rock, smooth(0.15, 0.7, k) * 0.8); c.lerp(alg, smooth(0.55, 1, n) * 0.28 * smooth(0.1, 0.5, k));
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      }
      tGeo.setAttribute('color', new THREE.BufferAttribute(col, 3)); tGeo.computeVertexNormals();
    }
    const causticU = { value: 0 };
    const seabedMat = new M({ vertexColors: true, roughness: 1, metalness: 0 });
    seabedMat.onBeforeCompile = sh => {            // cáusticas: reflejos de luz ondulantes sobre el fondo
      sh.uniforms.uTimeC = causticU;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        varying vec3 vWPos; uniform float uTimeC;
        float caustic(vec2 p, float t){ vec2 q = p * 0.085; float a = sin(q.x*3.0 + t*0.8) * sin(q.y*3.4 - t*0.6); float b = sin((q.x+q.y)*4.1 + t*1.1) * sin((q.x-q.y)*3.7 - t*0.9); return pow(clamp((a+b)*0.5+0.5, 0.0, 1.0), 6.0); }`)
        .replace('#include <opaque_fragment>', 'outgoingLight += vec3(0.45, 0.85, 1.0) * caustic(vWPos.xz, uTimeC) * 0.2;\n#include <opaque_fragment>');
    };
    scene.add(new THREE.Mesh(tGeo, seabedMat));

    /* ------------------------------- Corales, algas, rocas ------------------------------- */
    const dummy = new THREE.Object3D();
    const merge = list => {
      const pos = [], nor = [];
      list.forEach(g0 => { const g = g0.index ? g0.toNonIndexed() : g0; const p = g.attributes.position.array, n = g.attributes.normal.array; for (let i = 0; i < p.length; i++) { pos.push(p[i]); nor.push(n[i]); } });
      const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); return out;
    };
    const branchGeo = () => {
      const parts = [], rng = mulberry32(77);
      const rec = (bx, by, bz, rx, rz, len, r, depth) => {
        const g = new THREE.CylinderGeometry(r * 0.62, r, len, 6, 1, false); g.translate(0, len / 2, 0);
        const e = new THREE.Euler(rx, 0, rz); g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(e)); g.translate(bx, by, bz); parts.push(g);
        if (depth <= 0) return;
        const d = new V3(0, 1, 0).applyEuler(e), ex = bx + d.x * len, ey = by + d.y * len, ez = bz + d.z * len;
        for (let k = 0; k < 2; k++) rec(ex, ey, ez, rx + (rng() - 0.5) * 1.1 + (k ? 0.5 : -0.5), rz + (rng() - 0.5) * 1.1 + (k ? -0.5 : 0.5), len * 0.78, r * 0.7, depth - 1);
      };
      rec(0, 0, 0, 0, 0, 1.6, 0.38, 3);
      return merge(parts);
    };
    const domeGeo = () => { const g = new THREE.IcosahedronGeometry(1.5, 2); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const v = new V3().fromBufferAttribute(p, i), k = 1 + 0.13 * Math.sin(v.x * 4.1 + v.z * 3.3) * Math.cos(v.y * 5.2); p.setXYZ(i, v.x * k, Math.max(v.y * k * 0.75, -0.1), v.z * k); } g.computeVertexNormals(); return g; };
    const tubeGeo = () => { const parts = []; [[0, 0, 2.6, 0.32], [0.55, 0.1, 1.9, 0.28], [-0.5, 0.2, 2.2, 0.3], [0.2, -0.55, 1.4, 0.25], [-0.25, 0.55, 1.7, 0.27]].forEach(([x, z, h, r]) => { const g = new THREE.CylinderGeometry(r * 0.85, r, h, 8, 1, false); g.translate(x, h / 2, z); parts.push(g); }); return merge(parts); };
    const fanGeo = () => { const g = new THREE.CircleGeometry(1.7, 18, 0, Math.PI); const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, 0.18 * Math.sin(p.getX(i) * 3.2)); g.computeVertexNormals(); return g; };
    const tableGeo = () => { const a = new THREE.CylinderGeometry(0.32, 0.5, 1.5, 7); a.translate(0, 0.75, 0); const b = new THREE.CylinderGeometry(2.3, 1.9, 0.3, 10); b.translate(0, 1.6, 0); return merge([a, b]); };
    const coralMat = (side) => new M({ color: 0xffffff, roughness: 0.78, metalness: 0.02, flatShading: false, side: side || THREE.FrontSide });
    const palette = ['#ff6b81', '#ff9f43', '#feca57', '#ff9ff3', '#a29bfe', '#48dbfb', '#1dd1a1', '#f368e0', '#ee5253', '#fd79a8'].map(h => new THREE.Color(h));
    const plant = (geo, mat, n, scaleMin, scaleMax, pickSpot) => {
      const im = new THREE.InstancedMesh(geo, mat, n);
      for (let i = 0; i < n; i++) {
        const [x, z] = pickSpot(), k = rnd(scaleMin, scaleMax);
        dummy.position.set(x, seaH(x, z) - 0.15, z); dummy.rotation.set(rnd(-0.12, 0.12), rnd(0, TAU), rnd(-0.12, 0.12)); dummy.scale.set(k, k * rnd(0.85, 1.3), k); dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix); im.setColorAt(i, palette[(Math.random() * palette.length) | 0]);
      }
      scene.add(im); return im;
    };
    const reefSpot = () => { const m = mounds[(Math.random() * mounds.length) | 0], a = Math.random() * TAU, r = m[2] * Math.sqrt(Math.random()) * 1.15; return [m[0] + Math.cos(a) * r, m[1] + Math.sin(a) * r]; };
    const anySpot = () => [rnd(-SIZE / 2 + 20, SIZE / 2 - 20), rnd(-SIZE / 2 + 20, SIZE / 2 - 20)];
    const mixSpot = () => (Math.random() < 0.9 ? reefSpot() : anySpot());
    const cs = hq ? 1 : (lite ? 0.45 : 0.7);
    plant(branchGeo(), coralMat(), Math.round(280 * cs), 1.3, 3.4, mixSpot);
    plant(domeGeo(), coralMat(), Math.round(190 * cs), 1.0, 3.0, mixSpot);
    plant(tubeGeo(), coralMat(), Math.round(160 * cs), 1.0, 2.6, mixSpot);
    plant(fanGeo(), coralMat(THREE.DoubleSide), Math.round(160 * cs), 1.2, 2.8, mixSpot);
    plant(tableGeo(), coralMat(), Math.round(90 * cs), 1.2, 2.8, reefSpot);
    // algas largas que se mecen con la corriente
    const kelpU = { value: 0 };
    {
      const g = new THREE.PlaneGeometry(0.9, 13, 1, 8); g.translate(0, 6.5, 0);
      const mat = new M({ color: 0x3f9a58, roughness: 0.9, side: THREE.DoubleSide });
      mat.onBeforeCompile = sh => {
        sh.uniforms.uTimeK = kelpU;
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTimeK;').replace('#include <begin_vertex>', `#include <begin_vertex>
          float kk = clamp(position.y / 12.0, 0.0, 1.0); kk = kk * kk;
          transformed.x += sin(uTimeK*1.1 + instanceMatrix[3].x*0.3 + position.y*0.5) * kk * 1.8;
          transformed.z += cos(uTimeK*0.9 + instanceMatrix[3].z*0.3 + position.y*0.4) * kk * 1.3;`);
      };
      const n = Math.round(240 * cs), im = new THREE.InstancedMesh(g, mat, n);
      for (let i = 0; i < n; i++) { const [x, z] = mixSpot(), k = rnd(0.7, 1.7); dummy.position.set(x, seaH(x, z), z); dummy.rotation.set(0, rnd(0, TAU), 0); dummy.scale.set(k, k * rnd(0.7, 1.3), k); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); }
      scene.add(im);
    }
    {
      const n = Math.round(120 * cs), im = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new M({ color: 0x5a6e64, roughness: 1, flatShading: true }), n);
      for (let i = 0; i < n; i++) { const [x, z] = mixSpot(), k = rnd(0.8, 4.2); dummy.position.set(x, seaH(x, z) + k * 0.2, z); dummy.rotation.set(rnd(0, 3), rnd(0, 3), rnd(0, 3)); dummy.scale.set(k * rnd(0.8, 1.5), k * rnd(0.5, 1), k * rnd(0.8, 1.3)); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); }
      scene.add(im);
    }

    /* --------------------------------- Peces (cardúmenes) --------------------------------- */
    const fishG = (() => {
      const body = new THREE.IcosahedronGeometry(0.5, 1); body.scale(0.45, 0.6, 1.5);
      const tail = new THREE.ConeGeometry(0.34, 0.7, 4); tail.rotateX(-Math.PI / 2); tail.scale(0.25, 1, 1); tail.translate(0, 0, -0.95);
      return merge([body, tail]);
    })();
    const schoolDefs = [{ n: hq ? 80 : (lite ? 30 : 50), col: '#ffd34d', c: [-60, -22, 70], R: [60, 14, 50], w: 0.11, sp: 1.0 }, { n: hq ? 70 : (lite ? 26 : 44), col: '#5db7ff', c: [70, -10, -40], R: [80, 18, 60], w: -0.09, sp: 0.9 }, { n: hq ? 60 : (lite ? 24 : 38), col: '#ff8f4d', c: [10, -30, 120], R: [70, 10, 40], w: 0.075, sp: 1.2 }];
    const schools = schoolDefs.map((d, si) => {
      const im = new THREE.InstancedMesh(fishG, new M({ color: d.col, roughness: 0.5, metalness: 0.2 }), d.n); scene.add(im);
      const rng = mulberry32(300 + si), f = Array.from({ length: d.n }, () => ({ a: 0.5 + rng() * 0.9, b: 0.4 + rng() * 0.9, c: 0.5 + rng() * 0.9, p: rng() * TAU, q: rng() * TAU, s: rng() * TAU, rx: 5 + rng() * 9, ry: 2 + rng() * 5, rz: 5 + rng() * 9 }));
      return { d, im, f };
    });
    const fp = new V3(), fq = new V3();
    function fishPos(sch, j, t, out) {
      const d = sch.d, f = sch.f[j], a = t * d.w * d.sp;
      return out.set(d.c[0] + Math.cos(a) * d.R[0] + Math.sin(f.a * t + f.p) * f.rx, d.c[1] + Math.sin(a * 1.7) * d.R[1] * 0.5 + Math.sin(f.b * t + f.q) * f.ry, d.c[2] + Math.sin(a) * d.R[2] + Math.cos(f.c * t + f.s) * f.rz);
    }
    function updateFish(t) {
      for (const sch of schools) {
        for (let j = 0; j < sch.f.length; j++) {
          fishPos(sch, j, t, fp); fishPos(sch, j, t + 0.15, fq); fq.sub(fp);
          dummy.position.copy(fp); dummy.rotation.set(-Math.asin(clamp(fq.y / Math.max(fq.length(), 1e-4), -1, 1)), Math.atan2(fq.x, fq.z), Math.sin(t * 9 + j) * 0.12, 'YXZ'); dummy.scale.setScalar(1); dummy.updateMatrix(); sch.im.setMatrixAt(j, dummy.matrix);
        }
        sch.im.instanceMatrix.needsUpdate = true;
      }
    }

    /* ----------------------------- Luz: rayos, superficie, partículas ----------------------------- */
    const rayGeo = new THREE.CylinderGeometry(4, 20, 150, 18, 1, true);
    const rays = [];
    for (let i = 0; i < (lite ? 5 : 9); i++) {
      const m = new THREE.Mesh(rayGeo, new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, uniforms: { uA: { value: 0.16 } },
        vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
        fragmentShader: 'uniform float uA; varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(abs(dot(normalize(vN), normalize(vV))), 1.8); float a = pow(vUv.y, 1.6) * f * uA; gl_FragColor = vec4(0.62, 0.93, 1.0, a); }'
      }));
      const a = (i / 9) * TAU * 1.7 + 0.4, r = 40 + (i % 4) * 55;
      m.position.set(Math.cos(a) * r - 40, 5, Math.sin(a) * r); m.rotation.set(0.18, 0, -0.22); m.userData = { ph: i * 1.7, base: 0.10 + (i % 3) * 0.035 };
      rays.push(m); scene.add(m);
    }
    const surf = new THREE.Mesh(new THREE.PlaneGeometry(2600, 2600), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false, uniforms: { uT: { value: 0 } },
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: 'uniform float uT; varying vec3 vW; void main(){ vec2 p = vW.xz*0.05; float r = sin(p.x*3.0+uT*0.7)*sin(p.y*2.6-uT*0.5) + sin((p.x+p.y)*5.1+uT*1.2)*0.5; float h = smoothstep(0.4,1.2,r); vec3 col = mix(vec3(0.32,0.78,0.9), vec3(0.85,1.0,1.0), h); gl_FragColor = vec4(col, 0.55 + 0.25*h); }'
    }));
    surf.rotation.x = -Math.PI / 2; surf.position.y = 75; scene.add(surf);
    const snow = (() => {
      const N = lite ? 250 : 700, base = new Float32Array(N * 3), size = new Float32Array(N);
      for (let i = 0; i < N; i++) { base[i * 3] = rnd(0, 160); base[i * 3 + 1] = rnd(0, 160); base[i * 3 + 2] = rnd(0, 160); size[i] = rnd(0.6, 1.8); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(base, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
      const m = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uT: { value: 0 }, uCam: { value: new V3() }, uScale: { value: 400 } },
        vertexShader: 'attribute float aSize; uniform float uT; uniform vec3 uCam; uniform float uScale; varying float vA; void main(){ vec3 box = vec3(160.0); vec3 p = mod(position + vec3(0.4,-1.3,0.3)*uT - uCam + box*0.5, box) - box*0.5; vec3 w = p + uCam; vec4 mv = viewMatrix * vec4(w,1.0); vA = 1.0 - smoothstep(30.0, 80.0, length(p)); gl_PointSize = aSize * uScale / max(-mv.z, 0.1); gl_Position = projectionMatrix * mv; }',
        fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord-0.5); gl_FragColor = vec4(0.8,0.95,1.0, smoothstep(0.5,0.1,d) * 0.5 * vA); }'
      });
      const pts = new THREE.Points(g, m); pts.frustumCulled = false; scene.add(pts); return pts;
    })();

    /* ---------------------------------- Submarino nuclear ---------------------------------- */
    function buildSub(tint) {
      const g = new THREE.Group(), L = 48, R = 4.6;
      const hullM = new M({ color: tint, roughness: 0.55, metalness: 0.2, emissive: 0x0a1a28, emissiveIntensity: 0.6 }), darkM = new M({ color: 0x0f141a, roughness: 0.6, metalness: 0.4 }), steelM = new M({ color: 0x8a949c, roughness: 0.4, metalness: 0.7 });
      const prof = [];
      for (let i = 0; i <= 44; i++) {
        const u = i / 44, y = -L / 2 + u * L;
        let s = 1;
        if (u < 0.1) s = Math.sqrt(Math.max(0, 1 - Math.pow((0.1 - u) / 0.1, 2))) * 0.92 + 0.06;
        else if (u > 0.74) s = 0.12 + 0.88 * Math.pow((1 - u) / 0.26, 0.85);
        prof.push(new THREE.Vector2(Math.max(0.05, R * s), y));
      }
      const hull = new THREE.LatheGeometry(prof, 28); hull.rotateX(Math.PI / 2);   // eje del casco: +Z (proa)
      g.add(new THREE.Mesh(hull, hullM));
      const sailG = new THREE.Group(); sailG.position.set(0, R * 0.85, 6); g.add(sailG);
      const add = (geo, mat, x, y, z, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); (parent || g).add(m); return m; };
      add(new THREE.BoxGeometry(2.1, 5.4, 9.5), hullM, 0, 2.4, 0, sailG);
      add(new THREE.CylinderGeometry(1.05, 1.05, 5.4, 14), hullM, 0, 2.4, 4.75, sailG); add(new THREE.CylinderGeometry(1.05, 1.05, 5.4, 14), hullM, 0, 2.4, -4.75, sailG);
      add(new THREE.BoxGeometry(2.1, 0.5, 9.5), darkM, 0, 5.1, 0, sailG);
      add(new THREE.CylinderGeometry(0.11, 0.11, 3.6, 6), steelM, 0.45, 6.9, 1.2, sailG); add(new THREE.CylinderGeometry(0.09, 0.09, 3.0, 6), steelM, -0.45, 6.6, -1, sailG);
      add(new THREE.BoxGeometry(8.4, 0.3, 2.2), darkM, 0, 3.4, 2.2, sailG);                       // alerones de la vela
      const rudders = [], planes = [];
      const sternZ = -L / 2 + 1.5;
      for (const [rx, ry, isV] of [[1, 0, false], [-1, 0, false], [0, 1, true], [0, -1, true]]) {
        const piv = new THREE.Group(); piv.position.set(rx * R * 0.55, ry * R * 0.55, sternZ); g.add(piv);
        const fin = new THREE.Mesh(isV ? new THREE.BoxGeometry(0.4, 6.6, 3.8) : new THREE.BoxGeometry(6.6, 0.4, 3.8), darkM); fin.position.set(rx * 3.3, ry * 3.3, 0); piv.add(fin);
        (isV ? rudders : planes).push(piv);
      }
      add(new THREE.TorusGeometry(2.15, 0.45, 8, 22), darkM, 0, 0, -L / 2 - 0.4);                // propulsor de chorro
      const rotor = new THREE.Group(); rotor.position.set(0, 0, -L / 2 - 0.2); g.add(rotor);
      for (let k = 0; k < 7; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.9, 0.12), steelM); const a = (k / 7) * TAU; b.position.set(Math.cos(a) * 1.0, Math.sin(a) * 1.0, 0); b.rotation.z = a - Math.PI / 2; b.rotation.x = 0.35; rotor.add(b); }
      add(new THREE.ConeGeometry(0.45, 1.2, 10).rotateX(-Math.PI / 2), steelM, 0, 0, -L / 2 - 1.1);
      add(new THREE.SphereGeometry(R * 0.93, 18, 12, 0, TAU, 0, Math.PI / 2).rotateX(Math.PI / 2).scale(0.75, 0.75, 0.55), darkM, 0, 0, L / 2 - 1.3);  // domo del sonar
      g.userData = { rotor, rudders, planes };
      return g;
    }
    const subTints = [0x3f5163, 0x4a5764];
    const subs = [0, 1].map(i => { const obj = buildSub(subTints[i]); scene.add(obj); const lp = labelSprite('SSN-0' + (i + 1), 'PATRULLA', '#22d3ee'), le = labelSprite('SSN-0' + (i + 1), 'EVASIÓN', '#ffc233'); lp.visible = true; le.visible = false; scene.add(lp, le); return { obj, lp, le, pose: { pos: new V3(), f: new V3(0, 0, 1), roll: 0, pitch: 0 }, evading: false }; });

    /* ---------------------------------- Torpedos y señuelos ---------------------------------- */
    function buildTorpedo() {
      const g = new THREE.Group(), prof = [];
      for (let i = 0; i <= 24; i++) { const u = i / 24, y = -3.6 + u * 7.4; let r = 0.28; if (u < 0.08) r = 0.12 + 0.16 * (u / 0.08); if (u > 0.86) r = 0.28 * Math.sqrt(Math.max(0, 1 - Math.pow((u - 0.86) / 0.14, 2))) + 0.03; prof.push(new THREE.Vector2(r, y)); }
      const body = new THREE.LatheGeometry(prof, 12); body.rotateX(Math.PI / 2);
      g.add(new THREE.Mesh(body, new M({ color: 0x41464e, roughness: 0.45, metalness: 0.5 })));
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.295, 0.295, 0.5, 12), new M({ color: 0xe9c46a, roughness: 0.5 })); band.rotation.x = Math.PI / 2; band.position.z = 2.4; g.add(band);
      const finG = new THREE.BoxGeometry(1.5, 0.08, 0.7), finM = new M({ color: 0x2a2e34, roughness: 0.6 });
      for (let k = 0; k < 4; k++) { const f = new THREE.Mesh(finG, finM); f.position.z = -3.3; f.rotation.z = (k / 4) * TAU; f.position.x = Math.cos(f.rotation.z) * 0.6; f.position.y = Math.sin(f.rotation.z) * 0.6; g.add(f); }
      const prop = new THREE.Group(); prop.position.z = -3.75; g.add(prop);
      for (let k = 0; k < 5; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.05), finM); b.rotation.z = (k / 5) * TAU; b.position.set(Math.cos(b.rotation.z + Math.PI / 2) * 0.35, Math.sin(b.rotation.z + Math.PI / 2) * 0.35, 0); prop.add(b); }
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), new THREE.MeshBasicMaterial({ color: 0x22d3ee }))).position.z = 3.8;
      const tailGlow = glow(0xff3b3b, 2.2, 0, 0, -4.1, g);
      g.scale.setScalar(1.7); g.userData = { prop, tailGlow }; return g;
    }
    const TORP_N = 6, torpObjs = Array.from({ length: TORP_N }, () => { const o = buildTorpedo(); o.visible = false; scene.add(o); const lb = labelSprite('TORPEDO', 'IMPACTO PROX.', '#ff5b78'); lb.visible = false; scene.add(lb); return { o, lb }; });
    const DECOY_N = 8, decoyObjs = Array.from({ length: DECOY_N }, () => {
      const o = new THREE.Group(); o.add(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 2.2, 10).rotateX(Math.PI / 2), new M({ color: 0x59606a, roughness: 0.5, metalness: 0.5 })));
      const core = glow(0xffd166, 5, 0, 0, 0, o); const ring = new THREE.Mesh(new THREE.RingGeometry(1, 1.07, 40), new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })); o.add(ring);
      o.visible = false; scene.add(o); return { o, core, ring };
    });
    const RING_N = 10, ringPool = Array.from({ length: RING_N }, () => { const m = new THREE.Mesh(new THREE.RingGeometry(1, 1.04, 56).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })); m.visible = false; scene.add(m); return { m, t0: -1, life: 1, max: 1, col: 0 }; });
    let ringHead = 0;
    function ping(pos, max, life, col) { const r = ringPool[ringHead]; ringHead = (ringHead + 1) % RING_N; r.m.position.copy(pos); r.t0 = sim.t; r.life = life; r.max = max; r.m.material.color.setHex(col); r.m.visible = true; }
    const FX_N = 4, fxPool = Array.from({ length: FX_N }, () => {
      const flash = glow(0xfff0c0, 1, 0, 0, 0, scene); flash.visible = false;
      const shock = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: 0xbfefff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.BackSide })); shock.visible = false; scene.add(shock);
      return { flash, shock, t0: -99, big: true };
    });
    let fxHead = 0;

    const bubbles = makeParticles(hq ? 900 : 450, { color: [0.86, 0.97, 1.0], size: [1.0, 1.7], alpha: 0.5, life: [2.4, 4.2], damp: 0.5, rise: 2.4, gravity: 0, power: 1.0 });
    const burst = makeParticles(hq ? 420 : 220, { color: [0.9, 0.98, 1.0], size: [3, 11], alpha: 0.5, life: [1.2, 2.5], damp: 1.7, rise: 1.2, gravity: 0, power: 1.4 });
    const systems = [bubbles, burst]; systems.forEach(s => scene.add(s.pts));

    /* ------------------------------ Simulación determinista ------------------------------ */
    const STEP = 0.05, DUR = 10.5, LAT = 48, VERT = 16, TSPEED = 26, TTURN = 0.62, SEEK = 130, DETECT = 165;
    const BASE = [{ a: 78, b: 52, w: 0.07, ph: 0, y0: -8, ya: 5, yw: 0.16, cx: -10, cz: 0 }, { a: 60, b: 76, w: -0.055, ph: 2.2, y0: 16, ya: 4, yw: 0.13, cx: 12, cz: 6 }];
    const sim = { t: 0, acc: 0, ev: [[], []], decoys: [], torps: [], pending: [], wave: 0, nextId: 1, decoyQueue: [], st: { minAxis: 1e9, spawned: 0, decoyDet: 0, lost: 0, self: 0, detTimes: [] } };
    const tmpB = new V3(), tmpC = new V3(), tmpD = new V3();

    function baseline(j, t, out) { const b = BASE[j]; return out.set(b.cx + b.a * Math.cos(b.w * t + b.ph), b.y0 + b.ya * Math.sin(b.yw * t + b.ph), b.cz + b.b * Math.sin(b.w * t + b.ph)); }
    function position(j, t, out) {
      baseline(j, t, out);
      for (const e of sim.ev[j]) { const tau = t - e.te; if (tau > 0 && tau < DUR) { const bump = Math.pow(Math.sin(Math.PI * tau / DUR), 2); out.x += e.dx * LAT * bump; out.z += e.dz * LAT * bump; out.y += e.vs * VERT * bump; } }
      return out;
    }
    function poseAt(j, t, out) {
      position(j, t, out.pos); position(j, t + 0.2, tmpB); tmpB.sub(out.pos); const len = Math.max(tmpB.length(), 1e-4); out.f.copy(tmpB).divideScalar(len);
      position(j, t + 0.4, tmpC).sub(tmpB.add(out.pos)); const f2 = tmpC.lengthSq() > 1e-8 ? tmpC.normalize() : out.f;
      let dpsi = Math.atan2(f2.x, f2.z) - Math.atan2(out.f.x, out.f.z); dpsi = Math.atan2(Math.sin(dpsi), Math.cos(dpsi));
      out.roll = clamp(-dpsi / 0.2 * 1.3, -0.75, 0.75); out.pitch = -Math.asin(clamp(out.f.y, -1, 1)); return out;
    }
    const sp = [{ pos: new V3(), f: new V3(), roll: 0, pitch: 0 }, { pos: new V3(), f: new V3(), roll: 0, pitch: 0 }];
    const isEvading = (j, t) => sim.ev[j].some(e => t - e.te < DUR + 1.5);
    const axisDist = (j, p) => { const s = sp[j], k = clamp(tmpD.copy(p).sub(s.pos).dot(s.f), -22, 22); return tmpD.copy(s.pos).addScaledVector(s.f, k).sub(p).length(); };

    function scheduleWave() {
      const w = sim.wave++, t0 = 4 + w * 27;
      sim.pending.push({ t: t0, tgt: w % 2, id: sim.nextId++ }, { t: t0 + 4.6, tgt: (w + 1) % 2, id: sim.nextId++ });
      if (w % 3 === 2) sim.pending.push({ t: t0 + 9.5, tgt: w % 2, id: sim.nextId++ });
      sim.pending.sort((a, b) => a.t - b.t);
    }
    function spawnTorp(s) {
      const rng = mulberry32(5000 + s.id * 131), P = sp[s.tgt].pos, az = rng() * TAU, dist = 205 + rng() * 30;
      const pos = new V3(P.x + Math.cos(az) * dist, clamp(P.y + (rng() - 0.5) * 30, -46, 55), P.z + Math.sin(az) * dist);
      baseline(s.tgt, sim.t + dist / TSPEED, tmpB); const dir = tmpB.clone().sub(pos).normalize();
      sim.st.spawned++; const slot = sim.torps.length; sim.torps.push({ id: s.id, pos, dir, speed: TSPEED, age: 0, state: 'run', target: null, tgt: s.tgt, lostT: 0, pingT: 0 });
      void slot;
    }
    const decoyNoise = d => 5 * smooth(0, 1.0, d.age) * (1 - smooth(11, 16, d.age));
    function explode(pos, big) {
      const fx = fxPool[fxHead]; fxHead = (fxHead + 1) % FX_N; fx.t0 = sim.t; fx.big = big; fx.flash.position.copy(pos); fx.shock.position.copy(pos);
      const n = big ? (hq ? 90 : 50) : 24;
      for (let i = 0; i < n; i++) { const v = new V3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(4, big ? 22 : 10)); burst.emit(pos.x, pos.y, pos.z, v.x, v.y, v.z); }
    }
    const steerDir = new V3();
    function stepTorp(tp, dt) {
      tp.age += dt;
      if (tp.state === 'run') {
        if (tp.age > 3) {
          let best = null, bs = 0;
          for (let j = 0; j < 2; j++) { const d = tp.pos.distanceTo(sp[j].pos); if (d < SEEK) { const s = (1 + (isEvading(j, sim.t) ? 0.8 : 0)) / (1 + Math.pow(d / 55, 2)); if (s > bs) { bs = s; best = { type: 'sub', j, pos: sp[j].pos, d }; } } }
          for (const dc of sim.decoys) { const d = tp.pos.distanceTo(dc.pos); if (d < SEEK) { const s = decoyNoise(dc) / (1 + Math.pow(d / 55, 2)); if (s > bs) { bs = s; best = { type: 'decoy', dc, pos: dc.pos, d }; } } }
          tp.target = best;
        }
        steerDir.copy(tp.dir);
        if (tp.target) steerDir.copy(tp.target.pos).sub(tp.pos).normalize();
        const ang = Math.acos(clamp(tp.dir.dot(steerDir), -1, 1)), maxA = TTURN * dt;
        if (ang > 1e-4) tp.dir.lerp(steerDir, Math.min(1, maxA / ang)).normalize();
        tp.pos.addScaledVector(tp.dir, tp.speed * dt);
        for (let j = 0; j < 2; j++) sim.st.minAxis = Math.min(sim.st.minAxis, axisDist(j, tp.pos));
        if (tp.target && tp.target.type === 'decoy' && tp.pos.distanceTo(tp.target.dc.pos) < 5.5) { explode(tp.target.dc.pos.clone(), true); sim.st.decoyDet++; sim.st.detTimes.push(+sim.t.toFixed(2)); tp.target.dc.age = 99; tp.state = 'dead'; return; }
        for (let j = 0; j < 2; j++) if (axisDist(j, tp.pos) < 20) { tmpB.copy(tp.pos).sub(sp[j].pos).normalize(); tp.dir.lerp(tmpB, 0.6).normalize(); tp.state = 'lost'; tp.lostT = 0; sim.st.lost++; return; }   // pierde el blanco y se aleja
        if (tp.age > 26) { explode(tp.pos.clone(), false); sim.st.self++; tp.state = 'dead'; }
      } else if (tp.state === 'lost') {
        tp.lostT += dt; tp.speed *= (1 - 0.14 * dt); tp.dir.y -= 0.16 * dt; tp.dir.normalize(); tp.pos.addScaledVector(tp.dir, tp.speed * dt);
        if (tp.lostT > 4.5) tp.state = 'dead';
      }
    }

    function stepSim(dt) {
      sim.t += dt;
      while (sim.pending.length < 3) scheduleWave();
      poseAt(0, sim.t, sp[0]); poseAt(1, sim.t, sp[1]);
      while (sim.pending.length && sim.pending[0].t <= sim.t) spawnTorp(sim.pending.shift());
      // detección y maniobra evasiva (+ lanzamiento de señuelos)
      for (let j = 0; j < 2; j++) {
        if (isEvading(j, sim.t)) continue;
        for (const tp of sim.torps) {
          if (tp.state !== 'run' || tp.age < 0.6) continue;
          const d = tp.pos.distanceTo(sp[j].pos); if (d > DETECT || tmpB.copy(sp[j].pos).sub(tp.pos).dot(tp.dir) <= 0) continue;
          const rng = mulberry32(900 + j * 17 + sim.ev[j].length), side = rng() < 0.5 ? -1 : 1;
          tmpC.copy(tp.pos).sub(sp[j].pos); tmpC.y = 0; if (tmpC.lengthSq() < 1e-6) tmpC.set(1, 0, 0); tmpC.normalize();
          sim.ev[j].push({ te: sim.t, dx: -tmpC.z * side, dz: tmpC.x * side, vs: j === 0 ? -1 : 1 }); if (sim.ev[j].length > 8) sim.ev[j].shift();
          sim.decoyQueue.push({ t: sim.t + 0.6, j }, { t: sim.t + 4.4, j }); break;
        }
      }
      sim.decoyQueue = sim.decoyQueue.filter(q => {
        if (q.t > sim.t) return true;
        const P = sp[q.j]; const side = (sim.decoys.length % 2 ? 1 : -1);
        sim.decoys.push({ pos: P.pos.clone().addScaledVector(P.f, -10), vel: P.f.clone().multiplyScalar(-6).add(new V3(-P.f.z * side * 3, rnd(-1, 1), P.f.x * side * 3)), age: 0, j: q.j }); return false;
      });
      for (const dc of sim.decoys) { dc.age += dt; dc.pos.addScaledVector(dc.vel, dt); dc.vel.multiplyScalar(1 - 0.12 * dt); }
      sim.decoys = sim.decoys.filter(d => d.age < 16);
      for (const tp of sim.torps) stepTorp(tp, dt);
      sim.torps = sim.torps.filter(tp => tp.state !== 'dead');
      subs.forEach((s, j) => { const e = isEvading(j, sim.t); if (e && !s.evading) ping(sp[j].pos, 90, 2.4, 0xffc233); s.evading = e; });
    }
    function resetSim() { sim.st = { minAxis: 1e9, spawned: 0, decoyDet: 0, lost: 0, self: 0, detTimes: [] }; sim.t = 0; sim.acc = 0; sim.ev = [[], []]; sim.decoys = []; sim.torps = []; sim.pending = []; sim.wave = 0; sim.nextId = 1; sim.decoyQueue = []; ringPool.forEach(r => { r.t0 = -1; r.m.visible = false; }); fxPool.forEach(f => { f.t0 = -99; f.flash.visible = false; f.shock.visible = false; }); }
    function advance(dt) { sim.acc += dt; let n = 0; while (sim.acc >= STEP && n++ < 8) { stepSim(STEP); sim.acc -= STEP; } }

    /* --------------------------------- Pintado desde la simulación --------------------------------- */
    const pe = { pos: new V3(), f: new V3(), roll: 0, pitch: 0 };
    let pingAcc = 0;
    function render(dt) {
      const tNow = sim.t + sim.acc;
      subs.forEach((s, j) => {
        poseAt(j, tNow, s.pose); const p = s.pose, o = s.obj;
        o.position.copy(p.pos); o.rotation.set(p.pitch, Math.atan2(p.f.x, p.f.z), p.roll, 'YXZ');
        const ud = o.userData; ud.rotor.rotation.z += dt * 9; ud.rudders.forEach(r => { r.rotation.y = clamp(p.roll * -0.5, -0.5, 0.5); }); ud.planes.forEach(r => { r.rotation.x = clamp(p.pitch * 1.5, -0.5, 0.5); });
        s.lp.position.copy(p.pos).add(tmpB.set(0, 11, 0)); s.le.position.copy(s.lp.position); s.lp.visible = !s.evading; s.le.visible = s.evading;
        const k = clamp(camera.position.distanceTo(p.pos) / 70, 0.6, 2.2); s.lp.scale.set(6.4 * k, 1.92 * k, 1); s.le.scale.set(6.4 * k, 1.92 * k, 1);
        if (!lite) { tmpC.copy(p.pos).addScaledVector(p.f, -26); if (Math.random() < dt * 22) bubbles.emit(tmpC.x + rnd(-1.2, 1.2), tmpC.y + rnd(-1.2, 1.2), tmpC.z + rnd(-1.2, 1.2), -p.f.x * 2 + rnd(-0.6, 0.6), rnd(0.2, 1.2), -p.f.z * 2 + rnd(-0.6, 0.6)); }
      });
      // torpedos
      torpObjs.forEach((to, i) => {
        const tp = sim.torps[i]; if (!tp) { to.o.visible = false; to.lb.visible = false; return; }
        to.o.visible = true; to.o.position.copy(tp.pos); tmpB.copy(tp.pos).add(tp.dir); to.o.lookAt(tmpB); to.o.userData.prop.rotation.z += dt * 40;
        to.o.userData.tailGlow.material.opacity = tp.state === 'lost' ? 0.15 : 0.5 + 0.5 * Math.sin(sim.t * 18 + i);
        to.lb.visible = tp.state === 'run'; to.lb.position.copy(tp.pos).add(tmpC.set(0, 5, 0)); const k = clamp(camera.position.distanceTo(tp.pos) / 70, 0.5, 2.0); to.lb.scale.set(6.4 * k, 1.92 * k, 1);
        if (Math.random() < dt * 55) { tmpC.copy(tp.pos).addScaledVector(tp.dir, -4.5); bubbles.emit(tmpC.x, tmpC.y, tmpC.z, rnd(-0.4, 0.4), rnd(0.2, 1.0), rnd(-0.4, 0.4)); }
        if (tp.state === 'run' && tp.age > 3) { tp.pingT += dt; if (tp.pingT > 1.3) { tp.pingT = 0; ping(tp.pos, 28, 1.1, 0xff5b78); } }
      });
      decoyObjs.forEach((d, i) => {
        const dc = sim.decoys[i]; if (!dc) { d.o.visible = false; return; }
        d.o.visible = true; d.o.position.copy(dc.pos); const n = decoyNoise(dc);
        d.core.material.opacity = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(sim.t * 10 + i)) * clamp(n / 3, 0.2, 1); d.ring.scale.setScalar(2 + ((sim.t * 5 + i * 3) % 10)); d.ring.material.opacity = 0.4 * (1 - ((sim.t * 5 + i * 3) % 10) / 10) * clamp(n / 3, 0, 1); d.ring.lookAt(camera.position);
        if (Math.random() < dt * 30) bubbles.emit(dc.pos.x + rnd(-1, 1), dc.pos.y + rnd(-1, 1), dc.pos.z + rnd(-1, 1), rnd(-1, 1), rnd(0.5, 2), rnd(-1, 1));
      });
      // pings de sonar de los submarinos (patrulla)
      pingAcc += dt; if (pingAcc > 5.5) { pingAcc = 0; ping(subs[(sim.wave + (sim.t | 0)) % 2].pose.pos, 120, 3.2, 0x22d3ee); }
      ringPool.forEach(r => { if (r.t0 < 0) return; const a = (sim.t - r.t0) / r.life; if (a >= 1 || a < 0) { r.m.visible = false; r.t0 = -1; return; } r.m.scale.setScalar(1 + a * r.max); r.m.material.opacity = (1 - a) * 0.5; });
      // explosiones
      let flash = 0;
      fxPool.forEach(f => {
        const a = (sim.t - f.t0) / (f.big ? 1.3 : 0.7);
        if (a < 0 || a >= 1) { f.flash.visible = false; f.shock.visible = false; return; }
        f.flash.visible = f.shock.visible = true; const e = 1 - Math.pow(1 - a, 3), sc = f.big ? 1 : 0.5;
        f.flash.scale.setScalar((6 + 46 * e) * sc); f.flash.material.opacity = (1 - a) * 0.95; f.shock.scale.setScalar((2 + 40 * e) * sc); f.shock.material.opacity = (1 - a) * 0.28;
        flash = Math.max(flash, (1 - a) * (f.big ? 6 : 2.5)); flashLight.position.copy(f.flash.position);
      });
      flashLight.intensity = flash * 900;
    }

    /* ------------------------------------- Cámara ------------------------------------- */
    const SHOTS = ['wide', 'chase', 'torp', 'reef', 'side'], SHOT_LEN = 8.5, BLEND = 1.8;
    const camPos = new V3(), camLook = new V3(), fromPos = new V3(), fromLook = new V3(), poseP = new V3(), poseL = new V3(), mid = new V3(), fwd2 = new V3();
    let curShot = '', blendT = 99;
    function pose(name, T, outP, outL) {
      const a = subs[0].pose, b = subs[1].pose; mid.copy(a.pos).add(b.pos).multiplyScalar(0.5);
      const idx = Math.floor(T / SHOT_LEN), s = subs[idx % 2].pose;
      switch (name) {
        case 'chase': outP.copy(s.pos).addScaledVector(s.f, -46).add(tmpB.set(10, 15, 0)); outL.copy(s.pos).addScaledVector(s.f, 22); break;
        case 'torp': { const tp = sim.torps.find(t => t.state === 'run'); if (tp) { outP.copy(tp.pos).addScaledVector(tp.dir, -26).add(tmpB.set(0, 6, 0)); outL.copy(tp.pos).addScaledVector(tp.dir, 38); break; } return pose('chase', T, outP, outL); }
        case 'reef': { const ang = T * 0.05; outP.set(mid.x + Math.cos(ang) * 70, seaH(mid.x + Math.cos(ang) * 70, mid.z + Math.sin(ang) * 70) + 9, mid.z + Math.sin(ang) * 70); outL.copy(mid).add(tmpB.set(0, 4, 0)); break; }
        case 'side': fwd2.set(-s.f.z, 0, s.f.x); outP.copy(s.pos).addScaledVector(fwd2, 62).add(tmpB.set(0, 5, 0)); outL.copy(s.pos).addScaledVector(s.f, 4); break;
        default: { const ang = T * 0.075 + 0.5; outP.set(mid.x + Math.cos(ang) * 112, mid.y + 22 + 16 * Math.sin(T * 0.2), mid.z + Math.sin(ang) * 112); outL.copy(mid); }
      }
      return name;
    }
    function updateCamera(dt, snap) {
      const T = sim.t + sim.acc;
      let name = SHOTS[Math.floor(T / SHOT_LEN) % SHOTS.length];
      pose(name, T, poseP, poseL);
      if (name === 'torp' && !sim.torps.some(t => t.state === 'run')) name = 'chase';
      if (name !== curShot) { fromPos.copy(camPos); fromLook.copy(camLook); curShot = name; blendT = snap ? 99 : 0; if (snap) { camPos.copy(poseP); camLook.copy(poseL); fromPos.copy(poseP); fromLook.copy(poseL); } }
      blendT += dt; state.shot = name;
      const f = smooth(0, BLEND, blendT);
      camPos.lerpVectors(fromPos, poseP, f); camLook.lerpVectors(fromLook, poseL, f);
      camPos.y = clamp(camPos.y, seaH(camPos.x, camPos.z) + 2.5, 68);
      camera.position.copy(camPos); camera.lookAt(camLook); water.position.copy(camera.position);
      snow.material.uniforms.uCam.value.copy(camera.position);
    }

    /* ------------------------------- Tamaño / bucle / calidad ------------------------------- */
    function resize() {
      const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, state.pixelRatioCap)); renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.fov = w / h < 0.8 ? 68 : 55; camera.updateProjectionMatrix();
      if (opts.shiftY && w / h > 1.2) camera.setViewOffset(w, h, 0, opts.shiftY * h, w, h); else camera.clearViewOffset();
      const k = (h * renderer.getPixelRatio()) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
      systems.forEach(s => { s.mat.uniforms.uScale.value = k * 0.4; }); snow.material.uniforms.uScale.value = k * 0.1;
    }
    window.addEventListener('resize', resize); resize();

    function frame(dt, snap) {
      advance(dt); const tNow = sim.t + sim.acc;
      render(dt); updateCamera(dt, snap);
      systems.forEach(s => s.update(dt)); updateFish(tNow);
      causticU.value = tNow; kelpU.value = tNow; surf.material.uniforms.uT.value = tNow; snow.material.uniforms.uT.value = tNow;
      rays.forEach(r => { r.material.uniforms.uA.value = r.userData.base * (0.75 + 0.25 * Math.sin(tNow * 0.6 + r.userData.ph)); r.rotation.z = -0.22 + 0.05 * Math.sin(tNow * 0.25 + r.userData.ph); });
    }

    let raf = 0, last = 0, lastRender = 0, ema = 16, slow = 0;
    const minStep = opts.fps ? 1000 / opts.fps - 2 : 0;
    function loop(now) {
      raf = requestAnimationFrame(loop);
      if (opts.pause && opts.pause()) { last = 0; return; }
      if (minStep && now - lastRender < minStep) return;
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now; lastRender = now;
      frame(dt, false); renderer.render(scene, camera);
      ema = lerp(ema, dt * 1000, 0.05); state.fps = Math.round(1000 / Math.max(ema, 1));
      if (ema > (opts.fps ? 1000 / opts.fps + 22 : 38) && ++slow > 120) { slow = 0; if (state.pixelRatioCap > 1) { state.pixelRatioCap = 1; resize(); } } else if (ema <= 38) slow = 0;
    }
    const onVis = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else if (!reduceMotion && !raf) { last = 0; raf = requestAnimationFrame(loop); } };
    document.addEventListener('visibilitychange', onVis);
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); cancelAnimationFrame(raf); raf = 0; });

    const api = {
      seek(sec) {
        resetSim(); curShot = ''; stepSim(STEP); let t = STEP;
        while (t < sec - STEP) { stepSim(STEP); t += STEP; }
        sim.acc = 0; frame(0.0001, true); renderer.render(scene, camera);
      },
      info() { return { stats: Object.assign({}, sim.st, { minAxis: +sim.st.minAxis.toFixed(1), detTimes: sim.st.detTimes.slice(-12) }), T: +(sim.t + sim.acc).toFixed(2), shot: state.shot, torpedoes: sim.torps.filter(t => t.state === 'run').length, lost: sim.torps.filter(t => t.state === 'lost').length, decoys: sim.decoys.length, evading: subs.map(s => s.evading), maneuvers: sim.ev[0].length + sim.ev[1].length, minSubTorp: sim.torps.length ? +Math.min(...sim.torps.flatMap(tp => [0, 1].map(j => axisDist(j, tp.pos)))).toFixed(1) : null }; },
      stats() { return { fps: state.fps, quality: opts.quality, shot: state.shot, pixelRatio: renderer.getPixelRatio() }; },
      dispose() {
        cancelAnimationFrame(raf); raf = 0; window.removeEventListener('resize', resize); document.removeEventListener('visibilitychange', onVis);
        scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); });
        renderer.dispose();
      }
    };
    resetSim(); stepSim(STEP);
    if (reduceMotion) api.seek(30); else { for (let i = 0; i < 40; i++) stepSim(STEP); frame(0.05, true); raf = requestAnimationFrame(loop); }
    return api;
  }

  window.CMOceanScene = { start };
  if (window.CMScenes) window.CMScenes.register({ id: 'ocean', label: 'Océano, arrecifes y submarinos', desc: 'Submarinos nucleares evadiendo torpedos entre corales', icon: 'ti-submarine', start });
})();
