// Parse Denver RTD GTFS data and extract Light Rail stops as GeoJSON
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const gtfsDir = join(
  process.env.HOME,
  "Downloads",
  "RTD_Denver_Direct_Operated_Light_Rail_GTFS",
);
const outputDir = join(__dirname, "..", "src", "data");

// Denver RTD Light Rail lines (route_id from GTFS)
const LIGHT_RAIL_ROUTES = ["101D", "101E", "101H", "103W", "107R", "109L"];

// Map to single letters
const ROUTE_LETTER_MAP = {
  "101D": "D",
  "101E": "E",
  "101H": "H",
  "103W": "W",
  "107R": "R",
  "109L": "L",
};

function parseCSV(filename) {
  const content = readFileSync(join(gtfsDir, filename), "utf-8");
  const lines = content.trim().split("\n");
  const headers = lines[0].split(",").map((h) =>
    h
      .trim()
      .replace(/^\uFEFF/, "")
      .replace(/^"|"$/g, ""),
  );

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
      obj[h] = values[i]?.trim().replace(/^"|"$/g, "") || "";
    });
    return obj;
  });
}

function main() {
  console.log("Parsing Denver RTD GTFS stops data...");

  // Parse all files
  const stops = parseCSV("stops.txt");
  const stopTimes = parseCSV("stop_times.txt");
  const trips = parseCSV("trips.txt");

  console.log(
    `Loaded ${stops.length} stops, ${stopTimes.length} stop_times, ${trips.length} trips`,
  );

  // Build trip -> route mapping
  const tripRoutes = {};
  trips.forEach((trip) => {
    if (LIGHT_RAIL_ROUTES.includes(trip.route_id)) {
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
      stopRoutes[st.stop_id].add(route);
    }
  });

  // Filter stops that serve Light Rail lines
  const lightRailStops = stops.filter((stop) => stopRoutes[stop.stop_id]);
  console.log(`Found ${lightRailStops.length} stops serving Light Rail lines`);

  // Create GeoJSON features with letter-based route IDs
  const features = lightRailStops.map((stop) => {
    const gtfsRoutes = Array.from(stopRoutes[stop.stop_id] || []);
    const routes = gtfsRoutes.map((r) => ROUTE_LETTER_MAP[r] || r).sort();

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
  const outputPath = join(outputDir, "denverRtdStops.json");
  writeFileSync(outputPath, JSON.stringify(geojson, null, 2));
  console.log(`\nWrote ${features.length} stops to ${outputPath}`);

  // Summary by route
  console.log("\nStops per line:");
  Object.values(ROUTE_LETTER_MAP).forEach((letter) => {
    const count = features.filter((f) =>
      f.properties.routes.includes(letter),
    ).length;
    console.log(`  ${letter} Line: ${count} stops`);
  });
}

main();
