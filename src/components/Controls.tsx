import type { MuniLine, LAMetroLine, SeattleLinkLine, BostonGreenLine, PortlandMaxLine, SanDiegoTrolleyLine, City } from '../types';
import { LA_METRO_LINE_INFO, SEATTLE_LINK_LINE_INFO, BOSTON_GREEN_LINE_INFO, PORTLAND_MAX_LINE_INFO, SAN_DIEGO_TROLLEY_LINE_INFO, getLinesForCity } from '../types';
import type { SpeedFilter, ViewMode, LineStats } from '../App';

// Official SFMTA colors from GTFS
const MUNI_COLORS: Record<MuniLine, string> = {
  F: '#B49A36',
  J: '#A96614',
  K: '#437C93',
  L: '#942D83',
  M: '#008547',
  N: '#005B95',
  T: '#BF2B45',
};

// Get color for any line (SF, LA, Seattle, Boston, or Portland)
function getLineColor(line: string, city: City): string {
  if (city === 'SF') {
    return MUNI_COLORS[line as MuniLine] || '#666';
  } else if (city === 'LA') {
    return LA_METRO_LINE_INFO[line as LAMetroLine]?.color || '#666';
  } else if (city === 'Seattle') {
    return SEATTLE_LINK_LINE_INFO[line as SeattleLinkLine]?.color || '#666';
  } else if (city === 'Boston') {
    return BOSTON_GREEN_LINE_INFO[line as BostonGreenLine]?.color || '#666';
  } else if (city === 'Portland') {
    return PORTLAND_MAX_LINE_INFO[line as PortlandMaxLine]?.color || '#666';
  } else {
    return SAN_DIEGO_TROLLEY_LINE_INFO[line as SanDiegoTrolleyLine]?.color || '#666';
  }
}

// Get display label for a line
function getLineLabel(line: string, city: City): string {
  if (city === 'SF') {
    return line;
  } else if (city === 'LA') {
    return LA_METRO_LINE_INFO[line as LAMetroLine]?.letter || line;
  } else if (city === 'Seattle') {
    return SEATTLE_LINK_LINE_INFO[line as SeattleLinkLine]?.letter || line;
  } else if (city === 'Boston') {
    return BOSTON_GREEN_LINE_INFO[line as BostonGreenLine]?.letter || line;
  } else if (city === 'Portland') {
    return PORTLAND_MAX_LINE_INFO[line as PortlandMaxLine]?.letter || line;
  } else {
    return SAN_DIEGO_TROLLEY_LINE_INFO[line as SanDiegoTrolleyLine]?.letter || line;
  }
}

// Get line info for tooltip
function getLineInfo(line: string, city: City): string | undefined {
  if (city === 'LA') {
    return LA_METRO_LINE_INFO[line as LAMetroLine]?.name;
  } else if (city === 'Seattle') {
    return SEATTLE_LINK_LINE_INFO[line as SeattleLinkLine]?.name;
  } else if (city === 'Boston') {
    return BOSTON_GREEN_LINE_INFO[line as BostonGreenLine]?.name;
  } else if (city === 'Portland') {
    return PORTLAND_MAX_LINE_INFO[line as PortlandMaxLine]?.name;
  } else if (city === 'San Diego') {
    return SAN_DIEGO_TROLLEY_LINE_INFO[line as SanDiegoTrolleyLine]?.name;
  }
  return undefined;
}

interface ControlsProps {
  city: City;
  setCity: (city: City) => void;
  selectedLines: string[];
  setSelectedLines: (lines: string[]) => void;
  vehicleCount: number;
  lastUpdate: Date | null;
  speedFilter: SpeedFilter;
  setSpeedFilter: (filter: SpeedFilter) => void;
  showRouteLines: boolean;
  setShowRouteLines: (show: boolean) => void;
  showStops: boolean;
  setShowStops: (show: boolean) => void;
  showCrossings: boolean;
  setShowCrossings: (show: boolean) => void;
  hideStoppedTrains: boolean;
  setHideStoppedTrains: (hide: boolean) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  lineStats: LineStats[];
}

