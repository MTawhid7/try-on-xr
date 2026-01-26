// src/domain/services/GeometryProcessor.ts
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ProcessedMesh } from '../types';

export class GeometryProcessor {
    // UPDATED: Default threshold 0.01 -> 0.02
    static process(mesh: THREE.Mesh, weldThreshold: number = 0.02): ProcessedMesh {
        // 1. Clone original to keep data safe
        const originalGeo = mesh.geometry.clone();

        // 2. Prepare for Welding
        let geo = originalGeo.clone();

        // Delete attributes that block welding
        if (geo.attributes.uv) geo.deleteAttribute('uv');
        if (geo.attributes.uv2) geo.deleteAttribute('uv2');
        if (geo.attributes.normal) geo.deleteAttribute('normal');
        if (geo.attributes.color) geo.deleteAttribute('color');
        if (geo.attributes.tangent) geo.deleteAttribute('tangent');

        // 3. Weld
        // This merges vertices within 2cm of each other
        geo = BufferGeometryUtils.mergeVertices(geo, weldThreshold);
        geo.computeVertexNormals();

        // 4. Recover UVs
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

                // Search original mesh for closest vertex to recover UV
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

        const indexAttribute = geo.index;
        if (!indexAttribute) throw new Error("Mesh has no index buffer.");

        return {
            vertices: new Float32Array(geo.attributes.position.array),
            normals: new Float32Array(geo.attributes.normal.array),
            indices: new Uint32Array(indexAttribute.array),
            uvs: uvs
        };
    }
}