// compute/src/pipeline/ShaderCompiler.ts
/**
 * @fileoverview Shader compilation and pipeline creation utilities.
 *
 * Provides a centralized system for compiling WGSL shaders and creating
 * compute pipelines with proper error handling and caching.
 */

/**
 * Result of shader compilation.
 */
export interface CompilationResult {
    readonly success: boolean;
    readonly module?: GPUShaderModule;
    readonly error?: string;
}

/**
 * Pipeline configuration.
 */
export interface PipelineConfig {
    readonly label: string;
    readonly shaderSource: string;
    readonly entryPoint: string;
    readonly bindGroupLayouts: GPUBindGroupLayout[];
}

/**
 * Compiled pipeline with metadata.
 */
export interface CompiledPipeline {
    readonly label: string;
    readonly pipeline: GPUComputePipeline;
    readonly module: GPUShaderModule;
}

/**
 * Shader compilation and pipeline management.
 *
 * Handles WGSL compilation with error reporting and pipeline caching
 * for efficient resource management.
 */
export class ShaderCompiler {
    private device: GPUDevice;
    private moduleCache: Map<string, GPUShaderModule> = new Map();
    private pipelineCache: Map<string, GPUComputePipeline> = new Map();

    /**
     * Creates a new ShaderCompiler.
     *
     * @param device - The GPU device for compilation.
     */
    constructor(device: GPUDevice) {
        this.device = device;
    }

    /**
     * Compiles a WGSL shader module.
     *
     * @param label - Label for debugging.
     * @param source - WGSL source code.
     * @returns Compilation result.
     */
    async compileShader(label: string, source: string): Promise<CompilationResult> {
        // Check cache first
        if (this.moduleCache.has(label)) {
            return {
                success: true,
                module: this.moduleCache.get(label)!
            };
        }

        try {
            const module = this.device.createShaderModule({
                label,
                code: source
            });

            // Check for compilation errors
            const info = await module.getCompilationInfo();
            const errors = info.messages.filter(m => m.type === 'error');

            if (errors.length > 0) {
                const errorMsg = errors
                    .map(e => `Line ${e.lineNum}: ${e.message}`)
                    .join('\n');
                console.error(`[ShaderCompiler] ${label} compilation failed:\n${errorMsg}`);
                return {
                    success: false,
                    error: errorMsg
                };
            }

            // Log warnings
            const warnings = info.messages.filter(m => m.type === 'warning');
            if (warnings.length > 0) {
                warnings.forEach(w => {
                    console.warn(`[ShaderCompiler] ${label} warning (line ${w.lineNum}): ${w.message}`);
                });
            }

            this.moduleCache.set(label, module);
            console.log(`[ShaderCompiler] ${label} compiled successfully`);

            return {
                success: true,
                module
            };

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`[ShaderCompiler] ${label} error: ${message}`);
            return {
                success: false,
                error: message
            };
        }
    }

    /**
     * Creates a compute pipeline from configuration.
     *
     * @param config - Pipeline configuration.
     * @returns The compiled pipeline.
     */
    async createPipeline(config: PipelineConfig): Promise<CompiledPipeline> {
        const { label, shaderSource, entryPoint, bindGroupLayouts } = config;

        // Check cache
        if (this.pipelineCache.has(label)) {
            return {
                label,
                pipeline: this.pipelineCache.get(label)!,
                module: this.moduleCache.get(label)!
            };
        }

        // Compile shader
        const result = await this.compileShader(label, shaderSource);
        if (!result.success || !result.module) {
            throw new Error(`Failed to compile shader ${label}: ${result.error}`);
        }

        // Create pipeline layout
        const pipelineLayout = this.device.createPipelineLayout({
            label: `${label}_layout`,
            bindGroupLayouts
        });

        // Create compute pipeline
        const pipeline = this.device.createComputePipeline({
            label,
            layout: pipelineLayout,
            compute: {
                module: result.module,
                entryPoint
            }
        });

        this.pipelineCache.set(label, pipeline);
        console.log(`[ShaderCompiler] Pipeline ${label} created`);

        return {
            label,
            pipeline,
            module: result.module
        };
    }

    /**
     * Creates multiple pipelines in parallel.
     *
     * @param configs - Array of pipeline configurations.
     * @returns Array of compiled pipelines.
     */
    async createPipelines(configs: PipelineConfig[]): Promise<CompiledPipeline[]> {
        return Promise.all(configs.map(c => this.createPipeline(c)));
    }

    /**
     * Clears the cache, forcing recompilation.
     */
    clearCache(): void {
        this.moduleCache.clear();
        this.pipelineCache.clear();
        console.log('[ShaderCompiler] Cache cleared');
    }

    /**
     * Gets cache statistics.
     */
    getCacheStats(): { modules: number; pipelines: number } {
        return {
            modules: this.moduleCache.size,
            pipelines: this.pipelineCache.size
        };
    }
}
