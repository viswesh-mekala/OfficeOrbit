import React from 'react';
import { Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { renderRouter, screen } from 'expo-router/testing-library';

// ── Mock screen that reads the deep-link params ───────────────────────────────

const MockDashboardRoute = () => {
  const params = useLocalSearchParams<{
    recovery?: string;
    recoveryAction?: string;
  }>();

  return (
    <Text testID="recovery-output">
      {params.recovery ?? 'none'}:{params.recoveryAction ?? 'none'}
    </Text>
  );
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Expo Router recovery route integration', () => {
  test('parses notification deep-link params on the dashboard route', () => {
    renderRouter(
      { dashboard: MockDashboardRoute },
      { initialUrl: '/dashboard?recovery=1&recoveryAction=checkin' },
    );

    screen.getByText('1:checkin');
  });

  test('renders "none:none" when deep-link params are absent', () => {
    renderRouter(
      { dashboard: MockDashboardRoute },
      { initialUrl: '/dashboard' },
    );

    screen.getByText('none:none');
  });

  test('handles checkout recovery action correctly', () => {
    renderRouter(
      { dashboard: MockDashboardRoute },
      { initialUrl: '/dashboard?recovery=1&recoveryAction=checkout' },
    );

    screen.getByText('1:checkout');
  });
});
