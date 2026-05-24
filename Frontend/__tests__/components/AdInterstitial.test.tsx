import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { AdInterstitial } from '../../src/components/ads/AdInterstitial';
import useEntitlements from '../../src/hooks/useEntitlements';

// Mock useEntitlements
jest.mock('../../src/hooks/useEntitlements', () => ({
  __esModule: true,
  default: jest.fn(),
  useEntitlements: jest.fn(),
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

const mockUseEntitlements = useEntitlements as jest.Mock;

describe('AdInterstitial Component Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('1. Renders nothing when ads are disabled', () => {
    mockUseEntitlements.mockReturnValue({
      capabilities: { ads_enabled: false },
    });

    const { toJSON } = render(<AdInterstitial visible={true} onClose={jest.fn()} />);
    expect(toJSON()).toBeNull();
  });

  test('2. Renders nothing when visible is false', () => {
    mockUseEntitlements.mockReturnValue({
      capabilities: { ads_enabled: true },
    });

    const { toJSON } = render(<AdInterstitial visible={false} onClose={jest.fn()} />);
    expect(toJSON()).toBeNull();
  });

  test('3. Renders full-screen sponsor card when ads are enabled and visible', () => {
    mockUseEntitlements.mockReturnValue({
      capabilities: { ads_enabled: true },
    });

    const { getByText } = render(<AdInterstitial visible={true} onClose={jest.fn()} />);

    expect(getByText('SPONSORED AD')).toBeTruthy();
    expect(getByText(/Lifetime/i)).toBeTruthy();
    expect(getByText(/Close in 3s/i)).toBeTruthy();
  });

  test('4. Countdown tick enables the close button after 3 seconds', () => {
    mockUseEntitlements.mockReturnValue({
      capabilities: { ads_enabled: true },
    });

    const mockClose = jest.fn();
    const { getByText, queryByText } = render(<AdInterstitial visible={true} onClose={mockClose} />);

    // First, verify button has countdown label
    expect(getByText('Close in 3s')).toBeTruthy();

    // Fast-forward timer by 3 seconds
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    // The countdown text should disappear and close trigger should be active
    expect(queryByText('Close in 3s')).toBeNull();
  });
});
