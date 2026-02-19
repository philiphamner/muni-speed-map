#!/usr/bin/env node

/**
 * Simplify Denver route geometry by removing redundant points
 * Keeps only points that are at least MIN_DISTANCE meters apart
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputFile = path.join(__dirname, "../src/data/denverRtdRoutes.json");
const outputFile = inputFile;

// Minimum distance between points in meters
const MIN_DISTANCE_METERS = 20; // Keep points at least 20m apart

// Haversine distance
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function simplifyLineString(coordinates) {
  if (coordinates.length <= 2) return coordinates;

  const simplified = [coordinates[0]]; // Always keep first point
  let lastKept = coordinates[0];

  for (let i = 1; i < coordinates.length - 1; i++) {
    const [lon, lat] = coordinates[i];
    const [lastLon, lastLat] = lastKept;
    const dist = haversineDistance(lastLat, lastLon, lat, lon);

    if (dist >= MIN_DISTANCE_METERS) {
      simplified.push(coordinates[i]);
      lastKept = coordinates[i];
    }
  }

  // Always keep last point
  simplified.push(coordinates[coordinates.length - 1]);

  return simplified;
}

console.log("Reading Denver routes...");
const data = JSON.parse(fs.readFileSync(inputFile, "utf8"));

let totalBefore = 0;
let totalAfter = 0;

console.log(`Processing ${data.features.length} features...`);

data.features.forEach((feature) => {
  const before = feature.geometry.coordinates.length;
  totalBefore += before;

  feature.geometry.coordinates = simplifyLineString(
    feature.geometry.coordinates,
  );

  const after = feature.geometry.coordinates.length;
  totalAfter += after;

  const reduction = ((1 - after / before) * 100).toFixed(1);
  console.log(
    `  ${feature.properties.route_id} ${feature.properties.direction}: ${before} → ${after} points (${reduction}% reduction)`,
  );
});

console.log(`\nTotal: ${totalBefore} → ${totalAfter} points`);
console.log(
  `Overall reduction: ${((1 - totalAfter / totalBefore) * 100).toFixed(1)}%`,
);

console.log(`\nWriting simplified routes to ${outputFile}...`);
fs.writeFileSync(outputFile, JSON.stringify(data, null, 2));

console.log("Done!");
