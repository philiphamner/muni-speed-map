import { useState } from 'react';
import { SpeedMap } from './components/SpeedMap';
import { Controls } from './components/Controls';
import type { MuniLine } from './types';
import './App.css';

function App() {
  const [selectedLines, setSelectedLines] = useState<MuniLine[]>([]);

  return (
    <div className="app">
      <Controls
        selectedLines={selectedLines}
        setSelectedLines={setSelectedLines}
      />
      <SpeedMap selectedLines={selectedLines} />
    </div>
  );
}

export default App;
