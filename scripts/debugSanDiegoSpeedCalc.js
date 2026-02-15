#!/usr/bin/env node

/**
 * Debug San Diego speed calculation
 * Check if the collector is actually calculating speeds
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://REDACTED_SUPABASE_REF.supabase.co";
const SUPABASE_ANON_KEY =
  "REDACTED_SUPABASE_KEY";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Simulate the collector's speed calculation logic
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calculateSpeedBetweenPoints(pos1, pos2) {
  const dt =
    (new Date(pos2.recorded_at).getTime() -
      new Date(pos1.recorded_at).getTime()) /
    1000;
  const dist = haversine(pos1.lat, pos1.lon, pos2.lat, pos2.lon);

  if (dt < 5 || dt > 180 || dist < 1) return null;

  const speedMps = dist / dt;
  return Math.round(speedMps * 2.237 * 10) / 10;
}

async function debugSanDiegoSpeedCalc() {
  console.log("🔍 Debugging San Diego speed calculation...\n");

  try {
    // Get recent San Diego data
    const { data: recentData, error } = await supabase
      .from("vehicle_positions")
      .select(
        "id,vehicle_id,lat,lon,route_id,speed_calculated,recorded_at,city",
      )
      .or("city.is.null,city.eq.San Diego")
      .in("route_id", ["510", "520", "530", "535"])
      .order("recorded_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("❌ Database error:", error.message);
      return;
    }

    if (!recentData || recentData.length === 0) {
      console.log("❌ No San Diego data found in database");
      return;
    }

    console.log(`📊 Found ${recentData.length} San Diego records`);

    // Analyze speed data
    const withSpeed = recentData.filter(
      (r) => r.speed_calculated !== null && r.speed_calculated !== undefined,
    );
    const withoutSpeed = recentData.filter(
      (r) => r.speed_calculated === null || r.speed_calculated === undefined,
    );

    console.log(`🚄 Records with speed: ${withSpeed.length}`);
    console.log(`⚫ Records without speed: ${withoutSpeed.length}`);

    if (withSpeed.length > 0) {
      console.log("\n✅ GOOD: Some records have speed data!");
      console.log("Sample records with speed:");
      withSpeed.slice(0, 5).forEach((r, i) => {
        console.log(
          `   ${i + 1}. Vehicle ${r.vehicle_id} on route ${r.route_id}: ${r.speed_calculated} mph`,
        );
      });
    } else {
      console.log("\n❌ PROBLEM: No records have speed data!");
    }

    // Group by vehicle to check for consecutive readings
    console.log("\n🔍 Analyzing consecutive readings per vehicle:");
    const vehicleGroups = {};
    recentData.forEach((r) => {
      if (!vehicleGroups[r.vehicle_id]) {
        vehicleGroups[r.vehicle_id] = [];
      }
      vehicleGroups[r.vehicle_id].push(r);
    });

    // Sort each vehicle's readings by time
    Object.keys(vehicleGroups).forEach((vehicleId) => {
      vehicleGroups[vehicleId].sort(
        (a, b) => new Date(a.recorded_at) - new Date(b.recorded_at),
      );
    });

    const vehicleAnalysis = Object.entries(vehicleGroups).map(
      ([vehicleId, readings]) => ({
        vehicleId,
        readingCount: readings.length,
        route: readings[0].route_id,
        hasSpeed: readings.some((r) => r.speed_calculated !== null),
        readings: readings,
      }),
    );

    console.log(
      `📈 Vehicle analysis (${vehicleAnalysis.length} unique vehicles):`,
    );

    const singleReading = vehicleAnalysis.filter((v) => v.readingCount === 1);
    const multipleReadings = vehicleAnalysis.filter((v) => v.readingCount > 1);
    const withSpeedData = vehicleAnalysis.filter((v) => v.hasSpeed);

    console.log(
      `   Vehicles with 1 reading: ${singleReading.length} (expected to have no speed)`,
    );
    console.log(
      `   Vehicles with 2+ readings: ${multipleReadings.length} (should have speed if moving)`,
    );
    console.log(`   Vehicles with speed data: ${withSpeedData.length}`);

    if (multipleReadings.length > 0 && withSpeedData.length === 0) {
      console.log(
        "\n🚨 ISSUE FOUND: Vehicles have multiple readings but no speed data!",
      );
      console.log("Let's manually calculate speed for a few vehicles:");

      for (let i = 0; i < Math.min(3, multipleReadings.length); i++) {
        const vehicle = multipleReadings[i];
        console.log(
          `\n🚊 Vehicle ${vehicle.vehicleId} (Route ${vehicle.route}):`,
        );
        console.log(`   Total readings: ${vehicle.readingCount}`);

        for (let j = 1; j < vehicle.readings.length; j++) {
          const prev = vehicle.readings[j - 1];
          const curr = vehicle.readings[j];

          const calculatedSpeed = calculateSpeedBetweenPoints(prev, curr);
          const storedSpeed = curr.speed_calculated;

          const timeDiff =
            (new Date(curr.recorded_at) - new Date(prev.recorded_at)) / 1000;
          const distance = haversine(prev.lat, prev.lon, curr.lat, curr.lon);

          console.log(
            `   Reading ${j}: ${prev.recorded_at} -> ${curr.recorded_at}`,
          );
          console.log(
            `     Time diff: ${timeDiff.toFixed(1)}s, Distance: ${distance.toFixed(1)}m`,
          );
          console.log(`     Calculated speed: ${calculatedSpeed} mph`);
          console.log(`     Stored speed: ${storedSpeed}`);
          console.log(
            `     Match: ${calculatedSpeed === storedSpeed ? "✅" : "❌"}`,
          );
        }
      }
    }

    // Check time distribution
    console.log("\n⏰ Time distribution of readings:");
    const now = new Date();
    const timeGroups = {
      "< 5 min": 0,
      "5-15 min": 0,
      "15-30 min": 0,
      "> 30 min": 0,
    };

    recentData.forEach((r) => {
      const ageMinutes = (now - new Date(r.recorded_at)) / (1000 * 60);
      if (ageMinutes < 5) timeGroups["< 5 min"]++;
      else if (ageMinutes < 15) timeGroups["5-15 min"]++;
      else if (ageMinutes < 30) timeGroups["15-30 min"]++;
      else timeGroups["> 30 min"]++;
    });

    Object.entries(timeGroups).forEach(([range, count]) => {
      console.log(`   ${range}: ${count} records`);
    });
  } catch (error) {
    console.error("❌ Unexpected error:", error.message);
  }
}

debugSanDiegoSpeedCalc();
