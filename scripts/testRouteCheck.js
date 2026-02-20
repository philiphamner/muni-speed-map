#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.error("❌ Error: SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required");
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
);

async function checkRoutes() {
  console.log("Checking San Diego routes in database...");

  const { data, error } = await supabase
    .from("vehicle_positions")
    .select("route_id, vehicle_id, recorded_at")
    .eq("city", "San Diego")
    .order("recorded_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Error:", error.message);
    return;
  }

  const routes = [...new Set(data.map((r) => r.route_id))];
  console.log("Routes found:", routes);
  console.log("Total recent records:", data.length);

  // Show breakdown by route
  routes.forEach((route) => {
    const count = data.filter((r) => r.route_id === route).length;
    console.log(`  Route ${route}: ${count} records`);
  });

  if (data.length > 0) {
    console.log("Latest record:", data[0].recorded_at);
  }
}

checkRoutes();
