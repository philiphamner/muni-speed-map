import fs from "fs";

const INPUT_PATH =
  "/Users/philiphamner/Documents/muni-speed-map/src/data/sanDiegoGradeCrossing_raw.json";

const OUTPUT_PATH =
  "/Users/philiphamner/Documents/muni-speed-map/src/data/sanDiegoGradeCrossings.json";

// Map CPUC line names to San Diego Trolley route IDs
// 510 = Blue, 520 = Green, 530 = Orange, 535 = Copper
const LINE_TO_ROUTE_IDS = {
  "BLUE - Old Town to UTC": ["510"],
  "BLUE - Yard to San Ysidro": ["510"],
  "BLUE/GREEN - Santa Fe Depot to Old Town": ["510", "520"],
  "BLUE/ORANGE - Centre City - Santa Fe Depot to Yard": ["510", "530"],
  "GREEN - Harbor Dr - Santa Fe Depot to Yard": ["520"],
  "GREEN - Old Town to La Mesa": ["520"],
  "GREEN/ORANGE - La Mesa to Santee": ["520", "530"],
  "ORANGE - Yard to La Mesa": ["530"],
  // Exclude these (not trolley):
  "Coaster line": null, // Commuter rail
  "San Diego": null, // Freight/Amtrak
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
      // Must be a trolley line (not Coaster or freight)
      const lineName = r["Primary Subdivision or Line"];
      if (!lineName || LINE_TO_ROUTE_IDS[lineName] === null || LINE_TO_ROUTE_IDS[lineName] === undefined) {
        return false;
      }
      return true;
    })
    .map((r) => {
      const lineName = r["Primary Subdivision or Line"];
      const routeIds = LINE_TO_ROUTE_IDS[lineName] || [];

      return {
        type: "Feature",
        properties: {
          id: r["CPUC Crossing Number"] || `${r.Latitude}-${r.Longitude}`,
          type: "level_crossing",
          routes: routeIds,
          // Additional useful info
          name: r["Crossing Roadway Name"] || null,
          lineName: lineName || null,
          gradeType: r["Grade Type"] || null,
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
  const routeIds = LINE_TO_ROUTE_IDS[line] || [];
  console.log(`   ${line} (${routeIds.join("/")}): ${count}`);
}

// Count gated crossings
const gatedCount = converted.features.filter(f => f.properties.crossing_barrier === "yes").length;
console.log(`\n🚧 ${gatedCount} crossings have gates (will show green)`);
