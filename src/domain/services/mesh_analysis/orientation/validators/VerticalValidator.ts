// src/domain/services/mesh_analysis/orientation/validators/VerticalValidator.ts
import * as THREE from 'three';
import { SliceAnalyzer } from '../../slice/SliceAnalyzer';
import { ValidationUtils } from '../ValidationUtils';

export class VerticalValidator {
    static validate(geometry: THREE.BufferGeometry) {
        geometry.computeBoundingBox();
        const box = geometry.boundingBox!;
        const height = box.max.y - box.min.y;

        // Compare Width of Shoulders (Top 20%) vs Ankles (Bottom 20%)
        const topWidth = SliceAnalyzer.getSliceWidth(geometry, box.max.y - height * 0.2, box.max.y);
        const bottomWidth = SliceAnalyzer.getSliceWidth(geometry, box.min.y, box.min.y + height * 0.2);

        if (bottomWidth < 0.05) return;

        if (topWidth < bottomWidth) {
            console.log("[VerticalValidator] Upside Down Detected (Shoulders < Ankles). Flipping 180° on Z.");
            ValidationUtils.rotateGeometry(geometry, 'z', Math.PI);
        }
    }
}