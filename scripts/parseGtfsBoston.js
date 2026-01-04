// Parse Boston MBTA GTFS data and extract Green Line routes as GeoJSON
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const gtfsDir = join(__dirname, "..", "gtfs_boston");
const outputDir = join(__dirname, "..", "src", "data");

// MBTA Green Line branches (light rail / street-running)
// Green-B = Boston College branch (Comm Ave street-running)
// Green-C = Cleveland Circle branch (Beacon St reservation)
// Green-D = Riverside branch (mostly grade-separated)
// Green-E = Heath Street branch (Huntington Ave street-running)
const GREEN_LINE_ROUTES = ["Green-B", "Green-C", "Green-D", "Green-E"];

// Line colors matching MBTA branding
const LINE_COLORS = {
  "Green-B": "#00843D",
  "Green-C": "#00843D",
  "Green-D": "#00843D",
  "Green-E": "#00843D",
};

const LINE_NAMES = {
  "Green-B": "Green Line B",
  "Green-C": "Green Line C",
  "Green-D": "Green Line D",
  "Green-E": "Green Line E",
};

const LINE_LETTERS = {
  "Green-B": "B",
  "Green-C": "C",
  "Green-D": "D",
  "Green-E": "E",
};

function parseCSV(filename) {
  const content = readFileSync(join(gtfsDir, filename), "utf-8");
  const lines = content.trim().split("\n");
  const headers = lines[0]
    .split(",")
    .map((h) => h.trim().replace(/^\uFEFF/, "")); // Remove BOM if present

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
  console.log("Parsing Boston MBTA GTFS data...");
  console.log(`GTFS directory: ${gtfsDir}`);

  // Parse routes
  const routes = parseCSV("routes.txt");
  console.log(`Total routes: ${routes.length}`);
  const greenRoutes = routes.filter((r) =>
    GREEN_LINE_ROUTES.includes(r.route_id),
  );
  console.log(
    `Found ${greenRoutes.length} Green Line routes:`,
    greenRoutes.map((r) => `${r.route_id} (${r.route_long_name})`),
  );

  // Parse trips to get shape_ids for each route
  const trips = parseCSV("trips.txt");
  console.log(`Total trips: ${trips.length}`);
  const greenTrips = trips.filter((t) =>
    GREEN_LINE_ROUTES.includes(t.route_id),
  );
  console.log(`Green Line trips: ${greenTrips.length}`);

  // Count trips per shape_id for each route/direction
  const shapeCounts = {};
  greenTrips.forEach((trip) => {
    const key = `${trip.route_id}_${trip.direction_id}`;
    if (!shapeCounts[key]) {
      shapeCounts[key] = {
        route_id: trip.route_id,
        direction_id: trip.direction_id,
        shapes: {},
      };
    }
    const shapeId = trip.shape_id;
    if (!shapeCounts[key].shapes[shapeId]) {
      shapeCounts[key].shapes[shapeId] = {
        count: 0,
        headsign: trip.trip_headsign || "",
      };
    }
    shapeCounts[key].shapes[shapeId].count++;
  });

  // Pick the most common shape for each route/direction
  const selectedShapes = {};
  Object.entries(shapeCounts).forEach(([key, data]) => {
    const shapes = Object.entries(data.shapes);

    // Sort by count (descending) and pick the most common
    shapes.sort((a, b) => b[1].count - a[1].count);

    const [shapeId, info] = shapes[0];
    selectedShapes[shapeId] = {
      route_id: data.route_id,
      direction_id: data.direction_id,
      headsign: info.headsign,
      trip_count: info.count,
    };

    console.log(
      `${data.route_id} dir ${data.direction_id}: picked shape ${shapeId} (${
        info.headsign || "no headsign"
      }, ${info.count} trips)`,
    );
  });

  console.log(`\nSelected ${Object.keys(selectedShapes).length} shapes`);

  // Parse shapes
  const shapes = parseCSV("shapes.txt");
  console.log(`Total shape points: ${shapes.length}`);

  // Group shape points by shape_id and filter for our routes
  const shapePoints = {};
  shapes.forEach((pt) => {
    if (selectedShapes[pt.shape_id]) {
      if (!shapePoints[pt.shape_id]) {
        shapePoints[pt.shape_id] = [];
      }
      shapePoints[pt.shape_id].push({
        lon: parseFloat(pt.shape_pt_lon),
        lat: parseFloat(pt.shape_pt_lat),
        seq: parseInt(pt.shape_pt_sequence),
        dist: parseFloat(pt.shape_dist_traveled) || 0,
      });
    }
  });

  // Sort by sequence
  Object.values(shapePoints).forEach((pts) => {
    pts.sort((a, b) => a.seq - b.seq);
  });

  // Create GeoJSON features
  const features = Object.entries(shapePoints).map(([shapeId, points]) => {
    const info = selectedShapes[shapeId];
    const route = greenRoutes.find((r) => r.route_id === info.route_id);
    const routeId = info.route_id;

    return {
      type: "Feature",
      properties: {
        shape_id: shapeId,
        route_id: routeId,
        route_name: LINE_NAMES[routeId] || route?.route_long_name || routeId,
        route_color:
          LINE_COLORS[routeId] || `#${route?.route_color || "666666"}`,
        route_letter: LINE_LETTERS[routeId] || routeId,
        direction_id: info.direction_id,
        direction: info.direction_id === "0" ? "outbound" : "inbound",
        headsign: info.headsign,
      },
      geometry: {
        type: "LineString",
        coordinates: points.map((p) => [p.lon, p.lat]),
      },
    };
  });

  const geojson = {
    type: "FeatureCollection",
    features,
  };

  // Write output
  const outputPath = join(outputDir, "bostonGreenLineRoutes.json");
  writeFileSync(outputPath, JSON.stringify(geojson, null, 2));
  console.log(`\nWrote ${features.length} features to ${outputPath}`);

  // Summary
  console.log("\nRoute summary:");
  features.forEach((f) => {
    const p = f.properties;
    console.log(
      `  ${p.route_id} ${p.direction}: ${p.route_name} (${
        p.headsign || "no headsign"
      })`,
    );
  });
}

main();
