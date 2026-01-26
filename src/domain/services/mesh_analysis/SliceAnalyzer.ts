// src/domain/services/mesh_analysis/SliceAnalyzer.ts
import * as THREE from 'three';

export interface Cluster {
    centroid: THREE.Vector3;
    points: THREE.Vector3[];
    size: number;
    minBounds: THREE.Vector2; // XZ min
    maxBounds: THREE.Vector2; // XZ max
}

export class SliceAnalyzer {
    /**
     * Extracts distinct "islands" of geometry within a vertical slice.
     * Uses Grid-Based Connected Components (Union-Find) for robust O(N) clustering.
     */
    static getIslandsInSlice(
        geometry: THREE.BufferGeometry,
        minY: number,
        maxY: number,
        stride: number = 2 // Check every 2nd vertex (High fidelity)
    ): Cluster[] {
        const pos = geometry.attributes.position;
        const points: THREE.Vector3[] = [];

        // 1. Extraction Phase
        for (let i = 0; i < pos.count; i += stride) {
            const y = pos.getY(i);
            if (y >= minY && y <= maxY) {
                points.push(new THREE.Vector3(pos.getX(i), y, pos.getZ(i)));
            }
        }

        if (points.length === 0) return [];

        // 2. Spatial Hashing (Grid Setup)
        // Cell size 5cm: Small enough to separate arms, large enough to bridge point cloud gaps.
        const CELL_SIZE = 0.05;
        const grid = new Map<string, THREE.Vector3[]>();
        const cellKeys: string[] = [];

        const getKey = (x: number, z: number) =>
            `${Math.floor(x / CELL_SIZE)},${Math.floor(z / CELL_SIZE)}`;

        for (const p of points) {
            const key = getKey(p.x, p.z);
            if (!grid.has(key)) {
                grid.set(key, []);
                cellKeys.push(key);
            }
            grid.get(key)!.push(p);
        }

        // 3. Union-Find Setup
        const parent = new Map<string, string>();
        cellKeys.forEach(k => parent.set(k, k));

        const find = (k: string): string => {
            if (parent.get(k) === k) return k;
            const root = find(parent.get(k)!);
            parent.set(k, root); // Path compression
            return root;
        };

        const union = (k1: string, k2: string) => {
            const root1 = find(k1);
            const root2 = find(k2);
            if (root1 !== root2) {
                parent.set(root1, root2);
            }
        };

        // 4. Adjacency Check (Merge Neighbors)
        // For each populated cell, check 8 neighbors. If neighbor exists, Union them.
        const offsets = [
            [1, 0], [-1, 0], [0, 1], [0, -1],
            [1, 1], [1, -1], [-1, 1], [-1, -1]
        ];

        for (const key of cellKeys) {
            const [kx, kz] = key.split(',').map(Number);

            for (const [ox, oz] of offsets) {
                const neighborKey = `${kx + ox},${kz + oz}`;
                if (grid.has(neighborKey)) {
                    union(key, neighborKey);
                }
            }
        }

        // 5. Grouping
        const clustersMap = new Map<string, Cluster>();

        for (const key of cellKeys) {
            const root = find(key);
            const cellPoints = grid.get(key)!;

            if (!clustersMap.has(root)) {
                clustersMap.set(root, {
                    centroid: new THREE.Vector3(),
                    points: [],
                    size: 0,
                    minBounds: new THREE.Vector2(Infinity, Infinity),
                    maxBounds: new THREE.Vector2(-Infinity, -Infinity)
                });
            }

            const cluster = clustersMap.get(root)!;

            for (const p of cellPoints) {
                cluster.points.push(p);
                cluster.centroid.add(p);
                cluster.minBounds.x = Math.min(cluster.minBounds.x, p.x);
                cluster.minBounds.y = Math.min(cluster.minBounds.y, p.z); // Y is Z in 2D bounds
                cluster.maxBounds.x = Math.max(cluster.maxBounds.x, p.x);
                cluster.maxBounds.y = Math.max(cluster.maxBounds.y, p.z);
            }
            cluster.size += cellPoints.length;
        }

        // 6. Finalize Centroids
        const result: Cluster[] = [];
        for (const cluster of clustersMap.values()) {
            // Filter noise: A cluster must have > 10 points to be real geometry
            if (cluster.size > 10) {
                cluster.centroid.divideScalar(cluster.size);
                result.push(cluster);
            }
        }

        return result;
    }
}