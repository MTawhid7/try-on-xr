// src/domain/services/asset_loader/PoseNormalizer.ts
import * as THREE from 'three';

export class PoseNormalizer {
    static normalize(mesh: THREE.Mesh) {
        const geometry = mesh.geometry;
        geometry.computeBoundingBox();
        const box = geometry.boundingBox!;

        // Center the mesh on X/Z first to make symmetry math easier
        const centerX = (box.min.x + box.max.x) / 2;
        const centerZ = (box.min.z + box.max.z) / 2;
        const bottomY = box.min.y;

        geometry.translate(-centerX, -bottomY, -centerZ);

        // --- PHASE 1: FORWARD LEAN CORRECTION (Pitch) ---
        // We still use the "Cylinder" logic for forward lean because symmetry doesn't help with pitch.
        // We use the robust median logic inline here for simplicity.
        const pos = geometry.attributes.position;
        const count = pos.count;
        const height = box.max.y - box.min.y;

        // Collect Z-values for Neck and Pelvis
        const neckY = height * 0.87;
        const pelvisY = height * 0.50;
        const tolerance = height * 0.05;

        const neckZs: number[] = [];
        const pelvisZs: number[] = [];

        for (let i = 0; i < count; i++) {
            const y = pos.getY(i);
            if (Math.abs(y - neckY) < tolerance) neckZs.push(pos.getZ(i));
            if (Math.abs(y - pelvisY) < tolerance) pelvisZs.push(pos.getZ(i));
        }

        const getMedian = (arr: number[]) => {
            if (arr.length === 0) return 0;
            arr.sort((a, b) => a - b);
            return arr[Math.floor(arr.length / 2)];
        };

        const neckZ = getMedian(neckZs);
        const pelvisZ = getMedian(pelvisZs);

        // Calculate Pitch Angle
        const pitchAngle = Math.atan2(neckZ - pelvisZ, neckY - pelvisY);

        // Apply Pitch Correction
        if (Math.abs(pitchAngle) > THREE.MathUtils.degToRad(2)) {
            geometry.rotateX(-pitchAngle);
            console.log(`[PoseNormalizer] Corrected Pitch: ${THREE.MathUtils.radToDeg(pitchAngle).toFixed(2)}°`);
        }

        // --- PHASE 2: LATERAL LEAN CORRECTION (Roll) - SYMMETRY OPTIMIZER ---
        // We test rotations from -10 to +10 degrees to find best symmetry.

        // Sample vertices for speed (use every 10th vertex)
        const samples: THREE.Vector3[] = [];
        for (let i = 0; i < count; i += 10) {
            samples.push(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)));
        }

        let bestAngle = 0;
        let minScore = Infinity;

        // Search Range: -10 to +10 degrees
        for (let angle = -10; angle <= 10; angle += 0.5) {
            const rad = THREE.MathUtils.degToRad(angle);
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);

            let score = 0;

            // Rotate sample point and check symmetry
            // We want to minimize: |X_rotated + X_mirror|
            // Ideally if X=5, Mirror should be X=-5. Sum = 0.
            // But since we don't have perfect pairs, we look for density balance.
            // Simpler Metric: Sum of X coordinates.
            // If symmetric, Sum(X) should be close to 0 (assuming centered).
            // BUT, if one arm is up, Sum(X) is biased.

            // Better Metric: Histogram Overlap.
            // We bin X coordinates. The distribution of X should be mirror of -X.
            // Let's use a simpler heuristic: The "Spine Line" should be at X=0.
            // We calculate the average X of the central slice (ignoring arms).

            let sumX = 0;
            let sliceCount = 0;

            for (const p of samples) {
                // Apply rotation (2D rotation in XY plane)
                const x = p.x * cos - p.y * sin;
                const y = p.x * sin + p.y * cos;

                // Only look at the torso core (height 40-80%, width inner 30%)
                // This filters out the asymmetric arms/legs.
                if (y > height * 0.4 && y < height * 0.8) {
                    // Check if it's "central" enough to be torso
                    // We can't check width easily after rotation, so we check original Z?
                    // Let's just sum X. If the torso is upright, the average X of the torso block is 0.
                    // If it leans right, the top is +X, bottom is -X (or vice versa).
                    // Actually, if it leans, the average X *shifts* as Y increases.
                    // We want the Covariance of X and Y to be 0.

                    sumX += x;
                    sliceCount++;
                }
            }

            // If we just center X, we fix translation. We want to fix Rotation.
            // We want Covariance(X, Y) to be 0.
            // i.e. X should not correlate with Y.

            let meanX = sumX / sliceCount;
            let covariance = 0;

            for (const p of samples) {
                const x = p.x * cos - p.y * sin;
                const y = p.x * sin + p.y * cos;

                if (y > height * 0.4 && y < height * 0.8) {
                    covariance += (x - meanX) * (y - (height * 0.6)); // approx mean Y
                }
            }

            if (Math.abs(covariance) < minScore) {
                minScore = Math.abs(covariance);
                bestAngle = rad;
            }
        }

        // Apply Roll Correction
        if (Math.abs(bestAngle) > THREE.MathUtils.degToRad(0.5)) {
            geometry.rotateZ(-bestAngle); // Rotate Z to fix XY lean
            console.log(`[PoseNormalizer] Corrected Roll: ${THREE.MathUtils.radToDeg(bestAngle).toFixed(2)}°`);
        }

        // Restore Position (Move back to original bounding box center, but keep upright)
        // Actually, AssetLoader expects it centered on floor.
        geometry.computeBoundingBox();
        const newBox = geometry.boundingBox!;
        const newCenterX = (newBox.min.x + newBox.max.x) / 2;
        const newBottomY = newBox.min.y;
        const newCenterZ = (newBox.min.z + newBox.max.z) / 2;

        geometry.translate(-newCenterX, -newBottomY, -newCenterZ);

        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
    }
}