// src/domain/services/MeshAnalyzer.ts
import * as THREE from 'three';

export interface AnatomicalAnchors {
    neckY: number;
    neckCenter: THREE.Vector2;   // Top of the regression line
    spineCenter: THREE.Vector2;  // Bottom of the regression line (Chest/Waist)
    pelvisCenter: THREE.Vector2; // Extrapolated pelvis position
}

export class MeshAnalyzer {
    /**
     * Calculates the body's orientation using Statistical Regression on the Ribcage.
     * This is the most robust method for finding the "True Spine" of a noisy mesh.
     */
    static analyzeBody(geometry: THREE.BufferGeometry): AnatomicalAnchors {
        geometry.computeBoundingBox();
        const box = geometry.boundingBox!;
        const height = box.max.y - box.min.y;

        const positionAttr = geometry.attributes.position;
        const vertexCount = positionAttr.count;

        // --- ROI: THE RIBCAGE (60% to 85%) ---
        // We focus strictly on the upper torso.
        // This avoids the arms (too low/wide), the hips (asymmetric), and the butt (backward bias).
        const startY = box.min.y + (height * 0.60);
        const endY = box.min.y + (height * 0.85);

        const sliceCount = 20;
        const sliceHeight = (endY - startY) / sliceCount;

        // Buckets for slice data
        const slices: { x: number[], z: number[] }[] = Array(sliceCount).fill(0).map(() => ({ x: [], z: [] }));

        for (let i = 0; i < vertexCount; i++) {
            const y = positionAttr.getY(i);

            if (y >= startY && y < endY) {
                const sliceIndex = Math.floor((y - startY) / sliceHeight);
                if (sliceIndex >= 0 && sliceIndex < sliceCount) {
                    slices[sliceIndex].x.push(positionAttr.getX(i));
                    slices[sliceIndex].z.push(positionAttr.getZ(i));
                }
            }
        }

        // --- ROBUST MEDIAN EXTRACTION ---
        // For each slice, find the Median X and Median Z.
        // This mathematically deletes arms/hands if they appear in the slice.
        const points: THREE.Vector3[] = [];

        for (let i = 0; i < sliceCount; i++) {
            const slice = slices[i];
            if (slice.x.length < 10) continue; // Skip empty/sparse slices

            slice.x.sort((a, b) => a - b);
            slice.z.sort((a, b) => a - b);

            const medianX = slice.x[Math.floor(slice.x.length / 2)];
            const medianZ = slice.z[Math.floor(slice.z.length / 2)];
            const centerY = startY + (i * sliceHeight) + (sliceHeight / 2);

            points.push(new THREE.Vector3(medianX, centerY, medianZ));
        }

        // --- LINEAR REGRESSION (Line of Best Fit) ---
        // We fit a line through the median points of the ribcage.
        // X = slopeX * Y + offsetX
        // Z = slopeZ * Y + offsetZ

        let sumY = 0, sumX = 0, sumZ = 0;
        let sumY2 = 0, sumXY = 0, sumYZ = 0;
        const N = points.length;

        if (N < 5) {
            // Fallback: Not enough data, return Box Center
            const cx = (box.min.x + box.max.x) / 2;
            const cz = (box.min.z + box.max.z) / 2;
            return {
                neckY: box.max.y,
                neckCenter: new THREE.Vector2(cx, cz),
                spineCenter: new THREE.Vector2(cx, cz),
                pelvisCenter: new THREE.Vector2(cx, cz)
            };
        }

        for (const p of points) {
            sumY += p.y;
            sumX += p.x;
            sumZ += p.z;
            sumY2 += p.y * p.y;
            sumXY += p.x * p.y;
            sumYZ += p.y * p.z;
        }

        const denominator = (N * sumY2 - sumY * sumY);
        let slopeX = 0;
        let slopeZ = 0;
        let offsetX = 0;
        let offsetZ = 0;

        if (Math.abs(denominator) > 1e-6) {
            slopeX = (N * sumXY - sumX * sumY) / denominator;
            slopeZ = (N * sumYZ - sumZ * sumY) / denominator;
            offsetX = (sumX - slopeX * sumY) / N;
            offsetZ = (sumZ - slopeZ * sumY) / N;
        }

        // --- EXTRAPOLATE ANCHORS ---
        // Now we use the "Ideal Spine Line" to find our anchors.

        const getPointOnLine = (y: number) => new THREE.Vector2(
            slopeX * y + offsetX,
            slopeZ * y + offsetZ
        );

        const neckY = box.min.y + (height * 0.87);
        const spineY = box.min.y + (height * 0.70);
        const pelvisY = box.min.y + (height * 0.50);

        return {
            neckY: neckY,
            neckCenter: getPointOnLine(neckY),
            spineCenter: getPointOnLine(spineY),
            pelvisCenter: getPointOnLine(pelvisY)
        };
    }
}