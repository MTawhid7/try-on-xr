// src/presentation/components/overlay/Overlay.tsx

import React from 'react';
import { Panel } from '../common/Panel';
import { StatusPanel } from './StatusPanel';
import { SimulationControls } from '../controls/SimulationControls';
import { SizeSelector } from '../controls/SizeSelector';
import { useSimulationStore } from '../../state/useSimulationStore';
import { useMediaQuery } from '../../hooks';

/**
 * The main UI overlay layer.
 * Positions the control panels and legends on top of the 3D canvas.
 * Manages pointer events to ensure clicks pass through to the canvas where appropriate.
 */
export const Overlay: React.FC = () => {
    const { error } = useSimulationStore();
    const isMobile = useMediaQuery('(max-width: 600px)');

    return (
        <div style={{
            position: 'absolute',
            top: isMobile ? 10 : 20,
            left: isMobile ? 10 : 20,
            zIndex: 10, // Ensure it sits above the Canvas
            pointerEvents: 'none', // Let clicks pass through to Canvas...
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            width: isMobile ? 'min(300px, calc(100vw - 20px))' : '280px'
        }}>
            {/* ...but re-enable pointer events for the panel itself */}
            <div style={{ pointerEvents: 'auto' }}>
                <Panel style={{ padding: isMobile ? '12px' : '15px' }}>
                    <StatusPanel />

                    {error && (
                        <div style={{
                            marginTop: 10,
                            padding: 8,
                            background: 'rgba(255, 0, 0, 0.2)',
                            border: '1px solid #ff4444',
                            borderRadius: 4,
                            fontSize: '0.8em',
                            color: '#ffcccc'
                        }}>
                            <strong>Error:</strong> {error}
                        </div>
                    )}

                    <SimulationControls />
                    <SizeSelector />
                </Panel>
            </div>

            {!isMobile && (
                <div style={{ pointerEvents: 'auto' }}>
                    <Panel style={{ fontSize: '0.75em', color: '#888' }}>
                        <p style={{ margin: 0 }}>
                            <strong>Controls:</strong><br />
                            • Left Click + Drag to Rotate<br />
                            • Right Click to Pan<br />
                            • Scroll to Zoom<br />
                            • Click & Drag Cloth to Interact
                        </p>
                    </Panel>
                </div>
            )}
        </div>
    );
};