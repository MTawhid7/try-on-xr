// src/rendering/MannequinMesh.tsx
import { useMemo } from 'react';
import * as THREE from 'three';
import { useSimulationStore } from '../app/store/simulation/useSimulationStore';

export const MannequinMesh = () => {
    const { assets } = useSimulationStore();

    const geometry = useMemo(() => {
        if (!assets) return null;
        const geo = new THREE.BufferGeometry();

        // Use the collider data from the store
        geo.setAttribute('position', new THREE.BufferAttribute(assets.collider.vertices, 3));

        // Compute smooth normals for visualization
        // (The physics proxy is indexed, so this produces smooth shading)
        geo.computeVertexNormals();

        geo.setIndex(new THREE.BufferAttribute(assets.collider.indices, 1));
        return geo;
    }, [assets]);

    if (!geometry) return null;

    return (
        <mesh geometry={geometry} receiveShadow castShadow>
            <meshStandardMaterial
                color="#999999"  // Neutral grey
                roughness={0.7}  // Matte finish (Clay-like)
                metalness={0.1}  // Slight specular highlight
                side={THREE.FrontSide}
            />
        </mesh>
    );
};