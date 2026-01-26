// src/domain/services/asset_loader/MeshScaler.ts
import * as THREE from 'three';

export class MeshScaler {
    private static readonly TARGET_HEIGHT = 1.75; // Meters

    /**
     * Normalizes the body to a standard height and returns the scale factor used.
     */
    static normalizeBodyScale(mesh: THREE.Mesh): number {
        // 1. Compute current bounding box respecting current transforms (Rotation from fixOrientation)
        mesh.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(mesh);
        const currentHeight = box.max.y - box.min.y;

        // 2. Check for validity
        if (currentHeight < 0.01) {
            console.warn("[MeshScaler] Mesh is infinitesimally small. Skipping scale.");
            return 1.0;
        }

        // 3. Calculate Scale Factor
        const scaleFactor = this.TARGET_HEIGHT / currentHeight;

        // 4. Apply if deviation is significant (> 1%)
        if (Math.abs(scaleFactor - 1.0) > 0.01) {
            console.log(`[MeshScaler] Normalizing Scale: ${currentHeight.toFixed(2)}m -> ${this.TARGET_HEIGHT}m (Factor: ${scaleFactor.toFixed(4)})`);

            // Apply to the mesh
            mesh.scale.setScalar(scaleFactor);
            mesh.updateMatrixWorld(true);

            return scaleFactor;
        }

        return 1.0;
    }

    /**
     * Applies a known scale factor to a mesh.
     */
    static applyScale(mesh: THREE.Mesh, factor: number) {
        if (factor === 1.0) return;
        mesh.scale.multiplyScalar(factor);
        mesh.updateMatrixWorld(true);
    }
}