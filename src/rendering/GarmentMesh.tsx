// src/rendering/GarmentMesh.tsx
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSimulationStore } from '../app/store/simulationStore';
import { useGarmentInteraction } from '../features/interaction/useGarmentInteraction';

export const GarmentMesh = () => {
    const meshRef = useRef<THREE.Mesh>(null);
    const { assets, engine, step, isRunning } = useSimulationStore();

    // 1. Create BufferGeometry from the loaded assets
    const geometry = useMemo(() => {
        if (!assets) return null;
        const geo = new THREE.BufferGeometry();

        // Position Attribute (Dynamic)
        geo.setAttribute('position', new THREE.BufferAttribute(assets.garment.vertices, 3));

        // Normal Attribute (For lighting)
        // Note: We initialize it, but we need to recompute it every frame for correct lighting
        geo.setAttribute('normal', new THREE.BufferAttribute(assets.garment.normals, 3));

        // Index
        geo.setIndex(new THREE.BufferAttribute(assets.garment.indices, 1));

        return geo;
    }, [assets]);

    // Enable Interaction
    useGarmentInteraction(meshRef);

    // 2. The Render Loop
    useFrame((_, delta) => {
        if (!engine || !meshRef.current || !geometry) return;

        // A. Run Physics Step
        if (isRunning) {
            step(delta);
        }

        // B. Sync Visuals with Physics
        // Get the zero-copy view from WASM
        const positions = engine.getPositions();

        // Update the Three.js attribute
        // We can write directly into the buffer if sizes match,
        // but setAttribute is safer for React lifecycles.
        geometry.attributes.position.array.set(positions);
        geometry.attributes.position.needsUpdate = true;

        // C. Recompute Normals for Lighting
        // (Expensive on CPU, but necessary for visual quality until we move to GPU)
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