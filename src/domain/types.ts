// src/domain/types.ts
import * as THREE from 'three';

export type ShirtSize = 'XXS' | 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL';

export interface ProcessedMesh {
    vertices: Float32Array;
    indices: Uint32Array;
    normals: Float32Array;
    uvs: Float32Array;
}

export interface SimulationAssets {
    garment: ProcessedMesh;
    collider: ProcessedMesh;
    visualBody: THREE.BufferGeometry; // NEW: High-res geometry
}