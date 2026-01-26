// src/domain/services/mesh_analysis/orientation/validators/voters/FeetVoter.ts
import * as THREE from 'three';
import { ValidationUtils } from '../../ValidationUtils';

export class FeetVoter {
    static vote(geometry: THREE.BufferGeometry, box: THREE.Box3, coreZ: number): { forward: number, backward: number } {
        const height = box.max.y - box.min.y;

        // Feet Slice: Bottom 5%
        const feetMinY = box.min.y;
        const feetMaxY = box.min.y + (height * 0.05);

        const extremes = ValidationUtils.getZExtremesInSlice(geometry, feetMinY, feetMaxY);

        if (!extremes) return { forward: 0, backward: 0 };

        const distPlus = Math.abs(extremes.max - coreZ);
        const distMinus = Math.abs(coreZ - extremes.min);

        console.log(`   [Feet] +Z=${distPlus.toFixed(3)}, -Z=${distMinus.toFixed(3)}`);

        // Toes stick out forward
        if (distPlus > distMinus * 1.2) return { forward: 1, backward: 0 };
        if (distMinus > distPlus * 1.2) return { forward: 0, backward: 1 };

        return { forward: 0, backward: 0 };
    }
}