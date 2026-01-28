// src/presentation/components/overlay/StatusPanel.tsx

import React from 'react';
import { useSimulationStore } from '../../state/useSimulationStore';

export const StatusPanel: React.FC = () => {
    const { isReady, isRunning, isLoading } = useSimulationStore();

    let statusText = "WAITING";
    let statusColor = "#aaa";

    if (isLoading) {
        statusText = "LOADING ASSETS...";
        statusColor = "#fbbf24"; // Amber
    } else if (isReady) {
        if (isRunning) {
            statusText = "RUNNING";
            statusColor = "#44ff44"; // Green
        } else {
            statusText = "PAUSED";
            statusColor = "#aaa";
        }
    }

    return (
        <div>
            <h3 style={{ margin: '0 0 5px 0', fontSize: '1.1em' }}>V5 Physics Engine</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: statusColor,
                    boxShadow: isRunning ? `0 0 8px ${statusColor}` : 'none'
                }} />
                <span style={{ fontSize: '0.85em', color: '#ccc' }}>
                    {statusText}
                </span>
            </div>
        </div>
    );
};