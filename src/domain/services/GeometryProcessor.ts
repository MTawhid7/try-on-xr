// src/domain/services/GeometryProcessor.ts
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ProcessedMesh } from '../types';

export class GeometryProcessor {
    static process(mesh: THREE.Mesh, weldThreshold: number = 0.01): ProcessedMesh {
        // 1. Clone original to keep data safe
        const originalGeo = mesh.geometry.clone();

        // 2. Prepare for Welding
        // We clone again for the operation
        let geo = originalGeo.clone();

        // Delete attributes that block welding, BUT we need to save UVs first
        // Since mergeVertices destroys the index mapping, we can't just save the array.
        // Strategy: We will recover UVs after welding by looking up the nearest vertex
        // in the original mesh.

        if (geo.attributes.uv) geo.deleteAttribute('uv');
        if (geo.attributes.uv2) geo.deleteAttribute('uv2');
        if (geo.attributes.normal) geo.deleteAttribute('normal');
        if (geo.attributes.color) geo.deleteAttribute('color');
        if (geo.attributes.tangent) geo.deleteAttribute('tangent');

        // 3. Weld
        geo = BufferGeometryUtils.mergeVertices(geo, weldThreshold);
        geo.computeVertexNormals();

        // 4. Recover UVs
        // For every vertex in the NEW welded mesh, find the closest vertex in the OLD mesh
        // and copy its UV.
        const newPos = geo.attributes.position;
        const oldPos = originalGeo.attributes.position;
        const oldUV = originalGeo.attributes.uv;

        const uvs = new Float32Array(newPos.count * 2); // 2 floats per vertex

        if (oldUV) {
            // Optimization: Build a spatial map or just brute force?
            // For 2700 verts, brute force is ~7 million checks. Might be slow (100ms).
            // Let's do a simple optimization: Buckets?
            // Actually, let's just do brute force for now, it runs once at load time.

            const tempVec = new THREE.Vector3();
            const tempOrig = new THREE.Vector3();

            for (let i = 0; i < newPos.count; i++) {
                tempVec.fromBufferAttribute(newPos, i);

                let minD2 = Infinity;
                let bestIdx = 0;

                // Search original mesh
                for (let j = 0; j < oldPos.count; j++) {
                    tempOrig.fromBufferAttribute(oldPos, j);
                    const d2 = tempVec.distanceToSquared(tempOrig);
                    if (d2 < minD2) {
                        minD2 = d2;
                        bestIdx = j;
                        if (d2 < 0.000001) break; // Exact match found
                    }
                }

                // Copy UV
                uvs[i * 2] = oldUV.getX(bestIdx);
                uvs[i * 2 + 1] = oldUV.getY(bestIdx);
            }
        }

        const indexAttribute = geo.index;
        if (!indexAttribute) throw new Error("Mesh has no index buffer.");

        return {
            vertices: new Float32Array(geo.attributes.position.array),
            normals: new Float32Array(geo.attributes.normal.array),
            indices: new Uint32Array(indexAttribute.array),
            uvs: uvs // Return recovered UVs
        };
    }
}