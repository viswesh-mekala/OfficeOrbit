import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { AdSlot } from '../../src/components/ads/AdSlot';
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

describe('AdSlot Component Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('1. Renders nothing when ads are disabled (Pro/Auto — zero pixels)', () => {
    mockUseEntitlements.mockReturnValue({
      capabilities: { ads_enabled: false },
    });

    const { toJSON } = render(<AdSlot onUpgradePress={jest.fn()} />);
    expect(toJSON()).toBeNull();
  });

  test('2. Renders rich card with SPONSORED badge when ads are enabled (dashboard)', () => {
    mockUseEntitlements.mockReturnValue({
      capabilities: { ads_enabled: true },
    });

    const { getByText } = render(<AdSlot onUpgradePress={jest.fn()} screen="dashboard" />);

    expect(getByText('SPONSORED')).toBeTruthy();
    expect(getByText(/Orbit Pro Lifetime/)).toBeTruthy();
    expect(getByText('Go Ad-Free')).toBeTruthy();
  });

  test('3. Renders rich card with SPONSORED badge when ads are enabled (calendar)', () => {
    mockUseEntitlements.mockReturnValue({
      capabilities: { ads_enabled: true },
    });

    const { getByText } = render(<AdSlot onUpgradePress={jest.fn()} screen="calendar" />);

    expect(getByText('SPONSORED')).toBeTruthy();
    expect(getByText(/Orbit Pro Lifetime/)).toBeTruthy();
    expect(getByText('Go Ad-Free')).toBeTruthy();
  });

  test('4. Triggers onUpgradePress when CTA button is tapped', () => {
    mockUseEntitlements.mockReturnValue({
      capabilities: { ads_enabled: true },
    });

    const mockUpgrade = jest.fn();
    const { getByText } = render(<AdSlot onUpgradePress={mockUpgrade} />);

    fireEvent.press(getByText('Go Ad-Free'));
    expect(mockUpgrade).toHaveBeenCalledTimes(1);
  });

  test('5. Does not render anything for Pro user (ads_enabled=false)', () => {
    mockUseEntitlements.mockReturnValue({
      capabilities: { ads_enabled: false },
    });

    const { toJSON } = render(<AdSlot onUpgradePress={jest.fn()} screen="dashboard" />);
    expect(toJSON()).toBeNull();
  });

  test('6. Does not render anything for Auto user (ads_enabled=false)', () => {
    mockUseEntitlements.mockReturnValue({
      capabilities: { ads_enabled: false },
    });

    const { toJSON } = render(<AdSlot onUpgradePress={jest.fn()} screen="calendar" />);
    expect(toJSON()).toBeNull();
  });
});
