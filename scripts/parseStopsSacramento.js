// Parse Sacramento SacRT GTFS data and extract Light Rail stops as GeoJSON
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const gtfsDir = join(__dirname, "..", "gtfs_sacramento");
const outputDir = join(__dirname, "..", "src", "data");

// Sacramento Light Rail lines
const LIGHT_RAIL_LINES = ["507", "533"];

// Map GTFS route_id to frontend route_id
const ROUTE_ID_MAP = {
  507: "Gold",
  533: "Blue",
};

function parseCSV(filename) {
  const content = readFileSync(join(gtfsDir, filename), "utf-8");
  const lines = content.trim().split("\n");
  const headers = lines[0]
    .split(",")
    .map((h) => h.trim().replace(/^\uFEFF/, ""));

  return lines.slice(1).map((line) => {
    const values = [];
    let current = "";
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current);

    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = values[i]?.trim() || "";
    });
    return obj;
  });
}

function main() {
  console.log("Parsing Sacramento SacRT GTFS stops data...");

  // Parse all files
  const stops = parseCSV("stops.txt");
  const stopTimes = parseCSV("stop_times.txt");
  const trips = parseCSV("trips.txt");

  console.log(
    `Loaded ${stops.length} stops, ${stopTimes.length} stop_times, ${trips.length} trips`
  );

  // Build trip -> route mapping
  const tripRoutes = {};
  trips.forEach((trip) => {
    if (LIGHT_RAIL_LINES.includes(trip.route_id)) {
      tripRoutes[trip.trip_id] = trip.route_id;
    }
  });

  // Find which stops are used by each route
  const stopRoutes = {};
  stopTimes.forEach((st) => {
    const route = tripRoutes[st.trip_id];
    if (route) {
      if (!stopRoutes[st.stop_id]) {
        stopRoutes[st.stop_id] = new Set();
      }
      // Convert to frontend route_id (Gold/Blue)
      stopRoutes[st.stop_id].add(ROUTE_ID_MAP[route] || route);
    }
  });

  // Filter stops that serve Light Rail lines
  const lightRailStops = stops.filter((stop) => stopRoutes[stop.stop_id]);
  console.log(`Found ${lightRailStops.length} stops serving Light Rail lines`);

  // Create GeoJSON features
  const features = lightRailStops.map((stop) => {
    const routes = Array.from(stopRoutes[stop.stop_id] || []).sort();

    return {
      type: "Feature",
      properties: {
        stop_id: stop.stop_id,
        stop_name: stop.stop_name,
        routes: routes,
      },
      geometry: {
        type: "Point",
        coordinates: [parseFloat(stop.stop_lon), parseFloat(stop.stop_lat)],
      },
    };
  });

  const geojson = {
    type: "FeatureCollection",
    features,
  };

  // Write output
  const outputPath = join(outputDir, "sacramentoLightRailStops.json");
  writeFileSync(outputPath, JSON.stringify(geojson, null, 2));
  console.log(`Wrote ${features.length} stops to ${outputPath}`);
}

main();
