// src/domain/services/AssetLoader.ts
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptSimplifier } from 'meshoptimizer';
import { GeometryProcessor } from './GeometryProcessor';
import { AutoAligner } from './AutoAligner';
import type { SimulationAssets, ProcessedMesh } from '../types';

export class AssetLoader {
    private loader: GLTFLoader;

    constructor() {
        this.loader = new GLTFLoader();
    }

    public async loadSceneAssets(): Promise<SimulationAssets> {
        console.log("[AssetLoader] Starting asset loading...");

        // 1. Load Raw GLBs
        const [shirtMesh, rawBodyMesh] = await Promise.all([
            this.loadMesh('/models/shirt.glb', 'Garment'),
            this.loadMesh('/models/mannequin.glb', 'Body')
        ]);

        console.log("[AssetLoader] Auto-Aligning meshes...");

        // 2. Align Body
        const bodyBox = AutoAligner.alignBody(rawBodyMesh.geometry);

        // 3. Align Shirt to Body
        AutoAligner.alignGarmentToBody(shirtMesh.geometry, bodyBox);

        console.log("[AssetLoader] Processing geometries...");

        // 4. Process Garment (Weld)
        const garmentProcessed = GeometryProcessor.process(shirtMesh, 0.01);

        // 5. Generate Physics Proxy (Decimate + Compact)
        const colliderProcessed = await this.generateProxy(rawBodyMesh, 5000);

        console.log(`[AssetLoader] Assets Ready.
            Garment: ${garmentProcessed.vertices.length / 3} verts.
            Collider: ${colliderProcessed.vertices.length / 3} verts.`);

        return {
            garment: garmentProcessed,
            collider: colliderProcessed
        };
    }

    private async generateProxy(mesh: THREE.Mesh, targetTriangles: number): Promise<ProcessedMesh> {
        await MeshoptSimplifier.ready;

        const srcGeo = mesh.geometry;
        const srcPos = srcGeo.attributes.position.array as Float32Array;

        let srcIndices: Uint32Array;
        if (srcGeo.index) {
            srcIndices = srcGeo.index.array as Uint32Array;
        } else {
            const count = srcPos.length / 3;
            srcIndices = new Uint32Array(count);
            for (let i = 0; i < count; i++) srcIndices[i] = i;
        }

        const srcTriangles = srcIndices.length / 3;

        // FIX: The API expects the Target Index Count (Integer), NOT a Ratio (Float).
        // Passing a float < 1.0 results in 0, triggering the assertion failure.
        const targetIndexCount = targetTriangles * 3;

        console.log(`[AssetLoader] Decimating: ${srcTriangles} tris -> Target Indices: ${targetIndexCount}`);

        const [simplifiedIndices, _error] = MeshoptSimplifier.simplify(
            srcIndices,
            srcPos,
            3, // stride
            targetIndexCount, // Corrected argument
            0.01 // error threshold
        );

        // Compact the mesh to remove unused vertices
        const { indices: compactIndices, vertices: compactVertices } = this.compactMesh(simplifiedIndices, srcPos);

        return {
            vertices: compactVertices,
            indices: compactIndices,
            // Normals will be calculated in Rust after smoothing
            normals: new Float32Array(compactVertices.length),
            uvs: new Float32Array(0)
        };
    }

    /**
     * Creates a new vertex buffer containing only the vertices referenced by the indices.
     * Remaps indices to point to the new buffer.
     */
    private compactMesh(indices: Uint32Array, sourcePositions: Float32Array) {
        const vertexCount = sourcePositions.length / 3;
        // Map from Old Index -> New Index (initialized to -1)
        const map = new Int32Array(vertexCount).fill(-1);

        let nextNewIndex = 0;

        const newIndices = new Uint32Array(indices.length);
        // Temp array for vertices, max possible size is indices.length vertices
        const tempVerts = new Float32Array(indices.length * 3);

        for (let i = 0; i < indices.length; i++) {
            const oldIdx = indices[i];
            let newIdx = map[oldIdx];

            if (newIdx === -1) {
                newIdx = nextNewIndex;
                map[oldIdx] = newIdx;

                // Copy Position
                tempVerts[newIdx * 3] = sourcePositions[oldIdx * 3];
                tempVerts[newIdx * 3 + 1] = sourcePositions[oldIdx * 3 + 1];
                tempVerts[newIdx * 3 + 2] = sourcePositions[oldIdx * 3 + 2];

                nextNewIndex++;
            }

            newIndices[i] = newIdx;
        }

        // Slice the vertex buffer to the actual size
        const finalVerts = tempVerts.slice(0, nextNewIndex * 3);

        return { indices: newIndices, vertices: finalVerts };
    }

    private loadMesh(url: string, name: string): Promise<THREE.Mesh> {
        return new Promise((resolve, reject) => {
            this.loader.load(
                url,
                (gltf) => {
                    const foundMesh = gltf.scene.getObjectByProperty('isMesh', true) as THREE.Mesh | undefined;
                    if (foundMesh) {
                        gltf.scene.updateMatrixWorld(true);
                        const geometry = foundMesh.geometry.clone();
                        geometry.applyMatrix4(foundMesh.matrixWorld);
                        resolve(new THREE.Mesh(geometry));
                    } else {
                        reject(new Error(`No mesh found in ${name}`));
                    }
                },
                undefined,
                (error) => reject(error)
            );
        });
    }
}