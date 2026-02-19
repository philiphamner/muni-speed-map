#!/usr/bin/env node

/**
 * Fix Denver route_id values by extracting line letters from the name field
 * Handles shared segments by creating a "lines" array property
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputFile = path.join(__dirname, "../src/data/denverRtdRoutes.json");
const outputFile = inputFile; // Overwrite the original file

console.log("Reading Denver routes file...");
const data = JSON.parse(fs.readFileSync(inputFile, "utf8"));

console.log(`Processing ${data.features.length} features...`);

let fixed = 0;
let skipped = 0;

data.features.forEach((feature) => {
  const name = feature.properties.name || "";

  // Extract line letters from the name
  // Examples: "RTD E Line" -> ["E"], "RTD E & H Lines" -> ["E", "H"]
  const lineMatches = name.match(/\b([A-Z])\b/g);

  if (lineMatches && lineMatches.length > 0) {
    // Filter out "RTD" if it was captured
    const lines = lineMatches.filter((letter) => letter !== "RTD");

    if (lines.length > 0) {
      if (lines.length === 1) {
        // Single line - set route_id directly
        feature.properties.route_id = lines[0];
      } else {
        // Multiple lines - use first as route_id and add lines array
        feature.properties.route_id = lines[0];
        feature.properties.lines = lines;
      }
      fixed++;
    } else {
      // No valid line letters found
      skipped++;
    }
  } else {
    // No line letters in name
    skipped++;
  }
});

console.log(`Fixed: ${fixed} features`);
console.log(`Skipped: ${skipped} features (no line letters found)`);

// Write the updated data back
console.log(`Writing updated file to ${outputFile}...`);
fs.writeFileSync(outputFile, JSON.stringify(data, null, 2));

console.log("Done!");
console.log("\nSample of updated features:");
data.features.slice(0, 5).forEach((f, i) => {
  console.log(`  ${i + 1}. name: "${f.properties.name}"`);
  console.log(`     route_id: "${f.properties.route_id}"`);
  if (f.properties.lines) {
    console.log(`     lines: [${f.properties.lines.join(", ")}]`);
  }
});
