// src/domain/services/mesh_analysis/orientation/ValidationUtils.ts
import * as THREE from 'three';

export class ValidationUtils {
    /**
     * Rotates geometry around its center.
     */
    static rotateGeometry(geometry: THREE.BufferGeometry, axis: 'x' | 'y' | 'z', angle: number) {
        geometry.computeBoundingBox();
        const center = new THREE.Vector3();
        geometry.boundingBox!.getCenter(center);

        geometry.translate(-center.x, -center.y, -center.z);
        if (axis === 'x') geometry.rotateX(angle);
        if (axis === 'y') geometry.rotateY(angle);
        if (axis === 'z') geometry.rotateZ(angle);
        geometry.translate(center.x, center.y, center.z);
        geometry.computeBoundingBox();
    }

    /**
     * Estimates the Z-position of the "Core" (Spine/Neck)
     * by averaging the center of the bounding box of the mid-section.
     */
    static getCoreZ(geometry: THREE.BufferGeometry, minY: number, height: number): number {
        // Analyze the "Stomach/Waist" area (40% to 60% height)
        const waistMin = minY + (height * 0.4);
        const waistMax = minY + (height * 0.6);
        const bounds = this.getZExtremesInSlice(geometry, waistMin, waistMax);

        if (!bounds) return 0;
        return (bounds.min + bounds.max) / 2;
    }

    /**
     * Gets the Min and Max Z values in a vertical slice.
     */
    static getZExtremesInSlice(geometry: THREE.BufferGeometry, minY: number, maxY: number) {
        const pos = geometry.attributes.position;
        let min = Infinity;
        let max = -Infinity;
        let found = false;
        const stride = 3;

        for (let i = 0; i < pos.count; i += stride) {
            const y = pos.getY(i);
            if (y >= minY && y <= maxY) {
                const z = pos.getZ(i);
                if (z < min) min = z;
                if (z > max) max = z;
                found = true;
            }
        }
        return found ? { min, max } : null;
    }

    /**
     * Calculates the Mass Centroid Z and Geometric Bounds Z of a slice.
     */
    static getSliceCentroidAndBounds(geometry: THREE.BufferGeometry, minY: number, maxY: number) {
        const pos = geometry.attributes.position;
        let sumZ = 0;
        let count = 0;
        let minZ = Infinity;
        let maxZ = -Infinity;
        const stride = 2;

        for (let i = 0; i < pos.count; i += stride) {
            const y = pos.getY(i);
            if (y >= minY && y <= maxY) {
                const z = pos.getZ(i);
                sumZ += z;
                if (z < minZ) minZ = z;
                if (z > maxZ) maxZ = z;
                count++;
            }
        }

        if (count === 0) return null;
        return { centroidZ: sumZ / count, minZ, maxZ };
    }
}