#!/usr/bin/env node

/**
 * Check San Diego data directly in database
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.error("❌ Error: SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required");
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkSanDiegoDbDirect() {
  console.log("🔍 Checking San Diego data directly in database...\n");

  try {
    // Check recent data with different city filters
    console.log("1. Checking with city = 'San Diego':");
    const { data: withCity, error: cityError } = await supabase
      .from("vehicle_positions")
      .select("vehicle_id, route_id, speed_calculated, recorded_at, city")
      .eq("city", "San Diego")
      .order("recorded_at", { ascending: false })
      .limit(10);

    if (cityError) {
      console.error("❌ Error:", cityError.message);
    } else {
      console.log(`   Found ${withCity?.length || 0} records`);
      if (withCity && withCity.length > 0) {
        withCity.forEach((r, i) => {
          console.log(
            `   ${i + 1}. Vehicle ${r.vehicle_id} route ${r.route_id} speed=${r.speed_calculated} city="${r.city}" at ${r.recorded_at}`,
          );
        });
      }
    }

    console.log("\n2. Checking with city IS NULL:");
    const { data: withoutCity, error: nullError } = await supabase
      .from("vehicle_positions")
      .select("vehicle_id, route_id, speed_calculated, recorded_at, city")
      .is("city", null)
      .in("route_id", ["510", "520", "530", "535"])
      .order("recorded_at", { ascending: false })
      .limit(10);

    if (nullError) {
      console.error("❌ Error:", nullError.message);
    } else {
      console.log(`   Found ${withoutCity?.length || 0} records`);
      if (withoutCity && withoutCity.length > 0) {
        withoutCity.forEach((r, i) => {
          console.log(
            `   ${i + 1}. Vehicle ${r.vehicle_id} route ${r.route_id} speed=${r.speed_calculated} city="${r.city}" at ${r.recorded_at}`,
          );
        });
      }
    }

    console.log("\n3. Checking San Diego trolley routes (any city):");
    const { data: trolleyRoutes, error: routeError } = await supabase
      .from("vehicle_positions")
      .select("vehicle_id, route_id, speed_calculated, recorded_at, city")
      .in("route_id", ["510", "520", "530", "535"])
      .order("recorded_at", { ascending: false })
      .limit(10);

    if (routeError) {
      console.error("❌ Error:", routeError.message);
    } else {
      console.log(`   Found ${trolleyRoutes?.length || 0} records`);
      if (trolleyRoutes && trolleyRoutes.length > 0) {
        trolleyRoutes.forEach((r, i) => {
          console.log(
            `   ${i + 1}. Vehicle ${r.vehicle_id} route ${r.route_id} speed=${r.speed_calculated} city="${r.city}" at ${r.recorded_at}`,
          );
        });
      }
    }

    // Check for speed calculation patterns
    console.log("\n4. Speed calculation analysis:");
    const { data: speedAnalysis, error: speedError } = await supabase
      .from("vehicle_positions")
      .select("speed_calculated")
      .in("route_id", ["510", "520", "530", "535"])
      .order("recorded_at", { ascending: false })
      .limit(100);

    if (speedError) {
      console.error("❌ Error:", speedError.message);
    } else if (speedAnalysis) {
      const withSpeed = speedAnalysis.filter(
        (r) => r.speed_calculated !== null,
      );
      const withoutSpeed = speedAnalysis.filter(
        (r) => r.speed_calculated === null,
      );

      console.log(`   Total records analyzed: ${speedAnalysis.length}`);
      console.log(
        `   With speed: ${withSpeed.length} (${((withSpeed.length / speedAnalysis.length) * 100).toFixed(1)}%)`,
      );
      console.log(
        `   Without speed: ${withoutSpeed.length} (${((withoutSpeed.length / speedAnalysis.length) * 100).toFixed(1)}%)`,
      );

      if (withSpeed.length > 0) {
        const speeds = withSpeed
          .map((r) => r.speed_calculated)
          .sort((a, b) => a - b);
        console.log(
          `   Speed range: ${speeds[0]} - ${speeds[speeds.length - 1]} mph`,
        );
        console.log(
          `   Average speed: ${(speeds.reduce((a, b) => a + b, 0) / speeds.length).toFixed(1)} mph`,
        );
      }
    }

    // Check collector activity
    console.log("\n5. Collector activity check:");
    const { data: recentActivity, error: activityError } = await supabase
      .from("vehicle_positions")
      .select("recorded_at")
      .in("route_id", ["510", "520", "530", "535"])
      .gte("recorded_at", new Date(Date.now() - 30 * 60 * 1000).toISOString()) // Last 30 minutes
      .order("recorded_at", { ascending: false });

    if (activityError) {
      console.error("❌ Error:", activityError.message);
    } else if (recentActivity) {
      console.log(`   Records in last 30 minutes: ${recentActivity.length}`);
      if (recentActivity.length > 0) {
        const latest = new Date(recentActivity[0].recorded_at);
        const ageMinutes = (Date.now() - latest.getTime()) / (1000 * 60);
        console.log(`   Latest record: ${ageMinutes.toFixed(1)} minutes ago`);

        if (ageMinutes < 5) {
          console.log("   ✅ Collector is actively running");
        } else if (ageMinutes < 15) {
          console.log("   ⚠️  Collector may be slow or having issues");
        } else {
          console.log("   ❌ Collector appears to be stopped");
        }
      }
    }
  } catch (error) {
    console.error("❌ Unexpected error:", error.message);
  }
}

checkSanDiegoDbDirect();
