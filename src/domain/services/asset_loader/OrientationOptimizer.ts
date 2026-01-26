// src/domain/services/asset_loader/OrientationOptimizer.ts
import * as THREE from 'three';
import { SliceAnalyzer } from '../mesh_analysis/SliceAnalyzer';

export class OrientationOptimizer {
    /**
     * Uses Principal Component Analysis (PCA) to find the major axis of the body
     * and aligns it to the Global Y (Up) axis.
     * This handles leaning, lying down, and arbitrary rotations in one step.
     */
    static alignToUpright(mesh: THREE.Mesh) {
        const geometry = mesh.geometry;
        const pos = geometry.attributes.position;

        console.log(`[OrientationOptimizer] Aligning ${mesh.name} using PCA...`);

        // 1. Compute Centroid
        const centroid = new THREE.Vector3();
        let count = 0;
        const stride = 5; // Sample every 5th vertex for speed

        for (let i = 0; i < pos.count; i += stride) {
            centroid.x += pos.getX(i);
            centroid.y += pos.getY(i);
            centroid.z += pos.getZ(i);
            count++;
        }
        centroid.divideScalar(count);

        // 2. Compute Covariance Matrix (3x3) relative to Centroid
        // [ xx xy xz ]
        // [ yx yy yz ]
        // [ zx zy zz ]
        let xx = 0, xy = 0, xz = 0, yy = 0, yz = 0, zz = 0;

        for (let i = 0; i < pos.count; i += stride) {
            const x = pos.getX(i) - centroid.x;
            const y = pos.getY(i) - centroid.y;
            const z = pos.getZ(i) - centroid.z;

            xx += x * x;
            xy += x * y;
            xz += x * z;
            yy += y * y;
            yz += y * z;
            zz += z * z;
        }

        // 3. Power Iteration to find Dominant Eigenvector (Primary Axis)
        // This vector represents the direction of the Spine/Body.
        let v = new THREE.Vector3(1, 1, 1).normalize();

        // 10 iterations is usually sufficient for convergence on a 3x3 matrix
        for (let iter = 0; iter < 10; iter++) {
            const next = new THREE.Vector3(
                v.x * xx + v.y * xy + v.z * xz,
                v.x * xy + v.y * yy + v.z * yz,
                v.x * xz + v.y * yz + v.z * zz
            );
            v = next.normalize();
        }

        console.log(` -> Primary Axis detected: [${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)}]`);

        // 4. Align Primary Axis to Global Y (0, 1, 0)
        const target = new THREE.Vector3(0, 1, 0);
        const quaternion = new THREE.Quaternion().setFromUnitVectors(v, target);

        // Apply rotation to geometry (pivoting around centroid to keep it in place)
        geometry.translate(-centroid.x, -centroid.y, -centroid.z);
        geometry.applyQuaternion(quaternion);
        geometry.translate(centroid.x, centroid.y, centroid.z);
        geometry.computeBoundingBox();

        // 5. Check Up/Down Direction (Ambiguity Resolution)
        // PCA vector direction is ambiguous (could be Head->Feet or Feet->Head).
        // We use the "Islands" heuristic: Head (1 mass) vs Feet (2 masses).
        const box = geometry.boundingBox!;
        const height = box.max.y - box.min.y;

        // Analyze Top 10% vs Bottom 10%
        const topIslands = SliceAnalyzer.getIslandsInSlice(geometry, box.max.y - height * 0.1, box.max.y);
        const bottomIslands = SliceAnalyzer.getIslandsInSlice(geometry, box.min.y, box.min.y + height * 0.1);

        console.log(` -> Topology Check: Top Islands=${topIslands.length}, Bottom Islands=${bottomIslands.length}`);

        // If Top has more islands (Feet) or Top=2/Bottom=1, it's upside down.
        if (topIslands.length > bottomIslands.length || (topIslands.length >= 2 && bottomIslands.length === 1)) {
            console.log(" -> Upside Down Detected. Flipping 180°.");
            geometry.translate(-centroid.x, -centroid.y, -centroid.z);
            geometry.rotateZ(Math.PI); // Flip around Z axis
            geometry.translate(centroid.x, centroid.y, centroid.z);
            geometry.computeBoundingBox();
        }
    }
}