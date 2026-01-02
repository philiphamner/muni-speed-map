# 🚊 Transit Speed Map

A real-time visualization tool for analyzing light rail and streetcar speeds across major US cities. Identify slow zones, compare performance, and support data-driven transit advocacy.

![Transit Speed Map Screenshot](docs/screenshot-sf.png)

## 🌆 Supported Cities

| City | System | Lines | Status |
|------|--------|-------|--------|
| 🌉 **San Francisco** | Muni Metro | F, J, K, L, M, N, T | ✅ Collecting |
| 🌴 **Los Angeles** | Metro Rail | A, B, C, D, E, K | ✅ Collecting |
| ☕ **Seattle** | Link Light Rail | 1 Line, 2 Line, T Line | ⏳ Awaiting API key |
| 🦞 **Boston** | MBTA Green Line | B, C, D, E, Mattapan | ✅ Collecting |
| 🚲 **Portland** | MAX Light Rail | Blue, Green, Orange, Red, Yellow | ⏳ Awaiting API key |
| 🌊 **San Diego** | MTS Trolley | Blue, Orange, Green, Copper | ⏳ Awaiting API key |

## ✨ Features

### Speed Visualization
- **Color-coded data points**: Red (slow) → Yellow → Cyan (fast)
- **Raw data view**: Individual GPS readings with calculated speeds
- **Segment average view**: 100m track segments colored by average speed

![Segment View](docs/screenshot-segments.png)

### Filtering & Analysis
- Filter by transit line
- Filter by speed range (min/max mph)
- Hide stopped trains (0 mph)
- Toggle route lines, stations, and grade crossings

### Grade Crossings
- Street-level railroad crossings from OpenStreetMap
- Identify potential conflict points that slow trains
- Clustered markers to reduce visual clutter

### Statistics
- Average and median speed per line
- Lines ranked fastest to slowest
- Real-time position counts

## 🛠️ Setup

### Prerequisites
- Node.js 20+
- A Supabase account (free tier works)

### Installation

```bash
# Clone the repository
git clone https://github.com/philiphamner/muni-speed-map.git
cd muni-speed-map

# Install dependencies
npm install

# Create .env file with your Supabase credentials
cp .env.example .env
# Edit .env with your SUPABASE_URL and SUPABASE_ANON_KEY
```

### Database Setup

Run this SQL in your Supabase SQL editor:

```sql
CREATE TABLE vehicle_positions (
  id SERIAL PRIMARY KEY,
  vehicle_id TEXT NOT NULL,
  route_id TEXT,
  direction_id TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  speed DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  city TEXT
);

CREATE INDEX idx_vehicle_positions_recorded_at ON vehicle_positions(recorded_at DESC);
CREATE INDEX idx_vehicle_positions_city ON vehicle_positions(city);
```

### Running the App

```bash
# Start the development server
npm run dev

# In another terminal, start data collection
npm run collect:sf      # San Francisco
npm run collect:la      # Los Angeles
npm run collect:boston  # Boston

# Or run all collectors at once
npm run collect:all
```

## 📊 Data Collection

### How Speed is Calculated

- **SF, Seattle, San Diego**: Speed calculated from GPS distance ÷ time between consecutive readings (~90 seconds apart)
- **LA, Boston, Portland**: Speed reported directly by the transit agency's API

### API Keys Required

| City | API | Where to Get Key |
|------|-----|------------------|
| SF | 511.org | https://511.org/open-data |
| LA | Metro WebSocket | No key needed |
| Seattle | Sound Transit | https://www.soundtransit.org/help-contacts/business-information/open-transit-data-otd |
| Boston | MBTA | https://api-v3.mbta.com/ |
| Portland | TriMet | https://developer.trimet.org/appid/registration/ |
| San Diego | MTS | https://www.sdmts.com/business-center/app-developers |

### Data Retention

- Frontend displays last 7 days of data
- Supabase `pg_cron` job deletes data older than 8 days (optional)

## 🗂️ Project Structure

```
muni-speed-map/
├── src/
│   ├── components/
│   │   ├── SpeedMap.tsx      # Main map component
│   │   └── Controls.tsx      # Sidebar with filters
│   ├── data/                 # Generated GeoJSON files
│   │   ├── *Routes.json      # Transit line geometries
│   │   ├── *Stops.json       # Station locations
│   │   └── *Crossings.json   # Grade crossing data
│   └── types.ts              # TypeScript definitions
├── scripts/
│   ├── collectData*.js       # Data collection scripts
│   ├── parseGtfs*.js         # GTFS route parsers
│   ├── parseStops*.js        # GTFS stop parsers
│   └── fetchCrossings.js     # Grade crossing fetcher
└── gtfs_*/                   # Raw GTFS data (not in git)
```

## 🔄 Updating GTFS Data

If transit routes change, refresh the static data:

```bash
# 1. Download fresh GTFS data to gtfs_cityname/
# 2. Re-run parsers
npm run parse-gtfs:sf
npm run parse-stops:sf
npm run fetch-crossings
```

## 🎯 Use Cases

### Transit Advocacy
- Identify slow zones caused by traffic conflicts
- Support arguments for transit priority signals
- Compare street-running vs. grade-separated performance

### Planning & Analysis
- Understand real-world operating speeds vs. scheduled
- Identify patterns by time of day (future feature)
- Compare performance across cities

## 📝 License

MIT License - feel free to use and adapt for transit advocacy in your city!

## 🙏 Data Sources

- **SF**: [511.org](https://511.org/open-data) GTFS-realtime
- **LA**: [LA Metro API](https://developer.metro.net/)
- **Seattle**: [Sound Transit OneBusAway](https://www.soundtransit.org/help-contacts/business-information/open-transit-data-otd)
- **Boston**: [MBTA V3 API](https://api-v3.mbta.com/)
- **Portland**: [TriMet Developer Resources](https://developer.trimet.org/)
- **San Diego**: [MTS Developer Resources](https://www.sdmts.com/business-center/app-developers)
- **Grade Crossings**: [OpenStreetMap](https://www.openstreetmap.org/) via Overpass API
- **Base Map**: [CARTO Dark Matter](https://carto.com/basemaps/)

---

*Built with React, MapLibre GL, and Supabase*
