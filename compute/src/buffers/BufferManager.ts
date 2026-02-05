// compute/src/buffers/BufferManager.ts
/**
 * @fileoverview GPU buffer allocation and management utilities.
 *
 * Provides a centralized system for creating, tracking, and disposing
 * GPU buffers used in physics simulation.
 */

/**
 * Supported buffer usage patterns for physics simulation.
 */
export type BufferUsageType =
    | 'storage-read'
    | 'storage-readwrite'
    | 'uniform'
    | 'vertex'
    | 'index';

/**
 * Metadata for tracking allocated buffers.
 */
interface BufferInfo {
    readonly label: string;
    readonly size: number;
    readonly usage: GPUBufferUsageFlags;
    readonly buffer: GPUBuffer;
}

/**
 * Centralized GPU buffer management.
 *
 * Handles buffer allocation, tracking, and cleanup. Ensures all buffers
 * are properly disposed when the simulation ends.
 */
export class BufferManager {
    private device: GPUDevice;
    private buffers: Map<string, BufferInfo> = new Map();
    private totalAllocated: number = 0;

    /**
     * Creates a new BufferManager.
     *
     * @param device - The GPU device for buffer allocation.
     */
    constructor(device: GPUDevice) {
        this.device = device;
    }

    /**
     * Allocates a new GPU buffer.
     *
     * @param label - Unique label for the buffer.
     * @param size - Size in bytes (will be aligned to 4).
     * @param usageType - The intended usage pattern.
     * @param initialData - Optional data to upload.
     * @returns The created GPU buffer.
     */
    allocate(
        label: string,
        size: number,
        usageType: BufferUsageType,
        initialData?: ArrayBuffer
    ): GPUBuffer {
        if (this.buffers.has(label)) {
            throw new Error(`[BufferManager] Buffer "${label}" already exists`);
        }

        // Align size to 4 bytes
        const alignedSize = Math.ceil(size / 4) * 4;
        const usage = this.getUsageFlags(usageType);

        const buffer = this.device.createBuffer({
            label,
            size: alignedSize,
            usage,
            mappedAtCreation: initialData !== undefined
        });

        if (initialData) {
            const mapped = new Uint8Array(buffer.getMappedRange());
            mapped.set(new Uint8Array(initialData));
            buffer.unmap();
        }

        this.buffers.set(label, { label, size: alignedSize, usage, buffer });
        this.totalAllocated += alignedSize;

        return buffer;
    }

    /**
     * Allocates a buffer initialized with Float32Array data.
     */
    allocateFloat32(
        label: string,
        data: Float32Array,
        usageType: BufferUsageType
    ): GPUBuffer {
        return this.allocate(
            label,
            data.byteLength,
            usageType,
            data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
        );
    }

    /**
     * Allocates a buffer initialized with Uint32Array data.
     */
    allocateUint32(
        label: string,
        data: Uint32Array,
        usageType: BufferUsageType
    ): GPUBuffer {
        return this.allocate(
            label,
            data.byteLength,
            usageType,
            data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
        );
    }

    /**
     * Gets an existing buffer by label.
     *
     * @param label - The buffer label.
     * @returns The buffer or undefined if not found.
     */
    get(label: string): GPUBuffer | undefined {
        return this.buffers.get(label)?.buffer;
    }

    /**
     * Checks if a buffer exists.
     */
    has(label: string): boolean {
        return this.buffers.has(label);
    }

    /**
     * Disposes a specific buffer.
     *
     * @param label - The buffer label to dispose.
     */
    dispose(label: string): void {
        const info = this.buffers.get(label);
        if (info) {
            info.buffer.destroy();
            this.totalAllocated -= info.size;
            this.buffers.delete(label);
        }
    }

    /**
     * Disposes all managed buffers.
     */
    disposeAll(): void {
        for (const info of this.buffers.values()) {
            info.buffer.destroy();
        }
        this.buffers.clear();
        this.totalAllocated = 0;
        console.log('[BufferManager] All buffers disposed');
    }

    /**
     * Gets the total allocated memory in bytes.
     */
    getTotalAllocated(): number {
        return this.totalAllocated;
    }

    /**
     * Gets the number of active buffers.
     */
    getBufferCount(): number {
        return this.buffers.size;
    }

    /**
     * Logs allocation statistics.
     */
    logStats(): void {
        console.log('[BufferManager] Stats:', {
            buffers: this.buffers.size,
            totalMB: (this.totalAllocated / (1024 * 1024)).toFixed(2)
        });
    }

    // --- Private Helpers ---

    private getUsageFlags(usageType: BufferUsageType): GPUBufferUsageFlags {
        switch (usageType) {
            case 'storage-read':
                return GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC;
            case 'storage-readwrite':
                return GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST;
            case 'uniform':
                return GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST;
            case 'vertex':
                return GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST;
            case 'index':
                return GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST;
            default:
                throw new Error(`Unknown usage type: ${usageType}`);
        }
    }
}
