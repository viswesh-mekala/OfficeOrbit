import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    KeyboardAvoidingView,
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
                <Ionicons name="planet-outline" size={28} color="#FFF" />
            </LinearGradient>
            <Animated.View style={[logoStyles.orbit, orbitStyle]}>
                <View style={logoStyles.satellite} />
            </Animated.View>
        </View>
    );
};

const logoStyles = StyleSheet.create({
    container: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center' },
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
const StepProgress = ({ current, total }: { current: number; total: number }) => {
    return (
        <View style={progressStyles.container}>
            <View style={progressStyles.bar}>
                {Array.from({ length: total }).map((_, i) => (
                    <View key={i} style={progressStyles.stepWrapper}>
                        <View
                            style={[
                                progressStyles.dot,
                                i <= current ? progressStyles.dotActive : progressStyles.dotInactive,
                            ]}
                        >
                            {i < current && (
                                <Ionicons name="checkmark" size={10} color="#FFF" />
                            )}
                            {i === current && (
                                <View style={progressStyles.dotInner} />
                            )}
                        </View>
                        {i < total - 1 && (
                            <View
                                style={[
                                    progressStyles.line,
                                    i < current ? progressStyles.lineActive : progressStyles.lineInactive,
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
    dotInactive: { backgroundColor: '#E0DEF7', borderWidth: 2, borderColor: '#D0CDE7' },
    dotInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFF' },
    line: { width: 40, height: 2.5, borderRadius: 2 },
    lineActive: { backgroundColor: theme.colors.primary },
    lineInactive: { backgroundColor: '#E0DEF7' },
    label: { marginTop: 10, fontSize: 12, fontWeight: '600', color: '#888', letterSpacing: 0.5 },
});

// ------- WFH Period Picker -------
const WFH_PERIODS = [
    { label: 'Per Week', value: 'week', icon: 'calendar-outline' },
    { label: 'Per Month', value: 'month', icon: 'calendar-number-outline' },
];

// ------- Main Onboarding -------
export const Onboarding: React.FC = () => {
    const { profile, updateProfile, user } = useAuth();
    const [step, setStep] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form state
    const [username, setUsername] = useState(profile?.username || user?.user_metadata?.name || '');
    const [company, setCompany] = useState('');
    const [locationQuery, setLocationQuery] = useState('');
    const [locationResults, setLocationResults] = useState<Location.LocationGeocodedAddress[]>([]);
    const [selectedLocation, setSelectedLocation] = useState<CompanyLocation | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [officeStart, setOfficeStart] = useState(() => {
        const d = new Date(); d.setHours(9, 0, 0, 0); return d;
    });
    const [officeEnd, setOfficeEnd] = useState(() => {
        const d = new Date(); d.setHours(18, 0, 0, 0); return d;
    });
    const [minimumLoginHours, setMinimumLoginHours] = useState('8');
    const [wfhDays, setWfhDays] = useState('0');
    const [wfhPeriod, setWfhPeriod] = useState<'week' | 'month'>('week');
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const locationPermissionGranted = useRef(false);

    // Request location permission once on mount
    useEffect(() => {
        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            locationPermissionGranted.current = status === 'granted';
        })();
    }, []);

    // ---- Location search using expo-location geocoding ----
    const searchLocation = async (query: string) => {
        setLocationQuery(query);
        if (query.length < 3) {
            setLocationResults([]);
            return;
        }

        // Check permission before geocoding
        if (!locationPermissionGranted.current) {
            const { status } = await Location.requestForegroundPermissionsAsync();
            locationPermissionGranted.current = status === 'granted';
            if (!locationPermissionGranted.current) {
                Alert.alert(
                    'Location Permission Required',
                    'Please allow location access to search for your office address.',
                );
                return;
            }
        }

        setIsSearching(true);
        try {
            // Use expo-location's geocodeAsync to convert address to coords
            const coords = await Location.geocodeAsync(query);
            if (coords.length > 0) {
                // Reverse geocode to get nice address strings
                const reverseResults = await Promise.all(
                    coords.slice(0, 5).map(async (coord: Location.LocationGeocodedLocation) => {
                        const addresses = await Location.reverseGeocodeAsync({
                            latitude: coord.latitude,
                            longitude: coord.longitude,
                        });
                        return { ...coord, ...(addresses[0] || {}) };
                    })
                );
                setLocationResults(reverseResults as any);
            } else {
                setLocationResults([]);
            }
        } catch (err) {
            console.error('Geocoding error:', err);
            setLocationResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    const selectLocation = (result: any) => {
        const address = [
            result.name,
            result.street,
            result.city,
            result.region,
            result.country,
        ].filter(Boolean).join(', ');

        setSelectedLocation({
            latitude: result.latitude,
            longitude: result.longitude,
            address: address || locationQuery,
        });
        setLocationQuery(address || locationQuery);
        setLocationResults([]);
        setErrors((prev) => ({ ...prev, location: '' }));
    };

    // ---- Validation ----
    const validateStep = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (step === 1) {
            if (!username.trim()) newErrors.username = 'Name is required';
        }
        if (step === 2) {
            if (!company.trim()) newErrors.company = 'Company name is required';
            if (!selectedLocation) newErrors.location = 'Please search and select your office location';
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
        const loginTimeMinutes = Math.round(parseFloat(minimumLoginHours || '8') * 60);

        const formatTime = (d: Date) => {
            return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
        };

        const { error } = await updateProfile({
            username: username.trim(),
            company: company.trim(),
            company_location: selectedLocation,
            office_window_start: formatTime(officeStart),
            office_window_end: formatTime(officeEnd),
            minimum_login_time_minutes: loginTimeMinutes,
            wfh_days: parseInt(wfhDays || '0'),
            wfh_period: wfhPeriod,
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
        <Animated.View key="welcome" entering={FadeInDown.duration(600).springify()} style={styles.stepContent}>
            <View style={styles.welcomeIllustration}>
                <OrbitLogo />
            </View>
            <Text style={styles.welcomeTitle}>
                Welcome to{'\n'}
                <Text style={{ color: theme.colors.primary }}>OfficeOrbit</Text>
            </Text>
            <Text style={styles.welcomeSubtitle}>
                Tell us a bit about yourself so we can personalize your experience.
            </Text>

            <View style={styles.whatWeNeed}>
                {[
                    { icon: 'person-outline', label: 'Your name', desc: 'How we address you', color: theme.colors.primary },
                    { icon: 'business-outline', label: 'Workplace', desc: 'Company & office location', color: '#FF9800' },
                    { icon: 'time-outline', label: 'Schedule', desc: 'Work hours & WFH days', color: '#4CAF50' },
                ].map((item, i) => (
                    <Animated.View
                        key={item.label}
                        entering={FadeInDown.delay(200 + i * 150).duration(500).springify()}
                        style={styles.whatWeNeedRow}
                    >
                        <View style={[styles.whatWeNeedIcon, { backgroundColor: `${item.color}15` }]}>
                            <Ionicons name={item.icon as any} size={18} color={item.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.whatWeNeedText}>{item.label}</Text>
                            <Text style={styles.whatWeNeedDesc}>{item.desc}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={14} color="#CCC" />
                    </Animated.View>
                ))}
            </View>

            {/* CTA Button inside the card — immediately visible */}
            <Animated.View entering={FadeInDown.delay(700).duration(500).springify()} style={styles.welcomeCTA}>
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
                        <Ionicons name="arrow-forward" size={18} color="#FFF" />
                    </LinearGradient>
                </TouchableOpacity>
                <Text style={styles.welcomeTimeHint}>Takes less than 2 minutes</Text>
            </Animated.View>
        </Animated.View>
    );

    const renderPersonal = () => (
        <Animated.View key="personal" entering={FadeInDown.duration(600).springify()} style={styles.stepContent}>
            <View style={styles.stepIconCircle}>
                <Ionicons name="person-outline" size={28} color={theme.colors.primary} />
            </View>
            <Text style={styles.stepTitle}>What should we call you?</Text>
            <Text style={styles.stepSubtitle}>This is how your name appears in the app</Text>

            <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Full Name <Text style={styles.star}>*</Text></Text>
                <View style={[styles.inputWrapper, errors.username ? styles.inputError : null]}>
                    <Ionicons name="person-outline" size={18} color={errors.username ? '#D32F2F' : '#BBB'} style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        value={username}
                        onChangeText={(t) => { setUsername(t); setErrors((e) => ({ ...e, username: '' })); }}
                        placeholder="e.g. Viswesh Mekala"
                        placeholderTextColor="#CCC"
                        autoFocus
                    />
                </View>
                {errors.username ? <Text style={styles.errorText}>{errors.username}</Text> : null}
            </View>

            <View style={styles.emailDisplay}>
                <Ionicons name="mail-outline" size={16} color="#999" />
                <Text style={styles.emailText}>{user?.email || profile?.email}</Text>
                <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
                    <Text style={styles.verifiedText}>Verified</Text>
                </View>
            </View>
        </Animated.View>
    );

    const renderCompany = () => (
        <Animated.View key="company" entering={FadeInDown.duration(600).springify()} style={styles.stepContent}>
            <View style={[styles.stepIconCircle, { backgroundColor: '#FFF3E0' }]}>
                <Ionicons name="business-outline" size={28} color="#FF9800" />
            </View>
            <Text style={styles.stepTitle}>Where do you work?</Text>
            <Text style={styles.stepSubtitle}>Help us locate your office for attendance tracking</Text>

            <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Company Name <Text style={styles.star}>*</Text></Text>
                <View style={[styles.inputWrapper, errors.company ? styles.inputError : null]}>
                    <Ionicons name="business-outline" size={18} color={errors.company ? '#D32F2F' : '#BBB'} style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        value={company}
                        onChangeText={(t) => { setCompany(t); setErrors((e) => ({ ...e, company: '' })); }}
                        placeholder="e.g. Google, Infosys"
                        placeholderTextColor="#CCC"
                    />
                </View>
                {errors.company ? <Text style={styles.errorText}>{errors.company}</Text> : null}
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Office Location <Text style={styles.star}>*</Text></Text>
                <View style={[styles.inputWrapper, errors.location ? styles.inputError : null]}>
                    <Ionicons name="location-outline" size={18} color={errors.location ? '#D32F2F' : '#BBB'} style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        value={locationQuery}
                        onChangeText={searchLocation}
                        placeholder="Search office address..."
                        placeholderTextColor="#CCC"
                    />
                    {isSearching && <ActivityIndicator size="small" color={theme.colors.primary} />}
                </View>
                {errors.location ? <Text style={styles.errorText}>{errors.location}</Text> : null}

                {/* Location search results */}
                {locationResults.length > 0 && (
                    <View style={styles.locationResults}>
                        {locationResults.map((result: any, idx: number) => {
                            const addr = [result.name, result.street, result.city, result.region, result.country]
                                .filter(Boolean)
                                .join(', ');
                            return (
                                <TouchableOpacity
                                    key={idx}
                                    style={styles.locationResultItem}
                                    onPress={() => selectLocation(result)}
                                >
                                    <Ionicons name="location" size={16} color={theme.colors.primary} />
                                    <Text style={styles.locationResultText} numberOfLines={2}>{addr || 'Unknown location'}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}

                {/* Selected location chip */}
                {selectedLocation && (
                    <Animated.View entering={FadeIn.duration(300)} style={styles.selectedLocation}>
                        <View style={styles.selectedLocationIcon}>
                            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.selectedLocationTitle}>Office pinned</Text>
                            <Text style={styles.selectedLocationAddress} numberOfLines={1}>{selectedLocation.address}</Text>
                            <Text style={styles.selectedLocationCoords}>
                                {selectedLocation.latitude.toFixed(4)}°N, {selectedLocation.longitude.toFixed(4)}°E
                            </Text>
                        </View>
                        <TouchableOpacity onPress={() => { setSelectedLocation(null); setLocationQuery(''); }}>
                            <Ionicons name="close-circle" size={20} color="#CCC" />
                        </TouchableOpacity>
                    </Animated.View>
                )}
            </View>
        </Animated.View>
    );

    const renderSchedule = () => (
        <Animated.View key="schedule" entering={FadeInDown.duration(600).springify()} style={styles.stepContent}>
            <View style={[styles.stepIconCircle, { backgroundColor: '#E8F5E9' }]}>
                <Ionicons name="time-outline" size={28} color="#4CAF50" />
            </View>
            <Text style={styles.stepTitle}>Your work schedule</Text>
            <Text style={styles.stepSubtitle}>Set your office hours and WFH policy</Text>

            {/* Office Hours */}
            <View style={styles.scheduleCard}>
                <Text style={styles.scheduleCardLabel}>
                    <Ionicons name="sunny-outline" size={14} color="#FF9800" /> Office Hours
                </Text>
                <View style={styles.timeRow}>
                    <TouchableOpacity style={styles.timeButton} onPress={() => setShowStartPicker(true)}>
                        <Text style={styles.timeButtonLabel}>Start</Text>
                        <Text style={styles.timeButtonValue}>{formatTime12(officeStart)}</Text>
                    </TouchableOpacity>
                    <View style={styles.timeDash}>
                        <Ionicons name="arrow-forward" size={16} color="#CCC" />
                    </View>
                    <TouchableOpacity style={styles.timeButton} onPress={() => setShowEndPicker(true)}>
                        <Text style={styles.timeButtonLabel}>End</Text>
                        <Text style={styles.timeButtonValue}>{formatTime12(officeEnd)}</Text>
                    </TouchableOpacity>
                </View>
                {showStartPicker && (
                    <DateTimePicker
                        value={officeStart}
                        mode="time"
                        is24Hour={false}
                        onChange={(e, d) => { setShowStartPicker(Platform.OS === 'ios'); if (d) setOfficeStart(d); }}
                    />
                )}
                {showEndPicker && (
                    <DateTimePicker
                        value={officeEnd}
                        mode="time"
                        is24Hour={false}
                        onChange={(e, d) => { setShowEndPicker(Platform.OS === 'ios'); if (d) setOfficeEnd(d); }}
                    />
                )}
            </View>

            {/* Min Login */}
            <View style={styles.scheduleCard}>
                <Text style={styles.scheduleCardLabel}>
                    <Ionicons name="hourglass-outline" size={14} color={theme.colors.primary} /> Minimum Daily Login
                </Text>
                <View style={styles.loginTimeRow}>
                    <TextInput
                        style={styles.loginTimeInput}
                        value={minimumLoginHours}
                        onChangeText={setMinimumLoginHours}
                        keyboardType="numeric"
                        placeholder="8"
                        placeholderTextColor="#CCC"
                    />
                    <Text style={styles.loginTimeUnit}>hours / day</Text>
                </View>
            </View>

            {/* WFH */}
            <View style={styles.scheduleCard}>
                <Text style={styles.scheduleCardLabel}>
                    <Ionicons name="home-outline" size={14} color="#4CAF50" /> Work From Home
                </Text>
                <View style={styles.wfhRow}>
                    <View style={styles.wfhDaysGroup}>
                        <TextInput
                            style={styles.wfhDaysInput}
                            value={wfhDays}
                            onChangeText={setWfhDays}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor="#CCC"
                        />
                        <Text style={styles.wfhDaysSuffix}>days</Text>
                    </View>
                    <View style={styles.periodChipRow}>
                        {WFH_PERIODS.map((opt) => (
                            <TouchableOpacity
                                key={opt.value}
                                style={[
                                    styles.periodChip,
                                    wfhPeriod === opt.value && styles.periodChipActive,
                                ]}
                                onPress={() => setWfhPeriod(opt.value as 'week' | 'month')}
                            >
                                <Ionicons
                                    name={opt.icon as any}
                                    size={14}
                                    color={wfhPeriod === opt.value ? '#FFF' : theme.colors.primary}
                                />
                                <Text style={[
                                    styles.periodChipText,
                                    wfhPeriod === opt.value && styles.periodChipTextActive,
                                ]}>
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
            case 0: return renderWelcome();
            case 1: return renderPersonal();
            case 2: return renderCompany();
            case 3: return renderSchedule();
            default: return null;
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar style="dark" />
            <LinearGradient
                colors={['#F8F7FF', '#F2F0FF', '#EDE9FF']}
                style={StyleSheet.absoluteFill}
            />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Header */}
                    <View style={styles.header}>
                        {step > 0 && (
                            <TouchableOpacity style={styles.backButton} onPress={goBack}>
                                <Ionicons name="chevron-back" size={22} color="#666" />
                            </TouchableOpacity>
                        )}
                        <View style={{ flex: 1 }} />
                        {step > 0 && <StepProgress current={step} total={STEPS.length} />}
                        <View style={{ flex: 1 }} />
                        {step > 0 && <View style={{ width: 36 }} />}
                    </View>

                    {/* Step Content */}
                    <View style={styles.card}>
                        {renderStep()}
                    </View>

                    {/* Action Button (hidden on welcome step — CTA is inside card) */}
                    {step > 0 && (
                        <Animated.View entering={FadeInUp.delay(300).duration(500)} style={styles.actionArea}>
                            {isSubmitting ? (
                                <View style={styles.submittingContainer}>
                                    <ActivityIndicator size="small" color={theme.colors.primary} />
                                    <Text style={styles.submittingText}>Setting up your orbit...</Text>
                                </View>
                            ) : (
                                <Button
                                    title={step === STEPS.length - 1 ? "Launch into Orbit 🚀" : "Continue"}
                                    onPress={goNext}
                                />
                            )}
                        </Animated.View>
                    )}

                    {/* Footer — only on welcome */}
                    {step === 0 && (
                        <Animated.View entering={FadeIn.delay(600).duration(600)} style={styles.footer}>
                            <Ionicons name="shield-checkmark-outline" size={14} color="#BBB" />
                            <Text style={styles.footerText}>Your data is stored securely and never shared</Text>
                        </Animated.View>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { paddingBottom: 40 },

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
    whatWeNeed: { gap: 12 },
    whatWeNeedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#FAFAFA',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 14,
    },
    whatWeNeedIcon: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    whatWeNeedText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#555',
    },
    whatWeNeedDesc: {
        fontSize: 11,
        color: '#AAA',
        marginTop: 2,
    },

    // Welcome CTA
    welcomeCTA: {
        marginTop: 24,
        alignItems: 'center',
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
        alignItems: 'center',
        gap: 10,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F8F8F8',
    },
    locationResultText: { flex: 1, fontSize: 13, color: '#555' },

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
    selectedLocationTitle: { fontSize: 11, fontWeight: '700', color: '#4CAF50', textTransform: 'uppercase', letterSpacing: 0.5 },
    selectedLocationAddress: { fontSize: 13, color: '#333', fontWeight: '500', marginTop: 2 },
    selectedLocationCoords: { fontSize: 10, color: '#999', marginTop: 2, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },

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
    timeButtonLabel: { fontSize: 10, color: '#999', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
    timeButtonValue: { fontSize: 18, fontWeight: '700', color: theme.colors.primary, marginTop: 4 },
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
