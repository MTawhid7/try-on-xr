// src/application/pipelines/GradingPipeline.ts

import * as THREE from 'three';
import { SHIRT_STANDARDS } from '../../core/constants/SizingStandards';
import type { ShirtSize } from '../../core/entities/Garment';
import { MeshMeasurer } from '../../infrastructure/geometry/analysis/MeshMeasurer';
import type { ProcessedMesh } from '../../core/entities/Geometry';

export class GradingPipeline {
    /**
     * Applies sizing logic to a garment mesh.
     *
     * @param baseMesh - The original, unscaled garment mesh (ProcessedMesh).
     * @param targetSize - The desired shirt size (XS - XXL).
     * @returns An object containing the scaled vertices and the physics scale factor.
     */
    static execute(baseMesh: ProcessedMesh, targetSize: ShirtSize): { vertices: Float32Array, scaleFactor: number } {
        // 1. Reconstruct a temporary THREE.Mesh to measure dimensions
        // We do this to reuse the robust bounding box logic in MeshMeasurer.
        // Since ProcessedMesh is just arrays, we wrap it briefly.
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(baseMesh.vertices, 3));
        const tempMesh = new THREE.Mesh(geometry);

        // 2. Measure the Base Mesh
        const rawDimensions = MeshMeasurer.measure(tempMesh);

        // 3. Calculate Scale Factors
        const target = SHIRT_STANDARDS[targetSize];

        // Scale = Target / Raw
        const scaleX = target.chestWidth / rawDimensions.width;
        const scaleY = target.bodyLength / rawDimensions.length;

        // Z (Depth) scales with Width (Chest) to maintain aspect ratio
        const scaleZ = scaleX;

        console.log(`[GradingPipeline] Applying Size ${targetSize}: Scale X/Z=${scaleX.toFixed(3)}, Y=${scaleY.toFixed(3)}`);

        // 4. Apply Scaling to Vertices
        const count = baseMesh.vertices.length;
        const scaledVertices = new Float32Array(count);

        // Find Max Y (Neck) to use as the pivot point
        // We scale length *downwards* from the neck, rather than from the center.
        let maxY = -Infinity;
        for (let i = 1; i < count; i += 3) {
            if (baseMesh.vertices[i] > maxY) maxY = baseMesh.vertices[i];
        }

        for (let i = 0; i < count; i += 3) {
            const x = baseMesh.vertices[i];
            const y = baseMesh.vertices[i + 1];
            const z = baseMesh.vertices[i + 2];

            // Scale Width/Depth from Center (0,0)
            scaledVertices[i] = x * scaleX;
            scaledVertices[i + 2] = z * scaleZ;

            // Scale Height from Top (Neck)
            // NewY = PivotY + (OldY - PivotY) * ScaleY
            scaledVertices[i + 1] = maxY + (y - maxY) * scaleY;
        }

        // 5. Calculate Physics Scale Factor
        // This is passed to the physics engine to tune compliance/stiffness.
        // A larger shirt is heavier and floppier; this factor helps compensate.
        const physicsScale = (scaleX + scaleY) / 2;

        return { vertices: scaledVertices, scaleFactor: physicsScale };
    }
}