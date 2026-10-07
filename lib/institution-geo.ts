// Approximate geocoding for event visualization, not authoritative location data.
// Maps free-text institution affiliations to display locations using a curated
// resolver. No external API calls — all lookups are local.

export interface GeoLocation {
  city: string;
  region?: string;
  country: string;
  continent: string;
  lat: number;
  lng: number;
  confidence: "high" | "medium" | "low";
}

export interface EventHub {
  city: string;
  region?: string;
  country: string;
  lat: number;
  lng: number;
}

export function getEventHostLocation(): EventHub {
  return {
    city: process.env.VIBE_HACKATHON_EVENT_HOST_CITY ?? "Chicago",
    region: process.env.VIBE_HACKATHON_EVENT_HOST_REGION ?? "IL",
    country: process.env.VIBE_HACKATHON_EVENT_HOST_COUNTRY ?? "USA",
    lat: parseFloat(process.env.VIBE_HACKATHON_EVENT_HOST_LAT ?? "41.8781"),
    lng: parseFloat(process.env.VIBE_HACKATHON_EVENT_HOST_LNG ?? "-87.6298"),
  };
}

// ── Known institutions (normalized lowercase key → location) ─────────────────

type Loc = Omit<GeoLocation, "confidence">;

const KNOWN: Record<string, Loc> = {
  // New York
  "weill cornell": { city: "New York", region: "NY", country: "USA", continent: "North America", lat: 40.7648, lng: -73.9548 },
  "weill cornell medicine": { city: "New York", region: "NY", country: "USA", continent: "North America", lat: 40.7648, lng: -73.9548 },
  "weill cornell medical college": { city: "New York", region: "NY", country: "USA", continent: "North America", lat: 40.7648, lng: -73.9548 },
  "nyu langone": { city: "New York", region: "NY", country: "USA", continent: "North America", lat: 40.7421, lng: -73.9745 },
  "nyu grossman": { city: "New York", region: "NY", country: "USA", continent: "North America", lat: 40.7295, lng: -73.9965 },
  "columbia university irving": { city: "New York", region: "NY", country: "USA", continent: "North America", lat: 40.8075, lng: -73.9626 },
  "columbia university": { city: "New York", region: "NY", country: "USA", continent: "North America", lat: 40.8075, lng: -73.9626 },
  "mount sinai": { city: "New York", region: "NY", country: "USA", continent: "North America", lat: 40.7899, lng: -73.9529 },
  "memorial sloan kettering": { city: "New York", region: "NY", country: "USA", continent: "North America", lat: 40.7630, lng: -73.9557 },
  "memorial sloan-kettering": { city: "New York", region: "NY", country: "USA", continent: "North America", lat: 40.7630, lng: -73.9557 },
  "new york presbyterian": { city: "New York", region: "NY", country: "USA", continent: "North America", lat: 40.8395, lng: -73.9418 },
  "new york university": { city: "New York", region: "NY", country: "USA", continent: "North America", lat: 40.7295, lng: -73.9965 },
  // Boston
  "harvard medical school": { city: "Boston", region: "MA", country: "USA", continent: "North America", lat: 42.3362, lng: -71.1048 },
  "harvard university": { city: "Cambridge", region: "MA", country: "USA", continent: "North America", lat: 42.3770, lng: -71.1167 },
  "massachusetts general hospital": { city: "Boston", region: "MA", country: "USA", continent: "North America", lat: 42.3636, lng: -71.0686 },
  "brigham and women": { city: "Boston", region: "MA", country: "USA", continent: "North America", lat: 42.3356, lng: -71.1074 },
  "brigham and women's": { city: "Boston", region: "MA", country: "USA", continent: "North America", lat: 42.3356, lng: -71.1074 },
  "boston children's": { city: "Boston", region: "MA", country: "USA", continent: "North America", lat: 42.3380, lng: -71.1074 },
  "dana-farber cancer": { city: "Boston", region: "MA", country: "USA", continent: "North America", lat: 42.3371, lng: -71.1058 },
  "beth israel deaconess": { city: "Boston", region: "MA", country: "USA", continent: "North America", lat: 42.3373, lng: -71.1084 },
  "tufts medical": { city: "Boston", region: "MA", country: "USA", continent: "North America", lat: 42.3491, lng: -71.0635 },
  "boston university": { city: "Boston", region: "MA", country: "USA", continent: "North America", lat: 42.3505, lng: -71.1054 },
  "boston university school of medicine": { city: "Boston", region: "MA", country: "USA", continent: "North America", lat: 42.3354, lng: -71.0728 },
  "mit": { city: "Cambridge", region: "MA", country: "USA", continent: "North America", lat: 42.3601, lng: -71.0942 },
  "massachusetts institute of technology": { city: "Cambridge", region: "MA", country: "USA", continent: "North America", lat: 42.3601, lng: -71.0942 },
  // Chicago
  "northwestern university": { city: "Chicago", region: "IL", country: "USA", continent: "North America", lat: 41.8978, lng: -87.6233 },
  "northwestern memorial": { city: "Chicago", region: "IL", country: "USA", continent: "North America", lat: 41.8978, lng: -87.6233 },
  "university of chicago": { city: "Chicago", region: "IL", country: "USA", continent: "North America", lat: 41.7886, lng: -87.5987 },
  "uchicago medicine": { city: "Chicago", region: "IL", country: "USA", continent: "North America", lat: 41.7886, lng: -87.5987 },
  "rush university": { city: "Chicago", region: "IL", country: "USA", continent: "North America", lat: 41.8742, lng: -87.6648 },
  "rush university medical center": { city: "Chicago", region: "IL", country: "USA", continent: "North America", lat: 41.8742, lng: -87.6648 },
  "loyola university chicago": { city: "Chicago", region: "IL", country: "USA", continent: "North America", lat: 41.9947, lng: -87.6578 },
  "illinois": { city: "Chicago", region: "IL", country: "USA", continent: "North America", lat: 41.8781, lng: -87.6298 },
  // Minnesota
  "mayo clinic": { city: "Rochester", region: "MN", country: "USA", continent: "North America", lat: 44.0239, lng: -92.4546 },
  // Cleveland
  "cleveland clinic": { city: "Cleveland", region: "OH", country: "USA", continent: "North America", lat: 41.4993, lng: -81.6232 },
  "case western reserve": { city: "Cleveland", region: "OH", country: "USA", continent: "North America", lat: 41.5044, lng: -81.6077 },
  "university hospitals cleveland": { city: "Cleveland", region: "OH", country: "USA", continent: "North America", lat: 41.5015, lng: -81.6079 },
  // California
  "stanford university": { city: "Stanford", region: "CA", country: "USA", continent: "North America", lat: 37.4275, lng: -122.1697 },
  "stanford medicine": { city: "Stanford", region: "CA", country: "USA", continent: "North America", lat: 37.4275, lng: -122.1697 },
  "ucsf": { city: "San Francisco", region: "CA", country: "USA", continent: "North America", lat: 37.7627, lng: -122.4578 },
  "university of california san francisco": { city: "San Francisco", region: "CA", country: "USA", continent: "North America", lat: 37.7627, lng: -122.4578 },
  "ucla": { city: "Los Angeles", region: "CA", country: "USA", continent: "North America", lat: 34.0689, lng: -118.4452 },
  "cedars-sinai": { city: "Los Angeles", region: "CA", country: "USA", continent: "North America", lat: 34.0748, lng: -118.3767 },
  "uc san diego": { city: "San Diego", region: "CA", country: "USA", continent: "North America", lat: 32.8798, lng: -117.2359 },
  "ucsd health": { city: "San Diego", region: "CA", country: "USA", continent: "North America", lat: 32.8798, lng: -117.2359 },
  "university of southern california": { city: "Los Angeles", region: "CA", country: "USA", continent: "North America", lat: 34.0224, lng: -118.2851 },
  // Philadelphia
  "university of pennsylvania": { city: "Philadelphia", region: "PA", country: "USA", continent: "North America", lat: 39.9523, lng: -75.1947 },
  "penn medicine": { city: "Philadelphia", region: "PA", country: "USA", continent: "North America", lat: 39.9523, lng: -75.1947 },
  "jefferson health": { city: "Philadelphia", region: "PA", country: "USA", continent: "North America", lat: 39.9442, lng: -75.1579 },
  "thomas jefferson university": { city: "Philadelphia", region: "PA", country: "USA", continent: "North America", lat: 39.9442, lng: -75.1579 },
  "temple university": { city: "Philadelphia", region: "PA", country: "USA", continent: "North America", lat: 39.9814, lng: -75.1553 },
  // Baltimore
  "johns hopkins": { city: "Baltimore", region: "MD", country: "USA", continent: "North America", lat: 39.2980, lng: -76.5925 },
  "johns hopkins university": { city: "Baltimore", region: "MD", country: "USA", continent: "North America", lat: 39.2980, lng: -76.5925 },
  "johns hopkins hospital": { city: "Baltimore", region: "MD", country: "USA", continent: "North America", lat: 39.2980, lng: -76.5925 },
  "university of maryland": { city: "Baltimore", region: "MD", country: "USA", continent: "North America", lat: 39.2904, lng: -76.6122 },
  // Pittsburgh
  "upmc": { city: "Pittsburgh", region: "PA", country: "USA", continent: "North America", lat: 40.4406, lng: -79.9959 },
  "university of pittsburgh": { city: "Pittsburgh", region: "PA", country: "USA", continent: "North America", lat: 40.4446, lng: -79.9609 },
  // Nashville
  "vanderbilt university medical": { city: "Nashville", region: "TN", country: "USA", continent: "North America", lat: 36.1447, lng: -86.8027 },
  "vanderbilt university": { city: "Nashville", region: "TN", country: "USA", continent: "North America", lat: 36.1447, lng: -86.8027 },
  // Michigan
  "university of michigan": { city: "Ann Arbor", region: "MI", country: "USA", continent: "North America", lat: 42.2776, lng: -83.7409 },
  "michigan medicine": { city: "Ann Arbor", region: "MI", country: "USA", continent: "North America", lat: 42.2776, lng: -83.7409 },
  // Seattle
  "university of washington": { city: "Seattle", region: "WA", country: "USA", continent: "North America", lat: 47.6553, lng: -122.3035 },
  "uw medicine": { city: "Seattle", region: "WA", country: "USA", continent: "North America", lat: 47.6553, lng: -122.3035 },
  "seattle children's": { city: "Seattle", region: "WA", country: "USA", continent: "North America", lat: 47.6553, lng: -122.3035 },
  // Atlanta
  "emory university": { city: "Atlanta", region: "GA", country: "USA", continent: "North America", lat: 33.7940, lng: -84.3245 },
  "emory healthcare": { city: "Atlanta", region: "GA", country: "USA", continent: "North America", lat: 33.7940, lng: -84.3245 },
  "grady health": { city: "Atlanta", region: "GA", country: "USA", continent: "North America", lat: 33.7534, lng: -84.3892 },
  // Yale / Connecticut
  "yale university": { city: "New Haven", region: "CT", country: "USA", continent: "North America", lat: 41.3163, lng: -72.9223 },
  "yale school of medicine": { city: "New Haven", region: "CT", country: "USA", continent: "North America", lat: 41.3027, lng: -72.9346 },
  // Duke / North Carolina
  "duke university": { city: "Durham", region: "NC", country: "USA", continent: "North America", lat: 35.9940, lng: -78.8986 },
  "duke health": { city: "Durham", region: "NC", country: "USA", continent: "North America", lat: 35.9940, lng: -78.8986 },
  "unc chapel hill": { city: "Chapel Hill", region: "NC", country: "USA", continent: "North America", lat: 35.9049, lng: -79.0469 },
  // Texas
  "ut southwestern": { city: "Dallas", region: "TX", country: "USA", continent: "North America", lat: 32.8123, lng: -96.8404 },
  "baylor college of medicine": { city: "Houston", region: "TX", country: "USA", continent: "North America", lat: 29.7092, lng: -95.3975 },
  "md anderson": { city: "Houston", region: "TX", country: "USA", continent: "North America", lat: 29.7068, lng: -95.3967 },
  "university of texas": { city: "Austin", region: "TX", country: "USA", continent: "North America", lat: 30.2849, lng: -97.7341 },
  // Ohio
  "ohio state university": { city: "Columbus", region: "OH", country: "USA", continent: "North America", lat: 40.0002, lng: -83.0186 },
  "ohio state wexner": { city: "Columbus", region: "OH", country: "USA", continent: "North America", lat: 40.0002, lng: -83.0186 },
  // Colorado
  "university of colorado": { city: "Aurora", region: "CO", country: "USA", continent: "North America", lat: 39.7449, lng: -104.8377 },
  "uchealth": { city: "Aurora", region: "CO", country: "USA", continent: "North America", lat: 39.7449, lng: -104.8377 },
  // Indiana
  "indiana university": { city: "Indianapolis", region: "IN", country: "USA", continent: "North America", lat: 39.7684, lng: -86.1581 },
  "iu health": { city: "Indianapolis", region: "IN", country: "USA", continent: "North America", lat: 39.7700, lng: -86.1758 },
  // Canada
  "university of toronto": { city: "Toronto", country: "Canada", continent: "North America", lat: 43.6629, lng: -79.3957 },
  "toronto general": { city: "Toronto", country: "Canada", continent: "North America", lat: 43.6582, lng: -79.3876 },
  "toronto western": { city: "Toronto", country: "Canada", continent: "North America", lat: 43.6558, lng: -79.4192 },
  "mcgill university": { city: "Montréal", country: "Canada", continent: "North America", lat: 45.5048, lng: -73.5772 },
  "mcgill university health": { city: "Montréal", country: "Canada", continent: "North America", lat: 45.4728, lng: -73.6016 },
  "university of british columbia": { city: "Vancouver", country: "Canada", continent: "North America", lat: 49.2606, lng: -123.2460 },
  "ubc": { city: "Vancouver", country: "Canada", continent: "North America", lat: 49.2606, lng: -123.2460 },
  "university of calgary": { city: "Calgary", country: "Canada", continent: "North America", lat: 51.0777, lng: -114.1382 },
  "university of alberta": { city: "Edmonton", country: "Canada", continent: "North America", lat: 53.5232, lng: -113.5263 },
  // UK
  "imperial college london": { city: "London", country: "UK", continent: "Europe", lat: 51.4988, lng: -0.1749 },
  "imperial college": { city: "London", country: "UK", continent: "Europe", lat: 51.4988, lng: -0.1749 },
  "university college london": { city: "London", country: "UK", continent: "Europe", lat: 51.5246, lng: -0.1340 },
  "ucl": { city: "London", country: "UK", continent: "Europe", lat: 51.5246, lng: -0.1340 },
  "king's college london": { city: "London", country: "UK", continent: "Europe", lat: 51.5116, lng: -0.1161 },
  "king's college": { city: "London", country: "UK", continent: "Europe", lat: 51.5116, lng: -0.1161 },
  "guy's and st thomas'": { city: "London", country: "UK", continent: "Europe", lat: 51.4985, lng: -0.1179 },
  "oxford university": { city: "Oxford", country: "UK", continent: "Europe", lat: 51.7548, lng: -1.2544 },
  "university of oxford": { city: "Oxford", country: "UK", continent: "Europe", lat: 51.7548, lng: -1.2544 },
  "university of cambridge": { city: "Cambridge", country: "UK", continent: "Europe", lat: 52.2053, lng: 0.1218 },
  "cambridge university": { city: "Cambridge", country: "UK", continent: "Europe", lat: 52.2053, lng: 0.1218 },
  "university of edinburgh": { city: "Edinburgh", country: "UK", continent: "Europe", lat: 55.9445, lng: -3.1892 },
  "university of manchester": { city: "Manchester", country: "UK", continent: "Europe", lat: 53.4668, lng: -2.2339 },
  // Europe
  "karolinska institutet": { city: "Stockholm", country: "Sweden", continent: "Europe", lat: 59.3340, lng: 18.0326 },
  "karolinska": { city: "Stockholm", country: "Sweden", continent: "Europe", lat: 59.3340, lng: 18.0326 },
  "charité": { city: "Berlin", country: "Germany", continent: "Europe", lat: 52.5252, lng: 13.3774 },
  "charite": { city: "Berlin", country: "Germany", continent: "Europe", lat: 52.5252, lng: 13.3774 },
  "university hospital heidelberg": { city: "Heidelberg", country: "Germany", continent: "Europe", lat: 49.3988, lng: 8.6724 },
  "technical university of munich": { city: "Munich", country: "Germany", continent: "Europe", lat: 48.1496, lng: 11.5680 },
  "lmu munich": { city: "Munich", country: "Germany", continent: "Europe", lat: 48.1508, lng: 11.5800 },
  "amsterdam university medical": { city: "Amsterdam", country: "Netherlands", continent: "Europe", lat: 52.2939, lng: 4.9578 },
  "erasmus mc": { city: "Rotterdam", country: "Netherlands", continent: "Europe", lat: 51.9155, lng: 4.4667 },
  "radboud university medical": { city: "Nijmegen", country: "Netherlands", continent: "Europe", lat: 51.8252, lng: 5.8585 },
  "paris descartes": { city: "Paris", country: "France", continent: "Europe", lat: 48.8566, lng: 2.3522 },
  "sorbonne université": { city: "Paris", country: "France", continent: "Europe", lat: 48.8494, lng: 2.3417 },
  "university of milan": { city: "Milan", country: "Italy", continent: "Europe", lat: 45.4654, lng: 9.1866 },
  "university of zurich": { city: "Zürich", country: "Switzerland", continent: "Europe", lat: 47.3769, lng: 8.5500 },
  "eth zurich": { city: "Zürich", country: "Switzerland", continent: "Europe", lat: 47.3769, lng: 8.5480 },
  "university of oslo": { city: "Oslo", country: "Norway", continent: "Europe", lat: 59.9429, lng: 10.7238 },
  "university of helsinki": { city: "Helsinki", country: "Finland", continent: "Europe", lat: 60.2030, lng: 24.9611 },
  "ku leuven": { city: "Leuven", country: "Belgium", continent: "Europe", lat: 50.8798, lng: 4.7005 },
  // Japan
  "university of tokyo": { city: "Tokyo", country: "Japan", continent: "Asia", lat: 35.7127, lng: 139.7622 },
  "tokyo medical university": { city: "Tokyo", country: "Japan", continent: "Asia", lat: 35.6951, lng: 139.7095 },
  "keio university school of medicine": { city: "Tokyo", country: "Japan", continent: "Asia", lat: 35.6518, lng: 139.6967 },
  "osaka university": { city: "Osaka", country: "Japan", continent: "Asia", lat: 34.8154, lng: 135.5232 },
  "kyoto university": { city: "Kyoto", country: "Japan", continent: "Asia", lat: 35.0272, lng: 135.7813 },
  "tohoku university": { city: "Sendai", country: "Japan", continent: "Asia", lat: 38.2553, lng: 140.8742 },
  // Korea
  "seoul national university": { city: "Seoul", country: "South Korea", continent: "Asia", lat: 37.4597, lng: 126.9511 },
  "yonsei university": { city: "Seoul", country: "South Korea", continent: "Asia", lat: 37.5663, lng: 126.9388 },
  "samsung medical center": { city: "Seoul", country: "South Korea", continent: "Asia", lat: 37.4893, lng: 127.0856 },
  "asan medical center": { city: "Seoul", country: "South Korea", continent: "Asia", lat: 37.5220, lng: 127.1087 },
  // China
  "peking union medical college": { city: "Beijing", country: "China", continent: "Asia", lat: 39.9042, lng: 116.4074 },
  "peking university": { city: "Beijing", country: "China", continent: "Asia", lat: 39.9997, lng: 116.3270 },
  "tsinghua university": { city: "Beijing", country: "China", continent: "Asia", lat: 40.0070, lng: 116.3240 },
  "fudan university": { city: "Shanghai", country: "China", continent: "Asia", lat: 31.2990, lng: 121.5024 },
  "zhongshan hospital": { city: "Shanghai", country: "China", continent: "Asia", lat: 31.1986, lng: 121.4543 },
  // India
  "aiims new delhi": { city: "New Delhi", country: "India", continent: "Asia", lat: 28.5672, lng: 77.2100 },
  "all india institute of medical sciences": { city: "New Delhi", country: "India", continent: "Asia", lat: 28.5672, lng: 77.2100 },
  "tata memorial": { city: "Mumbai", country: "India", continent: "Asia", lat: 18.9993, lng: 72.8401 },
  // Singapore
  "national university of singapore": { city: "Singapore", country: "Singapore", continent: "Asia", lat: 1.2966, lng: 103.7764 },
  "nanyang technological university": { city: "Singapore", country: "Singapore", continent: "Asia", lat: 1.3483, lng: 103.6832 },
  "singapore general hospital": { city: "Singapore", country: "Singapore", continent: "Asia", lat: 1.2797, lng: 103.8360 },
  // Australia
  "university of sydney": { city: "Sydney", country: "Australia", continent: "Oceania", lat: -33.8882, lng: 151.1873 },
  "university of melbourne": { city: "Melbourne", country: "Australia", continent: "Oceania", lat: -37.7963, lng: 144.9614 },
  "monash university": { city: "Melbourne", country: "Australia", continent: "Oceania", lat: -37.9150, lng: 145.1340 },
  "royal melbourne hospital": { city: "Melbourne", country: "Australia", continent: "Oceania", lat: -37.7990, lng: 144.9552 },
  "royal prince alfred": { city: "Sydney", country: "Australia", continent: "Oceania", lat: -33.8887, lng: 151.1872 },
  // South America
  "universidade de são paulo": { city: "São Paulo", country: "Brazil", continent: "South America", lat: -23.5592, lng: -46.7310 },
  "universidade de sao paulo": { city: "São Paulo", country: "Brazil", continent: "South America", lat: -23.5592, lng: -46.7310 },
  "hospital israelita albert einstein": { city: "São Paulo", country: "Brazil", continent: "South America", lat: -23.5988, lng: -46.6977 },
  "pontificia universidad": { city: "Santiago", country: "Chile", continent: "South America", lat: -33.4400, lng: -70.6503 },
  // Middle East
  "sheba medical center": { city: "Tel Aviv", country: "Israel", continent: "Asia", lat: 32.0397, lng: 34.8303 },
  "tel aviv university": { city: "Tel Aviv", country: "Israel", continent: "Asia", lat: 32.1136, lng: 34.8044 },
  "american university of beirut": { city: "Beirut", country: "Lebanon", continent: "Asia", lat: 33.9003, lng: 35.4781 },
  // Africa
  "university of cape town": { city: "Cape Town", country: "South Africa", continent: "Africa", lat: -33.9249, lng: 18.4241 },
  "university of the witwatersrand": { city: "Johannesburg", country: "South Africa", continent: "Africa", lat: -26.1929, lng: 28.0305 },
  "cairo university": { city: "Cairo", country: "Egypt", continent: "Africa", lat: 30.0444, lng: 31.2357 },
};

