// src/domain/services/AutoAligner.ts
import * as THREE from 'three';

export class AutoAligner {
    /**
     * Centers the mesh at (0,0,0) on X/Z and places feet at Y=0.
     * Returns the new bounding box.
     */
    static alignBody(geometry: THREE.BufferGeometry): THREE.Box3 {
        geometry.computeBoundingBox();
        const box = geometry.boundingBox!;

        const center = new THREE.Vector3();
        box.getCenter(center);

        // Calculate offsets
        const offsetX = -center.x;
        const offsetZ = -center.z;
        const offsetY = -box.min.y; // Move feet to 0

        // Apply translation
        geometry.translate(offsetX, offsetY, offsetZ);

        // Recompute bounds after move
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();

        return geometry.boundingBox!;
    }

    /**
     * Aligns the garment to the body.
     * 1. Centers X/Z to match the body.
     * 2. Aligns the Top (Collar) to the Body's Neck height.
     */
    static alignGarmentToBody(garmentGeo: THREE.BufferGeometry, bodyBox: THREE.Box3) {
        garmentGeo.computeBoundingBox();
        const gBox = garmentGeo.boundingBox!;
        const gCenter = new THREE.Vector3();
        gBox.getCenter(gCenter);

        // 1. Center X/Z
        const offsetX = -gCenter.x;
        const offsetZ = -gCenter.z;

        // 2. Align Y (Neck Match)
        // Heuristic: The "Neck" is roughly at 86% of the body height.
        // We want the Top of the shirt (gBox.max.y) to match this height.
        const bodyHeight = bodyBox.max.y - bodyBox.min.y;
        const targetNeckY = bodyBox.min.y + (bodyHeight * 0.86);

        // Shift needed to move shirt top to target neck
        const offsetY = targetNeckY - gBox.max.y;

        garmentGeo.translate(offsetX, offsetY, offsetZ);

        garmentGeo.computeBoundingBox();
        garmentGeo.computeBoundingSphere();
    }
}