const https = require("https");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "src", "data");
const routes = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, "slcTraxRoutes.json"), "utf8")
);

const fr = routes.features.find((f) => {
  const p = f.properties || {};
  const id = (p.route_id || p.route_name || p.linename || "").toString();
  return /frontrunner/i.test(id) || /frontrunner/i.test(JSON.stringify(p));
});

if (!fr) {
  console.error("FrontRunner route not found in slcTraxRoutes.json");
  process.exit(1);
}

// compute bbox of route coords
let coords = [];
if (fr.geometry.type === "LineString") coords = fr.geometry.coordinates;
else if (fr.geometry.type === "MultiLineString")
  fr.geometry.coordinates.forEach((seg) => coords.push(...seg));

const lons = coords.map((c) => c[0]);
const lats = coords.map((c) => c[1]);
const minLon = Math.min(...lons) - 0.02;
const maxLon = Math.max(...lons) + 0.02;
const minLat = Math.min(...lats) - 0.02;
const maxLat = Math.max(...lats) + 0.02;

const bbox = `${minLat},${minLon},${maxLat},${maxLon}`;

const query = `
[out:json][timeout:25];
(
  way["railway"="rail"]["maxspeed"](${bbox});
  way["railway"~"light_rail|rail"] ["maxspeed"](${bbox});
);
out body geom;`;

const hosts = [
  "overpass-api.de",
  "overpass.kumi.systems",
  "lz4.overpass-api.de",
];

function tryHost(hostIndex) {
  if (hostIndex >= hosts.length) {
    console.error("All Overpass hosts failed");
    process.exit(1);
  }
  const hostname = hosts[hostIndex];
  const options = {
    hostname,
    path: "/api/interpreter",
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": Buffer.byteLength("data=" + encodeURIComponent(query)),
    },
  };

  console.log("Querying Overpass host", hostname, "for bbox", bbox);
  const req = https.request(options, (res) => {
    let data = "";
    res.on("data", (chunk) => (data += chunk));
    res.on("end", () => {
      try {
        const json = JSON.parse(data);
        const features = [];
        for (const el of json.elements || []) {
          if (el.type !== "way" || !el.geometry) continue;
          const coords = el.geometry.map((n) => [n.lon, n.lat]);
          const props = el.tags || {};
          let maxspeed =
            props.maxspeed ||
            props["maxspeed:forward"] ||
            props["maxspeed:backward"];
          if (!maxspeed) continue;
          // normalize to mph number
          let m = String(maxspeed).trim().toLowerCase();
          let mph = null;
          const kmh = m.match(/(\d+)(?:\s?km\/h)?$/);
          const mphMatch = m.match(/(\d+)(?:\s?mph)?$/);
          if (kmh) mph = Math.round(Number(kmh[1]) * 0.621371);
          else if (mphMatch) mph = Math.round(Number(mphMatch[1]));
          else {
            const num = m.match(/(\d+)/);
            if (num) mph = Math.round(Number(num[1]));
          }

          if (mph == null) continue;

          features.push({
            type: "Feature",
            geometry: { type: "LineString", coordinates: coords },
            properties: { ...props, maxspeed_mph: mph },
          });
        }

        const out = { type: "FeatureCollection", features };
        const outPath = path.join(DATA_DIR, "slcFrontRunnerMaxspeed.json");
        fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
        console.log("Wrote", outPath, "features", features.length);
      } catch (err) {
        console.error(
          "Error parsing Overpass response from",
          hostname,
          err?.message || err
        );
        console.log("Trying next host...");
        tryHost(hostIndex + 1);
      }
    });
  });

  req.on("error", (e) => {
    console.error("Request error", e.message || e);
    console.log("Trying next host...");
    tryHost(hostIndex + 1);
  });
  req.write("data=" + encodeURIComponent(query));
  req.end();
}

tryHost(0);
