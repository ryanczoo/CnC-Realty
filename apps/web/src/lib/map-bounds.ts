interface BoundsInput {
  latitude: number | null;
  longitude: number | null;
}

export function getPropertiesBounds(
  properties: BoundsInput[]
): [[number, number], [number, number]] | null {
  const valid = properties.filter(
    (p): p is { latitude: number; longitude: number } =>
      p.latitude != null && p.longitude != null
  );
  if (valid.length === 0) return null;

  let minLng = valid[0].longitude;
  let maxLng = valid[0].longitude;
  let minLat = valid[0].latitude;
  let maxLat = valid[0].latitude;

  for (const p of valid) {
    if (p.longitude < minLng) minLng = p.longitude;
    if (p.longitude > maxLng) maxLng = p.longitude;
    if (p.latitude < minLat) minLat = p.latitude;
    if (p.latitude > maxLat) maxLat = p.latitude;
  }

  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}
