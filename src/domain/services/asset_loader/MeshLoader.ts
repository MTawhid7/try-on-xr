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
                    // Fix: Use an array to collect candidates.
                    // This avoids TypeScript losing track of assignments inside the traverse callback.
                    const candidates: { mesh: THREE.Mesh, count: number }[] = [];

                    gltf.scene.traverse((child) => {
                        if ((child as THREE.Mesh).isMesh) {
                            const mesh = child as THREE.Mesh;
                            const geometry = mesh.geometry;
                            const count = geometry.attributes.position.count;
                            candidates.push({ mesh, count });
                        }
                    });

                    // Sort by vertex count (descending) to find the main body
                    candidates.sort((a, b) => b.count - a.count);
                    const bestEntry = candidates[0];

                    if (bestEntry) {
                        const bestMesh = bestEntry.mesh;
                        console.log(`[MeshLoader] Loaded '${name}': ${bestMesh.name} (${bestEntry.count} verts)`);

                        // Detach from original scene to ensure clean transform baking
                        const cleanMesh = bestMesh.clone();
                        resolve(cleanMesh);
                    } else {
                        reject(new Error(`No mesh found in ${name} (${url})`));
                    }
                },
                undefined,
                (error) => reject(error)
            );
        });
    }

    public bakeTransform(mesh: THREE.Mesh) {
        mesh.updateMatrixWorld(true);
        const geometry = mesh.geometry;

        const bakedGeometry = geometry.clone();
        bakedGeometry.applyMatrix4(mesh.matrixWorld);
        mesh.geometry = bakedGeometry;

        mesh.position.set(0, 0, 0);
        mesh.quaternion.set(0, 0, 0, 1);
        mesh.scale.set(1, 1, 1);
        mesh.updateMatrixWorld();
    }
}