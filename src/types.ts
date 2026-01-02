// Cities supported by the app
export const CITIES = ['SF', 'LA', 'Seattle', 'Boston', 'Portland', 'San Diego'] as const;
export type City = typeof CITIES[number];

// San Francisco Muni Metro lines
export const MUNI_LINES = ['F', 'J', 'K', 'L', 'M', 'N', 'T'] as const;
export type MuniLine = typeof MUNI_LINES[number];

// LA Metro Rail lines (using route codes as identifiers)
// 801 = A Line (Blue), 802 = B Line (Red), 803 = C Line (Green)
// 804 = E Line (Expo), 805 = D Line (Purple), 807 = K Line (Crenshaw)
// Note: 806 (L Line/Gold) is not in the current GTFS dataset
export const LA_METRO_LINES = ['801', '802', '803', '804', '805', '807'] as const;
export type LAMetroLine = typeof LA_METRO_LINES[number];

// LA Metro line names and colors
export const LA_METRO_LINE_INFO: Record<LAMetroLine, { name: string; letter: string; color: string }> = {
  '801': { name: 'A Line (Blue)', letter: 'A', color: '#0072BC' },
  '802': { name: 'B Line (Red)', letter: 'B', color: '#E4002B' },
  '803': { name: 'C Line (Green)', letter: 'C', color: '#58A618' },
  '804': { name: 'E Line (Expo)', letter: 'E', color: '#FDB913' },
  '805': { name: 'D Line (Purple)', letter: 'D', color: '#A05DA5' },
  '807': { name: 'K Line (Crenshaw)', letter: 'K', color: '#E96BB0' },
};

// Seattle Sound Transit Link Light Rail lines
// 100479 = 1 Line (Main), 2LINE = 2 Line (East Link), TLINE = T Line (Tacoma Link)
export const SEATTLE_LINK_LINES = ['100479', '2LINE', 'TLINE'] as const;
export type SeattleLinkLine = typeof SEATTLE_LINK_LINES[number];

// Seattle Link line names and colors
export const SEATTLE_LINK_LINE_INFO: Record<SeattleLinkLine, { name: string; letter: string; color: string }> = {
  '100479': { name: '1 Line', letter: '1', color: '#28813F' },
  '2LINE': { name: '2 Line', letter: '2', color: '#007CAD' },
  'TLINE': { name: 'T Line (Tacoma)', letter: 'T', color: '#F38B00' },
};

// Boston MBTA Green Line branches + Mattapan Trolley
export const BOSTON_GREEN_LINE_ROUTES = ['Green-B', 'Green-C', 'Green-D', 'Green-E', 'Mattapan'] as const;
export type BostonGreenLine = typeof BOSTON_GREEN_LINE_ROUTES[number];

// Boston Green Line names and colors
export const BOSTON_GREEN_LINE_INFO: Record<BostonGreenLine, { name: string; letter: string; color: string }> = {
  'Green-B': { name: 'Green Line B', letter: 'B', color: '#00843D' },
  'Green-C': { name: 'Green Line C', letter: 'C', color: '#00843D' },
  'Green-D': { name: 'Green Line D', letter: 'D', color: '#00843D' },
  'Green-E': { name: 'Green Line E', letter: 'E', color: '#00843D' },
  'Mattapan': { name: 'Mattapan Trolley', letter: 'M', color: '#DA291C' },
};

// Portland TriMet MAX Light Rail lines
// 90 = MAX Red, 100 = MAX Blue, 190 = MAX Yellow, 200 = MAX Green, 290 = MAX Orange
export const PORTLAND_MAX_LINES = ['90', '100', '190', '200', '290'] as const;
export type PortlandMaxLine = typeof PORTLAND_MAX_LINES[number];

// Portland MAX line names and colors
export const PORTLAND_MAX_LINE_INFO: Record<PortlandMaxLine, { name: string; letter: string; color: string }> = {
  '90': { name: 'MAX Red Line', letter: 'Red', color: '#C41F3E' },
  '100': { name: 'MAX Blue Line', letter: 'Blue', color: '#1359AE' },
  '190': { name: 'MAX Yellow Line', letter: 'Yellow', color: '#FFC52F' },
  '200': { name: 'MAX Green Line', letter: 'Green', color: '#008342' },
  '290': { name: 'MAX Orange Line', letter: 'Orange', color: '#D05F27' },
};

// San Diego MTS Trolley lines
// 510 = Blue Line, 520 = Orange Line, 530 = Green Line
export const SAN_DIEGO_TROLLEY_LINES = ['510', '520', '530', '535'] as const;
export type SanDiegoTrolleyLine = typeof SAN_DIEGO_TROLLEY_LINES[number];

// San Diego Trolley line names and colors
export const SAN_DIEGO_TROLLEY_LINE_INFO: Record<SanDiegoTrolleyLine, { name: string; letter: string; color: string }> = {
  '510': { name: 'Blue Line', letter: 'Blue', color: '#0000FF' },
  '520': { name: 'Orange Line', letter: 'Orange', color: '#FF6600' },
  '530': { name: 'Green Line', letter: 'Green', color: '#009900' },
  '535': { name: 'Copper Line', letter: 'Copper', color: '#B87333' },
};

// Union type for any transit line
export type TransitLine = MuniLine | LAMetroLine | SeattleLinkLine | BostonGreenLine | PortlandMaxLine | SanDiegoTrolleyLine;

// Get lines for a specific city
export function getLinesForCity(city: City): readonly string[] {
  switch (city) {
    case 'SF': return MUNI_LINES;
    case 'LA': return LA_METRO_LINES;
    case 'Seattle': return SEATTLE_LINK_LINES;
    case 'Boston': return BOSTON_GREEN_LINE_ROUTES;
    case 'Portland': return PORTLAND_MAX_LINES;
    case 'San Diego': return SAN_DIEGO_TROLLEY_LINES;
  }
}
