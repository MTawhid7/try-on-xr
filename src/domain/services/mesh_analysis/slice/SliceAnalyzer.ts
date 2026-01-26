// src/domain/services/mesh_analysis/slice/SliceAnalyzer.ts
import * as THREE from 'three';
import { ClusterEngine, type Cluster } from './ClusterEngine';

// FIX: Use 'export type' for interfaces
export type { Cluster };

export class SliceAnalyzer {
    static getIslandsInSlice(
        geometry: THREE.BufferGeometry,
        minY: number,
        maxY: number,
        stride: number = 2
    ): Cluster[] {
        const pos = geometry.attributes.position;
        const points: THREE.Vector3[] = [];

        for (let i = 0; i < pos.count; i += stride) {
            const y = pos.getY(i);
            if (y >= minY && y <= maxY) {
                points.push(new THREE.Vector3(pos.getX(i), y, pos.getZ(i)));
            }
        }

        return ClusterEngine.findClusters(points);
    }

    static getSliceWidth(
        geometry: THREE.BufferGeometry,
        minY: number,
        maxY: number,
        stride: number = 5
    ): number {
        const pos = geometry.attributes.position;
        let minX = Infinity;
        let maxX = -Infinity;
        let found = false;

        for (let i = 0; i < pos.count; i += stride) {
            const y = pos.getY(i);
            if (y >= minY && y <= maxY) {
                const x = pos.getX(i);
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                found = true;
            }
        }
        return found ? (maxX - minX) : 0;
    }
}