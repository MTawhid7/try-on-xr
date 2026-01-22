// src/domain/services/asset_loader/PoseNormalizer.ts
import * as THREE from 'three';
import { MeshAnalyzer } from '../MeshAnalyzer';

export class PoseNormalizer {
    static normalize(mesh: THREE.Mesh) {
        const geometry = mesh.geometry;

        // 1. Analyze (Regression)
        const anchors = MeshAnalyzer.analyzeBody(geometry);

        // 2. Construct Spine Vector (Pelvis -> Neck)
        // This vector comes from the "Line of Best Fit" through the ribcage.
        const currentSpineVector = new THREE.Vector3(
            anchors.neckCenter.x - anchors.pelvisCenter.x,
            anchors.neckY - (geometry.boundingBox!.min.y + (geometry.boundingBox!.max.y - geometry.boundingBox!.min.y) * 0.50),
            anchors.neckCenter.y - anchors.pelvisCenter.y
        ).normalize();

        const targetVector = new THREE.Vector3(0, 1, 0);

        // 3. Calculate Rotation
        const quaternion = new THREE.Quaternion();
        quaternion.setFromUnitVectors(currentSpineVector, targetVector);

        // 4. Apply Rotation around the SPINE CENTER (Chest)
        // Rotating around the chest keeps the shirt area stable.
        geometry.computeBoundingBox();
        const height = geometry.boundingBox!.max.y - geometry.boundingBox!.min.y;
        const pivotY = geometry.boundingBox!.min.y + (height * 0.70);
        const pivot = new THREE.Vector3(anchors.spineCenter.x, pivotY, anchors.spineCenter.y);

        geometry.translate(-pivot.x, -pivot.y, -pivot.z);
        geometry.applyQuaternion(quaternion);
        geometry.translate(pivot.x, pivot.y, pivot.z);

        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();

        const angleDeg = THREE.MathUtils.radToDeg(currentSpineVector.angleTo(targetVector));
        console.log(`[PoseNormalizer] Corrected Lean: ${angleDeg.toFixed(2)}°`);
    }
}