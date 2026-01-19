/**
 * Filter tunnel/bridge JSON files to only keep tunnel data
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "../src/data");

// Find all *TunnelsBridges.json files
const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith("TunnelsBridges.json"));

console.log(`Found ${files.length} files to process`);

let totalRemoved = 0;
let totalKept = 0;

for (const file of files) {
  const filePath = path.join(DATA_DIR, file);
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  
  if (!data.features || !Array.isArray(data.features)) {
    console.log(`  ${file}: no features array, skipping`);
    continue;
  }
  
  const originalCount = data.features.length;
  
  // Filter to only keep tunnel features (remove bridges, embankments, cuttings)
  data.features = data.features.filter(f => f.properties?.tunnel === true);
  
  const keptCount = data.features.length;
  const removedCount = originalCount - keptCount;
  
  totalRemoved += removedCount;
  totalKept += keptCount;
  
  // Save filtered data
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  
  console.log(`  ${file}: kept ${keptCount} tunnels, removed ${removedCount} non-tunnel features`);
}

console.log(`\nDone! Total: kept ${totalKept} tunnel features, removed ${totalRemoved} non-tunnel features`);
