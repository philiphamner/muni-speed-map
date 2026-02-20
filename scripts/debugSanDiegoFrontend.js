#!/usr/bin/env node

/**
 * Debug San Diego frontend data loading
 * Tests the same queries the frontend uses
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.error("❌ Error: SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required");
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Same constants as frontend
const PAGE_SIZE = 1000;
const POSITION_COLUMNS =
  "id,vehicle_id,lat,lon,route_id,direction_id,speed_calculated,recorded_at,headsign";

async function debugSanDiegoFrontend() {
  console.log("🔍 Debugging San Diego frontend data loading...\n");

  // Test the exact same time window the frontend uses (last 7 days)
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  console.log(`📅 Querying data since: ${since}\n`);

  try {
    // Test 1: Original query (before our fix)
    console.log("🧪 Test 1: Original query (.eq('city', 'San Diego'))");
    const { data: originalQuery, error: originalError } = await supabase
      .from("vehicle_positions")
      .select(POSITION_COLUMNS)
      .gte("recorded_at", since)
      .eq("city", "San Diego")
      .order("recorded_at", { ascending: false })
      .range(0, PAGE_SIZE - 1);

    if (originalError) {
      console.error("❌ Original query error:", originalError.message);
    } else {
      console.log(
        `✅ Original query found ${originalQuery?.length || 0} records`,
      );
      if (originalQuery && originalQuery.length > 0) {
        console.log("📍 Sample records:");
        originalQuery.slice(0, 3).forEach((record, i) => {
          console.log(
            `   ${i + 1}. Vehicle ${record.vehicle_id} on route ${record.route_id} at ${record.recorded_at}`,
          );
        });
      }
    }

    console.log();

    // Test 2: New query (our fix)
    console.log("🧪 Test 2: New query (.or('city.is.null,city.eq.San Diego'))");
    const { data: newQuery, error: newError } = await supabase
      .from("vehicle_positions")
      .select(POSITION_COLUMNS)
      .gte("recorded_at", since)
      .or("city.is.null,city.eq.San Diego")
      .order("recorded_at", { ascending: false })
      .range(0, PAGE_SIZE - 1);

    if (newError) {
      console.error("❌ New query error:", newError.message);
    } else {
      console.log(`✅ New query found ${newQuery?.length || 0} records`);
      if (newQuery && newQuery.length > 0) {
        console.log("📍 Sample records:");
        newQuery.slice(0, 3).forEach((record, i) => {
          console.log(
            `   ${i + 1}. Vehicle ${record.vehicle_id} on route ${record.route_id} (city: ${record.city || "null"}) at ${record.recorded_at}`,
          );
        });
      }
    }

    console.log();

    // Test 3: Check for San Diego trolley routes specifically
    console.log("🧪 Test 3: San Diego trolley routes filter");
    const { data: trolleyQuery, error: trolleyError } = await supabase
      .from("vehicle_positions")
      .select(POSITION_COLUMNS)
      .gte("recorded_at", since)
      .in("route_id", ["510", "520", "530", "535"])
      .order("recorded_at", { ascending: false })
      .range(0, PAGE_SIZE - 1);

    if (trolleyError) {
      console.error("❌ Trolley query error:", trolleyError.message);
    } else {
      console.log(
        `✅ Trolley routes query found ${trolleyQuery?.length || 0} records`,
      );
      if (trolleyQuery && trolleyQuery.length > 0) {
        console.log("🚊 Route breakdown:");
        const routeCounts = {};
        trolleyQuery.forEach((record) => {
          routeCounts[record.route_id] =
            (routeCounts[record.route_id] || 0) + 1;
        });
        Object.entries(routeCounts).forEach(([route, count]) => {
          const lineName =
            {
              510: "Blue Line",
              520: "Orange Line",
              530: "Green Line",
              535: "Copper Line",
            }[route] || "Unknown";
          console.log(`   Route ${route} (${lineName}): ${count} records`);
        });
      }
    }

    console.log();

    // Test 4: Check recent data (last 2 hours)
    const recentSince = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    console.log(`🧪 Test 4: Recent data (last 2 hours since ${recentSince})`);
    const { data: recentQuery, error: recentError } = await supabase
      .from("vehicle_positions")
      .select(POSITION_COLUMNS)
      .gte("recorded_at", recentSince)
      .or("city.is.null,city.eq.San Diego")
      .order("recorded_at", { ascending: false })
      .limit(10);

    if (recentError) {
      console.error("❌ Recent query error:", recentError.message);
    } else {
      console.log(`✅ Recent query found ${recentQuery?.length || 0} records`);
      if (recentQuery && recentQuery.length > 0) {
        console.log("⏰ Most recent records:");
        recentQuery.forEach((record, i) => {
          const timeAgo = Math.round(
            (Date.now() - new Date(record.recorded_at).getTime()) / 60000,
          );
          console.log(
            `   ${i + 1}. Vehicle ${record.vehicle_id} on route ${record.route_id} (${timeAgo}min ago)`,
          );
        });
      } else {
        console.log(
          "⚠️  No recent San Diego data found - collector may not be running",
        );
      }
    }

    console.log();

    // Test 5: Compare with SF data (working city)
    console.log("🧪 Test 5: Compare with SF data (working city)");
    const { data: sfQuery, error: sfError } = await supabase
      .from("vehicle_positions")
      .select(POSITION_COLUMNS)
      .gte("recorded_at", recentSince)
      .or("city.is.null,city.eq.SF")
      .order("recorded_at", { ascending: false })
      .limit(5);

    if (sfError) {
      console.error("❌ SF query error:", sfError.message);
    } else {
      console.log(`✅ SF query found ${sfQuery?.length || 0} records`);
      if (sfQuery && sfQuery.length > 0) {
        console.log("🌉 SF sample records:");
        sfQuery.forEach((record, i) => {
          const timeAgo = Math.round(
            (Date.now() - new Date(record.recorded_at).getTime()) / 60000,
          );
          console.log(
            `   ${i + 1}. Vehicle ${record.vehicle_id} on route ${record.route_id} (${timeAgo}min ago)`,
          );
        });
      }
    }
  } catch (error) {
    console.error("❌ Unexpected error:", error.message);
  }
}

debugSanDiegoFrontend();
