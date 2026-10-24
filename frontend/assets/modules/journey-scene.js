/**
 * journey-scene.js — Escenario 3D de fondo para el Dashboard.
 * Un convoy de camionetas tácticas sale del desierto, cruza un río por un vado con corriente
 * y entra a un pueblo, mientras drones lo siguen y rastrean. Todo es procedural.
 *
 *   CMJourneyScene.start(canvas, opts)  -> api { seek, info, stats, dispose }
 *   CMJourneyScene.mount()              -> lo coloca como fondo del dashboard (con interruptor y calidad adaptable)
 *   CMJourneyScene.toggle() / isOn()
 */
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const rnd = (a, b) => a + Math.random() * (b - a);

  function start(canvas, options) {
    const THREE = window.THREE, Kit = window.CMSceneKit;
    if (!THREE || !Kit) throw new Error('Three.js o scene-kit no disponibles');
    const opts = Object.assign({ fps: 0, shadows: true, quality: 'high', pixelRatioCap: 1.75, pause: null, shiftY: 0 }, options || {});
    const hq = opts.quality === 'high', lite = opts.quality === 'low';
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const state = { shot: '', zone: 'desert', fps: 0, pixelRatioCap: opts.pixelRatioCap };

    const kit = Kit.create(THREE, { hq: opts.shadows });
    const { boxG, M, glow, labelSprite, buildTruck, buildDrone, makeParticles, makeDust } = kit;
    const V3 = THREE.Vector3, UP = new V3(0, 1, 0);

    /* ------------------------------ Renderer / escena ------------------------------ */
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lite, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, state.pixelRatioCap));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = opts.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(new THREE.Color('#e0a06b'), 90, 700);
    const camera = new THREE.PerspectiveCamera(52, 1, 0.3, 3000);

    /* ---------------------------------- Cielo ---------------------------------- */
    const sunDir = new V3(-0.7, 0.2, -0.45).normalize();
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(1800, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, fog: false,
        uniforms: { uSun: { value: sunDir }, uTop: { value: new THREE.Color('#0a1d3b') }, uMid: { value: new THREE.Color('#6a527e') }, uHor: { value: new THREE.Color('#f7ab66') } },
        vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: `
          uniform vec3 uSun; uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uHor; varying vec3 vDir;
          void main(){
            float h = clamp(vDir.y, 0.0, 1.0);
            vec3 col = mix(uHor, uMid, smoothstep(0.0, 0.22, h));
            col = mix(col, uTop, smoothstep(0.18, 0.85, h));
            float s = max(dot(normalize(vDir), normalize(uSun)), 0.0);
            col += vec3(1.0, 0.62, 0.30) * pow(s, 14.0) * 0.55;
            col += vec3(1.0, 0.80, 0.55) * pow(s, 90.0) * 0.9;
            col += vec3(1.0, 0.95, 0.85) * pow(s, 900.0) * 3.0;
            gl_FragColor = vec4(col, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`
      })
    );
    scene.add(sky);
    const skyColor = new THREE.Color('#9cbbd6');           // reflejo del cielo en el agua

    scene.add(new THREE.HemisphereLight(0x86a3d0, 0xc98e58, 1.35));
    const sun = new THREE.DirectionalLight(0xffcf9c, 4.0);
    sun.castShadow = opts.shadows;
    if (opts.shadows) {
      sun.shadow.mapSize.set(2048, 2048);
      const sc = sun.shadow.camera; sc.left = -55; sc.right = 55; sc.top = 55; sc.bottom = -55; sc.near = 10; sc.far = 460;
      sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.06;
    }
    scene.add(sun, sun.target);

    /* ---------------------------- Mundo: río, camino, terreno ---------------------------- */
    const HALF_X = 330, HALF_Z = 190, WATER_Y = -0.2, RIVER_HW = 15, TOWN_X = 62;
    const xc = z => 7 * Math.sin(z * 0.035) + 4 * Math.sin(z * 0.09 + 1);           // eje del río (serpentea)
    const PLAZA = { x: 150, z: 0, r: 24 };

    const P = [[-185, 10], [-150, -26], [-100, -40], [-48, -40], [-6, -38], [36, -38], [80, -36], [118, -33], [152, -34], [186, -18], [198, 0], [186, 18], [152, 34], [118, 32], [80, 34], [36, 38], [-6, 38], [-48, 40], [-100, 40], [-150, 26]];
    const curve = new THREE.CatmullRomCurve3(P.map(([x, z]) => new V3(x, 0, z)), true, 'centripetal');
    const L = curve.getLength();
    const samples = []; for (let i = 0; i < 260; i++) samples.push(curve.getPointAt(i / 260));
    const distPath = (x, z) => {
      let m = 1e9;
      for (let i = 0; i < samples.length; i++) { const dx = x - samples[i].x, dz = z - samples[i].z, d = dx * dx + dz * dz; if (d < m) m = d; }
      return Math.sqrt(m);
    };

    const bigH = (x, z) => 5.2 * Math.sin(x * 0.011 + 0.7) * Math.cos(z * 0.013 - 0.4) + 3.1 * Math.sin(x * 0.021 + z * 0.017 + 1.9)
      + 1.7 * Math.cos(x * 0.036 - z * 0.029) + 1.8 * (1 - Math.abs(Math.sin(x * 0.03 + z * 0.012 + 0.5)));
    const detH = (x, z) => 0.55 * Math.sin(x * 0.11 + z * 0.07) + 0.35 * Math.sin(x * 0.19 - z * 0.23 + 1.1) + 0.12 * Math.sin(x * 0.6 + z * 0.5);
    const edgeFade = (x, z) => 1 - smooth(0.8, 1.0, Math.max(Math.abs(x) / HALF_X, Math.abs(z) / HALF_Z));

    function height(x, z, dp) {
      const ad = Math.abs(x - xc(z));
      const flatP = smooth(3, 16, dp);
      const desert = 1 - smooth(-40, 20, x);
      let h = bigH(x, z) * (0.2 + 0.8 * flatP) * desert + detH(x, z) * flatP * (0.4 + 0.6 * desert);
      h *= smooth(16, 60, ad);                                   // orillas planas
      h = lerp(h, 0, smooth(40, 75, x));                         // el pueblo es llano
      h = h * edgeFade(x, z) + 0.5;
      // cauce: profundo en el centro y poco profundo (vado) donde cruza el camino
      const inCh = 1 - smooth(RIVER_HW * 0.55, RIVER_HW * 1.1, ad);
      const taper = 1 - smooth(150, 185, Math.abs(z));
      const ford = 1 - smooth(2.5, 10, dp);
      const bed = lerp(-3.0, -1.25, ford) * inCh * taper;
      return h + bed;
    }
    const H = (x, z) => height(x, z, distPath(x, z));

    /* terreno con colores por zona (arena, ribera húmeda, lecho, tierra del pueblo, huellas) */
    const SEGX = hq ? 250 : (lite ? 110 : 170), SEGZ = hq ? 145 : (lite ? 64 : 100);
    const tGeo = new THREE.PlaneGeometry(HALF_X * 2, HALF_Z * 2, SEGX, SEGZ).rotateX(-Math.PI / 2);
    {
      const pos = tGeo.attributes.position, col = new Float32Array(pos.count * 3);
      const lo = new THREE.Color('#c0904f'), hi = new THREE.Color('#f3d29b'), trackC = new THREE.Color('#946b3c'), wet = new THREE.Color('#7d8450'), bedC = new THREE.Color('#6b5a45'), townC = new THREE.Color('#cdac7c'), c = new THREE.Color();
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i), dp = distPath(x, z), y = height(x, z, dp);
        pos.setY(i, y);
        const n = 0.5 + 0.5 * Math.sin(x * 0.23 + z * 0.17) * Math.cos(z * 0.31 - x * 0.05);
        c.copy(lo).lerp(hi, clamp((y + 4) / 12 + (n - 0.5) * 0.18, 0, 1));
        const ad = Math.abs(x - xc(z));
        c.lerp(wet, (1 - smooth(RIVER_HW * 1.1, RIVER_HW * 2.4, ad)) * 0.5 * smooth(-0.6, 0.5, y));
        if (y < WATER_Y + 0.25) c.lerp(bedC, 0.85);
        c.lerp(townC, smooth(52, 80, x) * 0.85);
        if (dp < 2.8) c.lerp(trackC, (1 - smooth(1.2, 2.8, dp)) * 0.7);
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      }
      tGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      tGeo.computeVertexNormals();
    }
    const terrain = new THREE.Mesh(tGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }));
    terrain.receiveShadow = true; scene.add(terrain);
    const farShape = new THREE.Shape(); farShape.absarc(0, 0, 2000, 0, TAU, false);
    const hole = new THREE.Path(); const hx = HALF_X - 0.5, hz = HALF_Z - 0.5;
    hole.moveTo(-hx, -hz); hole.lineTo(-hx, hz); hole.lineTo(hx, hz); hole.lineTo(hx, -hz); hole.lineTo(-hx, -hz);
    farShape.holes.push(hole);
    const far = new THREE.Mesh(new THREE.ShapeGeometry(farShape, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#d09660', side: THREE.DoubleSide }));
    far.position.y = 0.3; scene.add(far);       // fuera del terreno; dentro queda el hueco para que se vea el cauce

    /* ------------------------------------- Agua ------------------------------------- */
    const water = (() => {
      const NZ = 180, NS = 8, pos = [], aS = [], idx = [];
      for (let iz = 0; iz <= NZ; iz++) {
        const z = -HALF_Z + (2 * HALF_Z * iz) / NZ;
        for (let is = 0; is <= NS; is++) { const s = -1 + (2 * is) / NS; pos.push(xc(z) + s * RIVER_HW * 1.2, WATER_Y, z); aS.push(s); }
      }
      for (let iz = 0; iz < NZ; iz++) for (let is = 0; is < NS; is++) { const a = iz * (NS + 1) + is, b = a + 1, c = a + NS + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aS', new THREE.Float32BufferAttribute(aS, 1)); g.setIndex(idx);
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true,
        uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
          uTime: { value: 0 }, uSun: { value: sunDir }, uDeep: { value: new THREE.Color('#0a4a68') }, uShallow: { value: new THREE.Color('#2f9ea6') },
          uSky: { value: skyColor }, uHalfZ: { value: HALF_Z }
        }]),
        vertexShader: `
          #include <fog_pars_vertex>
          attribute float aS; varying vec3 vW; varying float vS;
          void main(){
            vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vS = aS;
            vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
            #include <fog_vertex>
          }`,
        fragmentShader: `
          #include <fog_pars_fragment>
          uniform float uTime; uniform vec3 uSun; uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uSky; uniform float uHalfZ;
          varying vec3 vW; varying float vS;
          void main(){
            vec2 q = vW.xz + vec2(0.0, uTime * 3.4);          // la corriente avanza hacia +Z
            float dx = cos(q.x*0.9 + q.y*0.35)*0.30 + cos(q.x*2.3 - q.y*1.1 + uTime)*0.14 + cos(q.x*5.1 + q.y*3.7 - uTime*1.7)*0.06;
            float dz = cos(q.y*0.7 + q.x*0.4)*0.28 + cos(q.y*1.9 + q.x*1.7 + uTime*0.8)*0.12 + cos(q.y*4.3 - q.x*3.1)*0.05;
            vec3 N = normalize(vec3(-dx, 1.0, -dz));
            vec3 V = normalize(cameraPosition - vW);
            float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
            float centre = 1.0 - abs(vS);
            vec3 base = mix(uShallow, uDeep, smoothstep(0.1, 0.9, centre));
            vec3 col = mix(base, uSky, clamp(fres*0.7 + 0.06, 0.0, 0.75));
            // marcas alargadas en el sentido de la corriente
            float streak = smoothstep(0.55, 1.0, sin(q.x*1.7 + sin(q.y*0.35)*2.2) * sin(q.x*0.6 - q.y*0.08 + 1.3) * 0.5 + 0.5);
            col += vec3(0.45, 0.72, 0.82) * streak * 0.22;
            vec3 Hh = normalize(uSun + V);
            col += vec3(1.0, 0.78, 0.55) * pow(max(dot(N, Hh), 0.0), 120.0) * 1.6;
            float fn = sin(vW.x*3.1 + uTime*1.3) * sin(vW.z*2.7 - uTime*3.0) * 0.5 + 0.5;
            float crest = smoothstep(0.78, 1.0, sin(q.x*2.6 + q.y*1.1 + uTime*0.7) * sin(q.y*2.1 - q.x*1.4) * 0.5 + 0.5);
            float foam = smoothstep(0.72, 0.98, abs(vS)) * fn * 0.9 + crest * 0.07;
            col = mix(col, vec3(0.95, 0.97, 1.0), clamp(foam, 0.0, 0.8));
            float a = mix(0.80, 0.96, fres) * (1.0 - smoothstep(0.82, 1.0, abs(vS)) * 0.4);
            a *= 1.0 - smoothstep(0.8, 1.0, abs(vW.z) / uHalfZ);
            gl_FragColor = vec4(col, a);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
            #include <fog_fragment>
          }`
      });
      const mesh = new THREE.Mesh(g, mat); mesh.renderOrder = 2; mesh.frustumCulled = false; scene.add(mesh);
      return mesh;
    })();

    /* ----------------------------------- Decorado ----------------------------------- */
    const dummy = new THREE.Object3D();
    const spot = (pred, tries) => { for (let k = 0; k < (tries || 60); k++) { const x = rnd(-HALF_X + 6, HALF_X - 6), z = rnd(-HALF_Z + 6, HALF_Z - 6); if (pred(x, z)) return [x, z]; } return null; };
    const inst = (geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.receiveShadow = true; m.castShadow = opts.shadows && hq; return m; };

    // rocas (desierto y lecho del río) y arbustos
    {
      const n = hq ? 130 : 70, rocks = inst(new THREE.IcosahedronGeometry(1, 0), new M({ color: 0x9a7452, roughness: 0.95, flatShading: true }), n);
      for (let i = 0; i < n; i++) {
        const sp = spot((x, z) => x < 62 && distPath(x, z) > 10 && (x < -25 || Math.abs(x - xc(z)) < RIVER_HW + 30)) || [-200, 120], k = rnd(0.5, 2.6);
        dummy.position.set(sp[0], H(sp[0], sp[1]) + k * 0.2, sp[1]); dummy.rotation.set(rnd(0, 3), rnd(0, 3), rnd(0, 3)); dummy.scale.set(k * rnd(0.8, 1.6), k * rnd(0.5, 1), k * rnd(0.8, 1.4)); dummy.updateMatrix(); rocks.setMatrixAt(i, dummy.matrix);
      }
      scene.add(rocks);
      const nb = hq ? 110 : 55, desertBush = inst(new THREE.IcosahedronGeometry(1, 0), new M({ color: 0x9a8f4f, roughness: 1, flatShading: true }), nb);
      for (let i = 0; i < nb; i++) {
        const sp = spot((x, z) => x < -10 && distPath(x, z) > 6) || [-210, 90], k = rnd(0.4, 1.1);
        dummy.position.set(sp[0], H(sp[0], sp[1]) + 0.2, sp[1]); dummy.rotation.set(0, rnd(0, 3), 0); dummy.scale.set(k * 1.3, k * 0.6, k * 1.3); dummy.updateMatrix(); desertBush.setMatrixAt(i, dummy.matrix);
      }
      scene.add(desertBush);
      const ng = hq ? 120 : 60, green = inst(new THREE.IcosahedronGeometry(1, 0), new M({ color: 0x4f7a3a, roughness: 1, flatShading: true }), ng);
      for (let i = 0; i < ng; i++) {
        const sp = spot((x, z) => { const ad = Math.abs(x - xc(z)); return ad > RIVER_HW * 1.15 && ad < RIVER_HW + 38 && distPath(x, z) > 6 && x < 120 && H(x, z) > 0; }) || [40, 100], k = rnd(0.5, 1.4);
        dummy.position.set(sp[0], H(sp[0], sp[1]) + 0.3, sp[1]); dummy.rotation.set(0, rnd(0, 3), 0); dummy.scale.set(k * 1.5, k * rnd(0.7, 1.1), k * 1.5); dummy.updateMatrix(); green.setMatrixAt(i, dummy.matrix);
      }
      scene.add(green);
    }
    // cactus (solo en el lado del desierto)
    {
      const cm = new M({ color: 0x5b8a54, roughness: 0.9 });
      const trunk = new THREE.CylinderGeometry(0.28, 0.32, 3.4, 8), arm = new THREE.CylinderGeometry(0.17, 0.19, 1.3, 8), elbow = new THREE.CylinderGeometry(0.17, 0.17, 0.7, 8), cap = new THREE.SphereGeometry(0.28, 8, 6), capA = new THREE.SphereGeometry(0.17, 8, 6);
      const nC = hq ? 22 : 10;
      for (let i = 0; i < nC; i++) {
        const sp = spot((x, z) => x < -30 && distPath(x, z) > 10) || [-220, 100], g = new THREE.Group(), k = rnd(0.8, 1.5);
        const add = (geo, px, py, pz, rx, rz) => { const mm = new THREE.Mesh(geo, cm); mm.position.set(px, py, pz); mm.rotation.set(rx || 0, 0, rz || 0); mm.castShadow = opts.shadows && hq; g.add(mm); };
        add(trunk, 0, 1.7, 0); add(cap, 0, 3.4, 0); add(elbow, 0.5, 1.7, 0, 0, Math.PI / 2); add(arm, 0.82, 2.25, 0); add(capA, 0.82, 2.9, 0);
        if (i % 2) { add(elbow, -0.5, 1.4, 0, 0, Math.PI / 2); add(arm, -0.82, 1.95, 0); add(capA, -0.82, 2.6, 0); }
        g.scale.setScalar(k); g.rotation.y = rnd(0, TAU); g.position.set(sp[0], H(sp[0], sp[1]), sp[1]); scene.add(g);
      }
    }
    // palmeras (orilla del río y plaza)
    {
      const trunkG = new THREE.CylinderGeometry(0.15, 0.26, 6.5, 6).translate(0, 3.25, 0), leafG = new THREE.BoxGeometry(0.55, 0.05, 3.3).translate(0, 0, 1.65);
      const spots = [];
      for (let i = 0; i < (hq ? 34 : 18); i++) { const sp = spot((x, z) => { const ad = Math.abs(x - xc(z)); return ad > RIVER_HW * 1.3 && ad < RIVER_HW + 26 && distPath(x, z) > 7 && H(x, z) > 0.2 && x < 130; }); if (sp) spots.push(sp); }
      for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; spots.push([PLAZA.x + Math.cos(a) * (PLAZA.r - 3), PLAZA.z + Math.sin(a) * (PLAZA.r - 3)]); }
      const trunks = inst(trunkG, new M({ color: 0x7a5b3c, roughness: 1 }), spots.length), leaves = inst(leafG, new M({ color: 0x4d7a35, roughness: 0.9, side: THREE.DoubleSide }), spots.length * 8);
      spots.forEach(([x, z], i) => {
        const y = H(x, z), tilt = rnd(-0.08, 0.08), h = rnd(0.85, 1.25);
        dummy.position.set(x, y, z); dummy.rotation.set(tilt, rnd(0, TAU), 0); dummy.scale.set(1, h, 1); dummy.updateMatrix(); trunks.setMatrixAt(i, dummy.matrix);
        for (let k = 0; k < 8; k++) { dummy.position.set(x, y + 6.5 * h, z); dummy.rotation.set(0.55 + rnd(-0.1, 0.1), (k / 8) * TAU + rnd(-0.15, 0.15), 0, 'YXZ'); dummy.scale.set(1, 1, h); dummy.updateMatrix(); leaves.setMatrixAt(i * 8 + k, dummy.matrix); }
      });
      scene.add(trunks, leaves);
    }
    // mesetas y montañas lejanas
    {
      const mesaMat = new M({ vertexColors: true, roughness: 1, flatShading: true });
      const bands = [new THREE.Color('#b0653f'), new THREE.Color('#cb8250'), new THREE.Color('#945439'), new THREE.Color('#bf7248')];
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU + rnd(-0.15, 0.15), r = rnd(430, 640), w = rnd(26, 62), h = rnd(30, 72);
        const geo = new THREE.CylinderGeometry(w * 0.72, w, h, 10, 5), p = geo.attributes.position, cols = new Float32Array(p.count * 3), c = new THREE.Color();
        for (let k = 0; k < p.count; k++) {
          const yy = p.getY(k) / h + 0.5;
          if (yy > 0.02 && yy < 0.98) { p.setX(k, p.getX(k) * (1 + 0.12 * Math.sin(k * 12.9))); p.setZ(k, p.getZ(k) * (1 + 0.12 * Math.cos(k * 7.3))); }
          c.copy(bands[Math.floor(clamp(yy, 0, 0.999) * 7) % bands.length]); cols[k * 3] = c.r; cols[k * 3 + 1] = c.g; cols[k * 3 + 2] = c.b;
        }
        geo.setAttribute('color', new THREE.BufferAttribute(cols, 3)); geo.computeVertexNormals();
        const m = new THREE.Mesh(geo, mesaMat); m.position.set(Math.cos(a) * r, h / 2 - 8, Math.sin(a) * r); m.rotation.y = rnd(0, TAU); scene.add(m);
      }
      const mtn = new M({ color: 0x77565f, roughness: 1, flatShading: true });
      for (let i = 0; i < 9; i++) { const h = rnd(70, 150), w = rnd(70, 130), m = new THREE.Mesh(new THREE.ConeGeometry(w, h, 6), mtn); m.position.set(rnd(420, 620), h / 2 - 6, -330 + i * 80 + rnd(-20, 20)); m.rotation.y = rnd(0, TAU); scene.add(m); }
    }

    /* ----------------------------------- El pueblo ----------------------------------- */
    {
      const winTex = (floors, seed) => {
        const rng = (() => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
        const mk = lit => { const c = document.createElement('canvas'); c.width = 128; c.height = 64 * floors; const g = c.getContext('2d'); g.fillStyle = lit ? '#000' : '#fff'; g.fillRect(0, 0, c.width, c.height); return [c, g]; };
        const [c1, g1] = mk(false), [c2, g2] = mk(true);
        for (let f = 0; f < floors; f++) for (let i = 0; i < 3; i++) {
          const x = 16 + i * 40, y = c1.height - (f + 1) * 64 + 14, on = rng() < 0.45;
          g1.fillStyle = '#26323f'; g1.fillRect(x, y, 22, 30);
          if (on) { g2.fillStyle = rng() < 0.8 ? '#ffd9a0' : '#bfe6ff'; g2.fillRect(x, y, 22, 30); }
        }
        g1.fillStyle = '#3a2a22'; g1.fillRect(54, c1.height - 38, 22, 38);
        const t1 = new THREE.CanvasTexture(c1), t2 = new THREE.CanvasTexture(c2); t1.colorSpace = t2.colorSpace = THREE.SRGBColorSpace; return [t1, t2];
      };
      const tints = ['#e7d3b0', '#d9b98f', '#cfa27a', '#e9e0cc', '#c98f6a', '#bfc7c4', '#dcae8a'].map(h => new THREE.Color(h));
      const roofTints = ['#8a4b38', '#7a5a46', '#9a5b3f', '#6f6a66'].map(h => new THREE.Color(h));
      const bodyGeo = new THREE.BoxGeometry(1, 1, 1);
      const groups = {};   // `${floors}-${variant}` -> lista
      const recs = [];
      const cell = hq ? 15 : 19;
      for (let cx = TOWN_X + 6; cx < 238; cx += cell) for (let cz = -102; cz <= 102; cz += cell) {
        const x = cx + rnd(-2.5, 2.5), z = cz + rnd(-2.5, 2.5);
        if (distPath(x, z) < 10 || Math.hypot(x - PLAZA.x, z - PLAZA.z) < PLAZA.r + 5 || Math.random() < 0.14) continue;
        const r = Math.random(), floors = r < 0.42 ? 1 : (r < 0.82 ? 2 : 3), w = rnd(7.5, 11), d = rnd(7.5, 11), h = floors * 3.2;
        recs.push({ x, z, w, d, h, floors, rot: rnd(-0.06, 0.06), variant: Math.random() < 0.5 ? 0 : 1, tint: tints[(Math.random() * tints.length) | 0], roof: roofTints[(Math.random() * roofTints.length) | 0] });
      }
      [1, 2, 3].forEach(f => [0, 1].forEach(v => {
        const list = recs.filter(b => b.floors === f && b.variant === v); if (!list.length) return;
        const [map, emap] = winTex(f, 1000 + f * 17 + v * 101);
        const mat = new M({ map, emissiveMap: emap, emissive: 0xffffff, emissiveIntensity: 1.25, roughness: 0.92 });
        const im = new THREE.InstancedMesh(bodyGeo, mat, list.length); im.castShadow = opts.shadows && hq; im.receiveShadow = true;
        list.forEach((b, i) => { dummy.position.set(b.x, 0.5 + b.h / 2, b.z); dummy.rotation.set(0, b.rot, 0); dummy.scale.set(b.w, b.h, b.d); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); im.setColorAt(i, b.tint); });
        scene.add(im);
      }));
      const roofs = inst(bodyGeo, new M({ roughness: 0.95 }), recs.length);
      recs.forEach((b, i) => { dummy.position.set(b.x, 0.5 + b.h + 0.2, b.z); dummy.rotation.set(0, b.rot, 0); dummy.scale.set(b.w * 1.05, 0.4, b.d * 1.05); dummy.updateMatrix(); roofs.setMatrixAt(i, dummy.matrix); roofs.setColorAt(i, b.roof); });
      scene.add(roofs);
      const tanks = recs.filter(() => Math.random() < 0.28), tankIm = inst(new THREE.CylinderGeometry(0.9, 0.9, 1.5, 10), new M({ color: 0xcfd3d6, roughness: 0.5, metalness: 0.3 }), Math.max(1, tanks.length));
      tanks.forEach((b, i) => { dummy.position.set(b.x + rnd(-2, 2), 0.5 + b.h + 1.15, b.z + rnd(-2, 2)); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); tankIm.setMatrixAt(i, dummy.matrix); });
      tankIm.count = tanks.length; scene.add(tankIm);

      // plaza, fuente, iglesia con reloj, torre de agua y torre de radio
      const plaza = new THREE.Mesh(new THREE.CircleGeometry(PLAZA.r, 40).rotateX(-Math.PI / 2), new M({ color: 0xd8bf94, roughness: 1 }));
      plaza.position.set(PLAZA.x, 0.56, PLAZA.z); plaza.receiveShadow = true; scene.add(plaza);
      const stone = new M({ color: 0xb9a888, roughness: 0.9 }), plaster = new M({ color: 0xeadfc8, roughness: 0.92 }), terracotta = new M({ color: 0x9a4f36, roughness: 0.9 });
      const put = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = opts.shadows && hq; m.receiveShadow = true; scene.add(m); return m; };
      put(new THREE.CylinderGeometry(3.4, 3.6, 0.8, 20), stone, PLAZA.x, 0.95, PLAZA.z + 9);
      const wp = put(new THREE.CylinderGeometry(2.9, 2.9, 0.1, 20), new THREE.MeshBasicMaterial({ color: 0x4fb7c8 }), PLAZA.x, 1.38, PLAZA.z + 9);
      put(new THREE.CylinderGeometry(0.35, 0.5, 2.2, 10), stone, PLAZA.x, 1.9, PLAZA.z + 9);
      const cx = PLAZA.x, cz = PLAZA.z - 13;
      put(new THREE.BoxGeometry(11, 9, 17), plaster, cx, 5, cz);
      put(new THREE.BoxGeometry(5.4, 21, 5.4), plaster, cx, 11, cz + 9.5);
      put(new THREE.BoxGeometry(6, 1, 6), stone, cx, 21.8, cz + 9.5);
      const roofCone = put(new THREE.ConeGeometry(4.4, 5.5, 4), terracotta, cx, 25, cz + 9.5); roofCone.rotation.y = Math.PI / 4;
      put(new THREE.BoxGeometry(11.6, 1, 17.6), terracotta, cx, 9.7, cz);
      const clockFace = new THREE.Mesh(new THREE.CircleGeometry(1.6, 24), new THREE.MeshBasicMaterial({ color: 0xfff1c8 })); clockFace.position.set(cx, 18, cz + 12.25); scene.add(clockFace);
      glow(0xffe2a0, 7, cx, 18, cz + 12.6, scene);
      for (const [x, z] of [[118, 72], [122, 70]]) { const leg = put(new THREE.CylinderGeometry(0.2, 0.2, 9, 6), stone, x, 5, z); leg.rotation.z = (x > 120 ? -1 : 1) * 0.08; }
      put(new THREE.CylinderGeometry(3.2, 3.2, 4.2, 14), new M({ color: 0xb7bcc0, roughness: 0.55, metalness: 0.4 }), 120, 11.2, 71);
      for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU, leg = put(new THREE.CylinderGeometry(0.08, 0.24, 36, 5), new M({ color: 0x9aa0a6, roughness: 0.6, metalness: 0.5 }), 225 + Math.cos(a) * 1.4, 18.5, -75 + Math.sin(a) * 1.4); leg.rotation.set(Math.sin(a) * 0.04, 0, -Math.cos(a) * 0.04); }
      const beacon = glow(0xff2a2a, 5, 225, 37, -75, scene);

      // farolas a lo largo de las calles del pueblo
      const poleG = new THREE.CylinderGeometry(0.08, 0.1, 5.4, 6);
      const lamps = [];
      for (let s = 0; s < L; s += 13) {
        const p = curve.getPointAt(s / L); if (p.x < TOWN_X - 6) continue;
        const tg = curve.getTangentAt(s / L), side = (Math.floor(s / 13) % 2) ? 1 : -1, rg = new V3().crossVectors(UP, tg).normalize();
        lamps.push([p.x + rg.x * 6 * side, p.z + rg.z * 6 * side]);
      }
      const poles = inst(poleG, new M({ color: 0x2a2d31, roughness: 0.7, metalness: 0.5 }), Math.max(1, lamps.length));
      lamps.forEach(([x, z], i) => { dummy.position.set(x, 0.5 + 2.7, z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); poles.setMatrixAt(i, dummy.matrix); glow(0xffd08a, 3.4, x, 0.5 + 5.5, z, scene); });
      poles.count = lamps.length; scene.add(poles);
      state.beacon = beacon; state.fountain = wp;
    }

    /* ----------------------------------- Partículas ----------------------------------- */
    const dust = makeDust(hq ? 420 : 200);
    const splash = makeParticles(hq ? 500 : 260, { color: [0.86, 0.94, 1.0], size: [1.6, 0.8], alpha: 0.8, life: [0.7, 1.3], damp: 0.4, rise: 0, gravity: -9, power: 1.0 });
    const foam = makeParticles(hq ? 360 : 180, { color: [0.95, 0.98, 1.0], size: [3.0, 6.5], alpha: 0.38, life: [2.0, 3.6], damp: 0.6, rise: 0, gravity: 0, power: 1.3 });
    const systems = [dust, splash, foam];
    systems.forEach(s => scene.add(s.pts));

    /* ------------------------- Convoy: avance por el camino con velocidad variable ------------------------- */
    const SPEED = 13.5;
    const profile = s => {
      const p = curve.getPointAt((((s % L) + L) % L) / L), ad = Math.abs(p.x - xc(p.z));
      const fr = 1 - 0.45 * (1 - smooth(RIVER_HW, RIVER_HW + 16, ad));       // despacio al cruzar el río
      const ft = 1 - 0.32 * smooth(52, 90, p.x);                            // y dentro del pueblo
      return SPEED * fr * ft;
    };
    const DT = 0.2, table = [0];
    { let s = 0; while (s < L && table.length < 40000) { s += profile(s) * DT; table.push(s); } const k = L / table[table.length - 1]; for (let i = 0; i < table.length; i++) table[i] *= k; }
    const LAP = (table.length - 1) * DT;
    const sAt = t => { const lap = Math.floor(t / LAP), r = t - lap * LAP, f = r / DT, i = Math.min(table.length - 2, Math.floor(f)); return lap * L + lerp(table[i], table[i + 1], f - i); };

    const paints = [0xb39a6c, 0x55623e, 0xb39a6c], lateral = [0, 2.3, -2.3], gaps = [0, 21, 42];
    const trucks = paints.map((p, i) => {
      const obj = buildTruck(p); scene.add(obj);
      const ret = new THREE.Group(), ringMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
      ret.add(new THREE.Mesh(new THREE.RingGeometry(2.7, 2.84, 64).rotateX(-Math.PI / 2), ringMat));
      const tickG = boxG(0.55, 0.03, 0.14);
      for (let k = 0; k < 4; k++) { const t = new THREE.Mesh(tickG, ringMat); const a = (k / 4) * TAU; t.position.set(Math.cos(a) * 3.1, 0, Math.sin(a) * 3.1); t.rotation.y = -a; ret.add(t); }
      scene.add(ret);
      const label = labelSprite('UNIT-0' + (i + 1), 'TRACKING  LOCK'); scene.add(label);
      return { obj, ret, label, pos: new V3(), tangent: new V3(0, 0, 1), yaw: 0, gap: gaps[i], lat: lateral[i], roof: new V3(), accD: 0, accS: 0, accF: 0, wet: false };
    });

    const beamGeo = new THREE.ConeGeometry(2.2, 1, 28, 1, true); beamGeo.translate(0, -0.5, 0); beamGeo.rotateX(-Math.PI / 2);
    const drones = [
      { target: 0, R: 11, h: 9, ph: 0, orb: 0.22 }, { target: 1, R: 12, h: 10.5, ph: 2.1, orb: -0.18 },
      { target: 2, R: 10, h: 8.5, ph: 4.2, orb: 0.26 }, { target: 0, over: true, R: 34, h: 30, ph: 1, orb: 0.07 }
    ].map(cfg => {
      const obj = buildDrone(); scene.add(obj);
      const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      scene.add(beam);
      return Object.assign(cfg, { obj, beam, pos: new V3(), vel: new V3(), acc: new V3(), inited: false });
    });

    /* ------------------------------------- Cámara ------------------------------------- */
    const SHOTS = { desert: ['wide', 'side', 'frontLow'], river: ['bankLow', 'aerialFord', 'side'], town: ['street', 'rooftop', 'aerialTown'] };
    const SHOT_LEN = 9, BLEND = 1.8;
    const camPos = new V3(), camLook = new V3(), fromPos = new V3(), fromLook = new V3(), tmpA = new V3(), tmpB = new V3(), rgt = new V3(), fwd = new V3(), conv = new V3(), poseP = new V3(), poseL = new V3(), look = new V3(), dpos = new V3();
    let curShot = '', blendT = 99, T = 0, sLead = 0;
    const zoneOf = (x, z) => (Math.abs(x - xc(z)) < RIVER_HW + 26 ? 'river' : (x > 58 ? 'town' : 'desert'));

    function pose(name, outP, outL) {
      const lead = trucks[0], tg = lead.tangent;
      rgt.crossVectors(UP, tg).normalize();
      switch (name) {
        case 'wide': { const a = T * 0.1 + 0.8; outP.set(conv.x + Math.cos(a) * 52, 16 + 3 * Math.sin(T * 0.4), conv.z + Math.sin(a) * 52); outL.set(conv.x, conv.y + 2.5, conv.z); break; }
        case 'side': outP.copy(lead.pos).addScaledVector(rgt, 21).addScaledVector(tg, -6).y += 4.2; outL.copy(lead.pos).addScaledVector(tg, 1).y += 1.4; break;
        case 'frontLow': outP.copy(lead.pos).addScaledVector(tg, 25).addScaledVector(rgt, 5).y += 1.6; outL.copy(lead.pos).addScaledVector(tg, -2).y += 2; break;
        case 'bankLow': outP.copy(lead.pos).addScaledVector(rgt, 19).addScaledVector(tg, -9).y += 1.4; outL.copy(lead.pos).addScaledVector(tg, 2).y += 1.2; break;
        case 'aerialFord': outP.copy(lead.pos).addScaledVector(rgt, 18).addScaledVector(tg, -20).y += 30; outL.copy(lead.pos).addScaledVector(tg, 3); break;
        case 'street': outP.copy(lead.pos).addScaledVector(tg, 22).y += 3.4; outL.copy(lead.pos).addScaledVector(tg, -1).y += 2.4; break;
        case 'rooftop': outP.copy(lead.pos).addScaledVector(tg, -22).addScaledVector(rgt, -8).y += 14; outL.copy(lead.pos).addScaledVector(tg, 10).y += 1; break;
        default: outP.copy(lead.pos).addScaledVector(tg, -26).addScaledVector(rgt, 12).y += 40; outL.copy(lead.pos).addScaledVector(tg, 10);   // aerialTown
      }
    }

    /* ----------------------------------- Simulación ----------------------------------- */
    const wp = new V3();
    function updateTrucks(dt) {
      sLead = sAt(T); const vNow = profile(sLead);
      conv.set(0, 0, 0);
      trucks.forEach((tr, i) => {
        const u = ((((sLead - tr.gap) % L) + L) % L) / L;
        const p = curve.getPointAt(u), tg = curve.getTangentAt(u).setY(0).normalize();
        rgt.crossVectors(UP, tg).normalize();
        const x = p.x + rgt.x * tr.lat, z = p.z + rgt.z * tr.lat;
        const hf = H(x + tg.x * 1.6, z + tg.z * 1.6), hb = H(x - tg.x * 1.6, z - tg.z * 1.6), o = tr.obj;
        const inRiver = Math.abs(x - xc(z)) < RIVER_HW * 1.1 && (hf + hb) / 2 < WATER_Y + 0.4;
        const bob = (inRiver ? 0.09 : 0.04) * Math.sin(T * (inRiver ? 5.5 : 9) + i * 2);
        o.position.set(x, (hf + hb) / 2 + bob, z);
        tr.yaw = Math.atan2(tg.x, tg.z);
        o.rotation.set(-Math.atan((hf - hb) / 3.2), tr.yaw, Math.sin(T * 1.7 + i) * (inRiver ? 0.03 : 0.012), 'YXZ');
        tr.tangent.copy(tg); tr.pos.copy(o.position); tr.roof.set(x, o.position.y + 2.0, z);
        const ud = o.userData;
        ud.wheels.forEach(w => { w.rotation.x += (vNow * dt) / 0.46; });
        const blink = (Math.sin(T * 14 + i) > 0) ? 1 : 0.15;
        ud.barMat.emissiveIntensity = 0.4 + 1.8 * blink; ud.lbGlow.material.opacity = 0.2 + 0.8 * blink;
        ud.ants.forEach((a, k) => { a.rotation.x = -0.28 + Math.sin(T * 3 + k + i) * 0.06; a.rotation.z = Math.sin(T * 2.2 + k) * 0.05; });
        tr.ret.position.set(x, o.position.y + 0.06, z); tr.ret.rotation.y = T * 0.9; tr.ret.scale.setScalar(1 + 0.05 * Math.sin(T * 3 + i));
        tr.label.position.set(x, o.position.y + 4.2, z);
        const lk = clamp(camera.position.distanceTo(o.position) / 48, 0.4, 1.4); tr.label.scale.set(6.4 * lk, 1.92 * lk, 1);
        conv.add(o.position);

        // polvo en tierra firme; salpicaduras y espuma cuando las ruedas van dentro del agua
        const wet = ud.wheels.map(w => { w.getWorldPosition(wp); return [wp.x, wp.z, H(wp.x, wp.z) < WATER_Y + 0.12 && Math.abs(wp.x - xc(wp.z)) < RIVER_HW * 1.25]; });
        tr.accD += dt * 26; tr.accS += dt * 48; tr.accF += dt * 11;
        while (tr.accD >= 1) { tr.accD -= 1; for (let k = 2; k < 4; k++) if (!wet[k][2]) { const w = wet[k]; dust.emit(w[0] + rnd(-0.2, 0.2), o.position.y + 0.25, w[1] + rnd(-0.2, 0.2), -tg.x * rnd(0.6, 2.2) + rnd(-0.8, 0.8), rnd(0.4, 1.4), -tg.z * rnd(0.6, 2.2) + rnd(-0.8, 0.8)); } }
        while (tr.accS >= 1) { tr.accS -= 1; for (const w of wet) if (w[2]) splash.emit(w[0] + rnd(-0.3, 0.3), WATER_Y + 0.1, w[1] + rnd(-0.3, 0.3), tg.x * vNow * 0.35 + rnd(-1.8, 1.8), rnd(2.2, 5.6), tg.z * vNow * 0.35 + rnd(-1.8, 1.8)); }
        while (tr.accF >= 1) { tr.accF -= 1; for (const w of wet) if (w[2]) foam.emit(w[0] + rnd(-0.5, 0.5), WATER_Y + 0.05, w[1] + rnd(-0.5, 0.5), rnd(-0.4, 0.4), 0.02, 1.2 + rnd(0, 0.8)); }
      });
      conv.multiplyScalar(1 / trucks.length);
      trucks.forEach(t => t.obj.updateMatrixWorld(true));
    }

    function updateDrones(dt, snap) {
      const lead = trucks[0], townK = smooth(52, 90, lead.pos.x);
      drones.forEach((d, i) => {
        const tr = trucks[d.target], lift = 7 * smooth(52, 90, tr.pos.x);       // sobre las azoteas dentro del pueblo
        if (d.over) { const a = d.ph + T * d.orb; dpos.set(conv.x + Math.cos(a) * d.R, d.h + 2 * Math.sin(T * 0.5) + 6 * townK, conv.z + Math.sin(a) * d.R); }
        else { const a = tr.yaw + Math.PI + Math.sin(T * 0.23 + d.ph) * 1.15 + d.orb * 0.3 * Math.sin(T * 0.4); dpos.set(tr.pos.x + Math.sin(a) * d.R, tr.pos.y + d.h + lift + 1.2 * Math.sin(T * 0.9 + d.ph), tr.pos.z + Math.cos(a) * d.R); }
        if (!d.inited || snap) { d.pos.copy(dpos); d.vel.set(0, 0, 0); d.acc.set(0, 0, 0); d.inited = true; }
        else { d.acc.copy(dpos).sub(d.pos).multiplyScalar(3.4).addScaledVector(d.vel, -2.7); d.vel.addScaledVector(d.acc, dt); if (d.vel.length() > 32) d.vel.setLength(32); d.pos.addScaledVector(d.vel, dt); }
        const o = d.obj; o.position.copy(d.pos);
        look.copy(tr.roof).sub(d.pos);
        const yaw = Math.atan2(look.x, look.z); fwd.set(Math.sin(yaw), 0, Math.cos(yaw)); rgt.crossVectors(UP, fwd);
        o.rotation.set(clamp(d.acc.dot(fwd) * 0.035, -0.4, 0.4), yaw, clamp(-d.acc.dot(rgt) * 0.035, -0.4, 0.4), 'YXZ');
        const ud = o.userData;
        ud.rotors.forEach((r, k) => { r.rotation.y += dt * (k % 2 ? 70 : -70); });
        ud.leds.forEach((l, k) => { l.material.opacity = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(T * 7 + k * 1.6 + i)); });
        o.updateMatrixWorld(true); ud.gimbal.lookAt(tr.roof); ud.gimbal.updateMatrixWorld(true);
        tmpA.set(0, 0, 0); ud.gimbal.getWorldPosition(tmpA);
        d.beam.position.copy(tmpA); d.beam.lookAt(tr.roof); d.beam.scale.set(1, 1, tmpA.distanceTo(tr.roof));
        d.beam.material.opacity = 0.07 + 0.05 * Math.sin(T * 5 + i);
      });
    }

    function updateCamera(dt, snap) {
      const lead = trucks[0], zone = zoneOf(lead.pos.x, lead.pos.z);
      state.zone = zone;
      const list = SHOTS[zone], name = list[Math.floor(T / SHOT_LEN) % list.length];
      pose(name, poseP, poseL);
      if (name !== curShot) { fromPos.copy(camPos); fromLook.copy(camLook); curShot = name; blendT = snap ? 99 : 0; if (snap) { camPos.copy(poseP); camLook.copy(poseL); fromPos.copy(poseP); fromLook.copy(poseL); } }
      blendT += dt; state.shot = name;
      const f = smooth(0, BLEND, blendT);
      camPos.lerpVectors(fromPos, poseP, f); camLook.lerpVectors(fromLook, poseL, f);
      camPos.y = Math.max(camPos.y, H(camPos.x, camPos.z) + 1.2, WATER_Y + 1.8);   // nunca a ras del agua
      camera.position.copy(camPos); camera.lookAt(camLook);
      sky.position.copy(camera.position);
      sun.target.position.copy(conv); sun.position.copy(conv).addScaledVector(sunDir, 220);
    }

    function update(dt, snap) {
      T += dt;
      updateTrucks(dt); updateDrones(dt, snap); systems.forEach(s => s.update(dt)); updateCamera(dt, snap);
      water.material.uniforms.uTime.value = T;
      if (state.beacon) state.beacon.material.opacity = 0.25 + 0.75 * (Math.sin(T * 3) > 0 ? 1 : 0.1);
    }

    /* -------------------------------- Tamaño / bucle / calidad -------------------------------- */
    function resize() {
      const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, state.pixelRatioCap));
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.fov = w / h < 0.8 ? 66 : 52; camera.updateProjectionMatrix();
      // el encuadre sube para que el convoy quede en la franja superior del dashboard (visible entre los paneles)
      if (opts.shiftY && w / h > 1.2) camera.setViewOffset(w, h, 0, opts.shiftY * h, w, h); else camera.clearViewOffset();
      const k = (h * renderer.getPixelRatio()) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
      systems.forEach(s => { s.mat.uniforms.uScale.value = k * 0.4; });
    }
    window.addEventListener('resize', resize); resize();

    let raf = 0, last = 0, lastRender = 0, ema = 16, slow = 0;
    const minStep = opts.fps ? 1000 / opts.fps - 2 : 0;
    function loop(now) {
      raf = requestAnimationFrame(loop);
      if (opts.pause && opts.pause()) { last = 0; return; }              // p. ej. con una ventana modal abierta
      if (minStep && now - lastRender < minStep) return;
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now; lastRender = now;
      update(dt, false); renderer.render(scene, camera);
      ema = lerp(ema, dt * 1000, 0.05); state.fps = Math.round(1000 / Math.max(ema, 1));
      if (ema > (opts.fps ? 1000 / opts.fps + 22 : 38)) { if (++slow > 120) { slow = 0; if (state.pixelRatioCap > 1) { state.pixelRatioCap = 1; resize(); } else if (sun.castShadow) { sun.castShadow = false; renderer.shadowMap.enabled = false; } } } else slow = 0;
    }
    const onVis = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else if (!reduceMotion && !raf) { last = 0; raf = requestAnimationFrame(loop); } };
    document.addEventListener('visibilitychange', onVis);
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); cancelAnimationFrame(raf); raf = 0; });

    const api = {
      seek(sec) { T = Math.max(0, sec - 0.05); curShot = ''; update(0.05, true); update(0.0001, false); renderer.render(scene, camera); },
      info() { return { T, zone: state.zone, shot: state.shot, leadX: Math.round(trucks[0].pos.x), leadZ: Math.round(trucks[0].pos.z), lap: LAP }; },
      stats() { return { fps: state.fps, quality: opts.quality, shot: state.shot, zone: state.zone, pixelRatio: renderer.getPixelRatio(), shadows: sun.castShadow }; },
      dispose() {
        cancelAnimationFrame(raf); raf = 0; window.removeEventListener('resize', resize); document.removeEventListener('visibilitychange', onVis);
        scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map) m.map.dispose(); if (m.emissiveMap) m.emissiveMap.dispose(); m.dispose(); }); });
        renderer.dispose();
      }
    };
    if (reduceMotion) api.seek(30); else { T = 2; update(0.05, true); raf = requestAnimationFrame(loop); }
    return api;
  }

  window.CMJourneyScene = { start };
  if (window.CMScenes) window.CMScenes.register({ id: 'journey', label: 'Desierto, río y pueblo', desc: 'Convoy táctico y drones cruzando el vado hacia el pueblo', icon: 'ti-road', start });
})();
