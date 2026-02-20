#!/usr/bin/env node

import fetch from "node-fetch";
import gtfs from "gtfs-realtime-bindings";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.MTS_API_KEY) {
  console.error("❌ Error: MTS_API_KEY environment variable is required");
  process.exit(1);
}

const API_KEY = process.env.MTS_API_KEY;
const URL = `https://realtime.sdmts.com/api/api/gtfs_realtime/vehicle-positions-for-agency/MTS.pb?key=${API_KEY}`;
const TARGET_ROUTE_IDS = new Set(["510", "520", "530", "535"]);

async function testAPI() {
  console.log("Testing San Diego MTS API...");
  console.log("Target routes:", [...TARGET_ROUTE_IDS]);
  console.log("URL:", URL);
  console.log();

  try {
    const res = await fetch(URL);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const buffer = await res.arrayBuffer();
    const feed = gtfs.transit_realtime.FeedMessage.decode(
      new Uint8Array(buffer),
    );

    console.log(`✅ API Success. Found ${feed.entity.length} total entities`);

    // Analyze all routes in the feed
    const allRoutes = new Set();
    const targetRouteVehicles = [];

    for (const entity of feed.entity) {
      const vehicle = entity.vehicle;
      if (!vehicle?.trip?.routeId) continue;

      const routeId = vehicle.trip.routeId;
      allRoutes.add(routeId);

      if (TARGET_ROUTE_IDS.has(routeId)) {
        targetRouteVehicles.push({
          vehicleId: vehicle.vehicle?.id,
          routeId: routeId,
          directionId: vehicle.trip?.directionId,
          lat: vehicle.position?.latitude,
          lon: vehicle.position?.longitude,
          timestamp: vehicle.timestamp
            ? new Date(vehicle.timestamp * 1000).toISOString()
            : null,
        });
      }
    }

    console.log("\n📊 Route Analysis:");
    console.log("All routes found in feed:", [...allRoutes].sort());
    console.log(
      "Target routes found:",
      [...new Set(targetRouteVehicles.map((v) => v.routeId))].sort(),
    );
    console.log("Target route vehicles:", targetRouteVehicles.length);

    console.log("\n🚊 Target Route Breakdown:");
    TARGET_ROUTE_IDS.forEach((routeId) => {
      const vehicles = targetRouteVehicles.filter((v) => v.routeId === routeId);
      console.log(`  Route ${routeId}: ${vehicles.length} vehicles`);
      if (vehicles.length > 0) {
        vehicles.forEach((v, i) => {
          console.log(
            `    ${i + 1}. Vehicle ${v.vehicleId} at (${v.lat}, ${v.lon}) dir=${v.directionId}`,
          );
        });
      }
    });

    if (targetRouteVehicles.length === 0) {
      console.log("\n❌ No vehicles found for target routes!");
      console.log("This could mean:");
      console.log("  - Routes are not currently running");
      console.log("  - Route IDs have changed");
      console.log("  - Vehicles are not reporting positions");
    }
  } catch (err) {
    console.error("❌ API Error:", err.message);

    if (err.message.includes("ETIMEDOUT")) {
      console.log("\n🔍 Timeout Analysis:");
      console.log("  - This suggests the MTS server is not responding");
      console.log(
        "  - Could be server maintenance, overload, or network issues",
      );
      console.log("  - Try again in a few minutes");
    }
  }
}

testAPI();
