import * as THREE from 'three';

export interface RoverRig {
  solarHinges: THREE.Group[];
  solarDeployed: number[];
  solarStowed: number[];
  mastStage: THREE.Group;
  mastSlide: THREE.Group;
  mastRetracted: number;
  mastRaised: number;
  antennaYaw: THREE.Group;
  antennaTilt: THREE.Group;
  antennaParkYaw: number;
  antennaParkPitch: number;
  cueMaterial: THREE.MeshStandardMaterial;
}

export interface SceneModels {
  descentStageGroup: THREE.Group;
  retroreflectorGroup: THREE.Group;
  roverGroup: THREE.Group;
  roverHeadlights: THREE.SpotLight[];
  roverWheels: THREE.Object3D[];
  roverRig: RoverRig | null;
  flagGroup: THREE.Group;
  voyagerGroup: THREE.Group;
  earthMesh: THREE.Group;
}

export function createKaptonFoilTexture(renderer: THREE.WebGLRenderer): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#d97706';
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = 'rgba(254, 240, 138, 0.45)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 65; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * 256, Math.random() * 256);
    ctx.lineTo(Math.random() * 256, Math.random() * 256);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(113, 63, 18, 0.5)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 45; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * 256, Math.random() * 256);
    ctx.lineTo(Math.random() * 256, Math.random() * 256);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

