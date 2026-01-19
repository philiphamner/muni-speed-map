#!/usr/bin/env node
/**
 * Calgary CTrain - Data Collector
 * 
 * Polls Calgary Transit GTFS-RT API every 90 seconds and saves vehicle positions to Supabase.
 * Speed is calculated from consecutive GPS readings.
 * 
 * Calgary has two CTrain lines:
 * - 201: Red Line (Somerset-Bridlewood to Tuscany)
 * - 202: Blue Line (Saddletowne to 69 Street)
 * 
 * GTFS-RT Feeds:
 * - Vehicle Positions: https://data.calgary.ca/download/am7c-qe3u/application%2Foctet-stream
 * - Trip Updates: https://data.calgary.ca/download/gs4m-mdc2/application%2Foctet-stream
 * 
 * Strategy: Since Vehicle Positions feed doesn't include route_id, we first fetch the
 * Trip Updates feed to build a trip_id -> route_id mapping, then filter vehicle positions
 * to only include CTrain vehicles (routes 201 and 202).
 * 
 * Run with: node scripts/collectDataCalgary.js
 */

import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import fetch, { Headers, Request, Response } from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

// Polyfill for Node.js 16 (required by newer Supabase client)
if (!globalThis.fetch) {
  globalThis.fetch = fetch;
  globalThis.Headers = Headers;
  globalThis.Request = Request;
  globalThis.Response = Response;
}

// Configuration
const SUPABASE_URL = 'https://REDACTED_SUPABASE_REF.supabase.co';
const SUPABASE_ANON_KEY = 'REDACTED_SUPABASE_KEY';

// Calgary GTFS-RT feeds (protobuf format)
const VEHICLE_POSITIONS_URL = 'https://data.calgary.ca/download/am7c-qe3u/application%2Foctet-stream';
const TRIP_UPDATES_URL = 'https://data.calgary.ca/download/gs4m-mdc2/application%2Foctet-stream';

// CTrain route ID prefixes (from static GTFS)
// Routes are formatted as "201-xxxxx" or "202-xxxxx"
const CTRAIN_ROUTE_PREFIXES = ['201', '202'];

const POLL_INTERVAL_MS = 90000; // 90 seconds

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Store previous positions for speed calculation
const previousPositions = new Map();

// Haversine distance between two points in meters
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Calculate speed from previous position
function calculateSpeed(vehicleId, lat, lon, timestamp) {
  const prev = previousPositions.get(vehicleId);
  
  // Store current position for next calculation
  previousPositions.set(vehicleId, { lat, lon, timestamp });
  
  if (!prev) {
    return null; // No previous position to compare
  }
  
  const timeDiffSeconds = (timestamp - prev.timestamp) / 1000;
  
  // Only calculate speed if time gap is reasonable (30-300 seconds)
  if (timeDiffSeconds < 30 || timeDiffSeconds > 300) {
    return null;
  }
  
  const distanceMeters = haversineDistance(prev.lat, prev.lon, lat, lon);
  
  // If distance is very small, vehicle is stationary
  if (distanceMeters < 5) {
    return 0;
  }
  
  // Convert to mph
  const speedMps = distanceMeters / timeDiffSeconds;
  const speedMph = speedMps * 2.237;
  
  // Sanity check: CTrain shouldn't exceed 80 km/h (50 mph) generally
  if (speedMph > 60) {
    return null; // Likely GPS glitch
  }
  
  return Math.round(speedMph * 10) / 10;
}

// Fetch trip-to-route mapping from Trip Updates feed
async function fetchTripToRouteMapping() {
  try {
    const response = await fetch(TRIP_UPDATES_URL);
    
    if (!response.ok) {
      throw new Error(`Trip Updates API error: ${response.status}`);
    }
    
    const buffer = await response.arrayBuffer();
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buffer));
    
    const tripToRoute = new Map();
    
    for (const entity of feed.entity || []) {
      const tripId = entity.tripUpdate?.trip?.tripId;
      const routeId = entity.tripUpdate?.trip?.routeId;
      
      if (tripId && routeId) {
        // Extract the route prefix (201 or 202) from route IDs like "201-20758"
        const routePrefix = routeId.split('-')[0];
        if (CTRAIN_ROUTE_PREFIXES.includes(routePrefix)) {
          tripToRoute.set(tripId, routePrefix);
        }
      }
    }
    
    return tripToRoute;
  } catch (error) {
    console.error('Error fetching trip updates:', error.message);
    return new Map();
  }
}

