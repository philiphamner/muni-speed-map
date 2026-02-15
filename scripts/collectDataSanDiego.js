// #!/usr/bin/env node
// /**
//  * San Diego Trolley Speed Map - Data Collector
//  *
//  * Polls MTS OneBusAway API every 90 seconds and saves vehicle positions to Supabase.
//  * Speed is calculated from consecutive readings (OneBusAway doesn't provide speed directly).
//  *
//  * Run with: node scripts/collectDataSanDiego.js
//  */

// import { createClient } from "@supabase/supabase-js";

// // Configuration
// const SUPABASE_URL = "https://REDACTED_SUPABASE_REF.supabase.co";
// const SUPABASE_ANON_KEY =
//   "REDACTED_SUPABASE_KEY";

// // ⚠️ REPLACE WITH YOUR MTS API KEY
// // Request from: https://www.sdmts.com/business-center/app-developers
// const MTS_API_KEY = "REDACTED_MTS_KEY";
// const MTS_API_BASE = "https://realtime.sdmts.com/api";

// // San Diego Trolley lines (route IDs)
// // 510 = Blue Line, 520 = Orange Line, 530 = Green Line, 535 = Copper Line
// const TROLLEY_LINES = ["510", "520", "530", "535"];
// const POLL_INTERVAL_MS = 90000; // 90 seconds

// // Initialize Supabase client
// const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// // Store last known positions for speed calculation
// const lastPositions = new Map();

// // Haversine distance in meters
// function haversineDistance(lat1, lon1, lat2, lon2) {
//   const R = 6371000; // Earth's radius in meters
//   const dLat = ((lat2 - lat1) * Math.PI) / 180;
//   const dLon = ((lon2 - lon1) * Math.PI) / 180;
//   const a =
//     Math.sin(dLat / 2) * Math.sin(dLat / 2) +
//     Math.cos((lat1 * Math.PI) / 180) *
//       Math.cos((lat2 * Math.PI) / 180) *
//       Math.sin(dLon / 2) *
//       Math.sin(dLon / 2);
//   const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
//   return R * c;
// }

// // Fetch vehicle positions from MTS OneBusAway API
// async function fetchVehiclePositions() {
//   try {
//     // Fetch vehicles for MTS agency
//     //`${MTS_API_BASE}/where/vehicles-for-agency/MTS.json?key=${MTS_API_KEY}`,
//     // http(s)://realtime.sdmts.com/api/api/gtfs_realtime/vehicle-positions-for-agency/MTS.pb?key=REDACTED_MTS_KEY

//     const response = await fetch(
//       `${MTS_API_BASE}/where/vehicles-for-agency/MTS.json?key=${MTS_API_KEY}`,
//       {
//         headers: {
//           Accept: "application/json",
//         },
//       },
//     );

//     if (!response.ok) {
//       throw new Error(`API error: ${response.status}`);
//     }

//     const data = await response.json();
//     const vehicles = data?.data?.list || [];

//     // Filter for Trolley lines only
//     const trolleyVehicles = vehicles
//       .filter((v) => {
//         // OneBusAway format: routeId might include agency prefix
//         const routeId = v.routeId?.replace("MTS_", "") || "";
//         return TROLLEY_LINES.includes(routeId);
//       })
//       .map((v) => {
//         const routeId = v.routeId?.replace("MTS_", "") || "";
//         return {
//           vehicle_id: v.vehicleId || "",
//           route_id: routeId,
//           direction_id: v.tripStatus?.directionId || "",
//           lat: v.location?.lat || v.latitude || 0,
//           lon: v.location?.lon || v.longitude || 0,
//           heading: v.location?.heading || null,
//           timestamp: v.lastUpdateTime || Date.now(),
//         };
//       })
//       .filter((v) => v.lat !== 0 && v.lon !== 0 && v.vehicle_id);

//     return trolleyVehicles;
//   } catch (error) {
//     console.error("Error fetching vehicle positions:", error.message);
//     return [];
//   }
// }

// // Calculate speed from previous position
// function calculateSpeed(vehicle) {
//   const key = vehicle.vehicle_id;
//   const now = vehicle.timestamp;

//   if (lastPositions.has(key)) {
//     const prev = lastPositions.get(key);
//     const timeDiff = (now - prev.timestamp) / 1000; // seconds

//     // Only calculate if time difference is reasonable (5-180 seconds)
//     if (timeDiff >= 5 && timeDiff <= 180) {
//       const distance = haversineDistance(
//         prev.lat,
//         prev.lon,
//         vehicle.lat,
//         vehicle.lon,
//       );
//       const speedMps = distance / timeDiff;
//       const speedMph = speedMps * 2.237;

