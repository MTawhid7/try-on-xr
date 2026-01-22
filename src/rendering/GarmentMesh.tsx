// src/rendering/GarmentMesh.tsx
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
// FIX: Update import path
import { useSimulationStore } from '../app/store/simulation/useSimulationStore';
import { useGarmentInteraction } from '../features/interaction/useGarmentInteraction';

export const GarmentMesh = () => {
    const meshRef = useRef<THREE.Mesh>(null);
    const { assets, scaledVertices, engine, step, isRunning } = useSimulationStore();

    const geometry = useMemo(() => {
        if (!assets || !scaledVertices) return null;
        const geo = new THREE.BufferGeometry();

        // Create a NEW Float32Array copy to prevent store corruption
        const positionBuffer = new Float32Array(scaledVertices);

        geo.setAttribute('position', new THREE.BufferAttribute(positionBuffer, 3));
        geo.setAttribute('normal', new THREE.BufferAttribute(assets.garment.normals, 3));
        geo.setIndex(new THREE.BufferAttribute(assets.garment.indices, 1));

        if (assets.garment.uvs) {
            geo.setAttribute('uv', new THREE.BufferAttribute(assets.garment.uvs, 2));
        }

        return geo;
    }, [assets, scaledVertices]);

    useGarmentInteraction(meshRef);

    useFrame((_, delta) => {
        if (!engine || !meshRef.current || !geometry) return;

        if (isRunning) {
            step(delta);
        }

        const positions = engine.getPositions();

        geometry.attributes.position.array.set(positions);
        geometry.attributes.position.needsUpdate = true;
        geometry.computeVertexNormals();
    });

    if (!geometry) return null;

    return (
        <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow>
            <meshStandardMaterial
                color="#4488ff"
                roughness={0.6}
                side={THREE.DoubleSide}
            />
        </mesh>
    );
};