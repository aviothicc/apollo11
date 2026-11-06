import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  ARTIFACTS,
  ArtifactId,
  LASER_STATION,
  MarkerId,
  VISUAL_PRESETS,
  VisualLookConfig,
} from '../data/artifacts';
import { LaserSystem } from './LaserSystem';
import { ModelLoader } from './ModelLoader';
import {
  buildProceduralModels,
  createRegolithMicroBumpTexture,
  createSolarCoronaTexture,
  SceneModels,
} from './ProceduralModels';

export interface TelemetryData {
  speed: number;
  heading: number;
  distanceToTarget: number;
  nearestArtifact: MarkerId | null;
  position: { x: number; y: number; z: number };
}

export interface CameraModeConfig {
  mode: 'title' | 'intro' | 'explore' | 'inspect' | 'ranging' | 'outro' | 'warp';
  targetArtifact?: ArtifactId;
  introProgress?: number;
  outroProgress?: number;
}

interface InspectionMarkerEntry {
  artifactId: MarkerId;
  group: THREE.Group;
  cylinderBeam: THREE.Mesh;
  diamond: THREE.Mesh;
  ringMesh: THREE.Mesh;
  position: THREE.Vector3;
  radius: number;
  visited: boolean;
  inside: boolean;
}

interface SuspensionLink {
  wheel: THREE.Object3D;
  restLocal: THREE.Vector3;
  radius: number;
  direct: boolean;
}

const isSoftwareGl = (() => {
  if (typeof window === 'undefined') return false;
  const gl = document.createElement('canvas').getContext('webgl2');
  if (!gl) return true;
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
  const gpu = String(gl.getParameter(param));
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
})();

const _tempVecA = new THREE.Vector3();
const _tempVecB = new THREE.Vector3();

function createMarkerBeamTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 256, 0, 0);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.92)');
  grad.addColorStop(0.35, 'rgba(255, 255, 255, 0.5)');
  grad.addColorStop(0.7, 'rgba(255, 255, 255, 0.15)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

export class LunarEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private frameId = 0;
  private isDisposed = false;
  private lastFrameTime = performance.now();

  private visualConfig: VisualLookConfig = { ...VISUAL_PRESETS.apollo_1969 };
  private regolithBumpTex: THREE.CanvasTexture;
  private sunCoronaSprite: THREE.Sprite | null = null;
  private footprintsModel: THREE.Group | null = null;
  private laser = new LaserSystem();

  private customActiveModels: Record<string, boolean> = {};
  private terrainMesh: THREE.Group | null = null;
  private terrainRaycast = false;
  private heightRay = new THREE.Raycaster();
  private heightRayOrigin = new THREE.Vector3();
  private heightRayDown = new THREE.Vector3(0, -1, 0);
  private heightField: {
    originX: number;
    originZ: number;
    cellX: number;
    cellZ: number;
    cols: number;
    rows: number;
    heights: Float32Array;
  } | null = null;

  private sunDirection = new THREE.Vector3(1000, 320, 140).normalize();
  private sunLight!: THREE.DirectionalLight;
  private earthFillLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private starsParticles!: THREE.Points;
  private warpGeometry!: THREE.BufferGeometry;
  private warpLines!: THREE.LineSegments;

  private dustParticles!: THREE.Points;
  private dustPositions!: Float32Array;
  private dustVelocities: THREE.Vector3[] = [];
  private dustAges!: Float32Array;
  private dustSpawnIdx = 0;

  private models!: SceneModels;
  private defaultModels!: SceneModels;
  private roverVelocity = 0;
  private roverHeading = 0;
  private roverPose: 'charging' | 'booting' | 'ready' = 'charging';
  private roverBootStart = 0;
  private roverBootNotified = false;
  private dishAim = new THREE.Vector3();
  private roverPosition = new THREE.Vector3(8, 0, 7);
  private roverTargetSpeed = 0;
  private roverTurnInput = 0;
  private roverPitch = 0;
  private roverRoll = 0;
  private suspensionGroup: THREE.Group | null = null;
  private suspensions: SuspensionLink[] = [];
  private suspensionDir = new THREE.Vector3();

  private cameraConfig: CameraModeConfig = { mode: 'title' };
  private introActive = false;
  private introStartedAt = 0;
  private introHoldUntil = 0;
  private introStartCam = new THREE.Vector3(22.669, 42, 54.138);
  private introMidCam = new THREE.Vector3(-5.331, 14, 19.138);
  private introLookStart = new THREE.Vector3(-17.331, 2, -5.862);
  private introLookMid = new THREE.Vector3(-17.331, 1.5, -5.862);
  private cameraTarget = new THREE.Vector3(0, 1.5, 0);

  private shadowDirty = true;
  private shadowAnchorX = NaN;
  private shadowAnchorZ = NaN;
  private shadowAnchorHeading = NaN;

  private telemetryStamp = '';
  private nearStamp: MarkerId | null | undefined = undefined;
  public onTelemetryUpdate?: (data: TelemetryData) => void;
  public onNearArtifact?: (id: MarkerId | null, distance: number) => void;
  public onRoverBootComplete?: () => void;
  public onIntroCameraSettled?: () => void;

  private plaqueLook = new THREE.Vector3(-17.396, 2.706, -2.227);
  private plaqueNormal = new THREE.Vector3(0, 0.409, 0.913);
  private plaqueLocalCenter = new THREE.Vector3();
  private plaqueLocalNormal = new THREE.Vector3(0, 0, 1);
  private plaqueAimId = 0;
  private plaqueNdc = new THREE.Vector3();
  public plaqueScreenPoint = { x: 0, y: 0, visible: false };

  private inspectionMarkers = new Map<MarkerId, InspectionMarkerEntry>();
  private visibleMarkerIds: MarkerId[] | null = null;
  private visitedArtifacts: Record<ArtifactId, boolean> | null = null;
  private elapsedTime = 0;

  constructor(container: HTMLElement) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
      logarithmicDepthBuffer: true,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = this.visualConfig.exposure;
    this.renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = !isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x020308);
    this.scene.fog = new THREE.FogExp2(0x020308, this.visualConfig.fogDensity);

    this.camera = new THREE.PerspectiveCamera(
      52,
      container.clientWidth / container.clientHeight,
      0.1,
      80000
    );
    this.camera.position.set(-17.331, 11, 22.138);

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    this.regolithBumpTex = createRegolithMicroBumpTexture(this.renderer);

    this.renderer.domElement.style.visibility = 'hidden';
    this.initLights();
    this.initStars();
    this.initWarpLines();
    this.initDustParticles();
    this.scene.add(this.laser.group);
    this.initModels();
    this.initProceduralTerrainFallback();

    window.addEventListener('resize', this.onResize);
    this.tick = this.tick.bind(this);
    this.presentBundledModels();
  }

  private initProceduralTerrainFallback() {
    const geo = new THREE.PlaneGeometry(600, 600, 160, 160);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, this.getLunarHeight(x, z));
    }
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color: 0x6b7280,
      roughness: 0.96,
      metalness: 0.0,
      envMapIntensity: 0.04,
      bumpMap: this.regolithBumpTex,
      bumpScale: 0.04,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    const group = new THREE.Group();
    group.add(mesh);
    this.terrainMesh = group;
    this.scene.add(group);
  }

  private onResize = () => {
    if (!this.container || this.isDisposed) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  public getVisualConfig(): VisualLookConfig {
    return { ...this.visualConfig };
  }

  public applyVisualConfig(config: VisualLookConfig) {
    this.visualConfig = { ...config };
    this.renderer.toneMappingExposure = config.exposure;
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.density = config.fogDensity;
    }

    const elevRad = THREE.MathUtils.degToRad(config.sunElevationDeg);
    const azimRad = THREE.MathUtils.degToRad(config.sunAzimuthDeg);
    this.sunDirection
      .set(
        Math.cos(elevRad) * Math.cos(azimRad),
        Math.sin(elevRad),
        Math.cos(elevRad) * Math.sin(azimRad)
      )
      .normalize();

    if (this.sunLight) {
      this.sunLight.intensity = config.sunIntensity;
    }
    if (this.hemiLight) {
      this.hemiLight.intensity = config.preset === 'original_buggy' ? 0.48 : 0.16;
    }
    if (this.terrainMesh) {
      this.tuneTerrainMaterials(this.terrainMesh);
    }
    if (this.footprintsModel) {
      this.footprintsModel.visible = config.showFootprints;
      this.tuneFootprintsMaterials(this.footprintsModel);
    }
    if (this.sunCoronaSprite) {
      this.sunCoronaSprite.visible = config.showSolarCorona;
    }

    this.shadowDirty = true;
    this.refreshShadows(true);
  }

  private tuneTerrainMaterials(terrainGroup: THREE.Object3D) {
    terrainGroup.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => {
        const std = m as THREE.MeshStandardMaterial;
        if (!std) return;
        std.envMapIntensity = this.visualConfig.regolithEnvIntensity;
        std.roughness = this.visualConfig.regolithRoughness;
        std.metalness = 0.0;
        if (this.visualConfig.microGritBump > 0) {
          std.bumpMap = this.regolithBumpTex;
          std.bumpScale = this.visualConfig.microGritBump;
        } else {
          std.bumpMap = null;
          std.bumpScale = 0;
        }
        if (this.visualConfig.preset === 'original_buggy') {
          std.color.setRGB(1, 1, 1);
        } else {
          std.color.setRGB(0.84, 0.84, 0.86);
        }
        std.needsUpdate = true;
      });
    });
  }

  private tuneFootprintsMaterials(footprintsGroup: THREE.Object3D) {
    footprintsGroup.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => {
        const std = m as THREE.MeshStandardMaterial;
        if (!std) return;
        std.envMapIntensity = this.visualConfig.regolithEnvIntensity;
        std.roughness = 0.96;
        std.polygonOffset = true;
        std.polygonOffsetFactor = -1;
        std.polygonOffsetUnits = -2;
        std.needsUpdate = true;
      });
    });
  }

  private buildTerrainHeightField(terrainObject: THREE.Object3D) {
    this.heightField = null;
    let bestMesh: THREE.Mesh | null = null;
    terrainObject.updateWorldMatrix(true, true);
    terrainObject.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (
        mesh.isMesh &&
        mesh.geometry?.attributes.position &&
        (!bestMesh ||
          mesh.geometry.attributes.position.count > bestMesh.geometry.attributes.position.count)
      ) {
        bestMesh = mesh;
      }
    });
    if (!bestMesh) return;
    const mesh = bestMesh as THREE.Mesh;
    const pos = mesh.geometry.attributes.position;
    const side = Math.round(Math.sqrt(pos.count));
    if (side * side !== pos.count || side < 2) return;

    const worldPt = new THREE.Vector3();
    const getWorld = (idx: number) =>
      mesh.localToWorld(worldPt.set(pos.getX(idx), pos.getY(idx), pos.getZ(idx)));
    const origin = getWorld(0).clone();
    const stepX = getWorld(1).clone().sub(origin);
    const stepZ = getWorld(side).clone().sub(origin);
    if (
      Math.abs(stepX.z) > Math.abs(stepX.x) * 0.02 ||
      Math.abs(stepZ.x) > Math.abs(stepZ.z) * 0.02 ||
      Math.abs(stepX.x) < 1e-4 ||
      Math.abs(stepZ.z) < 1e-4
    ) {
      return;
    }

    const heights = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      heights[i] = getWorld(i).y;
    }
    this.heightField = {
      originX: origin.x,
      originZ: origin.z,
      cellX: stepX.x,
      cellZ: stepZ.z,
      cols: side,
      rows: side,
      heights,
    };
  }

  public getLunarHeight(x: number, z: number): number {
    const hf = this.heightField;
    if (hf) {
      const gx = (x - hf.originX) / hf.cellX;
      const gz = (z - hf.originZ) / hf.cellZ;
      if (gx >= 0 && gz >= 0 && gx <= hf.cols - 1 && gz <= hf.rows - 1) {
        const ix = Math.floor(gx);
        const iz = Math.floor(gz);
        const ix1 = Math.min(ix + 1, hf.cols - 1);
        const iz1 = Math.min(iz + 1, hf.rows - 1);
        const fx = gx - ix;
        const fz = gz - iz;
        const h = hf.heights;
        const c = hf.cols;
        return (
          (h[iz * c + ix] + (h[iz * c + ix1] - h[iz * c + ix]) * fx) * (1 - fz) +
          (h[iz1 * c + ix] + (h[iz1 * c + ix1] - h[iz1 * c + ix]) * fx) * fz
        );
      }
    }
    if (this.terrainRaycast && this.terrainMesh) {
      this.heightRayOrigin.set(x, 4000, z);
      this.heightRay.set(this.heightRayOrigin, this.heightRayDown);
      const hits = this.heightRay.intersectObject(this.terrainMesh, true);
      return hits.length > 0 ? hits[0].point.y : 0;
    }
    const radial = Math.min(1, Math.max(0, (Math.hypot(x, z) - 6) / 12));
    const wave =
      (Math.sin(x * 0.05) * Math.cos(z * 0.05) * 1.5 + Math.sin(x * 0.1 + z * 0.08) * 0.8) *
      radial;
    const d1 = Math.hypot(x - 24, z + 18);
    const c1 = d1 < 10 ? -Math.cos((d1 / 10) * Math.PI * 0.5) * 2.2 : 0;
    const d2 = Math.hypot(x + 28, z - 22);
    const c2 = d2 < 8 ? -Math.cos((d2 / 8) * Math.PI * 0.5) * 1.6 : 0;
    return wave + c1 + c2;
  }

  private initLights() {
    const elevRad = THREE.MathUtils.degToRad(this.visualConfig.sunElevationDeg);
    const azimRad = THREE.MathUtils.degToRad(this.visualConfig.sunAzimuthDeg);
    this.sunDirection
      .set(
        Math.cos(elevRad) * Math.cos(azimRad),
        Math.sin(elevRad),
        Math.cos(elevRad) * Math.sin(azimRad)
      )
      .normalize();

    this.sunLight = new THREE.DirectionalLight(0xfffaf0, this.visualConfig.sunIntensity);
    this.sunLight.position.copy(this.sunDirection).multiplyScalar(95);
    this.sunLight.target.position.set(0, 0, 0);
    this.scene.add(this.sunLight.target);
    this.sunLight.castShadow = !isSoftwareGl;

    if (!isSoftwareGl) {
      this.sunLight.shadow.mapSize.width = 4096;
      this.sunLight.shadow.mapSize.height = 4096;
      this.sunLight.shadow.camera.near = 10;
      this.sunLight.shadow.camera.far = 190;
      this.sunLight.shadow.camera.left = -48;
      this.sunLight.shadow.camera.right = 48;
      this.sunLight.shadow.camera.top = 48;
      this.sunLight.shadow.camera.bottom = -48;
      this.sunLight.shadow.bias = -0.00035;
      this.sunLight.shadow.normalBias = 0.015;
    }
    this.scene.add(this.sunLight);

    this.earthFillLight = new THREE.DirectionalLight(0x38bdf8, 0.28);
    this.earthFillLight.position.set(-70, 35, -60);
    this.scene.add(this.earthFillLight);

    this.hemiLight = new THREE.HemisphereLight(0x1e293b, 0x090d16, 0.16);
    this.scene.add(this.hemiLight);
  }

  private initStars() {
    const count = 4200;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 550 + Math.random() * 350;
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = Math.abs(radius * Math.cos(phi)) + 14;
      positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);

      const tint = Math.random();
      const b = 0.55 + Math.random() * 0.45;
      colors[i * 3] = tint < 0.7 ? b : tint < 0.9 ? b * 0.8 : b;
      colors[i * 3 + 1] = tint < 0.7 ? b : tint < 0.9 ? b * 0.92 : b * 0.86;
      colors[i * 3 + 2] = tint < 0.9 ? b : b * 0.72;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.starsParticles = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 1.45,
        vertexColors: true,
        transparent: true,
        opacity: 0.92,
        fog: false,
      })
    );
    this.scene.add(this.starsParticles);
  }

  private initWarpLines() {
    this.warpGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(3000);
    for (let i = 0; i < 500; i++) {
      const x = (Math.random() - 0.5) * 80;
      const y = (Math.random() - 0.5) * 80;
      const z = (Math.random() - 0.5) * 200;
      positions[i * 6] = x;
      positions[i * 6 + 1] = y;
      positions[i * 6 + 2] = z;
      positions[i * 6 + 3] = x;
      positions[i * 6 + 4] = y;
      positions[i * 6 + 5] = z - 2;
    }
    this.warpGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.warpLines = new THREE.LineSegments(
      this.warpGeometry,
      new THREE.LineBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 0 })
    );
    this.warpLines.position.set(0, 100, -300);
    this.scene.add(this.warpLines);
  }

  private initDustParticles() {
    const count = 90;
    const geo = new THREE.BufferGeometry();
    this.dustPositions = new Float32Array(count * 3);
    this.dustAges = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      this.dustPositions[i * 3 + 1] = -999;
      this.dustAges[i] = 999;
      this.dustVelocities.push(new THREE.Vector3());
    }
    geo.setAttribute('position', new THREE.BufferAttribute(this.dustPositions, 3));
    this.dustParticles = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: 0xa8a29e,
        size: 0.24,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      })
    );
    this.dustParticles.frustumCulled = false;
    this.scene.add(this.dustParticles);
  }

  private updateDustParticles(dt: number) {
    const speed = Math.abs(this.roverVelocity);
    const count = this.dustAges.length;
    if (speed > 0.8 && this.cameraConfig.mode === 'explore') {
      const sinH = Math.sin(this.roverHeading);
      const cosH = Math.cos(this.roverHeading);
      for (const side of [-0.68, 0.68]) {
        const idx = this.dustSpawnIdx % count;
        this.dustSpawnIdx++;
        const wx = this.roverPosition.x - sinH * 0.7 + cosH * side + (Math.random() - 0.5) * 0.15;
        const wz = this.roverPosition.z - cosH * 0.7 - sinH * side + (Math.random() - 0.5) * 0.15;
        const wy = this.getLunarHeight(wx, wz) + 0.08;
        this.dustPositions[idx * 3] = wx;
        this.dustPositions[idx * 3 + 1] = wy;
        this.dustPositions[idx * 3 + 2] = wz;
        this.dustAges[idx] = 0;
        this.dustVelocities[idx].set(
          -sinH * speed * 0.25 + (Math.random() - 0.5) * 0.6,
          0.45 + Math.random() * 0.55,
          -cosH * speed * 0.25 + (Math.random() - 0.5) * 0.6
        );
      }
    }
    let dirty = false;
    for (let i = 0; i < count; i++) {
      if (this.dustAges[i] < 1.2) {
        this.dustAges[i] += dt;
        const v = this.dustVelocities[i];
        v.y -= 1.62 * dt;
        this.dustPositions[i * 3] += v.x * dt;
        this.dustPositions[i * 3 + 1] += v.y * dt;
        this.dustPositions[i * 3 + 2] += v.z * dt;
        if (this.dustAges[i] >= 1.2) this.dustPositions[i * 3 + 1] = -999;
        dirty = true;
      }
    }
    if (dirty) this.dustParticles.geometry.attributes.position.needsUpdate = true;
  }

  private initModels() {
    this.models = buildProceduralModels(this.renderer);
    this.defaultModels = { ...this.models };
    this.scene.add(this.models.descentStageGroup);
    this.scene.add(this.models.retroreflectorGroup);
    this.scene.add(this.models.roverGroup);
    this.scene.add(this.models.flagGroup);
    this.scene.add(this.models.voyagerGroup);

    this.models.flagGroup.position.y = this.getLunarHeight(-23.331, 2.138);
    this.roverPosition.set(8, this.getLunarHeight(8, 7), 7);
    this.models.roverGroup.position.copy(this.roverPosition);
    this.models.roverGroup.rotation.y = this.roverHeading - Math.PI / 2;
  }

  private async presentBundledModels() {
    await this.checkDefaultPublicModels();
    if (this.isDisposed) return;
    this.defaultModels = { ...this.models };
    this.initInspectionMarkers();
    this.reseatSurfaceObjects();
    this.laser.retarget();
    this.applyVisualConfig(this.visualConfig);
    this.renderer.domElement.style.visibility = 'visible';
    this.lastFrameTime = performance.now();
    this.tick();
  }

  public replaceModel(type: string, modelScene: THREE.Group, wheels?: THREE.Object3D[]) {
    this.shadowDirty = true;
    if (type === 'rover') {
      this.scene.remove(this.models.roverGroup);
      this.models.roverGroup = modelScene;
      this.models.roverGroup.position.copy(this.roverPosition);
      this.models.roverGroup.rotation.y = this.roverHeading - Math.PI / 2;
      this.scene.add(modelScene);
      if (wheels && wheels.length > 0) this.models.roverWheels = wheels;
      this.models.roverRig = null;
      this.suspensionGroup = null;
      this.customActiveModels.rover = true;
    } else if (type === 'descent_stage') {
      this.scene.remove(this.models.descentStageGroup);
      this.models.descentStageGroup = modelScene;
      this.scene.add(modelScene);
      this.seatOnGround(modelScene, 0.22);
      this.customActiveModels.descent_stage = true;
    } else if (type === 'retroreflector') {
      this.scene.remove(this.models.retroreflectorGroup);
      this.models.retroreflectorGroup = modelScene;
      this.scene.add(modelScene);
      this.seatOnGround(modelScene);
      this.syncReflectorLaserPos();
      this.customActiveModels.retroreflector = true;
    } else if (type === 'voyager') {
      this.scene.remove(this.models.voyagerGroup);
      this.models.voyagerGroup = modelScene;
      modelScene.position.set(0, -500, 0);
      this.scene.add(modelScene);
      this.customActiveModels.voyager = true;
    } else if (type === 'terrain') {
      if (this.terrainMesh) this.scene.remove(this.terrainMesh);
      this.setShadowFlags(modelScene, false, true);
      this.terrainMesh = modelScene;
      this.tuneTerrainMaterials(modelScene);
      this.scene.add(modelScene);
      this.terrainRaycast = true;
      this.buildTerrainHeightField(modelScene);
      this.customActiveModels.terrain = true;
      this.reseatSurfaceObjects();
      if (this.customActiveModels.descent_stage)
        this.seatOnGround(this.models.descentStageGroup, 0.22);
      if (this.customActiveModels.retroreflector) {
        this.seatOnGround(this.models.retroreflectorGroup);
        this.syncReflectorLaserPos();
      }
    } else if (type === 'earth') {
      this.scene.remove(this.models.earthMesh);
      this.setShadowFlags(modelScene, false, false);
      this.setFogEnabled(modelScene, false);
      this.tuneEarth(modelScene);
      this.models.earthMesh = modelScene;
      this.scene.add(modelScene);
      new THREE.Box3().setFromObject(modelScene).getCenter(this.laser.earthPos);
      this.laser.retarget();
      this.customActiveModels.earth = true;
    } else if (type === 'sun') {
      this.setShadowFlags(modelScene, false, false);
      this.setFogEnabled(modelScene, false);
      this.scene.add(modelScene);
      const sunCenter = new THREE.Box3().setFromObject(modelScene).getCenter(new THREE.Vector3());
      this.sunCoronaSprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: createSolarCoronaTexture(),
          color: 0xfffbeb,
          transparent: true,
          opacity: 0.95,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          fog: false,
        })
      );
      this.sunCoronaSprite.position.copy(sunCenter);
      this.sunCoronaSprite.scale.set(2200, 2200, 1);
      this.sunCoronaSprite.visible = this.visualConfig.showSolarCorona;
      this.scene.add(this.sunCoronaSprite);
      this.customActiveModels.sun = true;
    } else if (type === 'footprints') {
      this.footprintsModel = modelScene;
      modelScene.visible = this.visualConfig.showFootprints;
      this.tuneFootprintsMaterials(modelScene);
      this.scene.add(modelScene);
      this.customActiveModels.footprints = true;
    }
  }

  public resetModel(type: string) {
    if (type === 'rover') {
      this.scene.remove(this.models.roverGroup);
      this.models.roverGroup = this.defaultModels.roverGroup;
      this.models.roverWheels = this.defaultModels.roverWheels;
      this.models.roverRig = this.defaultModels.roverRig;
      this.models.roverGroup.position.copy(this.roverPosition);
      this.models.roverGroup.rotation.y = this.roverHeading - Math.PI / 2;
      this.scene.add(this.models.roverGroup);
      this.suspensionGroup = null;
      this.customActiveModels.rover = false;
    } else if (type === 'descent_stage') {
      this.scene.remove(this.models.descentStageGroup);
      this.models.descentStageGroup = this.defaultModels.descentStageGroup;
      this.scene.add(this.models.descentStageGroup);
      this.seatOnGround(this.models.descentStageGroup, 0.22);
      this.customActiveModels.descent_stage = false;
    } else if (type === 'retroreflector') {
      this.scene.remove(this.models.retroreflectorGroup);
      this.models.retroreflectorGroup = this.defaultModels.retroreflectorGroup;
      this.scene.add(this.models.retroreflectorGroup);
      this.seatOnGround(this.models.retroreflectorGroup);
      this.syncReflectorLaserPos();
      this.customActiveModels.retroreflector = false;
    } else if (type === 'voyager') {
      this.scene.remove(this.models.voyagerGroup);
      this.models.voyagerGroup = this.defaultModels.voyagerGroup;
      this.scene.add(this.models.voyagerGroup);
      this.customActiveModels.voyager = false;
    }
    this.shadowDirty = true;
  }

  public getCustomActiveModels(): Record<string, boolean> {
    return { ...this.customActiveModels };
  }

  private async checkDefaultPublicModels() {
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const manifest = [
      { type: 'terrain', url: '/models/terrain.glb' },
      { type: 'descent_stage', url: '/models/descent_stage.glb' },
      { type: 'retroreflector', url: '/models/retroreflector.glb' },
      { type: 'earth', url: '/models/earth.glb' },
      { type: 'sun', url: '/models/sun.glb' },
      { type: 'footprints', url: '/models/footprints.glb' },
    ];
    await Promise.all(
      manifest.map(async (item) => {
        try {
          const headRes = await fetch(item.url, { method: 'HEAD' });
          if (!headRes.ok || this.isDisposed) return;
          const loaded = await ModelLoader.loadFromUrl(item.url, item.type, maxAniso);
          if (this.isDisposed) return;
          this.replaceModel(item.type, loaded.scene, loaded.wheels);
        } catch {
          // Keep procedural fallback
        }
      })
    );
  }

  private seatOnGround(obj: THREE.Object3D, sinkOffset = 0) {
    obj.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(obj);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const groundY = this.getLunarHeight(center.x, center.z);
    obj.position.y += groundY - box.min.y - sinkOffset;
  }

  private reseatSurfaceObjects() {
    this.roverPosition.y = this.getLunarHeight(this.roverPosition.x, this.roverPosition.z);
    this.models.roverGroup.position.y = this.roverPosition.y;
    this.models.flagGroup.position.y = this.getLunarHeight(-23.331, 2.138);
    for (const marker of this.inspectionMarkers.values()) {
      const y = this.getLunarHeight(marker.position.x, marker.position.z);
      marker.position.y = y;
      marker.group.position.y = y;
    }
  }

  private syncReflectorLaserPos() {
    const box = new THREE.Box3().setFromObject(this.models.retroreflectorGroup);
    if (!box.isEmpty()) {
      box.getCenter(this.laser.reflectorPos);
      this.laser.retarget();
    }
  }

  private setShadowFlags(obj: THREE.Object3D, cast: boolean, receive: boolean) {
    obj.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = cast;
        mesh.receiveShadow = receive;
      }
    });
  }

  private tuneEarth(earthObj: THREE.Object3D) {
    earthObj.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => {
        if (!('name' in m)) return;
        if (m.name === 'EarthAtmosphere') {
          mesh.material = new THREE.MeshBasicMaterial({
            name: 'EarthAtmosphere',
            color: 0x60a5fa,
            transparent: true,
            opacity: 0.18,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.FrontSide,
          });
          mesh.scale.setScalar(1.045);
          mesh.visible = true;
          mesh.renderOrder = 1;
        } else if (m.name === 'EarthSurface' && 'emissive' in m) {
          const std = m as THREE.MeshStandardMaterial;
          std.emissive.setRGB(0.02, 0.06, 0.14);
          std.emissiveIntensity = 0.35;
          std.color.setScalar(1.05);
          std.roughness = 0.5;
          std.envMapIntensity = 0.8;
        }
      });
    });
  }

  private setFogEnabled(obj: THREE.Object3D, enabled: boolean) {
    obj.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => {
        if ('fog' in m) (m as THREE.Material & { fog: boolean }).fog = enabled;
      });
    });
  }

  private initInspectionMarkers() {
    const beamTex = createMarkerBeamTexture();
    const specs: { id: MarkerId; position: [number, number, number]; radius: number }[] = [
      {
        id: 'descent_stage',
        position: ARTIFACTS.descent_stage.markerPosition,
        radius: ARTIFACTS.descent_stage.markerRadius,
      },
      {
        id: 'retroreflector',
        position: ARTIFACTS.retroreflector.markerPosition,
        radius: ARTIFACTS.retroreflector.markerRadius,
      },
      {
        id: 'plaque',
        position: ARTIFACTS.plaque.markerPosition,
        radius: ARTIFACTS.plaque.markerRadius,
      },
      {
        id: 'laser_station',
        position: LASER_STATION.position,
        radius: LASER_STATION.radius,
      },
    ];

    specs.forEach((spec) => {
      const [x, , z] = spec.position;
      const y = this.getLunarHeight(x, z);
      const r = spec.radius || 1.6;
      const group = new THREE.Group();
      group.position.set(x, y, z);

      const ringGeo = new THREE.RingGeometry(r * 0.84, r * 0.98, 48);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMesh = new THREE.Mesh(
        ringGeo,
        new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.75,
          side: THREE.DoubleSide,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
        })
      );
      ringMesh.position.y = 0.04;
      group.add(ringMesh);

      const cylGeo = new THREE.CylinderGeometry(r * 0.92, r * 0.92, 1.9, 32, 1, true);
      cylGeo.translate(0, 0.95, 0);
      const cylMesh = new THREE.Mesh(
        cylGeo,
        new THREE.MeshBasicMaterial({
          map: beamTex,
          color: 0x0ea5e9,
          transparent: true,
          opacity: 0.42,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      group.add(cylMesh);

      const diamondMesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.24, 0),
        new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x0284c7,
          emissiveIntensity: 1.1,
          roughness: 0.2,
          metalness: 0.8,
        })
      );
      diamondMesh.position.y = 2.25;
      group.add(diamondMesh);

      group.visible = spec.id === 'descent_stage';
      this.scene.add(group);
      this.inspectionMarkers.set(spec.id, {
        artifactId: spec.id,
        group,
        cylinderBeam: cylMesh,
        diamond: diamondMesh,
        ringMesh,
        position: new THREE.Vector3(x, y, z),
        radius: r,
        visited: false,
        inside: false,
      });
    });

    if (this.visibleMarkerIds) this.setVisibleMarkers(this.visibleMarkerIds);
    if (this.visitedArtifacts) this.setArtifactsVisited(this.visitedArtifacts);
  }

  public setVisibleMarkers(ids: MarkerId[]) {
    this.visibleMarkerIds = ids;
    const set = new Set(ids);
    for (const [id, entry] of this.inspectionMarkers.entries()) {
      entry.group.visible = set.has(id);
    }
  }

  public setArtifactsVisited(visited: Record<ArtifactId, boolean>) {
    this.visitedArtifacts = visited;
    for (const [id, entry] of this.inspectionMarkers.entries()) {
      if (id !== 'laser_station') {
        entry.visited = !!visited[id];
        if (entry.visited) {
          const mat = entry.diamond.material as THREE.MeshStandardMaterial;
          mat.color.setHex(0x10b981);
          mat.emissive.setHex(0x059669);
          (entry.ringMesh.material as THREE.MeshBasicMaterial).color.setHex(0x10b981);
        }
      }
    }
  }

  public setRoverInputs(forward: number, turn: number) {
    this.roverTargetSpeed = forward * 10.4;
    this.roverTurnInput = turn;
  }

  public setCameraMode(config: CameraModeConfig) {
    if (config.mode !== 'intro' && this.introActive) this.cancelIntroFlyby();
    this.cameraConfig = config;
    this.shadowDirty = true;
  }

  public beginIntroFlyby() {
    if (!this.introActive) {
      this.introActive = true;
      this.introStartedAt = performance.now();
      this.introHoldUntil = 0;
      this.cameraConfig = { mode: 'intro', introProgress: 0 };
      this.shadowDirty = true;
    }
  }

  public cancelIntroFlyby() {
    this.introActive = false;
    this.introHoldUntil = 0;
  }

  public snapExploreCamera() {
    this.chaseCameraPose(this.camera.position, this.cameraTarget);
    this.camera.lookAt(this.cameraTarget);
    this.shadowDirty = true;
  }

  public fireLaser() {
    this.laser.fire();
  }

  private scheduleNextFrame() {
    if (this.isDisposed) return;
    if (isSoftwareGl) {
      const gl = this.renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      const poll = () => {
        if (this.isDisposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(this.tick, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  }

  private tick() {
    if (this.isDisposed) return;
    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0.008, (now - this.lastFrameTime) / 1000));
    this.lastFrameTime = now;

    this.updateRover(dt);
    this.updateDustParticles(dt);
    this.updateInspectionMarkers(dt);
    this.laser.update(dt, this.camera, this.renderer.domElement.clientHeight);
    this.updateCamera(dt);

    const earth = this.models.earthMesh.getObjectByName('Earth') ?? this.models.earthMesh;
    earth.rotation.y += 0.018 * dt;

    this.renderer.render(this.scene, this.camera);
    this.scheduleNextFrame();
  }

  private bindSuspensions() {
    const group = this.models.roverGroup;
    group.rotation.order = 'YXZ';
    group.rotation.x = 0;
    group.rotation.z = 0;
    group.updateWorldMatrix(true, true);

    const wheels = (this.models.roverWheels ?? []).filter((w) => group.getObjectById(w.id));
    this.suspensions = wheels.map((w) => {
      const rest = w.userData.suspensionRest as THREE.Vector3 | undefined;
      if (rest) w.position.copy(rest);
      const restLocal = group.worldToLocal(w.getWorldPosition(new THREE.Vector3()));
      let radius = w.userData.suspensionRadius as number | undefined;
      const mesh = w as THREE.Mesh;
      if (!radius && mesh.geometry) {
        if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
        radius = mesh.geometry.boundingSphere?.radius;
      }
      return {
        wheel: w,
        restLocal,
        radius: radius && radius > 0 ? radius : 0.24,
        direct: w.parent === group,
      };
    });
    this.suspensionGroup = group;
  }

  private poseRoverOnTerrain(dt: number) {
    if (this.suspensionGroup !== this.models.roverGroup) this.bindSuspensions();
    const group = this.models.roverGroup;
    const yaw = this.roverHeading - Math.PI / 2;
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);

    if (this.suspensions.length === 0) {
      this.roverPosition.y = this.getLunarHeight(this.roverPosition.x, this.roverPosition.z);
      group.position.copy(this.roverPosition);
      group.rotation.set(0, yaw, 0);
      return;
    }

    const samples = this.suspensions.map((link) => {
      const lx = link.restLocal.x;
      const lz = link.restLocal.z;
      const wx = this.roverPosition.x + cosY * lx + sinY * lz;
      const wz = this.roverPosition.z - sinY * lx + cosY * lz;
      return { link, lx, lz, ground: this.getLunarHeight(wx, wz) };
    });

    let sumGround = 0;
    let sumOffset = 0;
    for (const s of samples) {
      sumGround += s.ground;
      sumOffset += s.link.restLocal.y - s.link.radius;
    }
    const meanGround = sumGround / samples.length;
    this.roverPosition.y = meanGround - sumOffset / samples.length;

    let sxx = 0,
      szz = 0,
      sxz = 0,
      sxy = 0,
      szy = 0;
    for (const s of samples) {
      const dy = s.ground - meanGround;
      sxx += s.lx * s.lx;
      szz += s.lz * s.lz;
      sxz += s.lx * s.lz;
      sxy += s.lx * dy;
      szy += s.lz * dy;
    }

    const det = sxx * szz - sxz * sxz;
    let targetPitch = 0,
      targetRoll = 0;
    if (Math.abs(det) > 1e-4) {
      targetPitch = THREE.MathUtils.clamp((sxy * szz - szy * sxz) / det, -0.4, 0.4);
      targetRoll = THREE.MathUtils.clamp(-((sxx * szy - sxz * sxy) / det), -0.4, 0.4);
    }

    this.roverPitch = THREE.MathUtils.damp(this.roverPitch, targetPitch, 6, dt);
    this.roverRoll = THREE.MathUtils.damp(this.roverRoll, targetRoll, 6, dt);
    group.position.copy(this.roverPosition);
    group.rotation.set(this.roverRoll, yaw, this.roverPitch);
    group.updateMatrix();

    const el = group.matrix.elements;
    const maxTravel = 0.18;
    for (const s of samples) {
      const { link, lx, lz, ground } = s;
      const wheelCenterY = ground + link.radius;
      let localY = link.restLocal.y;
      if (link.direct && Math.abs(el[5]) > 0.2) {
        localY = (wheelCenterY - el[1] * lx - el[9] * lz - el[13]) / el[5];
      } else {
        link.wheel.updateWorldMatrix(true, false);
        const worldY = link.wheel.getWorldPosition(this.suspensionDir).y;
        localY = link.wheel.position.y + (wheelCenterY - worldY);
      }
      const clampedY = THREE.MathUtils.clamp(
        localY,
        link.restLocal.y - maxTravel,
        link.restLocal.y + maxTravel
      );
      link.wheel.position.y = THREE.MathUtils.damp(link.wheel.position.y, clampedY, 10, dt);
      if (link.direct) {
        link.wheel.position.x = link.restLocal.x;
        link.wheel.position.z = link.restLocal.z;
      }
    }
  }

  private updateRover(dt: number) {
    this.roverVelocity = THREE.MathUtils.damp(this.roverVelocity, this.roverTargetSpeed, 4, dt);
    if (Math.abs(this.roverTurnInput) > 0.05) {
      const dirSign = this.roverVelocity < -0.1 ? -1 : 1;
      this.roverHeading += this.roverTurnInput * 1.8 * dt * dirSign;
    }

    this.roverPosition.x += Math.sin(this.roverHeading) * this.roverVelocity * dt;
    this.roverPosition.z += Math.cos(this.roverHeading) * this.roverVelocity * dt;

    this.poseRoverOnTerrain(dt);
    this.refreshShadows();

    if (this.models.roverWheels) {
      const spin = (this.roverVelocity * dt) / 0.24;
      this.models.roverWheels.forEach((w) => {
        w.rotation.z -= spin;
      });
    }

    this.checkArtifactProximity();
    this.applyRoverPose();
  }

  public beginRoverBoot() {
    if (this.models?.roverRig) {
      if (this.roverPose === 'charging') {
        this.roverPose = 'booting';
        this.roverBootStart = performance.now();
        this.roverBootNotified = false;
      }
    } else {
      this.roverPose = 'ready';
      this.roverBootNotified = true;
      this.onRoverBootComplete?.();
    }
  }

  public isRoverBooting() {
    return this.roverPose === 'booting';
  }

  public snapRoverReady() {
    this.roverPose = 'ready';
    this.roverBootNotified = true;
    this.applyRoverPose();
  }

  private applyRoverPose() {
    const rig = this.models?.roverRig;
    if (!rig) return;
    const now = performance.now();
    const elapsed = now - this.roverBootStart;
    const blinkDur = 1200;
    const stageDur = 1400;
    const totalDur = 6150;

    if (this.roverPose === 'booting' && elapsed >= totalDur) {
      this.roverPose = 'ready';
      this.shadowDirty = true;
      if (!this.roverBootNotified) {
        this.roverBootNotified = true;
        this.onRoverBootComplete?.();
      }
    }

    const t =
      this.roverPose === 'booting' ? elapsed : this.roverPose === 'ready' ? totalDur : 0;
    const solarT = this.roverPose === 'charging' ? 0 : this.smoothStep((t - 1450) / stageDur);
    const mastT = this.roverPose === 'charging' ? 0 : this.smoothStep((t - 3100) / stageDur);
    const dishT = this.roverPose === 'charging' ? 0 : this.smoothStep((t - 4750) / stageDur);

    rig.solarHinges.forEach((hinge, idx) => {
      hinge.rotation.x =
        rig.solarDeployed[idx] + (rig.solarStowed[idx] - rig.solarDeployed[idx]) * solarT;
    });

    const mastY = rig.mastRetracted + (rig.mastRaised - rig.mastRetracted) * mastT;
    rig.mastStage.position.y = mastY;
    rig.mastSlide.position.y = mastY;

    const targetAngles = this.dishTargetAngles(rig);
    const dYaw = Math.atan2(
      Math.sin(targetAngles.yaw - rig.antennaParkYaw),
      Math.cos(targetAngles.yaw - rig.antennaParkYaw)
    );
    const dPitch = Math.atan2(
      Math.sin(targetAngles.pitch - rig.antennaParkPitch),
      Math.cos(targetAngles.pitch - rig.antennaParkPitch)
    );
    rig.antennaYaw.rotation.y = rig.antennaParkYaw + dYaw * dishT;
    rig.antennaTilt.rotation.x = rig.antennaParkPitch + dPitch * dishT;

    if (this.roverPose === 'charging') {
      this.setCue(rig, 0xff2a2a, 1.7 + 0.5 * Math.sin(now * 0.004));
    } else if (this.roverPose === 'booting' && elapsed < blinkDur) {
      this.setCue(rig, 0xf5c542, ((elapsed / blinkDur) * 3) % 1 < 0.5 ? 2.4 : 0.05);
    } else {
      this.setCue(rig, 0x22c55e, 2.0);
    }
  }

  private dishTargetAngles(rig: NonNullable<SceneModels['roverRig']>) {
    const parent = rig.antennaYaw.parent;
    if (!parent) return { yaw: rig.antennaParkYaw, pitch: rig.antennaParkPitch };
    parent.updateWorldMatrix(true, false);
    this.dishAim.copy(this.laser.earthPos);
    parent.worldToLocal(this.dishAim);
    this.dishAim.sub(rig.antennaYaw.position);
    return {
      yaw: Math.atan2(this.dishAim.x, this.dishAim.z),
      pitch: Math.atan2(-this.dishAim.y, Math.hypot(this.dishAim.x, this.dishAim.z) || 0.001),
    };
  }

  private setCue(rig: NonNullable<SceneModels['roverRig']>, hex: number, intensity: number) {
    rig.cueMaterial.color.setHex(hex);
    rig.cueMaterial.emissive.setHex(hex);
    rig.cueMaterial.emissiveIntensity = intensity;
  }

  private smoothStep(x: number) {
    const t = Math.min(1, Math.max(0, x));
    return t * t * (3 - 2 * t);
  }

  private updateInspectionMarkers(dt: number) {
    this.elapsedTime += dt;
    const slowWave = Math.sin(this.elapsedTime * 3.5);
    const fastWave = Math.sin(this.elapsedTime * 7.5);
    for (const entry of this.inspectionMarkers.values()) {
      entry.diamond.position.y =
        2.25 + Math.sin(this.elapsedTime * 2.8 + entry.position.x * 0.5) * 0.15;
      entry.diamond.rotation.y += dt * 2.2;
      entry.diamond.rotation.x += dt * 0.9;
      const beamMat = entry.cylinderBeam.material as THREE.MeshBasicMaterial;
      const diaMat = entry.diamond.material as THREE.MeshStandardMaterial;
      if (entry.inside) {
        beamMat.opacity = 0.62 + 0.06 * fastWave;
        diaMat.emissiveIntensity = 1.4 + 0.5 * fastWave;
      } else {
        beamMat.opacity = 0.44 + 0.05 * slowWave;
        diaMat.emissiveIntensity = entry.visited ? 0.65 : 0.9;
      }
    }
  }

  private checkArtifactProximity() {
    const rx = this.roverPosition.x;
    const rz = this.roverPosition.z;
    let insideId: MarkerId | null = null;
    let minDist = 999;
    let nearestId: MarkerId | null = null;

    for (const [id, entry] of this.inspectionMarkers.entries()) {
      if (!entry.group.visible) {
        entry.inside = false;
        continue;
      }
      const d = Math.hypot(rx - entry.position.x, rz - entry.position.z);
      if (d < minDist) {
        minDist = d;
        nearestId = id;
      }
      entry.inside = d <= entry.radius;
      if (entry.inside) insideId = id;
    }

    const speed = Math.abs(this.roverVelocity);
    const heading = ((this.roverHeading * (180 / Math.PI)) % 360 + 360) % 360;
    const stamp = `${speed.toFixed(1)}|${heading.toFixed(0)}|${rx.toFixed(1)}|${rz.toFixed(
      1
    )}|${minDist.toFixed(0)}|${insideId ?? ''}`;

    if (stamp !== this.telemetryStamp) {
      this.telemetryStamp = stamp;
      this.onTelemetryUpdate?.({
        speed,
        heading,
        distanceToTarget: minDist,
        nearestArtifact: insideId || nearestId,
        position: { x: rx, y: this.roverPosition.y, z: rz },
      });
    }

    if (insideId !== this.nearStamp) {
      this.nearStamp = insideId;
      this.onNearArtifact?.(insideId, minDist);
    }
  }

  private updateCamera(dt: number) {
    this.plaqueScreenPoint.visible = false;
    const mode = this.cameraConfig.mode;

    if (mode === 'title') {
      const angle = performance.now() * 0.00018;
      _tempVecB.set(
        -17.331 + Math.sin(angle) * 24,
        7.8 + Math.sin(angle * 0.5) * 1.8,
        -5.862 + Math.cos(angle) * 24
      );
      this.camera.position.lerp(_tempVecB, dt * 2.5);
      this.cameraTarget.set(-17.331, 1.9, -5.862);
      this.camera.lookAt(this.cameraTarget);
    } else if (mode === 'intro') {
      this.updateIntroFlyby();
    } else if (mode === 'explore') {
      this.chaseCameraPose(_tempVecB, _tempVecA);
      this.camera.position.lerp(_tempVecB, dt * 4.5);
      this.cameraTarget.lerp(_tempVecA, dt * 6);
      this.camera.lookAt(this.cameraTarget);
    } else if (mode === 'inspect') {
      const target = this.cameraConfig.targetArtifact;
      if (target === 'plaque') {
        this.holdPlaqueCamera(dt);
      } else {
        let tx = -17.331,
          ty = 1.8,
          tz = -5.862,
          radius = 11.5,
          heightOff = 3.1;
        if (target === 'retroreflector') {
          tx = -2.12;
          ty = 0.55;
          tz = 21.53;
          radius = 6.2;
          heightOff = 1.9;
        }
        const orbit = this.elapsedTime * ((Math.PI * 2) / 40);
        const cx = tx + Math.cos(orbit) * radius;
        const cz = tz + Math.sin(orbit) * radius;
        const groundY = this.getLunarHeight(cx, cz);
        _tempVecB.set(cx, Math.max(ty + heightOff, groundY + 1.2), cz);
        this.camera.position.lerp(_tempVecB, dt * 2.4);
        this.cameraTarget.set(tx, ty, tz);
        this.camera.lookAt(this.cameraTarget);
      }
    } else if (mode === 'ranging') {
      _tempVecB.set(8, 2.4, 21.5);
      this.camera.position.lerp(_tempVecB, dt * 1.4);
      this.cameraTarget.lerp(this.laser.earthPos, dt * 1.4);
      this.camera.lookAt(this.cameraTarget);
    } else if (mode === 'outro' || mode === 'warp') {
      const p = this.cameraConfig.outroProgress ?? 0;
      if (p < 0.5) {
        const y = THREE.MathUtils.lerp(15, 200, p * 2);
        const zOff = THREE.MathUtils.lerp(25, 120, p * 2);
        this.camera.position.set(-17.331, y, -5.862 + zOff);
        this.camera.lookAt(-17.331, 0, -5.862);
        this.models.voyagerGroup.position.set(0, -500, 0);
        (this.warpLines.material as THREE.LineBasicMaterial).opacity = 0;
      } else {
        const w = (p - 0.5) * 2;
        (this.warpLines.material as THREE.LineBasicMaterial).opacity = Math.sin(w * Math.PI) * 0.9;
        this.models.voyagerGroup.position.set(0, 100, -320);
        this.models.voyagerGroup.rotation.y += 0.3 * dt;
        this.camera.position.set(0, 100, -305);
        this.cameraTarget.set(0, 100, -320);
        this.camera.lookAt(this.cameraTarget);
      }
    }
  }

  private refreshShadows(force = false) {
    if (isSoftwareGl || !this.sunLight.castShadow) return;
    const isBooting = this.roverPose === 'booting';

    let anchorX = this.roverPosition.x;
    let anchorZ = this.roverPosition.z;
    if (this.cameraConfig.mode === 'title' || this.cameraConfig.mode === 'intro') {
      anchorX = -10;
      anchorZ = 2;
    } else if (this.cameraConfig.mode === 'inspect') {
      anchorX = this.cameraConfig.targetArtifact === 'retroreflector' ? -2.12 : -17.331;
      anchorZ = this.cameraConfig.targetArtifact === 'retroreflector' ? 21.53 : -5.862;
    }

    if (
      force ||
      this.shadowDirty ||
      isBooting ||
      Math.abs(this.shadowAnchorX - anchorX) > 0.04 ||
      Math.abs(this.shadowAnchorZ - anchorZ) > 0.04 ||
      Math.abs(this.shadowAnchorHeading - this.roverHeading) > 0.015
    ) {
      this.shadowDirty = false;
      this.shadowAnchorX = anchorX;
      this.shadowAnchorZ = anchorZ;
      this.shadowAnchorHeading = this.roverHeading;

      const anchorY = this.getLunarHeight(anchorX, anchorZ);
      this.sunLight.target.position.set(anchorX, anchorY, anchorZ);
      this.sunLight.position
        .copy(this.sunLight.target.position)
        .addScaledVector(this.sunDirection, 95);
      this.sunLight.target.updateMatrixWorld();
      this.renderer.shadowMap.needsUpdate = true;
    }
  }

  private syncPlaqueAim() {
    const plaqueObj = this.models?.descentStageGroup?.getObjectByName('CommemorativePlaque');
    if (plaqueObj) {
      if (this.plaqueAimId !== plaqueObj.id) {
        this.plaqueAimId = plaqueObj.id;
        plaqueObj.updateWorldMatrix(true, true);
        const invMat = new THREE.Matrix4().copy(plaqueObj.matrixWorld).invert();
        const box = new THREE.Box3();
        const v = new THREE.Vector3();
        plaqueObj.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (!mesh.isMesh || !mesh.geometry?.attributes.position) return;
          const pos = mesh.geometry.attributes.position;
          for (let i = 0; i < pos.count; i++) {
            v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).applyMatrix4(invMat);
            box.expandByPoint(v);
          }
        });
        if (!box.isEmpty()) {
          box.getCenter(this.plaqueLocalCenter);
          const sz = new THREE.Vector3();
          box.getSize(sz);
          if (sz.x <= sz.y && sz.x <= sz.z) this.plaqueLocalNormal.set(1, 0, 0);
          else if (sz.y <= sz.x && sz.y <= sz.z) this.plaqueLocalNormal.set(0, 1, 0);
          else this.plaqueLocalNormal.set(0, 0, 1);
        }
      }
      plaqueObj.updateWorldMatrix(true, false);
      this.plaqueLook.copy(this.plaqueLocalCenter).applyMatrix4(plaqueObj.matrixWorld);
      this.plaqueNormal
        .copy(this.plaqueLocalNormal)
        .transformDirection(plaqueObj.matrixWorld)
        .normalize();
    }
  }

  private holdPlaqueCamera(dt: number) {
    this.syncPlaqueAim();
    const look = this.plaqueLook;
    _tempVecB.copy(look).addScaledVector(this.plaqueNormal, 2.35);
    _tempVecB.x -= 1.25;
    const groundY = this.getLunarHeight(_tempVecB.x, _tempVecB.z);
    _tempVecB.y = Math.max(_tempVecB.y, groundY + 0.9);
    this.camera.position.lerp(_tempVecB, dt * 2.4);
    this.cameraTarget.copy(look);
    this.cameraTarget.x -= 0.72;
    this.camera.lookAt(this.cameraTarget);

    this.plaqueNdc.copy(look).project(this.camera);
    const rect = this.container.getBoundingClientRect();
    this.plaqueScreenPoint.x = rect.left + (this.plaqueNdc.x * 0.5 + 0.5) * rect.width;
    this.plaqueScreenPoint.y = rect.top + (-this.plaqueNdc.y * 0.5 + 0.5) * rect.height;
    this.plaqueScreenPoint.visible = this.plaqueNdc.z < 1;
  }

  private chaseCameraPose(outPos: THREE.Vector3, outTarget: THREE.Vector3) {
    const dist = 6.8;
    const cx = this.roverPosition.x - Math.sin(this.roverHeading) * dist;
    const cz = this.roverPosition.z - Math.cos(this.roverHeading) * dist;
    const cy = Math.max(this.roverPosition.y + 2.8, this.getLunarHeight(cx, cz) + 1.2);
    outPos.set(cx, cy, cz);
    outTarget.set(this.roverPosition.x, this.roverPosition.y + 1.2, this.roverPosition.z);
  }

  private poseIntroCamera(progress: number) {
    this.chaseCameraPose(_tempVecB, _tempVecA);
    const sub = progress < 0.5 ? progress * 2 : (progress - 0.5) * 2;
    if (progress < 0.5) {
      this.camera.position.lerpVectors(this.introStartCam, this.introMidCam, sub);
      this.cameraTarget.lerpVectors(this.introLookStart, this.introLookMid, sub);
    } else {
      this.camera.position.lerpVectors(this.introMidCam, _tempVecB, sub);
      this.cameraTarget.lerpVectors(this.introLookMid, _tempVecA, sub);
    }
    this.camera.lookAt(this.cameraTarget);
  }

  private easeIntro(t: number) {
    const split = 0.84;
    if (t <= split) return t;
    const u = (t - split) / 0.16;
    return split + 0.16 * (u * u * (3 - 2 * u));
  }

  private updateIntroFlyby() {
    if (!this.introActive) {
      this.poseIntroCamera(this.cameraConfig.introProgress ?? 0);
      return;
    }
    const now = performance.now();
    const raw = Math.min(1, (now - this.introStartedAt) / 15000);
    const eased = this.easeIntro(raw);
    this.cameraConfig.introProgress = eased;
    if (raw < 1) {
      this.poseIntroCamera(eased);
    } else {
      if (this.introHoldUntil === 0) this.introHoldUntil = now + 500;
      this.snapExploreCamera();
      if (now >= this.introHoldUntil) {
        this.introActive = false;
        this.cameraConfig = { mode: 'explore' };
        this.onIntroCameraSettled?.();
      }
    }
  }

  public dispose() {
    this.isDisposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.removeEventListener('resize', this.onResize);
    for (const entry of this.inspectionMarkers.values()) {
      this.scene.remove(entry.group);
      entry.cylinderBeam.geometry.dispose();
      (entry.cylinderBeam.material as THREE.Material).dispose();
      entry.diamond.geometry.dispose();
      (entry.diamond.material as THREE.Material).dispose();
      entry.ringMesh.geometry.dispose();
      (entry.ringMesh.material as THREE.Material).dispose();
    }
    this.inspectionMarkers.clear();
    this.renderer.dispose();
    if (this.container && this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
