#!/usr/bin/env node
/**
 * Toronto TTC Streetcar Data Collector
 *
 * Fetches real-time vehicle positions from TTC's NextBus-compatible API,
 * calculates speeds between consecutive readings, and stores in Supabase.
 *
 * No API key required - TTC provides open data feeds.
 *
 * Usage: npm run collect:toronto
 */

import { createClient } from "@supabase/supabase-js";

// Configuration
const SUPABASE_URL = "https://REDACTED_SUPABASE_REF.supabase.co";
const SUPABASE_ANON_KEY =
  "REDACTED_SUPABASE_KEY";

// TTC uses NextBus/Umo API
const API_BASE_URL = "https://retro.umoiq.com/service/publicJSONFeed";

// Streetcar route tags
const STREETCAR_ROUTES = [
  "501",
  "503",
  "504",
  "505",
  "506",
  "507",
  "508",
  "509",
  "510",
  "511",
  "512",
];

const POLL_INTERVAL_MS = 90000; // 90 seconds

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Store last known positions for speed calculation
const lastPositions = new Map();

// Calculate distance between two points in meters (Haversine formula)
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Convert meters per second to miles per hour
function mpsToMph(mps) {
  return mps * 2.237;
}

// Format timestamp for logging
function formatTime(date) {
  return date.toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: "America/Toronto",
  });
}

// Fetch vehicle positions for a single route
async function fetchRouteVehicles(routeTag) {
  try {
    const url = `${API_BASE_URL}?command=vehicleLocations&a=ttc&r=${routeTag}&t=0`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.vehicle) {
      return [];
    }

    // Handle both single vehicle and array of vehicles
    const vehicles = Array.isArray(data.vehicle)
      ? data.vehicle
      : [data.vehicle];

    return vehicles.map((v) => ({
      vehicle_id: v.id,
      route_id: routeTag,
      direction_id: v.dirTag || "",
      lat: parseFloat(v.lat),
      lon: parseFloat(v.lon),
      speed_reported: v.speedKmHr ? parseFloat(v.speedKmHr) * 0.621371 : null, // Convert km/h to mph
      heading: v.heading ? parseFloat(v.heading) : null,
      recorded_at: v.secsSinceReport
        ? new Date(Date.now() - v.secsSinceReport * 1000).toISOString()
        : new Date().toISOString(),
      city: "Toronto",
    }));
  } catch (error) {
    console.error(`   Error fetching route ${routeTag}:`, error.message);
    return [];
  }
}

// Calculate speed from last known position
function calculateSpeed(vehicle) {
  const key = vehicle.vehicle_id;
  const prev = lastPositions.get(key);

  const now = new Date(vehicle.recorded_at);

  if (!prev) {
    lastPositions.set(key, { lat: vehicle.lat, lon: vehicle.lon, time: now });
    return null;
  }

  const timeDiffMs = now.getTime() - prev.time.getTime();
  const timeDiffSeconds = timeDiffMs / 1000;

  // Only calculate speed if time gap is reasonable (5-180 seconds)
  if (timeDiffSeconds < 5 || timeDiffSeconds > 180) {
    lastPositions.set(key, { lat: vehicle.lat, lon: vehicle.lon, time: now });
    return null;
  }

  const distanceMeters = haversineDistance(
    prev.lat,
    prev.lon,
    vehicle.lat,
    vehicle.lon
  );

  if (distanceMeters < 1) {
    lastPositions.set(key, { lat: vehicle.lat, lon: vehicle.lon, time: now });
    return 0;
  }

  const speedMps = distanceMeters / timeDiffSeconds;
  const speedMph = mpsToMph(speedMps);

  if (speedMph > 100) {
    lastPositions.set(key, { lat: vehicle.lat, lon: vehicle.lon, time: now });
    return null;
  }

  lastPositions.set(key, { lat: vehicle.lat, lon: vehicle.lon, time: now });
  return speedMph;
}

// Main collection loop
async function collectData() {
  console.log(
    `[${formatTime(new Date())}] Fetching Toronto TTC vehicle positions...`
  );

  try {
    // Fetch all routes in parallel
    const allVehicles = [];

    for (const routeTag of STREETCAR_ROUTES) {
      const vehicles = await fetchRouteVehicles(routeTag);
      allVehicles.push(...vehicles);
      // Small delay between requests to be polite
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log(`   Found ${allVehicles.length} Streetcar vehicles`);

    if (allVehicles.length === 0) {
      console.log("   No Streetcar vehicles found, skipping...");
      return;
    }

    const positionsToInsert = [];
    let speedCount = 0;

    for (const vehicle of allVehicles) {
      // Use reported speed if available, otherwise calculate
      let speed = vehicle.speed_reported;
      if (speed === null || speed === 0) {
        const calcSpeed = calculateSpeed(vehicle);
        if (calcSpeed !== null) speed = calcSpeed;
      }
      if (speed !== null) speedCount++;

      positionsToInsert.push({
        vehicle_id: vehicle.vehicle_id,
        route_id: vehicle.route_id,
        direction_id: vehicle.direction_id,
        lat: vehicle.lat,
        lon: vehicle.lon,
        speed_calculated: speed,
        recorded_at: vehicle.recorded_at,
        city: "Toronto",
      });
    }

    if (positionsToInsert.length > 0) {
      const startTime = Date.now();
      const { error } = await supabase
        .from("vehicle_positions")
        .insert(positionsToInsert);

      if (error) {
        console.error("   Error saving to Supabase:", error.message);
      } else {
        const duration = Date.now() - startTime;
        console.log(
          `[${formatTime(new Date())}] Saved ${
            positionsToInsert.length
          } positions (${speedCount} with speed) in ${duration}ms`
        );
      }
    }
  } catch (error) {
    console.error(`[${formatTime(new Date())}] Error:`, error.message);
  }
}

// Main entry point
async function main() {
  console.log("🚊 Toronto TTC Streetcar Collector");
  console.log(`   Polling every ${POLL_INTERVAL_MS / 1000} seconds`);
  console.log(`   Tracking routes: ${STREETCAR_ROUTES.join(", ")}`);
  console.log("");

  // Run immediately
  await collectData();

  // Then poll at interval
  setInterval(collectData, POLL_INTERVAL_MS);
}

main();
