// src/domain/services/asset_loader/AssetLoader.ts
// src/domain/services/asset_loader/AssetLoader.ts
import * as THREE from 'three';
import { MeshLoader } from './MeshLoader';
import { OrientationOptimizer } from '../mesh_analysis/orientation/OrientationOptimizer';
import { ProxyGenerator } from './ProxyGenerator';
import { MeshScaler } from './MeshScaler';
import { AutoAligner } from '../AutoAligner';
import { GeometryProcessor } from '../GeometryProcessor';
import { GarmentGrading } from '../GarmentGrading';
import { BodyMeasurer } from '../BodyMeasurer'; // NEW
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
        // Ensures the body is roughly upright and facing a cardinal direction
        OrientationOptimizer.alignAxes(rawBodyMesh);

        // 2. SMART SCALING
        // Normalizes the body to a standard height (1.75m) so physics units (gravity) make sense
        MeshScaler.normalizeBodyScale(rawBodyMesh);
        this.normalizeShirtScale(shirtMesh);

        // 3. TOPOLOGY VALIDATION
        // Uses the Voting System (Nose/Chest/Toes) to fix "Backward" or "Upside Down" meshes
        OrientationOptimizer.validateOrientation(rawBodyMesh);

        // 4. BAKE TRANSFORMS
        // Applies all rotations/scales to the vertex data permanently
        this.meshLoader.bakeTransform(rawBodyMesh);
        this.meshLoader.bakeTransform(shirtMesh);

        // 5. ALIGNMENT
        // Centers the body on (0,0,0) and snaps the shirt collar to the neck
        console.log("[AssetLoader] Auto-Aligning meshes...");
        AutoAligner.alignBody(rawBodyMesh.geometry);
        AutoAligner.alignGarmentToBody(shirtMesh.geometry, rawBodyMesh.geometry);

        // --- NEW: Measure Body ---
        const chestCm = BodyMeasurer.getChestCircumference(rawBodyMesh);
        console.log(`[AssetLoader] Mannequin Analysis: Height 175cm, Chest ${chestCm.toFixed(1)}cm`);
        // -------------------------

        GarmentGrading.setBaseMesh(shirtMesh);

        const visualBodyGeometry = rawBodyMesh.geometry.clone();

        // 6. PHYSICS PROXY GENERATION
        // Decimates high-poly meshes to ~5k tris for physics, or passes raw if efficient.
        console.log("[AssetLoader] Generating Physics Proxies...");
        const colliderProcessed = await ProxyGenerator.generateCollider(rawBodyMesh);
        const garmentProxy = await ProxyGenerator.generateGarment(shirtMesh);

        // 7. FINAL GEOMETRY PROCESSING
        // Prepares the garment for simulation (Welding, Tangents, UVs)
        const garmentMeshForWelding = new THREE.Mesh(new THREE.BufferGeometry());
        garmentMeshForWelding.geometry.setAttribute('position', new THREE.BufferAttribute(garmentProxy.vertices, 3));
        garmentMeshForWelding.geometry.setIndex(new THREE.BufferAttribute(garmentProxy.indices, 1));

        // Process with 2cm weld threshold to fix detached collars/hems
        const garmentFinal = GeometryProcessor.process(garmentMeshForWelding, 0.02);

        // Restore UVs if they exist (needed for textures)
        if (garmentProxy.uvs.length > 0 && garmentFinal.vertices.length === garmentProxy.vertices.length) {
            garmentFinal.uvs = garmentProxy.uvs;
        }

        console.log(`[AssetLoader] Assets Ready. Garment: ${garmentFinal.vertices.length / 3} verts.`);

        return {
            garment: garmentFinal,
            collider: colliderProcessed,
            visualBody: visualBodyGeometry
        };
    }

    private normalizeShirtScale(mesh: THREE.Mesh) {
        const box = new THREE.Box3().setFromObject(mesh);
        const height = box.max.y - box.min.y;

        // Sanity check: If shirt is microscopic or gigantic, normalize it to ~85cm length
        if (height < 0.5 || height > 2.5) {
            const targetHeight = 0.85;
            const scale = targetHeight / height;
            console.log(`[AssetLoader] Normalizing Shirt Scale: ${height.toFixed(2)}m -> ${targetHeight}m (Factor: ${scale.toFixed(4)})`);
            mesh.scale.setScalar(scale);
            mesh.updateMatrixWorld(true);
        }
    }
}