// ── City/region keyword heuristics ────────────────────────────────────────────

const CITY_KEYWORDS: Array<[string, Omit<GeoLocation, "confidence">]> = [
  ["new york", { city: "New York", region: "NY", country: "USA", continent: "North America", lat: 40.7128, lng: -74.0060 }],
  ["manhattan", { city: "New York", region: "NY", country: "USA", continent: "North America", lat: 40.7831, lng: -73.9712 }],
  ["boston", { city: "Boston", region: "MA", country: "USA", continent: "North America", lat: 42.3601, lng: -71.0589 }],
  ["chicago", { city: "Chicago", region: "IL", country: "USA", continent: "North America", lat: 41.8781, lng: -87.6298 }],
  ["san francisco", { city: "San Francisco", region: "CA", country: "USA", continent: "North America", lat: 37.7749, lng: -122.4194 }],
  ["los angeles", { city: "Los Angeles", region: "CA", country: "USA", continent: "North America", lat: 34.0522, lng: -118.2437 }],
  ["stanford", { city: "Stanford", region: "CA", country: "USA", continent: "North America", lat: 37.4275, lng: -122.1697 }],
  ["san diego", { city: "San Diego", region: "CA", country: "USA", continent: "North America", lat: 32.7157, lng: -117.1611 }],
  ["seattle", { city: "Seattle", region: "WA", country: "USA", continent: "North America", lat: 47.6062, lng: -122.3321 }],
  ["pittsburgh", { city: "Pittsburgh", region: "PA", country: "USA", continent: "North America", lat: 40.4406, lng: -79.9959 }],
  ["philadelphia", { city: "Philadelphia", region: "PA", country: "USA", continent: "North America", lat: 39.9526, lng: -75.1652 }],
  ["baltimore", { city: "Baltimore", region: "MD", country: "USA", continent: "North America", lat: 39.2904, lng: -76.6122 }],
  ["cleveland", { city: "Cleveland", region: "OH", country: "USA", continent: "North America", lat: 41.4993, lng: -81.6944 }],
  ["houston", { city: "Houston", region: "TX", country: "USA", continent: "North America", lat: 29.7604, lng: -95.3698 }],
  ["dallas", { city: "Dallas", region: "TX", country: "USA", continent: "North America", lat: 32.7767, lng: -96.7970 }],
  ["minneapolis", { city: "Minneapolis", region: "MN", country: "USA", continent: "North America", lat: 44.9778, lng: -93.2650 }],
  ["rochester", { city: "Rochester", region: "MN", country: "USA", continent: "North America", lat: 44.0239, lng: -92.4546 }],
  ["toronto", { city: "Toronto", country: "Canada", continent: "North America", lat: 43.6532, lng: -79.3832 }],
  ["montreal", { city: "Montréal", country: "Canada", continent: "North America", lat: 45.5017, lng: -73.5673 }],
  ["vancouver", { city: "Vancouver", country: "Canada", continent: "North America", lat: 49.2827, lng: -123.1207 }],
  ["london", { city: "London", country: "UK", continent: "Europe", lat: 51.5074, lng: -0.1278 }],
  ["oxford", { city: "Oxford", country: "UK", continent: "Europe", lat: 51.7548, lng: -1.2544 }],
  ["cambridge", { city: "Cambridge", country: "UK", continent: "Europe", lat: 52.2053, lng: 0.1218 }],
  ["edinburgh", { city: "Edinburgh", country: "UK", continent: "Europe", lat: 55.9533, lng: -3.1883 }],
  ["berlin", { city: "Berlin", country: "Germany", continent: "Europe", lat: 52.5200, lng: 13.4050 }],
  ["munich", { city: "Munich", country: "Germany", continent: "Europe", lat: 48.1351, lng: 11.5820 }],
  ["amsterdam", { city: "Amsterdam", country: "Netherlands", continent: "Europe", lat: 52.3676, lng: 4.9041 }],
  ["rotterdam", { city: "Rotterdam", country: "Netherlands", continent: "Europe", lat: 51.9244, lng: 4.4777 }],
  ["paris", { city: "Paris", country: "France", continent: "Europe", lat: 48.8566, lng: 2.3522 }],
  ["zurich", { city: "Zürich", country: "Switzerland", continent: "Europe", lat: 47.3769, lng: 8.5417 }],
  ["stockholm", { city: "Stockholm", country: "Sweden", continent: "Europe", lat: 59.3293, lng: 18.0686 }],
  ["tokyo", { city: "Tokyo", country: "Japan", continent: "Asia", lat: 35.6762, lng: 139.6503 }],
  ["osaka", { city: "Osaka", country: "Japan", continent: "Asia", lat: 34.6937, lng: 135.5023 }],
  ["kyoto", { city: "Kyoto", country: "Japan", continent: "Asia", lat: 35.0116, lng: 135.7681 }],
  ["seoul", { city: "Seoul", country: "South Korea", continent: "Asia", lat: 37.5665, lng: 126.9780 }],
  ["beijing", { city: "Beijing", country: "China", continent: "Asia", lat: 39.9042, lng: 116.4074 }],
  ["shanghai", { city: "Shanghai", country: "China", continent: "Asia", lat: 31.2304, lng: 121.4737 }],
  ["singapore", { city: "Singapore", country: "Singapore", continent: "Asia", lat: 1.3521, lng: 103.8198 }],
  ["sydney", { city: "Sydney", country: "Australia", continent: "Oceania", lat: -33.8688, lng: 151.2093 }],
  ["melbourne", { city: "Melbourne", country: "Australia", continent: "Oceania", lat: -37.8136, lng: 144.9631 }],
  ["sao paulo", { city: "São Paulo", country: "Brazil", continent: "South America", lat: -23.5505, lng: -46.6333 }],
  ["cairo", { city: "Cairo", country: "Egypt", continent: "Africa", lat: 30.0444, lng: 31.2357 }],
];

