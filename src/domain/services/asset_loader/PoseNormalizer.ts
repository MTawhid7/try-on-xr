// src/domain/services/asset_loader/PoseNormalizer.ts
import * as THREE from 'three';
import { MeshAnalyzer } from '../MeshAnalyzer';

export class PoseNormalizer {
    static normalize(mesh: THREE.Mesh) {
        const geometry = mesh.geometry;

        // 1. Analyze
        const anchors = MeshAnalyzer.analyzeBody(geometry);

        // 2. Fix Upside Down
        if (anchors.isUpsideDown) {
            console.log("[PoseNormalizer] Flipping Upside Down Mesh...");
            geometry.rotateZ(Math.PI); // Flip 180
            geometry.computeBoundingBox();
            // Re-analyze after flip
            const newAnchors = MeshAnalyzer.analyzeBody(geometry);
            Object.assign(anchors, newAnchors);
        }

        // 3. Construct Spine Vector (Pelvis -> Neck)
        const currentSpineVector = new THREE.Vector3(
            anchors.neckCenter.x - anchors.pelvisCenter.x,
            anchors.neckY - (geometry.boundingBox!.min.y + (geometry.boundingBox!.max.y - geometry.boundingBox!.min.y) * 0.50),
            anchors.neckCenter.y - anchors.pelvisCenter.y
        ).normalize();

        const targetVector = new THREE.Vector3(0, 1, 0);
        const quaternion = new THREE.Quaternion();
        quaternion.setFromUnitVectors(currentSpineVector, targetVector);

        geometry.computeBoundingBox();
        const height = geometry.boundingBox!.max.y - geometry.boundingBox!.min.y;
        const pivotY = geometry.boundingBox!.min.y + (height * 0.70);
        const pivot = new THREE.Vector3(anchors.spineCenter.x, pivotY, anchors.spineCenter.y);

        geometry.translate(-pivot.x, -pivot.y, -pivot.z);
        geometry.applyQuaternion(quaternion);
        geometry.translate(pivot.x, pivot.y, pivot.z);

        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
    }
}