// src/domain/services/mesh_analysis/orientation/validators/ForwardValidator.ts
import * as THREE from 'three';
import { ValidationUtils } from '../ValidationUtils';
import { HeadVoter } from './voters/HeadVoter';
import { FeetVoter } from './voters/FeetVoter';
import { ChestVoter } from './voters/ChestVoter';

export class ForwardValidator {
    static validate(geometry: THREE.BufferGeometry) {
        geometry.computeBoundingBox();
        const box = geometry.boundingBox!;
        const height = box.max.y - box.min.y;

        const coreZ = ValidationUtils.getCoreZ(geometry, box.min.y, height);
        console.log(`[ForwardValidator] Validating Front/Back (Core Z: ${coreZ.toFixed(3)})...`);

        let forwardScore = 0;
        let backwardScore = 0;

        // 1. Head Vote (Weight: 2)
        const headVote = HeadVoter.vote(geometry, box, coreZ);
        forwardScore += headVote.forward;
        backwardScore += headVote.backward;

        // 2. Feet Vote (Weight: 1)
        const feetVote = FeetVoter.vote(geometry, box, coreZ);
        forwardScore += feetVote.forward;
        backwardScore += feetVote.backward;

        // 3. Chest Vote (Weight: 1)
        const chestVote = ChestVoter.vote(geometry, box);
        forwardScore += chestVote.forward;
        backwardScore += chestVote.backward;

        console.log(`[ForwardValidator] Final Score - Forward: ${forwardScore}, Backward: ${backwardScore}`);

        if (backwardScore > forwardScore) {
            console.log(" -> BACKWARDS DETECTED. Rotating Y 180°.");
            ValidationUtils.rotateGeometry(geometry, 'y', Math.PI);
        } else {
            console.log(" -> Orientation Correct.");
        }
    }
}