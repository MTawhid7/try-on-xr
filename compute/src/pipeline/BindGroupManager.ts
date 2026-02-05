// compute/src/pipeline/BindGroupManager.ts
/**
 * @fileoverview Bind group layout and creation utilities.
 *
 * Manages the creation of bind group layouts and bind groups for
 * shader resource binding in the physics simulation.
 */

/**
 * Standard bind group layout indices.
 */
export const BIND_GROUP = {
    /** Simulation parameters (uniform). */
    PARAMS: 0,
    /** Particle data (storage). */
    PARTICLES: 1,
    /** Constraint/Collision data (storage per batch). */
    CONSTRAINTS: 2
} as const;

/**
 * Bind group layout definitions.
 */
export interface BindGroupLayouts {
    /** Layout for simulation parameters. */
    readonly params: GPUBindGroupLayout;
    /** Layout for particle data. */
    readonly particles: GPUBindGroupLayout;
    /** Layout for distance constraints. */
    readonly distanceConstraints: GPUBindGroupLayout;
    /** Layout for bending constraints. */
    readonly bendingConstraints: GPUBindGroupLayout;
    /** Layout for tether constraints. */
    readonly tetherConstraints: GPUBindGroupLayout;
    /** Layout for body collision. */
    readonly bodyCollision: GPUBindGroupLayout;
}

/**
 * Creates and manages bind group layouts and bind groups.
 */
export class BindGroupManager {
    private device: GPUDevice;
    private layouts: BindGroupLayouts | null = null;

    /**
     * Creates a new BindGroupManager.
     *
     * @param device - The GPU device.
     */
    constructor(device: GPUDevice) {
        this.device = device;
    }

    /**
     * Creates all bind group layouts.
     * Call this once during initialization.
     */
    createLayouts(): BindGroupLayouts {
        if (this.layouts) {
            return this.layouts;
        }

        // Params layout: uniform buffer with simulation parameters
        const params = this.device.createBindGroupLayout({
            label: 'params_layout',
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: 'uniform' }
            }]
        });

        // Particles layout: storage buffers for particle data
        const particles = this.device.createBindGroupLayout({
            label: 'particles_layout',
            entries: [
                { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },  // positions
                { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },  // prev_positions
                { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },  // velocities
                { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }  // inverse_masses
            ]
        });

        // Distance constraints layout
        const distanceConstraints = this.device.createBindGroupLayout({
            label: 'distance_constraints_layout',
            entries: [
                { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },  // constraints
                { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } }  // count
            ]
        });

        // Bending constraints layout (same structure)
        const bendingConstraints = this.device.createBindGroupLayout({
            label: 'bending_constraints_layout',
            entries: [
                { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
                { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } }
            ]
        });

        // Tether constraints layout (same structure)
        const tetherConstraints = this.device.createBindGroupLayout({
            label: 'tether_constraints_layout',
            entries: [
                { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
                { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } }
            ]
        });

        // Body collision layout (triangles + count + spatial hash)
        const bodyCollision = this.device.createBindGroupLayout({
            label: 'body_collision_layout',
            entries: [
                { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },  // triangles
                { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } }, // triangle_count
                { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } }, // grid_params
                { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }, // grid_cells
                { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }  // triangle_refs
            ]
        });

        this.layouts = {
            params,
            particles,
            distanceConstraints,
            bendingConstraints,
            tetherConstraints,
            bodyCollision
        };

        console.log('[BindGroupManager] Layouts created');
        return this.layouts;
    }

    /**
     * Gets the cached layouts (throws if not created).
     */
    getLayouts(): BindGroupLayouts {
        if (!this.layouts) {
            throw new Error('[BindGroupManager] Layouts not created. Call createLayouts() first.');
        }
        return this.layouts;
    }

    /**
     * Creates a bind group for simulation parameters.
     */
    createParamsBindGroup(paramsBuffer: GPUBuffer): GPUBindGroup {
        return this.device.createBindGroup({
            label: 'params_bind_group',
            layout: this.getLayouts().params,
            entries: [{
                binding: 0,
                resource: { buffer: paramsBuffer }
            }]
        });
    }

    /**
     * Creates a bind group for particle data.
     */
    createParticlesBindGroup(
        positions: GPUBuffer,
        prevPositions: GPUBuffer,
        velocities: GPUBuffer,
        inverseMasses: GPUBuffer
    ): GPUBindGroup {
        return this.device.createBindGroup({
            label: 'particles_bind_group',
            layout: this.getLayouts().particles,
            entries: [
                { binding: 0, resource: { buffer: positions } },
                { binding: 1, resource: { buffer: prevPositions } },
                { binding: 2, resource: { buffer: velocities } },
                { binding: 3, resource: { buffer: inverseMasses } }
            ]
        });
    }

    /**
     * Creates a bind group for a constraint batch.
     */
    createConstraintBindGroup(
        type: 'distance' | 'bending' | 'tether',
        constraintBuffer: GPUBuffer,
        countBuffer: GPUBuffer
    ): GPUBindGroup {
        const layouts = this.getLayouts();
        let layout: GPUBindGroupLayout;

        switch (type) {
            case 'distance':
                layout = layouts.distanceConstraints;
                break;
            case 'bending':
                layout = layouts.bendingConstraints;
                break;
            case 'tether':
                layout = layouts.tetherConstraints;
                break;
        }

        return this.device.createBindGroup({
            label: `${type}_constraint_bind_group`,
            layout,
            entries: [
                { binding: 0, resource: { buffer: constraintBuffer } },
                { binding: 1, resource: { buffer: countBuffer } }
            ]
        });
    }

    /**
     * Creates a bind group for body collision.
     */
    createCollisionBindGroup(
        triangleBuffer: GPUBuffer,
        countBuffer: GPUBuffer,
        gridParamsBuffer: GPUBuffer,
        gridBuffer: GPUBuffer,
        triangleRefBuffer: GPUBuffer
    ): GPUBindGroup {
        return this.device.createBindGroup({
            label: 'body_collision_bind_group',
            layout: this.getLayouts().bodyCollision,
            entries: [
                { binding: 0, resource: { buffer: triangleBuffer } },
                { binding: 1, resource: { buffer: countBuffer } },
                { binding: 2, resource: { buffer: gridParamsBuffer } },
                { binding: 3, resource: { buffer: gridBuffer } },
                { binding: 4, resource: { buffer: triangleRefBuffer } }
            ]
        });
    }
}
