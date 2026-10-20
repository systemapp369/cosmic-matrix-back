/**
 * desert-scene.js — Escena 3D de fondo para la pantalla de acceso.
 * Desierto al atardecer: un convoy de camionetas tácticas recorre un camino entre dunas
 * mientras drones las siguen y rastrean (haz de escaneo + retícula de seguimiento).
 * Todo es procedural (sin imágenes ni modelos externos) y usa el Three.js local de /vendor.
 *
 * API:  const scene = CMDesertScene.start(canvas)
 *       scene.seek(segundos)  -> salta a un instante y dibuja un cuadro (pruebas / movimiento reducido)
 *       scene.stats()         -> { fps, quality, shot, ... }
 *       scene.hud()           -> datos para el HUD (velocidad, altitud, plano de cámara)
 *       scene.dispose()
 */
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const rnd = (a, b) => a + Math.random() * (b - a);

  function start(canvas) {
    const THREE = window.THREE;
    if (!THREE) throw new Error('Three.js no está disponible');

    const mobile = window.matchMedia('(max-width:760px)').matches || /Android|iPhone|iPad|Mobi/i.test(navigator.userAgent);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const state = { hq: !mobile, pixelRatioCap: mobile ? 1.25 : 1.75, shot: 0, fps: 0 };

    /* ------------------------------ Renderer / escena ------------------------------ */
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, state.pixelRatioCap));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = state.hq;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(new THREE.Color('#e0a06b'), 70, 560);

    const camera = new THREE.PerspectiveCamera(52, 1, 0.3, 2400);
    const V3 = THREE.Vector3;
    const UP = new V3(0, 1, 0);
    const kit = window.CMSceneKit.create(THREE, { hq: state.hq });
    const { boxG, glow, labelSprite, buildTruck, buildDrone, makeDust } = kit;

    /* ---------------------------------- Cielo ---------------------------------- */
    const sunDir = new V3(-0.62, 0.2, -0.76).normalize();
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(1500, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, fog: false,
        uniforms: {
          uSun: { value: sunDir },
          uTop: { value: new THREE.Color('#0a1d3b') },
          uMid: { value: new THREE.Color('#6a527e') },
          uHor: { value: new THREE.Color('#f7ab66') }
        },
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

    /* ----------------------------------- Luces ----------------------------------- */
    scene.add(new THREE.HemisphereLight(0x86a3d0, 0xc98e58, 1.35));
    const sun = new THREE.DirectionalLight(0xffcf9c, 4.0);
    sun.castShadow = state.hq;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera; sc.left = -50; sc.right = 50; sc.top = 50; sc.bottom = -50; sc.near = 10; sc.far = 420;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.06;
    scene.add(sun, sun.target);

    /* ------------------------------ Camino y terreno ------------------------------ */
    const pathPts = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU, r = 78 + 22 * Math.sin(i * 1.9 + 0.6);
      pathPts.push(new V3(Math.cos(a) * r * 1.25, 0, Math.sin(a) * r));
    }
    const curve = new THREE.CatmullRomCurve3(pathPts, true, 'centripetal');
    const PATH_LEN = curve.getLength();
    const samples = [];
    for (let i = 0; i < 200; i++) samples.push(curve.getPointAt(i / 200));

    const distPath = (x, z) => {
      let m = 1e9;
      for (let i = 0; i < samples.length; i++) { const dx = x - samples[i].x, dz = z - samples[i].z, d = dx * dx + dz * dz; if (d < m) m = d; }
      return Math.sqrt(m);
    };
    const bigH = (x, z) => 5.2 * Math.sin(x * 0.011 + 0.7) * Math.cos(z * 0.013 - 0.4) + 3.1 * Math.sin(x * 0.021 + z * 0.017 + 1.9)
      + 1.7 * Math.cos(x * 0.036 - z * 0.029) + 1.8 * (1 - Math.abs(Math.sin(x * 0.03 + z * 0.012 + 0.5)));
    const detH = (x, z) => 0.55 * Math.sin(x * 0.11 + z * 0.07) + 0.35 * Math.sin(x * 0.19 - z * 0.23 + 1.1) + 0.12 * Math.sin(x * 0.6 + z * 0.5);
    const H = (x, z) => { const flat = smooth(3, 16, distPath(x, z)); return bigH(x, z) * (0.2 + 0.8 * flat) + detH(x, z) * flat; };

    const SIZE = 760, SEG = state.hq ? 170 : 100;
    const tGeo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    tGeo.rotateX(-Math.PI / 2);
    {
      const pos = tGeo.attributes.position, col = new Float32Array(pos.count * 3);
      const lo = new THREE.Color('#c0904f'), hi = new THREE.Color('#f3d29b'), track = new THREE.Color('#946b3c'), c = new THREE.Color();
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i), y = H(x, z);
        pos.setY(i, y);
        const n = 0.5 + 0.5 * Math.sin(x * 0.23 + z * 0.17) * Math.cos(z * 0.31 - x * 0.05);
        c.copy(lo).lerp(hi, clamp((y + 6) / 14 + (n - 0.5) * 0.18, 0, 1));
        const d = distPath(x, z);
        if (d < 2.8) c.lerp(track, (1 - smooth(1.2, 2.8, d)) * 0.75);
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      }
      tGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      tGeo.computeVertexNormals();
    }
    const terrain = new THREE.Mesh(tGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }));
    terrain.receiveShadow = true;
    scene.add(terrain);

    const farGround = new THREE.Mesh(new THREE.CircleGeometry(1700, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#d09660' }));
    farGround.position.y = -9;
    scene.add(farGround);

    /* ---------------------- Decorado: rocas, cactus, arbustos, mesas ---------------------- */
    const randomSpot = (minD, maxR) => {
      for (let k = 0; k < 40; k++) {
        const a = Math.random() * TAU, r = rnd(14, maxR), x = Math.cos(a) * r, z = Math.sin(a) * r;
        if (Math.abs(x) < SIZE / 2 - 4 && Math.abs(z) < SIZE / 2 - 4 && distPath(x, z) > minD) return [x, z];
      }
      return [250, 250];
    };
    {
      const n = state.hq ? 110 : 60, im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x9a7452, roughness: 0.95, flatShading: true }), n);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new V3(), p = new V3();
      for (let i = 0; i < n; i++) {
        const [x, z] = randomSpot(9, 330), k = rnd(0.5, 2.8);
        e.set(rnd(0, 3), rnd(0, 3), rnd(0, 3)); q.setFromEuler(e);
        s.set(k * rnd(0.8, 1.6), k * rnd(0.5, 1), k * rnd(0.8, 1.4));
        p.set(x, H(x, z) + s.y * 0.25, z);
        m.compose(p, q, s); im.setMatrixAt(i, m);
      }
      im.castShadow = state.hq; im.receiveShadow = true; scene.add(im);

      const nb = state.hq ? 90 : 40, bush = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x9a8f4f, roughness: 1, flatShading: true }), nb);
      for (let i = 0; i < nb; i++) {
        const [x, z] = randomSpot(6, 300), k = rnd(0.4, 1.1);
        e.set(0, rnd(0, 3), 0); q.setFromEuler(e); s.set(k * 1.3, k * 0.6, k * 1.3); p.set(x, H(x, z) + 0.2, z);
        m.compose(p, q, s); bush.setMatrixAt(i, m);
      }
      bush.receiveShadow = true; scene.add(bush);
    }
    {
      const cm = new THREE.MeshStandardMaterial({ color: 0x5b8a54, roughness: 0.9 });
      const trunk = new THREE.CylinderGeometry(0.28, 0.32, 3.4, 8), arm = new THREE.CylinderGeometry(0.17, 0.19, 1.3, 8), elbow = new THREE.CylinderGeometry(0.17, 0.17, 0.7, 8);
      const cap = new THREE.SphereGeometry(0.28, 8, 6), capA = new THREE.SphereGeometry(0.17, 8, 6);
      const nC = state.hq ? 22 : 10;
      for (let i = 0; i < nC; i++) {
        const [x, z] = randomSpot(10, 280), g = new THREE.Group(), k = rnd(0.8, 1.5);
        const add = (geo, px, py, pz, rx, rz) => { const mm = new THREE.Mesh(geo, cm); mm.position.set(px, py, pz); mm.rotation.set(rx || 0, 0, rz || 0); mm.castShadow = state.hq; g.add(mm); };
        add(trunk, 0, 1.7, 0); add(cap, 0, 3.4, 0);
        add(elbow, 0.5, 1.7, 0, 0, Math.PI / 2); add(arm, 0.82, 2.25, 0); add(capA, 0.82, 2.9, 0);
        if (i % 2) { add(elbow, -0.5, 1.4, 0, 0, Math.PI / 2); add(arm, -0.82, 1.95, 0); add(capA, -0.82, 2.6, 0); }
        g.scale.setScalar(k); g.rotation.y = rnd(0, TAU); g.position.set(x, H(x, z), z);
        scene.add(g);
      }
    }
    {
      const mesaMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
      const bands = [new THREE.Color('#b0653f'), new THREE.Color('#cb8250'), new THREE.Color('#945439'), new THREE.Color('#bf7248')];
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU + rnd(-0.2, 0.2), r = rnd(400, 560), w = rnd(26, 60), h = rnd(30, 70);
        const geo = new THREE.CylinderGeometry(w * 0.72, w, h, 10, 5);
        const p = geo.attributes.position, cols = new Float32Array(p.count * 3), c = new THREE.Color();
        for (let k = 0; k < p.count; k++) {
          const yy = p.getY(k) / h + 0.5;
          if (yy > 0.02 && yy < 0.98) { p.setX(k, p.getX(k) * (1 + 0.12 * Math.sin(k * 12.9))); p.setZ(k, p.getZ(k) * (1 + 0.12 * Math.cos(k * 7.3))); }
          c.copy(bands[Math.floor(clamp(yy, 0, 0.999) * 7) % bands.length]); cols[k * 3] = c.r; cols[k * 3 + 1] = c.g; cols[k * 3 + 2] = c.b;
        }
        geo.setAttribute('color', new THREE.BufferAttribute(cols, 3)); geo.computeVertexNormals();
        const mesa = new THREE.Mesh(geo, mesaMat);
        mesa.position.set(Math.cos(a) * r, h / 2 - 10, Math.sin(a) * r); mesa.rotation.y = rnd(0, TAU);
        scene.add(mesa);
      }
    }

    const dust = makeDust(state.hq ? 420 : 200);
    scene.add(dust.pts);

    /* ---------------------------- Convoy, drones y retículas ---------------------------- */
    const paints = [0xb39a6c, 0x55623e, 0xb39a6c];
    const lateral = [0, 2.3, -2.3], gaps = [0, 0.036, 0.074];
    const trucks = paints.map((p, i) => {
      const obj = buildTruck(p); scene.add(obj);
      const ret = new THREE.Group();
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
      const ring = new THREE.Mesh(new THREE.RingGeometry(2.7, 2.84, 64).rotateX(-Math.PI / 2), ringMat); ret.add(ring);
      const tickG = boxG(0.55, 0.03, 0.14);
      for (let k = 0; k < 4; k++) { const t = new THREE.Mesh(tickG, ringMat); const a = (k / 4) * TAU; t.position.set(Math.cos(a) * 3.1, 0, Math.sin(a) * 3.1); t.rotation.y = -a; ret.add(t); }
      scene.add(ret);
      const label = labelSprite('UNIT-0' + (i + 1), 'TRACKING  LOCK'); scene.add(label);
      return { obj, ret, label, u: 0, pos: new V3(), tangent: new V3(0, 0, 1), yaw: 0, speed: 12.5, lat: lateral[i], gap: gaps[i], roof: new V3(), acc: 0 };
    });

    const beamGeo = new THREE.ConeGeometry(2.2, 1, 28, 1, true); beamGeo.translate(0, -0.5, 0); beamGeo.rotateX(-Math.PI / 2);
    const drones = [
      { target: 0, R: 11, h: 9, ph: 0, orb: 0.22 }, { target: 1, R: 12, h: 10.5, ph: 2.1, orb: -0.18 },
      { target: 2, R: 10, h: 8.5, ph: 4.2, orb: 0.26 }, { target: 0, over: true, R: 34, h: 28, ph: 1, orb: 0.07 }
    ].map(cfg => {
      const obj = buildDrone(); scene.add(obj);
      const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      scene.add(beam);
      return Object.assign(cfg, { obj, beam, pos: new V3(), vel: new V3(), acc: new V3(), inited: false });
    });

    /* ------------------------------------ Cámara ------------------------------------ */
    const SHOT_LEN = 11, BLEND = 2.2;
    const camPos = new V3(), camLook = new V3(), tmpA = new V3(), tmpB = new V3(), right = new V3(), conv = new V3();
    const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
    let viewShift = 0, sizeW = 1, sizeH = 1;
    function shotPose(i, t, outPos, outLook) {
      const lead = trucks[0], tg = lead.tangent;
      right.crossVectors(UP, tg).normalize();
      switch (i % 4) {
        case 0: { const a = t * 0.1 + 0.8; outPos.set(conv.x + Math.cos(a) * 50, 15 + 3 * Math.sin(t * 0.4), conv.z + Math.sin(a) * 50); outLook.set(conv.x, conv.y + 2.5, conv.z); break; }
        case 1: outPos.copy(lead.pos).addScaledVector(right, 21).addScaledVector(tg, -6).y += 4.2; outLook.copy(lead.pos).addScaledVector(tg, 1).y += 1.4; break;
        case 2: outPos.copy(lead.pos).addScaledVector(tg, 25).addScaledVector(right, 5).y += 1.6; outLook.copy(lead.pos).addScaledVector(tg, -2).y += 2; break;
        default: outPos.copy(conv).addScaledVector(tg, -30).addScaledVector(right, 16).y += 33; outLook.copy(conv).addScaledVector(tg, 8);
      }
    }

    /* ------------------------------------- Simulación ------------------------------------- */
    let T = 0;
    const fwd = new V3(), rgt = new V3();
    function updateTrucks(dt) {
      conv.set(0, 0, 0);
      trucks.forEach((tr, i) => {
        tr.u = ((T * tr.speed) / PATH_LEN - tr.gap + 10) % 1;
        const p = curve.getPointAt(tr.u), tg = curve.getTangentAt(tr.u).setY(0).normalize();
        rgt.crossVectors(UP, tg).normalize();
        const x = p.x + rgt.x * tr.lat, z = p.z + rgt.z * tr.lat;
        const hf = H(x + tg.x * 1.6, z + tg.z * 1.6), hb = H(x - tg.x * 1.6, z - tg.z * 1.6);
        const o = tr.obj;
        o.position.set(x, (hf + hb) / 2 + 0.04 * Math.sin(T * 9 + i * 2), z);
        tr.yaw = Math.atan2(tg.x, tg.z);
        o.rotation.set(-Math.atan((hf - hb) / 3.2), tr.yaw, Math.sin(T * 1.7 + i) * 0.012, 'YXZ');
        tr.tangent.copy(tg); tr.pos.copy(o.position);
        tr.roof.set(x, o.position.y + 2.0, z);
        const ud = o.userData;
        ud.wheels.forEach(w => { w.rotation.x += (tr.speed * dt) / 0.46; });
        const blink = (Math.sin(T * 14 + i) > 0) ? 1 : 0.15;
        ud.barMat.emissiveIntensity = 0.4 + 1.8 * blink; ud.lbGlow.material.opacity = 0.2 + 0.8 * blink;
        ud.ants.forEach((a, k) => { a.rotation.x = -0.28 + Math.sin(T * 3 + k + i) * 0.06; a.rotation.z = Math.sin(T * 2.2 + k) * 0.05; });
        tr.ret.position.set(x, o.position.y + 0.06, z); tr.ret.rotation.y = T * 0.9;
        tr.ret.scale.setScalar(1 + 0.05 * Math.sin(T * 3 + i));
        tr.label.position.set(x, o.position.y + 4.2, z);
        const lk = clamp(camera.position.distanceTo(o.position) / 48, 0.4, 1.4);   // tamaño en pantalla estable según la distancia
        tr.label.scale.set(6.4 * lk, 1.92 * lk, 1);
        conv.add(o.position);
        // polvo desde las ruedas traseras
        tr.acc += dt * 26;
        while (tr.acc >= 1) {
          tr.acc -= 1;
          for (const sx of [-0.95, 0.95]) {
            tmpA.set(sx, 0.2, -1.5).applyMatrix4(o.matrixWorld);
            dust.emit(tmpA.x + rnd(-0.2, 0.2), tmpA.y, tmpA.z + rnd(-0.2, 0.2), -tg.x * rnd(0.6, 2.2) + rnd(-0.8, 0.8), rnd(0.4, 1.4), -tg.z * rnd(0.6, 2.2) + rnd(-0.8, 0.8));
          }
        }
      });
      conv.multiplyScalar(1 / trucks.length);
      trucks.forEach(t => t.obj.updateMatrixWorld(true));
    }

    const dpos = new V3(), look = new V3();
    function updateDrones(dt, snap) {
      drones.forEach((d, i) => {
        const tr = trucks[d.target];
        if (d.over) {
          const a = d.ph + T * d.orb;
          dpos.set(conv.x + Math.cos(a) * d.R, d.h + 2 * Math.sin(T * 0.5), conv.z + Math.sin(a) * d.R);
        } else {
          const a = tr.yaw + Math.PI + Math.sin(T * 0.23 + d.ph) * 1.15 + d.orb * 0.3 * Math.sin(T * 0.4);
          dpos.set(tr.pos.x + Math.sin(a) * d.R, tr.pos.y + d.h + 1.2 * Math.sin(T * 0.9 + d.ph), tr.pos.z + Math.cos(a) * d.R);
        }
        if (!d.inited || snap) { d.pos.copy(dpos); d.vel.set(0, 0, 0); d.acc.set(0, 0, 0); d.inited = true; }
        else {
          d.acc.copy(dpos).sub(d.pos).multiplyScalar(3.4).addScaledVector(d.vel, -2.7);
          d.vel.addScaledVector(d.acc, dt); if (d.vel.length() > 32) d.vel.setLength(32);
          d.pos.addScaledVector(d.vel, dt);
        }
        const o = d.obj; o.position.copy(d.pos);
        look.copy(tr.roof).sub(d.pos);
        const yaw = Math.atan2(look.x, look.z);
        fwd.set(Math.sin(yaw), 0, Math.cos(yaw)); rgt.crossVectors(UP, fwd);
        const roll = clamp(-d.acc.dot(rgt) * 0.035, -0.4, 0.4), pitch = clamp(d.acc.dot(fwd) * 0.035, -0.4, 0.4);
        o.rotation.set(pitch, yaw, roll, 'YXZ');
        const ud = o.userData;
        ud.rotors.forEach((r, k) => { r.rotation.y += dt * (k % 2 ? 70 : -70); });
        ud.leds.forEach((l, k) => { l.material.opacity = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(T * 7 + k * 1.6 + i)); });
        // haz de escaneo desde el gimbal hasta la camioneta
        o.updateMatrixWorld(true);
        ud.gimbal.lookAt(tr.roof); ud.gimbal.updateMatrixWorld(true);
        tmpA.set(0, 0, 0); ud.gimbal.getWorldPosition(tmpA);
        d.beam.position.copy(tmpA); d.beam.lookAt(tr.roof);
        const dist = tmpA.distanceTo(tr.roof); d.beam.scale.set(1, 1, dist);
        d.beam.material.opacity = 0.07 + 0.05 * Math.sin(T * 5 + i);
      });
    }

    function updateCamera(dt, snap) {
      const idx = Math.floor(T / SHOT_LEN), local = T - idx * SHOT_LEN;
      state.shot = idx % 4;
      shotPose(idx, T, camPos, camLook);
      const f = smooth(0, BLEND, local);
      if (f < 1) { shotPose(idx - 1 + 4000, T, tmpA, tmpB); camPos.lerpVectors(tmpA, camPos, f); camLook.lerpVectors(tmpB, camLook, f); }
      mouse.sx += (mouse.x - mouse.sx) * Math.min(1, dt * 3); mouse.sy += (mouse.y - mouse.sy) * Math.min(1, dt * 3);
      camPos.x += mouse.sx * 1.6; camLook.y += mouse.sy * 1.0; camLook.x += mouse.sx * 2.0;
      camPos.y = Math.max(camPos.y, H(camPos.x, camPos.z) + 1.2);
      camera.position.copy(camPos); camera.lookAt(camLook);
      // En pantallas anchas la acción se desplaza a un lado (alternando) para que no quede tras la tarjeta de acceso.
      const wide = sizeW / sizeH > 1.25;
      const target = wide ? (idx % 2 === 0 ? 0.28 : -0.28) : 0;
      viewShift = snap ? target : viewShift + (target - viewShift) * Math.min(1, dt * 1.1);
      if (Math.abs(viewShift) > 0.001) camera.setViewOffset(sizeW, sizeH, -viewShift * sizeW, 0, sizeW, sizeH); else camera.clearViewOffset();
      sky.position.copy(camera.position);
      sun.target.position.copy(conv); sun.position.copy(conv).addScaledVector(sunDir, 200);
    }

    function update(dt, snap) {
      T += dt;
      updateTrucks(dt); updateDrones(dt, snap); dust.update(dt); updateCamera(dt, snap);
    }

    /* ---------------------------------- Tamaño / bucle ---------------------------------- */
    function resize() {
      const w = window.innerWidth, h = window.innerHeight;
      sizeW = w; sizeH = h;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, state.pixelRatioCap));
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.fov = w / h < 0.8 ? 66 : 52; camera.updateProjectionMatrix();
      dust.mat.uniforms.uScale.value = (h * renderer.getPixelRatio()) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) * 0.4;
    }
    const onMove = e => { mouse.x = (e.clientX / window.innerWidth) * 2 - 1; mouse.y = -((e.clientY / window.innerHeight) * 2 - 1); };
    window.addEventListener('resize', resize); window.addEventListener('pointermove', onMove, { passive: true });
    resize();

    let raf = 0, last = 0, ema = 16, slow = 0;
    const running = !reduceMotion;
    function loop(now) {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now;
      update(dt, false);
      renderer.render(scene, camera);
      ema = lerp(ema, dt * 1000, 0.05); state.fps = Math.round(1000 / Math.max(ema, 1));
      // calidad adaptable: si el equipo no da la talla, se reduce resolución y luego sombras
      if (ema > 38) { if (++slow > 120) { slow = 0; if (state.pixelRatioCap > 1) { state.pixelRatioCap = 1; resize(); } else if (sun.castShadow) { sun.castShadow = false; renderer.shadowMap.enabled = false; } } } else slow = 0;
    }
    const onVis = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else if (running && !raf) { last = 0; raf = requestAnimationFrame(loop); } };
    document.addEventListener('visibilitychange', onVis);
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); cancelAnimationFrame(raf); raf = 0; });

    const api = {
      seek(sec) { T = Math.max(0, sec - 0.05); update(0.05, true); update(0.0001, false); renderer.render(scene, camera); },
      stats() { return { fps: state.fps, quality: state.hq ? 'alta' : 'ligera', shot: state.shot, pixelRatio: renderer.getPixelRatio(), shadows: sun.castShadow }; },
      hud() { const l = trucks[0]; return { unit: 1, speed: Math.round(l.speed * 3.6), alt: Math.round(drones[0].pos.y), shot: state.shot }; },
      dispose() {
        cancelAnimationFrame(raf); window.removeEventListener('resize', resize); window.removeEventListener('pointermove', onMove);
        document.removeEventListener('visibilitychange', onVis);
        scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); });
        renderer.dispose();
      }
    };

    if (reduceMotion) api.seek(14);                 // movimiento reducido: un solo cuadro estático
    else { T = 3; update(0.05, true); raf = requestAnimationFrame(loop); }
    return api;
  }

  window.CMDesertScene = { start };
})();
