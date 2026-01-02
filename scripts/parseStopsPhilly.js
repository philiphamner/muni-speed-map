// Parse Philadelphia SEPTA GTFS data and extract Trolley stops as GeoJSON
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const gtfsDir = join(__dirname, "..", "gtfs_philly");
const outputDir = join(__dirname, "..", "src", "data");

// Philadelphia SEPTA Trolley lines (GTFS route_id)
const TROLLEY_ROUTE_IDS = ["T1", "T2", "T3", "T4", "T5", "D1", "D2", "G1"];

// Map GTFS route_id to frontend route_id
const ROUTE_ID_MAP = {
  T1: "10",
  T2: "34",
  T3: "13",
  T4: "11",
  T5: "36",
  D1: "101",
  D2: "102",
  G1: "15",
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
  console.log("Parsing Philadelphia SEPTA GTFS stops data...");

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
    if (TROLLEY_ROUTE_IDS.includes(trip.route_id)) {
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
      // Convert to frontend route_id
      stopRoutes[st.stop_id].add(ROUTE_ID_MAP[route] || route);
    }
  });

  // Filter stops that serve Trolley lines
  const trolleyStops = stops.filter((stop) => stopRoutes[stop.stop_id]);
  console.log(`Found ${trolleyStops.length} stops serving Trolley lines`);

  // Create GeoJSON features
  const features = trolleyStops.map((stop) => {
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
  const outputPath = join(outputDir, "phillyTrolleyStops.json");
  writeFileSync(outputPath, JSON.stringify(geojson, null, 2));
  console.log(`Wrote ${features.length} stops to ${outputPath}`);
}

main();
