function getPointAtDistance(lat, long1, km, heading, R = 6371) {
  lat = radians(lat);
  long1 = radians(long1);
  const a = radians(heading);
  const lat2 = asin(sin(lat) * cos(km / R) + cos(lat) * sin(km / R) * cos(a));
  const dx = cos(km / R) - sin(lat) * sin(lat2);
  const dy = sin(a) * sin(km / R) * cos(lat);
  const long2 = long1 + atan2(dy, dx);
  return [degrees(lat2), degrees(long2)];
}
