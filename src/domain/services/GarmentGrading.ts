// src/domain/services/GarmentGrading.ts
import type { ShirtSize } from '../types';

export class GarmentGrading {
    // UPDATED SCALES: L is now the reference (1.0)
    private static readonly SCALES: Record<ShirtSize, number> = {
        'XXS': 0.84,
        'XS': 0.88,
        'S': 0.92,
        'M': 0.96,
        'L': 1.00, // Base Size (Blender Export)
        'XL': 1.04,
        'XXL': 1.08
    };

    static applyGrading(originalVertices: Float32Array, size: ShirtSize): Float32Array {
        const scale = this.SCALES[size];

        if (scale === 1.0) {
            return new Float32Array(originalVertices);
        }

        const count = originalVertices.length;
        const scaled = new Float32Array(count);

        // 1. Calculate Bounding Box to find Pivot
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

        for (let i = 0; i < count; i += 3) {
            const x = originalVertices[i];
            const y = originalVertices[i + 1];
            const z = originalVertices[i + 2];

            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
            if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
        }

        // 2. Define Pivot Point
        // X/Z: Scale from Center (Symmetrical width)
        const pivotX = (minX + maxX) / 2;
        const pivotZ = (minZ + maxZ) / 2;

        // Y: Scale from TOP (Neck).
        // This ensures the collar stays at the exact same height on the mannequin,
        // while the hem moves up (smaller) or down (larger).
        const pivotY = maxY;

        // 3. Apply Scaling
        for (let i = 0; i < count; i += 3) {
            const x = originalVertices[i];
            const y = originalVertices[i + 1];
            const z = originalVertices[i + 2];

            // New = Pivot + (Old - Pivot) * Scale
            scaled[i] = pivotX + (x - pivotX) * scale;
            scaled[i + 1] = pivotY + (y - pivotY) * scale;
            scaled[i + 2] = pivotZ + (z - pivotZ) * scale;
        }

        return scaled;
    }
}