import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { MuniLine } from '../types';
import muniRoutes from '../data/muniMetroRoutes.json';

// 511 API key
const API_KEY = 'REDACTED_511_KEY';

interface Vehicle {
  id: string;
  lat: number;
  lon: number;
  routeId: string;
  heading?: number;
  speed?: number;
  timestamp: string;
}

interface SpeedMapProps {
  selectedLines: MuniLine[];
}

export function SpeedMap({ selectedLines }: SpeedMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const popup = useRef<maplibregl.Popup | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Fetch live vehicle positions
  const fetchVehicles = useCallback(async () => {
    try {
      const response = await fetch(
        `https://api.511.org/transit/VehicleMonitoring?api_key=${API_KEY}&agency=SF&format=json`
      );
      const data = await response.json();
      
      const vehicleActivities = data?.Siri?.ServiceDelivery?.VehicleMonitoringDelivery?.VehicleActivity || [];
      
      const metroVehicles: Vehicle[] = vehicleActivities
        .filter((v: any) => {
          const lineRef = v?.MonitoredVehicleJourney?.LineRef;
          return ['J', 'K', 'L', 'M', 'N', 'T'].includes(lineRef);
        })
        .map((v: any) => {
          const journey = v.MonitoredVehicleJourney;
          const location = journey?.VehicleLocation;
          return {
            id: journey?.VehicleRef || Math.random().toString(),
            lat: parseFloat(location?.Latitude) || 0,
            lon: parseFloat(location?.Longitude) || 0,
            routeId: journey?.LineRef || '',
            heading: parseFloat(journey?.Bearing) || 0,
            speed: parseFloat(journey?.Velocity) || undefined,
            timestamp: v?.RecordedAtTime || new Date().toISOString(),
          };
        })
        .filter((v: Vehicle) => v.lat !== 0 && v.lon !== 0);
      
      setVehicles(metroVehicles);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching vehicles:', error);
    }
  }, []);

  // Poll for vehicle updates
  useEffect(() => {
    fetchVehicles();
    const interval = setInterval(fetchVehicles, 15000); // Update every 15 seconds
    return () => clearInterval(interval);
  }, [fetchVehicles]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'carto-dark': {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
              'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
              'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
            ],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap &copy; CARTO',
          },
        },
        layers: [
          {
            id: 'carto-dark-layer',
            type: 'raster',
            source: 'carto-dark',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: [-122.433, 37.767],
      zoom: 12.5,
      minZoom: 11,
      maxZoom: 18,
    });

    map.current.addControl(new maplibregl.NavigationControl(), 'bottom-right');

    popup.current = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
    });

    map.current.on('load', () => {
      setMapLoaded(true);
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Add routes layer when map loads
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Filter routes based on selection
    const filteredRoutes = {
      ...muniRoutes,
      features: muniRoutes.features.filter(
        (f: any) => selectedLines.length === 0 || selectedLines.includes(f.properties.route_id)
      ),
    };

    // Remove existing layers
    if (map.current.getLayer('routes-outline')) map.current.removeLayer('routes-outline');
    if (map.current.getLayer('routes')) map.current.removeLayer('routes');
    if (map.current.getSource('routes')) map.current.removeSource('routes');

    // Add routes source
    map.current.addSource('routes', {
      type: 'geojson',
      data: filteredRoutes as any,
    });

    // Route outline
    map.current.addLayer({
      id: 'routes-outline',
      type: 'line',
      source: 'routes',
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': '#000',
        'line-width': 7,
        'line-opacity': 0.6,
      },
    });

    // Route lines with their official colors
    map.current.addLayer({
      id: 'routes',
      type: 'line',
      source: 'routes',
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': ['get', 'route_color'],
        'line-width': 4,
        'line-opacity': 0.9,
      },
    });

    // Route hover
    map.current.on('mouseenter', 'routes', () => {
      if (map.current) map.current.getCanvas().style.cursor = 'pointer';
    });

    map.current.on('mouseleave', 'routes', () => {
      if (map.current) map.current.getCanvas().style.cursor = '';
      popup.current?.remove();
    });

    map.current.on('mousemove', 'routes', (e) => {
      if (!e.features?.length || !map.current) return;
      const props = e.features[0].properties;
      popup.current
        ?.setLngLat(e.lngLat)
        .setHTML(
          `<div class="popup-content">
            <div class="popup-title" style="color: ${props.route_color}">${props.route_name}</div>
            <div class="popup-direction">${props.direction}</div>
          </div>`
        )
        .addTo(map.current);
    });
  }, [mapLoaded, selectedLines]);

  // Update vehicle markers
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Filter vehicles based on selection
    const filteredVehicles = vehicles.filter(
      (v) => selectedLines.length === 0 || selectedLines.includes(v.routeId as MuniLine)
    );

    // Create GeoJSON for vehicles
    const vehicleGeoJSON = {
      type: 'FeatureCollection' as const,
      features: filteredVehicles.map((v) => ({
        type: 'Feature' as const,
        properties: {
          id: v.id,
          routeId: v.routeId,
          heading: v.heading,
          speed: v.speed,
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [v.lon, v.lat],
        },
      })),
    };

    // Remove existing vehicle layers
    if (map.current.getLayer('vehicles-glow')) map.current.removeLayer('vehicles-glow');
    if (map.current.getLayer('vehicles')) map.current.removeLayer('vehicles');
    if (map.current.getSource('vehicles')) map.current.removeSource('vehicles');

    // Add vehicles source
    map.current.addSource('vehicles', {
      type: 'geojson',
      data: vehicleGeoJSON,
    });

    // Vehicle glow
    map.current.addLayer({
      id: 'vehicles-glow',
      type: 'circle',
      source: 'vehicles',
      paint: {
        'circle-radius': 12,
        'circle-color': '#00ff88',
        'circle-opacity': 0.3,
        'circle-blur': 0.5,
      },
    });

    // Vehicle dots
    map.current.addLayer({
      id: 'vehicles',
      type: 'circle',
      source: 'vehicles',
      paint: {
        'circle-radius': 6,
        'circle-color': '#00ff88',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff',
      },
    });

    // Vehicle hover
    map.current.on('mouseenter', 'vehicles', () => {
      if (map.current) map.current.getCanvas().style.cursor = 'pointer';
    });

    map.current.on('mouseleave', 'vehicles', () => {
      if (map.current) map.current.getCanvas().style.cursor = '';
      popup.current?.remove();
    });

    map.current.on('mousemove', 'vehicles', (e) => {
      if (!e.features?.length || !map.current) return;
      const props = e.features[0].properties;
      popup.current
        ?.setLngLat(e.lngLat)
        .setHTML(
          `<div class="popup-content">
            <div class="popup-title">${props.routeId} Train</div>
            <div class="popup-detail">Vehicle #${props.id}</div>
            ${props.speed ? `<div class="popup-speed">${Math.round(props.speed)} mph</div>` : ''}
          </div>`
        )
        .addTo(map.current);
    });
  }, [vehicles, mapLoaded, selectedLines]);

  return (
    <div className="map-wrapper">
      <div ref={mapContainer} className="map-container" />
      {lastUpdate && (
        <div className="update-badge">
          <span className="live-dot"></span>
          {vehicles.length} trains • Updated {lastUpdate.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
