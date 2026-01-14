#!/usr/bin/env node
/**
 * Parse VTA (San Jose) GTFS data into GeoJSON for the speed map
 * 
 * Downloads from: https://gtfs.vta.org/gtfs_vta.zip
 * Creates:
 *   - src/data/vtaLightRailRoutes.json
 *   - src/data/vtaLightRailStops.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import AdmZip from 'adm-zip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VTA_GTFS_URL = 'https://gtfs.vta.org/gtfs_vta.zip';
const OUTPUT_DIR = path.join(__dirname, '..', 'src', 'data');
const GTFS_DIR = path.join(__dirname, '..', 'gtfs_vta');

// VTA Light Rail colors (official)
const LINE_COLORS = {
  Blue: '#0072CE',
  Green: '#008752',
  Orange: '#F7931D',
};

// Parse CSV with proper quote handling
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  
  const header = splitCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    const cols = splitCSVLine(line);
    const row = {};
    for (let i = 0; i < header.length; i++) {
      row[header[i]] = cols[i] ?? '';
    }
    return row;
  });
}

function splitCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

async function downloadGTFS() {
  // Check if already downloaded
  if (fs.existsSync(path.join(GTFS_DIR, 'routes.txt'))) {
    console.log(`✅ GTFS already downloaded at ${GTFS_DIR}`);
    return;
  }
  
  console.log(`📦 Downloading VTA GTFS from ${VTA_GTFS_URL}...`);
  
  const response = await fetch(VTA_GTFS_URL);
  if (!response.ok) {
    throw new Error(`Failed to download GTFS: ${response.status}`);
  }
  
  const buffer = await response.arrayBuffer();
  const zip = new AdmZip(Buffer.from(buffer));
  
  // Create directory if needed
  if (!fs.existsSync(GTFS_DIR)) {
    fs.mkdirSync(GTFS_DIR, { recursive: true });
  }
  
  // Extract all files
  zip.extractAllTo(GTFS_DIR, true);
  console.log(`✅ Extracted GTFS to ${GTFS_DIR}`);
}

async function parseRoutes() {
  console.log('\n📊 Parsing routes...');
  
  const routesText = fs.readFileSync(path.join(GTFS_DIR, 'routes.txt'), 'utf-8');
  const routes = parseCSV(routesText);
  
  // Filter for light rail (route_type = 0)
  const lightRailRoutes = routes.filter(r => r.route_type === '0');
  
  console.log(`   Found ${lightRailRoutes.length} light rail routes:`);
  lightRailRoutes.forEach(r => {
    console.log(`   - ${r.route_id}: ${r.route_short_name} - ${r.route_long_name}`);
  });
  
  return lightRailRoutes;
}

async function parseTrips(lightRailRouteIds) {
  console.log('\n📊 Parsing trips...');
  
  const tripsText = fs.readFileSync(path.join(GTFS_DIR, 'trips.txt'), 'utf-8');
  const trips = parseCSV(tripsText);
  
  // Filter for light rail trips
  const lightRailTrips = trips.filter(t => lightRailRouteIds.has(t.route_id));
  
  console.log(`   Found ${lightRailTrips.length} light rail trips`);
  
  // Get unique shape_ids for each route
  const shapesByRoute = new Map();
  for (const trip of lightRailTrips) {
    if (!shapesByRoute.has(trip.route_id)) {
      shapesByRoute.set(trip.route_id, new Set());
    }
    if (trip.shape_id) {
      shapesByRoute.get(trip.route_id).add(trip.shape_id);
    }
  }
  
  return { lightRailTrips, shapesByRoute };
}

async function parseShapes(shapeIds) {
  console.log('\n📊 Parsing shapes...');
  
  const shapesText = fs.readFileSync(path.join(GTFS_DIR, 'shapes.txt'), 'utf-8');
  const shapes = parseCSV(shapesText);
  
  // Group by shape_id and filter to our shapes
  const shapePoints = new Map();
  for (const point of shapes) {
    if (!shapeIds.has(point.shape_id)) continue;
    
    if (!shapePoints.has(point.shape_id)) {
      shapePoints.set(point.shape_id, []);
    }
    shapePoints.get(point.shape_id).push({
      lat: parseFloat(point.shape_pt_lat),
      lon: parseFloat(point.shape_pt_lon),
      seq: parseInt(point.shape_pt_sequence, 10),
    });
  }
  
  // Sort each shape by sequence
  for (const [id, points] of shapePoints) {
    points.sort((a, b) => a.seq - b.seq);
    shapePoints.set(id, points.map(p => [p.lon, p.lat]));
  }
  
  console.log(`   Loaded ${shapePoints.size} shape geometries`);
  return shapePoints;
}

async function parseStops(lightRailRouteIds) {
  console.log('\n📊 Parsing stops...');
  
  // First get stop_times to find which stops are used by light rail
  const stopTimesText = fs.readFileSync(path.join(GTFS_DIR, 'stop_times.txt'), 'utf-8');
  const stopTimes = parseCSV(stopTimesText);
  
  const tripsText = fs.readFileSync(path.join(GTFS_DIR, 'trips.txt'), 'utf-8');
  const trips = parseCSV(tripsText);
  
  // Build trip -> route map
  const tripToRoute = new Map();
  for (const trip of trips) {
    tripToRoute.set(trip.trip_id, trip.route_id);
  }
  
  // Find stops used by light rail and which routes serve them
  const stopRoutes = new Map(); // stop_id -> Set of route_ids
  for (const st of stopTimes) {
    const routeId = tripToRoute.get(st.trip_id);
    if (routeId && lightRailRouteIds.has(routeId)) {
      if (!stopRoutes.has(st.stop_id)) {
        stopRoutes.set(st.stop_id, new Set());
      }
      stopRoutes.get(st.stop_id).add(routeId);
    }
  }
  
  // Load stop details
  const stopsText = fs.readFileSync(path.join(GTFS_DIR, 'stops.txt'), 'utf-8');
  const stops = parseCSV(stopsText);
  
  // Filter to light rail stops
  const lightRailStops = stops.filter(s => stopRoutes.has(s.stop_id));
  
  console.log(`   Found ${lightRailStops.length} light rail stops`);
  
  return { lightRailStops, stopRoutes };
}

function getLineName(routeId, routes) {
  const route = routes.find(r => r.route_id === routeId);
  if (!route) return routeId;
  
  // VTA uses names like "Blue", "Green", "Orange" as short names
  const shortName = route.route_short_name || '';
  if (shortName.includes('Blue')) return 'Blue';
  if (shortName.includes('Green')) return 'Green';
  if (shortName.includes('Orange')) return 'Orange';
  
  return shortName || routeId;
}

async function main() {
  console.log('🚊 VTA Light Rail GTFS Parser\n');
  
  // Download GTFS
  await downloadGTFS();
  
  // Parse routes
  const lightRailRoutes = await parseRoutes();
  const lightRailRouteIds = new Set(lightRailRoutes.map(r => r.route_id));
  
  // Parse trips to get shape IDs
  const { shapesByRoute } = await parseTrips(lightRailRouteIds);
  
  // Collect all shape IDs
  const allShapeIds = new Set();
  for (const shapes of shapesByRoute.values()) {
    for (const shapeId of shapes) {
      allShapeIds.add(shapeId);
    }
  }
  
  // Parse shapes
  const shapePoints = await parseShapes(allShapeIds);
  
  // Parse stops
  const { lightRailStops, stopRoutes } = await parseStops(lightRailRouteIds);
  
  // Build routes GeoJSON
  console.log('\n🔧 Building routes GeoJSON...');
  const routeFeatures = [];
  
  for (const route of lightRailRoutes) {
    const lineName = getLineName(route.route_id, lightRailRoutes);
    const color = LINE_COLORS[lineName] || '#666666';
    const shapes = shapesByRoute.get(route.route_id) || new Set();
    
    for (const shapeId of shapes) {
      const coordinates = shapePoints.get(shapeId);
      if (!coordinates || coordinates.length < 2) continue;
      
      routeFeatures.push({
        type: 'Feature',
        properties: {
          shape_id: shapeId,
          route_id: lineName,
          route_name: `${lineName} Line`,
          route_color: color,
        },
        geometry: {
          type: 'LineString',
          coordinates,
        },
      });
    }
  }
  
  const routesGeoJSON = {
    type: 'FeatureCollection',
    generated: new Date().toISOString(),
    source: 'VTA GTFS',
    features: routeFeatures,
  };
  
  // Build stops GeoJSON
  console.log('🔧 Building stops GeoJSON...');
  const stopFeatures = lightRailStops.map(stop => {
    const routes = Array.from(stopRoutes.get(stop.stop_id) || [])
      .map(rid => getLineName(rid, lightRailRoutes));
    
    return {
      type: 'Feature',
      properties: {
        stop_id: stop.stop_id,
        stop_name: stop.stop_name,
        routes,
      },
      geometry: {
        type: 'Point',
        coordinates: [parseFloat(stop.stop_lon), parseFloat(stop.stop_lat)],
      },
    };
  });
  
  const stopsGeoJSON = {
    type: 'FeatureCollection',
    features: stopFeatures,
  };
  
  // Write output files
  console.log('\n💾 Writing output files...');
  
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'vtaLightRailRoutes.json'),
    JSON.stringify(routesGeoJSON, null, 2)
  );
  console.log(`   ✅ vtaLightRailRoutes.json (${routeFeatures.length} features)`);
  
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'vtaLightRailStops.json'),
    JSON.stringify(stopsGeoJSON, null, 2)
  );
  console.log(`   ✅ vtaLightRailStops.json (${stopFeatures.length} features)`);
  
  console.log('\n✨ Done!');
}

main().catch(console.error);
