import { logger } from '../utils/logger';

export type GeoapifyMode = 'drive' | 'walk' | 'bicycle' | 'transit' | 'truck';

export interface GeoapifyCoordinate { lat: number; lng: number }

const GEOAPIFY_BASE = 'https://api.geoapify.com';

const getKey = () => import.meta.env?.VITE_GEOAPIFY_KEY as string | undefined;

const fetchJson = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Geoapify error ${res.status}: ${res.statusText} ${text}`);
  }
  return res.json();
};

// Geocoding
export const geoapifyGeocode = async (text: string, limit = 10) => {
  const key = getKey();
  if (!key) throw new Error('Geoapify key missing');
  const url = `${GEOAPIFY_BASE}/v1/geocode/search?text=${encodeURIComponent(text)}&limit=${limit}&apiKey=${key}`;
  const data = await fetchJson(url);
  return (data.features || []).map((f: any) => ({
    id: f.properties.place_id?.toString() || f.properties.osm_id?.toString() || f.properties.datasource?.raw?.osm_id?.toString() || f.properties.formatted,
    name: f.properties.name || f.properties.street || f.properties.formatted,
    address: f.properties.formatted,
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
    confidence: f.properties.rank?.confidence || 0.5,
    category: f.properties.category,
    country: f.properties.country,
    region: f.properties.state,
  }));
};

export const geoapifyAutocomplete = async (text: string, limit = 5) => {
  const key = getKey();
  if (!key) throw new Error('Geoapify key missing');
  const url = `${GEOAPIFY_BASE}/v1/geocode/autocomplete?text=${encodeURIComponent(text)}&limit=${limit}&apiKey=${key}`;
  const data = await fetchJson(url);
  return (data.features || []).map((f: any) => ({
    id: f.properties.place_id?.toString() || f.properties.formatted,
    name: f.properties.name || f.properties.street || f.properties.formatted,
    address: f.properties.formatted,
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
    confidence: f.properties.rank?.confidence || 0.5,
    category: f.properties.category,
    country: f.properties.country,
    region: f.properties.state,
  }));
};

export const geoapifyReverse = async (lat: number, lng: number) => {
  const key = getKey();
  if (!key) throw new Error('Geoapify key missing');
  const url = `${GEOAPIFY_BASE}/v1/geocode/reverse?lat=${lat}&lon=${lng}&apiKey=${key}`;
  const data = await fetchJson(url);
  const f = (data.features || [])[0];
  if (!f) return null;
  return {
    id: f.properties.place_id?.toString() || f.properties.formatted,
    name: f.properties.name || f.properties.street || f.properties.formatted,
    address: f.properties.formatted,
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
    confidence: f.properties.rank?.confidence || 0.5,
    category: f.properties.category,
    country: f.properties.country,
    region: f.properties.state,
  };
};

// Routing
export const geoapifyRoute = async (
  start: GeoapifyCoordinate,
  end: GeoapifyCoordinate,
  mode: GeoapifyMode = 'drive',
  options?: { avoidTolls?: boolean; avoidHighways?: boolean }
) => {
  const key = getKey();
  if (!key) throw new Error('Geoapify key missing');
  const waypoints = `${start.lng},${start.lat}|${end.lng},${end.lat}`;
  const params = new URLSearchParams({ waypoints, mode, apiKey: key });
  // Geoapify supports parameters like avoid=toll, motorway
  const avoid: string[] = [];
  if (options?.avoidTolls) avoid.push('toll');
  if (options?.avoidHighways) avoid.push('motorway');
  if (avoid.length) params.append('avoid', avoid.join(','));
  const url = `${GEOAPIFY_BASE}/v1/routing?${params.toString()}`;
  const data = await fetchJson(url);
  // Expect GeoJSON FeatureCollection
  const feat = (data.features || [])[0];
  if (!feat) throw new Error('No route found');
  const props = feat.properties || {};
  const distanceMeters = props.distance || props.segment_lengths?.reduce((a: number, b: number) => a + b, 0) || 0;
  const durationSeconds = props.time || props.segment_times?.reduce((a: number, b: number) => a + b, 0) || 0;
  const coords = (feat.geometry && feat.geometry.coordinates) || [];

  return {
    id: `geoapify_${Date.now()}`,
    distanceMeters,
    durationSeconds,
    geometry: coords,
    steps: props.legs || [],
  };
};

export const geoapifyService = {
  geocode: geoapifyGeocode,
  autocomplete: geoapifyAutocomplete,
  reverse: geoapifyReverse,
  route: geoapifyRoute,
};

export default geoapifyService;
