// src/domain/services/MeshAnalyzer.ts
import * as THREE from 'three';

export interface AnatomicalAnchors {
    neckY: number;
    neckCenter: THREE.Vector2;   // Top Anchor (Base of Neck)
    pelvisCenter: THREE.Vector2; // Bottom Anchor (Pelvis/Hips)
    spineCenter: THREE.Vector2;  // Middle Anchor (Chest - used for Shirt X/Z alignment)
}

export class MeshAnalyzer {
    /**
     * Analyzes the body geometry to find stable anatomical landmarks.
     * Uses "Robust Median" logic to ignore outliers like arms and hands.
     */
    static analyzeBody(geometry: THREE.BufferGeometry): AnatomicalAnchors {
        geometry.computeBoundingBox();
        const box = geometry.boundingBox!;
        const height = box.max.y - box.min.y;

        const positionAttr = geometry.attributes.position;
        const vertexCount = positionAttr.count;

        // --- DEFINING SLICES (Relative to Height) ---

        // 1. Pelvis: 48% to 52%
        // Center of mass, generally stable, avoids legs splitting.
        const pelvisMinY = box.min.y + (height * 0.48);
        const pelvisMaxY = box.min.y + (height * 0.52);

        // 2. Chest (Spine): 68% to 72%
        // Used for centering the shirt. More stable than neck for X/Z.
        const chestMinY = box.min.y + (height * 0.68);
        const chestMaxY = box.min.y + (height * 0.72);

        // 3. Neck: 85% to 88%
        // Base of neck. Used for vertical alignment and tilt calculation.
        const neckMinY = box.min.y + (height * 0.85);
        const neckMaxY = box.min.y + (height * 0.88);

        // Collectors
        const pelvisX: number[] = [];
        const pelvisZ: number[] = [];
        const chestX: number[] = [];
        const chestZ: number[] = [];
        const neckX: number[] = [];
        const neckZ: number[] = [];

        // Single pass through vertices
        for (let i = 0; i < vertexCount; i++) {
            const x = positionAttr.getX(i);
            const y = positionAttr.getY(i);
            const z = positionAttr.getZ(i);

            if (y >= pelvisMinY && y <= pelvisMaxY) {
                pelvisX.push(x);
                pelvisZ.push(z);
            } else if (y >= chestMinY && y <= chestMaxY) {
                chestX.push(x);
                chestZ.push(z);
            } else if (y >= neckMinY && y <= neckMaxY) {
                neckX.push(x);
                neckZ.push(z);
            }
        }

        // --- ROBUST MEDIAN LOGIC ---
        // We sort coordinates and pick the middle value.
        // This filters out arms (which are X-outliers) without complex logic.
        const getMedian = (values: number[]): number => {
            if (values.length === 0) return 0;
            values.sort((a, b) => a - b);
            const mid = Math.floor(values.length / 2);
            return values[mid];
        };

        const pelvisCenter = new THREE.Vector2(
            getMedian(pelvisX),
            getMedian(pelvisZ)
        );

        const spineCenter = new THREE.Vector2(
            getMedian(chestX),
            getMedian(chestZ)
        );

        const neckCenter = new THREE.Vector2(
            getMedian(neckX),
            getMedian(neckZ)
        );

        // Fallbacks if slices are empty (e.g. broken mesh or wrong scale)
        const boxCenterX = (box.min.x + box.max.x) / 2;
        const boxCenterZ = (box.min.z + box.max.z) / 2;

        if (pelvisX.length === 0) pelvisCenter.set(boxCenterX, boxCenterZ);
        if (chestX.length === 0) spineCenter.set(boxCenterX, boxCenterZ);
        if (neckX.length === 0) neckCenter.set(boxCenterX, boxCenterZ);

        return {
            neckY: neckMaxY, // Return the top of the neck slice for clearance
            neckCenter,
            pelvisCenter,
            spineCenter
        };
    }
}