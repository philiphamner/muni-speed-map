#!/usr/bin/env node
/**
 * Fetch Railway Tunnels and Bridges from OpenStreetMap via Overpass API
 *
 * Downloads tunnel and bridge data for rail lines in all cities,
 * filters them to only include track near our transit lines,
 * and saves them as GeoJSON files for use in the map.
 *
 * Run with: node scripts/fetchTunnelsBridges.js
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Distance threshold - only include track within this distance of our routes
// 75m accounts for minor geometry differences between GTFS routes and OSM rail centerlines
const PROXIMITY_METERS = 75;

// Haversine distance between two points in meters
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Calculate minimum distance from a point to a line segment
function distanceToSegment(lat, lon, lat1, lon1, lat2, lon2) {
  const A = lat - lat1;
  const B = lon - lon1;
  const C = lat2 - lat1;
  const D = lon2 - lon1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) param = dot / lenSq;

  let nearLat, nearLon;

  if (param < 0) {
    nearLat = lat1;
    nearLon = lon1;
  } else if (param > 1) {
    nearLat = lat2;
    nearLon = lon2;
  } else {
    nearLat = lat1 + param * C;
    nearLon = lon1 + param * D;
  }

  return haversineDistance(lat, lon, nearLat, nearLon);
}

// Check if a way segment is near any route
function isWayNearRoutes(wayGeometry, routeCoords) {
  // Check if any point of the way is near our routes
  for (const point of wayGeometry) {
    for (const coords of routeCoords) {
      for (let i = 0; i < coords.length - 1; i++) {
        const [lon1, lat1] = coords[i];
        const [lon2, lat2] = coords[i + 1];
        const distance = distanceToSegment(
          point.lat,
          point.lon,
          lat1,
          lon1,
          lat2,
          lon2
        );
        if (distance <= PROXIMITY_METERS) {
          return true;
        }
      }
    }
  }
  return false;
}

// Data directory for routes and output
const DATA_DIR = path.join(__dirname, "..", "src", "data");

// City configurations (same as fetchMaxspeed.js)
const CITIES = {
  SF: {
    name: "San Francisco",
    bbox: [37.65, -122.55, 37.85, -122.35],
    routesFile: "muniMetroRoutes.json",
    outputFile: "sfTunnelsBridges.json",
    railwayTypes: "light_rail|tram|subway",
  },
  LA: {
    name: "Los Angeles",
    bbox: [33.76, -118.5, 34.18, -117.74],
    routesFile: "laMetroRoutes.json",
    outputFile: "laTunnelsBridges.json",
    railwayTypes: "light_rail|subway",
  },
  Seattle: {
    name: "Seattle",
    bbox: [47.23, -122.46, 47.82, -122.1],
    routesFile: "seattleLinkRoutes.json",
    outputFile: "seattleTunnelsBridges.json",
    railwayTypes: "light_rail",
  },
  Boston: {
    name: "Boston",
    bbox: [42.25, -71.2, 42.4, -71.0],
    routesFile: "bostonGreenLineRoutes.json",
    outputFile: "bostonTunnelsBridges.json",
    railwayTypes: "light_rail|tram|subway",
  },
  Portland: {
    name: "Portland",
    bbox: [45.4, -122.85, 45.6, -122.5],
    routesFile: "portlandMaxRoutes.json",
    outputFile: "portlandTunnelsBridges.json",
    railwayTypes: "light_rail|tram",
  },
  "San Diego": {
    name: "San Diego",
    bbox: [32.65, -117.2, 32.95, -116.95],
    routesFile: "sanDiegoTrolleyRoutes.json",
    outputFile: "sanDiegoTunnelsBridges.json",
    railwayTypes: "light_rail",
  },
  Toronto: {
    name: "Toronto",
    bbox: [43.62, -79.5, 43.72, -79.3],
    routesFile: "torontoStreetcarRoutes.json",
    outputFile: "torontoTunnelsBridges.json",
    railwayTypes: "tram",
  },
  Philadelphia: {
    name: "Philadelphia",
    bbox: [39.9, -75.25, 40.05, -75.05],
    routesFile: "phillyTrolleyRoutes.json",
    outputFile: "phillyTunnelsBridges.json",
    railwayTypes: "light_rail|tram|subway",
  },
  Sacramento: {
    name: "Sacramento",
    bbox: [38.5, -121.5, 38.65, -121.35],
    routesFile: "sacramentoLightRailRoutes.json",
    outputFile: "sacramentoTunnelsBridges.json",
    railwayTypes: "light_rail",
  },
  Pittsburgh: {
    name: "Pittsburgh",
    bbox: [40.3, -80.1, 40.5, -79.9],
    routesFile: "pittsburghTRoutes.json",
    outputFile: "pittsburghTunnelsBridges.json",
    railwayTypes: "light_rail|tram",
  },
  Dallas: {
    name: "Dallas",
    bbox: [32.65, -97.0, 33.0, -96.6],
    routesFile: "dallasDartRoutes.json",
    outputFile: "dallasTunnelsBridges.json",
    railwayTypes: "light_rail",
  },
  Minneapolis: {
    name: "Minneapolis",
    bbox: [44.88, -93.4, 45.05, -93.15],
    routesFile: "minneapolisMetroRoutes.json",
    outputFile: "minneapolisTunnelsBridges.json",
    railwayTypes: "light_rail",
  },
  Denver: {
    name: "Denver",
    bbox: [39.6, -105.1, 39.9, -104.8],
    routesFile: "denverRtdRoutes.json",
    outputFile: "denverTunnelsBridges.json",
    railwayTypes: "light_rail",
  },
  "Salt Lake City": {
    name: "Salt Lake City",
    bbox: [40.6, -112.0, 40.85, -111.75],
    routesFile: "slcTraxRoutes.json",
    outputFile: "slcTunnelsBridges.json",
    railwayTypes: "light_rail",
  },
  "San Jose": {
    name: "San Jose",
    bbox: [37.23, -122.08, 37.42, -121.78],
    routesFile: "vtaLightRailRoutes.json",
    outputFile: "vtaTunnelsBridges.json",
    railwayTypes: "light_rail",
  },
  Phoenix: {
    name: "Phoenix",
    bbox: [33.35, -112.35, 33.55, -111.75],
    routesFile: "phoenixLightRailRoutes.json",
    outputFile: "phoenixTunnelsBridges.json",
    railwayTypes: "light_rail",
  },
  Charlotte: {
    name: "Charlotte",
    bbox: [35.09, -80.95, 35.35, -80.7],
    routesFile: "charlotteLightRailRoutes.json",
    outputFile: "charlotteTunnelsBridges.json",
    railwayTypes: "light_rail|tram",
  },
};

const OVERPASS_API = "https://overpass-api.de/api/interpreter";

// Add delay between requests to be nice to Overpass
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fetch tunnel and bridge data for a city
async function fetchTunnelsBridges(cityKey, config) {
  const [south, west, north, east] = config.bbox;

  // Overpass QL query for railway ways with tunnel or bridge tags
  const query = `
[out:json][timeout:90];
(
  way["railway"~"${config.railwayTypes}"]["tunnel"="yes"](${south},${west},${north},${east});
  way["railway"~"${config.railwayTypes}"]["bridge"="yes"](${south},${west},${north},${east});
  way["railway"~"${config.railwayTypes}"]["cutting"="yes"](${south},${west},${north},${east});
  way["railway"~"${config.railwayTypes}"]["embankment"="yes"](${south},${west},${north},${east});
);
out body geom;
`;

  console.log(`\n📍 Fetching tunnel/bridge data for ${config.name}...`);

  try {
    const response = await fetch(OVERPASS_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const data = await response.json();
    console.log(
      `   Found ${data.elements.length} tunnel/bridge/cutting/embankment segments in bounding box`
    );

    // Load route data to filter by proximity
    const routesPath = path.join(DATA_DIR, config.routesFile);
    if (!fs.existsSync(routesPath)) {
      console.log(
        `   ⚠️ Routes file not found: ${config.routesFile}, skipping city`
      );
      return;
    }

    const routes = JSON.parse(fs.readFileSync(routesPath, "utf8"));

    // Extract route coordinates, handling both LineString and MultiLineString
    const routeCoords = [];
    routes.features.forEach((f) => {
      if (f.geometry.type === "MultiLineString") {
        routeCoords.push(...f.geometry.coordinates);
      } else if (f.geometry.type === "LineString") {
        routeCoords.push(f.geometry.coordinates);
      }
    });

    // Filter ways by proximity to our routes
    let filteredElements = data.elements.filter((el) => {
      if (!el.geometry) return false;
      return isWayNearRoutes(el.geometry, routeCoords);
    });

    console.log(
      `   After proximity filter: ${filteredElements.length} segments near transit lines`
    );

    if (filteredElements.length === 0) {
      console.log(
        `   ℹ️ No tunnel/bridge data found near transit lines for ${config.name}`
      );
      // Still save an empty file so the app doesn't error
      const emptyGeojson = {
        type: "FeatureCollection",
        generated: new Date().toISOString(),
        source: "OpenStreetMap via Overpass API",
        features: [],
      };
      const outputPath = path.join(DATA_DIR, config.outputFile);
      fs.writeFileSync(outputPath, JSON.stringify(emptyGeojson, null, 2));
      console.log(`   ✅ Saved empty file to ${config.outputFile}`);
      return;
    }

    // Convert to GeoJSON
    const features = filteredElements.map((element) => {
      // Determine the infrastructure type
      let infraType = "unknown";
      if (element.tags?.tunnel === "yes") infraType = "tunnel";
      else if (element.tags?.bridge === "yes") infraType = "bridge";
      else if (element.tags?.cutting === "yes") infraType = "cutting";
      else if (element.tags?.embankment === "yes") infraType = "embankment";

      return {
        type: "Feature",
        properties: {
          id: element.id,
          infraType,
          name: element.tags?.name || null,
          tunnel: element.tags?.tunnel === "yes",
          bridge: element.tags?.bridge === "yes",
          cutting: element.tags?.cutting === "yes",
          embankment: element.tags?.embankment === "yes",
          layer: element.tags?.layer ? parseInt(element.tags.layer) : 0,
        },
        geometry: {
          type: "LineString",
          coordinates: element.geometry.map((p) => [p.lon, p.lat]),
        },
      };
    });

    const geojson = {
      type: "FeatureCollection",
      generated: new Date().toISOString(),
      source: "OpenStreetMap via Overpass API",
      features,
    };

    // Save to file
    const outputPath = path.join(DATA_DIR, config.outputFile);
    fs.writeFileSync(outputPath, JSON.stringify(geojson, null, 2));

    // Show distribution
    const counts = { tunnel: 0, bridge: 0, cutting: 0, embankment: 0 };
    features.forEach((f) => {
      if (f.properties.tunnel) counts.tunnel++;
      if (f.properties.bridge) counts.bridge++;
      if (f.properties.cutting) counts.cutting++;
      if (f.properties.embankment) counts.embankment++;
    });
    console.log(
      `   Distribution: ${counts.tunnel} tunnels, ${counts.bridge} bridges, ${counts.cutting} cuttings, ${counts.embankment} embankments`
    );
    console.log(
      `   ✅ Saved ${features.length} segments to ${config.outputFile}`
    );
  } catch (error) {
    console.error(`   ❌ Error fetching ${config.name}: ${error.message}`);
  }
}

// Main execution
async function main() {
  console.log("🚇 Fetching Railway Tunnels & Bridges from OpenStreetMap");
  console.log("=========================================================\n");

  for (const [cityKey, config] of Object.entries(CITIES)) {
    await fetchTunnelsBridges(cityKey, config);
    // Be nice to Overpass API
    await delay(5000);
  }

  console.log("\n✅ Done!");
}

main();
