export interface LocationInfo {
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
  accuracy?: 'gps' | 'ip';
  timestamp: number;
}

/**
 * Get location using browser's Geolocation API
 * Returns city-level location (coordinates will be used to get city name)
 */
const getGPSLocation = (): Promise<GeolocationPosition> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position),
      (error) => reject(error),
      {
        enableHighAccuracy: false, // We only need city-level accuracy
        timeout: 10000,
        maximumAge: 300000, // Cache for 5 minutes
      }
    );
  });
};

/**
 * Get location info from IP address using a free geolocation service
 * This is used as fallback when GPS is not available or denied
 */
const getIPLocation = async (): Promise<LocationInfo> => {
  try {
    // Using ip-api.com (free, no API key required)
    // Alternative: ipapi.co, geolocation-db.com
    const response = await fetch('http://ip-api.com/json/?fields=status,country,countryCode,region,city,lat,lon');

    if (!response.ok) {
      throw new Error('Failed to fetch IP location');
    }

    const data = await response.json();

    if (data.status !== 'success') {
      throw new Error('IP location lookup failed');
    }

    return {
      city: data.city,
      region: data.region,
      country: data.country,
      countryCode: data.countryCode,
      latitude: data.lat,
      longitude: data.lon,
      accuracy: 'ip',
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error('[Geolocation] IP location failed:', error);
    throw error;
  }
};

/**
 * Reverse geocode coordinates to get city/region information
 * Uses OpenStreetMap's Nominatim API (free, no API key required)
 */
const reverseGeocode = async (latitude: number, longitude: number): Promise<LocationInfo> => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'MedicalVideoConsultation/1.0', // Nominatim requires a User-Agent
        },
      }
    );

    if (!response.ok) {
      throw new Error('Reverse geocoding failed');
    }

    const data = await response.json();
    const address = data.address || {};

    return {
      city: address.city || address.town || address.village || address.county,
      region: address.state || address.region,
      country: address.country,
      countryCode: address.country_code?.toUpperCase(),
      latitude,
      longitude,
      accuracy: 'gps',
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error('[Geolocation] Reverse geocoding failed:', error);
    throw error;
  }
};

/**
 * Get user's location with consent
 * Tries GPS first (with user permission), falls back to IP geolocation
 */
export const getUserLocation = async (): Promise<LocationInfo> => {
  console.log('[Geolocation] Starting location detection...');

  try {
    // Try GPS first
    console.log('[Geolocation] Attempting GPS location...');
    const position = await getGPSLocation();

    console.log('[Geolocation] GPS location obtained:', {
      lat: position.coords.latitude,
      lon: position.coords.longitude,
      accuracy: position.coords.accuracy,
    });

    // Convert coordinates to city/region
    const locationInfo = await reverseGeocode(
      position.coords.latitude,
      position.coords.longitude
    );

    console.log('[Geolocation] Location info:', locationInfo);
    return locationInfo;
  } catch (gpsError) {
    console.warn('[Geolocation] GPS failed, falling back to IP location:', gpsError);

    // Fallback to IP-based location
    try {
      const ipLocation = await getIPLocation();
      console.log('[Geolocation] IP location obtained:', ipLocation);
      return ipLocation;
    } catch (ipError) {
      console.error('[Geolocation] All location methods failed:', ipError);

      // Return minimal info
      return {
        city: 'Unknown',
        region: 'Unknown',
        country: 'Unknown',
        accuracy: 'ip',
        timestamp: Date.now(),
      };
    }
  }
};

/**
 * Format location info for display
 */
export const formatLocation = (location: LocationInfo | null): string => {
  if (!location) {
    return 'Location unavailable';
  }

  const parts: string[] = [];

  if (location.city) parts.push(location.city);
  if (location.region) parts.push(location.region);
  if (location.country) parts.push(location.country);

  if (parts.length === 0) {
    return 'Location unavailable';
  }

  return parts.join(', ');
};
