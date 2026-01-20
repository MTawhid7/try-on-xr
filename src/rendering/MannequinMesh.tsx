// src/rendering/MannequinMesh.tsx
import { useMemo } from 'react';
import * as THREE from 'three';
import { useSimulationStore } from '../app/store/simulationStore';

export const MannequinMesh = () => {
    const { assets } = useSimulationStore();

    const geometry = useMemo(() => {
        if (!assets) return null;
        const geo = new THREE.BufferGeometry();
        // Use the collider data from the store (which came from AssetLoader -> Rust)
        geo.setAttribute('position', new THREE.BufferAttribute(assets.collider.vertices, 3));

        // Note: In Phase 1, these normals are placeholders from AssetLoader.
        // If we want to visualize the Rust-smoothed normals, we'd need to pull them back from WASM.
        // For now, simple flat shading or re-computing in JS is enough to see topology.
        geo.computeVertexNormals();

        geo.setIndex(new THREE.BufferAttribute(assets.collider.indices, 1));
        return geo;
    }, [assets]);

    if (!geometry) return null;

    return (
        <mesh geometry={geometry} receiveShadow>
            {/* Use Wireframe to inspect the decimation quality */}
            <meshStandardMaterial
                color="#aaaaaa"
                roughness={0.8}
                wireframe={true}
            />
        </mesh>
    );
};