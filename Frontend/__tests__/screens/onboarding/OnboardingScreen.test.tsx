import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Onboarding } from '../../../src/screens/onboarding/OnboardingScreen';
import * as Location from 'expo-location';
import { Alert } from 'react-native';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('expo-router', () => ({
  router: {
    replace: jest.fn(),
  },
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'denied' })),
  getBackgroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'denied' })),
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  requestBackgroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  geocodeAsync: jest.fn(() => Promise.resolve([{ latitude: 12.97, longitude: 77.59 }])),
  reverseGeocodeAsync: jest.fn(() => Promise.resolve([{ name: 'Mock Office', city: 'Bangalore' }])),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../../src/store/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    user: { id: '123', email: 'test@officeorbit.com' },
    profile: {
      username: '',
      company: '',
      company_location: null,
    },
    updateProfile: jest.fn(() => Promise.resolve({ error: null })),
  })),
}));

jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');

jest.spyOn(Alert, 'alert');

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('OnboardingScreen Permissions Step Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('1. Onboarding renders welcome step correctly', async () => {
    const { getByText } = render(<Onboarding />);
    await act(async () => {});

    expect(getByText('Welcome to')).toBeTruthy();
    expect(getByText("Let's Get Started")).toBeTruthy();
  });

  test('2. Dynamic Action Button Title transitions correctly based on Location Permissions', async () => {
    const { getByText, queryByText, getByPlaceholderText } = render(<Onboarding />);
    await act(async () => {});

    // Step 0 -> Step 1 (Personal Info)
    fireEvent.press(getByText("Let's Get Started"));
    await act(async () => {});
    expect(getByText('What should we call you?')).toBeTruthy();

    // Fill personal info and press Continue
    const nameInput = getByPlaceholderText('e.g. Viswesh Mekala');
    fireEvent.changeText(nameInput, 'Viswesh Mekala');
    fireEvent.press(getByText('Continue'));
    await act(async () => {});

    // Step 2 (Workplace)
    expect(getByText('Where do you work?')).toBeTruthy();
    const companyInput = getByPlaceholderText('e.g. Google, Infosys');
    fireEvent.changeText(companyInput, 'MNC Google');
    
    // Select location fallback from mock suggestions
    const locationInput = getByPlaceholderText('Search office address or company campus...');
    fireEvent.changeText(locationInput, 'Google Campus');
    await act(async () => {});

    // Mock searchSuggestions results
    await waitFor(() => expect(getByText('Office pinned')).toBeTruthy());
    fireEvent.press(getByText('Continue'));
    await act(async () => {});

    // Step 3 (Schedule)
    expect(getByText('Your work schedule')).toBeTruthy();
    fireEvent.press(getByText('Continue'));
    await act(async () => {});

    // Step 4 (Permissions / Device Setup)
    expect(getByText('Device Configuration')).toBeTruthy();
    expect(getByText('Setup Required')).toBeTruthy();
    
    // Verify dynamic button label is "Authorize Location Access"
    expect(getByText('Authorize Location Access')).toBeTruthy();

    // Mock permissions turning into granted
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'granted' });
    (Location.getBackgroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'granted' });

    // Call validation/refresh
    fireEvent.press(getByText('Authorize Location Access'));
    await act(async () => {});

    // Verify step check-in resolves permission state changes
    await waitFor(() => {
      expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
    });
  });
});
