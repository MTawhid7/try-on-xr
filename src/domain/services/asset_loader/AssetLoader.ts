// src/domain/services/asset_loader/AssetLoader.ts
import * as THREE from 'three';
import { MeshLoader } from './MeshLoader';
import { OrientationOptimizer } from '../mesh_analysis/orientation/OrientationOptimizer';
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

        // 1. PCA AXIS ALIGNMENT
        OrientationOptimizer.alignAxes(rawBodyMesh);

        // 2. SMART SCALING
        MeshScaler.normalizeBodyScale(rawBodyMesh);
        this.normalizeShirtScale(shirtMesh);

        // 3. TOPOLOGY VALIDATION
        OrientationOptimizer.validateOrientation(rawBodyMesh);

        // 4. BAKE TRANSFORMS
        this.meshLoader.bakeTransform(rawBodyMesh);
        this.meshLoader.bakeTransform(shirtMesh);

        // 5. ALIGNMENT
        console.log("[AssetLoader] Auto-Aligning meshes...");
        AutoAligner.alignBody(rawBodyMesh.geometry);
        AutoAligner.alignGarmentToBody(shirtMesh.geometry, rawBodyMesh.geometry);

        // --- CAPTURE HIGH-RES VISUALS ---
        // Clone the geometry to keep a pristine high-poly copy for rendering
        const visualBodyGeometry = rawBodyMesh.geometry.clone();

        // 6. PHYSICS PROXY GENERATION
        console.log("[AssetLoader] Generating Physics Proxies...");
        const colliderProcessed = await ProxyGenerator.generateCollider(rawBodyMesh);
        const garmentProxy = await ProxyGenerator.generateGarment(shirtMesh);

        // 7. FINAL GEOMETRY PROCESSING
        const garmentMeshForWelding = new THREE.Mesh(new THREE.BufferGeometry());
        garmentMeshForWelding.geometry.setAttribute('position', new THREE.BufferAttribute(garmentProxy.vertices, 3));
        garmentMeshForWelding.geometry.setIndex(new THREE.BufferAttribute(garmentProxy.indices, 1));

        const garmentFinal = GeometryProcessor.process(garmentMeshForWelding, 0.02);

        if (garmentProxy.uvs.length > 0 && garmentFinal.vertices.length === garmentProxy.vertices.length) {
            garmentFinal.uvs = garmentProxy.uvs;
        }

        return {
            garment: garmentFinal,
            collider: colliderProcessed,
            visualBody: visualBodyGeometry // Return high-res geo
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