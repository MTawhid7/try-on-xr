// src/domain/services/GeometryProcessor.ts
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ProcessedMesh } from '../types';

export class GeometryProcessor {
    static process(mesh: THREE.Mesh, weldThreshold: number = 0.02): ProcessedMesh {
        const originalGeo = mesh.geometry.clone();
        let geo = originalGeo.clone();

        // Delete attributes that block welding
        if (geo.attributes.uv) geo.deleteAttribute('uv');
        if (geo.attributes.uv2) geo.deleteAttribute('uv2');
        if (geo.attributes.normal) geo.deleteAttribute('normal');
        if (geo.attributes.color) geo.deleteAttribute('color');
        if (geo.attributes.tangent) geo.deleteAttribute('tangent');

        // 1. Weld Vertices
        geo = BufferGeometryUtils.mergeVertices(geo, weldThreshold);

        // 2. Compute Normals (Required for Tangents)
        geo.computeVertexNormals();

        // 3. Recover UVs (Required for Tangents)
        const newPos = geo.attributes.position;
        const oldPos = originalGeo.attributes.position;
        const oldUV = originalGeo.attributes.uv;

        const uvs = new Float32Array(newPos.count * 2);

        if (oldUV) {
            const tempVec = new THREE.Vector3();
            const tempOrig = new THREE.Vector3();

            for (let i = 0; i < newPos.count; i++) {
                tempVec.fromBufferAttribute(newPos, i);
                let minD2 = Infinity;
                let bestIdx = 0;

                for (let j = 0; j < oldPos.count; j++) {
                    tempOrig.fromBufferAttribute(oldPos, j);
                    const d2 = tempVec.distanceToSquared(tempOrig);
                    if (d2 < minD2) {
                        minD2 = d2;
                        bestIdx = j;
                        if (d2 < 0.000001) break;
                    }
                }
                uvs[i * 2] = oldUV.getX(bestIdx);
                uvs[i * 2 + 1] = oldUV.getY(bestIdx);
            }
        }

        // Apply recovered UVs to geometry so computeTangents can use them
        geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

        // 4. Compute Tangents (NEW)
        // This generates the 4th attribute needed for Anisotropy/Normal Mapping
        if (geo.attributes.uv && geo.attributes.normal) {
            geo.computeTangents();
        }

        const indexAttribute = geo.index;
        if (!indexAttribute) throw new Error("Mesh has no index buffer.");

        // Extract Tangents
        const tangents = geo.attributes.tangent
            ? new Float32Array(geo.attributes.tangent.array)
            : new Float32Array(newPos.count * 4); // Fallback empty

        return {
            vertices: new Float32Array(geo.attributes.position.array),
            normals: new Float32Array(geo.attributes.normal.array),
            indices: new Uint32Array(indexAttribute.array),
            uvs: uvs,
            tangents: tangents // Return tangents
        };
    }
}