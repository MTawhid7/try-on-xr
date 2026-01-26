// src/domain/services/mesh_analysis/orientation/TopologyValidator.ts
import * as THREE from 'three';
import { VerticalValidator } from './validators/VerticalValidator';
import { ForwardValidator } from './validators/ForwardValidator';

export class TopologyValidator {

    static validateUpDirection(geometry: THREE.BufferGeometry) {
        VerticalValidator.validate(geometry);
    }

    static validateFrontDirection(geometry: THREE.BufferGeometry) {
        ForwardValidator.validate(geometry);
    }
}