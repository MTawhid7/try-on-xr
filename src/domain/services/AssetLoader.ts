// src/domain/services/AssetLoader.ts
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GeometryProcessor } from './GeometryProcessor';
import type { SimulationAssets } from '../types';

export class AssetLoader {
    private loader: GLTFLoader;

    constructor() {
        this.loader = new GLTFLoader();
    }

    public async loadSceneAssets(): Promise<SimulationAssets> {
        console.log("[AssetLoader] Starting asset loading...");

        const [shirtMesh, mannequinMesh] = await Promise.all([
            this.loadMesh('/models/shirt.glb', 'Garment'),
            this.loadMesh('/models/mannequin.glb', 'Mannequin')
        ]);

        console.log("[AssetLoader] Processing geometries...");

        // FIX: Increase weld threshold from 0.001 (1mm) to 0.02 (2cm).
        // This ensures that separate mesh islands (like cuffs/collars)
        // that are modeled close to the body are snapped together.
        const garmentProcessed = GeometryProcessor.process(shirtMesh, 0.02);

        // Process Collider (Needs accurate normals for smooth collision)
        // We use a slightly larger threshold or 0 to keep it crisp,
        // but 0.001 is usually safe to fix micro-gaps.
        const colliderProcessed = GeometryProcessor.process(mannequinMesh, 0.001);

        console.log(`[AssetLoader] Assets Ready.
            Garment: ${garmentProcessed.vertices.length / 3} verts.
            Collider: ${colliderProcessed.vertices.length / 3} verts.`);

        return {
            garment: garmentProcessed,
            collider: colliderProcessed
        };
    }

    private loadMesh(url: string, name: string): Promise<THREE.Mesh> {
        return new Promise((resolve, reject) => {
            this.loader.load(
                url,
                (gltf) => {
                    // Find the first Mesh in the scene
                    let foundMesh: THREE.Mesh | null = null;

                    gltf.scene.traverse((child) => {
                        if (!foundMesh && (child as THREE.Mesh).isMesh) {
                            foundMesh = child as THREE.Mesh;
                        }
                    });

                    if (foundMesh) {
                        // Detach from scene and apply world transforms if needed
                        // For now, we assume the GLB is exported with correct transforms (0,0,0)
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
}