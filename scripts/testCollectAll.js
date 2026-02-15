#!/usr/bin/env node

/**
 * Test script to verify collectAll.sh includes all expected cities
 */

import { readFileSync } from "fs";

const expectedCities = [
  { name: "SF", emoji: "🌉", script: "collectData.js" },
  { name: "LA", emoji: "🌴", script: "collectDataLA.js" },
  { name: "Seattle", emoji: "☕", script: "collectDataSeattle.js" },
  { name: "Portland", emoji: "🚲", script: "collectDataPortland.js" },
  { name: "Boston", emoji: "🦞", script: "collectDataBoston.js" },
  { name: "Philadelphia", emoji: "🔔", script: "collectDataPhilly.js" },
  { name: "San Jose", emoji: "💻", script: "collectDataVTA.js" },
  { name: "Toronto", emoji: "🍁", script: "collectDataToronto.js" },
  { name: "Minneapolis", emoji: "🌲", script: "collectDataMinneapolis.js" },
  { name: "Denver", emoji: "⛏️", script: "collectDataDenver.js" },
  { name: "Salt Lake City", emoji: "🏔️", script: "collectDataSaltLakeCity.js" },
  { name: "Pittsburgh", emoji: "🏗️", script: "collectDataPittsburgh.js" },
  { name: "Phoenix", emoji: "🌵", script: "collectDataPhoenix.js" },
  { name: "Charlotte", emoji: "🏦", script: "collectDataCharlotte.js" },
  { name: "Baltimore", emoji: "🦀", script: "collectDataBaltimore.js" },
  { name: "Cleveland", emoji: "🎸", script: "collectDataCleveland.js" },
  { name: "San Diego", emoji: "🌊", script: "collectDataSanDiego.js" },
  { name: "Sacramento", emoji: "🍇", script: "collectDataSacramento.js" },
  { name: "Dallas", emoji: "🤠", script: "collectDataDallas.js" },
  { name: "Calgary", emoji: "🍁", script: "collectDataCalgary.js" },
];

console.log("🧪 Testing collectAll.sh configuration...\n");

try {
  const collectAllContent = readFileSync("scripts/collectAll.sh", "utf8");

  let allFound = true;
  let missingCities = [];

  for (const city of expectedCities) {
    const pattern = `start_collector "${city.name}" "${city.script}" "${city.emoji}"`;
    if (!collectAllContent.includes(pattern)) {
      allFound = false;
      missingCities.push(city);
      console.log(`❌ Missing: ${city.emoji} ${city.name} (${city.script})`);
    } else {
      console.log(`✅ Found: ${city.emoji} ${city.name} (${city.script})`);
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Total expected cities: ${expectedCities.length}`);
  console.log(
    `   Cities found: ${expectedCities.length - missingCities.length}`,
  );
  console.log(`   Cities missing: ${missingCities.length}`);

  if (allFound) {
    console.log(`\n🎉 All cities are properly configured in collectAll.sh!`);
  } else {
    console.log(`\n⚠️  Some cities are missing from collectAll.sh`);
    process.exit(1);
  }
} catch (error) {
  console.error("❌ Error reading collectAll.sh:", error.message);
  process.exit(1);
}
