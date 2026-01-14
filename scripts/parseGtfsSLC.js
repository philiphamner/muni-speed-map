#!/usr/bin/env node
/**
 * Parse UTA GTFS data to extract TRAX Light Rail routes as GeoJSON
 * 
 * This script reads the GTFS files from gtfs_slc/ and generates:
 * - slcTraxRoutes.json: Route geometries with per-line route_id and colors
 * - slcTraxStops.json: Stop locations with route associations
 * 
 * Run with: node scripts/parseGtfsSLC.js
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GTFS_DIR = path.join(__dirname, "../gtfs_slc");
const OUTPUT_DIR = path.join(__dirname, "../src/data");

// TRAX Light Rail routes from UTA GTFS
// route_id -> { name, shortName, color }
const TRAX_ROUTES = {
  "5907": { name: "Blue Line", shortName: "Blue", color: "#004a97" },
  "8246": { name: "Red Line", shortName: "Red", color: "#be2036" },
  "39020": { name: "Green Line", shortName: "Green", color: "#2eb566" },
  "45389": { name: "S-Line", shortName: "S-Line", color: "#77777a" },
};

// Parse CSV file
function parseCsv(filename) {
  const filepath = path.join(GTFS_DIR, filename);
  if (!fs.existsSync(filepath)) {
    console.error(`File not found: ${filepath}`);
    return [];
  }
  
  const content = fs.readFileSync(filepath, "utf8");
  const lines = content.split("\n").filter(line => line.trim());
  const header = lines[0].split(",").map(h => h.trim().replace(/"/g, ""));
  
  return lines.slice(1).map(line => {
    // Handle quoted fields with commas
    const values = [];
    let current = "";
    let inQuotes = false;
    
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    
    const obj = {};
    header.forEach((h, i) => {
      obj[h] = values[i] || "";
    });
    return obj;
  });
}

// Main function
async function main() {
  console.log("🏔️ Parsing UTA GTFS data for TRAX Light Rail...\n");

  // 1. Read trips.txt to get shape_id -> route_id mapping for TRAX only
  console.log("Reading trips.txt...");
  const trips = parseCsv("trips.txt");
  
  const shapeToRoute = new Map();
  const routeShapes = new Map(); // route_id -> Set of shape_ids
  
  for (const trip of trips) {
    const routeId = trip.route_id;
    if (!TRAX_ROUTES[routeId]) continue;
    
    const shapeId = trip.shape_id;
    if (!shapeId) continue;
    
    shapeToRoute.set(shapeId, routeId);
    
    if (!routeShapes.has(routeId)) {
      routeShapes.set(routeId, new Set());
    }
    routeShapes.get(routeId).add(shapeId);
  }
  
  console.log(`Found ${shapeToRoute.size} unique shapes for TRAX routes`);
  for (const [routeId, shapes] of routeShapes) {
    console.log(`  ${TRAX_ROUTES[routeId].shortName}: ${shapes.size} shapes`);
  }

  // 2. Read shapes.txt and build geometries per shape
  console.log("\nReading shapes.txt...");
  const shapes = parseCsv("shapes.txt");
  
  const shapeGeometries = new Map(); // shape_id -> [[lon, lat], ...]
  
  for (const point of shapes) {
    const shapeId = point.shape_id;
    if (!shapeToRoute.has(shapeId)) continue;
    
    if (!shapeGeometries.has(shapeId)) {
      shapeGeometries.set(shapeId, []);
    }
    
    const lat = parseFloat(point.shape_pt_lat);
    const lon = parseFloat(point.shape_pt_lon);
    const seq = parseInt(point.shape_pt_sequence);
    
    shapeGeometries.get(shapeId).push({ lat, lon, seq });
  }
  
  // Sort each shape's points by sequence and convert to coordinate arrays
  for (const [shapeId, points] of shapeGeometries) {
    points.sort((a, b) => a.seq - b.seq);
    shapeGeometries.set(shapeId, points.map(p => [p.lon, p.lat]));
  }
  
  console.log(`Processed ${shapeGeometries.size} shape geometries`);

  // 3. Build GeoJSON features per route
  console.log("\nBuilding route GeoJSON...");
  
  const routeFeatures = [];
  
  for (const [routeId, routeInfo] of Object.entries(TRAX_ROUTES)) {
    const shapes = routeShapes.get(routeId);
    if (!shapes) continue;
    
    // Collect all unique line segments to avoid duplicates
    const seenSegments = new Set();
    const allCoords = [];
    
    for (const shapeId of shapes) {
      const coords = shapeGeometries.get(shapeId);
      if (!coords || coords.length < 2) continue;
      
      // Create a simplified key for this shape to detect near-duplicates
      const startKey = `${coords[0][0].toFixed(4)},${coords[0][1].toFixed(4)}`;
      const endKey = `${coords[coords.length-1][0].toFixed(4)},${coords[coords.length-1][1].toFixed(4)}`;
      const shapeKey = `${startKey}-${endKey}-${coords.length}`;
      
      if (!seenSegments.has(shapeKey)) {
        seenSegments.add(shapeKey);
        allCoords.push(coords);
      }
    }
    
    // Create a MultiLineString feature for this route
    if (allCoords.length > 0) {
      routeFeatures.push({
        type: "Feature",
        properties: {
          route_id: routeInfo.shortName,
          route_name: routeInfo.name,
          route_color: routeInfo.color,
        },
        geometry: {
          type: "MultiLineString",
          coordinates: allCoords,
        },
      });
      
      console.log(`  ${routeInfo.shortName}: ${allCoords.length} line segments`);
    }
  }

  const routesGeoJSON = {
    type: "FeatureCollection",
    features: routeFeatures,
  };

  // 4. Read stops.txt and associate with routes
  console.log("\nReading stops.txt...");
  const stops = parseCsv("stops.txt");
  
  // Read stop_times.txt to find which stops are on which trips
  console.log("Reading stop_times.txt...");
  const stopTimes = parseCsv("stop_times.txt");
  
  // Build trip_id -> route_id map
  const tripToRoute = new Map();
  for (const trip of trips) {
    if (TRAX_ROUTES[trip.route_id]) {
      tripToRoute.set(trip.trip_id, TRAX_ROUTES[trip.route_id].shortName);
    }
  }
  
  // Build stop_id -> Set of route shortNames
  const stopRoutes = new Map();
  for (const st of stopTimes) {
    const routeShortName = tripToRoute.get(st.trip_id);
    if (!routeShortName) continue;
    
    if (!stopRoutes.has(st.stop_id)) {
      stopRoutes.set(st.stop_id, new Set());
    }
    stopRoutes.get(st.stop_id).add(routeShortName);
  }
  
  // Build stop features
  const stopFeatures = [];
  for (const stop of stops) {
    const routes = stopRoutes.get(stop.stop_id);
    if (!routes) continue; // Skip stops not on TRAX
    
    const lat = parseFloat(stop.stop_lat);
    const lon = parseFloat(stop.stop_lon);
    
    if (isNaN(lat) || isNaN(lon)) continue;
    
    stopFeatures.push({
      type: "Feature",
      properties: {
        stop_id: stop.stop_id,
        stop_name: stop.stop_name,
        routes: Array.from(routes),
      },
      geometry: {
        type: "Point",
        coordinates: [lon, lat],
      },
    });
  }
  
  console.log(`Found ${stopFeatures.length} TRAX stops`);

  const stopsGeoJSON = {
    type: "FeatureCollection",
    features: stopFeatures,
  };

  // 5. Write output files
  console.log("\nWriting output files...");
  
  const routesPath = path.join(OUTPUT_DIR, "slcTraxRoutes.json");
  fs.writeFileSync(routesPath, JSON.stringify(routesGeoJSON, null, 2));
  console.log(`  Wrote ${routesPath}`);
  
  const stopsPath = path.join(OUTPUT_DIR, "slcTraxStops.json");
  fs.writeFileSync(stopsPath, JSON.stringify(stopsGeoJSON, null, 2));
  console.log(`  Wrote ${stopsPath}`);
  
  console.log("\n✅ Done!");
}

main().catch(console.error);
