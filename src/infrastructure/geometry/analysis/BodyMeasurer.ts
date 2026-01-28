// src/infrastructure/geometry/analysis/BodyMeasurer.ts

import * as THREE from 'three';

export class BodyMeasurer {
    /**
     * Calculates the chest circumference of the mesh in cm.
     * Assumes the mesh is upright (Y-up) and centered.
     */
    static getChestCircumference(mesh: THREE.Mesh): number {
        const geometry = mesh.geometry;
        geometry.computeBoundingBox();
        const box = geometry.boundingBox!;
        const height = box.max.y - box.min.y;

        // Chest is typically at ~73% of total height
        const chestHeight = box.min.y + (height * 0.73);
        const sliceThickness = 0.02; // 2cm slice

        // 1. Extract Points in Slice
        const points2D: THREE.Vector2[] = [];
        const pos = geometry.attributes.position;
        const v = new THREE.Vector3();

        for (let i = 0; i < pos.count; i++) {
            v.fromBufferAttribute(pos, i);
            if (Math.abs(v.y - chestHeight) < sliceThickness) {
                points2D.push(new THREE.Vector2(v.x, v.z));
            }
        }

        if (points2D.length < 3) return 0;

        // 2. Sort by angle around centroid (Simple Convex Hull approximation)
        const centroid = new THREE.Vector2();
        for (const p of points2D) centroid.add(p);
        centroid.divideScalar(points2D.length);

        points2D.sort((a, b) => {
            const angA = Math.atan2(a.y - centroid.y, a.x - centroid.x);
            const angB = Math.atan2(b.y - centroid.y, b.x - centroid.x);
            return angA - angB;
        });

        // 3. Calculate Perimeter
        let perimeter = 0;
        for (let i = 0; i < points2D.length; i++) {
            const p1 = points2D[i];
            const p2 = points2D[(i + 1) % points2D.length];
            perimeter += p1.distanceTo(p2);
        }

        // Convert Meters to CM
        return perimeter * 100;
    }
}