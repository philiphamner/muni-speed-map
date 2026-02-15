# San Diego Transit Data Fix Summary

## Problem Identified

San Diego trolley data wasn't appearing on the map despite existing in the database.

## Root Cause Analysis

1. ✅ **Data Collection**: San Diego data exists in database (515+ records)
2. ✅ **Database Queries**: Fixed query logic to handle San Diego like SF
3. ✅ **Route Filtering**: San Diego trolley lines (510, 520, 530, 535) properly configured
4. ❌ **Speed Data**: All San Diego vehicles have `speed: null` because MTS doesn't provide speed in GTFS-RT
5. ❌ **Frontend Filtering**: Frontend was filtering out ALL vehicles with null speed

## Issues Fixed

### 1. Database Query Logic (✅ FIXED)

**Problem**: San Diego used `.eq("city", "San Diego")` while SF used `.or("city.is.null,city.eq.SF")`

**Solution**: Updated SpeedMap.tsx to handle San Diego like SF:

```javascript
// Before
.eq("city", city)

// After (for San Diego)
.or("city.is.null,city.eq.San Diego")
```

### 2. Frontend Speed Filtering (✅ FIXED)

**Problem**: Frontend filtered out vehicles with `speed: null`

**Solution**: Updated SpeedMap.tsx to allow null speeds for San Diego:

```javascript
// Before
["!=", ["get", "speed"], null];

// After (for San Diego)
if (city === "San Diego") {
  filters.push([
    "any",
    ["==", ["get", "speed"], null], // Allow null speed
    [">=", ["get", "speed"], speedFilter.minSpeed], // Or speed >= min
  ]);
}
```

## Files Modified

- `src/components/SpeedMap.tsx`: Updated database queries and speed filtering
- `scripts/collectAll.sh`: Added San Diego to the complete collector script

## Testing Results

- ✅ Database contains 515+ San Diego trolley records
- ✅ All 4 trolley lines (Blue, Orange, Green, Copper) have data
- ✅ Geographic coordinates are correct (San Diego area)
- ✅ Frontend filtering now allows null speed vehicles for San Diego
- ✅ Vehicles with null speed will appear as grey dots (#666666)

## How to Test

1. **Start the frontend**: `npm run dev`
2. **Select San Diego**: Click the "🌊 SD" button
3. **Check line selection**: Ensure all trolley lines are selected (510, 520, 530, 535)
4. **Expected result**: Grey dots should appear on the San Diego map representing trolley vehicles

## Getting Speed Data

To get actual speed data (colored dots instead of grey):

1. **Start collector**: `npm run collect:sandiego`
2. **Wait for multiple cycles**: Speed calculation requires consecutive position readings
3. **Monitor progress**: Check collector logs for "with speed" counts

## Why This Happens with New Cities

This is a common issue when adding new cities because:

1. **Speed data dependency**: Most transit agencies don't provide speed in GTFS-RT
2. **Consecutive readings required**: Speed calculation needs multiple position updates
3. **Frontend assumptions**: Frontend assumes all vehicles have speed data
4. **Database schema evolution**: City field was added later, creating legacy data issues

## Prevention for Future Cities

1. **Check GTFS-RT feed**: Test if agency provides speed data
2. **Update frontend filtering**: Add city-specific handling for null speeds if needed
3. **Database queries**: Use `.or("city.is.null,city.eq.CityName")` pattern
4. **Test with null speeds**: Verify frontend shows vehicles even without speed data
