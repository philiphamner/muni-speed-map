// Cities supported by the app
export const CITIES = [
  "SF",
  "LA",
  "Seattle",
  "Boston",
  "Portland",
  "San Diego",
  "Toronto",
  "Philadelphia",
  "Sacramento",
] as const;
export type City = (typeof CITIES)[number];

// San Francisco Muni Metro lines
export const MUNI_LINES = ["F", "J", "K", "L", "M", "N", "T"] as const;
export type MuniLine = (typeof MUNI_LINES)[number];

// LA Metro Rail lines (using route codes as identifiers)
// 801 = A Line (Blue), 802 = B Line (Red), 803 = C Line (Green)
// 804 = E Line (Expo), 805 = D Line (Purple), 807 = K Line (Crenshaw)
// Note: 806 (L Line/Gold) is not in the current GTFS dataset
export const LA_METRO_LINES = [
  "801",
  "802",
  "803",
  "804",
  "805",
  "807",
] as const;
export type LAMetroLine = (typeof LA_METRO_LINES)[number];

// LA Metro line names and colors
export const LA_METRO_LINE_INFO: Record<
  LAMetroLine,
  { name: string; letter: string; color: string }
> = {
  "801": { name: "A Line (Blue)", letter: "A", color: "#0072BC" },
  "802": { name: "B Line (Red)", letter: "B", color: "#EB131B" },
  "803": { name: "C Line (Green)", letter: "C", color: "#58A738" },
  "804": { name: "E Line (Expo)", letter: "E", color: "#FDB913" },
  "805": { name: "D Line (Purple)", letter: "D", color: "#A05DA5" },
  "807": { name: "K Line (Crenshaw)", letter: "K", color: "#E56DB1" },
};

// Seattle Sound Transit Link Light Rail lines
// 100479 = 1 Line (Main), 2LINE = 2 Line (East Link), TLINE = T Line (Tacoma Link)
export const SEATTLE_LINK_LINES = ["100479", "2LINE", "TLINE"] as const;
export type SeattleLinkLine = (typeof SEATTLE_LINK_LINES)[number];

// Seattle Link line names and colors
export const SEATTLE_LINK_LINE_INFO: Record<
  SeattleLinkLine,
  { name: string; letter: string; color: string }
> = {
  "100479": { name: "1 Line", letter: "1", color: "#28813F" },
  "2LINE": { name: "2 Line", letter: "2", color: "#007CAD" },
  TLINE: { name: "T Line (Tacoma)", letter: "T", color: "#F38B00" },
};

// Boston MBTA Green Line branches
export const BOSTON_GREEN_LINE_ROUTES = [
  "Green-B",
  "Green-C",
  "Green-D",
  "Green-E",
] as const;
export type BostonGreenLine = (typeof BOSTON_GREEN_LINE_ROUTES)[number];

// Boston Green Line names and colors
export const BOSTON_GREEN_LINE_INFO: Record<
  BostonGreenLine,
  { name: string; letter: string; color: string }
> = {
  "Green-B": { name: "Green Line B", letter: "B", color: "#00843D" },
  "Green-C": { name: "Green Line C", letter: "C", color: "#00843D" },
  "Green-D": { name: "Green Line D", letter: "D", color: "#00843D" },
  "Green-E": { name: "Green Line E", letter: "E", color: "#00843D" },
};

// Portland TriMet MAX Light Rail lines
// 90 = MAX Red, 100 = MAX Blue, 190 = MAX Yellow, 200 = MAX Green, 290 = MAX Orange
export const PORTLAND_MAX_LINES = ["90", "100", "190", "200", "290"] as const;
export type PortlandMaxLine = (typeof PORTLAND_MAX_LINES)[number];

// Portland MAX line names and colors
export const PORTLAND_MAX_LINE_INFO: Record<
  PortlandMaxLine,
  { name: string; letter: string; color: string }
> = {
  "90": { name: "MAX Red Line", letter: "Red", color: "#C41F3E" },
  "100": { name: "MAX Blue Line", letter: "Blue", color: "#1359AE" },
  "190": { name: "MAX Yellow Line", letter: "Yellow", color: "#FFC52F" },
  "200": { name: "MAX Green Line", letter: "Green", color: "#008342" },
  "290": { name: "MAX Orange Line", letter: "Orange", color: "#D05F27" },
};

// Portland Streetcar lines
// 193 = NS Line, 194 = A Loop, 195 = B Loop
export const PORTLAND_STREETCAR_LINES = ["193", "194", "195"] as const;
export type PortlandStreetcarLine = (typeof PORTLAND_STREETCAR_LINES)[number];

// Portland Streetcar line names and colors (official GTFS colors)
export const PORTLAND_STREETCAR_LINE_INFO: Record<
  PortlandStreetcarLine,
  { name: string; letter: string; color: string }
> = {
  "193": { name: "NS Line", letter: "NS", color: "#72A130" },
  "194": { name: "A Loop", letter: "A", color: "#D91965" },
  "195": { name: "B Loop", letter: "B", color: "#4650BE" },
};

// Combined Portland rail lines (MAX + Streetcar)
export const PORTLAND_RAIL_LINES = [...PORTLAND_MAX_LINES, ...PORTLAND_STREETCAR_LINES] as const;
export type PortlandRailLine = PortlandMaxLine | PortlandStreetcarLine;

