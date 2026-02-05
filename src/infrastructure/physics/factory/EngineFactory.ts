// src/infrastructure/physics/factory/EngineFactory.ts
/**
 * @fileoverview Physics engine factory with automatic backend selection.
 *
 * This factory handles WebGPU detection, graceful fallback to WASM,
 * and user notification when GPU acceleration is unavailable.
 */

import type { IPhysicsEngine, PhysicsBackend } from '../../../core/interfaces/IPhysicsEngine';
import { WasmAdapter } from '../adapter/WasmAdapter';
import { GpuAdapter } from '../adapter/GpuAdapter';

/**
 * Configuration options for engine creation.
 */
export interface EngineFactoryConfig {
    /** Prefer GPU backend if available. Default: true */
    readonly preferGpu: boolean;
    /** Callback when fallback to CPU occurs. */
    readonly onFallback?: (reason: string) => void;
    /** Callback when GPU is successfully initialized. */
    readonly onGpuReady?: () => void;
}

/**
 * Result of engine creation.
 */
export interface EngineCreationResult {
    /** The created physics engine. */
    readonly engine: IPhysicsEngine;
    /** The backend that was selected. */
    readonly backend: PhysicsBackend;
    /** GPU device (if WebGPU backend). */
    readonly device?: GPUDevice;
    /** Reason for fallback (if GPU was preferred but WASM was selected). */
    readonly fallbackReason?: string;
}

/**
 * Result of GPU support check.
 */
export interface GpuSupportStatus {
    /** Whether WebGPU is supported. */
    readonly supported: boolean;
    /** Human-readable reason for lack of support. */
    readonly reason?: string;
    /** The GPU device if supported. */
    readonly device?: GPUDevice;
}

/**
 * Factory for creating physics engine instances.
 *
 * Automatically detects WebGPU support and falls back to WASM if needed.
 * Provides callbacks for notifying the UI about backend selection.
 *
 * @example
 * ```typescript
 * const factory = new EngineFactory();
 * const result = await factory.createEngine({
 *     preferGpu: true,
 *     onFallback: (reason) => showToast(`Using CPU: ${reason}`)
 * });
 * console.log(`Using ${result.backend} backend`);
 * ```
 */
export class EngineFactory {
    /** Cached GPU support status. */
    private static gpuStatus: GpuSupportStatus | null = null;

    /**
     * Checks if WebGPU is supported in the current environment.
     * Results are cached after the first check.
     *
     * @returns Promise resolving to the support status.
     */
    async checkGpuSupport(): Promise<GpuSupportStatus> {
        // Return cached status if available
        if (EngineFactory.gpuStatus !== null) {
            return EngineFactory.gpuStatus;
        }

        // Check if navigator.gpu exists
        if (typeof navigator === 'undefined' || !navigator.gpu) {
            EngineFactory.gpuStatus = {
                supported: false,
                reason: 'WebGPU is not supported in this browser. ' +
                    'Please use Chrome 113+, Edge 113+, or Safari 18+ for GPU acceleration.'
            };
            return EngineFactory.gpuStatus;
        }

        try {
            // Try to request an adapter
            const adapter = await navigator.gpu.requestAdapter({
                powerPreference: 'high-performance'
            });

            if (!adapter) {
                EngineFactory.gpuStatus = {
                    supported: false,
                    reason: 'No GPU adapter available. ' +
                        'Your system may not have a compatible graphics card.'
                };
                return EngineFactory.gpuStatus;
            }

            // Try to request a device with required limits
            const device = await adapter.requestDevice({
                requiredLimits: {
                    maxStorageBufferBindingSize: 128 * 1024 * 1024, // 128MB
                    maxBufferSize: 128 * 1024 * 1024 // 128MB
                }
            });

            if (!device) {
                EngineFactory.gpuStatus = {
                    supported: false,
                    reason: 'Failed to initialize GPU device.'
                };
                return EngineFactory.gpuStatus;
            }

            // Set up device lost handler
            device.lost.then((info) => {
                console.error('[EngineFactory] GPU device lost:', info.message);
                EngineFactory.gpuStatus = null; // Clear cache
            });

            EngineFactory.gpuStatus = {
                supported: true,
                device
            };
            console.log('[EngineFactory] WebGPU is available');
            return EngineFactory.gpuStatus;

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            EngineFactory.gpuStatus = {
                supported: false,
                reason: `WebGPU initialization failed: ${message}`
            };
            return EngineFactory.gpuStatus;
        }
    }

    /**
     * Creates a physics engine instance.
     *
     * @param config - Configuration options.
     * @returns Promise resolving to the creation result.
     */
    async createEngine(
        config: Partial<EngineFactoryConfig> = {}
    ): Promise<EngineCreationResult> {
        const { preferGpu = true, onFallback, onGpuReady } = config;

        if (preferGpu) {
            const gpuStatus = await this.checkGpuSupport();

            if (gpuStatus.supported && gpuStatus.device) {
                try {
                    const engine = new GpuAdapter({ device: gpuStatus.device });
                    console.log('[EngineFactory] Created GPU engine');
                    onGpuReady?.();

                    return {
                        engine,
                        backend: 'webgpu',
                        device: gpuStatus.device
                    };
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    const reason = `Failed to create GPU engine: ${message}. Falling back to CPU.`;

                    console.warn(`[EngineFactory] ${reason}`);
                    onFallback?.(reason);

                    return {
                        engine: this.createWasmEngine(),
                        backend: 'wasm',
                        fallbackReason: reason
                    };
                }
            } else {
                // GPU not available, use WASM fallback
                console.log(`[EngineFactory] GPU not available: ${gpuStatus.reason}`);
                onFallback?.(gpuStatus.reason!);

                return {
                    engine: this.createWasmEngine(),
                    backend: 'wasm',
                    fallbackReason: gpuStatus.reason
                };
            }
        }

        // Explicitly requested WASM
        return {
            engine: this.createWasmEngine(),
            backend: 'wasm'
        };
    }

    /**
     * Creates a WASM-based physics engine.
     */
    private createWasmEngine(): IPhysicsEngine {
        console.log('[EngineFactory] Creating WASM engine');
        return new WasmAdapter();
    }

    /**
     * Clears the cached GPU status.
     * Useful for testing or after device loss.
     */
    static clearCache(): void {
        EngineFactory.gpuStatus = null;
    }
}

/**
 * Singleton factory instance for convenience.
 */
export const engineFactory = new EngineFactory();
