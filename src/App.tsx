import { useState, useEffect } from 'react';
import { SpeedMap } from './components/SpeedMap';
import { Controls } from './components/Controls';
import { MUNI_LINES, getLinesForCity } from './types';
import type { City } from './types';
import './App.css';

export interface SpeedFilter {
  minSpeed: number;
  maxSpeed: number;
  showNoData: boolean;
}

export type ViewMode = 'raw' | 'segments';

export interface LineStats {
  line: string;
  avgSpeed: number;
  medianSpeed: number;
  count: number;
}

function App() {
  // City selector - SF or LA
  const [city, setCity] = useState<City>('SF');
  
  // Lines selected for the current city
  const [selectedLines, setSelectedLines] = useState<string[]>(
    MUNI_LINES.filter(line => line !== 'F') as string[]
  );
  
  const [vehicleCount, setVehicleCount] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [speedFilter, setSpeedFilter] = useState<SpeedFilter>({
    minSpeed: 0,
    maxSpeed: 50,
    showNoData: true,
  });
  const [showRouteLines, setShowRouteLines] = useState(true);
  const [showStops, setShowStops] = useState(false);
  const [showCrossings, setShowCrossings] = useState(false);
  const [hideStoppedTrains, setHideStoppedTrains] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('raw');
  const [lineStats, setLineStats] = useState<LineStats[]>([]);

  // Reset state when city changes
  useEffect(() => {
    const lines = getLinesForCity(city);
    // For SF, exclude F by default; for LA and Seattle, select all
    if (city === 'SF') {
      setSelectedLines(lines.filter(line => line !== 'F') as string[]);
    } else {
      setSelectedLines([...lines] as string[]);
    }
    // Reset stats and counts when changing city (data is different)
    setLineStats([]);
    setVehicleCount(0);
    setLastUpdate(null);
    // Note: showStops, showCrossings, showRouteLines, speedFilter, viewMode,
    // and hideStoppedTrains are intentionally preserved across city switches
  }, [city]);

  return (
    <div className="app">
      <Controls
        city={city}
        setCity={setCity}
        selectedLines={selectedLines}
        setSelectedLines={setSelectedLines}
        vehicleCount={vehicleCount}
        lastUpdate={lastUpdate}
        speedFilter={speedFilter}
        setSpeedFilter={setSpeedFilter}
        showRouteLines={showRouteLines}
        setShowRouteLines={setShowRouteLines}
        showStops={showStops}
        setShowStops={setShowStops}
        showCrossings={showCrossings}
        setShowCrossings={setShowCrossings}
        hideStoppedTrains={hideStoppedTrains}
        setHideStoppedTrains={setHideStoppedTrains}
        viewMode={viewMode}
        setViewMode={setViewMode}
        lineStats={lineStats}
      />
      <SpeedMap 
        key={city}
        city={city}
        selectedLines={selectedLines}
        speedFilter={speedFilter}
        showRouteLines={showRouteLines}
        showStops={showStops}
        showCrossings={showCrossings}
        hideStoppedTrains={hideStoppedTrains}
        viewMode={viewMode}
        onVehicleUpdate={(count, time, stats) => {
          setVehicleCount(count);
          setLastUpdate(time);
          if (stats) setLineStats(stats);
        }}
      />
    </div>
  );
}

export default App;
