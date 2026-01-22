// src/domain/services/asset_loader/AssetLoader.ts
import { MeshLoader } from './MeshLoader';
import { PoseNormalizer } from './PoseNormalizer';
import { ProxyGenerator } from './ProxyGenerator';
import { GeometryProcessor } from '../GeometryProcessor';
import { AutoAligner } from '../AutoAligner';
import type { SimulationAssets } from '../../types';

export class AssetLoader {
    private meshLoader: MeshLoader;

    constructor() {
        this.meshLoader = new MeshLoader();
    }

    public async loadSceneAssets(): Promise<SimulationAssets> {
        console.log("[AssetLoader] Starting asset loading...");

        // 1. Load Raw GLBs
        // MeshLoader returns the Mesh attached to its full Scene Graph (cloned).
        const [shirtMesh, rawBodyMesh] = await Promise.all([
            this.meshLoader.load('/models/shirt.glb', 'Garment'),
            this.meshLoader.load('/models/mannequin.glb', 'Body')
        ]);

        // 2. Normalize Pose (Fix Lean & Orientation)
        // This modifies the geometry in-place.
        console.log("[AssetLoader] Normalizing Pose...");
        PoseNormalizer.normalize(rawBodyMesh);

        // 3. Bake Transforms
        // Ensures any residual object-level transforms are applied to vertices
        this.meshLoader.bakeTransform(rawBodyMesh);
        this.meshLoader.bakeTransform(shirtMesh);

        console.log("[AssetLoader] Auto-Aligning meshes...");

        // 4. Align Body (Center on floor)
        AutoAligner.alignBody(rawBodyMesh.geometry);

        // 5. Align Shirt to Body (Using Robust Anchors)
        AutoAligner.alignGarmentToBody(shirtMesh.geometry, rawBodyMesh.geometry);

        console.log("[AssetLoader] Processing geometries...");

        // 6. Process Garment (Weld)
        const garmentProcessed = GeometryProcessor.process(shirtMesh, 0.02);

        // 7. Generate Physics Proxy (Decimate + Compact)
        const colliderProcessed = await ProxyGenerator.generate(rawBodyMesh, 5000);

        console.log(`[AssetLoader] Assets Ready.
            Garment: ${garmentProcessed.vertices.length / 3} verts.
            Collider: ${colliderProcessed.vertices.length / 3} verts.`);

        return {
            garment: garmentProcessed,
            collider: colliderProcessed
        };
    }
}