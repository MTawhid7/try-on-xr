// src/rendering/materials/FabricMaterial.tsx
import { useMemo } from 'react';
import * as THREE from 'three';
import { TextureGenerator } from '../../domain/services/TextureGenerator';

interface FabricMaterialProps {
    color?: string;
}

export const FabricMaterial = ({ color = "#4488ff" }: FabricMaterialProps) => {
    const normalMap = useMemo(() => TextureGenerator.generateFabricNormal(), []);

    return (
        <meshStandardMaterial
            color={color}

            // 1. TEXTURE (The Weave)
            normalMap={normalMap}
            normalScale={new THREE.Vector2(0.4, 0.4)} // Subtle bump

            // 2. SURFACE
            roughness={0.8} // Matte cotton look
            metalness={0.0}

            // 3. VISIBILITY
            side={THREE.DoubleSide}

        // REMOVED: shadowSide={DoubleSide}
        // This allows light to pass through the "back" of the front face,
        // illuminating the inside of the shirt.
        />
    );
};