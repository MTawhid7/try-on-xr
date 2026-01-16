// src/domain/services/GeometryProcessor.ts
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ProcessedMesh } from '../types';

export class GeometryProcessor {
    static process(mesh: THREE.Mesh, weldThreshold: number = 0.01): ProcessedMesh {
        // 1. Clone geometry
        let geo = mesh.geometry.clone();

        // 2. AGGRESSIVE CLEANUP
        // We delete EVERYTHING except position.
        // This forces Three.js to treat vertices at the same location as identical,
        // regardless of UVs, Normals, or Colors.
        if (geo.attributes.uv) geo.deleteAttribute('uv');
        if (geo.attributes.uv2) geo.deleteAttribute('uv2');
        if (geo.attributes.normal) geo.deleteAttribute('normal'); // Delete normals before welding!
        if (geo.attributes.color) geo.deleteAttribute('color');
        if (geo.attributes.tangent) geo.deleteAttribute('tangent');

        // 3. Weld Vertices
        // Now that attributes are gone, this merge is purely positional.
        geo = BufferGeometryUtils.mergeVertices(geo, weldThreshold);

        // 4. Recompute Normals (Required for the Physics Collider smoothing)
        geo.computeVertexNormals();

        // 5. Check Connectivity (Debug)
        // If indices count is effectively same as vertex count, welding failed.
        const posCount = geo.attributes.position.count;
        console.log(`[GeometryProcessor] Processed: ${posCount} vertices.`);

        const indexAttribute = geo.index;
        if (!indexAttribute) throw new Error("Mesh has no index buffer.");

        return {
            vertices: new Float32Array(geo.attributes.position.array),
            normals: new Float32Array(geo.attributes.normal.array),
            indices: new Uint32Array(indexAttribute.array)
        };
    }
}