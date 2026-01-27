// src/domain/services/GarmentGrading.ts
import * as THREE from 'three';
import { SHIRT_STANDARDS, type ShirtSize } from '../config/SizingStandards';
import { MeshMeasurer } from './MeshMeasurer';

export class GarmentGrading {
    // Store the raw dimensions of the loaded asset
    private static rawDimensions: { width: number, length: number } | null = null;

    static setBaseMesh(mesh: THREE.Mesh) {
        this.rawDimensions = MeshMeasurer.measure(mesh);
        console.log(`[GarmentGrading] Raw Dimensions: Width ${this.rawDimensions.width.toFixed(1)}cm, Length ${this.rawDimensions.length.toFixed(1)}cm`);
    }

    static getScales(targetSize: ShirtSize): THREE.Vector3 {
        // Default to 1.0 if not measured yet
        if (!this.rawDimensions) return new THREE.Vector3(1, 1, 1);

        const target = SHIRT_STANDARDS[targetSize];

        // Calculate Scale = Target / Raw
        const scaleX = target.chestWidth / this.rawDimensions.width;
        const scaleY = target.bodyLength / this.rawDimensions.length;

        // Z (Depth) scales with Width (Chest)
        const scaleZ = scaleX;

        return new THREE.Vector3(scaleX, scaleY, scaleZ);
    }

    static applyGrading(originalVertices: Float32Array, size: ShirtSize): { vertices: Float32Array, scaleFactor: number } {
        const scales = this.getScales(size);
        console.log(`[GarmentGrading] Applying Size ${size}: Scale X/Z=${scales.x.toFixed(3)}, Y=${scales.y.toFixed(3)}`);

        const count = originalVertices.length;
        const scaled = new Float32Array(count);

        // Calculate Pivot (Top Center)
        // We assume the mesh is centered on X/Z, so Pivot X/Z = 0.
        // We find Max Y to scale length downwards from the neck.
        let maxY = -Infinity;
        for (let i = 1; i < count; i += 3) {
            if (originalVertices[i] > maxY) maxY = originalVertices[i];
        }

        for (let i = 0; i < count; i += 3) {
            const x = originalVertices[i];
            const y = originalVertices[i + 1];
            const z = originalVertices[i + 2];

            // Scale Width/Depth from Center (0)
            scaled[i] = x * scales.x;
            scaled[i + 2] = z * scales.z;

            // Scale Height from Top (Neck)
            // NewY = PivotY + (OldY - PivotY) * ScaleY
            scaled[i + 1] = maxY + (y - maxY) * scales.y;
        }

        // Average scale factor for Physics Tuning (Mass/Stiffness compensation)
        const physicsScale = (scales.x + scales.y) / 2;

        return { vertices: scaled, scaleFactor: physicsScale };
    }
}