#!/usr/bin/env node

/**
 * Check if San Diego data exists in the database
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.error("❌ Error: SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required");
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkSanDiegoData() {
  console.log("🔍 Checking San Diego data in database...\n");

  try {
    // Check for data with city = "San Diego"
    const { data: withCity, error: cityError } = await supabase
      .from("vehicle_positions")
      .select("id, vehicle_id, route_id, lat, lon, recorded_at, city")
      .eq("city", "San Diego")
      .order("recorded_at", { ascending: false })
      .limit(10);

    if (cityError) {
      console.error("❌ Error querying with city filter:", cityError.message);
    } else {
      console.log(
        `✅ Found ${withCity?.length || 0} records with city = "San Diego"`,
      );
      if (withCity && withCity.length > 0) {
        console.log("📍 Latest San Diego records:");
        withCity.forEach((record, i) => {
          console.log(
            `   ${i + 1}. Vehicle ${record.vehicle_id} on route ${record.route_id} at ${record.recorded_at}`,
          );
        });
      }
    }

    console.log();

    // Check for data with null city (legacy data)
    const { data: withoutCity, error: nullError } = await supabase
      .from("vehicle_positions")
      .select("id, vehicle_id, route_id, lat, lon, recorded_at, city")
      .is("city", null)
      .order("recorded_at", { ascending: false })
      .limit(10);

    if (nullError) {
      console.error("❌ Error querying with null city:", nullError.message);
    } else {
      console.log(
        `✅ Found ${withoutCity?.length || 0} records with city = null (legacy)`,
      );
      if (withoutCity && withoutCity.length > 0) {
        console.log("📍 Latest legacy records:");
        withoutCity.forEach((record, i) => {
          console.log(
            `   ${i + 1}. Vehicle ${record.vehicle_id} on route ${record.route_id} at ${record.recorded_at}`,
          );
        });
      }
    }

    console.log();

    // Check for San Diego trolley route IDs (510, 520, 530, 535) regardless of city
    const { data: trolleyRoutes, error: routeError } = await supabase
      .from("vehicle_positions")
      .select("id, vehicle_id, route_id, lat, lon, recorded_at, city")
      .in("route_id", ["510", "520", "530", "535"])
      .order("recorded_at", { ascending: false })
      .limit(10);

    if (routeError) {
      console.error("❌ Error querying trolley routes:", routeError.message);
    } else {
      console.log(
        `✅ Found ${trolleyRoutes?.length || 0} records with San Diego trolley route IDs (510, 520, 530, 535)`,
      );
      if (trolleyRoutes && trolleyRoutes.length > 0) {
        console.log("🚊 Latest trolley records:");
        trolleyRoutes.forEach((record, i) => {
          console.log(
            `   ${i + 1}. Vehicle ${record.vehicle_id} on route ${record.route_id} (city: ${record.city || "null"}) at ${record.recorded_at}`,
          );
        });
      }
    }

    console.log();

    // Test the new query logic (like SF)
    const { data: combinedQuery, error: combinedError } = await supabase
      .from("vehicle_positions")
      .select("id, vehicle_id, route_id, lat, lon, recorded_at, city")
      .or("city.is.null,city.eq.San Diego")
      .order("recorded_at", { ascending: false })
      .limit(10);

    if (combinedError) {
      console.error("❌ Error with combined query:", combinedError.message);
    } else {
      console.log(
        `✅ Combined query (city = null OR city = "San Diego") found ${combinedQuery?.length || 0} records`,
      );
      if (combinedQuery && combinedQuery.length > 0) {
        console.log("🔄 Latest combined records:");
        combinedQuery.forEach((record, i) => {
          console.log(
            `   ${i + 1}. Vehicle ${record.vehicle_id} on route ${record.route_id} (city: ${record.city || "null"}) at ${record.recorded_at}`,
          );
        });
      }
    }
  } catch (error) {
    console.error("❌ Unexpected error:", error.message);
  }
}

checkSanDiegoData();
