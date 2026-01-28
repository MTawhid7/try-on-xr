// src/presentation/canvas/Lights.tsx

import React from 'react';
import { Environment } from '@react-three/drei';

export const Lights: React.FC = () => {
    return (
        <>
            {/* 1. KEY LIGHT: Main directional source casting shadows */}
            <directionalLight
                position={[5, 10, 5]}
                intensity={1.2}
                castShadow
                shadow-mapSize={[2048, 2048]}
                shadow-bias={-0.0001}
                shadow-normalBias={0.02}
            />

            {/* 2. FILL LIGHT: Softens shadows, ensures the back isn't pitch black */}
            <hemisphereLight
                args={['#ffffff', '#666666', 1.0]}
            />

            {/* 3. ENVIRONMENT: Realistic reflections for PBR materials */}
            <Environment preset="city" blur={0.8} />
        </>
    );
};