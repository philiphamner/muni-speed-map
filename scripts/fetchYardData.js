#!/usr/bin/env node
/**
 * Fetch Railway Yard Data from OpenStreetMap via Overpass API
 *
 * Downloads rail yard data (service=yard, railway=yard, landuse=railway)
 * for each city, filters to only include yards near our transit lines,
 * and creates convex hull polygons around yard areas.
 *
 * Run with: node scripts/fetchYardData.js
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Distance threshold - only include yards within this distance of our routes
const PROXIMITY_METERS = 500; // Yards can be a bit farther from main lines

// Data directory for routes and output
const DATA_DIR = path.join(__dirname, "..", "src", "data");

// City configurations (same as separation data)
const CITIES = {
  SF: {
    name: "San Francisco",
    bbox: [37.65, -122.55, 37.85, -122.35],
    routesFile: "muniMetroRoutes.json",
    outputFile: "sfYards.json",
    railwayTypes: "light_rail|tram",
  },
  LA: {
    name: "Los Angeles",
    bbox: [33.76, -118.5, 34.18, -117.74],
    routesFile: "laMetroRoutes.json",
    outputFile: "laYards.json",
    railwayTypes: "light_rail|subway",
  },
  Seattle: {
    name: "Seattle",
    bbox: [47.23, -122.46, 47.82, -122.1],
    routesFile: "seattleLinkRoutes.json",
    outputFile: "seattleYards.json",
    railwayTypes: "light_rail",
  },
  Boston: {
    name: "Boston",
    bbox: [42.25, -71.2, 42.4, -71.0],
    routesFile: "bostonGreenLineRoutes.json",
    outputFile: "bostonYards.json",
    railwayTypes: "light_rail|tram",
  },
  Portland: {
    name: "Portland",
    bbox: [45.4, -122.85, 45.6, -122.5],
    routesFile: "portlandMaxRoutes.json",
    outputFile: "portlandYards.json",
    railwayTypes: "light_rail|tram",
  },
  "San Diego": {
    name: "San Diego",
    bbox: [32.65, -117.2, 32.95, -116.95],
    routesFile: "sanDiegoTrolleyRoutes.json",
    outputFile: "sanDiegoYards.json",
    railwayTypes: "light_rail",
  },
  Toronto: {
    name: "Toronto",
    bbox: [43.62, -79.5, 43.72, -79.3],
    routesFile: "torontoStreetcarRoutes.json",
    outputFile: "torontoYards.json",
    railwayTypes: "tram",
  },
  Philadelphia: {
    name: "Philadelphia",
    bbox: [39.9, -75.25, 40.05, -75.05],
    routesFile: "phillyTrolleyRoutes.json",
    outputFile: "phillyYards.json",
    railwayTypes: "light_rail|tram",
  },
  Pittsburgh: {
    name: "Pittsburgh",
    bbox: [40.3, -80.1, 40.5, -79.9],
    routesFile: "pittsburghTRoutes.json",
    outputFile: "pittsburghYards.json",
    railwayTypes: "light_rail|tram",
  },
  Dallas: {
    name: "Dallas",
    bbox: [32.65, -97.0, 33.0, -96.6],
    routesFile: "dallasDartRoutes.json",
    outputFile: "dallasYards.json",
    railwayTypes: "light_rail",
  },
  Minneapolis: {
    name: "Minneapolis",
    bbox: [44.88, -93.4, 45.05, -93.15],
    routesFile: "minneapolisMetroRoutes.json",
    outputFile: "minneapolisYards.json",
    railwayTypes: "light_rail",
  },
  Denver: {
    name: "Denver",
    bbox: [39.6, -105.1, 39.9, -104.8],
    routesFile: "denverRtdRoutes.json",
    outputFile: "denverYards.json",
    railwayTypes: "light_rail",
  },
  "Salt Lake City": {
    name: "Salt Lake City",
    bbox: [40.6, -112.0, 40.85, -111.75],
    routesFile: "slcTraxRoutes.json",
    outputFile: "slcYards.json",
    railwayTypes: "light_rail",
  },
  "San Jose": {
    name: "San Jose",
    bbox: [37.23, -122.08, 37.42, -121.78],
    routesFile: "vtaLightRailRoutes.json",
    outputFile: "sanJoseYards.json",
    railwayTypes: "light_rail",
  },
  Phoenix: {
    name: "Phoenix",
    bbox: [33.35, -112.35, 33.55, -111.75],
    routesFile: "phoenixLightRailRoutes.json",
    outputFile: "phoenixYards.json",
    railwayTypes: "light_rail",
  },
  Charlotte: {
    name: "Charlotte",
    bbox: [35.09, -80.95, 35.35, -80.7],
    routesFile: "charlotteLightRailRoutes.json",
    outputFile: "charlotteYards.json",
    railwayTypes: "light_rail|tram",
  },
};

const OVERPASS_API = "https://overpass-api.de/api/interpreter";

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

// Check if a point is near any route
function isPointNearRoutes(lat, lon, routeCoords) {
  for (const coords of routeCoords) {
    for (let i = 0; i < coords.length - 1; i++) {
      const [lon1, lat1] = coords[i];
      const [lon2, lat2] = coords[i + 1];
      const distance = distanceToSegment(lat, lon, lat1, lon1, lat2, lon2);
      if (distance <= PROXIMITY_METERS) {
        return true;
      }
    }
  }
  return false;
}

// Create convex hull from a set of points using Graham scan
function convexHull(points) {
  if (points.length < 3) return points;

  // Find the point with lowest y (and leftmost if tie)
  let start = 0;
  for (let i = 1; i < points.length; i++) {
    if (
      points[i][1] < points[start][1] ||
      (points[i][1] === points[start][1] && points[i][0] < points[start][0])
    ) {
      start = i;
    }
  }

  // Swap start to first position
  [points[0], points[start]] = [points[start], points[0]];
  const pivot = points[0];

  // Sort by polar angle
  const sorted = points.slice(1).sort((a, b) => {
    const angleA = Math.atan2(a[1] - pivot[1], a[0] - pivot[0]);
    const angleB = Math.atan2(b[1] - pivot[1], b[0] - pivot[0]);
    return angleA - angleB;
  });

  const hull = [pivot];
  for (const point of sorted) {
    while (hull.length >= 2) {
      const a = hull[hull.length - 2];
      const b = hull[hull.length - 1];
      const cross = (b[0] - a[0]) * (point[1] - a[1]) - (b[1] - a[1]) * (point[0] - a[0]);
      if (cross <= 0) {
        hull.pop();
      } else {
        break;
      }
    }
    hull.push(point);
  }

  // Close the polygon
  hull.push(hull[0]);
  return hull;
}

// Add delay between requests
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fetch yard data for a city
async function fetchYardData(cityKey, config) {
  const [south, west, north, east] = config.bbox;

  // Query for yard-related elements
  const query = `
[out:json][timeout:120];
(
  // Yard tracks
  way["railway"]["service"="yard"](${south},${west},${north},${east});
  // Depot/maintenance facilities
  way["railway"="depot"](${south},${west},${north},${east});
  node["railway"="depot"](${south},${west},${north},${east});
  // Landuse areas marked as railway (often includes yards)
  way["landuse"="railway"](${south},${west},${north},${east});
  relation["landuse"="railway"](${south},${west},${north},${east});
  // Siding tracks (often near yards)
  way["railway"]["service"="siding"](${south},${west},${north},${east});
);
out body geom;
`;

  console.log(`\n📍 Fetching yard data for ${config.name}...`);

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
    console.log(`   Found ${data.elements.length} yard-related elements in bounding box`);

    if (data.elements.length === 0) {
      // Save empty file
      const emptyGeojson = {
        type: "FeatureCollection",
        generated: new Date().toISOString(),
        source: "OpenStreetMap via Overpass API",
        features: [],
      };
      const outputPath = path.join(DATA_DIR, config.outputFile);
      fs.writeFileSync(outputPath, JSON.stringify(emptyGeojson, null, 2));
      console.log(`   ✅ No yards found, saved empty file`);
      return;
    }

    // Load route data to filter by proximity
    const routesPath = path.join(DATA_DIR, config.routesFile);
    if (!fs.existsSync(routesPath)) {
      console.log(`   ⚠️ Routes file not found: ${config.routesFile}, skipping city`);
      return;
    }

    const routes = JSON.parse(fs.readFileSync(routesPath, "utf8"));
    const routeCoords = [];
    routes.features.forEach((f) => {
      if (f.geometry.type === "MultiLineString") {
        routeCoords.push(...f.geometry.coordinates);
      } else if (f.geometry.type === "LineString") {
        routeCoords.push(f.geometry.coordinates);
      }
    });

    // Collect all points from yard elements that are near our routes
    const yardPoints = [];
    const yardNames = new Set();

    for (const element of data.elements) {
      let points = [];
      let name = element.tags?.name || null;

      if (element.type === "node") {
        points = [[element.lon, element.lat]];
      } else if (element.geometry) {
        points = element.geometry.map((p) => [p.lon, p.lat]);
      }

      // Check if any point is near our routes
      for (const [lon, lat] of points) {
        if (isPointNearRoutes(lat, lon, routeCoords)) {
          yardPoints.push(...points);
          if (name) yardNames.add(name);
          break;
        }
      }
    }

    console.log(`   After proximity filter: ${yardPoints.length} points from yard areas`);

    if (yardPoints.length < 3) {
      // Not enough points for a polygon
      const emptyGeojson = {
        type: "FeatureCollection",
        generated: new Date().toISOString(),
        source: "OpenStreetMap via Overpass API",
        features: [],
      };
      const outputPath = path.join(DATA_DIR, config.outputFile);
      fs.writeFileSync(outputPath, JSON.stringify(emptyGeojson, null, 2));
      console.log(`   ✅ Not enough points for yard polygon, saved empty file`);
      return;
    }

    // Cluster points that are close together (within 200m)
    const clusters = [];
    const used = new Set();

    for (let i = 0; i < yardPoints.length; i++) {
      if (used.has(i)) continue;

      const cluster = [yardPoints[i]];
      used.add(i);

      for (let j = i + 1; j < yardPoints.length; j++) {
        if (used.has(j)) continue;

        // Check if point is within 500m of any point in cluster
        for (const cp of cluster) {
          const dist = haversineDistance(
            yardPoints[j][1], yardPoints[j][0],
            cp[1], cp[0]
          );
          if (dist < 500) {
            cluster.push(yardPoints[j]);
            used.add(j);
            break;
          }
        }
      }

      if (cluster.length >= 3) {
        clusters.push(cluster);
      }
    }

    console.log(`   Found ${clusters.length} yard clusters`);

    // Create convex hull polygons for each cluster
    const features = clusters.map((cluster, idx) => {
      const hull = convexHull([...cluster]);
      return {
        type: "Feature",
        properties: {
          id: idx + 1,
          name: Array.from(yardNames)[idx] || `Yard ${idx + 1}`,
          pointCount: cluster.length,
        },
        geometry: {
          type: "Polygon",
          coordinates: [hull],
        },
      };
    });

    const geojson = {
      type: "FeatureCollection",
      generated: new Date().toISOString(),
      source: "OpenStreetMap via Overpass API",
      features,
    };

    const outputPath = path.join(DATA_DIR, config.outputFile);
    fs.writeFileSync(outputPath, JSON.stringify(geojson, null, 2));
    console.log(`   ✅ Saved ${features.length} yard polygons to ${config.outputFile}`);
  } catch (error) {
    console.log(`   ❌ Error fetching ${config.name}: ${error.message}`);
  }
}

// Main
async function main() {
  console.log("🚇 Fetching Railway Yard Data from OpenStreetMap");
  console.log("=".repeat(56) + "\n");

  for (const [cityKey, config] of Object.entries(CITIES)) {
    await fetchYardData(cityKey, config);
    await delay(2000); // Be nice to Overpass API
  }

  console.log("\n✅ Done!");
}

main();
