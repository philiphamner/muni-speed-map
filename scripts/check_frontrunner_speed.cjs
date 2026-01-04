const fs = require("fs");
const path = require("path");

function toRad(d) {
  return (d * Math.PI) / 180;
}
function haversine(a, b) {
  const R = 6371000;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]),
    lat2 = toRad(b[1]);
  const sinDlat = Math.sin(dLat / 2),
    sinDlon = Math.sin(dLon / 2);
  const x =
    sinDlat * sinDlat + Math.cos(lat1) * Math.cos(lat2) * sinDlon * sinDlon;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

const DATA_DIR = path.join(__dirname, "..", "src", "data");
const routes = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, "slcTraxRoutes.json"), "utf8")
);
const maxs = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, "slcMaxspeed.json"), "utf8")
);
let frMax = { type: "FeatureCollection", features: [] };
try {
  frMax = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, "slcFrontRunnerMaxspeed.json"), "utf8")
  );
} catch (e) {
  /* ignore if not present */
}

const fr = routes.features.find((f) => {
  const p = f.properties || {};
  const id = (p.route_id || p.route_name || p.linename || "").toString();
  return /frontrunner/i.test(id) || /frontrunner/i.test(JSON.stringify(p));
});

if (!fr) {
  console.log("No FrontRunner route feature found");
  process.exit(0);
}

// flatten route coords
let routeCoords = [];
if (fr.geometry.type === "LineString") routeCoords = fr.geometry.coordinates;
else if (fr.geometry.type === "MultiLineString")
  fr.geometry.coordinates.forEach((seg) => routeCoords.push(...seg));

let hits = 0;
const allMaxFeatures = [...(maxs.features || []), ...(frMax.features || [])];
for (const seg of allMaxFeatures) {
  const coords = seg.geometry.coordinates;
  // only consider line strings or multi
  const segCoords = seg.geometry.type === "LineString" ? [coords] : coords;
  for (const line of segCoords) {
    for (const rc of routeCoords) {
      for (const mc of line) {
        const d = haversine(rc, mc);
        if (d <= 100) {
          hits++;
          break;
        }
      }
      if (hits) break;
    }
    if (hits) break;
  }
}

console.log(
  "FrontRunner route coords:",
  routeCoords.length,
  "Maxspeed features near route (<=100m):",
  hits
);
