// src/domain/services/MeshMeasurer.ts
import * as THREE from 'three';

export class MeshMeasurer {
    static measure(mesh: THREE.Mesh): { width: number, length: number } {
        mesh.geometry.computeBoundingBox();
        const box = mesh.geometry.boundingBox!;

        // Calculate Dimensions in Meters
        const widthMeters = box.max.x - box.min.x;
        const lengthMeters = box.max.y - box.min.y;

        // Convert to CM
        return {
            width: widthMeters * 100,
            length: lengthMeters * 100
        };
    }
}