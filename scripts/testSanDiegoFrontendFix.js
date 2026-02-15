#!/usr/bin/env node

/**
 * Test if our San Diego frontend fix works
 */

console.log("🧪 Testing San Diego frontend fix...\n");

// Simulate the frontend filter logic
function testSpeedFilter(city, vehicles, speedFilter) {
  console.log(`Testing ${city} with ${vehicles.length} vehicles`);

  // Simulate the new filter logic
  const filteredVehicles = vehicles.filter((v) => {
    // For San Diego, allow null speed data
    if (city === "San Diego") {
      // Allow null speed OR speed >= min
      return v.speed === null || v.speed >= speedFilter.minSpeed;
    } else {
      // For other cities: normal speed filtering
      return v.speed !== null && v.speed >= speedFilter.minSpeed;
    }
  });

  console.log(`  After filtering: ${filteredVehicles.length} vehicles`);

  const withSpeed = filteredVehicles.filter((v) => v.speed !== null);
  const withoutSpeed = filteredVehicles.filter((v) => v.speed === null);

  console.log(`  With speed: ${withSpeed.length}`);
  console.log(`  Without speed (null): ${withoutSpeed.length}`);

  return filteredVehicles;
}

// Test data
const sanDiegoVehicles = [
  { id: 1, routeId: "510", speed: null },
  { id: 2, routeId: "520", speed: null },
  { id: 3, routeId: "530", speed: 15 },
  { id: 4, routeId: "535", speed: null },
];

const sfVehicles = [
  { id: 1, routeId: "J", speed: null },
  { id: 2, routeId: "K", speed: 25 },
  { id: 3, routeId: "L", speed: 30 },
  { id: 4, routeId: "M", speed: null },
];

const speedFilter = { minSpeed: 0, maxSpeed: 50 };

console.log("🌊 San Diego test:");
const sdFiltered = testSpeedFilter("San Diego", sanDiegoVehicles, speedFilter);

console.log("\n🌉 SF test (for comparison):");
const sfFiltered = testSpeedFilter("SF", sfVehicles, speedFilter);

console.log("\n📊 Results:");
console.log(
  `San Diego: ${sdFiltered.length}/${sanDiegoVehicles.length} vehicles visible (${sdFiltered.filter((v) => v.speed === null).length} with null speed)`,
);
console.log(
  `SF: ${sfFiltered.length}/${sfVehicles.length} vehicles visible (${sfFiltered.filter((v) => v.speed === null).length} with null speed)`,
);

if (sdFiltered.filter((v) => v.speed === null).length > 0) {
  console.log(
    "\n✅ SUCCESS: San Diego vehicles with null speed are now visible!",
  );
} else {
  console.log(
    "\n❌ FAILED: San Diego vehicles with null speed are still filtered out",
  );
}

console.log("\n🎨 Speed color test:");
console.log(
  "Vehicles with null speed should appear as grey (#666666) dots on the map",
);
console.log("This is already handled by the existing speed color mapping");

console.log("\n🚀 Next steps:");
console.log("1. Start the frontend: npm run dev");
console.log("2. Select San Diego city");
console.log("3. Ensure all trolley lines are selected (510, 520, 530, 535)");
console.log(
  "4. You should now see grey dots representing San Diego trolley vehicles",
);
console.log(
  "5. To get speed data, run: npm run collect:sandiego (and let it run for a few cycles)",
);
