import * as THREE from 'three';

const _tempVec = new THREE.Vector3();

export class LaserSystem {
  public group = new THREE.Group();
  public isFiring = false;
  public progress = 0;

  private coreMoon = 0.018;
  private coreEarth = 26;
  private haloMoon = 0.04;
  private haloEarth = 46;
  public earthPos = new THREE.Vector3(-19890.44, 2091.26, 0);
  public reflectorPos = new THREE.Vector3(-2.12, 0.5, 21.53);

  private coreMesh: THREE.Mesh;
  private haloMesh: THREE.Mesh;
  private packetMesh: THREE.Mesh;
  private sparkMesh: THREE.Mesh;
  private rippleMesh: THREE.Mesh;

  constructor() {
    this.group.visible = false;
    const diff = new THREE.Vector3().subVectors(this.reflectorPos, this.earthPos);
    const len = diff.length();
    const mid = new THREE.Vector3().addVectors(this.earthPos, this.reflectorPos).multiplyScalar(0.5);
    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      diff.clone().normalize()
    );

    this.coreMesh = new THREE.Mesh(
      this.beamGeo(len, this.coreMoon, this.coreEarth),
      new THREE.MeshBasicMaterial({
        color: 0x3ddbbe,
        transparent: true,
        opacity: 0.92,
        side: THREE.DoubleSide,
        depthWrite: false,
        fog: false,
      })
    );
    this.coreMesh.position.copy(mid);
    this.coreMesh.quaternion.copy(quat);
    this.group.add(this.coreMesh);

    this.haloMesh = new THREE.Mesh(
      this.beamGeo(len, this.haloMoon, this.haloEarth),
      new THREE.MeshBasicMaterial({
        color: 0x4ade80,
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide,
        depthWrite: false,
        fog: false,
      })
    );
    this.haloMesh.position.copy(mid);
    this.haloMesh.quaternion.copy(quat);
    this.group.add(this.haloMesh);

    this.packetMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 1, 8, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xd1fae5,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide,
        depthWrite: false,
        fog: false,
      })
    );
    this.packetMesh.position.copy(this.earthPos);
    this.packetMesh.quaternion.copy(quat);
    this.group.add(this.packetMesh);

    this.sparkMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 16, 12),
      new THREE.MeshBasicMaterial({
        color: 0x4ade80,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      })
    );
    this.sparkMesh.position.copy(this.reflectorPos);
    this.group.add(this.sparkMesh);

    const rippleGeo = new THREE.RingGeometry(0.12, 0.22, 32);
    rippleGeo.rotateX(-Math.PI / 2);
    this.rippleMesh = new THREE.Mesh(
      rippleGeo,
      new THREE.MeshBasicMaterial({
        color: 0x86efac,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      })
    );
    this.rippleMesh.position.set(
      this.reflectorPos.x,
      this.reflectorPos.y + 0.05,
      this.reflectorPos.z
    );
    this.group.add(this.rippleMesh);
  }

  private beamGeo(len: number, rTop: number, rBottom: number) {
    return new THREE.CylinderGeometry(rTop, rBottom, len, 8, 1, true);
  }

  public retarget() {
    const diff = new THREE.Vector3().subVectors(this.reflectorPos, this.earthPos);
    const len = Math.max(diff.length(), 0.001);
    const mid = new THREE.Vector3()
      .addVectors(this.earthPos, this.reflectorPos)
      .multiplyScalar(0.5);
    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      diff.normalize()
    );
    const list = [
      { mesh: this.coreMesh, moon: this.coreMoon, earth: this.coreEarth },
      { mesh: this.haloMesh, moon: this.haloMoon, earth: this.haloEarth },
    ];
    for (const item of list) {
      item.mesh.geometry.dispose();
      item.mesh.geometry = this.beamGeo(len, item.moon, item.earth);
      item.mesh.position.copy(mid);
      item.mesh.quaternion.copy(quat);
    }
    this.packetMesh.quaternion.copy(quat);
    this.sparkMesh.position.copy(this.reflectorPos);
    this.rippleMesh.position.set(
      this.reflectorPos.x,
      this.reflectorPos.y + 0.05,
      this.reflectorPos.z
    );
  }

  public fire() {
    this.isFiring = true;
    this.progress = 0;
    this.group.visible = true;
    this.packetMesh.position.copy(this.earthPos);
    this.rippleMesh.visible = false;
  }

  private placePacket(pos: THREE.Vector3, camera: THREE.PerspectiveCamera, clientHeight: number) {
    this.packetMesh.position.copy(pos);
    this.packetMesh.quaternion.copy(this.coreMesh.quaternion);
    const dist = Math.max(6, camera.position.distanceTo(pos));
    const fovRad = (camera.fov * Math.PI) / 180;
    const pxWorld = (2 * Math.tan(fovRad / 2) * dist) / (clientHeight || 800);
    const len = Math.max(0.35, pxWorld * 8);
    const rad = Math.max(0.01, Math.min(len * 0.08, pxWorld * 1.2));
    this.packetMesh.scale.set(rad, len, rad);
  }

  public update(dt: number, camera: THREE.PerspectiveCamera, clientHeight: number) {
    if (!this.isFiring) return;
    this.progress += dt;
    const total = 3.2;
    const half = total * 0.5;
    const coreMat = this.coreMesh.material as THREE.MeshBasicMaterial;
    const haloMat = this.haloMesh.material as THREE.MeshBasicMaterial;
    const sparkMat = this.sparkMesh.material as THREE.MeshBasicMaterial;
    const rippleMat = this.rippleMesh.material as THREE.MeshBasicMaterial;
    const pulse = Math.sin(this.progress * 22);
    coreMat.opacity = 0.82 + 0.1 * pulse;
    haloMat.opacity = 0.22 + 0.08 * pulse;

    if (this.progress < half) {
      const t = this.progress / half;
      this.placePacket(
        _tempVec.lerpVectors(this.earthPos, this.reflectorPos, t),
        camera,
        clientHeight
      );
      this.packetMesh.visible = true;
      this.sparkMesh.scale.setScalar(0.45 + 0.15 * Math.sin(this.progress * 15));
      this.rippleMesh.visible = false;
    } else {
      const t = (this.progress - half) / half;
      this.placePacket(
        _tempVec.lerpVectors(this.reflectorPos, this.earthPos, t),
        camera,
        clientHeight
      );
      const impactElapsed = this.progress - half;
      if (impactElapsed < 0.7) {
        this.rippleMesh.visible = true;
        const sc = 1 + impactElapsed * 1.6;
        this.rippleMesh.scale.set(sc, sc, sc);
        rippleMat.opacity = Math.max(0, 0.8 - impactElapsed * 1.1);
        this.sparkMesh.scale.setScalar(1.5 + (0.7 - impactElapsed) * 0.8);
        sparkMat.opacity = Math.max(0.25, 1 - impactElapsed * 0.9);
      } else {
        this.rippleMesh.visible = false;
        sparkMat.opacity = 0.3;
        this.sparkMesh.scale.setScalar(0.6);
      }
    }

    if (this.progress > total) {
      this.isFiring = false;
      this.group.visible = false;
    }
  }
}
