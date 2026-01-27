// src/rendering/GarmentMesh.tsx
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSimulationStore } from '../app/store/simulation/useSimulationStore';
import { useGarmentInteraction } from '../features/interaction/useGarmentInteraction';
import { FabricMaterial } from './materials/FabricMaterial';

export const GarmentMesh = () => {
    const meshRef = useRef<THREE.Mesh>(null);
    const { assets, scaledVertices, engine, step, isRunning } = useSimulationStore();

    const geometry = useMemo(() => {
        if (!assets || !scaledVertices) return null;
        const geo = new THREE.BufferGeometry();

        const positionBuffer = new Float32Array(scaledVertices);

        geo.setAttribute('position', new THREE.BufferAttribute(positionBuffer, 3));
        geo.setAttribute('normal', new THREE.BufferAttribute(assets.garment.normals, 3));
        geo.setIndex(new THREE.BufferAttribute(assets.garment.indices, 1));

        if (assets.garment.uvs) {
            geo.setAttribute('uv', new THREE.BufferAttribute(assets.garment.uvs, 2));
        }

        if (assets.garment.tangents && assets.garment.tangents.length > 0) {
            geo.setAttribute('tangent', new THREE.BufferAttribute(assets.garment.tangents, 4));
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
            {/* NEW: Use the custom Fabric Material */}
            <FabricMaterial color="#3b82f6" />
        </mesh>
    );
};