#!/usr/bin/env node

/**
 * Complete San Diego debugging - tests the entire data flow
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.error("❌ Error: SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required");
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Frontend constants
const PAGE_SIZE = 1000;
const POSITION_COLUMNS =
  "id,vehicle_id,lat,lon,route_id,direction_id,speed_calculated,recorded_at,headsign";
const SAN_DIEGO_TROLLEY_LINES = ["510", "520", "530", "535"];
const MAX_DISTANCE_FROM_ROUTE_METERS = 100;

// Simulate the frontend's shouldShowRoute function
function shouldShowRoute(routeId, selectedLines, city) {
  // Direct match
  if (selectedLines.includes(routeId)) {
    return true;
  }

  // Sacramento special case: "Shared" vehicles should show when either Gold or Blue is selected
  if (
    city === "Sacramento" &&
    routeId === "Shared" &&
    (selectedLines.includes("Gold") || selectedLines.includes("Blue"))
  ) {
    return true;
  }

  return false;
}

async function debugSanDiegoComplete() {
  console.log(
    "🔍 Complete San Diego debugging - simulating frontend data flow...\n",
  );

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  console.log(`📅 Querying data since: ${since}\n`);

  try {
    // Step 1: Test the exact query the frontend uses (with our fix)
    console.log("🧪 Step 1: Frontend query simulation");
    const { data: frontendQuery, error: frontendError } = await supabase
      .from("vehicle_positions")
      .select(POSITION_COLUMNS)
      .gte("recorded_at", since)
      .or("city.is.null,city.eq.San Diego")
      .order("recorded_at", { ascending: false })
      .range(0, PAGE_SIZE - 1);

    if (frontendError) {
      console.error("❌ Frontend query error:", frontendError.message);
      return;
    }

    console.log(
      `✅ Frontend query found ${frontendQuery?.length || 0} records`,
    );

    if (!frontendQuery || frontendQuery.length === 0) {
      console.log("❌ No data found - this is the root cause!");
      return;
    }

    // Step 2: Simulate frontend data processing
    console.log("\n🧪 Step 2: Frontend data processing simulation");

    // Convert to frontend Vehicle format
    const vehicles = frontendQuery.map((record) => ({
      id: record.id,
      lat: record.lat,
      lon: record.lon,
      routeId: record.route_id,
      direction: record.direction_id,
      speed: record.speed_calculated,
      recordedAt: record.recorded_at,
      headsign: record.headsign,
    }));

    console.log(`📊 Converted ${vehicles.length} records to frontend format`);

    // Step 3: Test line filtering (simulate user selecting all San Diego lines)
    console.log("\n🧪 Step 3: Line filtering simulation");
    const selectedLines = SAN_DIEGO_TROLLEY_LINES; // All San Diego lines selected
    console.log(`🎯 Selected lines: ${selectedLines.join(", ")}`);

    const filteredByLines = vehicles.filter((v) =>
      shouldShowRoute(v.routeId, selectedLines, "San Diego"),
    );

    console.log(`✅ After line filtering: ${filteredByLines.length} vehicles`);

    if (filteredByLines.length === 0) {
      console.log("❌ No vehicles after line filtering!");
      console.log("🔍 Checking route IDs in data:");
      const routeIds = [...new Set(vehicles.map((v) => v.routeId))];
      console.log(`   Found route IDs: ${routeIds.join(", ")}`);
      console.log(`   Expected route IDs: ${selectedLines.join(", ")}`);

      const matchingRoutes = routeIds.filter((id) =>
        selectedLines.includes(id),
      );
      console.log(`   Matching routes: ${matchingRoutes.join(", ") || "NONE"}`);
      return;
    }

    // Step 4: Route breakdown
    console.log("\n🧪 Step 4: Route breakdown");
    const routeBreakdown = {};
    filteredByLines.forEach((v) => {
      routeBreakdown[v.routeId] = (routeBreakdown[v.routeId] || 0) + 1;
    });

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

    // Step 5: Check for recent data
    console.log("\n🧪 Step 5: Recent data check");
    const recentVehicles = filteredByLines.filter((v) => {
      const recordedTime = new Date(v.recordedAt).getTime();
      const now = Date.now();
      const ageMinutes = (now - recordedTime) / (1000 * 60);
      return ageMinutes < 60; // Last hour
    });

    console.log(`⏰ Vehicles from last hour: ${recentVehicles.length}`);

    if (recentVehicles.length > 0) {
      console.log("📍 Sample recent vehicles:");
      recentVehicles.slice(0, 5).forEach((v, i) => {
        const ageMinutes = Math.round(
          (Date.now() - new Date(v.recordedAt).getTime()) / 60000,
        );
        console.log(
          `   ${i + 1}. Vehicle ${v.id} on route ${v.routeId} (${ageMinutes}min ago) at [${v.lat}, ${v.lon}]`,
        );
      });
    }

    // Step 6: Speed data check
    console.log("\n🧪 Step 6: Speed data analysis");
    const vehiclesWithSpeed = filteredByLines.filter(
      (v) => v.speed != null && v.speed > 0,
    );
    const vehiclesWithoutSpeed = filteredByLines.filter(
      (v) => v.speed == null || v.speed === 0,
    );

    console.log(`🚄 Vehicles with speed data: ${vehiclesWithSpeed.length}`);
    console.log(
      `⚫ Vehicles without speed data: ${vehiclesWithoutSpeed.length}`,
    );

    if (vehiclesWithSpeed.length > 0) {
      const speeds = vehiclesWithSpeed
        .map((v) => v.speed)
        .sort((a, b) => a - b);
      const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
      const medianSpeed = speeds[Math.floor(speeds.length / 2)];
      console.log(`   Average speed: ${avgSpeed.toFixed(1)} mph`);
      console.log(`   Median speed: ${medianSpeed.toFixed(1)} mph`);
      console.log(
        `   Speed range: ${speeds[0].toFixed(1)} - ${speeds[speeds.length - 1].toFixed(1)} mph`,
      );
    }

    // Step 7: Geographic distribution
    console.log("\n🧪 Step 7: Geographic distribution");
    const latitudes = filteredByLines.map((v) => v.lat);
    const longitudes = filteredByLines.map((v) => v.lon);

    if (latitudes.length > 0) {
      const minLat = Math.min(...latitudes);
      const maxLat = Math.max(...latitudes);
      const minLon = Math.min(...longitudes);
      const maxLon = Math.max(...longitudes);

      console.log(`📍 Geographic bounds:`);
      console.log(`   Latitude: ${minLat.toFixed(4)} to ${maxLat.toFixed(4)}`);
      console.log(`   Longitude: ${minLon.toFixed(4)} to ${maxLon.toFixed(4)}`);

      // Check if coordinates are in San Diego area
      const sdLatRange = [32.5, 33.0];
      const sdLonRange = [-117.5, -116.8];

      const inSdArea =
        latitudes.every(
          (lat) => lat >= sdLatRange[0] && lat <= sdLatRange[1],
        ) &&
        longitudes.every((lon) => lon >= sdLonRange[0] && lon <= sdLonRange[1]);

      console.log(`   In San Diego area: ${inSdArea ? "✅ Yes" : "❌ No"}`);
    }

    console.log("\n🎉 San Diego data flow analysis complete!");
    console.log(
      `📊 Summary: ${filteredByLines.length} vehicles should be visible on the map`,
    );
  } catch (error) {
    console.error("❌ Unexpected error:", error.message);
  }
}

debugSanDiegoComplete();
