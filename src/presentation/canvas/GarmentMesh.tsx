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

    // 1. Construct Initial Geometry
    // We use useMemo to create the geometry container.
    // Initially, it uses the 'scaledVertices' (CPU array) for the static pose.
    // Once simulation starts, we will hot-swap the position attribute with the WASM buffer.
    const geometry = useMemo(() => {
        if (!assets || !scaledVertices) return null;

        const geo = new THREE.BufferGeometry();

        // Initial Position (CPU Copy)
        const positionBuffer = new Float32Array(scaledVertices);
        geo.setAttribute('position', new THREE.BufferAttribute(positionBuffer, 3));

        // Static Attributes
        geo.setAttribute('normal', new THREE.BufferAttribute(assets.garment.normals, 3));
        geo.setIndex(new THREE.BufferAttribute(assets.garment.indices, 1));

        if (assets.garment.uvs && assets.garment.uvs.length > 0) {
            geo.setAttribute('uv', new THREE.BufferAttribute(assets.garment.uvs, 2));
        }

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

        // B. Sync Physics -> Visuals (Zero-Copy)
        // The engine returns a direct view into WASM memory (InterleavedBufferAttribute)
        const physicsAttribute = engine.getPositions() as THREE.BufferAttribute | THREE.InterleavedBufferAttribute;

        // Check if we need to bind the Zero-Copy buffer
        // This happens on the first frame of simulation, or if WASM memory resized.
        if (geometry.attributes.position !== physicsAttribute) {
            geometry.setAttribute('position', physicsAttribute);

            // CRITICAL: When swapping attributes, we must ensure the new one is flagged for upload
            if (physicsAttribute instanceof THREE.InterleavedBufferAttribute) {
                physicsAttribute.data.needsUpdate = true;
            } else {
                physicsAttribute.needsUpdate = true;
            }
        } else {
            // If already bound, just flag for update
            if (physicsAttribute instanceof THREE.InterleavedBufferAttribute) {
                physicsAttribute.data.needsUpdate = true;
            } else {
                physicsAttribute.needsUpdate = true;
            }
        }

        // C. Recompute Normals
        // Necessary because the cloth deforms.
        // Three.js computeVertexNormals supports InterleavedBufferAttribute.
        geometry.computeVertexNormals();
    });

    if (!geometry) return null;

    return (
        <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow>
            <FabricMaterial color="#3b82f6" />
        </mesh>
    );
};