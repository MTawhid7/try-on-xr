// src/domain/services/asset_loader/MeshLoader.ts
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class MeshLoader {
    private loader: GLTFLoader;

    constructor() {
        this.loader = new GLTFLoader();
    }

    public load(url: string, name: string): Promise<THREE.Mesh> {
        return new Promise((resolve, reject) => {
            this.loader.load(
                url,
                (gltf) => {
                    const scene = gltf.scene.clone(true);

                    const skinnedMesh = scene.getObjectByProperty('isSkinnedMesh', true);
                    const staticMesh = scene.getObjectByProperty('isMesh', true);
                    const foundMesh = (skinnedMesh || staticMesh) as THREE.Mesh | undefined;

                    if (foundMesh) {
                        console.log(`[MeshLoader] Loaded '${name}': ${foundMesh.type}`);

                        // Ensure matrices are up to date
                        scene.updateMatrixWorld(true);

                        // We return the mesh attached to the scene graph so we can inspect hierarchy if needed
                        resolve(foundMesh);
                    } else {
                        reject(new Error(`No mesh found in ${name} (${url})`));
                    }
                },
                undefined,
                (error) => reject(error)
            );
        });
    }

    /**
     * Applies the Object3D's world transform (Position/Rotation/Scale)
     * directly into the BufferGeometry vertices.
     */
    public bakeTransform(mesh: THREE.Mesh) {
        mesh.updateMatrixWorld(true);
        const geometry = mesh.geometry;

        // Clone to avoid mutating shared resources if any
        const bakedGeometry = geometry.clone();
        bakedGeometry.applyMatrix4(mesh.matrixWorld);
        mesh.geometry = bakedGeometry;

        // Reset transform since it's now baked into the vertices
        mesh.position.set(0, 0, 0);
        mesh.quaternion.set(0, 0, 0, 1);
        mesh.scale.set(1, 1, 1);
        mesh.updateMatrixWorld();
    }
}