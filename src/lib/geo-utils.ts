// Data for district centers (simplified)
export const DISTRICT_COORDS: Record<string, [number, number]> = {
  "Dhaka": [23.8103, 90.4125],
  "Chattogram": [22.3569, 91.7832],
  "Rajshahi": [24.3745, 88.6042],
  "Khulna": [22.8456, 89.5403],
  "Barishal": [22.7010, 90.3535],
  "Sylhet": [24.8949, 91.8687],
  "Rangpur": [25.7439, 89.2752],
  "Mymensingh": [24.7471, 90.4203],
  "Gazipur": [23.9999, 90.4203],
  "Narayanganj": [23.6238, 90.5000],
  "Cox's Bazar": [21.4272, 92.0058],
  "Cumilla": [23.4607, 91.1809],
  "Bogra": [24.8481, 89.3730],
  "Jessore": [23.1664, 89.2081],
  "Comilla": [23.4607, 91.1809],
};

// Data for Country centers (Worldwide shipping)
export const COUNTRY_COORDS: Record<string, [number, number]> = {
  "united states": [37.0902, -95.7129],
  "usa": [37.0902, -95.7129],
  "us": [37.0902, -95.7129],
  "united kingdom": [55.3781, -3.4360],
  "uk": [55.3781, -3.4360],
  "england": [55.3781, -3.4360],
  "canada": [56.1304, -106.3468],
  "india": [20.5937, 78.9629],
  "germany": [51.1657, 10.4515],
  "australia": [-25.2744, 133.7751],
  "saudi arabia": [23.8859, 45.0792],
  "saudi": [23.8859, 45.0792],
  "uae": [23.4241, 53.8478],
  "united arab emirates": [23.4241, 53.8478],
  "singapore": [1.3521, 103.8198],
  "malaysia": [4.2105, 101.9758],
  "qatar": [25.3548, 51.1839],
  "oman": [21.5126, 55.9233],
  "kuwait": [29.3117, 47.4818],
  "bahrain": [26.0667, 50.5577],
  "south africa": [-30.5595, 22.9375],
  "brazil": [-14.2350, -51.9253],
  "france": [46.2276, 2.2137],
  "italy": [41.8719, 12.5674],
  "japan": [36.2048, 138.2529],
  "sweden": [60.1282, 18.6435],
  "switzerland": [46.8182, 8.2275],
};

// Hash function to map a string deterministically
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash;
}

export function getCoordsForLocation(district: string, division: string): { lat: number, lng: number } {
  // Normalize parameters
  const normDist = district ? district.trim() : "";
  const normDiv = division ? division.trim() : "";

  // Try to find in Bangladesh districts first
  let coords = DISTRICT_COORDS[normDist] || DISTRICT_COORDS[normDiv];
  
  if (!coords) {
    const keyDiv = normDiv.toLowerCase();
    const keyDist = normDist.toLowerCase();
    
    // Find matching country
    coords = COUNTRY_COORDS[keyDiv] || COUNTRY_COORDS[keyDist];
    
    // Fall back to a global city preset if not found in our pre-defined list
    if (!coords) {
      const presets: [number, number][] = [
        [40.7128, -74.0060],  // New York
        [34.0522, -118.2437], // Los Angeles
        [51.5074, -0.1278],   // London
        [48.8566, 2.3522],    // Paris
        [35.6762, 139.6503],  // Tokyo
        [-33.8688, 151.2093], // Sydney
        [1.3521, 103.8198],   // Singapore
        [25.2048, 55.2708],   // Dubai
        [52.5200, 13.4050],   // Berlin
        [-22.9068, -43.1729], // Rio de Janeiro
        [3.1390, 101.6869],   // Kuala Lumpur
        [28.6139, 77.2090],   // New Delhi
        [30.0444, 31.2357],   // Cairo
        [-33.9249, 18.4241],  // Cape Town
        [59.3293, 18.0686]    // Stockholm
      ];
      
      const hashInput = keyDiv || keyDist || "fallback";
      const randomIndex = Math.abs(hashCode(hashInput)) % presets.length;
      coords = presets[randomIndex];
    }
  }

  // Add a small random jitter to avoid markers overlapping exactly
  const jitterLat = (Math.random() - 0.5) * 0.05;
  const jitterLng = (Math.random() - 0.5) * 0.05;
  
  return {
    lat: coords[0] + jitterLat,
    lng: coords[1] + jitterLng
  };
}
