// compute/src/shaders/common/types.wgsl.ts
/**
 * @fileoverview Shared struct definitions for WGSL shaders.
 *
 * Defines particle data layout and simulation parameters used across all shaders.
 * All data is vec4 aligned for optimal GPU memory access patterns.
 */

export const TYPES_WGSL = /* wgsl */`
// ============================================
// Shared Type Definitions
// ============================================

// Simulation parameters (uniform buffer)
// Layout reorganized to be strictly vec4-aligned (std140 safe)
struct SimParams {
    // x = dt
    // y = damping
    // z = friction
    // w = drag
    config: vec4f,

    // xyz = gravity
    // w = unused
    gravity: vec4f,

    // x = particle_count
    // y = substep
    // z = iteration
    // w = unused
    counts: vec4u,
}

// Particle data (storage buffers use vec4 for alignment)
// Position:     xyz = position, w = unused
// Velocity:     xyz = velocity, w = unused
// PrevPosition: xyz = prev_position, w = unused
// InverseMass:  x = inv_mass (0 = pinned), yzw = unused

// Constraint data for distance constraints
struct DistanceConstraint {
    i0: u32,           // First particle index
    i1: u32,           // Second particle index
    rest_length: f32,  // Rest length of the constraint
    compliance: f32,   // Compliance (inverse stiffness)
}

// Constraint data for bending constraints (dihedral angle)
struct BendingConstraint {
    i0: u32,           // Center vertex 0
    i1: u32,           // Center vertex 1
    i2: u32,           // Wing vertex 0
    i3: u32,           // Wing vertex 1
    rest_angle: f32,   // Rest dihedral angle
    compliance: f32,   // Compliance value
    _padding0: f32,    // Padding for alignment
    _padding1: f32,    // Padding for alignment
}

// Constraint data for tether constraints
struct TetherConstraint {
    anchor: u32,       // Anchor particle (pinned)
    particle: u32,     // Mobile particle
    max_distance: f32, // Maximum allowed distance
    compliance: f32,   // Compliance value
}
`;

export default TYPES_WGSL;
