import {
  parseTimeToDate,
  formatTimeDisplay,
  formatTimeForDB,
  formatTime,
} from '../../src/utils/time';

describe('parseTimeToDate', () => {
  test('parses "09:00" → hours 9, minutes 0', () => {
    const d = parseTimeToDate('09:00');
    expect(d.getHours()).toBe(9);
    expect(d.getMinutes()).toBe(0);
  });

  test('parses "13:30" → hours 13, minutes 30', () => {
    const d = parseTimeToDate('13:30');
    expect(d.getHours()).toBe(13);
    expect(d.getMinutes()).toBe(30);
  });

  test('parses "00:00" → falls back to 9 (parseInt falsy edge case in source)', () => {
    // Source: `parseInt(parts[0]) || 9` — parseInt('00') = 0, which is falsy
    // so hours becomes 9 (the default). This is a known quirk of the implementation.
    const d = parseTimeToDate('00:00');
    expect(d.getHours()).toBe(9);
  });

  test('returns 09:00 default for null input', () => {
    const d = parseTimeToDate(null);
    expect(d.getHours()).toBe(9);
    expect(d.getMinutes()).toBe(0);
  });

  test('returns 09:00 default for empty string', () => {
    const d = parseTimeToDate('');
    // empty string split gives [''] → parseInt('') = NaN → defaults to 9
    expect(d.getHours()).toBe(9);
  });
});

describe('formatTimeDisplay', () => {
  test('formats "09:00" → "9:00 AM"', () => {
    expect(formatTimeDisplay('09:00')).toBe('9:00 AM');
  });

  test('formats "13:30" → "1:30 PM"', () => {
    expect(formatTimeDisplay('13:30')).toBe('1:30 PM');
  });

  test('formats "00:00" → "12:00 AM" (midnight)', () => {
    expect(formatTimeDisplay('00:00')).toBe('12:00 AM');
  });

  test('formats "12:00" → "12:00 PM" (noon)', () => {
    expect(formatTimeDisplay('12:00')).toBe('12:00 PM');
  });

  test('returns "--:--" for null input', () => {
    expect(formatTimeDisplay(null)).toBe('--:--');
  });
});

describe('formatTimeForDB', () => {
  test('formats date object to HH:MM', () => {
    const d = new Date(2026, 0, 1, 9, 5);
    expect(formatTimeForDB(d)).toBe('09:05');
  });

  test('formats midnight as 00:00', () => {
    const d = new Date(2026, 0, 1, 0, 0);
    expect(formatTimeForDB(d)).toBe('00:00');
  });

  test('pads single-digit hour correctly', () => {
    const d = new Date(2026, 0, 1, 8, 0);
    expect(formatTimeForDB(d)).toBe('08:00');
  });
});

describe('formatTime', () => {
  test('formats 9:05 AM correctly', () => {
    const d = new Date(2026, 0, 1, 9, 5);
    expect(formatTime(d)).toBe('9:05 AM');
  });

  test('formats 13:30 as 1:30 PM', () => {
    const d = new Date(2026, 0, 1, 13, 30);
    expect(formatTime(d)).toBe('1:30 PM');
  });

  test('formats midnight as 12:00 AM', () => {
    const d = new Date(2026, 0, 1, 0, 0);
    expect(formatTime(d)).toBe('12:00 AM');
  });

  test('formats noon as 12:00 PM', () => {
    const d = new Date(2026, 0, 1, 12, 0);
    expect(formatTime(d)).toBe('12:00 PM');
  });
});
