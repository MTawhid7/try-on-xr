// src/app/App.tsx
import { Scene } from '../rendering/Scene';
import { useSimulationStore } from './store/simulationStore';

function App() {
    const { isReady, isRunning, toggleSimulation } = useSimulationStore();

    return (
        <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
            <Scene />

            {/* HUD Overlay */}
            {isReady && (
                <div style={{
                    position: 'absolute',
                    top: 20,
                    left: 20,
                    padding: 15,
                    background: 'rgba(0,0,0,0.8)',
                    color: 'white',
                    borderRadius: 8,
                    fontFamily: 'monospace'
                }}>
                    <h3>V5 Physics Engine</h3>
                    <p>Status: {isRunning ? "RUNNING" : "PAUSED"}</p>
                    <button
                        onClick={toggleSimulation}
                        style={{
                            padding: '8px 16px',
                            background: isRunning ? '#ff4444' : '#44ff44',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        {isRunning ? "STOP" : "START"}
                    </button>
                </div>
            )}
        </div>
    );
}

export default App;