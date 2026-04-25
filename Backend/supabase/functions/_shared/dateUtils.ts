/**
 * Timezone-safe date utilities for Edge Functions.
 * 
 * Edge Functions run in UTC. The client sends `timezoneOffset` (in minutes, 
 * from `new Date().getTimezoneOffset()`) so we can compute the user's local date.
 * 
 * Example: IST is UTC+5:30, so getTimezoneOffset() returns -330.
 * To get local time: UTC time - offset minutes = local time.
 */

/**
 * Returns the user's local date as YYYY-MM-DD string.
 * @param timezoneOffset - Minutes offset from `new Date().getTimezoneOffset()` (e.g., -330 for IST)
 */
export const getLocalDate = (timezoneOffset?: number): string => {
  const now = new Date();

  if (timezoneOffset !== undefined && timezoneOffset !== null) {
    // getTimezoneOffset returns minutes BEHIND UTC (e.g., IST = -330)
    // Local time = UTC time - offset
    const localTime = new Date(now.getTime() - timezoneOffset * 60 * 1000);
    return localTime.toISOString().split('T')[0];
  }

  // Fallback to UTC if no offset provided
  return now.toISOString().split('T')[0];
};

/**
 * Calculates duration in minutes between two ISO timestamps.
 */
export const calcDurationMinutes = (checkIn: string, checkOut: string): number => {
  const start = new Date(checkIn).getTime();
  const end = new Date(checkOut).getTime();
  return Math.round((end - start) / (1000 * 60));
};
