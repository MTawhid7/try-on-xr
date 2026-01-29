// src/infrastructure/geometry/analysis/MeshAnalyzer.ts

import * as THREE from 'three';
import { OrientationDetector } from './orientation/OrientationDetector';
import { SpineRegressor } from './SpineRegressor';
import type { AnatomicalAnchors } from '../../../core/entities/Geometry';

export class MeshAnalyzer {
    static analyzeBody(geometry: THREE.BufferGeometry): AnatomicalAnchors {
        geometry.computeBoundingBox();
        const box = geometry.boundingBox!;
        const height = box.max.y - box.min.y;

        // 1. Detect Orientation
        const isUpsideDown = OrientationDetector.isUpsideDown(geometry, box);

        // 2. Define Logical Coordinates
        // If upside down, we analyze "backwards" relative to world space
        const logicalMinY = isUpsideDown ? box.max.y : box.min.y;
        const logicalHeight = isUpsideDown ? -height : height;

        // 3. Perform Regression
        const spineData = SpineRegressor.analyze(geometry, logicalMinY, logicalHeight);

        return {
            neckY: logicalMinY + (logicalHeight * 0.87),
            neckCenter: spineData.neckCenter,
            spineCenter: spineData.spineCenter,
            pelvisCenter: spineData.pelvisCenter,
            isUpsideDown
        };
    }
}