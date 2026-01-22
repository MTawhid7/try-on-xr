// src/rendering/MannequinMesh.tsx
import { useMemo } from 'react';
import * as THREE from 'three';
// FIX: Update import path
import { useSimulationStore } from '../app/store/simulation/useSimulationStore';

export const MannequinMesh = () => {
    const { assets } = useSimulationStore();

    const geometry = useMemo(() => {
        if (!assets) return null;
        const geo = new THREE.BufferGeometry();
        // Use the collider data from the store
        geo.setAttribute('position', new THREE.BufferAttribute(assets.collider.vertices, 3));

        // Compute normals for visualization since we don't pull them from Rust yet
        geo.computeVertexNormals();

        geo.setIndex(new THREE.BufferAttribute(assets.collider.indices, 1));
        return geo;
    }, [assets]);

    if (!geometry) return null;

    return (
        <mesh geometry={geometry} receiveShadow>
            {/* Wireframe to visualize the physics proxy */}
            <meshStandardMaterial
                color="#aaaaaa"
                roughness={0.8}
                wireframe={true}
            />
        </mesh>
    );
};