export function createRegolithMicroBumpTexture(renderer: THREE.WebGLRenderer): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 512, 512);

  // Fine basaltic regolith grain noise
  const imgData = ctx.getImageData(0, 0, 512, 512);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const grain = 128 + (Math.random() - 0.5) * 70;
    data[i] = grain;
    data[i + 1] = grain;
    data[i + 2] = grain;
    data[i + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);

  // Micro-craters & impact pockmarks
  for (let i = 0; i < 160; i++) {
    const cx = Math.random() * 512;
    const cy = Math.random() * 512;
    const r = 2 + Math.random() * 14;
    const grad = ctx.createRadialGradient(cx, cy, r * 0.15, cx, cy, r);
    grad.addColorStop(0, 'rgba(35,35,35,0.65)');
    grad.addColorStop(0.75, 'rgba(215,215,215,0.45)');
    grad.addColorStop(1, 'rgba(128,128,128,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(72, 72);
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

export function createSolarCoronaTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 4, 128, 128, 126);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.18, 'rgba(255, 248, 220, 0.85)');
  grad.addColorStop(0.45, 'rgba(251, 191, 36, 0.28)');
  grad.addColorStop(0.75, 'rgba(245, 158, 11, 0.06)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildProceduralModels(renderer: THREE.WebGLRenderer): SceneModels {
  const foilTex = createKaptonFoilTexture(renderer);
  const goldFoilMat = new THREE.MeshStandardMaterial({
    map: foilTex,
    color: 0xf59e0b,
    metalness: 0.88,
    roughness: 0.24,
    bumpMap: foilTex,
    bumpScale: 0.05,
    envMapIntensity: 1.35,
  });
  const darkCarbonMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    metalness: 0.25,
    roughness: 0.72,
  });
  const brushedAlumMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.92,
    roughness: 0.18,
    envMapIntensity: 1.25,
  });

  // 1. Lunar Rover Group
  const roverGroup = new THREE.Group();
  roverGroup.name = 'LunarRover';
  roverGroup.position.set(8, 0, 7);

  const hull = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.45, 1.1), goldFoilMat);
  hull.position.y = 0.55;
  hull.castShadow = true;
  hull.receiveShadow = true;
  roverGroup.add(hull);

  const addRearBadge = (canvas: HTMLCanvasElement, w: number, h: number, y: number, z: number) => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.4,
      metalness: 0.2,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const plane = new THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>(
      new THREE.PlaneGeometry(w, h),
      mat
    );
    plane.position.set(-0.818, y, z);
    plane.rotation.y = -Math.PI / 2;
    roverGroup.add(plane);
    return plane;
  };

  // NOBOTARA-71 License Plate
  const plateCanvas = document.createElement('canvas');
  plateCanvas.width = 512;
  plateCanvas.height = 128;
  const pCtx = plateCanvas.getContext('2d')!;
  pCtx.fillStyle = '#1c1917';
  pCtx.fillRect(0, 0, 512, 128);
  pCtx.strokeStyle = '#d6d3d1';
  pCtx.lineWidth = 8;
  pCtx.strokeRect(8, 8, 496, 112);
  pCtx.fillStyle = '#f5f5f4';
  pCtx.font = 'bold 64px "Plus Jakarta Sans", sans-serif';
  pCtx.textAlign = 'center';
  pCtx.textBaseline = 'middle';
  pCtx.fillText('NOBOTARA-71', 256, 68);

  const plateBacking = new THREE.Mesh(
    new THREE.BoxGeometry(0.014, 0.11, 0.42),
    new THREE.MeshStandardMaterial({ color: 0x292524, metalness: 0.55, roughness: 0.4 })
  );
  plateBacking.position.set(-0.807, 0.42, -0.22);
  roverGroup.add(plateBacking);
  addRearBadge(plateCanvas, 0.4, 0.092, 0.42, -0.22);

  // NASA Insignia
  const nasaCanvas = document.createElement('canvas');
  nasaCanvas.width = 256;
  nasaCanvas.height = 256;
  const nCtx = nasaCanvas.getContext('2d')!;
  nCtx.beginPath();
  nCtx.arc(128, 128, 120, 0, Math.PI * 2);
  nCtx.fillStyle = '#0b3d91';
  nCtx.fill();
  nCtx.fillStyle = '#ffffff';
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI * 0.85 + ((Math.PI * 0.7) / 9) * i;
    const x = 128 + Math.cos(ang) * 78;
    const y = 78 + Math.sin(ang) * 28;
    nCtx.beginPath();
    nCtx.arc(x, y, 4.5, 0, Math.PI * 2);
    nCtx.fill();
  }
  nCtx.beginPath();
  nCtx.moveTo(18, 150);
  nCtx.quadraticCurveTo(128, 78, 238, 150);
  nCtx.quadraticCurveTo(128, 118, 18, 150);
  nCtx.fillStyle = '#e1261c';
  nCtx.fill();
  nCtx.fillStyle = '#ffffff';
  nCtx.font = 'bold 54px "Plus Jakarta Sans", sans-serif';
  nCtx.textAlign = 'center';
  nCtx.textBaseline = 'middle';
  nCtx.fillText('NASA', 128, 168);

  const nasaBadge = addRearBadge(nasaCanvas, 0.12, 0.12, 0.42, 0.14);
  nasaBadge.geometry.dispose();
  nasaBadge.geometry = new THREE.CircleGeometry(0.06, 32);

  // Flag Decal
  const flagDecalCanvas = document.createElement('canvas');
  flagDecalCanvas.width = 300;
  flagDecalCanvas.height = 180;
  const fCtx = flagDecalCanvas.getContext('2d')!;
  fCtx.fillStyle = '#006a4e';
  fCtx.fillRect(0, 0, 300, 180);
  fCtx.fillStyle = '#f42a41';
  fCtx.beginPath();
  fCtx.arc(135, 90, 60, 0, Math.PI * 2);
  fCtx.fill();
  addRearBadge(flagDecalCanvas, 0.16, 0.096, 0.42, 0.32);

  // Top Deck
  const topDeck = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.04, 0.95), darkCarbonMat);
  topDeck.position.y = 0.8;
  topDeck.castShadow = true;
  roverGroup.add(topDeck);

  // Solar Wings
  const solarCanvas = document.createElement('canvas');
  solarCanvas.width = 128;
  solarCanvas.height = 64;
  const sCtx = solarCanvas.getContext('2d')!;
  sCtx.fillStyle = '#0b1d4a';
  sCtx.fillRect(0, 0, 128, 64);
  sCtx.strokeStyle = '#d6b25e';
  sCtx.lineWidth = 2;
  for (let x = 8; x < 128; x += 16) {
    sCtx.beginPath();
    sCtx.moveTo(x, 2);
    sCtx.lineTo(x, 62);
    sCtx.stroke();
  }
  for (let y = 4; y < 64; y += 15) {
    sCtx.beginPath();
    sCtx.moveTo(2, y);
    sCtx.lineTo(126, y);
    sCtx.stroke();
  }
  const solarMat = new THREE.MeshStandardMaterial({
    map: new THREE.CanvasTexture(solarCanvas),
    color: 0x93c5fd,
    metalness: 0.55,
    roughness: 0.28,
  });
  const solarPanelGeo = new THREE.BoxGeometry(1.05, 0.028, 0.48);
  const hingeCylGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.2, 10);

  const solarHinges: THREE.Group[] = [];
  const solarDeployed: number[] = [];
  const solarStowed: number[] = [];

  [1, -1].forEach((side) => {
    const hinge = new THREE.Group();
    hinge.name = side > 0 ? 'SolarHingePos' : 'SolarHingeNeg';
    hinge.position.set(0, 0.86, side * 0.56);
    const pin = new THREE.Mesh(hingeCylGeo, brushedAlumMat);
    pin.rotation.z = Math.PI / 2;
    hinge.add(pin);
    const panel = new THREE.Mesh(solarPanelGeo, solarMat);
    panel.position.set(0, 0, side * 0.25);
    panel.castShadow = true;
    hinge.add(panel);
    const deployedAngle = side > 0 ? -0.7 : 0.7;
    const stowedAngle = side > 0 ? -Math.PI : Math.PI;
    hinge.rotation.x = deployedAngle;
    solarHinges.push(hinge);
    solarDeployed.push(deployedAngle);
    solarStowed.push(stowedAngle);
    roverGroup.add(hinge);
  });

  // Camera Mast
  const mastGroup = new THREE.Group();
  mastGroup.name = 'CameraMast';
  mastGroup.position.set(0.62, 0.84, 0);
  const mastBase = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.058, 0.18, 12), brushedAlumMat);
  mastBase.position.y = 0.09;
  mastGroup.add(mastBase);

  const mastStage = new THREE.Group();
  mastStage.name = 'CameraMastStage';
  const mastMid = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.044, 0.58, 10), brushedAlumMat);
  mastMid.position.y = 0.12;
  mastMid.castShadow = true;
  mastStage.add(mastMid);

  const mastSlide = new THREE.Group();
  mastSlide.name = 'CameraMastSlide';
  const mastTop = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.03, 0.4, 10), brushedAlumMat);
  mastTop.position.y = 0.16;
  mastTop.castShadow = true;
  mastSlide.add(mastTop);

  const camHead = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.14, 0.32), darkCarbonMat);
  camHead.position.y = 0.44;
  mastSlide.add(camHead);

  const lensMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.9, roughness: 0.1 });
  const lensLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.06, 12), lensMat);
  lensLeft.rotation.z = Math.PI / 2;
  lensLeft.position.set(0.12, 0, 0.08);
  camHead.add(lensLeft);
  const lensRight = lensLeft.clone();
  lensRight.position.set(0.12, 0, -0.08);
  camHead.add(lensRight);

  mastStage.add(mastSlide);
  mastGroup.add(mastStage);
  roverGroup.add(mastGroup);

  // High-Gain Dish Antenna
  const antGroup = new THREE.Group();
  antGroup.position.set(-0.48, 0.82, -0.32);
  const antPole = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.022, 0.5, 8), brushedAlumMat);
  antPole.position.y = 0.25;
  antGroup.add(antPole);

  const antennaYaw = new THREE.Group();
  antennaYaw.position.y = 0.5;
  antGroup.add(antennaYaw);
  const antennaTilt = new THREE.Group();
  antennaYaw.add(antennaTilt);

  const dishMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.85,
      roughness: 0.3,
      side: THREE.DoubleSide,
    })
  );
  dishMesh.rotation.x = -Math.PI / 2;
  antennaTilt.add(dishMesh);

  const feedHorn = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.032, 0.07, 8), brushedAlumMat);
  feedHorn.rotation.x = Math.PI / 2;
  feedHorn.position.z = 0.09;
  antennaTilt.add(feedHorn);

  const antennaParkYaw = 0.85;
  const antennaParkPitch = -0.45;
  antennaYaw.rotation.y = antennaParkYaw;
  antennaTilt.rotation.x = antennaParkPitch;
  roverGroup.add(antGroup);

  // Rear Whip & Status Cue Light
  const whip = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.38, 8), brushedAlumMat);
  whip.position.set(-0.78, 1.02, 0);
  roverGroup.add(whip);

  const cueMaterial = new THREE.MeshStandardMaterial({
    color: 0xff2a2a,
    emissive: 0xff2a2a,
    emissiveIntensity: 2.2,
    roughness: 0.3,
    metalness: 0.05,
  });
  const cueLight = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.07, 0.16), cueMaterial);
  cueLight.position.set(-0.78, 0.9, 0.38);
  roverGroup.add(cueLight);

  const cueHousing = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.1, 0.2), brushedAlumMat);
  cueHousing.position.set(-0.755, 0.9, 0.38);
  roverGroup.add(cueHousing);

  const roverRig: RoverRig = {
    solarHinges,
    solarDeployed,
    solarStowed,
    mastStage,
    mastSlide,
    mastRetracted: 0,
    mastRaised: 0.32,
    antennaYaw,
    antennaTilt,
    antennaParkYaw,
    antennaParkPitch,
    cueMaterial,
  };

  // 6 Woven Wire Mesh Wheels
  const roverWheels: THREE.Object3D[] = [];
  const wheelCoords: [number, number, number][] = [
    [-0.6, 0.28, -0.7],
    [0, 0.28, -0.72],
    [0.6, 0.28, -0.7],
    [-0.6, 0.28, 0.7],
    [0, 0.28, 0.72],
    [0.6, 0.28, 0.7],
  ];
  const tireGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.2, 24);
  tireGeo.rotateX(Math.PI / 2);
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.45, roughness: 0.78 });
  const hubGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.21, 12);
  hubGeo.rotateX(Math.PI / 2);
  const hubMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.2 });
  const spokeGeo = new THREE.BoxGeometry(0.42, 0.04, 0.205);
  const spokeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.25 });

  wheelCoords.forEach((pos, idx) => {
    const wheel = new THREE.Mesh(tireGeo, tireMat);
    wheel.name = `RoverWheel_${idx}`;
    wheel.position.set(pos[0], pos[1], pos[2]);
    wheel.castShadow = true;
    wheel.receiveShadow = true;
    wheel.userData.suspensionRest = wheel.position.clone();
    wheel.userData.suspensionRadius = 0.24;

    wheel.add(new THREE.Mesh(hubGeo, hubMat));
    wheel.add(new THREE.Mesh(spokeGeo, spokeMat));
    const crossSpoke = new THREE.Mesh(spokeGeo, spokeMat);
    crossSpoke.rotation.z = Math.PI / 2;
    wheel.add(crossSpoke);

    roverGroup.add(wheel);
    roverWheels.push(wheel);
  });

  // Rover Headlights
  const roverHeadlights: THREE.SpotLight[] = [];
  [-0.35, 0.35].forEach((zOff) => {
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 12), brushedAlumMat);
    lamp.rotation.z = Math.PI / 2;
    lamp.position.set(0.85, 0.55, zOff);
    roverGroup.add(lamp);

    const spot = new THREE.SpotLight(0xfffbeb, 4.5, 22, Math.PI / 4.5, 0.45, 1.2);
    spot.position.set(0.9, 0.55, zOff);
    const target = new THREE.Object3D();
    target.position.set(7, 0, zOff);
    roverGroup.add(target);
    spot.target = target;
    roverGroup.add(spot);
    roverHeadlights.push(spot);
  });

  // 2. Historic US Flag Assembly
  const flagGroup = new THREE.Group();
  flagGroup.position.set(-23.331, 0, 2.138);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2), brushedAlumMat);
  pole.position.y = 1;
  flagGroup.add(pole);

  const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.9), brushedAlumMat);
  crossbar.rotation.z = Math.PI / 2;
  crossbar.position.set(0.45, 1.95, 0);
  flagGroup.add(crossbar);

  const flagCanvas = document.createElement('canvas');
  flagCanvas.width = 256;
  flagCanvas.height = 160;
  const flCtx = flagCanvas.getContext('2d')!;
  for (let i = 0; i < 13; i++) {
    flCtx.fillStyle = i % 2 === 0 ? '#b91c1c' : '#f8fafc';
    flCtx.fillRect(0, (160 / 13) * i, 256, 160 / 13);
  }
  flCtx.fillStyle = '#1e3a8a';
  flCtx.fillRect(0, 0, 100, (160 / 13) * 7);
  flCtx.fillStyle = '#f8fafc';
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 6; c++) {
      flCtx.fillRect(10 + c * 15, 10 + r * 15, 4, 4);
    }
  }
  const flagTex = new THREE.CanvasTexture(flagCanvas);
  flagTex.colorSpace = THREE.SRGBColorSpace;
  const flagGeo = new THREE.PlaneGeometry(0.85, 0.55, 8, 5);
  const posAttr = flagGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    posAttr.setZ(i, Math.sin(x * 7 + y * 2) * 0.045);
  }
  flagGeo.computeVertexNormals();
  const flagCloth = new THREE.Mesh(
    flagGeo,
    new THREE.MeshStandardMaterial({ map: flagTex, roughness: 0.65, metalness: 0.08, side: THREE.DoubleSide })
  );
  flagCloth.position.set(0.45, 1.65, 0);
  flagCloth.castShadow = true;
  flagGroup.add(flagCloth);
  flagGroup.name = 'HistoricFlag';

  // 3. Voyager 1 Interstellar Probe (Outro)
  const voyagerGroup = new THREE.Group();
  voyagerGroup.name = 'Voyager1';
  voyagerGroup.position.set(0, -500, 0);
  voyagerGroup.scale.set(1.4, 1.4, 1.4);

  const vDish = new THREE.Mesh(
    new THREE.SphereGeometry(2.4, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2.3),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35, metalness: 0.2, side: THREE.DoubleSide })
  );
  vDish.rotation.x = Math.PI / 2;
  voyagerGroup.add(vDish);

  const vFeed = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.8), brushedAlumMat);
  vFeed.position.set(0, 0, 1);
  vFeed.rotation.x = Math.PI / 2;
  voyagerGroup.add(vFeed);

  const vBus = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.7, 10), darkCarbonMat);
  vBus.position.set(0, 0, -0.6);
  vBus.rotation.x = Math.PI / 2;
  voyagerGroup.add(vBus);

  const goldenRecord = new THREE.Mesh(
    new THREE.CylinderGeometry(0.48, 0.48, 0.02, 32),
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.95, roughness: 0.15 })
  );
  goldenRecord.position.set(1.02, 0, -0.6);
  goldenRecord.rotation.z = Math.PI / 2;
  voyagerGroup.add(goldenRecord);

  const magBoom = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 7.5), brushedAlumMat);
  magBoom.position.set(-3.8, 0, -0.6);
  magBoom.rotation.z = Math.PI / 2;
  voyagerGroup.add(magBoom);

  const rtgBoom = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.25, 2.2, 8),
    new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.4 })
  );
  rtgBoom.position.set(0, -2.4, -0.6);
  rtgBoom.rotation.x = Math.PI / 6;
  voyagerGroup.add(rtgBoom);

  // 4. Procedural Fallback Eagle Descent Stage (replaced automatically when descent_stage.glb loads)
  const descentStageGroup = new THREE.Group();
  descentStageGroup.name = 'EagleDescentStage';
  descentStageGroup.position.set(-17.331, 0, -5.862);
  const octCore = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 1.6, 8), goldFoilMat);
  octCore.position.y = 1.4;
  octCore.castShadow = true;
  octCore.receiveShadow = true;
  descentStageGroup.add(octCore);

  const engineBell = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.85, 0.9, 20, 1, true), darkCarbonMat);
  engineBell.position.y = 0.55;
  descentStageGroup.add(engineBell);

  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2 + Math.PI / 4;
    const legGroup = new THREE.Group();
    legGroup.rotation.y = angle;
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 2.4, 10), goldFoilMat);
    strut.position.set(0, 1.05, 2.65);
    strut.rotation.x = -0.35;
    strut.castShadow = true;
    legGroup.add(strut);

    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.55, 0.12, 20), goldFoilMat);
    pad.position.set(0, 0.06, 3.15);
    pad.castShadow = true;
    pad.receiveShadow = true;
    legGroup.add(pad);
    descentStageGroup.add(legGroup);
  }

  const plaqueFallback = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.18, 0.02),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.25 })
  );
  plaqueFallback.name = 'CommemorativePlaque';
  plaqueFallback.position.set(-0.065, 1.71, 3.635);
  descentStageGroup.add(plaqueFallback);

  // 5. Procedural Fallback LRRR Retroreflector
  const retroreflectorGroup = new THREE.Group();
  retroreflectorGroup.name = 'LaserRetroreflector';
  retroreflectorGroup.position.set(-2.12, 0, 21.53);
  const lrrrBase = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.28, 0.48), brushedAlumMat);
  lrrrBase.position.y = 0.14;
  lrrrBase.castShadow = true;
  retroreflectorGroup.add(lrrrBase);

  const lrrrArray = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.04, 0.42),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.95, roughness: 0.08 })
  );
  lrrrArray.position.set(0, 0.3, 0);
  lrrrArray.rotation.x = -0.45;
  retroreflectorGroup.add(lrrrArray);

  // 6. Procedural Fallback Earth
  const earthMesh = new THREE.Group();
  earthMesh.name = 'Earth';

  return {
    descentStageGroup,
    retroreflectorGroup,
    roverGroup,
    roverHeadlights,
    roverWheels,
    roverRig,
    flagGroup,
    voyagerGroup,
    earthMesh,
  };
}
