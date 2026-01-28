// src/core/entities/Garment.ts
/**
 * Represents the available standard sizes for garments.
 */
export type ShirtSize = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL';

/**
 * Metadata associated with a garment mesh.
 * Useful for future features where we load garments with specific properties.
 */
export interface GarmentMetadata {
    id: string;
    name: string;
    size: ShirtSize;
    fabricType?: 'cotton' | 'denim' | 'silk';
}