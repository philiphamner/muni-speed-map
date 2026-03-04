import { distanceToLineString } from "./geoUtils";

const SEPARATION_PROXIMITY_METERS = 50;

const PHILLY_STREET_RUNNING_ROUTES = ["10", "11", "13", "34", "36"];

const PORTLAND_STREETCAR_ROUTES = ["193", "194", "195"];

function isPointCoveredBySeparation(
  lat: number,
  lon: number,
  separationFeatures: any[],
): boolean {
  for (const feature of separationFeatures) {
    if (feature.geometry?.type !== "LineString") continue;
    const dist = distanceToLineString(lat, lon, feature.geometry.coordinates);
    if (dist < SEPARATION_PROXIMITY_METERS) {
      return true;
    }
  }
  return false;
}

function getUncoveredSegments(
  coordinates: number[][],
  separationFeatures: any[],
): number[][][] {
  const uncoveredSegments: number[][][] = [];
  let currentSegment: number[][] = [];

  for (const coord of coordinates) {
    const [lon, lat] = coord;
    const isCovered = isPointCoveredBySeparation(lat, lon, separationFeatures);

    if (!isCovered) {
      currentSegment.push(coord);
    } else {
      if (currentSegment.length >= 2) {
        uncoveredSegments.push(currentSegment);
      }
      currentSegment = [];
    }
  }

  if (currentSegment.length >= 2) {
    uncoveredSegments.push(currentSegment);
  }

  return uncoveredSegments;
}

