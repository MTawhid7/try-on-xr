// src/presentation/components/controls/SimulationControls.tsx

import React from 'react';
import { useSimulationStore } from '../../state/useSimulationStore';
import { Button } from '../common/Button';

export const SimulationControls: React.FC = () => {
    const { isReady, isRunning, toggleSimulation } = useSimulationStore();

    return (
        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <Button
                onClick={toggleSimulation}
                disabled={!isReady}
                variant={isRunning ? 'danger' : 'success'}
                style={{ width: '100%' }}
            >
                {isRunning ? "STOP SIMULATION" : "START SIMULATION"}
            </Button>
        </div>
    );
};