//       // Cap at 80 mph to filter GPS errors
//       if (speedMph <= 80) {
//         vehicle.speed_calculated = Math.round(speedMph * 10) / 10;
//       }
//     }
//   }

//   // Update last position
//   lastPositions.set(key, {
//     lat: vehicle.lat,
//     lon: vehicle.lon,
//     timestamp: now,
//   });

//   return vehicle;
// }

// // Save positions to Supabase
// async function savePositions(positions) {
//   if (positions.length === 0) return { count: 0 };

//   const records = positions.map((v) => ({
//     vehicle_id: v.vehicle_id,
//     route_id: v.route_id,
//     direction_id: v.direction_id,
//     lat: v.lat,
//     lon: v.lon,
//     heading: v.heading,
//     speed_calculated: v.speed_calculated || null,
//     recorded_at: new Date(v.timestamp).toISOString(),
//     city: "San Diego",
//   }));

//   const { data, error } = await supabase
//     .from("vehicle_positions")
//     .insert(records);

//   if (error) {
//     console.error("Error saving positions:", error.message);
//     return { count: 0, error };
//   }

//   return { count: records.length };
// }

// // Main collection loop
// async function collectOnce() {
//   const startTime = Date.now();

//   // Fetch current positions
//   let vehicles = await fetchVehiclePositions();

//   if (vehicles.length === 0) {
//     console.log(`[${new Date().toISOString()}] No vehicles found`);
//     return;
//   }

//   // Calculate speeds
//   vehicles = vehicles.map(calculateSpeed);

//   // Count vehicles with speed data
//   const withSpeed = vehicles.filter((v) => v.speed_calculated !== undefined);

//   // Save to database
//   const { count, error } = await savePositions(vehicles);

//   const elapsed = Date.now() - startTime;
//   const timestamp = new Date().toLocaleString("en-US", {
//     timeZone: "America/Los_Angeles",
//     year: "numeric",
//     month: "2-digit",
//     day: "2-digit",
//     hour: "2-digit",
//     minute: "2-digit",
//     second: "2-digit",
//     hour12: false,
//   });

//   if (error) {
//     console.log(`[${timestamp} PT] Error: ${error.message}`);
//   } else {
//     console.log(
//       `[${timestamp} PT] Saved ${count} San Diego Trolley positions ` +
//         `(${withSpeed.length} with speed) in ${elapsed}ms`,
//     );
//   }
// }

// // Run continuously
// async function runCollector() {
//   // Check for API key
//   if (MTS_API_KEY === "YOUR_MTS_API_KEY_HERE") {
//     console.error("❌ ERROR: Please set your MTS API key in this file!");
//     console.error(
//       "   Request from: https://www.sdmts.com/business-center/app-developers",
//     );
//     console.error("   Then replace YOUR_MTS_API_KEY_HERE with your key");
//     process.exit(1);
//   }

//   console.log("🌊 San Diego Trolley Speed Map - Data Collector");
//   console.log(
//     `   Polling MTS OneBusAway API every ${POLL_INTERVAL_MS / 1000} seconds`,
//   );
//   console.log(`   Tracking routes: ${TROLLEY_LINES.join(", ")}`);
//   console.log("   Press Ctrl+C to stop\n");

//   // Initial collection
//   await collectOnce();

//   // Set up interval
//   setInterval(collectOnce, POLL_INTERVAL_MS);
// }

// // Handle shutdown gracefully
// process.on("SIGINT", () => {
//   console.log("\n\n👋 Shutting down San Diego collector...");
//   process.exit(0);
// });

// scripts/collectDataSanDiego.js

// ============================================================================

// import fetch from "node-fetch";
// import gtfsRealtimeBindings from "gtfs-realtime-bindings";

// const API_KEY = "REDACTED_MTS_KEY";
// const URL = `https://realtime.sdmts.com/api/api/gtfs_realtime/vehicle-positions-for-agency/MTS.pb?key=${API_KEY}`;

// async function run() {
//   console.log("Fetching San Diego MTS Vehicle Positions…");

//   try {
//     const res = await fetch(URL);
//     if (!res.ok) {
//       throw new Error(`HTTP ${res.status}`);
//     }

//     const buffer = await res.arrayBuffer();

//     const feed = gtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
//       new Uint8Array(buffer),
//     );

//     console.log(`✅ Success. Found ${feed.entity.length} entities`);

//     for (const entity of feed.entity) {
//       const v = entity.vehicle;
//       if (!v?.position) continue;

//       console.log({
//         vehicleId: v.vehicle?.id ?? null,
//         routeId: v.trip?.routeId ?? null,
//         lat: v.position.latitude,
//         lon: v.position.longitude,
//         timestamp: v.timestamp
//           ? new Date(v.timestamp * 1000).toISOString()
//           : null,
//       });
//     }
//   } catch (err) {
//     console.error("❌ Error:", err.message);
//   }
// }

