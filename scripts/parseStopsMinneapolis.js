// Parse Minneapolis Metro Transit GTFS data and extract Blue/Green Line stops as GeoJSON
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const gtfsDir = join(__dirname, "..", "gtfs_minneapolis");
const outputDir = join(__dirname, "..", "src", "data");

// Metro Transit Light Rail route_ids in GTFS
const RAIL_ROUTE_IDS = ["901", "902"]; // Blue, Green
const ROUTE_ID_MAP = {
  "901": "Blue",
  "902": "Green",
};

function parseCSV(filename) {
  const content = readFileSync(join(gtfsDir, filename), "utf-8").replace(
    /\r/g,
    "",
  );
  const lines = content.trim().split("\n");
  const headers = lines[0]
    .split(",")
    .map((h) => h.trim().replace(/^\uFEFF/, ""));

  return lines.slice(1).map((line) => {
    const values = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        values.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current);

    const row = {};
    headers.forEach((header, index) => {
      row[header] = (values[index] || "").trim();
    });
    return row;
  });
}

function main() {
  console.log("Parsing Minneapolis Metro Transit GTFS stops data...");

  const stops = parseCSV("stops.txt");
  const stopTimes = parseCSV("stop_times.txt");
  const trips = parseCSV("trips.txt");

  console.log(
    `Loaded ${stops.length} stops, ${stopTimes.length} stop_times, ${trips.length} trips`,
  );

  const tripRoutes = {};
  for (const trip of trips) {
    if (RAIL_ROUTE_IDS.includes(trip.route_id)) {
      tripRoutes[trip.trip_id] = trip.route_id;
    }
  }

  const stopRoutes = {};
  for (const st of stopTimes) {
    const gtfsRouteId = tripRoutes[st.trip_id];
    if (!gtfsRouteId) continue;
    if (!stopRoutes[st.stop_id]) stopRoutes[st.stop_id] = new Set();
    stopRoutes[st.stop_id].add(ROUTE_ID_MAP[gtfsRouteId] || gtfsRouteId);
  }

  const railStops = stops.filter((stop) => stopRoutes[stop.stop_id]);
  console.log(`Found ${railStops.length} stops serving Blue/Green lines`);

  const features = railStops
    .map((stop) => {
      const lat = Number.parseFloat(stop.stop_lat);
      const lon = Number.parseFloat(stop.stop_lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

      return {
        type: "Feature",
        properties: {
          stop_id: stop.stop_id,
          stop_name: stop.stop_name,
          routes: Array.from(stopRoutes[stop.stop_id] || []).sort(),
        },
        geometry: {
          type: "Point",
          coordinates: [lon, lat],
        },
      };
    })
    .filter(Boolean);

  const geojson = {
    type: "FeatureCollection",
    features,
  };

  const outputPath = join(outputDir, "minneapolisMetroStops.json");
  writeFileSync(outputPath, JSON.stringify(geojson, null, 2));
  console.log(`Wrote ${features.length} stops to ${outputPath}`);

  for (const line of ["Blue", "Green"]) {
    const count = features.filter((f) => f.properties.routes.includes(line)).length;
    console.log(`  ${line}: ${count} stops`);
  }
}

main();
