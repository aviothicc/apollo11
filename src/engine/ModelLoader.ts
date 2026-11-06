import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export interface LoadedModelResult {
  scene: THREE.Group;
  wheels?: THREE.Object3D[];
  boundingBox: THREE.Box3;
  size: THREE.Vector3;
}

class ModelLoaderClass {
  private loader = new GLTFLoader();

  public async loadFromUrl(url: string, modelType: string, maxAnisotropy = 4): Promise<LoadedModelResult> {
    return new Promise((resolve, reject) => {
      this.loader.load(
        url,
        (gltf) => {
          resolve(this.processLoadedModel(gltf.scene, modelType, maxAnisotropy));
        },
        undefined,
        (err) => reject(err)
      );
    });
  }

  public async loadFromFile(file: File, modelType: string, maxAnisotropy = 4): Promise<LoadedModelResult> {
    const objectUrl = URL.createObjectURL(file);
    try {
      return await this.loadFromUrl(objectUrl, modelType, maxAnisotropy);
    } finally {
      setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
    }
  }

  private processLoadedModel(scene: THREE.Group, modelType: string, maxAnisotropy: number): LoadedModelResult {
    const wheels: THREE.Object3D[] = [];
    const boundingBox = new THREE.Box3().setFromObject(scene);
    const size = boundingBox.getSize(new THREE.Vector3());

    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((mat) => {
          if (!mat) return;
          const stdMat = mat as THREE.MeshStandardMaterial;
          if ('envMapIntensity' in stdMat) {
            // Suppress indoor RoomEnvironment glare on lunar regolith and footprints
            if (modelType === 'terrain' || modelType === 'footprints') {
              stdMat.envMapIntensity = 0.04;
            } else if (modelType === 'descent_stage' || modelType === 'retroreflector' || modelType === 'rover') {
              stdMat.envMapIntensity = 1.35;
            } else {
              stdMat.envMapIntensity = 1.0;
            }
          }
          if (stdMat.map) {
            stdMat.map.anisotropy = maxAnisotropy;
          }
          if (stdMat.normalMap) {
            stdMat.normalMap.anisotropy = maxAnisotropy;
          }
        });

        if (modelType === 'rover') {
          const lower = mesh.name.toLowerCase();
          if (
            lower.includes('wheel') ||
            lower.includes('tire') ||
            lower.includes('tyre') ||
            lower.includes('roue') ||
            lower.includes('rad')
          ) {
            wheels.push(mesh);
          }
        }
      }
    });

    return {
      scene,
      wheels: wheels.length > 0 ? wheels : undefined,
      boundingBox,
      size,
    };
  }
}

export const ModelLoader = new ModelLoaderClass();
