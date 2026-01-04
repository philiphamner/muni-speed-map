const fs = require("fs");
const path = require("path");
const fetch = globalThis.fetch || require("node-fetch");

const OUT_PATH = path.join(__dirname, "..", "src", "data", "slcTraxStops.json");
const BACKUP_PATH = OUT_PATH + ".bak";
const FEATURE_URL =
  "https://maps.rideuta.com/server/rest/services/Hosted/TRAX_Light_Rail_Stations/FeatureServer/0/query?where=1%3D1&outFields=*&f=geojson";

async function main() {
  // Ensure backup exists (created earlier), but create it if missing
  try {
    if (!fs.existsSync(BACKUP_PATH)) {
      fs.copyFileSync(OUT_PATH, BACKUP_PATH);
      console.log("Backup created at", BACKUP_PATH);
    } else {
      console.log("Backup already exists at", BACKUP_PATH);
    }
  } catch (err) {
    console.warn("Could not create backup:", err.message);
  }

  console.log("Fetching FeatureServer GeoJSON...");
  const res = await fetch(FEATURE_URL, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  const geo = await res.json();
  if (!geo || !Array.isArray(geo.features)) throw new Error("Invalid GeoJSON");

  const features = geo.features.map((f) => {
    const p = f.properties || {};
    const id = p.objectid ?? p.objectId ?? p.OBJECTID ?? p.objectID ?? null;
    const name = (
      p.stationnam ??
      p.station_name ??
      p.STATION_NAME ??
      p.name ??
      p.stationName ??
      ""
    )
      .toString()
      .trim();
    return {
      type: "Feature",
      properties: {
        id: id,
        name: name || "Unknown",
        type: "station",
      },
      geometry: f.geometry,
    };
  });

  const out = { type: "FeatureCollection", features };
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2), "utf8");
  console.log(`Wrote ${OUT_PATH} with ${features.length} features`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
