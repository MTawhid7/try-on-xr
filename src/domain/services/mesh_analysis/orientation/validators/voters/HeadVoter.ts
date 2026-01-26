// src/domain/services/mesh_analysis/orientation/validators/voters/HeadVoter.ts
import * as THREE from 'three';
import { ValidationUtils } from '../../ValidationUtils';

export class HeadVoter {
    static vote(geometry: THREE.BufferGeometry, box: THREE.Box3, coreZ: number): { forward: number, backward: number } {
        const height = box.max.y - box.min.y;

        // Head Slice: Top 12%
        const headMinY = box.min.y + (height * 0.88);
        const headMaxY = box.max.y;

        const extremes = ValidationUtils.getZExtremesInSlice(geometry, headMinY, headMaxY);

        if (!extremes) return { forward: 0, backward: 0 };

        const distPlus = Math.abs(extremes.max - coreZ);  // Potential Nose
        const distMinus = Math.abs(coreZ - extremes.min); // Back of head

        console.log(`   [Head] +Z=${distPlus.toFixed(3)}, -Z=${distMinus.toFixed(3)}`);

        // Nose sticks out significantly more than back of head
        if (distPlus > distMinus * 1.1) return { forward: 2, backward: 0 };
        if (distMinus > distPlus * 1.1) return { forward: 0, backward: 2 };

        return { forward: 0, backward: 0 };
    }
}