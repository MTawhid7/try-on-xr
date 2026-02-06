export function generateCylinderMesh(
    radius: number,
    height: number,
    radialSegments: number,
    heightSegments: number
): { positions: Float32Array; normals: Float32Array; indices: Uint32Array } {
    const positions: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];

    const halfHeight = height / 2;

    for (let y = 0; y <= heightSegments; y++) {
        const v = y / heightSegments;
        const py = v * height - halfHeight + 0.9; // Offset up by 0.9 to stand on floor

        for (let x = 0; x <= radialSegments; x++) {
            const u = x / radialSegments;
            const theta = u * Math.PI * 2;

            const px = Math.cos(theta) * radius;
            const pz = Math.sin(theta) * radius;

            positions.push(px, py, pz);
            normals.push(Math.cos(theta), 0, Math.sin(theta));
        }
    }

    // Top cap
    const topCenterIdx = positions.length / 3;
    positions.push(0, halfHeight + 0.9, 0);
    normals.push(0, 1, 0);

    // Bottom cap
    const botCenterIdx = positions.length / 3;
    positions.push(0, -halfHeight + 0.9, 0);
    normals.push(0, -1, 0);

    const stride = radialSegments + 1;

    for (let y = 0; y < heightSegments; y++) {
        for (let x = 0; x < radialSegments; x++) {
            const i0 = y * stride + x;
            const i1 = y * stride + x + 1;
            const i2 = (y + 1) * stride + x;
            const i3 = (y + 1) * stride + x + 1;

            indices.push(i0, i1, i2);
            indices.push(i2, i1, i3);
        }
    }

    return {
        positions: new Float32Array(positions),
        normals: new Float32Array(normals),
        indices: new Uint32Array(indices)
    };
}

function mergeGeometries(
    geometries: { positions: Float32Array; normals: Float32Array; indices: Uint32Array }[]
): { positions: Float32Array; normals: Float32Array; indices: Uint32Array } {
    let totalPositions = 0;
    let totalIndices = 0;

    for (const g of geometries) {
        totalPositions += g.positions.length;
        totalIndices += g.indices.length;
    }

    const mergedPositions = new Float32Array(totalPositions);
    const mergedNormals = new Float32Array(totalPositions);
    const mergedIndices = new Uint32Array(totalIndices);

    let posOffset = 0;
    let indexOffset = 0;
    let vertexOffset = 0;

    for (const g of geometries) {
        mergedPositions.set(g.positions, posOffset);
        mergedNormals.set(g.normals, posOffset);

        for (let i = 0; i < g.indices.length; i++) {
            mergedIndices[indexOffset + i] = g.indices[i] + vertexOffset;
        }

        posOffset += g.positions.length;
        indexOffset += g.indices.length;
        vertexOffset += g.positions.length / 3;
    }

    return {
        positions: mergedPositions,
        normals: mergedNormals,
        indices: mergedIndices
    };
}

export function generateTMesh(): { positions: Float32Array; normals: Float32Array; indices: Uint32Array } {
    // Vertical Torso/Legs
    // Dimensions from User's CapsuleDebug.tsx:
    // Torso: Y=0.7, R=0.12, H=1.5
    // generateCylinderMesh centers at 0.9 by default (offset).
    const torso = generateCylinderMesh(0.12, 1.5, 32, 1); // Increased segments to 32 to match visual

    // Shift Torso to Y=0.7 (was 0.9)
    for (let i = 1; i < torso.positions.length; i += 3) {
        torso.positions[i] -= 0.2;
    }

    // Horizontal Shoulders
    // Dimensions from User: Pos=[0, 1.4, 0], R=0.1, H=0.35
    const armSpan = 0.35;
    const armRadius = 0.1;
    const arms = generateCylinderMesh(armRadius, armSpan, 32, 1); // Increased segments to 32

    // Rotate and Translate arms
    // Current center is (0, 0.9, 0).
    // Target: (0, 1.4, 0) and Rotated 90 Z.
    //
    // 1. Reset (y - 0.9)
    // 2. Rotate 90 Z (x->-y, y->x)
    // 3. Move to 1.4

    for (let i = 0; i < arms.positions.length; i += 3) {
        let x = arms.positions[i];
        let y = arms.positions[i + 1] - 0.9;
        let z = arms.positions[i + 2];

        // Rotate 90 deg Z
        const nx = -y;
        const ny = x;

        // Move to Shoulder Height (1.4)
        arms.positions[i] = nx;
        arms.positions[i + 1] = ny + 1.4;
        arms.positions[i + 2] = z;

        // Rotate Normals
        let mx = arms.normals[i];
        let my = arms.normals[i + 1];
        let mz = arms.normals[i + 2];

        arms.normals[i] = -my;
        arms.normals[i + 1] = mx;
        arms.normals[i + 2] = mz;
    }

    return mergeGeometries([torso, arms]);
}
