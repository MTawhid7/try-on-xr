// src/domain/services/asset_loader/AssetLoader.ts
import * as THREE from 'three';
import { MeshLoader } from './MeshLoader';
import { OrientationOptimizer } from './OrientationOptimizer'; // NEW
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

        const [shirtMesh, rawBodyMesh] = await Promise.all([
            this.meshLoader.load('/models/shirt.glb', 'Garment'),
            this.meshLoader.load('/models/mannequin.glb', 'Body')
        ]);

        // 1. PCA ALIGNMENT (The "Magic" Fix)
        // Mathematically finds the body axis and aligns it to Y-Up.
        // Handles leaning, lying down, and upside-down meshes in one step.
        // We apply this DIRECTLY to the geometry.
        OrientationOptimizer.alignToUpright(rawBodyMesh);

        // We also align the shirt, just in case it was exported with the same weird rotation.
        // However, shirt topology (neck hole vs hem) is harder to detect with PCA islands.
        // For now, we assume the shirt is reasonably upright or matches the body's original transform.
        // Actually, let's trust AutoAligner to snap the shirt later.
        // But if the shirt is lying down, AutoAligner might fail.
        // Let's try a gross bounding box check for the shirt.
        AutoAligner.fixOrientation(shirtMesh); // Keep the simple box check for the shirt

        // 2. SMART SCALING
        // Now that the body is definitely upright, measuring Y gives the true Height.
        MeshScaler.normalizeBodyScale(rawBodyMesh);
        this.normalizeShirtScale(shirtMesh);

        // 3. BAKE TRANSFORMS
        // Commit the Scaling to the geometry. (Rotation was already applied by PCA).
        this.meshLoader.bakeTransform(rawBodyMesh);
        this.meshLoader.bakeTransform(shirtMesh);

        // 4. ALIGNMENT
        console.log("[AssetLoader] Auto-Aligning meshes...");
        AutoAligner.alignBody(rawBodyMesh.geometry);
        AutoAligner.alignGarmentToBody(shirtMesh.geometry, rawBodyMesh.geometry);

        // 5. PHYSICS PROXY GENERATION
        console.log("[AssetLoader] Generating Physics Proxies...");
        const colliderProcessed = await ProxyGenerator.generateCollider(rawBodyMesh);
        const garmentProxy = await ProxyGenerator.generateGarment(shirtMesh);

        // 6. FINAL GEOMETRY PROCESSING
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