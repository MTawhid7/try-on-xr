// src/domain/services/mesh_analysis/OrientationDetector.ts
import * as THREE from 'three';
import { SliceAnalyzer } from './SliceAnalyzer';

export class OrientationDetector {
    static isUpsideDown(geometry: THREE.BufferGeometry, box: THREE.Box3): boolean {
        const height = box.max.y - box.min.y;

        // Analyze Top 5% (Head?)
        const topIslands = SliceAnalyzer.getIslandsInSlice(
            geometry,
            box.max.y - (height * 0.05),
            box.max.y
        );

        // Analyze Bottom 5% (Feet?)
        const bottomIslands = SliceAnalyzer.getIslandsInSlice(
            geometry,
            box.min.y,
            box.min.y + (height * 0.05)
        );

        const topCount = topIslands.length;
        const bottomCount = bottomIslands.length;

        console.log(`[OrientationDetector] Top Islands: ${topCount}, Bottom Islands: ${bottomCount}`);

        // Heuristic:
        // Normal: Top=1 (Head), Bottom=2 (Feet)
        // Upside Down: Top=2 (Feet), Bottom=1 (Head)
        if (topCount >= 2 && bottomCount === 1) {
            return true;
        }

        return false;
    }
}