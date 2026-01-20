// src/domain/services/MeshAnalyzer.ts
import * as THREE from 'three';

export interface AnatomicalAnchors {
    neckY: number;      // The vertical height of the collar bone/neck
    spineCenter: THREE.Vector2; // The X/Z center of the upper torso (ignoring belly)
}

export class MeshAnalyzer {
    /**
     * Analyzes a human body mesh to find anatomical anchors.
     * It "slices" the mesh horizontally to find the neck and the true spine axis.
     */
    static analyzeBody(geometry: THREE.BufferGeometry): AnatomicalAnchors {
        geometry.computeBoundingBox();
        const box = geometry.boundingBox!;
        const height = box.max.y - box.min.y;

        const positionAttr = geometry.attributes.position;
        const vertexCount = positionAttr.count;

        // 1. Bucket vertices by Height (Y)
        // We divide the body into 100 vertical slices
        const slices = 100;
        const sliceHeight = height / slices;

        // We store the bounds of each slice: [minX, maxX, minZ, maxZ, count]
        const sliceBounds: number[][] = Array(slices).fill(0).map(() => [Infinity, -Infinity, Infinity, -Infinity, 0]);

        for (let i = 0; i < vertexCount; i++) {
            const x = positionAttr.getX(i);
            const y = positionAttr.getY(i);
            const z = positionAttr.getZ(i);

            // Determine which slice this vertex belongs to
            // Clamp to 0..99
            const sliceIndex = Math.min(
                Math.floor((y - box.min.y) / sliceHeight),
                slices - 1
            );

            const bounds = sliceBounds[sliceIndex];
            if (x < bounds[0]) bounds[0] = x;
            if (x > bounds[1]) bounds[1] = x;
            if (z < bounds[2]) bounds[2] = z;
            if (z > bounds[3]) bounds[3] = z;
            bounds[4]++; // Increment count
        }

        // 2. Find Neck Y (Vertical Anchor)
        // Heuristic: The neck is the narrowest point in the upper 20% of the body
        // before the head widens or the shoulders widen.
        // For simplicity in V1: We take the point at ~87% height.
        const neckSliceIndex = Math.floor(slices * 0.87);
        const neckY = box.min.y + (neckSliceIndex * sliceHeight);

        // 3. Find Spine Center (Horizontal Anchor)
        // We look at the "Chest Slice" (roughly 15% below the neck).
        // This is the most stable part of the torso, unaffected by belly protrusion.
        const chestSliceIndex = Math.floor(slices * 0.70);
        const chestBounds = sliceBounds[chestSliceIndex];

        // If the slice is empty (rare), fallback to box center
        if (chestBounds[4] === 0) {
            return {
                neckY: neckY,
                spineCenter: new THREE.Vector2(
                    (box.min.x + box.max.x) / 2,
                    (box.min.z + box.max.z) / 2
                )
            };
        }

        // Calculate Center of the Chest Slice
        const spineX = (chestBounds[0] + chestBounds[1]) / 2;
        const spineZ = (chestBounds[2] + chestBounds[3]) / 2;

        return {
            neckY: neckY,
            spineCenter: new THREE.Vector2(spineX, spineZ)
        };
    }
}