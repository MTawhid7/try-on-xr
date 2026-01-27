// src/app/App.tsx
import { Scene } from '../rendering/Scene';
// FIX: Update import path to the new slice location
import { useSimulationStore } from './store/simulation/useSimulationStore';
import type { ShirtSize } from '../domain/types';

function App() {
    const { isReady, isRunning, toggleSimulation, shirtSize, setShirtSize } = useSimulationStore();

    const sizes: ShirtSize[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

    return (
        <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#1a1a1a' }}>
            <Scene />

            <div style={{
                position: 'absolute',
                top: 20,
                left: 20,
                padding: 15,
                background: 'rgba(0,0,0,0.8)',
                color: 'white',
                borderRadius: 8,
                fontFamily: 'monospace',
                pointerEvents: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
            }}>
                <div>
                    <h3 style={{ margin: '0 0 5px 0' }}>V5 Physics Engine</h3>
                    <p style={{ margin: 0, fontSize: '0.9em', color: '#aaa' }}>
                        Status: {isReady ? (isRunning ? "RUNNING" : "PAUSED") : "LOADING..."}
                    </p>
                </div>

                <div style={{ pointerEvents: 'auto', display: 'flex', gap: '10px' }}>
                    <button
                        onClick={toggleSimulation}
                        disabled={!isReady}
                        style={{
                            padding: '8px 16px',
                            background: isRunning ? '#ff4444' : '#44ff44',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            color: '#000',
                            opacity: isReady ? 1 : 0.5
                        }}
                    >
                        {isRunning ? "STOP" : "START"}
                    </button>
                </div>

                <div style={{ pointerEvents: 'auto' }}>
                    <p style={{ margin: '0 0 5px 0', fontSize: '0.8em', textTransform: 'uppercase' }}>Size Selection</p>
                    <div style={{ display: 'flex', gap: '5px' }}>
                        {sizes.map(size => (
                            <button
                                key={size}
                                onClick={() => setShirtSize(size)}
                                disabled={!isReady}
                                style={{
                                    padding: '5px 10px',
                                    background: shirtSize === size ? '#4488ff' : '#333',
                                    color: 'white',
                                    border: '1px solid #555',
                                    borderRadius: 4,
                                    cursor: 'pointer',
                                    fontSize: '0.8em',
                                    fontWeight: shirtSize === size ? 'bold' : 'normal',
                                    opacity: isReady ? 1 : 0.5
                                }}
                            >
                                {size}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default App;