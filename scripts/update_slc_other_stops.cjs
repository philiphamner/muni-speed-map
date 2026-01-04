const fs = require("fs");
const path = require("path");
const fetch = globalThis.fetch || require("node-fetch");

const OUT_DIR = path.join(__dirname, "..", "src", "data");

const SOURCES = [
  {
    name: "S-Line",
    // Preferred: server-side filter for S-LINE (some servers disallow functions); script will fall back to fetching all stops and filtering client-side if needed
    urlFiltered:
      "https://maps.rideuta.com/server/rest/services/Hosted/UTA_Stops_and_Most_Recent_Ridership/FeatureServer/0/query?where=linename%20LIKE%20'%25S-LINE%25'&outFields=*&f=geojson",
    urlAll:
      "https://maps.rideuta.com/server/rest/services/Hosted/UTA_Stops_and_Most_Recent_Ridership/FeatureServer/0/query?where=1%3D1&outFields=*&f=geojson",
    out: path.join(OUT_DIR, "slcSLineStops.json"),
  },
  {
    name: "FrontRunner",
    // Dedicated FrontRunner stations service
    url: "https://maps.rideuta.com/server/rest/services/Hosted/FrontRunnerStations/FeatureServer/0/query?where=1%3D1&outFields=*&f=geojson",
    out: path.join(OUT_DIR, "slcFrontRunnerStops.json"),
  },
];

function backupIfExists(filePath) {
  try {
    if (fs.existsSync(filePath) && !fs.existsSync(filePath + ".bak")) {
      fs.copyFileSync(filePath, filePath + ".bak");
      console.log("Backup created:", filePath + ".bak");
    }
  } catch (e) {
    console.warn("Could not back up", filePath, e.message);
  }
}

function normalizeFeature(f, sourceName) {
  const p = f.properties || {};
  const id = p.objectid ?? p.objectId ?? p.OBJECTID ?? p.stop_id ?? null;
  const stopName = (
    p.stationnam ||
    p.station_name ||
    p.STATION_NAME ||
    p.name ||
    p.stop_name ||
    p.linename ||
    ""
  )
    .toString()
    .trim();

  // Determine routes array. For FrontRunner, force FrontRunner; for S-Line use linename/routename
  let routesRaw = (p.routename || p.linename || p.route || "").toString();
  let routes = [];
  if (sourceName === "FrontRunner") {
    routes = ["FrontRunner"];
  } else {
    routes = routesRaw
      .split(/[,;|]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) =>
        s
          .replace(/^TRAX\s+/i, "")
          .replace(/\s*Line$/i, "")
          .trim(),
      );
  }

  // Ensure unique
  routes = [...new Set(routes)];

  return {
    type: "Feature",
    properties: {
      id: id,
      stop_name: stopName || "Unknown",
      name: stopName || "Unknown",
      routes: JSON.stringify(routes),
      routename: routesRaw || null,
      address: p.address ?? null,
      parknride: p.parknride ?? null,
      status: p.status ?? null,
      type: "station",
    },
    geometry: f.geometry,
  };
}

// Helper: test for S-LINE text in a feature's attributes
function featureIsSLine(f) {
  const p = f.properties || {};
  const hay = (p.linename || p.routename || p.route || p.name || "").toString();
  return /S[- ]?LINE/i.test(hay);
}

(async function main() {
  for (const src of SOURCES) {
    console.log(`Processing ${src.name} -> ${src.out}`);
    backupIfExists(src.out);

    let geo = null;

    try {
      if (src.url) {
        console.log("Fetching FeatureServer GeoJSON from", src.url);
        const res = await fetch(src.url, {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        geo = await res.json();
      } else if (src.urlFiltered) {
        // Try filtered URL first
        try {
          console.log(
            "Attempting server-side filtered query:",
            src.urlFiltered,
          );
          const res = await fetch(src.urlFiltered, {
            headers: { Accept: "application/json" },
          });
          if (res.ok) {
            geo = await res.json();
          } else {
            throw new Error(
              `Filtered query failed: ${res.status} ${res.statusText}`,
            );
          }
        } catch (err) {
          // Fallback to fetching all and filter client-side
          console.warn(
            "Filtered query failed, falling back to full dataset:",
            err.message,
          );
          console.log("Fetching full stops dataset from", src.urlAll);
          const resAll = await fetch(src.urlAll, {
            headers: { Accept: "application/json" },
          });
          if (!resAll.ok)
            throw new Error(
              `Full fetch failed: ${resAll.status} ${resAll.statusText}`,
            );
          const allGeo = await resAll.json();
          if (!allGeo || !Array.isArray(allGeo.features))
            throw new Error("Invalid full GeoJSON");
          // Filter client-side for S-LINE
          const filtered = allGeo.features.filter(featureIsSLine);
          geo = { type: "FeatureCollection", features: filtered };
        }
      } else {
        console.error("No URL configured for source", src.name);
        continue;
      }
    } catch (e) {
      console.error("Failed to fetch/prepare GeoJSON for", src.name, e.message);
      continue;
    }

    if (!geo || !Array.isArray(geo.features)) {
      console.error("Invalid GeoJSON for", src.name);
      continue;
    }

    const features = geo.features.map((f) => normalizeFeature(f, src.name));
    const out = { type: "FeatureCollection", features };
    fs.writeFileSync(src.out, JSON.stringify(out, null, 2), "utf8");
    console.log(`Wrote ${src.out} with ${features.length} features`);
  }
  console.log("Done.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
