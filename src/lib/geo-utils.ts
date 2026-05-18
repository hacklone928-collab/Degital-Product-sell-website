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
  // Add more as needed, or use a default central point
};

export function getCoordsForLocation(district: string, division: string): { lat: number, lng: number } {
  // Default to Dhaka if not found
  const coords = DISTRICT_COORDS[district] || DISTRICT_COORDS[division] || [23.6850, 90.3563];
  
  // Add a small random jitter to avoid markers overlapping exactly
  const jitterLat = (Math.random() - 0.5) * 0.05;
  const jitterLng = (Math.random() - 0.5) * 0.05;
  
  return {
    lat: coords[0] + jitterLat,
    lng: coords[1] + jitterLng
  };
}
