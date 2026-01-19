// src/domain/services/AssetLoader.ts
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GeometryProcessor } from './GeometryProcessor';
import { AutoAligner } from './AutoAligner'; // NEW
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

        console.log("[AssetLoader] Auto-Aligning meshes...");

        // 1. Align Body First (Establishes the coordinate system)
        const bodyBox = AutoAligner.alignBody(mannequinMesh.geometry);

        // 2. Align Shirt to Body
        AutoAligner.alignGarmentToBody(shirtMesh.geometry, bodyBox);

        console.log("[AssetLoader] Processing geometries...");

        // 3. Process (Weld & Extract)
        // Note: We process the ALIGNED geometries now.
        const garmentProcessed = GeometryProcessor.process(shirtMesh, 0.02);
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
                    const foundMesh = gltf.scene.getObjectByProperty('isMesh', true) as THREE.Mesh | undefined;

                    if (foundMesh) {
                        // FIX: Ensure the scene graph transforms are up to date
                        gltf.scene.updateMatrixWorld(true);

                        // Clone geometry
                        const geometry = foundMesh.geometry.clone();

                        // FIX: Bake the transform (Rotation/Scale/Position) into the vertices
                        // This ensures that if the GLB has a "Fix Rotation" node, we respect it.
                        geometry.applyMatrix4(foundMesh.matrixWorld);

                        const cleanMesh = new THREE.Mesh(geometry);
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
}