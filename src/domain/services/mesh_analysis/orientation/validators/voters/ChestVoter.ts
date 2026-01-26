// src/domain/services/mesh_analysis/orientation/validators/voters/ChestVoter.ts
import * as THREE from 'three';
import { ValidationUtils } from '../../ValidationUtils';

export class ChestVoter {
    static vote(geometry: THREE.BufferGeometry, box: THREE.Box3): { forward: number, backward: number } {
        const height = box.max.y - box.min.y;

        // Chest Slice: 65% - 75%
        const chestMinY = box.min.y + (height * 0.65);
        const chestMaxY = box.min.y + (height * 0.75);

        const data = ValidationUtils.getSliceCentroidAndBounds(geometry, chestMinY, chestMaxY);

        if (!data) return { forward: 0, backward: 0 };

        const geoCenterZ = (data.minZ + data.maxZ) / 2;
        const massCenterZ = data.centroidZ;

        // If Mass is > Geometric Center, volume is biased to +Z (Front)
        const bias = massCenterZ - geoCenterZ;
        console.log(`   [Chest] Bias=${bias.toFixed(4)}`);

        if (bias > 0.005) return { forward: 1, backward: 0 };
        if (bias < -0.005) return { forward: 0, backward: 1 };

        return { forward: 0, backward: 0 };
    }
}