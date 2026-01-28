// src/presentation/canvas/GarmentMesh.tsx

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSimulationStore } from '../state/useSimulationStore';
import { useGarmentInteraction } from '../hooks/useGarmentInteraction';
import { FabricMaterial } from '../materials/FabricMaterial';

export const GarmentMesh: React.FC = () => {
    const meshRef = useRef<THREE.Mesh>(null);
    const { assets, scaledVertices, engine, step, isRunning } = useSimulationStore();

    // 1. Construct Geometry
    // We recreate this only when the assets or the size (scaledVertices) changes.
    const geometry = useMemo(() => {
        if (!assets || !scaledVertices) return null;

        const geo = new THREE.BufferGeometry();

        // Position Attribute (Dynamic - updated every frame)
        // We clone the scaledVertices to ensure we have a fresh buffer for Three.js
        const positionBuffer = new Float32Array(scaledVertices);
        geo.setAttribute('position', new THREE.BufferAttribute(positionBuffer, 3));

        // Static Attributes (Normals, Indices, UVs)
        geo.setAttribute('normal', new THREE.BufferAttribute(assets.garment.normals, 3));
        geo.setIndex(new THREE.BufferAttribute(assets.garment.indices, 1));

        if (assets.garment.uvs && assets.garment.uvs.length > 0) {
            geo.setAttribute('uv', new THREE.BufferAttribute(assets.garment.uvs, 2));
        }

        // Tangents (Required for Anisotropic lighting)
        if (assets.garment.tangents && assets.garment.tangents.length > 0) {
            geo.setAttribute('tangent', new THREE.BufferAttribute(assets.garment.tangents, 4));
        }

        return geo;
    }, [assets, scaledVertices]);

    // 2. Attach Interaction Logic
    useGarmentInteraction(meshRef);

    // 3. The Render Loop
    useFrame((_, delta) => {
        if (!engine || !meshRef.current || !geometry) return;

        // A. Step Physics
        if (isRunning) {
            step(delta);
        }

        // B. Sync Physics -> Visuals
        // Get the Zero-Copy view from WASM
        const positions = engine.getPositions();

        // Update the Three.js attribute
        // We assume the topology hasn't changed, so we just copy values.
        const posAttr = geometry.attributes.position;
        (posAttr.array as Float32Array).set(positions);
        posAttr.needsUpdate = true;

        // C. Recompute Normals
        // Necessary because the cloth deforms.
        geometry.computeVertexNormals();
    });

    if (!geometry) return null;

    return (
        <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow>
            <FabricMaterial color="#3b82f6" />
        </mesh>
    );
};