// Fetch vehicle positions from GTFS-RT protobuf feed
async function fetchVehiclePositions() {
  try {
    // First, get trip-to-route mapping from Trip Updates feed
    const tripToRoute = await fetchTripToRouteMapping();
    
    if (tripToRoute.size === 0) {
      console.warn('No CTrain trip mappings found in Trip Updates feed');
      return [];
    }
    
    // Now fetch vehicle positions
    const response = await fetch(VEHICLE_POSITIONS_URL);
    
    if (!response.ok) {
      throw new Error(`Vehicle Positions API error: ${response.status}`);
    }
    
    const buffer = await response.arrayBuffer();
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buffer));
    
    // Filter for CTrain vehicles using trip-to-route mapping
    const ctrainVehicles = (feed.entity || [])
      .map(entity => {
        if (!entity.vehicle) return null;
        
        const v = entity.vehicle;
        const tripId = v.trip?.tripId;
        
        // Check if this trip is a CTrain trip
        const routeId = tripToRoute.get(tripId);
        if (!routeId) {
          return null; // Not a CTrain vehicle
        }
        
        const vehicleId = v.vehicle?.id || entity.id;
        const lat = v.position?.latitude;
        const lon = v.position?.longitude;
        
        // Filter out invalid coordinates
        if (!lat || !lon || lat === 0 || lon === 0) {
          return null;
        }
        
        const timestamp = (v.timestamp?.low || v.timestamp) * 1000 || Date.now();
        
        // Check if feed provides speed directly (in m/s)
        let reportedSpeed = null;
        if (v.position?.speed && v.position.speed > 0) {
          // Convert m/s to mph
          reportedSpeed = Math.round(v.position.speed * 2.237 * 10) / 10;
        }
        
        // Calculate speed from consecutive GPS readings
        const calculatedSpeed = calculateSpeed(vehicleId, lat, lon, timestamp);
        
        // Use reported speed if available, otherwise use calculated speed
        const speed = reportedSpeed !== null ? reportedSpeed : calculatedSpeed;
        
        return {
          vehicle_id: vehicleId,
          route_id: routeId,  // 201 or 202
          direction_id: String(v.trip?.directionId || ''),
          lat: lat,
          lon: lon,
          heading: v.position?.bearing || null,
          speed_calculated: speed,
          recorded_at: new Date(timestamp).toISOString(),
          city: 'Calgary',
          headsign: v.vehicle?.label || null,
        };
      })
      .filter(v => v !== null && v.lat && v.lon && v.vehicle_id);
    
    return ctrainVehicles;
  } catch (error) {
    console.error('Error fetching vehicle positions:', error.message);
    return [];
  }
}

// Save positions to Supabase
async function savePositions(positions) {
  if (positions.length === 0) return { count: 0 };
  
  const { data, error } = await supabase
    .from('vehicle_positions')
    .insert(positions);
  
  if (error) {
    console.error('Error saving positions:', error.message);
    return { count: 0, error };
  }
  
  return { count: positions.length };
}

// Main collection loop
async function collectOnce() {
  const startTime = Date.now();
  
  // Fetch current positions
  const vehicles = await fetchVehiclePositions();
  
  if (vehicles.length === 0) {
    console.log(`[${new Date().toISOString()}] No CTrain vehicles found`);
    return;
  }
  
  // Count by route
  const redLine = vehicles.filter(v => v.route_id === '201').length;
  const blueLine = vehicles.filter(v => v.route_id === '202').length;
  
  // Count vehicles with speed data
  const withSpeed = vehicles.filter(v => v.speed_calculated !== null);
  
  // Save to database
  const { count, error } = await savePositions(vehicles);
  
  const elapsed = Date.now() - startTime;
  const timestamp = new Date().toLocaleString('en-US', { 
    timeZone: 'America/Denver',  // Calgary is MST
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  if (error) {
    console.log(`[${timestamp} MT] Error: ${error.message}`);
  } else {
    console.log(
      `[${timestamp} MT] Saved ${count} Calgary CTrain positions ` +
      `(Red: ${redLine}, Blue: ${blueLine}, ${withSpeed.length} with speed) in ${elapsed}ms`
    );
  }
}

// Run continuously
async function runCollector() {
  console.log('🚃 Calgary CTrain - Data Collector');
  console.log(`   Polling GTFS-RT API every ${POLL_INTERVAL_MS / 1000} seconds`);
  console.log(`   Using Trip Updates feed to filter CTrain vehicles`);
  console.log(`   Tracking routes: ${CTRAIN_ROUTE_PREFIXES.join(', ')} (Red Line, Blue Line)`);
  console.log('   Press Ctrl+C to stop\n');
  
  // Initial collection
  await collectOnce();
  
  // Set up interval
  setInterval(collectOnce, POLL_INTERVAL_MS);
}

// Handle shutdown gracefully
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down Calgary collector...');
  process.exit(0);
});

// Start the collector
runCollector();
