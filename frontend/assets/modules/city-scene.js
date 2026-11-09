/**
 * city-scene.js — Escenario 3D: Ciudad vigilada (versión 2).
 * Convoy de camionetas tácticas y drones en ciudad nocturna con iluminación mejorada.
 * Las cámaras CCTV se activan al detectar los vehículos. Un plano de cámara simula
 * el feed de vigilancia con overlay analógico. Todo es procedural, sin archivos externos.
 *
 *   CMCityScene.start(canvas, opts)  → api { seek, info, stats, dispose }
 * Se registra en CMScenes (scene-manager.js).
 */
(function () {
  'use strict';
  const TAU   = Math.PI * 2;
  const clamp = (v,a,b)   => Math.min(b, Math.max(a, v));
  const lerp  = (a,b,t)   => a + (b-a)*t;
  const smooth= (a,b,x)   => { const t=clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); };
  const rnd   = (a,b)     => a + Math.random()*(b-a);
  const rng32 = seed => {
    let s=seed|0;
    return ()=>{ s=((s+0x6D2B79F5)|0);let t=Math.imul(s^(s>>>15),1|s);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296; };
  };
  const up3   = new THREE.Vector3(0,1,0);
  const t3A   = new THREE.Vector3(), t3B = new THREE.Vector3(), t3C = new THREE.Vector3();

  /* ─── ciudad: rejilla ─── */
  const AV_W=12, ST_W=9;
  const AVENUES=[-200,-110,-20,70,160];
  const STREETS =[-130,-70,-10,50,110];

  const isRoad=(x,z)=>{
    for(const a of AVENUES)if(Math.abs(x-a)<AV_W/2+1)return true;
    for(const s of STREETS )if(Math.abs(z-s)<ST_W/2+1)return true;
    return false;
  };
  const roadDist=(x,z)=>{
    let d=1e9;
    for(const a of AVENUES)d=Math.min(d,Math.abs(x-a)-AV_W/2);
    for(const s of STREETS )d=Math.min(d,Math.abs(z-s)-ST_W/2);
    return Math.max(0,d);
  };

  /* Ruta del convoy por las calles */
  const ROUTE_PTS=[
    [-200,-130],[-200,-70],[-200,-10],[-200,50],[-200,110],
    [-110,110],[-20,110],[70,110],[160,110],
    [160,50],[160,-10],[160,-70],[160,-130],
    [70,-130],[-20,-130],[-110,-130],[-200,-130]
  ].map(([x,z])=>new THREE.Vector3(x,0,z));

  /* ════════════════════════════════════════════════════════ */
  function start(canvas, options){
    const THREE=window.THREE, Kit=window.CMSceneKit;
    if(!THREE||!Kit)throw new Error('Three.js o scene-kit no disponibles');
    const opts=Object.assign({fps:30,quality:'high',pixelRatioCap:1.75,pause:null,shiftY:0},options||{});
    const hq=opts.quality==='high', lite=opts.quality==='low';
    const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const kit=Kit.create(THREE,{hq:false});
    const {M,glow,labelSprite,makeParticles,buildTruck,buildDrone}=kit;
    const state={shot:'',fps:0,pixelRatioCap:opts.pixelRatioCap};

    /* ── renderer ── */
    const renderer=new THREE.WebGLRenderer({canvas,antialias:!lite,alpha:false,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,state.pixelRatioCap));
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.65;
    renderer.shadowMap.enabled=hq;
    renderer.shadowMap.type=THREE.PCFSoftShadowMap;

    const scene=new THREE.Scene();
    scene.fog=new THREE.Fog(new THREE.Color('#1a2330'),110,750);
    const camera=new THREE.PerspectiveCamera(52,1,0.3,2000);

    /* ── cielo nocturno con luna ── */
    const sky=new THREE.Mesh(
      new THREE.SphereGeometry(1600,32,16),
      new THREE.ShaderMaterial({
        side:THREE.BackSide,depthWrite:false,fog:false,
        uniforms:{uTop:{value:new THREE.Color('#040b14')},uMid:{value:new THREE.Color('#0c1a30')},uHor:{value:new THREE.Color('#182540')},uMoon:{value:new THREE.Vector3(-0.55,0.6,-0.57).normalize()}},
        vertexShader:'varying vec3 vD;void main(){vD=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
        fragmentShader:`uniform vec3 uTop,uMid,uHor,uMoon;varying vec3 vD;
          void main(){
            float h=clamp(vD.y,0.0,1.0);
            vec3 c=mix(uHor,uMid,smoothstep(0.0,0.28,h));
            c=mix(c,uTop,smoothstep(0.22,0.90,h));
            float m=max(dot(normalize(vD),uMoon),0.0);
            c+=vec3(0.7,0.85,1.0)*pow(m,320.0)*2.5;
            c+=vec3(0.4,0.55,0.8)*pow(m,18.0)*0.12;
            // estrellas
            float st=step(0.995,sin(vD.x*418.2+vD.y*311.9)*sin(vD.z*529.3+vD.y*418.7));
            c+=st*0.7*vec3(0.85,0.9,1.0);
            gl_FragColor=vec4(c,1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`
      })
    );
    scene.add(sky);

    /* ── luces globales ── */
    scene.add(new THREE.HemisphereLight(0x4a7aaa,0x1e2f18,2.2));
    const moonL=new THREE.DirectionalLight(0xc0d8f0,3.2);
    moonL.position.set(-80,240,-120); moonL.castShadow=hq;
    if(hq){moonL.shadow.mapSize.set(2048,2048);const sc=moonL.shadow.camera;sc.left=-80;sc.right=80;sc.top=80;sc.bottom=-80;sc.near=10;sc.far=500;moonL.shadow.bias=-0.0005;}
    scene.add(moonL,moonL.target);
    const flashL=new THREE.PointLight(0xffccaa,0,180,1.6);
    scene.add(flashL);

    /* ── luces de intersección (ambiente de calle) ── */
    const LAMP_H=8.5;
    for(const a of AVENUES)for(const s of STREETS){
      const sl=new THREE.PointLight(0x7090cc,2.4,70,1.6);
      sl.position.set(a,LAMP_H+0.5,s); scene.add(sl);
    }

    /* ════ suelo ════ */
    const GSIZE=720,GSEG=hq?210:(lite?95:140);
    const groundGeo=new THREE.PlaneGeometry(GSIZE,GSIZE,GSEG,GSEG).rotateX(-Math.PI/2);
    {
      const pos=groundGeo.attributes.position,col=new Float32Array(pos.count*3);
      const asphalt=new THREE.Color('#28374a'),sidewalk=new THREE.Color('#3c4e62'),grass=new THREE.Color('#2a3d2a'),c=new THREE.Color();
      for(let i=0;i<pos.count;i++){
        const x=pos.getX(i),z=pos.getZ(i),rd=roadDist(x,z);
        if(rd<0.5)c.copy(asphalt);
        else if(rd<4)c.copy(sidewalk);
        else c.copy(grass).lerp(sidewalk,Math.min(1,(rd-4)/8));
        col[i*3]=c.r;col[i*3+1]=c.g;col[i*3+2]=c.b;
      }
      groundGeo.setAttribute('color',new THREE.BufferAttribute(col,3));
      groundGeo.computeVertexNormals();
    }
    const ground=new THREE.Mesh(groundGeo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.72,metalness:0.08,envMapIntensity:0}));
    ground.receiveShadow=true; scene.add(ground);

    /* líneas de calle */
    {
      const mk=(x,z,v,w,l,col)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(v?w:l,v?l:w).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:col,depthWrite:false}));m.position.set(x,0.04,z);return m;};
      const lg=new THREE.Group(); scene.add(lg);
      for(const a of AVENUES)for(let z=-GSIZE/2;z<GSIZE/2;z+=30)lg.add(mk(a,z,true,0.3,18,'#f0e010'));
      for(const s of STREETS)for(let x=-GSIZE/2;x<GSIZE/2;x+=24)lg.add(mk(x,s,false,0.26,14,'#dde0e8'));
    }

    /* ════ edificios ════ */
    const rg=rng32(12345);
    const mkWinTex=(floors,seed,emit)=>{
      const r2=rng32(seed+(emit?1000:0));
      const W=256,H=Math.min(512,floors*48);
      const c=document.createElement('canvas');c.width=W;c.height=H;
      const g=c.getContext('2d');
      g.fillStyle=emit?'black':'#0a1020'; g.fillRect(0,0,W,H);
      for(let f=0;f<floors;f++)for(let i=0;i<5;i++){
        const wx=10+i*48,wy=H-(f+1)*44+8,on=r2()<0.58;
        if(emit){ if(on){const warm=r2()<0.7;g.fillStyle=warm?'rgba(255,200,80,0.95)':'rgba(80,180,255,0.95)';g.fillRect(wx,wy,34,28);} }
        else g.fillStyle=on?'#1a2540':'#08101e'; g.fillRect(wx,wy,34,28);
      }
      const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
    };
    const tints=['#c8b99a','#d4c4a8','#b8c8d0','#c0ccb8','#ccc0b0','#d0c8be','#bac4cc'].map(h=>new THREE.Color(h));
    const roofTs=['#3a4050','#4a3828','#384840','#2a3250','#3c3a42'].map(h=>new THREE.Color(h));
    const bodyGeo=new THREE.BoxGeometry(1,1,1);
    const dummy=new THREE.Object3D();
    const bldgDefs=[];
    for(let xi=0;xi<AVENUES.length-1;xi++)for(let zi=0;zi<STREETS.length-1;zi++){
      const x0=AVENUES[xi]+AV_W/2+3,x1=AVENUES[xi+1]-AV_W/2-3;
      const z0=STREETS[zi]+ST_W/2+3,z1=STREETS[zi+1]-ST_W/2-3;
      const bw=x1-x0,bd=z1-z0; if(bw<8||bd<8)continue;
      const nX=Math.floor(bw/22),nZ=Math.floor(bd/22);
      for(let bx=0;bx<nX;bx++)for(let bz=0;bz<nZ;bz++){
        const px=x0+bx*(bw/nX)+bw/(nX*2)+rnd(-2,2),pz=z0+bz*(bd/nZ)+bd/(nZ*2)+rnd(-2,2);
        if(isRoad(px,pz))continue;
        const dist=Math.hypot(px-(-20),pz-(-10));
        const floors=dist<80?Math.round(rnd(14,38)):dist<160?Math.round(rnd(4,15)):Math.round(rnd(1,5));
        const w=rnd(12,22),d=rnd(12,22),h=floors*3.4,rot=rnd(-0.06,0.06);
        bldgDefs.push({px,pz,w,d,h,floors,rot,seed:(rg()*9000)|100,tint:tints[(rg()*tints.length)|0],roof:roofTs[(rg()*roofTs.length)|0]});
      }
    }
    [[1,5],[6,14],[15,40]].forEach(([mn,mx])=>{
      const defs=bldgDefs.filter(b=>b.floors>=mn&&b.floors<=mx); if(!defs.length)return;
      const fl=mx, wt=mkWinTex(fl,mn*77,false), et=mkWinTex(fl,mn*77,true);
      const isTall=fl>12;
      const mat=new M({map:wt,emissiveMap:et,emissive:0xffffff,emissiveIntensity:2.6,roughness:0.85,metalness:isTall?0.25:0.06,color:isTall?new THREE.Color('#a4bece'):new THREE.Color('#ffffff')});
      const im=new THREE.InstancedMesh(bodyGeo,mat,defs.length); im.receiveShadow=true; im.castShadow=hq;
      defs.forEach((b,i)=>{dummy.position.set(b.px,b.h/2,b.pz);dummy.rotation.set(0,b.rot,0);dummy.scale.set(b.w,b.h,b.d);dummy.updateMatrix();im.setMatrixAt(i,dummy.matrix);im.setColorAt(i,b.tint);});
      scene.add(im);
    });
    // azoteas
    const ri=new THREE.InstancedMesh(bodyGeo,new M({roughness:0.9}),bldgDefs.length);
    bldgDefs.forEach((b,i)=>{dummy.position.set(b.px,b.h+0.22,b.pz);dummy.rotation.set(0,b.rot,0);dummy.scale.set(b.w*1.04,0.44,b.d*1.04);dummy.updateMatrix();ri.setMatrixAt(i,dummy.matrix);ri.setColorAt(i,b.roof);});
    scene.add(ri);
    // tanques de azotea
    {const sel=bldgDefs.filter(b=>b.floors>4&&rg()<0.3),n=Math.max(1,sel.length);
     const tm=new THREE.InstancedMesh(new THREE.CylinderGeometry(1.2,1.2,2.2,10),new M({color:0x9aaab4,roughness:0.5,metalness:0.4}),n);
     sel.forEach((b,i)=>{dummy.position.set(b.px+rnd(-3,3),b.h+1.5,b.pz+rnd(-3,3));dummy.rotation.set(0,0,0);dummy.scale.setScalar(1);dummy.updateMatrix();tm.setMatrixAt(i,dummy.matrix);});
     tm.count=sel.length; scene.add(tm);}

    /* farolas */
    const lampBodies=[];
    for(const a of AVENUES)for(const s of STREETS)for(const [ox,oz] of [[-1,-1],[1,-1],[-1,1],[1,1]]){
      const lx=a+ox*(AV_W/2+2),lz=s+oz*(ST_W/2+2); lampBodies.push({x:lx,z:lz});
    }
    const poleMat=new M({color:0x34404c,roughness:0.6,metalness:0.5});
    const lampPole=new THREE.CylinderGeometry(0.09,0.12,LAMP_H,7).translate(0,LAMP_H/2,0);
    const lampHead=new THREE.BoxGeometry(0.7,0.22,2.2).translate(0,LAMP_H+0.11,0);
    const lampGlass=new THREE.BoxGeometry(0.6,0.16,2.0).translate(0,LAMP_H+0.07,0);
    const N_L=lampBodies.length;
    const pI=new THREE.InstancedMesh(lampPole,poleMat,N_L),hI=new THREE.InstancedMesh(lampHead,new M({color:0x2a3040,roughness:0.5}),N_L),gI=new THREE.InstancedMesh(lampGlass,new THREE.MeshBasicMaterial({color:0xfff0b8}),N_L);
    lampBodies.forEach((l,i)=>{dummy.position.set(l.x,0,l.z);dummy.rotation.set(0,0,0);dummy.scale.setScalar(1);dummy.updateMatrix();pI.setMatrixAt(i,dummy.matrix);hI.setMatrixAt(i,dummy.matrix);gI.setMatrixAt(i,dummy.matrix);});
    scene.add(pI,hI,gI);
    lampBodies.forEach(l=>glow(0xfff0a0,8,l.x,LAMP_H+0.1,l.z,scene));

    /* semáforos */
    const tlPos=[];
    for(const a of AVENUES)for(const s of STREETS)for(const side of[-1,1])tlPos.push({x:a+side*(AV_W/2+1.5),z:s+side*1.5});
    {const N=tlPos.length;
     const pm=new THREE.InstancedMesh(new THREE.CylinderGeometry(0.08,0.1,5.5,6).translate(0,2.75,0),poleMat,N);
     const hm=new THREE.InstancedMesh(new THREE.BoxGeometry(0.55,1.5,0.35).translate(0,5.5,0),new M({color:0x1a1e26,roughness:0.6}),N);
     tlPos.forEach((t,i)=>{dummy.position.set(t.x,0,t.z);dummy.rotation.set(0,0,0);dummy.scale.setScalar(1);dummy.updateMatrix();pm.setMatrixAt(i,dummy.matrix);hm.setMatrixAt(i,dummy.matrix);});
     scene.add(pm,hm);
     // luces de semáforo (rojo/verde alternando)
     tlPos.forEach((t,i)=>{glow(i%2?0x20ff40:0xff3020,2.2,t.x,5.6,t.z,scene);});}

    /* ════ cámaras CCTV ════ */
    function buildCCTV(){
      const g=new THREE.Group();
      const bkt=new M({color:0x2a303c,roughness:0.5,metalness:0.5}),camM=new M({color:0x1e2430,roughness:0.3,metalness:0.7});
      const addM=(geo,mat,x,y,z,parent)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);(parent||g).add(m);return m;};
      addM(new THREE.CylinderGeometry(0.07,0.09,1.8,7),bkt,0,0.9,0);
      const arm=new THREE.Group(); arm.position.set(0,1.8,0); g.add(arm);
      addM(new THREE.BoxGeometry(0.14,0.14,0.7),bkt,0,0,-0.35,arm);
      const head=new THREE.Group(); head.position.set(0,0,-0.7); arm.add(head);
      addM(new THREE.BoxGeometry(0.55,0.38,0.7),camM,0,0,0,head);
      addM(new THREE.SphereGeometry(0.14,10,8,0,TAU,0,Math.PI/2).scale(1,1,0.7),new M({color:0x0a0c10,roughness:0.05,metalness:0.8}),0,0,0.38,head);
      glow(0x1a6aff,0.8,0,0.04,0.38,head);
      const recLed=glow(0xff1a1a,1.2,0.24,0.16,0,head);
      g.userData={arm,head,recLed}; return g;
    }
    const CCTV_POS=[];
    for(const a of AVENUES)for(const s of STREETS)for(const[ox,oz]of[[-1,-1],[1,-1],[-1,1],[1,1]]){
      const cx=a+ox*(AV_W/2+3.5),cz=s+oz*(ST_W/2+3.5),ch=rnd(5.5,9.5);
      CCTV_POS.push({x:cx,z:cz,y:ch,active:false});
    }
    bldgDefs.filter(b=>b.floors>6&&rg()<0.4).forEach(b=>CCTV_POS.push({x:b.px,z:b.pz,y:b.h+0.5,active:false}));
    const cctvObjs=CCTV_POS.map(cp=>{const o=buildCCTV();o.position.set(cp.x,cp.y,cp.z);scene.add(o);return o;});

    /* luces rojas de activación de CCTV (se encienden al detectar el convoy) */
    const cctvSpotLights=CCTV_POS.map(cp=>{
      const sl=new THREE.SpotLight(0xff2a2a,0,30,0.6,0.5,1.8);
      sl.position.set(cp.x,cp.y,cp.z); scene.add(sl,sl.target); return sl;
    });

    /* ════ convoy y drones ════ */
    const curve=new THREE.CatmullRomCurve3(ROUTE_PTS,true,'catmullrom',0.5);
    const L=curve.getLength(),SPEED=14;
    const gaps=[0,28,56],lats=[0,2.4,-2.4];
    const trucks=gaps.map((g2,i)=>{
      const obj=buildTruck([0x7a8f6a,0x9a9470,0x7a8f6a][i]); scene.add(obj);
      const ret=new THREE.Group();
      const rm=new THREE.MeshBasicMaterial({color:0x22d3ee,transparent:true,opacity:0.75,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,fog:false});
      ret.add(new THREE.Mesh(new THREE.RingGeometry(2.6,2.74,64).rotateX(-Math.PI/2),rm));
      const tickG=new THREE.BoxGeometry(0.5,0.03,0.12);
      for(let k=0;k<4;k++){const t=new THREE.Mesh(tickG,rm);const a=(k/4)*TAU;t.position.set(Math.cos(a)*3.1,0,Math.sin(a)*3.1);t.rotation.y=-a;ret.add(t);}
      scene.add(ret);
      const lb=labelSprite('UNIT-0'+(i+1),'URBAN OPS','#22d3ee'); lb.scale.set(5,1.5,1); scene.add(lb);
      // luz de posición de la camioneta
      const carLight=new THREE.PointLight(0xfff0c0,2.8,14,1.8); obj.add(carLight); carLight.position.set(0,2,4);
      return {obj,ret,lb,pos:new THREE.Vector3(),tangent:new THREE.Vector3(0,0,1),yaw:0,acc:0};
    });
    const droneCfgs=[{target:0,R:10,h:8.5,ph:0,orb:0.19},{target:1,R:11,h:9.5,ph:2.2,orb:-0.16},{target:2,R:9,h:8,ph:4.4,orb:0.22},{target:0,over:true,R:38,h:32,ph:1.1,orb:0.08}];
    const drones=droneCfgs.map(cfg=>{
      const obj=buildDrone(); scene.add(obj);
      const beam=new THREE.Mesh(new THREE.ConeGeometry(1.8,1,24,1,true).translate(0,-0.5,0).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0x22d3ee,transparent:true,opacity:0.09,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,fog:false}));
      scene.add(beam);
      return Object.assign({},cfg,{obj,beam,pos:new THREE.Vector3(),vel:new THREE.Vector3(),acc:new THREE.Vector3(),inited:false});
    });
    const exhaust=makeParticles(hq?320:160,{color:[0.5,0.52,0.54],size:[1.2,4.5],alpha:0.2,life:[1.4,2.8],damp:1.4,rise:0.5,gravity:0,power:1.4});
    scene.add(exhaust.pts);

    /* ════ overlay CCTV ════ */
    const overlay=document.createElement('canvas'); overlay.id='cmCityOverlay';
    overlay.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;opacity:0;transition:opacity .35s;z-index:0';
    canvas.parentElement?.appendChild(overlay);
    const ctx2=overlay.getContext('2d');
    let overlayActive=false,activeCCTVId=0;
    function drawOverlay(T2,w,h){
      if(!ctx2||!overlayActive)return;
      ctx2.clearRect(0,0,w,h);
      // scanlines
      ctx2.fillStyle='rgba(0,0,0,0.22)';
      for(let y=0;y<h;y+=3)ctx2.fillRect(0,y,w,1.4);
      // viñeta
      const vg=ctx2.createRadialGradient(w/2,h/2,h*0.25,w/2,h/2,h*0.7);
      vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,0.5)');
      ctx2.fillStyle=vg; ctx2.fillRect(0,0,w,h);
      // ruido
      const id=ctx2.createImageData(Math.min(w,640),Math.min(h,360));const d=id.data;
      for(let i=0;i<d.length;i+=8){const n=(Math.random()*24)|0;d[i]=d[i+1]=d[i+2]=n;d[i+3]=16;}
      ctx2.putImageData(id,0,0);
      // esquinas
      const bw=Math.min(200,w*0.16),bh=Math.min(70,h*0.10);
      ctx2.strokeStyle='rgba(0,255,80,0.55)'; ctx2.lineWidth=2;
      for(const[cx,cy]of[[0,0],[w-bw,0],[0,h-bh],[w-bw,h-bh]]){ctx2.beginPath();ctx2.moveTo(cx+bw,cy);ctx2.lineTo(cx,cy);ctx2.lineTo(cx,cy+bh);ctx2.stroke();}
      // texto
      const now=new Date(1791000000000+T2*1000); const ts=now.toISOString().replace('T',' ').slice(0,19);
      const fs=Math.round(h*0.022); ctx2.font=`bold ${fs}px "Courier New",monospace`;
      ctx2.shadowColor='rgba(0,255,80,0.6)'; ctx2.shadowBlur=6;
      ctx2.fillStyle='rgba(0,255,80,0.85)';
      ctx2.fillText(`CAM-${String(activeCCTVId+1).padStart(3,'0')}  ${ts}`,14,Math.round(h*0.036));
      ctx2.fillStyle='rgba(0,255,80,0.6)';
      ctx2.fillText(`URBAN SURVEILLANCE  ZONE-${['ALPHA','BRAVO','CHARLIE','DELTA'][activeCCTVId%4]}`,14,h-Math.round(h*0.014));
      const t2=Math.floor(T2)%2===0; ctx2.fillStyle=t2?'rgba(255,40,40,0.95)':'rgba(180,0,0,0.4)';
      ctx2.fillText('● REC',w-Math.round(w*0.09),Math.round(h*0.036));
      ctx2.shadowBlur=0;
    }

    /* ════ cámara ════ */
    const SHOTS=['wide','chase','street','cctv','aerial'],SHOT_LEN=9,BLEND=1.8;
    const camPos=new THREE.Vector3(),camLook=new THREE.Vector3();
    const fromP=new THREE.Vector3(),fromL=new THREE.Vector3(),pP=new THREE.Vector3(),pL=new THREE.Vector3();
    const conv=new THREE.Vector3();
    let curShot='',blendT=99,T=0,cctvCam=null;
    const rgt3=new THREE.Vector3(),fwd3=new THREE.Vector3();

    function pose(name,t,outP,outL){
      const lead=trucks[0],tg=lead.tangent;
      rgt3.crossVectors(up3,tg).normalize();
      switch(name){
        case 'chase': outP.copy(lead.pos).addScaledVector(rgt3,16).addScaledVector(tg,-7).y+=5; outL.copy(lead.pos).addScaledVector(tg,5).y+=2; break;
        case 'street':outP.copy(lead.pos).addScaledVector(tg,22).y+=2.4; outL.copy(lead.pos).addScaledVector(tg,-1).y+=2.2; break;
        case 'aerial':outP.copy(conv).addScaledVector(tg,-35).addScaledVector(rgt3,20).y+=48; outL.copy(conv).addScaledVector(tg,8); break;
        case 'cctv':
          if(cctvCam){outP.copy(cctvCam.wpos);outL.copy(lead.pos).y+=1.2;}
          else pose('wide',t,outP,outL);
          break;
        default:{const a=t*0.08+0.6; outP.set(conv.x+Math.cos(a)*72,24+4*Math.sin(t*0.3),conv.z+Math.sin(a)*72); outL.copy(conv);}
      }
    }

    /* ════ simulación ════ */
    function updateTrucks(dt){
      conv.set(0,0,0);
      trucks.forEach((tr,i)=>{
        const u=(((T*SPEED/L - gaps[i]/L)*10%10+10)%10)/10;
        const p=curve.getPointAt(u),tg=curve.getTangentAt(u).setY(0).normalize();
        rgt3.crossVectors(up3,tg).normalize();
        const x=p.x+rgt3.x*lats[i],z=p.z+rgt3.z*lats[i],o=tr.obj;
        o.position.set(x,0,z); tr.yaw=Math.atan2(tg.x,tg.z);
        o.rotation.set(Math.sin(T*3.5+i)*0.016,tr.yaw,Math.sin(T*2+i)*0.009,'YXZ');
        tr.tangent.copy(tg); tr.pos.copy(o.position);
        const ud=o.userData;
        ud.wheels.forEach(w=>{w.rotation.x+=SPEED*dt/0.46;});
        const blink=(Math.sin(T*12+i)>0)?1:0.18;
        ud.barMat.emissiveIntensity=0.3+1.6*blink; ud.lbGlow.material.opacity=0.15+0.75*blink;
        ud.ants.forEach((a2,k)=>{a2.rotation.x=-0.25+Math.sin(T*3+k+i)*0.05;a2.rotation.z=Math.sin(T*2+k)*0.04;});
        tr.ret.position.set(x,0.05,z); tr.ret.rotation.y=T*0.8; tr.ret.scale.setScalar(1+0.04*Math.sin(T*3+i));
        tr.lb.position.set(x,4.5,z);
        const dk=clamp(camera.position.distanceTo(o.position)/50,0.4,1.5); tr.lb.scale.set(5*dk,1.5*dk,1);
        conv.add(o.position);
        tr.acc+=dt*22;while(tr.acc>=1){tr.acc-=1;for(const sx of[-0.9,0.9]){const w=t3A.set(sx,0.2,-1.4).applyMatrix4(o.matrixWorld);exhaust.emit(w.x+rnd(-0.2,0.2),w.y,w.z+rnd(-0.2,0.2),-tg.x*rnd(0.4,1.5)+rnd(-0.5,0.5),rnd(0.3,1.0),-tg.z*rnd(0.4,1.5)+rnd(-0.5,0.5));}}
      });
      conv.multiplyScalar(1/trucks.length);
      trucks.forEach(t2=>t2.obj.updateMatrixWorld(true));
    }
    function updateDrones(dt,snap){
      const leadP=trucks[0].pos;
      drones.forEach((d,i)=>{
        if(d.over){const a=d.ph+T*d.orb;t3A.set(conv.x+Math.cos(a)*d.R,d.h+2*Math.sin(T*0.5),conv.z+Math.sin(a)*d.R);}
        else{const tr=trucks[d.target],a=tr.yaw+Math.PI+Math.sin(T*0.22+d.ph)*1.1+d.orb*0.3*Math.sin(T*0.4);t3A.set(tr.pos.x+Math.sin(a)*d.R,tr.pos.y+d.h+1.1*Math.sin(T*0.9+d.ph),tr.pos.z+Math.cos(a)*d.R);}
        for(const b of bldgDefs){const dx=t3A.x-b.px,dz=t3A.z-b.pz;if(Math.abs(dx)<b.w/2+3&&Math.abs(dz)<b.d/2+3)t3A.y=Math.max(t3A.y,b.h+5);}
        if(!d.inited||snap){d.pos.copy(t3A);d.vel.set(0,0,0);d.acc.set(0,0,0);d.inited=true;}
        else{d.acc.copy(t3A).sub(d.pos).multiplyScalar(3.2).addScaledVector(d.vel,-2.6);d.vel.addScaledVector(d.acc,dt);if(d.vel.length()>28)d.vel.setLength(28);d.pos.addScaledVector(d.vel,dt);}
        const o=d.obj; o.position.copy(d.pos);
        t3B.copy(leadP).sub(d.pos);
        const yaw=Math.atan2(t3B.x,t3B.z); fwd3.set(Math.sin(yaw),0,Math.cos(yaw)); rgt3.crossVectors(up3,fwd3);
        o.rotation.set(clamp(d.acc.dot(fwd3)*0.032,-0.4,0.4),yaw,clamp(-d.acc.dot(rgt3)*0.032,-0.4,0.4),'YXZ');
        const ud=o.userData;
        ud.rotors.forEach((r,k)=>{r.rotation.y+=dt*(k%2?65:-65);});
        ud.leds.forEach((l,k)=>{l.material.opacity=0.3+0.7*(0.5+0.5*Math.sin(T*7+k*1.6+i));});
        o.updateMatrixWorld(true); ud.gimbal.lookAt(leadP); ud.gimbal.updateMatrixWorld(true);
        t3C.set(0,0,0); ud.gimbal.getWorldPosition(t3C);
        d.beam.position.copy(t3C); d.beam.lookAt(leadP); d.beam.scale.set(1,1,t3C.distanceTo(leadP));
        d.beam.material.opacity=0.06+0.04*Math.sin(T*5+i);
      });
    }
    function updateCCTVs(){
      const lead=trucks[0].pos; let best=null,bestD=9e9;
      cctvObjs.forEach((o,i)=>{
        const cp=CCTV_POS[i],wpos=o.position,dist=wpos.distanceTo(lead),active=dist<65;
        if(active&&dist<bestD){bestD=dist;best={i,wpos:wpos.clone()};}
        const ud=o.userData;
        if(dist<95){
          t3A.copy(lead).sub(wpos);
          const tgt=Math.atan2(t3A.x,t3A.z);let da=tgt-ud.arm.rotation.y;da=Math.atan2(Math.sin(da),Math.cos(da));
          ud.arm.rotation.y+=da*0.06;
          const pitch=Math.atan2(-t3A.y,Math.sqrt(t3A.x*t3A.x+t3A.z*t3A.z));
          ud.head.rotation.x+=(pitch-ud.head.rotation.x)*0.06;
        }
        const blink=(Math.sin(T*5+i)>0)?1:0.1;
        ud.recLed.material.opacity=active?blink*0.95:0.04;
        const sl=cctvSpotLights[i];
        sl.intensity=active?(1.5+1.5*blink):0;
        sl.target.position.copy(lead); sl.target.updateMatrixWorld();
        cp.active=active;
      });
      cctvCam=best; if(best)activeCCTVId=best.i;
    }
    function updateCamera(dt,snap){
      const idx=Math.floor(T/SHOT_LEN),name=SHOTS[idx%SHOTS.length];
      pose(name,T,pP,pL);
      if(name!==curShot){fromP.copy(camPos);fromL.copy(camLook);curShot=name;blendT=snap?99:0;if(snap){camPos.copy(pP);camLook.copy(pL);fromP.copy(pP);fromL.copy(pL);}}
      blendT+=dt; state.shot=name;
      const f=smooth(0,BLEND,blendT); camPos.lerpVectors(fromP,pP,f); camLook.lerpVectors(fromL,pL,f);
      camPos.y=Math.max(camPos.y,1.4);
      camera.position.copy(camPos); camera.lookAt(camLook); sky.position.copy(camera.position);
      moonL.target.position.copy(conv); moonL.position.copy(conv).addScaledVector(t3A.set(-80,240,-120).normalize(),300);
      const wantOv=(name==='cctv');
      if(wantOv!==overlayActive){overlayActive=wantOv;overlay.style.opacity=wantOv?'1':'0';}
      if(opts.shiftY&&window.innerWidth/window.innerHeight>1.2) camera.setViewOffset(window.innerWidth,window.innerHeight,0,opts.shiftY*window.innerHeight,window.innerWidth,window.innerHeight);
      else camera.clearViewOffset();
    }
    function frame(dt,snap){
      T+=dt; updateTrucks(dt); updateDrones(dt,snap); updateCCTVs(); exhaust.update(dt); updateCamera(dt,snap);
      drawOverlay(T,overlay.width||window.innerWidth,overlay.height||window.innerHeight);
    }

    /* ════ resize / loop ════ */
    function resize(){
      const w=Math.max(1,window.innerWidth),h=Math.max(1,window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,state.pixelRatioCap)); renderer.setSize(w,h,false);
      overlay.width=w; overlay.height=h;
      camera.aspect=w/h; camera.fov=w/h<0.8?66:52; camera.updateProjectionMatrix();
      exhaust.mat.uniforms.uScale.value=(h*renderer.getPixelRatio())/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov)/2))*0.4;
    }
    window.addEventListener('resize',resize); resize();
    let raf=0,last=0,lastR=0,ema=16,slow=0;
    const minStep=opts.fps?1000/opts.fps-2:0;
    function loop(now){
      raf=requestAnimationFrame(loop);
      if(opts.pause&&opts.pause()){last=0;return;}
      if(minStep&&now-lastR<minStep)return;
      const dt=Math.min(0.05,last?(now-last)/1000:0.016);last=now;lastR=now;
      frame(dt,false); renderer.render(scene,camera);
      ema=lerp(ema,dt*1000,0.05); state.fps=Math.round(1000/Math.max(ema,1));
      if(ema>38&&++slow>120){slow=0;if(state.pixelRatioCap>1){state.pixelRatioCap=1;resize();}else if(moonL.castShadow){moonL.castShadow=false;renderer.shadowMap.enabled=false;}}else if(ema<=38)slow=0;
    }
    const onVis=()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else if(!reduceMotion&&!raf){last=0;raf=requestAnimationFrame(loop);}};
    document.addEventListener('visibilitychange',onVis);
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();cancelAnimationFrame(raf);raf=0;});
    const api={
      seek(sec){T=Math.max(0,sec-0.05);curShot='';frame(0.05,true);frame(0.0001,false);renderer.render(scene,camera);},
      info(){return{T:+T.toFixed(2),shot:state.shot,activeCCTVs:CCTV_POS.filter(c=>c.active).length};},
      stats(){return{fps:state.fps,quality:opts.quality,shot:state.shot,pixelRatio:renderer.getPixelRatio(),shadows:moonL.castShadow};},
      dispose(){
        cancelAnimationFrame(raf);window.removeEventListener('resize',resize);document.removeEventListener('visibilitychange',onVis);
        overlay.remove();
        scene.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{if(m.map)m.map.dispose();if(m.emissiveMap)m.emissiveMap.dispose();m.dispose();});});
        renderer.dispose();
      }
    };
    if(reduceMotion)api.seek(18); else{T=2;frame(0.05,true);raf=requestAnimationFrame(loop);}
    return api;
  }

  window.CMCityScene={start};
  if(window.CMScenes)window.CMScenes.register({id:'city',label:'Ciudad vigilada',desc:'Convoy táctico con drones y cámaras CCTV en ciudad nocturna',icon:'ti-building-skyscraper',start});
})();
