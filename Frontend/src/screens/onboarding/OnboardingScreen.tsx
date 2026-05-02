import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Alert,
  ActivityIndicator,
  Dimensions,
  FlatList,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeIn,
  FadeOut,
  SlideInRight,
  SlideOutLeft,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import { theme } from '../../theme/theme';
import { Button } from '../../components/common/Button';
import { useAuth } from '../../store/AuthContext';
import { CompanyLocation } from '../../types/auth.types';
import {
  fetchPlaceDetails,
  isGooglePlacesConfigured,
  PlaceSuggestion,
  searchPlaceSuggestions,
} from '../../services/googlePlaces';

const { width, height } = Dimensions.get('window');

// Step count and labels
const STEPS = [
  { key: 'welcome', title: 'Welcome', icon: 'rocket-outline' },
  { key: 'personal', title: 'About You', icon: 'person-outline' },
  { key: 'company', title: 'Workplace', icon: 'business-outline' },
  { key: 'schedule', title: 'Schedule', icon: 'time-outline' },
];

// ------- Animated Orbit Logo -------
const OrbitLogo = () => {
  const rotation = useSharedValue(0);
  React.useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 8000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const orbitStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View style={logoStyles.container}>
      <LinearGradient
        colors={[theme.colors.primary, theme.colors.secondary]}
        style={logoStyles.core}
      >
        <Ionicons name='planet-outline' size={28} color='#FFF' />
      </LinearGradient>
      <Animated.View style={[logoStyles.orbit, orbitStyle]}>
        <View style={logoStyles.satellite} />
      </Animated.View>
    </View>
  );
};

const logoStyles = StyleSheet.create({
  container: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  core: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 5 },
  },
  orbit: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: `${theme.colors.primary}30`,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  satellite: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.secondary,
    marginTop: -5,
  },
});

// ------- Progress Bar -------
const StepProgress = ({
  current,
  total,
}: {
  current: number;
  total: number;
}) => {
  return (
    <View style={progressStyles.container}>
      <View style={progressStyles.bar}>
        {Array.from({ length: total }).map((_, i) => (
          <View key={i} style={progressStyles.stepWrapper}>
            <View
              style={[
                progressStyles.dot,
                i <= current
                  ? progressStyles.dotActive
                  : progressStyles.dotInactive,
              ]}
            >
              {i < current && (
                <Ionicons name='checkmark' size={10} color='#FFF' />
              )}
              {i === current && <View style={progressStyles.dotInner} />}
            </View>
            {i < total - 1 && (
              <View
                style={[
                  progressStyles.line,
                  i < current
                    ? progressStyles.lineActive
                    : progressStyles.lineInactive,
                ]}
              />
            )}
          </View>
        ))}
      </View>
      <Text style={progressStyles.label}>
        Step {current + 1} of {total} · {STEPS[current].title}
      </Text>
    </View>
  );
};

const progressStyles = StyleSheet.create({
  container: { alignItems: 'center', marginBottom: 20 },
  bar: { flexDirection: 'row', alignItems: 'center' },
  stepWrapper: { flexDirection: 'row', alignItems: 'center' },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotActive: { backgroundColor: theme.colors.primary },
  dotInactive: {
    backgroundColor: '#E0DEF7',
    borderWidth: 2,
    borderColor: '#D0CDE7',
  },
  dotInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFF' },
  line: { width: 40, height: 2.5, borderRadius: 2 },
  lineActive: { backgroundColor: theme.colors.primary },
  lineInactive: { backgroundColor: '#E0DEF7' },
  label: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    letterSpacing: 0.5,
  },
});

// ------- Office Target Period Picker -------
const OFFICE_TARGET_PERIODS = [
  { label: 'Per Week', value: 'week', icon: 'calendar-outline' },
  { label: 'Per Month', value: 'month', icon: 'calendar-number-outline' },
];