export function Controls({ 
  city, 
  setCity, 
  selectedLines, 
  setSelectedLines, 
  vehicleCount, 
  lastUpdate, 
  speedFilter, 
  setSpeedFilter, 
  showRouteLines, 
  setShowRouteLines, 
  showStops, 
  setShowStops, 
  showCrossings,
  setShowCrossings,
  hideStoppedTrains,
  setHideStoppedTrains,
  viewMode, 
  setViewMode, 
  lineStats 
}: ControlsProps) {

  const allLines = getLinesForCity(city);

  const toggleLine = (line: string) => {
    if (selectedLines.includes(line)) {
      setSelectedLines(selectedLines.filter((l) => l !== line));
    } else {
      setSelectedLines([...selectedLines, line]);
    }
  };

  const selectAllLines = () => {
    setSelectedLines([...allLines] as string[]);
  };

  const clearAllLines = () => {
    setSelectedLines([]);
  };

  const cityTitle = city === 'SF' ? 'Muni Speed Map' 
    : city === 'LA' ? 'LA Metro Speed Map' 
    : city === 'Seattle' ? 'Seattle Link Speed Map'
    : city === 'Boston' ? 'Boston Green Line Speed Map'
    : city === 'Portland' ? 'Portland MAX Speed Map'
    : 'San Diego Trolley Speed Map';
  const citySubtitle = city === 'SF' ? 'San Francisco Muni' 
    : city === 'LA' ? 'Los Angeles Metro Rail' 
    : city === 'Seattle' ? 'Sound Transit Link Light Rail'
    : city === 'Boston' ? 'MBTA Green Line & Mattapan'
    : city === 'Portland' ? 'TriMet MAX Light Rail'
    : 'MTS Trolley';

  return (
    <div className="controls-panel">
      {/* City Selector */}
      <div className="city-selector">
        {/* Row 1: California */}
        <button
          className={`city-btn ${city === 'SF' ? 'active' : ''}`}
          onClick={() => setCity('SF')}
        >
          🌉 SF
        </button>
        <button
          className={`city-btn ${city === 'LA' ? 'active' : ''}`}
          onClick={() => setCity('LA')}
        >
          🌴 LA
        </button>
        <button
          className={`city-btn ${city === 'San Diego' ? 'active' : ''}`}
          onClick={() => setCity('San Diego')}
        >
          🌊 SD
        </button>
        {/* Row 2: Pacific NW + East */}
        <button
          className={`city-btn ${city === 'Seattle' ? 'active' : ''}`}
          onClick={() => setCity('Seattle')}
        >
          ☕ Seattle
        </button>
        <button
          className={`city-btn ${city === 'Portland' ? 'active' : ''}`}
          onClick={() => setCity('Portland')}
        >
          🚲 PDX
        </button>
        <button
          className={`city-btn ${city === 'Boston' ? 'active' : ''}`}
          onClick={() => setCity('Boston')}
        >
          🦞 Boston
        </button>
      </div>

      <h1 className="app-title">{cityTitle}</h1>
      <p className="app-subtitle">{citySubtitle}</p>

      {/* Data Status */}
      <div className="status-section">
        <div className="status-row">
          <span className="live-indicator"></span>
          <span>{vehicleCount.toLocaleString()} positions loaded</span>
        </div>
        {lastUpdate && (
          <div className="status-row muted">
            Latest: {lastUpdate.toLocaleTimeString()}
          </div>
        )}
        {vehicleCount === 0 && (
          <div className="status-hint">
            Run <code>npm run collect:{city === 'LA' ? 'la' : city === 'Seattle' ? 'seattle' : city === 'Boston' ? 'boston' : city === 'Portland' ? 'portland' : city === 'San Diego' ? 'sandiego' : 'sf'}</code> to start collecting data
          </div>
        )}
      </div>

      {/* View Mode Toggle */}
      <div className="control-group">
        <div className="control-label">View Mode</div>
        <div className="view-mode-toggle">
          <button
            className={`view-mode-btn ${viewMode === 'raw' ? 'active' : ''}`}
            onClick={() => setViewMode('raw')}
          >
            Raw Data
          </button>
          <button
            className={`view-mode-btn ${viewMode === 'segments' ? 'active' : ''}`}
            onClick={() => setViewMode('segments')}
          >
            Segment Avg
          </button>
        </div>
      </div>

      {/* Line Filter */}
      <div className="control-group">
        <div className="control-label-row">
          <label className="control-label">Filter Lines</label>
          <div className="toggle-group">
            <button 
              className={`toggle-button ${selectedLines.length === allLines.length ? 'active' : ''}`}
              onClick={selectAllLines}
            >
              All
            </button>
            <button 
              className={`toggle-button ${selectedLines.length === 0 ? 'active' : ''}`}
              onClick={clearAllLines}
            >
              None
            </button>
          </div>
        </div>
        <div className="line-buttons">
          {allLines.map((line) => (
            <button
              key={line}
              className={`line-button ${selectedLines.includes(line) ? 'active' : 'inactive'}`}
              style={{
                '--line-color': getLineColor(line, city),
              } as React.CSSProperties}
              onClick={() => toggleLine(line)}
              title={getLineInfo(line, city)}
            >
              {getLineLabel(line, city)}
            </button>
          ))}
        </div>
        <div className="route-lines-toggle">
          <label>
            <input
              type="checkbox"
              checked={showRouteLines}
              onChange={(e) => setShowRouteLines(e.target.checked)}
            />
            Show route lines
          </label>
        </div>
        <div className="route-lines-toggle">
          <label>
            <input
              type="checkbox"
              checked={showStops}
              onChange={(e) => setShowStops(e.target.checked)}
            />
            Show stations
          </label>
        </div>
        <div className="route-lines-toggle">
          <label>
            <input
              type="checkbox"
              checked={showCrossings}
              onChange={(e) => setShowCrossings(e.target.checked)}
            />
            Show grade crossings
          </label>
        </div>
        <div className="route-lines-toggle">
          <label>
            <input
              type="checkbox"
              checked={hideStoppedTrains}
              onChange={(e) => setHideStoppedTrains(e.target.checked)}
            />
            Hide stopped trains (0 mph)
          </label>
        </div>
      </div>

      {/* Speed Filter */}
      <div className="control-group">
        <div className="control-label">Speed Filter</div>
        <div className="speed-filter">
          <div className="speed-slider-row">
            <label>Min: {speedFilter.minSpeed} mph</label>
            <input
              type="range"
              min="0"
              max="50"
              value={speedFilter.minSpeed}
              onChange={(e) => setSpeedFilter({
                ...speedFilter,
                minSpeed: Math.min(Number(e.target.value), speedFilter.maxSpeed)
              })}
              className="speed-slider"
            />
          </div>
          <div className="speed-slider-row">
            <label>Max: {speedFilter.maxSpeed} mph</label>
            <input
              type="range"
              min="0"
              max="50"
              value={speedFilter.maxSpeed}
              onChange={(e) => setSpeedFilter({
                ...speedFilter,
                maxSpeed: Math.max(Number(e.target.value), speedFilter.minSpeed)
              })}
              className="speed-slider"
            />
          </div>
          <button
            className="reset-filter-btn"
            onClick={() => {
              setSpeedFilter({ minSpeed: 0, maxSpeed: 50, showNoData: true });
              setSelectedLines([...allLines] as string[]);
              setShowRouteLines(true);
              setShowStops(true);
            }}
          >
            Reset All Filters
          </button>
        </div>
      </div>

      {/* Speed Legend */}
      <div className="control-group">
        <div className="control-label">Speed Legend</div>
        <div className="speed-legend">
          <div className="speed-legend-item">
            <span className="speed-legend-dot" style={{ backgroundColor: '#ff3333' }}></span>
            <span>&lt; 5 mph (very slow)</span>
          </div>
          <div className="speed-legend-item">
            <span className="speed-legend-dot" style={{ backgroundColor: '#ff9933' }}></span>
            <span>5-10 mph (slow)</span>
          </div>
          <div className="speed-legend-item">
            <span className="speed-legend-dot" style={{ backgroundColor: '#ffdd33' }}></span>
            <span>10-15 mph (moderate)</span>
          </div>
          <div className="speed-legend-item">
            <span className="speed-legend-dot" style={{ backgroundColor: '#88ff33' }}></span>
            <span>15-25 mph (good)</span>
          </div>
          <div className="speed-legend-item">
            <span className="speed-legend-dot" style={{ backgroundColor: '#33ffff' }}></span>
            <span>&gt; 25 mph (fast)</span>
          </div>
        </div>
      </div>

      {/* Line Statistics */}
      {lineStats.length > 0 && (
        <div className="control-group">
          <div className="control-label">Speed by Line</div>
          <div className="line-stats">
            {lineStats.map((stat) => (
              <div key={stat.line} className="line-stat-item">
                <span 
                  className="line-stat-badge"
                  style={{ backgroundColor: getLineColor(stat.line, city) }}
                  title={getLineInfo(stat.line, city)}
                >
                  {getLineLabel(stat.line, city)}
                </span>
                <div className="line-stat-speeds">
                  <span className="line-stat-speed">{stat.avgSpeed.toFixed(1)}</span>
                  <span className="line-stat-label">avg</span>
                  <span className="line-stat-speed">{stat.medianSpeed.toFixed(1)}</span>
                  <span className="line-stat-label">median</span>
                </div>
                <span className="line-stat-count">({stat.count.toLocaleString()})</span>
              </div>
            ))}
          </div>
        </div>
      )}


      {/* Info */}
      <div className="info-section">
        <h3>About This Map</h3>
        <p>
          <strong>How speed is calculated:</strong> Train positions are collected via GPS. 
          {city === 'SF' 
            ? ' Speed is calculated from the distance traveled between consecutive readings (~90 seconds).'
            : city === 'LA'
            ? ' LA Metro provides speed directly in the data stream.'
            : city === 'Boston'
            ? ' MBTA provides speed directly in the data stream.'
            : city === 'Portland'
            ? ' TriMet provides speed directly in the data stream.'
            : city === 'San Diego'
            ? ' Speed is calculated from the distance traveled between consecutive readings (~90 seconds).'
            : ' Speed is calculated from the distance traveled between consecutive readings (~90 seconds).'}
        </p>
        <p>
          <strong>Tunnel gaps:</strong> Some tunnels have no GPS signal, so trains appear to "jump" through them with no data points inside.
        </p>
        <p>
          <strong>Data freshness:</strong> This map displays the last 7 days of collected data.
        </p>
        <p className="data-attribution">
          Data from{' '}
          {city === 'SF' ? (
            <a href="https://511.org/open-data" target="_blank" rel="noopener noreferrer">
              511.org
            </a>
          ) : city === 'LA' ? (
            <a href="https://developer.metro.net/" target="_blank" rel="noopener noreferrer">
              LA Metro API
            </a>
          ) : city === 'Seattle' ? (
            <a href="https://api.pugetsound.onebusaway.org/" target="_blank" rel="noopener noreferrer">
              Sound Transit OneBusAway API
            </a>
          ) : city === 'Boston' ? (
            <a href="https://api-v3.mbta.com/" target="_blank" rel="noopener noreferrer">
              MBTA V3 API
            </a>
          ) : city === 'Portland' ? (
            <a href="https://developer.trimet.org/" target="_blank" rel="noopener noreferrer">
              TriMet API
            </a>
          ) : (
            <a href="https://www.sdmts.com/business-center/app-developers" target="_blank" rel="noopener noreferrer">
              MTS OneBusAway API
            </a>
          )}{' '}
          GTFS-realtime
        </p>
      </div>
    </div>
  );
}