// San Diego MTS Trolley lines
// 510 = Blue Line, 520 = Orange Line, 530 = Green Line
export const SAN_DIEGO_TROLLEY_LINES = ["510", "520", "530", "535"] as const;
export type SanDiegoTrolleyLine = (typeof SAN_DIEGO_TROLLEY_LINES)[number];

// San Diego Trolley line names and colors
export const SAN_DIEGO_TROLLEY_LINE_INFO: Record<
  SanDiegoTrolleyLine,
  { name: string; letter: string; color: string }
> = {
  "510": { name: "Blue Line", letter: "Blue", color: "#0000FF" },
  "520": { name: "Orange Line", letter: "Orange", color: "#FF6600" },
  "530": { name: "Green Line", letter: "Green", color: "#009900" },
  "535": { name: "Copper Line", letter: "Copper", color: "#B87333" },
};

// Toronto TTC Streetcar lines
// Main streetcar routes that run frequently
export const TORONTO_STREETCAR_LINES = [
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
] as const;
export type TorontoStreetcarLine = (typeof TORONTO_STREETCAR_LINES)[number];

// Toronto Streetcar line names and colors
export const TORONTO_STREETCAR_LINE_INFO: Record<
  TorontoStreetcarLine,
  { name: string; letter: string; color: string }
> = {
  "501": { name: "501 Queen", letter: "501", color: "#ED1C24" },
  "503": { name: "503 Kingston Rd", letter: "503", color: "#ED1C24" },
  "504": { name: "504 King", letter: "504", color: "#ED1C24" },
  "505": { name: "505 Dundas", letter: "505", color: "#ED1C24" },
  "506": { name: "506 Carlton", letter: "506", color: "#ED1C24" },
  "507": { name: "507 Long Branch", letter: "507", color: "#ED1C24" },
  "508": { name: "508 Lake Shore", letter: "508", color: "#ED1C24" },
  "509": { name: "509 Harbourfront", letter: "509", color: "#ED1C24" },
  "510": { name: "510 Spadina", letter: "510", color: "#ED1C24" },
  "511": { name: "511 Bathurst", letter: "511", color: "#ED1C24" },
  "512": { name: "512 St Clair", letter: "512", color: "#ED1C24" },
};

// Philadelphia SEPTA Trolley lines
// T1-T5 = Subway-Surface Trolleys, D1-D2 = Media/Sharon Hill, G1 = Girard Ave
export const PHILLY_TROLLEY_LINES = [
  "10",
  "11",
  "13",
  "15",
  "34",
  "36",
  "101",
  "102",
] as const;
export type PhillyTrolleyLine = (typeof PHILLY_TROLLEY_LINES)[number];

// Philadelphia Trolley line names and colors
export const PHILLY_TROLLEY_LINE_INFO: Record<
  PhillyTrolleyLine,
  { name: string; letter: string; color: string }
> = {
  "10": { name: "Route 10", letter: "10", color: "#5A960A" },
  "11": { name: "Route 11", letter: "11", color: "#5A960A" },
  "13": { name: "Route 13", letter: "13", color: "#5A960A" },
  "15": { name: "Route 15 (Girard)", letter: "15", color: "#FFD700" },
  "34": { name: "Route 34", letter: "34", color: "#5A960A" },
  "36": { name: "Route 36", letter: "36", color: "#5A960A" },
  "101": { name: "Route 101 (Media)", letter: "101", color: "#DC2E6B" },
  "102": { name: "Route 102 (Sharon Hill)", letter: "102", color: "#DC2E6B" },
};

// Sacramento SacRT Light Rail lines
// 507 = Gold Line, 533 = Blue Line
export const SACRAMENTO_LIGHT_RAIL_LINES = ["Gold", "Blue"] as const;
export type SacramentoLightRailLine =
  (typeof SACRAMENTO_LIGHT_RAIL_LINES)[number];

// Sacramento Light Rail line names and colors
export const SACRAMENTO_LIGHT_RAIL_LINE_INFO: Record<
  SacramentoLightRailLine,
  { name: string; letter: string; color: string }
> = {
  Gold: { name: "Gold Line", letter: "Gold", color: "#EED211" },
  Blue: { name: "Blue Line", letter: "Blue", color: "#0000FF" },
};

// Union type for any transit line
export type TransitLine =
  | MuniLine
  | LAMetroLine
  | SeattleLinkLine
  | BostonGreenLine
  | PortlandMaxLine
  | SanDiegoTrolleyLine
  | TorontoStreetcarLine
  | PhillyTrolleyLine
  | SacramentoLightRailLine;

// Get lines for a specific city
export function getLinesForCity(city: City): readonly string[] {
  switch (city) {
    case "SF":
      return MUNI_LINES;
    case "LA":
      return LA_METRO_LINES;
    case "Seattle":
      return SEATTLE_LINK_LINES;
    case "Boston":
      return BOSTON_GREEN_LINE_ROUTES;
    case "Portland":
      return PORTLAND_RAIL_LINES;
    case "San Diego":
      return SAN_DIEGO_TROLLEY_LINES;
    case "Toronto":
      return TORONTO_STREETCAR_LINES;
    case "Philadelphia":
      return PHILLY_TROLLEY_LINES;
    case "Sacramento":
      return SACRAMENTO_LIGHT_RAIL_LINES;
  }
}
