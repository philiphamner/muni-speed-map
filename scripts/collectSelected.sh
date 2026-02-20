#!/bin/bash

# Collector script for selected cities (12 cities)
# Runs collectors for: Seattle, Boston, Philly, San Jose, Minneapolis, Denver, 
#                      Pittsburgh, Phoenix, Charlotte, Baltimore, Cleveland, San Diego
# Each runs in the background so they collect simultaneously

cd "$(dirname "$0")/.."

echo "Starting collectors for 12 selected cities..."
echo ""

# Start all collectors in background
node scripts/collectDataSeattle.js &
echo "✓ Seattle collector started (PID: $!)"

node scripts/collectDataBoston.js &
echo "✓ Boston collector started (PID: $!)"

node scripts/collectDataPhilly.js &
echo "✓ Philadelphia collector started (PID: $!)"

node scripts/collectDataVTA.js &
echo "✓ San Jose (VTA) collector started (PID: $!)"

node scripts/collectDataMinneapolis.js &
echo "✓ Minneapolis collector started (PID: $!)"

node scripts/collectDataDenver.js &
echo "✓ Denver collector started (PID: $!)"

node scripts/collectDataPittsburgh.js &
echo "✓ Pittsburgh collector started (PID: $!)"

node scripts/collectDataPhoenix.js &
echo "✓ Phoenix collector started (PID: $!)"

node scripts/collectDataCharlotte.js &
echo "✓ Charlotte collector started (PID: $!)"

node scripts/collectDataBaltimore.js &
echo "✓ Baltimore collector started (PID: $!)"

node scripts/collectDataCleveland.js &
echo "✓ Cleveland collector started (PID: $!)"

node scripts/collectDataSanDiego.js &
echo "✓ San Diego collector started (PID: $!)"

echo ""
echo "All 12 collectors are running in the background."
echo "They will poll every 90 seconds until stopped."
echo ""
echo "To stop all collectors, run: pkill -f 'collectData'"
echo "Or press Ctrl+C if running in foreground mode."

# Wait for all background jobs
wait
