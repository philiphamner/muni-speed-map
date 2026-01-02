#!/usr/bin/env node
/**
 * Portland MAX Speed Map - Data Collector
 * 
 * Polls TriMet Vehicles API every 90 seconds and saves vehicle positions to Supabase.
 * TriMet provides speed directly in the API response.
 * 
 * Run with: node scripts/collectDataPortland.js
 */

import { createClient } from '@supabase/supabase-js';

// Configuration
const SUPABASE_URL = 'https://REDACTED_SUPABASE_REF.supabase.co';
const SUPABASE_ANON_KEY = 'REDACTED_SUPABASE_KEY';

// ⚠️ REPLACE WITH YOUR TRIMET API KEY (AppID)
// Register at: https://developer.trimet.org/
const TRIMET_APP_ID = 'YOUR_TRIMET_APP_ID_HERE';

// MAX Light Rail lines (route IDs)
// 90 = MAX Red, 100 = MAX Blue, 190 = MAX Yellow, 200 = MAX Green, 290 = MAX Orange
const MAX_LINES = ['90', '100', '190', '200', '290'];
const POLL_INTERVAL_MS = 90000; // 90 seconds

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Fetch vehicle positions from TriMet Vehicles API
async function fetchVehiclePositions() {
  try {
    // TriMet Vehicles API returns all vehicles
    const response = await fetch(
      `https://developer.trimet.org/ws/v2/vehicles?appID=${TRIMET_APP_ID}`,
      {
        headers: {
          'Accept': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    const vehicles = data?.resultSet?.vehicle || [];
    
    // Filter for MAX lines only
    const maxVehicles = vehicles
      .filter(v => MAX_LINES.includes(String(v.routeNumber)))
      .map(v => {
        return {
          vehicle_id: String(v.vehicleID),
          route_id: String(v.routeNumber),
          direction_id: String(v.direction || ''),
          lat: parseFloat(v.latitude),
          lon: parseFloat(v.longitude),
          heading: v.bearing ? parseFloat(v.bearing) : null,
          // TriMet provides speed in meters per second, convert to mph
          speed_calculated: v.speed ? Math.round(v.speed * 2.237 * 10) / 10 : null,
          recorded_at: v.time ? new Date(v.time).toISOString() : new Date().toISOString(),
          city: 'Portland',
        };
      })
      .filter(v => v.lat !== 0 && v.lon !== 0 && v.vehicle_id);
    
    return maxVehicles;
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
    console.log(`[${new Date().toISOString()}] No vehicles found`);
    return;
  }
  
  // Count vehicles with speed data
  const withSpeed = vehicles.filter(v => v.speed_calculated !== null);
  
  // Save to database
  const { count, error } = await savePositions(vehicles);
  
  const elapsed = Date.now() - startTime;
  const timestamp = new Date().toLocaleString('en-US', { 
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  if (error) {
    console.log(`[${timestamp} PT] Error: ${error.message}`);
  } else {
    console.log(
      `[${timestamp} PT] Saved ${count} Portland MAX positions ` +
      `(${withSpeed.length} with speed) in ${elapsed}ms`
    );
  }
}

// Run continuously
async function runCollector() {
  // Check for API key
  if (TRIMET_APP_ID === 'YOUR_TRIMET_APP_ID_HERE') {
    console.error('❌ ERROR: Please set your TriMet AppID in this file!');
    console.error('   Register for free at: https://developer.trimet.org/');
    console.error('   Then replace YOUR_TRIMET_APP_ID_HERE with your AppID');
    process.exit(1);
  }
  
  console.log('🌲 Portland MAX Speed Map - Data Collector');
  console.log(`   Polling TriMet API every ${POLL_INTERVAL_MS / 1000} seconds`);
  console.log(`   Tracking routes: ${MAX_LINES.join(', ')}`);
  console.log('   Press Ctrl+C to stop\n');
  
  // Initial collection
  await collectOnce();
  
  // Set up interval
  setInterval(collectOnce, POLL_INTERVAL_MS);
}

// Handle shutdown gracefully
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down Portland collector...');
  process.exit(0);
});

// Start the collector
runCollector();

