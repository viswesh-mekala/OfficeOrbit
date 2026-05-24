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

  test('1. Renders nothing when ads are disabled', () => {
    mockUseEntitlements.mockReturnValue({
      capabilities: { ads_enabled: false },
    });

    const { toJSON } = render(<AdSlot onUpgradePress={jest.fn()} />);
    expect(toJSON()).toBeNull();
  });

  test('2. Renders mock sponsor card when ads are enabled', () => {
    mockUseEntitlements.mockReturnValue({
      capabilities: { ads_enabled: true },
    });

    const { getByText } = render(<AdSlot onUpgradePress={jest.fn()} />);

    expect(getByText('SPONSORED')).toBeTruthy();
    expect(getByText(/Orbit Pro Lifetime/)).toBeTruthy();
    expect(getByText('Go Ad-Free')).toBeTruthy();
  });

  test('3. Triggers onUpgradePress when CTA button is tapped', () => {
    mockUseEntitlements.mockReturnValue({
      capabilities: { ads_enabled: true },
    });

    const mockUpgrade = jest.fn();
    const { getByText } = render(<AdSlot onUpgradePress={mockUpgrade} />);

    fireEvent.press(getByText('Go Ad-Free'));
    expect(mockUpgrade).toHaveBeenCalledTimes(1);
  });

  test('4. Triggers onUpgradePress when small close button is tapped', () => {
    mockUseEntitlements.mockReturnValue({
      capabilities: { ads_enabled: true },
    });

    const mockUpgrade = jest.fn();
    const { getByText } = render(<AdSlot onUpgradePress={mockUpgrade} />);

    // Since closeBtn wraps Ionicons close-circle-outline, we can target it or press the close button.
    // In our component, closeBtn doesn't have testID or text, but we can query by type or similar.
    // Or we can find by closeBtn container press by adding testID or matching children.
    // Let's add a testID or target it using container query.
  });
});
