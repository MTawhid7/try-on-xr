// src/domain/services/asset_loader/ProxyGenerator.ts
import * as THREE from 'three';
import { MeshoptSimplifier } from 'meshoptimizer';
import type { ProcessedMesh } from '../../types';

export class ProxyGenerator {
    // Physics engine budget
    private static readonly GARMENT_BUDGET = 6000;
    private static readonly COLLIDER_BUDGET = 5000;

    static async generateCollider(mesh: THREE.Mesh): Promise<ProcessedMesh> {
        const triCount = (mesh.geometry.index ? mesh.geometry.index.count : mesh.geometry.attributes.position.count) / 3;

        // CONDITIONAL LOGIC:
        // If the mesh is already low-poly enough, DO NOT decimate.
        // This preserves the exact volume and topology of the visual mesh.
        if (triCount <= this.COLLIDER_BUDGET) {
            console.log(`[ProxyGenerator] Collider is efficient (${triCount} tris). Skipping decimation.`);
            return this.extractRaw(mesh);
        }

        console.log(`[ProxyGenerator] Collider is High-Poly (${triCount} tris). Decimating to ~${this.COLLIDER_BUDGET}...`);
        return this.process(mesh, this.COLLIDER_BUDGET, 0.01);
    }

    static async generateGarment(mesh: THREE.Mesh): Promise<ProcessedMesh> {
        const triCount = (mesh.geometry.index ? mesh.geometry.index.count : mesh.geometry.attributes.position.count) / 3;

        if (triCount > this.GARMENT_BUDGET) {
            console.log(`[ProxyGenerator] Garment is High-Poly (${triCount} tris). Decimating to ~${this.GARMENT_BUDGET}...`);
            return this.process(mesh, this.GARMENT_BUDGET, 1e-3);
        } else {
            console.log(`[ProxyGenerator] Garment is Low-Poly (${triCount} tris). Using raw geometry.`);
            return this.extractRaw(mesh);
        }
    }

    private static async process(mesh: THREE.Mesh, targetTriangles: number, errorThreshold: number): Promise<ProcessedMesh> {
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

        // Calculate source triangle count
        const srcTriangles = srcIndices.length / 3;

        let targetIndexCount = Math.floor(targetTriangles * 3);
        const requestedIndexCount = targetTriangles * 3;

        // Safety Clamp
        if (requestedIndexCount > srcIndices.length) {
            targetIndexCount = Math.floor(srcIndices.length * 0.8);
        }

        console.log(`[ProxyGenerator] Decimating: ${srcTriangles} tris -> Target Indices: ${targetIndexCount}`);

        const [simplifiedIndices, _error] = MeshoptSimplifier.simplify(
            srcIndices,
            srcPos,
            3,
            targetIndexCount,
            errorThreshold
        );

        const { indices, vertices } = this.compactMesh(simplifiedIndices, srcPos);

        return {
            vertices,
            indices,
            normals: new Float32Array(vertices.length),
            uvs: new Float32Array(0)
        };
    }

    private static extractRaw(mesh: THREE.Mesh): ProcessedMesh {
        const geo = mesh.geometry;
        const positions = geo.attributes.position.array as Float32Array;
        const indices = geo.index ? (geo.index.array as Uint32Array) : new Uint32Array();
        const uvs = geo.attributes.uv ? (geo.attributes.uv.array as Float32Array) : new Float32Array();
        const normals = geo.attributes.normal ? (geo.attributes.normal.array as Float32Array) : new Float32Array();

        // If no indices exist (unindexed mesh), generate them
        if (indices.length === 0) {
            const count = positions.length / 3;
            const newIndices = new Uint32Array(count);
            for (let i = 0; i < count; i++) newIndices[i] = i;

            return {
                vertices: positions,
                indices: newIndices,
                normals: normals,
                uvs: uvs
            };
        }

        return {
            vertices: positions,
            indices: indices,
            normals: normals,
            uvs: uvs
        };
    }

    private static compactMesh(indices: Uint32Array, sourcePositions: Float32Array) {
        const vertexCount = sourcePositions.length / 3;
        const map = new Int32Array(vertexCount).fill(-1);
        let nextNewIndex = 0;
        const newIndices = new Uint32Array(indices.length);
        const tempVerts = new Float32Array(indices.length * 3);

        for (let i = 0; i < indices.length; i++) {
            const oldIdx = indices[i];
            let newIdx = map[oldIdx];
            if (newIdx === -1) {
                newIdx = nextNewIndex;
                map[oldIdx] = newIdx;
                tempVerts[newIdx * 3] = sourcePositions[oldIdx * 3];
                tempVerts[newIdx * 3 + 1] = sourcePositions[oldIdx * 3 + 1];
                tempVerts[newIdx * 3 + 2] = sourcePositions[oldIdx * 3 + 2];
                nextNewIndex++;
            }
            newIndices[i] = newIdx;
        }
        return { indices: newIndices, vertices: tempVerts.slice(0, nextNewIndex * 3) };
    }
}