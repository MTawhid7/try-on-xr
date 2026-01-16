// src/rendering/MannequinMesh.tsx
import { useMemo } from 'react';
import * as THREE from 'three';
import { useSimulationStore } from '../app/store/simulationStore';

export const MannequinMesh = () => {
    const { assets } = useSimulationStore();

    const geometry = useMemo(() => {
        if (!assets) return null;
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(assets.collider.vertices, 3));
        geo.setAttribute('normal', new THREE.BufferAttribute(assets.collider.normals, 3));
        geo.setIndex(new THREE.BufferAttribute(assets.collider.indices, 1));
        return geo;
    }, [assets]);

    if (!geometry) return null;

    return (
        <mesh geometry={geometry} receiveShadow>
            <meshStandardMaterial
                color="#aaaaaa"
                roughness={0.8}
            />
        </mesh>
    );
};