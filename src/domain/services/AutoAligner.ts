// src/domain/services/AutoAligner.ts
import * as THREE from 'three';
import { MeshAnalyzer } from './MeshAnalyzer';

export class AutoAligner {
    static alignBody(geometry: THREE.BufferGeometry): THREE.Box3 {
        // PoseNormalizer already centered it on the floor.
        // We just ensure it's exactly at Y=0.
        geometry.computeBoundingBox();
        const box = geometry.boundingBox!;
        const offsetY = -box.min.y;

        geometry.translate(0, offsetY, 0);
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

        // X/Z: Align to Neck Center (Most stable point after normalization)
        const moveX = anchors.neckCenter.x - shirtCenterX;
        const moveZ = anchors.neckCenter.y - shirtCenterZ;

        // Y: Align to Neck Y
        const moveY = (anchors.neckY - shirtTopY) + 0.02;

        garmentGeo.translate(moveX, moveY, moveZ);

        garmentGeo.computeBoundingBox();
        garmentGeo.computeBoundingSphere();
    }
}