// src/domain/config/SizingStandards.ts

// src/domain/config/SizingStandards.ts

export type ShirtSize = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL';

export interface SizeDimensions {
    chestWidth: number; // cm
    bodyLength: number; // cm
}

export const SHIRT_STANDARDS: Record<ShirtSize, SizeDimensions> = {
    'XS': { chestWidth: 45.0, bodyLength: 67.0 },
    'S': { chestWidth: 47.0, bodyLength: 70.0 },
    'M': { chestWidth: 51.0, bodyLength: 73.0 }, // ANCHOR
    'L': { chestWidth: 55.0, bodyLength: 75.0 },
    'XL': { chestWidth: 59.5, bodyLength: 77.5 },
    'XXL': { chestWidth: 63.0, bodyLength: 80.0 },
};

export const ANCHOR_SIZE: ShirtSize = 'M';