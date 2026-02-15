#!/usr/bin/env node

/**
 * Test San Diego collector to see if it's working properly
 */

import fetch from "node-fetch";
import gtfs from "gtfs-realtime-bindings";

const { transit_realtime } = gtfs;

// Config (same as collector)
const API_KEY = "REDACTED_MTS_KEY";
const URL = `https://realtime.sdmts.com/api/api/gtfs_realtime/vehicle-positions-for-agency/MTS.pb?key=${API_KEY}`;
const TARGET_ROUTE_IDS = new Set(["510", "520", "530", "535"]);

async function testSanDiegoCollector() {
  console.log("🧪 Testing San Diego MTS GTFS-RT API...\n");

  try {
    console.log("📡 Fetching from MTS API...");
    const res = await fetch(URL);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    console.log("✅ API response received");

    const buffer = await res.arrayBuffer();
    const feed = gtfs.transit_realtime.FeedMessage.decode(
      new Uint8Array(buffer),
    );

    console.log(`📊 Total entities in feed: ${feed.entity.length}`);

    // Filter for trolley vehicles
    const trolleyVehicles = feed.entity.filter((e) => {
      const routeId = e.vehicle?.trip?.routeId;
      return routeId && TARGET_ROUTE_IDS.has(routeId);
    });

    console.log(`🚊 Trolley vehicles found: ${trolleyVehicles.length}`);

    if (trolleyVehicles.length === 0) {
      console.log("❌ No trolley vehicles found!");
      console.log("🔍 Checking all route IDs in feed:");

      const allRouteIds = new Set();
      feed.entity.forEach((e) => {
        const routeId = e.vehicle?.trip?.routeId;
        if (routeId) allRouteIds.add(routeId);
      });

      console.log(`   Found route IDs: ${[...allRouteIds].sort().join(", ")}`);
      console.log(`   Expected route IDs: ${[...TARGET_ROUTE_IDS].join(", ")}`);
      return;
    }

    // Analyze trolley vehicles
    console.log("\n🚊 Trolley vehicle analysis:");

    const routeBreakdown = {};
    const vehiclesWithSpeed = [];
    const vehiclesWithoutSpeed = [];

    trolleyVehicles.forEach((e) => {
      const v = e.vehicle;
      const routeId = v.trip?.routeId;
      const vehicleId = v.vehicle?.id;
      const lat = v.position?.latitude;
      const lon = v.position?.longitude;
      const speed = v.position?.speed; // GTFS-RT reported speed (m/s)
      const timestamp = v.timestamp;

      // Route breakdown
      routeBreakdown[routeId] = (routeBreakdown[routeId] || 0) + 1;

      // Speed analysis
      if (speed != null && speed > 0) {
        vehiclesWithSpeed.push({
          vehicleId,
          routeId,
          speedMps: speed,
          speedMph: speed * 2.237,
        });
      } else {
        vehiclesWithoutSpeed.push({
          vehicleId,
          routeId,
          lat,
          lon,
          timestamp,
        });
      }
    });

    // Route breakdown
    console.log("📈 Route breakdown:");
    Object.entries(routeBreakdown).forEach(([route, count]) => {
      const lineName =
        {
          510: "Blue Line",
          520: "Orange Line",
          530: "Green Line",
          535: "Copper Line",
        }[route] || "Unknown";
      console.log(`   Route ${route} (${lineName}): ${count} vehicles`);
    });

    // Speed analysis
    console.log(`\n🚄 Speed analysis:`);
    console.log(`   Vehicles with GTFS-RT speed: ${vehiclesWithSpeed.length}`);
    console.log(
      `   Vehicles without GTFS-RT speed: ${vehiclesWithoutSpeed.length}`,
    );

    if (vehiclesWithSpeed.length > 0) {
      console.log("   Sample vehicles with speed:");
      vehiclesWithSpeed.slice(0, 3).forEach((v, i) => {
        console.log(
          `     ${i + 1}. Vehicle ${v.vehicleId} on ${v.routeId}: ${v.speedMph.toFixed(1)} mph`,
        );
      });
    }

    // Position analysis
    console.log(`\n📍 Position analysis:`);
    const vehiclesWithPosition = trolleyVehicles.filter(
      (e) => e.vehicle?.position?.latitude && e.vehicle?.position?.longitude,
    );
    console.log(`   Vehicles with position: ${vehiclesWithPosition.length}`);

    if (vehiclesWithPosition.length > 0) {
      console.log("   Sample positions:");
      vehiclesWithPosition.slice(0, 3).forEach((e, i) => {
        const v = e.vehicle;
        console.log(
          `     ${i + 1}. Vehicle ${v.vehicle?.id} on ${v.trip?.routeId}: [${v.position.latitude.toFixed(4)}, ${v.position.longitude.toFixed(4)}]`,
        );
      });
    }

    // Timestamp analysis
    console.log(`\n⏰ Timestamp analysis:`);
    const now = Date.now() / 1000;
    const timestamps = trolleyVehicles
      .map((e) => e.vehicle?.timestamp)
      .filter((t) => t != null);

    if (timestamps.length > 0) {
      const ages = timestamps.map((t) => now - t);
      const avgAge = ages.reduce((a, b) => a + b, 0) / ages.length;
      const maxAge = Math.max(...ages);
      const minAge = Math.min(...ages);

      console.log(`   Average data age: ${(avgAge / 60).toFixed(1)} minutes`);
      console.log(`   Oldest data: ${(maxAge / 60).toFixed(1)} minutes`);
      console.log(`   Newest data: ${(minAge / 60).toFixed(1)} minutes`);
    }

    console.log("\n✅ San Diego collector test complete!");
  } catch (error) {
    console.error("❌ Error testing San Diego collector:", error.message);
  }
}

testSanDiegoCollector();
