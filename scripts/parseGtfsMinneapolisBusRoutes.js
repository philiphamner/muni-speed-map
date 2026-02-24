// Parse Metro Transit GTFS data and extract a lightweight bus overlay for Minneapolis.
// Uses one representative shape per route + direction (most common shape in trips).
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const gtfsDir = join(__dirname, "..", "gtfs_minneapolis");
const outputPath = join(
  __dirname,
  "..",
  "src",
  "data",
  "minneapolisBusRoutesTest.json",
);

function parseCSV(filename) {
  const content = readFileSync(join(gtfsDir, filename), "utf-8").replace(/\r/g, "");
  const lines = content.trim().split("\n");
  const headers = lines[0].split(",");
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
        } else inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current);
        current = "";
      } else current += char;
    }
    values.push(current);
    const row = {};
    headers.forEach((header, index) => {
      row[header.trim()] = (values[index] || "").trim();
    });
    return row;
  });
}

function getRouteLabel(route) {
  const shortName = route.route_short_name || route.route_id || "";
  const longName = route.route_long_name || "";
  return longName ? `${shortName} ${longName}` : shortName;
}

function main() {
  console.log("Parsing Minneapolis GTFS bus routes...");
  const routes = parseCSV("routes.txt");
  const trips = parseCSV("trips.txt");
  const shapes = parseCSV("shapes.txt");

  const busRoutes = routes.filter((route) => route.route_type === "3");
  const busRouteIds = new Set(busRoutes.map((route) => route.route_id));
  const routeById = Object.fromEntries(busRoutes.map((r) => [r.route_id, r]));
  console.log(`Bus routes (route_type=3): ${busRoutes.length}`);

  const candidatesByRouteDir = {};
  for (const trip of trips) {
    if (!busRouteIds.has(trip.route_id) || !trip.shape_id) continue;
    const directionId = trip.direction_id || "0";
    const key = `${trip.route_id}__${directionId}`;
    if (!candidatesByRouteDir[key]) candidatesByRouteDir[key] = {};
    if (!candidatesByRouteDir[key][trip.shape_id]) {
      candidatesByRouteDir[key][trip.shape_id] = {
        count: 0,
        headsign: trip.trip_headsign || "",
        route_id: trip.route_id,
        direction_id: directionId,
      };
    }
    candidatesByRouteDir[key][trip.shape_id].count += 1;
  }

  const selectedShapes = {};
  Object.entries(candidatesByRouteDir).forEach(([routeDirKey, byShape]) => {
    const [bestShapeId, bestInfo] = Object.entries(byShape).sort(
      (a, b) => b[1].count - a[1].count,
    )[0];
    selectedShapes[bestShapeId] = { ...bestInfo, route_dir_key: routeDirKey };
  });
  console.log(`Representative shapes selected: ${Object.keys(selectedShapes).length}`);

  const shapePoints = {};
  for (const row of shapes) {
    if (!selectedShapes[row.shape_id]) continue;
    if (!shapePoints[row.shape_id]) shapePoints[row.shape_id] = [];
    shapePoints[row.shape_id].push({
      seq: Number.parseInt(row.shape_pt_sequence, 10),
      lon: Number.parseFloat(row.shape_pt_lon),
      lat: Number.parseFloat(row.shape_pt_lat),
    });
  }

  const features = Object.entries(shapePoints)
    .map(([shapeId, points]) => {
      const shapeInfo = selectedShapes[shapeId];
      const route = routeById[shapeInfo.route_id];
      if (!route) return null;
      points.sort((a, b) => a.seq - b.seq);
      const coordinates = points
        .filter((p) => Number.isFinite(p.lon) && Number.isFinite(p.lat))
        .map((p) => [p.lon, p.lat]);
      if (coordinates.length < 2) return null;
      return {
        type: "Feature",
        properties: {
          shape_id: shapeId,
          route_id: route.route_id,
          route_short_name: route.route_short_name || route.route_id,
          route_long_name: route.route_long_name || "",
          route_name: getRouteLabel(route),
          route_color: route.route_color ? `#${route.route_color}` : null,
          direction_id: shapeInfo.direction_id,
          headsign: shapeInfo.headsign,
          trip_count: shapeInfo.count,
        },
        geometry: { type: "LineString", coordinates },
      };
    })
    .filter(Boolean);

  const geojson = { type: "FeatureCollection", features };
  writeFileSync(outputPath, JSON.stringify(geojson));
  const routeCoverage = new Set(features.map((f) => f.properties.route_id));
  console.log(`Wrote ${features.length} features to ${outputPath}`);
  console.log(`Covered routes: ${routeCoverage.size}/${busRoutes.length}`);
}

main();
