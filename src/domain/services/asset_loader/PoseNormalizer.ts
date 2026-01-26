// src/domain/services/asset_loader/PoseNormalizer.ts
import * as THREE from 'three';
import { MeshAnalyzer } from '../MeshAnalyzer';

export class PoseNormalizer {
    static normalize(mesh: THREE.Mesh) {
        const geometry = mesh.geometry;
        const MAX_ITERATIONS = 5;
        const ANGLE_THRESHOLD = 0.5; // Degrees

        console.log(`[PoseNormalizer] Starting Iterative Normalization (Max ${MAX_ITERATIONS} passes)...`);

        for (let i = 0; i < MAX_ITERATIONS; i++) {
            // 1. Analyze current state
            // We must re-compute bounding box every time because the geometry changes
            geometry.computeBoundingBox();
            const anchors = MeshAnalyzer.analyzeBody(geometry);

            // 2. Fix Upside Down (Only needed on first pass usually, but safe to keep)
            if (anchors.isUpsideDown) {
                console.log(" -> Detected Upside Down. Flipping...");
                geometry.rotateZ(Math.PI);
                geometry.computeBoundingBox();
                continue; // Restart analysis after flip
            }

            // 3. Construct Spine Vector (Pelvis -> Neck)
            const spineVector = new THREE.Vector3(
                anchors.neckCenter.x - anchors.pelvisCenter.x,
                anchors.neckY - (geometry.boundingBox!.min.y + (geometry.boundingBox!.max.y - geometry.boundingBox!.min.y) * 0.50),
                anchors.neckCenter.y - anchors.pelvisCenter.y
            ).normalize();

            const targetVector = new THREE.Vector3(0, 1, 0);

            // Calculate deviation
            const angleRad = spineVector.angleTo(targetVector);
            const angleDeg = THREE.MathUtils.radToDeg(angleRad);

            console.log(` -> Pass ${i + 1}: Detected Lean: ${angleDeg.toFixed(2)}°`);

            // 4. Convergence Check
            if (angleDeg < ANGLE_THRESHOLD) {
                console.log(" -> Converged. Stopping.");
                break;
            }

            // 5. Apply Correction
            const quaternion = new THREE.Quaternion();
            quaternion.setFromUnitVectors(spineVector, targetVector);

            // Rotate around the Spine Center (Pivot)
            const height = geometry.boundingBox!.max.y - geometry.boundingBox!.min.y;
            const pivotY = geometry.boundingBox!.min.y + (height * 0.70);
            const pivot = new THREE.Vector3(anchors.spineCenter.x, pivotY, anchors.spineCenter.y);

            geometry.translate(-pivot.x, -pivot.y, -pivot.z);
            geometry.applyQuaternion(quaternion);
            geometry.translate(pivot.x, pivot.y, pivot.z);
        }

        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
    }
}