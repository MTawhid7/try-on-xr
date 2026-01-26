// src/domain/services/asset_loader/AssetLoader.ts
import * as THREE from 'three';
import { MeshLoader } from './MeshLoader';
import { PoseNormalizer } from './PoseNormalizer';
import { ProxyGenerator } from './ProxyGenerator';
import { MeshScaler } from './MeshScaler';
import { AutoAligner } from '../AutoAligner';
import { GeometryProcessor } from '../GeometryProcessor';
import type { SimulationAssets } from '../../types';

export class AssetLoader {
    private meshLoader: MeshLoader;

    constructor() {
        this.meshLoader = new MeshLoader();
    }

    public async loadSceneAssets(): Promise<SimulationAssets> {
        console.log("[AssetLoader] Starting asset loading...");

        // 1. Load Raw GLBs
        const [shirtMesh, rawBodyMesh] = await Promise.all([
            this.meshLoader.load('/models/shirt.glb', 'Garment'),
            this.meshLoader.load('/models/mannequin.glb', 'Body')
        ]);

        // 2. GROSS ORIENTATION FIX
        // Ensure the longest dimension is Y (Up).
        AutoAligner.fixOrientation(rawBodyMesh);
        AutoAligner.fixOrientation(shirtMesh);

        // 3. SMART SCALING
        // Now that Y is definitely Height, we can scale safely.
        MeshScaler.normalizeBodyScale(rawBodyMesh);
        this.normalizeShirtScale(shirtMesh);

        // 4. BAKE TRANSFORMS (CRITICAL STEP)
        // We must commit the Rotation (Orientation) and Scale (Normalization)
        // to the Geometry BEFORE we analyze it with PoseNormalizer.
        this.meshLoader.bakeTransform(rawBodyMesh);
        this.meshLoader.bakeTransform(shirtMesh);

        // 5. POSE NORMALIZATION
        // Now analyzes the Corrected (Upright, 1.75m) Geometry.
        console.log("[AssetLoader] Normalizing Pose...");
        PoseNormalizer.normalize(rawBodyMesh);

        // 6. ALIGNMENT
        console.log("[AssetLoader] Auto-Aligning meshes...");
        AutoAligner.alignBody(rawBodyMesh.geometry);
        AutoAligner.alignGarmentToBody(shirtMesh.geometry, rawBodyMesh.geometry);

        // 7. PHYSICS PROXY GENERATION
        console.log("[AssetLoader] Generating Physics Proxies...");
        const colliderProcessed = await ProxyGenerator.generateCollider(rawBodyMesh);
        const garmentProxy = await ProxyGenerator.generateGarment(shirtMesh);

        // 8. FINAL GEOMETRY PROCESSING
        const garmentMeshForWelding = new THREE.Mesh(new THREE.BufferGeometry());
        garmentMeshForWelding.geometry.setAttribute('position', new THREE.BufferAttribute(garmentProxy.vertices, 3));
        garmentMeshForWelding.geometry.setIndex(new THREE.BufferAttribute(garmentProxy.indices, 1));

        const garmentFinal = GeometryProcessor.process(garmentMeshForWelding, 0.01);

        if (garmentProxy.uvs.length > 0 && garmentFinal.vertices.length === garmentProxy.vertices.length) {
            garmentFinal.uvs = garmentProxy.uvs;
        }

        console.log(`[AssetLoader] Assets Ready.
            Garment: ${garmentFinal.vertices.length / 3} verts.
            Collider: ${colliderProcessed.vertices.length / 3} verts.`);

        return {
            garment: garmentFinal,
            collider: colliderProcessed
        };
    }

    private normalizeShirtScale(mesh: THREE.Mesh) {
        const box = new THREE.Box3().setFromObject(mesh);
        const height = box.max.y - box.min.y;

        if (height < 0.5 || height > 2.5) {
            const targetHeight = 0.85;
            const scale = targetHeight / height;
            console.log(`[AssetLoader] Normalizing Shirt Scale: ${height.toFixed(2)}m -> ${targetHeight}m (Factor: ${scale.toFixed(4)})`);
            mesh.scale.setScalar(scale);
            mesh.updateMatrixWorld(true);
        }
    }
}