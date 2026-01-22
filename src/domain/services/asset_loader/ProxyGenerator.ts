// src/domain/services/asset_loader/ProxyGenerator.ts
import * as THREE from 'three';
import { MeshoptSimplifier } from 'meshoptimizer';
import type { ProcessedMesh } from '../../types';

export class ProxyGenerator {
    static async generate(mesh: THREE.Mesh, targetTriangles: number): Promise<ProcessedMesh> {
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
        const targetIndexCount = Math.floor(targetTriangles * 3);

        console.log(`[ProxyGenerator] Decimating: ${srcTriangles} tris -> Target Indices: ${targetIndexCount}`);

        const [simplifiedIndices, _error] = MeshoptSimplifier.simplify(
            srcIndices,
            srcPos,
            3,
            targetIndexCount,
            0.01
        );

        const { indices: compactIndices, vertices: compactVertices } = this.compactMesh(simplifiedIndices, srcPos);

        return {
            vertices: compactVertices,
            indices: compactIndices,
            normals: new Float32Array(compactVertices.length),
            uvs: new Float32Array(0)
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

        const finalVerts = tempVerts.slice(0, nextNewIndex * 3);
        return { indices: newIndices, vertices: finalVerts };
    }
}