// run();

// #!/usr/bin/env node

/**
 * San Diego MTS Trolley - GTFS-RT Collector
 *
 * Fetches GTFS-RT feed from MTS every 90 seconds and stores in Supabase.
 */

import fetch from "node-fetch";
// import * as gtfs from "gtfs-realtime-bindings";
import { createClient } from "@supabase/supabase-js";
import gtfs from "gtfs-realtime-bindings";

const { transit_realtime } = gtfs;

// Config
const API_KEY = "REDACTED_MTS_KEY";
const URL = `https://realtime.sdmts.com/api/api/gtfs_realtime/vehicle-positions-for-agency/MTS.pb?key=${API_KEY}`;
const POLL_INTERVAL_MS = 90_000;
const TARGET_ROUTE_IDS = new Set(["510", "520", "530", "535"]); // Blue, Orange, Green, Silver lines

// Supabase
const SUPABASE_URL = "https://REDACTED_SUPABASE_REF.supabase.co";
const SUPABASE_ANON_KEY =
  "REDACTED_SUPABASE_KEY";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Last positions for speed calculation
const lastPositions = new Map();

// Haversine distance
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

// Compute speed in mph
function calculateSpeed(vehicle) {
  const id = vehicle.vehicle?.id; // Fixed: removed extra .vehicle
  const now = vehicle.timestamp * 1000;

  if (!id || !vehicle.position?.latitude || !vehicle.position?.longitude)
    return null;

  const lat = vehicle.position.latitude;
  const lon = vehicle.position.longitude;

  if (!lastPositions.has(id)) {
    lastPositions.set(id, { lat, lon, timestamp: now });
    return null;
  }

  const prev = lastPositions.get(id);
  const dt = (now - prev.timestamp) / 1000;
  const dist = haversine(prev.lat, prev.lon, lat, lon);

  lastPositions.set(id, { lat, lon, timestamp: now });

  if (dt < 5 || dt > 180 || dist < 1) return null;

  const speedMps = dist / dt;
  return Math.round(speedMps * 2.237 * 10) / 10;
}

// Fetch GTFS-RT
async function fetchTrolleyData() {
  console.log(
    `[${new Date().toLocaleString("en-US", {
      timeZone: "America/Los_Angeles",
    })}] Fetching San Diego trolley data…`,
  );

  try {
    const res = await fetch(URL);
    if (!res.ok) throw new Error(`GTFS-RT HTTP error: ${res.status}`);

    const buffer = await res.arrayBuffer();
    const feed = gtfs.transit_realtime.FeedMessage.decode(
      new Uint8Array(buffer),
    );

    const trolleyVehicles = feed.entity
      .filter((e) => {
        const routeId = e.vehicle?.trip?.routeId;
        return routeId && TARGET_ROUTE_IDS.has(routeId);
      })
      .map((e) => {
        const v = e.vehicle;
        const routeId = v.trip?.routeId || null;
        const directionId = v.trip?.directionId?.toString() || null;
        const lat = v.position?.latitude || 0;
        const lon = v.position?.longitude || 0;
        const heading = v.position?.bearing || null;
        const timestamp = v.timestamp
          ? new Date(v.timestamp * 1000).toISOString()
          : new Date().toISOString();
        const speed = calculateSpeed(v);

        return {
          vehicle_id: v.vehicle?.id || null,
          route_id: routeId,
          direction_id: directionId,
          lat,
          lon,
          heading,
          speed_calculated: speed,
          recorded_at: timestamp,
          city: "San Diego",
        };
      })
      .filter((v) => v.lat && v.lon && v.vehicle_id);

    return trolleyVehicles;
  } catch (err) {
    console.error("❌ Error fetching San Diego GTFS-RT:", err.message);
    return [];
  }
}

// Save to Supabase
async function saveToDatabase(positions) {
  if (positions.length === 0) return;

  const { error } = await supabase.from("vehicle_positions").insert(positions);

  if (error) {
    console.error("❌ Error saving to Supabase:", error.message);
  } else {
    console.log(`✅ Saved ${positions.length} vehicle positions.`);
  }
}

// Main loop
async function collectOnce() {
  const positions = await fetchTrolleyData();
  await saveToDatabase(positions);
}

console.log("🌊 San Diego MTS Trolley Collector");
console.log(`   Polling every ${POLL_INTERVAL_MS / 1000}s`);
console.log(`   Routes: ${[...TARGET_ROUTE_IDS].join(", ")}`);

await collectOnce();
setInterval(collectOnce, POLL_INTERVAL_MS);
