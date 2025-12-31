import type { MuniLine } from '../types';
import { MUNI_LINES } from '../types';

// Official SFMTA colors from GTFS
const MUNI_COLORS: Record<MuniLine, string> = {
  J: '#A96614',
  K: '#437C93',
  L: '#942D83',
  M: '#008547',
  N: '#005B95',
  T: '#BF2B45',
};

interface ControlsProps {
  selectedLines: MuniLine[];
  setSelectedLines: (lines: MuniLine[]) => void;
}

export function Controls({ selectedLines, setSelectedLines }: ControlsProps) {
  const toggleLine = (line: MuniLine) => {
    if (selectedLines.includes(line)) {
      setSelectedLines(selectedLines.filter((l) => l !== line));
    } else {
      setSelectedLines([...selectedLines, line]);
    }
  };

  const selectAllLines = () => {
    setSelectedLines([...MUNI_LINES]);
  };

  const clearAllLines = () => {
    setSelectedLines([]);
  };

  return (
    <div className="controls-panel">
      <h1 className="app-title">Muni Metro Live</h1>
      <p className="app-subtitle">Real-time train positions</p>

      <div className="control-group">
        <div className="control-label-row">
          <label className="control-label">Lines</label>
          <div className="line-actions">
            <button className="text-button" onClick={selectAllLines}>
              All
            </button>
            <span className="divider">|</span>
            <button className="text-button" onClick={clearAllLines}>
              None
            </button>
          </div>
        </div>
        <div className="line-buttons">
          {MUNI_LINES.map((line) => (
            <button
              key={line}
              className={`line-button ${selectedLines.includes(line) || selectedLines.length === 0 ? 'active' : 'inactive'}`}
              style={{
                '--line-color': MUNI_COLORS[line],
              } as React.CSSProperties}
              onClick={() => toggleLine(line)}
            >
              {line}
            </button>
          ))}
        </div>
      </div>

      <div className="info-section">
        <h3>About</h3>
        <p>
          Live positions of Muni Metro trains (J, K, L, M, N, T lines) updated every 15 seconds.
        </p>
        <p>
          <span className="live-indicator"></span> Green dots show active trains
        </p>
      </div>

      <div className="data-note">
        <p>
          Data from{' '}
          <a href="https://511.org/open-data" target="_blank" rel="noopener noreferrer">
            511.org
          </a>{' '}
          GTFS-realtime feed
        </p>
      </div>
    </div>
  );
}
