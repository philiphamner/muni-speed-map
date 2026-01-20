#!/usr/bin/env node
/**
 * Parse Baltimore MTA Light RailLink GTFS data to extract routes as GeoJSON
 * 
 * Baltimore Light Rail is a single route (LIGHT RAILLINK) with multiple branches:
 * - Hunt Valley (north terminus)
 * - BWI Airport (south branch)
 * - Glen Burnie / Cromwell (south branch)
 * - Penn-Camden Shuttle (downtown spur)
 * 
 * We treat the main line as one unified route since trains run through-routed.
 * 
 * This script reads the GTFS files from gtfs_baltimore/ and generates:
 * - baltimoreLightRailRoutes.json: Route geometries
 * - baltimoreLightRailStops.json: Stop locations
 * 
 * Run with: node scripts/parseGtfsBaltimore.js
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GTFS_DIR = path.join(__dirname, "../gtfs_baltimore");
const OUTPUT_DIR = path.join(__dirname, "../src/data");

// Baltimore Light Rail branches
// Since this is really one line with branches, we'll create branch-based identifiers
// for filtering, but visually it's one system
const BRANCHES = {
  "Hunt Valley": { shortName: "HV", color: "#007499" },      // MTA teal
  "BWI Airport": { shortName: "BWI", color: "#007499" },     // Same color - unified line
  "Glen Burnie": { shortName: "GB", color: "#007499" },      // Same color - unified line
  "Penn-Camden": { shortName: "PC", color: "#007499" },      // Same color - unified line
};

// Shape ID patterns to branch mapping
function getBranchFromShapeId(shapeId) {
  if (!shapeId) return "Light Rail";
  
  const id = shapeId.toUpperCase();
  
  // Penn-Camden shuttle
  if (id.includes("PENN") || id.includes("CAMDEN") || id.includes("CAM_") || id.includes("_CAM")) {
    return "Penn-Camden";
  }
  // BWI branch
  if (id.includes("BWI")) {
    return "BWI Airport";
  }
  // Glen Burnie / Fairgrounds branch  
  if (id.includes("GB") || id.includes("FG")) {
    return "Glen Burnie";
  }
  // Hunt Valley (main northern terminus)
  if (id.includes("HV")) {
    return "Hunt Valley";
  }
  // North Avenue patterns are on the main line
  if (id.includes("NA")) {
    return "Main Line";
  }
  
  return "Light Rail";
}

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
  console.log("🚇 Parsing Baltimore MTA Light RailLink GTFS data...\n");

  // 1. Read trips.txt to get shape_id list
  console.log("Reading trips.txt...");
  const trips = parseCsv("trips.txt");
  
  const shapeIds = new Set();
  const shapeHeadsigns = new Map(); // shape_id -> headsign for debugging
  
  for (const trip of trips) {
    const shapeId = trip.shape_id;
    if (!shapeId) continue;
    
    shapeIds.add(shapeId);
    if (!shapeHeadsigns.has(shapeId)) {
      shapeHeadsigns.set(shapeId, trip.trip_headsign);
    }
  }
  
  console.log(`Found ${shapeIds.size} unique shapes`);
  for (const shapeId of shapeIds) {
    console.log(`  ${shapeId} -> ${getBranchFromShapeId(shapeId)} (${shapeHeadsigns.get(shapeId)})`);
  }

  // 2. Read shapes.txt and build geometries per shape
  console.log("\nReading shapes.txt...");
  const shapes = parseCsv("shapes.txt");
  
  const shapeGeometries = new Map(); // shape_id -> [[lon, lat], ...]
  
  for (const point of shapes) {
    const shapeId = point.shape_id;
    if (!shapeIds.has(shapeId)) continue;
    
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

  // 3. Build a single unified GeoJSON feature for the Light Rail system
  // We'll create a MultiLineString with all unique segments
  console.log("\nBuilding route GeoJSON...");
  
  const seenSegments = new Set();
  const allCoords = [];
  
  for (const shapeId of shapeIds) {
    const coords = shapeGeometries.get(shapeId);
    if (!coords || coords.length < 2) continue;
    
    // Create a simplified key for this shape to detect near-duplicates
    const startKey = `${coords[0][0].toFixed(4)},${coords[0][1].toFixed(4)}`;
    const endKey = `${coords[coords.length-1][0].toFixed(4)},${coords[coords.length-1][1].toFixed(4)}`;
    const shapeKey = `${startKey}-${endKey}-${coords.length}`;
    
    // Also check reverse direction
    const reverseKey = `${endKey}-${startKey}-${coords.length}`;
    
    if (!seenSegments.has(shapeKey) && !seenSegments.has(reverseKey)) {
      seenSegments.add(shapeKey);
      allCoords.push(coords);
    }
  }
  
  console.log(`Created ${allCoords.length} unique line segments after deduplication`);

  // Create a single feature for the entire Light Rail system
  const routeFeatures = [{
    type: "Feature",
    properties: {
      route_id: "Light Rail",
      route_name: "Light RailLink",
      route_color: "#007499",
    },
    geometry: {
      type: "MultiLineString",
      coordinates: allCoords,
    },
  }];

  const routesGeoJSON = {
    type: "FeatureCollection",
    features: routeFeatures,
  };

  // 4. Read stops.txt
  console.log("\nReading stops.txt...");
  const stops = parseCsv("stops.txt");
  
  // Build stop features - filter to just Light Rail stops
  const stopFeatures = [];
  const seenStopNames = new Set(); // Avoid duplicate stop names
  
  for (const stop of stops) {
    const lat = parseFloat(stop.stop_lat);
    const lon = parseFloat(stop.stop_lon);
    
    if (isNaN(lat) || isNaN(lon)) continue;
    
    // Clean up stop name (remove direction suffix)
    let stopName = stop.stop_name;
    stopName = stopName.replace(/\s*\(Northbound\)$/i, "");
    stopName = stopName.replace(/\s*\(Southbound\)$/i, "");
    stopName = stopName.trim();
    
    // Skip duplicate stop names (we just need one point per station)
    if (seenStopNames.has(stopName)) continue;
    seenStopNames.add(stopName);
    
    stopFeatures.push({
      type: "Feature",
      properties: {
        stop_id: stop.stop_id,
        stop_name: stopName,
        routes: ["Light Rail"],
      },
      geometry: {
        type: "Point",
        coordinates: [lon, lat],
      },
    });
  }
  
  console.log(`Found ${stopFeatures.length} unique Light Rail stations`);

  const stopsGeoJSON = {
    type: "FeatureCollection",
    features: stopFeatures,
  };

  // 5. Write output files
  console.log("\nWriting output files...");
  
  const routesPath = path.join(OUTPUT_DIR, "baltimoreLightRailRoutes.json");
  fs.writeFileSync(routesPath, JSON.stringify(routesGeoJSON, null, 2));
  console.log(`  Wrote ${routesPath}`);
  
  const stopsPath = path.join(OUTPUT_DIR, "baltimoreLightRailStops.json");
  fs.writeFileSync(stopsPath, JSON.stringify(stopsGeoJSON, null, 2));
  console.log(`  Wrote ${stopsPath}`);
  
  console.log("\n✅ Done!");
}

main().catch(console.error);