export function filterSeparationByRoutes(
  separation: any,
  selectedRoutes: any,
  city?: string,
): any {
  if (!selectedRoutes?.features?.length) {
    return { type: "FeatureCollection", features: [] };
  }

  const selectedLineIds = new Set<string>();
  for (const feature of selectedRoutes.features) {
    const routeId = feature.properties?.route_id;
    if (routeId) selectedLineIds.add(routeId);
  }

  const routeCoords: number[][][] = [];
  for (const feature of selectedRoutes.features) {
    if (feature.geometry?.type === "LineString") {
      routeCoords.push(feature.geometry.coordinates);
    } else if (feature.geometry?.type === "MultiLineString") {
      routeCoords.push(...feature.geometry.coordinates);
    }
  }

  if (routeCoords.length === 0) {
    return { type: "FeatureCollection", features: [] };
  }

  const filteredFeatures: any[] = [];

  if (separation?.features) {
    for (const sepFeature of separation.features) {
      if (sepFeature.geometry?.type !== "LineString") continue;

      const featureLines = sepFeature.properties?.lines;
      const sepType = sepFeature.properties?.separationType;
      const isSfTunnel = city === "SF" && sepType === "tunnel";

      if (featureLines && Array.isArray(featureLines) && !isSfTunnel) {
        const matchesSelectedLine = featureLines.some((line: string) =>
          selectedLineIds.has(line),
        );
        if (!matchesSelectedLine) {
          continue;
        }
      }

      const sepName = sepFeature.properties?.name || "";
      const hasExplicitLines =
        featureLines && Array.isArray(featureLines) && featureLines.length > 0;

      if (isSfTunnel) {
        if (hasExplicitLines) {
          const matchesSelectedLine = featureLines.some((line: string) =>
            selectedLineIds.has(line),
          );
          const isMarketStSubway =
            featureLines.includes("J") && featureLines.includes("N");
          const hasKLM = ["K", "L", "M"].some((line) =>
            selectedLineIds.has(line),
          );
          if (!matchesSelectedLine && !(isMarketStSubway && hasKLM)) {
            continue;
          }
        }

        const isCentralSubway = sepName.includes("Central Subway");
        const isSunsetTunnel = sepName.includes("Sunset Tunnel");
        const isTwinPeaksTunnel = sepName.includes("Twin Peaks");
        const isJTunnel = sepName === "Muni J";
        const isMarketStreetTunnel =
          !isCentralSubway &&
          !isSunsetTunnel &&
          !isTwinPeaksTunnel &&
          !isJTunnel;

        const hasJKLMN = ["J", "K", "L", "M", "N"].some((line) =>
          selectedLineIds.has(line),
        );
        const hasT = selectedLineIds.has("T");
        const hasF = selectedLineIds.has("F");
        const hasL = selectedLineIds.has("L");

        if (hasF && !hasT && !hasJKLMN) {
          continue;
        }

        if (hasT && !hasJKLMN) {
          if (!isCentralSubway) {
            continue;
          }
        }

        if (hasF && hasT && !hasJKLMN) {
          if (!isCentralSubway) {
            continue;
          }
        }

        if (isMarketStreetTunnel && !hasJKLMN) {
          continue;
        }

        if (hasL && !hasExplicitLines) {
          const sepCoords = sepFeature.geometry.coordinates;
          const allPointsWestOfWestPortal = sepCoords.every(
            ([lon]: number[]) => lon < -122.46,
          );
          if (allPointsWestOfWestPortal) {
            continue;
          }
        }
      }

      const sepCoords = sepFeature.geometry.coordinates;

      let isNear = false;
      for (const [lon, lat] of sepCoords) {
        for (const coords of routeCoords) {
          const dist = distanceToLineString(lat, lon, coords);
          if (dist < SEPARATION_PROXIMITY_METERS) {
            isNear = true;
            break;
          }
        }
        if (isNear) break;
      }
      if (isNear) {
        filteredFeatures.push(sepFeature);
      } else if (sepFeature.properties?.isManualOverride) {
        // Manual overrides that are not near any selected route are skipped
      }
    }
  }

  if (city === "Philadelphia") {
    const streetRunningFeatures: any[] = [];

    for (const feature of selectedRoutes.features) {
      const routeId = feature.properties?.route_id;
      if (!PHILLY_STREET_RUNNING_ROUTES.includes(routeId)) continue;

      let lineStrings: number[][][] = [];
      if (feature.geometry?.type === "LineString") {
        lineStrings = [feature.geometry.coordinates];
      } else if (feature.geometry?.type === "MultiLineString") {
        lineStrings = feature.geometry.coordinates;
      }

      for (let i = 0; i < lineStrings.length; i++) {
        const uncoveredSegments = getUncoveredSegments(
          lineStrings[i],
          filteredFeatures,
        );

        for (let j = 0; j < uncoveredSegments.length; j++) {
          streetRunningFeatures.push({
            type: "Feature",
            properties: {
              id: `philly-sr-${routeId}-${i}-${j}-${Math.random().toString(36).substr(2, 9)}`,
              separationType: "street_running",
              name: feature.properties?.route_name || `Route ${routeId}`,
              isStreetRunningFallback: true,
            },
            geometry: {
              type: "LineString",
              coordinates: uncoveredSegments[j],
            },
          });
        }
      }
    }

    return {
      type: "FeatureCollection",
      features: [...streetRunningFeatures, ...filteredFeatures],
    };
  }

  if (city === "Portland") {
    const streetRunningFeatures: any[] = [];

    for (const feature of selectedRoutes.features) {
      const routeId = feature.properties?.route_id;
      if (!PORTLAND_STREETCAR_ROUTES.includes(routeId)) continue;

      let lineStrings: number[][][] = [];
      if (feature.geometry?.type === "LineString") {
        lineStrings = [feature.geometry.coordinates];
      } else if (feature.geometry?.type === "MultiLineString") {
        lineStrings = feature.geometry.coordinates;
      }

      for (let i = 0; i < lineStrings.length; i++) {
        const uncoveredSegments = getUncoveredSegments(
          lineStrings[i],
          filteredFeatures,
        );

        for (let j = 0; j < uncoveredSegments.length; j++) {
          streetRunningFeatures.push({
            type: "Feature",
            properties: {
              id: `portland-sr-${routeId}-${i}-${j}-${Math.random().toString(36).substr(2, 9)}`,
              separationType: "street_running",
              name: feature.properties?.route_name || `Route ${routeId}`,
              isStreetRunningFallback: true,
            },
            geometry: {
              type: "LineString",
              coordinates: uncoveredSegments[j],
            },
          });
        }
      }
    }

    return {
      type: "FeatureCollection",
      features: [...streetRunningFeatures, ...filteredFeatures],
    };
  }

  return { type: "FeatureCollection", features: filteredFeatures };
}
