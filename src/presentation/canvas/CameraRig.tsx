// src/presentation/canvas/CameraRig.tsx

import React, { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { useSimulationStore } from '../state/useSimulationStore';

export const CameraRig: React.FC = () => {
    const { camera, controls } = useThree();
    const { isReady } = useSimulationStore();

    useEffect(() => {
        if (isReady) {
            // Reset camera to the "Hero Shot" position
            camera.position.set(0, 1.4, 2.5);
            camera.lookAt(0, 1.0, 0);

            // Update OrbitControls target to center on the chest/torso
            if (controls) {
                // @ts-ignore - OrbitControls type definition sometimes misses 'target'
                controls.target.set(0, 1.0, 0);
                // @ts-ignore
                controls.update();
            }
        }
    }, [isReady, camera, controls]);

    return null; // This component has no visual representation
};