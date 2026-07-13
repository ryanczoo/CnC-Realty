interface BuildMapboxStaticImageUrlParams {
  lat: number | null;
  lng: number | null;
  token: string | undefined;
  width?: number;
  height?: number;
  zoom?: number;
}

export function buildMapboxStaticImageUrl({
  lat,
  lng,
  token,
  width = 640,
  height = 480,
  zoom = 19,
}: BuildMapboxStaticImageUrlParams): string | null {
  if (lat == null || lng == null || !token) return null;
  return `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${lng},${lat},${zoom}/${width}x${height}@2x?access_token=${token}`;
}
