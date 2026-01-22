// src/domain/services/AutoAligner.ts
import * as THREE from 'three';
import { MeshAnalyzer } from './MeshAnalyzer';

export class AutoAligner {
    static alignBody(geometry: THREE.BufferGeometry): THREE.Box3 {
        // 1. Analyze (Regression)
        const anchors = MeshAnalyzer.analyzeBody(geometry);

        // 2. Center the PELVIS on (0,0,0)
        // This ensures the body's mass is centered on the stage.
        const offsetX = -anchors.pelvisCenter.x;
        const offsetZ = -anchors.pelvisCenter.y;

        geometry.computeBoundingBox();
        const box = geometry.boundingBox!;
        const offsetY = -box.min.y;

        geometry.translate(offsetX, offsetY, offsetZ);
        geometry.computeBoundingBox();
        return geometry.boundingBox!;
    }

    static alignGarmentToBody(garmentGeo: THREE.BufferGeometry, bodyGeo: THREE.BufferGeometry) {
        const anchors = MeshAnalyzer.analyzeBody(bodyGeo);

        garmentGeo.computeBoundingBox();
        const gBox = garmentGeo.boundingBox!;

        const shirtTopY = gBox.max.y;
        const shirtCenterX = (gBox.min.x + gBox.max.x) / 2;
        const shirtCenterZ = (gBox.min.z + gBox.max.z) / 2;

        // X/Z: Align Shirt Center to Body NECK Center (Regression)
        const moveX = anchors.neckCenter.x - shirtCenterX;
        const moveZ = anchors.neckCenter.y - shirtCenterZ;

        // Y: Align Shirt Top to Body Neck (+2cm)
        const moveY = (anchors.neckY - shirtTopY) + 0.02;

        garmentGeo.translate(moveX, moveY, moveZ);

        garmentGeo.computeBoundingBox();
        garmentGeo.computeBoundingSphere();
    }
}