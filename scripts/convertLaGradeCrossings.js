import fs from "fs";
import path from "path";

const INPUT_PATH =
  "/Users/philiphamner/Documents/muni-speed-map/src/data/laGradeCrossings_CPUC_raw.json";

const OUTPUT_PATH =
  "/Users/philiphamner/Documents/muni-speed-map/src/data/laGradeCrossings.converted.json";

// Map CPUC line names to LA Metro route IDs
const LINE_TO_ROUTE_ID = {
  "A Line (Blue)": "801",
  "A Line (former Gold)": "801", // Gold was renamed to A Line
  "B Line (Red)": "802",
  "C Line (Green)": "803",
  "D Line (Purple)": "805",
  "E Line (Expo)": "804",
  "K Line (Crenshaw)": "807",
  "F Line (ESFV)": null, // Under construction, not in our routes yet
};

const raw = JSON.parse(fs.readFileSync(INPUT_PATH, "utf8"));

const converted = {
  type: "FeatureCollection",
  features: raw
    .filter((r) => {
      // Must have valid coordinates
      if (!Number.isFinite(r.Latitude) || !Number.isFinite(r.Longitude)) {
        return false;
      }
      // Must be a transit crossing (filter out railroad-only)
      if (r["Rail Operation - Transit"] !== "Yes") {
        return false;
      }
      // Only include true at-grade crossings (not elevated/tunnel crossings)
      if (r["Grade Type"] !== "At Grade") {
        return false;
      }
      // Exclude pedestrian-only crossings
      if (r["Pedestrian Only Crossing"] === "Yes") {
        return false;
      }
      return true;
    })
    .map((r) => {
      const lineName = r["Primary Subdivision or Line"];
      const routeId = LINE_TO_ROUTE_ID[lineName];

      // Warn about unmapped lines
      if (lineName && routeId === undefined) {
        console.warn(`⚠️  Unknown line: "${lineName}"`);
      }

      return {
        type: "Feature",
        properties: {
          id: r["CPUC Crossing Number"] || `${r.Latitude}-${r.Longitude}`,
          type: "level_crossing",
          routes: routeId ? [routeId] : [],
          // Additional useful info
          name: r["Crossing Roadway Name"] || null,
          lineName: lineName || null,
          gradeType: r["Grade Type"] || null,
          pedestrianOnly: r["Pedestrian Only Crossing"] === "Yes",
          warningDevice: r["Warning Device Category"] || null,
          milepost: r["Primary Milepost"] || null,
          // Crossing equipment (normalize to match other cities' format)
          // Gates = barrier present (green on map)
          crossing_barrier: r["Warning Device Category"] === "5. Gates" ? "yes" : null,
          crossing_light: null,
          crossing_bell: null,
        },
        geometry: {
          type: "Point",
          coordinates: [r.Longitude, r.Latitude],
        },
      };
    }),
};

// Sort by route ID then milepost for easier debugging
converted.features.sort((a, b) => {
  const routeA = a.properties.routes[0] || "zzz";
  const routeB = b.properties.routes[0] || "zzz";
  if (routeA !== routeB) return routeA.localeCompare(routeB);
  return (a.properties.milepost || 0) - (b.properties.milepost || 0);
});

fs.writeFileSync(OUTPUT_PATH, JSON.stringify(converted, null, 2));
console.log(
  `✅ Converted ${converted.features.length} crossings → ${OUTPUT_PATH}`
);

// Summary by line
const byLine = {};
for (const f of converted.features) {
  const line = f.properties.lineName || "Unknown";
  byLine[line] = (byLine[line] || 0) + 1;
}
console.log("\n📊 Crossings by line:");
for (const [line, count] of Object.entries(byLine).sort((a, b) => b[1] - a[1])) {
  const routeId = LINE_TO_ROUTE_ID[line] || "N/A";
  console.log(`   ${line} (${routeId}): ${count}`);
}
