#!/usr/bin/env node
/**
 * Parse Calgary Transit GTFS data to create GeoJSON files for CTrain (light rail) routes
 * Routes: 201 (Red Line), 202 (Blue Line)
 */

const fs = require("fs");
const path = require("path");

const GTFS_DIR = path.join(__dirname, "..", "gtfs_calgary");
const OUTPUT_DIR = path.join(__dirname, "..", "src", "data");

// CTrain route definitions with official Calgary Transit colors
const CTRAIN_ROUTES = {
  "201": { name: "Red Line", shortName: "Red", color: "#EE3124" },
  "202": { name: "Blue Line", shortName: "Blue", color: "#0070BC" },
};

// Parse CSV file
function parseCSV(filename) {
  const content = fs.readFileSync(path.join(GTFS_DIR, filename), "utf-8");
  const lines = content.trim().split("\n");
  const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));
  return lines.slice(1).map((line) => {
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
    headers.forEach((h, i) => {
      obj[h] = values[i] || "";
    });
    return obj;
  });
}

function main() {
  console.log("Parsing Calgary Transit GTFS data...");

  // Parse files
  const routes = parseCSV("routes.txt");
  const trips = parseCSV("trips.txt");
  const shapes = parseCSV("shapes.txt");
  const stops = parseCSV("stops.txt");
  const stopTimes = parseCSV("stop_times.txt");

  // Get CTrain route IDs (route_type = 0)
  const ctrainRoutes = routes.filter((r) => r.route_type === "0");
  console.log("CTrain routes found:", ctrainRoutes.map((r) => `${r.route_id} (${r.route_short_name})`));

  // Map route_id prefixes to short names (201-xxxxx -> 201)
  const routeIdToShortName = {};
  ctrainRoutes.forEach((r) => {
    const prefix = r.route_id.split("-")[0];
    routeIdToShortName[r.route_id] = prefix;
  });

  // Get trips for CTrain routes and their shape_ids
  const ctrainRouteIds = new Set(ctrainRoutes.map((r) => r.route_id));
  const ctrainTrips = trips.filter((t) => ctrainRouteIds.has(t.route_id));
  
  // Group shapes by route short name (201 or 202) and direction
  const routeShapes = {};
  ctrainTrips.forEach((t) => {
    const shortName = t.route_id.split("-")[0];
    const key = `${shortName}_${t.direction_id}`;
    if (!routeShapes[key]) {
      routeShapes[key] = new Set();
    }
    routeShapes[key].add(t.shape_id);
  });

  console.log("Route-direction shape counts:");
  Object.entries(routeShapes).forEach(([key, shapes]) => {
    console.log(`  ${key}: ${shapes.size} unique shapes`);
  });

  // Build shape coordinates lookup
  const shapeCoords = {};
  console.log("Loading shapes...");
  for (const s of shapes) {
    const id = s.shape_id;
    if (!shapeCoords[id]) shapeCoords[id] = [];
    shapeCoords[id].push({
      lat: parseFloat(s.shape_pt_lat),
      lon: parseFloat(s.shape_pt_lon),
      seq: parseInt(s.shape_pt_sequence),
    });
  }
  // Sort by sequence
  for (const id in shapeCoords) {
    shapeCoords[id].sort((a, b) => a.seq - b.seq);
  }
  console.log(`Loaded ${Object.keys(shapeCoords).length} shapes`);

  // Find longest shape for each route-direction combination
  const routeFeatures = [];
  
  for (const [key, shapeIds] of Object.entries(routeShapes)) {
    const [shortName, direction] = key.split("_");
    const routeInfo = CTRAIN_ROUTES[shortName];
    
    if (!routeInfo) continue;

    let longestShape = null;
    let maxLength = 0;

    for (const shapeId of shapeIds) {
      if (shapeCoords[shapeId] && shapeCoords[shapeId].length > maxLength) {
        maxLength = shapeCoords[shapeId].length;
        longestShape = shapeId;
      }
    }

    if (longestShape) {
      const coords = shapeCoords[longestShape].map((p) => [p.lon, p.lat]);
      
      routeFeatures.push({
        type: "Feature",
        properties: {
          route_id: shortName,
          route_name: routeInfo.name,
          route_color: routeInfo.color,
          shape_id: longestShape,
          direction_id: direction,
        },
        geometry: {
          type: "LineString",
          coordinates: coords,
        },
      });
      console.log(
        `  ${shortName} ${routeInfo.name} Dir ${direction}: ${coords.length} points from shape ${longestShape}`
      );
    }
  }

  // Get CTrain stops
  console.log("\nFinding CTrain stations...");
  const ctrainTripIds = new Set(ctrainTrips.map((t) => t.trip_id));
  
  // Find stops served by CTrain
  const ctrainStopIds = new Set();
  const stopRoutes = {};
  
  console.log("Processing stop_times (this may take a moment)...");
  for (const st of stopTimes) {
    if (ctrainTripIds.has(st.trip_id)) {
      ctrainStopIds.add(st.stop_id);
      if (!stopRoutes[st.stop_id]) stopRoutes[st.stop_id] = new Set();
      const trip = ctrainTrips.find((t) => t.trip_id === st.trip_id);
      if (trip) {
        stopRoutes[st.stop_id].add(trip.route_id.split("-")[0]);
      }
    }
  }
  
  console.log(`Found ${ctrainStopIds.size} CTrain stop IDs`);

  // Create stop features
  const stopFeatures = stops
    .filter((s) => ctrainStopIds.has(s.stop_id))
    .map((s) => ({
      type: "Feature",
      properties: {
        stop_id: s.stop_id,
        stop_name: s.stop_name,
        routes: [...(stopRoutes[s.stop_id] || [])].sort(),
      },
      geometry: {
        type: "Point",
        coordinates: [parseFloat(s.stop_lon), parseFloat(s.stop_lat)],
      },
    }));

  console.log(`Created ${stopFeatures.length} station features`);

  // Create GeoJSON files
  const routesGeoJSON = {
    type: "FeatureCollection",
    features: routeFeatures,
  };

  const stopsGeoJSON = {
    type: "FeatureCollection",
    features: stopFeatures,
  };

  // Write output files
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "calgaryLightRailRoutes.json"),
    JSON.stringify(routesGeoJSON, null, 2)
  );
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "calgaryLightRailStops.json"),
    JSON.stringify(stopsGeoJSON, null, 2)
  );

  console.log("\nCreated:");
  console.log(
    `  - src/data/calgaryLightRailRoutes.json (${routeFeatures.length} route shapes)`
  );
  console.log(
    `  - src/data/calgaryLightRailStops.json (${stopFeatures.length} stops)`
  );

  // Also output trip_id to route mapping for the collector
  const tripToRoute = {};
  ctrainTrips.forEach((t) => {
    tripToRoute[t.trip_id] = t.route_id.split("-")[0];
  });
  
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "calgaryTripToRoute.json"),
    JSON.stringify(tripToRoute, null, 2)
  );
  console.log(`  - src/data/calgaryTripToRoute.json (${Object.keys(tripToRoute).length} trip mappings)`);
}

main();
