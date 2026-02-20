#!/usr/bin/env node

/**
 * Check data for all cities that are having issues
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.error("❌ Error: SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required");
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const PROBLEM_CITIES = [
  "San Diego",
  "Phoenix",
  "Charlotte",
  "Baltimore",
  "Cleveland",
];

async function checkCityData(cityName) {
  console.log(`\n🔍 Checking ${cityName}...`);

  try {
    // Check recent data (last 7 days)
    const sevenDaysAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data: recentData, error: recentError } = await supabase
      .from("vehicle_positions")
      .select("id, vehicle_id, route_id, recorded_at, city")
      .eq("city", cityName)
      .gte("recorded_at", sevenDaysAgo)
      .order("recorded_at", { ascending: false })
      .limit(5);

    if (recentError) {
      console.error(`   ❌ Error querying recent data: ${recentError.message}`);
      return;
    }

    console.log(
      `   📊 Recent data (last 7 days): ${recentData?.length || 0} records`,
    );

    if (recentData && recentData.length > 0) {
      console.log(`   📍 Latest record: ${recentData[0].recorded_at}`);
      const routes = [...new Set(recentData.map((r) => r.route_id))];
      console.log(`   🚊 Routes: ${routes.join(", ")}`);
    }

    // Check all-time data
    const { data: allTimeData, error: allTimeError } = await supabase
      .from("vehicle_positions")
      .select("id, recorded_at")
      .eq("city", cityName)
      .order("recorded_at", { ascending: false })
      .limit(1);

    if (allTimeError) {
      console.error(
        `   ❌ Error querying all-time data: ${allTimeError.message}`,
      );
      return;
    }

    if (allTimeData && allTimeData.length > 0) {
      console.log(`   🕒 Last data ever: ${allTimeData[0].recorded_at}`);
    } else {
      console.log(`   ⚠️  No data found for ${cityName}`);
    }

    // Check if there's any legacy data (null city) that might belong to this city
    if (cityName === "San Diego") {
      // Check for San Diego trolley routes in legacy data
      const { data: legacyTrolley, error: legacyError } = await supabase
        .from("vehicle_positions")
        .select("id, route_id, recorded_at, city")
        .in("route_id", ["510", "520", "530", "535"])
        .is("city", null)
        .order("recorded_at", { ascending: false })
        .limit(5);

      if (!legacyError && legacyTrolley && legacyTrolley.length > 0) {
        console.log(
          `   🔄 Legacy trolley data (null city): ${legacyTrolley.length} records`,
        );
        console.log(`   📍 Latest legacy: ${legacyTrolley[0].recorded_at}`);
      }
    }
  } catch (error) {
    console.error(`   ❌ Unexpected error for ${cityName}: ${error.message}`);
  }
}

async function checkAllCities() {
  console.log("🔍 Checking data for problem cities...\n");

  for (const city of PROBLEM_CITIES) {
    await checkCityData(city);
  }

  console.log("\n📊 Summary:");
  console.log(
    "   - San Diego: Should have data but query logic was broken (now fixed)",
  );
  console.log(
    "   - Phoenix, Charlotte, Baltimore, Cleveland: Likely collection scripts stopped working",
  );
  console.log("\n💡 Next steps:");
  console.log("   1. Test San Diego with the fixed query logic");
  console.log(
    "   2. Check why collection scripts stopped for the other cities",
  );
  console.log("   3. Restart collection scripts if needed");
}

checkAllCities();
