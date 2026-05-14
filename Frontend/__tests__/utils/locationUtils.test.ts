import { getDistanceFromLatLonInMeters } from '../../src/utils/locationUtils';

describe('getDistanceFromLatLonInMeters', () => {
  test('returns 0 for identical coordinates', () => {
    const d = getDistanceFromLatLonInMeters(12.9716, 77.5946, 12.9716, 77.5946);
    expect(d).toBe(0);
  });

  test('returns a positive value for different coordinates', () => {
    const d = getDistanceFromLatLonInMeters(12.9716, 77.5946, 12.9726, 77.5956);
    expect(d).toBeGreaterThan(0);
  });

  test('office ↔ office = within 500m threshold', () => {
    // Same office coords — well within geofence
    const d = getDistanceFromLatLonInMeters(12.97, 77.59, 12.97, 77.59);
    expect(d).toBeLessThanOrEqual(500);
  });

  test('far point (Mumbai → Bangalore) returns thousands of meters', () => {
    // Bangalore (12.97, 77.59) → Mumbai (19.07, 72.87) ≈ 840 km
    const d = getDistanceFromLatLonInMeters(12.9716, 77.5946, 19.076, 72.8777);
    expect(d).toBeGreaterThan(800_000);
    expect(d).toBeLessThan(900_000);
  });

  test('point 300m away is within 500m geofence', () => {
    // ~300m north of origin
    const d = getDistanceFromLatLonInMeters(12.97, 77.59, 12.9727, 77.59);
    expect(d).toBeLessThan(500);
  });

  test('point 600m away is outside 500m geofence', () => {
    // ~600m north of origin
    const d = getDistanceFromLatLonInMeters(12.97, 77.59, 12.9754, 77.59);
    expect(d).toBeGreaterThan(500);
  });

  test('handles negative latitudes (southern hemisphere)', () => {
    // Sydney → Melbourne
    const d = getDistanceFromLatLonInMeters(-33.8688, 151.2093, -37.8136, 144.9631);
    expect(d).toBeGreaterThan(700_000);
  });

  test('handles coordinates spanning prime meridian (lon wrapping)', () => {
    const d = getDistanceFromLatLonInMeters(51.5074, -0.1278, 51.5074, 0.1278);
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(30_000); // ~16km
  });
});
