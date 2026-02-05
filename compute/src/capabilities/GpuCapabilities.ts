// compute/src/capabilities/GpuCapabilities.ts
/**
 * @fileoverview WebGPU capability detection and feature queries.
 *
 * Provides utilities to detect WebGPU support, query device limits,
 * and determine whether GPU-accelerated physics is viable.
 */

/**
 * Result of GPU support check.
 */
export interface GpuSupportResult {
    /** Whether WebGPU is supported in this browser. */
    readonly supported: boolean;
    /** Human-readable reason for lack of support (if not supported). */
    readonly reason?: string;
    /** The GPU adapter, if available. */
    readonly adapter?: GPUAdapter;
    /** The GPU device, if available. */
    readonly device?: GPUDevice;
    /** Device limits relevant to physics simulation. */
    readonly limits?: GpuLimits;
}

/**
 * Relevant GPU device limits for physics simulation.
 */
export interface GpuLimits {
    /** Maximum workgroup size in X dimension. */
    readonly maxWorkgroupSizeX: number;
    /** Maximum buffer size in bytes. */
    readonly maxBufferSize: number;
    /** Maximum storage buffers per shader stage. */
    readonly maxStorageBuffersPerShaderStage: number;
    /** Maximum compute invocations per workgroup. */
    readonly maxComputeInvocationsPerWorkgroup: number;
}

/**
 * Static utility class for GPU capability detection.
 *
 * @example
 * ```typescript
 * const result = await GpuCapabilities.check();
 * if (result.supported) {
 *     console.log('WebGPU is available!', result.limits);
 * } else {
 *     console.warn('WebGPU not available:', result.reason);
 * }
 * ```
 */
export class GpuCapabilities {
    private static cachedResult: GpuSupportResult | null = null;

    /**
     * Checks if WebGPU is supported and initializes the adapter/device.
     * Results are cached after the first call.
     *
     * @returns Promise resolving to the support result.
     */
    static async check(): Promise<GpuSupportResult> {
        // Return cached result if available
        if (this.cachedResult !== null) {
            return this.cachedResult;
        }

        // Check if navigator.gpu exists
        if (typeof navigator === 'undefined' || !navigator.gpu) {
            this.cachedResult = {
                supported: false,
                reason: 'WebGPU is not supported in this browser. ' +
                    'Please use Chrome 113+, Edge 113+, or Safari 18+.'
            };
            return this.cachedResult;
        }

        try {
            // Request adapter
            const adapter = await navigator.gpu.requestAdapter({
                powerPreference: 'high-performance'
            });

            if (!adapter) {
                this.cachedResult = {
                    supported: false,
                    reason: 'No GPU adapter available. ' +
                        'Your system may not have a compatible GPU.'
                };
                return this.cachedResult;
            }

            // Request device
            const device = await adapter.requestDevice({
                requiredLimits: {
                    // Request limits needed for physics simulation
                    maxStorageBufferBindingSize: 128 * 1024 * 1024, // 128MB
                    maxBufferSize: 128 * 1024 * 1024 // 128MB
                }
            });

            // Extract relevant limits
            const limits: GpuLimits = {
                maxWorkgroupSizeX: device.limits.maxComputeWorkgroupSizeX,
                maxBufferSize: device.limits.maxBufferSize,
                maxStorageBuffersPerShaderStage: device.limits.maxStorageBuffersPerShaderStage,
                maxComputeInvocationsPerWorkgroup: device.limits.maxComputeInvocationsPerWorkgroup
            };

            // Set up device lost handler
            device.lost.then((info) => {
                console.error('[GpuCapabilities] Device lost:', info.message);
                // Invalidate cache so next check will re-acquire
                this.cachedResult = null;
            });

            this.cachedResult = {
                supported: true,
                adapter,
                device,
                limits
            };

            console.log('[GpuCapabilities] WebGPU initialized:', {
                vendor: adapter.info?.vendor ?? 'unknown',
                architecture: adapter.info?.architecture ?? 'unknown',
                limits
            });

            return this.cachedResult;

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.cachedResult = {
                supported: false,
                reason: `Failed to initialize WebGPU: ${message}`
            };
            return this.cachedResult;
        }
    }

    /**
     * Clears the cached result, forcing a fresh check on next call.
     * Useful for testing or after device loss.
     */
    static clearCache(): void {
        this.cachedResult = null;
    }

    /**
     * Checks if the GPU can handle a given vertex count.
     *
     * @param vertexCount - Number of vertices to simulate.
     * @param limits - GPU limits to check against.
     * @returns True if the vertex count is within limits.
     */
    static canHandleVertexCount(vertexCount: number, limits: GpuLimits): boolean {
        // Each vertex needs ~64 bytes (position, velocity, prev_pos, mass)
        const requiredBytes = vertexCount * 64;
        return requiredBytes < limits.maxBufferSize;
    }
}

/**
 * Convenience function for checking GPU support.
 *
 * @returns Promise resolving to the support result.
 */
export async function checkGpuSupport(): Promise<GpuSupportResult> {
    return GpuCapabilities.check();
}
