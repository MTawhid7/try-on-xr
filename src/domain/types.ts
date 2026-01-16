// src/domain/types.ts
export interface ProcessedMesh {
    vertices: Float32Array;
    indices: Uint32Array;
    normals: Float32Array;
    uvs: Float32Array; // NEW
}

export interface SimulationAssets {
    garment: ProcessedMesh;
    collider: ProcessedMesh;
}