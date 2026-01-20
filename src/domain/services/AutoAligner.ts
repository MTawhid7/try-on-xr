// src/domain/services/AutoAligner.ts
import * as THREE from 'three';
import { MeshAnalyzer } from './MeshAnalyzer';

export class AutoAligner {
    /**
     * Centers the body mesh at (0,0,0) on X/Z and places feet at Y=0.
     */
    static alignBody(geometry: THREE.BufferGeometry): THREE.Box3 {
        geometry.computeBoundingBox();
        const box = geometry.boundingBox!;
        const center = new THREE.Vector3();
        box.getCenter(center);

        // 1. Center X (Lateral)
        const offsetX = -center.x;
        // 2. Floor Y (Vertical)
        const offsetY = -box.min.y;
        // 3. Center Z (Depth)
        const offsetZ = -center.z;

        geometry.translate(offsetX, offsetY, offsetZ);

        geometry.computeBoundingBox();
        return geometry.boundingBox!;
    }

    /**
     * Aligns the garment to the body using Anatomical Slicing.
     * This ensures the collar aligns with the neck and the sleeves align with the spine axis,
     * ignoring belly protrusion.
     */
    static alignGarmentToBody(garmentGeo: THREE.BufferGeometry, bodyGeo: THREE.BufferGeometry) {
        // 1. Analyze Body to find Anchors
        const anchors = MeshAnalyzer.analyzeBody(bodyGeo);

        // 2. Analyze Garment (Simple Bounding Box is usually sufficient for T-Pose shirts)
        garmentGeo.computeBoundingBox();
        const gBox = garmentGeo.boundingBox!;

        // Garment Anchors
        const shirtTopY = gBox.max.y;
        const shirtCenterX = (gBox.min.x + gBox.max.x) / 2;
        const shirtCenterZ = (gBox.min.z + gBox.max.z) / 2;

        // 3. Calculate Deltas

        // X: Align Shirt Center to Body Spine Center
        const moveX = anchors.spineCenter.x - shirtCenterX;

        // Y: Align Shirt Top (Collar) to Body Neck
        // We add a small offset (e.g., 2cm) to let the shirt sit slightly above the skin
        const moveY = (anchors.neckY - shirtTopY) + 0.02;

        // Z: Align Shirt Center to Body Spine Center
        // This is the CRITICAL fix. It ignores the belly (which would push Z forward)
        // and aligns to the chest/spine axis.
        const moveZ = anchors.spineCenter.y - shirtCenterZ; // Note: Vector2.y corresponds to 3D Z

        // 4. Apply
        garmentGeo.translate(moveX, moveY, moveZ);

        garmentGeo.computeBoundingBox();
        garmentGeo.computeBoundingSphere();
    }
}