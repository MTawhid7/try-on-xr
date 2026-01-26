// src/domain/services/mesh_analysis/orientation/OrientationOptimizer.ts
import * as THREE from 'three';
// FIX: Import from sibling files directly
import { PCASolver } from './PCASolver';
import { TopologyValidator } from './TopologyValidator';

export class OrientationOptimizer {
    static alignAxes(mesh: THREE.Mesh) {
        const geometry = mesh.geometry;
        console.log(`[OrientationOptimizer] Aligning Axes for ${mesh.name}...`);

        // 1. Vertical (Spine -> Y)
        const centroid = PCASolver.computeCentroid(geometry);
        const axisY = PCASolver.computePrincipalAxis(geometry, centroid);
        const targetY = new THREE.Vector3(0, 1, 0);
        const quatY = new THREE.Quaternion().setFromUnitVectors(axisY, targetY);
        this.applyRotation(geometry, centroid, quatY);

        // 2. Horizontal (Shoulders -> X)
        const centroid2 = PCASolver.computeCentroid(geometry);
        const axisX = PCASolver.computePrincipalAxisXZ(geometry, centroid2);
        const targetX = new THREE.Vector3(1, 0, 0);
        const quatX = new THREE.Quaternion().setFromUnitVectors(axisX, targetX);
        this.applyRotation(geometry, centroid2, quatX);
    }

    static validateOrientation(mesh: THREE.Mesh) {
        console.log(`[OrientationOptimizer] Validating Orientation for ${mesh.name}...`);
        // 1. Check Up/Down
        TopologyValidator.validateUpDirection(mesh.geometry);
        // 2. Check Front/Back
        TopologyValidator.validateFrontDirection(mesh.geometry);
    }

    private static applyRotation(geometry: THREE.BufferGeometry, center: THREE.Vector3, q: THREE.Quaternion) {
        geometry.translate(-center.x, -center.y, -center.z);
        geometry.applyQuaternion(q);
        geometry.translate(center.x, center.y, center.z);
        geometry.computeBoundingBox();
    }
}