// ── Fallback pool for unknown institutions ────────────────────────────────────
// Deterministic: same institution always maps to same fallback city.

const FALLBACK_POOL: Array<Omit<GeoLocation, "confidence">> = [
  { city: "New York", region: "NY", country: "USA", continent: "North America", lat: 40.7128, lng: -74.0060 },
  { city: "Los Angeles", region: "CA", country: "USA", continent: "North America", lat: 34.0522, lng: -118.2437 },
  { city: "Chicago", region: "IL", country: "USA", continent: "North America", lat: 41.8781, lng: -87.6298 },
  { city: "Toronto", country: "Canada", continent: "North America", lat: 43.6532, lng: -79.3832 },
  { city: "London", country: "UK", continent: "Europe", lat: 51.5074, lng: -0.1278 },
  { city: "Paris", country: "France", continent: "Europe", lat: 48.8566, lng: 2.3522 },
  { city: "Berlin", country: "Germany", continent: "Europe", lat: 52.5200, lng: 13.4050 },
  { city: "Amsterdam", country: "Netherlands", continent: "Europe", lat: 52.3676, lng: 4.9041 },
  { city: "Stockholm", country: "Sweden", continent: "Europe", lat: 59.3293, lng: 18.0686 },
  { city: "Zürich", country: "Switzerland", continent: "Europe", lat: 47.3769, lng: 8.5417 },
  { city: "Tokyo", country: "Japan", continent: "Asia", lat: 35.6762, lng: 139.6503 },
  { city: "Seoul", country: "South Korea", continent: "Asia", lat: 37.5665, lng: 126.9780 },
  { city: "Beijing", country: "China", continent: "Asia", lat: 39.9042, lng: 116.4074 },
  { city: "Singapore", country: "Singapore", continent: "Asia", lat: 1.3521, lng: 103.8198 },
  { city: "Mumbai", country: "India", continent: "Asia", lat: 19.0760, lng: 72.8777 },
  { city: "Sydney", country: "Australia", continent: "Oceania", lat: -33.8688, lng: 151.2093 },
  { city: "Melbourne", country: "Australia", continent: "Oceania", lat: -37.8136, lng: 144.9631 },
  { city: "São Paulo", country: "Brazil", continent: "South America", lat: -23.5505, lng: -46.6333 },
  { city: "Buenos Aires", country: "Argentina", continent: "South America", lat: -34.6037, lng: -58.3816 },
  { city: "Cairo", country: "Egypt", continent: "Africa", lat: 30.0444, lng: 31.2357 },
  { city: "Cape Town", country: "South Africa", continent: "Africa", lat: -33.9249, lng: 18.4241 },
  { city: "Nairobi", country: "Kenya", continent: "Africa", lat: -1.2921, lng: 36.8219 },
  { city: "Dubai", country: "UAE", continent: "Asia", lat: 25.2048, lng: 55.2708 },
  { city: "Tel Aviv", country: "Israel", continent: "Asia", lat: 32.0853, lng: 34.7818 },
];

function hashCode(s: string): number {
  let h = 0;
  for (const c of s) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

// ── Public resolver ───────────────────────────────────────────────────────────

export function resolveInstitutionGeo(institution: string): GeoLocation {
  const normalized = institution.toLowerCase().trim();

  // 1. Exact match
  if (KNOWN[normalized]) return { ...KNOWN[normalized], confidence: "high" };

  // 2. Substring match — longer keys checked first for accuracy
  const sortedKeys = Object.keys(KNOWN).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (normalized.includes(key)) return { ...KNOWN[key], confidence: "high" };
  }

  // 3. City/region keyword heuristics
  for (const [keyword, loc] of CITY_KEYWORDS) {
    if (normalized.includes(keyword)) return { ...loc, confidence: "medium" };
  }

  // 4. Deterministic fallback from global pool
  const idx = hashCode(normalized) % FALLBACK_POOL.length;
  return { ...FALLBACK_POOL[idx], confidence: "low" };
}