// ------- Main Onboarding -------
export const Onboarding: React.FC = () => {
  const { profile, updateProfile, user } = useAuth();
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Keyboard tracking
  const scrollRef = useRef<ScrollView>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const scrollToY = (y: number) => {
    setTimeout(() => scrollRef.current?.scrollTo({ y, animated: true }), 100);
  };

  // Form state
  const [username, setUsername] = useState(
    profile?.username || user?.user_metadata?.name || ''
  );
  const [company, setCompany] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [locationResults, setLocationResults] = useState<PlaceSuggestion[]>([]);
  const [selectedLocation, setSelectedLocation] =
    useState<CompanyLocation | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [officeStart, setOfficeStart] = useState(() => {
    const d = new Date();
    d.setHours(9, 0, 0, 0);
    return d;
  });
  const [officeEnd, setOfficeEnd] = useState(() => {
    const d = new Date();
    d.setHours(18, 0, 0, 0);
    return d;
  });
  const [minimumLoginHours, setMinimumLoginHours] = useState('8');
  const [officeTargetDays, setOfficeTargetDays] = useState('0');
  const [officeTargetPeriod, setOfficeTargetPeriod] = useState<
    'week' | 'month'
  >('week');
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchSequenceRef = useRef(0);
  const placesSessionTokenRef = useRef(`officeorbit-${Date.now()}`);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const searchLocationFallback = async (query: string, requestId: number) => {
    const coords = await Location.geocodeAsync(query);
    const reverseResults = await Promise.all(
      coords
        .slice(0, 5)
        .map(
          async (coord: Location.LocationGeocodedLocation, index: number) => {
            const addresses = await Location.reverseGeocodeAsync({
              latitude: coord.latitude,
              longitude: coord.longitude,
            });
            const firstAddress = addresses[0] || {};
            const fullText = [
              firstAddress.name,
              firstAddress.street,
              firstAddress.city,
              firstAddress.region,
              firstAddress.country,
            ]
              .filter(Boolean)
              .join(', ');

            return {
              id: `fallback-${requestId}-${index}`,
              placeResourceName: '',
              primaryText: firstAddress.name || firstAddress.street || query,
              secondaryText: [
                firstAddress.city,
                firstAddress.region,
                firstAddress.country,
              ]
                .filter(Boolean)
                .join(', '),
              fullText: fullText || query,
              latitude: coord.latitude,
              longitude: coord.longitude,
            };
          }
        )
    );

    if (requestId === searchSequenceRef.current) {
      setLocationResults(reverseResults as PlaceSuggestion[]);
    }
  };

  // ---- Location search using Google Places autocomplete with device geocode fallback ----
  const searchLocation = (query: string) => {
    setLocationQuery(query);
    setSelectedLocation(null);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.trim().length < 3) {
      setLocationResults([]);
      setIsSearching(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      const requestId = searchSequenceRef.current + 1;
      searchSequenceRef.current = requestId;
      setIsSearching(true);

      try {
        if (isGooglePlacesConfigured()) {
          const suggestions = await searchPlaceSuggestions(
            query,
            placesSessionTokenRef.current
          );

          if (requestId === searchSequenceRef.current) {
            setLocationResults(suggestions);
          }
        } else {
          await searchLocationFallback(query, requestId);
        }
      } catch (_err) {
        try {
          await searchLocationFallback(query, requestId);
        } catch (_fallbackErr) {
          if (requestId === searchSequenceRef.current) {
            setLocationResults([]);
          }
        }
      } finally {
        if (requestId === searchSequenceRef.current) {
          setIsSearching(false);
        }
      }
    }, 250);
  };

  const selectLocation = async (
    result: PlaceSuggestion & Partial<CompanyLocation>
  ) => {
    setIsSearching(true);
    try {
      let resolvedLocation: CompanyLocation;

      if (result.placeResourceName) {
        const details = await fetchPlaceDetails(
          result.placeResourceName,
          placesSessionTokenRef.current
        );
        resolvedLocation = {
          latitude: details.latitude,
          longitude: details.longitude,
          address: details.address,
        };
      } else if (
        typeof result.latitude === 'number' &&
        typeof result.longitude === 'number'
      ) {
        resolvedLocation = {
          latitude: result.latitude,
          longitude: result.longitude,
          address: result.fullText || locationQuery,
        };
      } else {
        throw new Error('Unable to resolve location details');
      }

      setSelectedLocation(resolvedLocation);
      setLocationQuery(resolvedLocation.address);
      setLocationResults([]);
      setErrors((prev) => ({ ...prev, location: '' }));
      placesSessionTokenRef.current = `officeorbit-${Date.now()}`;
    } catch (_err) {
      Alert.alert(
        'Location search unavailable',
        'We could not load the full place details for that office. Please try another suggestion.'
      );
    } finally {
      setIsSearching(false);
    }
  };

  // ---- Validation ----
  const validateStep = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!username.trim()) newErrors.username = 'Name is required';
    }
    if (step === 2) {
      if (!company.trim()) newErrors.company = 'Company name is required';
      if (!selectedLocation)
        newErrors.location = 'Please search and select your office location';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ---- Navigation ----
  const goNext = () => {
    if (step === 0) {
      // Welcome step — just go next
      setStep(1);
      return;
    }
    if (!validateStep()) return;
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  const goBack = () => {
    if (step > 0) setStep(step - 1);
  };

  // ---- Submit ----
  const handleSubmit = async () => {
    setIsSubmitting(true);
    const loginTimeMinutes = Math.round(
      parseFloat(minimumLoginHours || '8') * 60
    );

    const formatTime = (d: Date) => {
      return `${d.getHours().toString().padStart(2, '0')}:${d
        .getMinutes()
        .toString()
        .padStart(2, '0')}`;
    };

    const { error } = await updateProfile({
      username: username.trim(),
      company: company.trim(),
      company_location: selectedLocation,
      office_window_start: formatTime(officeStart),
      office_window_end: formatTime(officeEnd),
      minimum_login_time_minutes: loginTimeMinutes,
      office_days_target: parseInt(officeTargetDays || '0'),
      office_target_period: officeTargetPeriod,
    });

    setIsSubmitting(false);

    if (error) {
      Alert.alert('Error', error.message);
    }
    // Auth guard will redirect to dashboard upon successful profile completion
  };

  const formatTime12 = (d: Date) => {
    const h = d.getHours();
    const m = d.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${m < 10 ? '0' + m : m} ${ampm}`;
  };

  // ---- Render Steps ----
  const renderWelcome = () => (
    <Animated.View
      key='welcome'
      entering={FadeInDown.duration(600).springify()}
      style={styles.stepContent}
    >
      <View style={styles.welcomeIllustration}>
        <OrbitLogo />
      </View>
      <Text style={styles.welcomeTitle}>
        Welcome to{'\n'}
        <Text style={{ color: theme.colors.primary }}>OfficeOrbit</Text>
      </Text>
      <Text style={styles.welcomeSubtitle}>
        Set up your workspace preferences in under two minutes.
      </Text>

      <View style={styles.welcomeFlowCard}>
        <View style={styles.welcomeFlowHeader}>
          <Ionicons
            name='sparkles-outline'
            size={16}
            color={theme.colors.primary}
          />
          <Text style={styles.welcomeFlowTitle}>What we will set up</Text>
        </View>
        {[
          {
            icon: 'person-outline',
            label: 'Your name',
            desc: 'How we address you',
            color: theme.colors.primary,
          },
          {
            icon: 'business-outline',
            label: 'Workplace',
            desc: 'Company & office location',
            color: '#FF9800',
          },
          {
            icon: 'time-outline',
            label: 'Schedule',
            desc: 'Work hours & office-day target',
            color: '#4CAF50',
          },
        ].map((item, i) => (
          <Animated.View
            key={item.label}
            entering={FadeInDown.delay(200 + i * 150)
              .duration(500)
              .springify()}
            style={styles.welcomeFlowRow}
          >
            <View
              style={[
                styles.welcomeFlowIconWrap,
                { backgroundColor: `${item.color}14` },
              ]}
            >
              <Ionicons name={item.icon as any} size={16} color={item.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.welcomeFlowRowTitle}>{item.label}</Text>
              <Text style={styles.welcomeFlowRowDesc}>{item.desc}</Text>
            </View>
            <Text style={styles.welcomeFlowStepTag}>Step {i + 1}</Text>
          </Animated.View>
        ))}
      </View>

      {/* CTA Button inside the card — immediately visible */}
      <Animated.View
        entering={FadeInDown.delay(700).duration(500).springify()}
        style={styles.welcomeCTA}
      >
        <TouchableOpacity
          style={styles.welcomeButton}
          onPress={() => setStep(1)}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[theme.colors.primary, theme.colors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.welcomeButtonGradient}
          >
            <Text style={styles.welcomeButtonText}>Let's Get Started</Text>
            <Ionicons name='arrow-forward' size={18} color='#FFF' />
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );

  const renderPersonal = () => (
    <Animated.View
      key='personal'
      entering={FadeInDown.duration(600).springify()}
      style={styles.stepContent}
    >
      <View style={styles.stepIconCircle}>
        <Ionicons
          name='person-outline'
          size={28}
          color={theme.colors.primary}
        />
      </View>
      <Text style={styles.stepTitle}>What should we call you?</Text>
      <Text style={styles.stepSubtitle}>
        This is how your name appears in the app
      </Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>
          Full Name <Text style={styles.star}>*</Text>
        </Text>
        <View
          style={[
            styles.inputWrapper,
            errors.username ? styles.inputError : null,
          ]}
        >
          <Ionicons
            name='person-outline'
            size={18}
            color={errors.username ? '#D32F2F' : '#BBB'}
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={(t) => {
              setUsername(t);
              setErrors((e) => ({ ...e, username: '' }));
            }}
            placeholder='e.g. Viswesh Mekala'
            placeholderTextColor='#CCC'
            autoFocus
            onFocus={() => scrollToY(120)}
            returnKeyType='done'
            onSubmitEditing={() => Keyboard.dismiss()}
          />
        </View>
        {errors.username ? (
          <Text style={styles.errorText}>{errors.username}</Text>
        ) : null}
      </View>

      <View style={styles.emailDisplay}>
        <Ionicons name='mail-outline' size={16} color='#999' />
        <Text style={styles.emailText}>{user?.email || profile?.email}</Text>
        <View style={styles.verifiedBadge}>
          <Ionicons name='checkmark-circle' size={14} color='#4CAF50' />
          <Text style={styles.verifiedText}>Verified</Text>
        </View>
      </View>
    </Animated.View>
  );

  const renderCompany = () => (
    <Animated.View
      key='company'
      entering={FadeInDown.duration(600).springify()}
      style={styles.stepContent}
    >
      <View style={[styles.stepIconCircle, { backgroundColor: '#FFF3E0' }]}>
        <Ionicons name='business-outline' size={28} color='#FF9800' />
      </View>
      <Text style={styles.stepTitle}>Where do you work?</Text>
      <Text style={styles.stepSubtitle}>
        Help us locate your office for attendance tracking
      </Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>
          Company Name <Text style={styles.star}>*</Text>
        </Text>
        <View
          style={[
            styles.inputWrapper,
            errors.company ? styles.inputError : null,
          ]}
        >
          <Ionicons
            name='business-outline'
            size={18}
            color={errors.company ? '#D32F2F' : '#BBB'}
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            value={company}
            onChangeText={(t) => {
              setCompany(t);
              setErrors((e) => ({ ...e, company: '' }));
            }}
            placeholder='e.g. Google, Infosys'
            placeholderTextColor='#CCC'
            onFocus={() => scrollToY(100)}
            returnKeyType='next'
          />
        </View>
        {errors.company ? (
          <Text style={styles.errorText}>{errors.company}</Text>
        ) : null}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>
          Office Location <Text style={styles.star}>*</Text>
        </Text>
        <View
          style={[
            styles.inputWrapper,
            errors.location ? styles.inputError : null,
          ]}
        >
          <Ionicons
            name='location-outline'
            size={18}
            color={errors.location ? '#D32F2F' : '#BBB'}
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            value={locationQuery}
            onChangeText={searchLocation}
            placeholder='Search office address or company campus...'
            placeholderTextColor='#CCC'
            onFocus={() => scrollToY(220)}
            returnKeyType='search'
          />
          {isSearching && (
            <ActivityIndicator size='small' color={theme.colors.primary} />
          )}
        </View>
        {errors.location ? (
          <Text style={styles.errorText}>{errors.location}</Text>
        ) : null}

        {/* Location search results */}
        {locationResults.length > 0 && (
          <View style={styles.locationResults}>
            {locationResults.map((result) => (
              <TouchableOpacity
                key={result.id}
                style={styles.locationResultItem}
                onPress={() =>
                  void selectLocation(
                    result as PlaceSuggestion & Partial<CompanyLocation>
                  )
                }
              >
                <Ionicons
                  name='location'
                  size={16}
                  color={theme.colors.primary}
                />
                <View style={styles.locationResultCopy}>
                  <Text style={styles.locationResultPrimary} numberOfLines={1}>
                    {result.primaryText || 'Unknown location'}
                  </Text>
                  {!!result.secondaryText && (
                    <Text
                      style={styles.locationResultSecondary}
                      numberOfLines={2}
                    >
                      {result.secondaryText}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Selected location chip */}
        {selectedLocation && (
          <Animated.View
            entering={FadeIn.duration(300)}
            style={styles.selectedLocation}
          >
            <View style={styles.selectedLocationIcon}>
              <Ionicons name='checkmark-circle' size={16} color='#4CAF50' />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.selectedLocationTitle}>Office pinned</Text>
              <Text style={styles.selectedLocationAddress} numberOfLines={1}>
                {selectedLocation.address}
              </Text>
              <Text style={styles.selectedLocationCoords}>
                {selectedLocation.latitude.toFixed(4)}°N,{' '}
                {selectedLocation.longitude.toFixed(4)}°E
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setSelectedLocation(null);
                setLocationQuery('');
              }}
            >
              <Ionicons name='close-circle' size={20} color='#CCC' />
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );

  const renderSchedule = () => (
    <Animated.View
      key='schedule'
      entering={FadeInDown.duration(600).springify()}
      style={styles.stepContent}
    >
      <View style={[styles.stepIconCircle, { backgroundColor: '#E8F5E9' }]}>
        <Ionicons name='time-outline' size={28} color='#4CAF50' />
      </View>
      <Text style={styles.stepTitle}>Your work schedule</Text>
      <Text style={styles.stepSubtitle}>
        Set your office hours and office-day target
      </Text>

      {/* Office Hours */}
      <View style={styles.scheduleCard}>
        <Text style={styles.scheduleCardLabel}>
          <Ionicons name='sunny-outline' size={14} color='#FF9800' /> Office
          Hours
        </Text>
        <View style={styles.timeRow}>
          <TouchableOpacity
            style={styles.timeButton}
            onPress={() => setShowStartPicker(true)}
          >
            <Text style={styles.timeButtonLabel}>Start</Text>
            <Text style={styles.timeButtonValue}>
              {formatTime12(officeStart)}
            </Text>
          </TouchableOpacity>
          <View style={styles.timeDash}>
            <Ionicons name='arrow-forward' size={16} color='#CCC' />
          </View>
          <TouchableOpacity
            style={styles.timeButton}
            onPress={() => setShowEndPicker(true)}
          >
            <Text style={styles.timeButtonLabel}>End</Text>
            <Text style={styles.timeButtonValue}>
              {formatTime12(officeEnd)}
            </Text>
          </TouchableOpacity>
        </View>
        {showStartPicker && (
          <DateTimePicker
            value={officeStart}
            mode='time'
            is24Hour={false}
            onChange={(e, d) => {
              setShowStartPicker(Platform.OS === 'ios');
              if (d) setOfficeStart(d);
            }}
          />
        )}
        {showEndPicker && (
          <DateTimePicker
            value={officeEnd}
            mode='time'
            is24Hour={false}
            onChange={(e, d) => {
              setShowEndPicker(Platform.OS === 'ios');
              if (d) setOfficeEnd(d);
            }}
          />
        )}
      </View>

      {/* Min Login */}
      <View style={styles.scheduleCard}>
        <Text style={styles.scheduleCardLabel}>
          <Ionicons
            name='hourglass-outline'
            size={14}
            color={theme.colors.primary}
          />{' '}
          Minimum Daily Login
        </Text>
        <View style={styles.loginTimeRow}>
          <TextInput
            style={styles.loginTimeInput}
            value={minimumLoginHours}
            onChangeText={setMinimumLoginHours}
            keyboardType='numeric'
            placeholder='8'
            placeholderTextColor='#CCC'
            onFocus={() => scrollToY(200)}
            returnKeyType='done'
            onSubmitEditing={() => Keyboard.dismiss()}
          />
          <Text style={styles.loginTimeUnit}>hours / day</Text>
        </View>
      </View>

      {/* Office Day Target */}
      <View style={styles.scheduleCard}>
        <Text style={styles.scheduleCardLabel}>
          <Ionicons
            name='business-outline'
            size={14}
            color={theme.colors.primary}
          />{' '}
          Office Days Target
        </Text>
        <View style={styles.wfhRow}>
          <View style={styles.wfhDaysGroup}>
            <TextInput
              style={styles.wfhDaysInput}
              value={officeTargetDays}
              onChangeText={setOfficeTargetDays}
              keyboardType='numeric'
              placeholder='e.g. 3'
              placeholderTextColor='#CCC'
              onFocus={() => {
                if (officeTargetDays === '0') setOfficeTargetDays('');
                scrollToY(320);
              }}
              onBlur={() => {
                if (!officeTargetDays.trim()) setOfficeTargetDays('0');
              }}
              returnKeyType='done'
              onSubmitEditing={() => Keyboard.dismiss()}
            />
            <Text style={styles.wfhDaysSuffix}>days</Text>
          </View>
          <View style={styles.periodChipRow}>
            {OFFICE_TARGET_PERIODS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.periodChip,
                  officeTargetPeriod === opt.value && styles.periodChipActive,
                ]}
                onPress={() =>
                  setOfficeTargetPeriod(opt.value as 'week' | 'month')
                }
              >
                <Ionicons
                  name={opt.icon as any}
                  size={14}
                  color={
                    officeTargetPeriod === opt.value
                      ? '#FFF'
                      : theme.colors.primary
                  }
                />
                <Text
                  style={[
                    styles.periodChipText,
                    officeTargetPeriod === opt.value &&
                      styles.periodChipTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Animated.View>
  );

  const renderStep = () => {
    switch (step) {
      case 0:
        return renderWelcome();
      case 1:
        return renderPersonal();
      case 2:
        return renderCompany();
      case 3:
        return renderSchedule();
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style='dark' />
      <LinearGradient
        colors={['#F8F7FF', '#F2F0FF', '#EDE9FF']}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView
        behavior='padding'
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        style={{ flex: 1 }}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: keyboardHeight > 0 ? 20 : 40 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps='handled'
          scrollEventThrottle={16}
        >
          {/* Header */}
          <View style={styles.header}>
            {step > 0 && (
              <TouchableOpacity style={styles.backButton} onPress={goBack}>
                <Ionicons name='chevron-back' size={22} color='#666' />
              </TouchableOpacity>
            )}
            <View style={{ flex: 1 }} />
            {step > 0 && <StepProgress current={step} total={STEPS.length} />}
            <View style={{ flex: 1 }} />
            {step > 0 && <View style={{ width: 36 }} />}
          </View>

          {/* Step Content */}
          <View style={styles.card}>{renderStep()}</View>

          {/* Action Button (hidden on welcome step — CTA is inside card) */}
          {step > 0 && (
            <Animated.View
              entering={FadeInUp.delay(300).duration(500)}
              style={styles.actionArea}
            >
              {isSubmitting ? (
                <View style={styles.submittingContainer}>
                  <ActivityIndicator
                    size='small'
                    color={theme.colors.primary}
                  />
                  <Text style={styles.submittingText}>
                    Setting up your orbit...
                  </Text>
                </View>
              ) : (
                <Button
                  title={
                    step === STEPS.length - 1
                      ? 'Launch into Orbit 🚀'
                      : 'Continue'
                  }
                  onPress={goNext}
                />
              )}
            </Animated.View>
          )}

          {/* Footer — only on welcome */}
          {step === 0 && (
            <Animated.View
              entering={FadeIn.delay(600).duration(600)}
              style={styles.footer}
            >
              <Ionicons
                name='shield-checkmark-outline'
                size={14}
                color='#BBB'
              />
              <Text style={styles.footerText}>
                Your data is stored securely and never shared
              </Text>
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 8,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  // Card
  card: {
    marginHorizontal: 20,
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
    minHeight: 380,
  },

  // Step content
  stepContent: { flex: 1 },

  // Welcome
  welcomeIllustration: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 20,
  },
  welcomeTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1A1A1A',
    textAlign: 'center',
    lineHeight: 34,
    marginBottom: 12,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
    paddingHorizontal: 10,
  },
  welcomeFlowCard: {
    gap: 10,
    backgroundColor: '#FAFAFF',
    borderWidth: 1,
    borderColor: '#E8E5FC',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  welcomeFlowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  welcomeFlowTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#5850A8',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  welcomeFlowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
  },
  welcomeFlowIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeFlowRowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  welcomeFlowRowDesc: {
    fontSize: 11,
    color: '#8A8FA3',
    marginTop: 2,
  },
  welcomeFlowStepTag: {
    fontSize: 10,
    color: '#6F73A2',
    backgroundColor: '#EEF0FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
    fontWeight: '700',
  },
  welcomeFlowHint: {
    marginTop: 4,
    fontSize: 11,
    color: '#858AA0',
  },

  // Welcome CTA
  welcomeCTA: {
    marginTop: 24,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E9E7F8',
    padding: 14,
  },
  welcomeButton: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  welcomeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  welcomeButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  welcomeTimeHint: {
    fontSize: 11,
    color: '#BBB',
    marginTop: 10,
  },

  // Step common
  stepIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: `${theme.colors.primary}10`,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    marginBottom: 28,
  },

  // Input fields
  inputGroup: { marginBottom: 16 },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  star: { color: '#D32F2F' },
  inputWrapper: {
    backgroundColor: '#FAFAFA',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#F0F0F0',
    paddingHorizontal: 14,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputError: { borderColor: '#FFCDD2', backgroundColor: '#FFF8F8' },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    height: '100%',
  },
  errorText: {
    color: '#D32F2F',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 4,
    marginLeft: 4,
  },

  // Email display
  emailDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8F8F8',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  emailText: { flex: 1, fontSize: 13, color: '#888' },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  verifiedText: { fontSize: 11, color: '#4CAF50', fontWeight: '600' },

  // Location results
  locationResults: {
    marginTop: 8,
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    overflow: 'hidden',
  },
  locationResultItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F8F8',
  },
  locationResultCopy: { flex: 1 },
  locationResultPrimary: { fontSize: 13, color: '#333', fontWeight: '600' },
  locationResultSecondary: {
    fontSize: 12,
    color: '#777',
    marginTop: 3,
    lineHeight: 17,
  },

  // Selected location
  selectedLocation: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F0FFF4',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  selectedLocationIcon: { marginRight: -4 },
  selectedLocationTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4CAF50',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  selectedLocationAddress: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
    marginTop: 2,
  },
  selectedLocationCoords: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  // Schedule cards
  scheduleCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  scheduleCardLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#777',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeButton: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  timeButtonLabel: {
    fontSize: 10,
    color: '#999',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeButtonValue: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.primary,
    marginTop: 4,
  },
  timeDash: { paddingHorizontal: 4 },

  // Min login
  loginTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loginTimeInput: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    width: 60,
    height: 44,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  loginTimeUnit: { fontSize: 13, color: '#999', fontWeight: '500' },

  // WFH
  wfhRow: { gap: 12 },
  wfhDaysGroup: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wfhDaysInput: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    width: 60,
    height: 44,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: '#4CAF50',
  },
  wfhDaysSuffix: { fontSize: 13, color: '#999', fontWeight: '500' },
  periodChipRow: { flexDirection: 'row', gap: 10 },
  periodChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    backgroundColor: '#FFF',
  },
  periodChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  periodChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  periodChipTextActive: { color: '#FFF' },

  // Action Area
  actionArea: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  submittingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  submittingText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 24,
  },
  footerText: { fontSize: 11, color: '#BBB' },
});
