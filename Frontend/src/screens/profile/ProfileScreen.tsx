import React, { useState, useEffect, useRef } from 'react';
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
    Keyboard,
    Modal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import { theme } from '../../theme/theme';
import { Button } from '../../components/common/Button';
import { useAuth } from '../../store/AuthContext';
import { useToast } from '../../components/common/Toast';
import { CompanyLocation } from '../../types/auth.types';
import useEntitlements from '../../hooks/useEntitlements';
import { PaywallModal } from '../../components/billing/PaywallModal';
import { parseTimeToDate, formatTimeDisplay, formatTimeForDB, formatTime } from '../../utils/time';
import {
    fetchPlaceDetails,
    isGooglePlacesConfigured,
    PlaceSuggestion,
    searchPlaceSuggestions,
} from '../../services/googlePlaces';

const { width } = Dimensions.get('window');

/* ─────────── Avatar ─────────── */
const ProfileAvatar = ({ name, size = 88 }: { name: string; size?: number }) => {
    const initials = name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    return (
        <View style={[styles.avatarOuter, { width: size + 8, height: size + 8, borderRadius: (size + 8) / 2 }]}>
            <LinearGradient
                colors={['#fff', '#F0EEFF']}
                style={[styles.avatarRing, { width: size + 8, height: size + 8, borderRadius: (size + 8) / 2 }]}
            >
                <View style={[styles.avatarInner, { width: size, height: size, borderRadius: size / 2 }]}>
                    <LinearGradient
                        colors={[theme.colors.primary, '#8B7FFF', theme.colors.secondary]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.avatarGradient, { borderRadius: size / 2 }]}
                    >
                        <Text style={[styles.avatarText, { fontSize: size * 0.32 }]}>{initials || '?'}</Text>
                    </LinearGradient>
                </View>
            </LinearGradient>
        </View>
    );
};

/* ─────────── Stat Chip (for header) ─────────── */
const StatChip = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
    <View style={styles.statChip}>
        <Ionicons name={icon as any} size={14} color={theme.colors.primary} />
        <View>
            <Text style={styles.statChipValue}>{value}</Text>
            <Text style={styles.statChipLabel}>{label}</Text>
        </View>
    </View>
);

/* ─────────── Info Row ─────────── */
const InfoRow = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
    <View style={styles.infoRow}>
        <View style={styles.infoRowLeft}>
            <View style={styles.infoRowIconBg}>
                <Ionicons name={icon as any} size={14} color={theme.colors.primary} />
            </View>
            <Text style={styles.infoLabel}>{label}</Text>
        </View>
        <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
    </View>
);

/* ─────────── Section Card ─────────── */
const SectionCard = ({
    title,
    icon,
    iconColor = theme.colors.primary,
    children,
    delay = 0,
}: {
    title: string;
    icon: string;
    iconColor?: string;
    children: React.ReactNode;
    delay?: number;
}) => (
    <Animated.View entering={FadeInDown.delay(delay).duration(500).springify()} style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconBg, { backgroundColor: `${iconColor}12` }]}>
                <Ionicons name={icon as any} size={16} color={iconColor} />
            </View>
            <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        <View style={styles.sectionBody}>{children}</View>
    </Animated.View>
);

/* ─────────── Office Target Period Options ─────────── */
const OFFICE_TARGET_PERIODS = [
    { label: 'Per Week', value: 'week' },
    { label: 'Per Month', value: 'month' },
];

/* ═══════════════════════════════════════════════════════
   PROFILE PAGE
   ═══════════════════════════════════════════════════════ */
export const Profile: React.FC = () => {
    const { profile, user, updateProfile, signOut } = useAuth();
    const { planCode } = useEntitlements();
    const { showToast } = useToast();
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const [paywallVisible, setPaywallVisible] = useState(false);
    const scrollRef = useRef<ScrollView>(null);
    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const searchSequenceRef = useRef(0);
    const placesSessionTokenRef = useRef(`officeorbit-profile-${Date.now()}`);

    // Edit form state
    const [username, setUsername] = useState('');
    const [company, setCompany] = useState('');
    const [companyLocation, setCompanyLocation] = useState('');
    const [selectedLocation, setSelectedLocation] = useState<CompanyLocation | null>(null);
    const [locationResults, setLocationResults] = useState<PlaceSuggestion[]>([]);
    const [isSearchingLocation, setIsSearchingLocation] = useState(false);
    const [officeStart, setOfficeStart] = useState(new Date());
    const [officeEnd, setOfficeEnd] = useState(new Date());
    const [minimumLoginTime, setMinimumLoginTime] = useState('');
    const [officeTargetDays, setOfficeTargetDays] = useState('');
    const [officeTargetPeriod, setOfficeTargetPeriod] = useState<'week' | 'month'>('week');
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    // Initialize form from profile
    useEffect(() => {
        if (profile) {
            setUsername(profile.username || '');
            setCompany(profile.company || '');
            setCompanyLocation(profile.company_location?.address || '');
            setSelectedLocation(profile.company_location || null);
            setLocationResults([]);
            setOfficeStart(parseTimeToDate(profile.office_window_start));
            setOfficeEnd(parseTimeToDate(profile.office_window_end));
            setMinimumLoginTime(
                profile.minimum_login_time_minutes
                    ? String(Math.round(profile.minimum_login_time_minutes / 60))
                    : '8'
            );
            setOfficeTargetDays(
                profile.office_days_target != null
                    ? String(profile.office_days_target)
                    : (profile.wfh_days != null ? String(profile.wfh_days) : '0')
            );
            setOfficeTargetPeriod(profile.office_target_period || profile.wfh_period || 'week');
        }
    }, [profile]);

    useEffect(() => {
        const showSub = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
            (event) => setKeyboardHeight(event.endCoordinates.height),
        );
        const hideSub = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
            () => setKeyboardHeight(0),
        );

        return () => {
            showSub.remove();
            hideSub.remove();
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, []);

    const scrollToY = (y: number) => {
        setTimeout(() => scrollRef.current?.scrollTo({ y, animated: true }), 120);
    };

    const handleEdit = () => setIsEditing(true);

    const handleCancel = () => {
        if (profile) {
            setUsername(profile.username || '');
            setCompany(profile.company || '');
            setCompanyLocation(profile.company_location?.address || '');
            setSelectedLocation(profile.company_location || null);
            setLocationResults([]);
            setOfficeStart(parseTimeToDate(profile.office_window_start));
            setOfficeEnd(parseTimeToDate(profile.office_window_end));
            setMinimumLoginTime(
                profile.minimum_login_time_minutes
                    ? String(Math.round(profile.minimum_login_time_minutes / 60))
                    : '8'
            );
            setOfficeTargetDays(
                profile.office_days_target != null
                    ? String(profile.office_days_target)
                    : (profile.wfh_days != null ? String(profile.wfh_days) : '0')
            );
            setOfficeTargetPeriod(profile.office_target_period || profile.wfh_period || 'week');
        }
        setIsEditing(false);
    };

    const searchLocationFallback = async (query: string, requestId: number) => {
        const coords = await Location.geocodeAsync(query);
        const reverseResults = await Promise.all(
            coords.slice(0, 5).map(async (coord: Location.LocationGeocodedLocation, index: number) => {
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
                    id: `profile-fallback-${requestId}-${index}`,
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
            }),
        );

        if (requestId === searchSequenceRef.current) {
            setLocationResults(reverseResults as PlaceSuggestion[]);
        }
    };

    const handleLocationSearch = (query: string) => {
        setCompanyLocation(query);
        setSelectedLocation(null);

        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        if (query.trim().length < 3) {
            setLocationResults([]);
            setIsSearchingLocation(false);
            return;
        }

        searchTimeoutRef.current = setTimeout(async () => {
            const requestId = searchSequenceRef.current + 1;
            searchSequenceRef.current = requestId;
            setIsSearchingLocation(true);

            try {
                if (isGooglePlacesConfigured()) {
                    const suggestions = await searchPlaceSuggestions(
                        query,
                        placesSessionTokenRef.current,
                    );

                    if (requestId === searchSequenceRef.current) {
                        setLocationResults(suggestions);
                    }
                } else {
                    await searchLocationFallback(query, requestId);
                }
            } catch (_error) {
                try {
                    await searchLocationFallback(query, requestId);
                } catch (_fallbackError) {
                    if (requestId === searchSequenceRef.current) {
                        setLocationResults([]);
                    }
                }
            } finally {
                if (requestId === searchSequenceRef.current) {
                    setIsSearchingLocation(false);
                }
            }
        }, 250);
    };

    const handleLocationSelect = async (result: PlaceSuggestion & Partial<CompanyLocation>) => {
        setIsSearchingLocation(true);

        try {
            let resolvedLocation: CompanyLocation;

            if (result.placeResourceName) {
                const details = await fetchPlaceDetails(
                    result.placeResourceName,
                    placesSessionTokenRef.current,
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
                    address: result.fullText || companyLocation,
                };
            } else {
                throw new Error('Unable to resolve selected location');
            }

            setSelectedLocation(resolvedLocation);
            setCompanyLocation(resolvedLocation.address);
            setLocationResults([]);
            placesSessionTokenRef.current = `officeorbit-profile-${Date.now()}`;
            Keyboard.dismiss();
        } catch (_error) {
            showToast({
                title: 'Location unavailable',
                message: 'Could not load that location. Try another suggestion.',
                variant: 'error',
            });
        } finally {
            setIsSearchingLocation(false);
        }
    };

    const handleSave = async () => {
        if (!username.trim() || !company.trim() || !companyLocation.trim()) {
            showToast({ title: 'Required fields', message: 'Please fill in all required fields.', variant: 'warning' });
            return;
        }

        if (!selectedLocation) {
            showToast({ title: 'Select location', message: 'Choose your office from the suggestions.', variant: 'warning' });
            return;
        }

        setIsSaving(true);
        const loginTimeMinutes = Math.round(parseFloat(minimumLoginTime || '8') * 60);

        const { error } = await updateProfile({
            username: username.trim(),
            company: company.trim(),
            company_location: selectedLocation,
            office_window_start: formatTimeForDB(officeStart),
            office_window_end: formatTimeForDB(officeEnd),
            minimum_login_time_minutes: loginTimeMinutes,
            office_days_target: parseInt(officeTargetDays || '0'),
            office_target_period: officeTargetPeriod,
        });

        setIsSaving(false);

        if (error) {
            showToast({ title: 'Save failed', message: error.message, variant: 'error' });
        } else {
            showToast({ title: 'Profile saved', message: 'Changes saved successfully.', variant: 'success' });
            setIsEditing(false);
        }
    };

    const handleLogout = () => {
        setShowLogoutModal(true);
    };

    const confirmLogout = async () => {
        setShowLogoutModal(false);
        await signOut();
    };

    if (!profile) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
        );
    }

    const memberSince = new Date(profile.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });

    return (
        <>
        <View style={styles.container}>
            <StatusBar style="light" />
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <ScrollView
                    ref={scrollRef}
                    contentContainerStyle={[
                        styles.scrollContent,
                        { paddingBottom: keyboardHeight > 0 ? 20 : 40 },
                    ]}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* ── Gradient Banner + Avatar ── */}
                    <Animated.View entering={FadeIn.duration(600)}>
                        <LinearGradient
                            colors={[theme.colors.primary, '#7B6FFF', '#9B8FFF']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.bannerGradient}
                        >
                            {/* Subtle pattern overlay */}
                            <View style={styles.bannerOverlay} />
                            
                            {/* Action button top-right */}
                            {!isEditing ? (
                                <TouchableOpacity style={styles.editBtnFloat} onPress={handleEdit}>
                                    <Ionicons name="create-outline" size={18} color="#FFF" />
                                    <Text style={styles.editBtnLabel}>Edit Profile</Text>
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity style={styles.editBtnFloat} onPress={handleCancel}>
                                    <Ionicons name="close" size={18} color="#FFF" />
                                    <Text style={styles.editBtnLabel}>Cancel</Text>
                                </TouchableOpacity>
                            )}
                        </LinearGradient>

                        {/* Avatar floating over banner-card boundary */}
                        <View style={styles.avatarContainer}>
                            <ProfileAvatar name={profile.username || ''} size={88} />
                        </View>

                        {/* Identity card */}
                        <View style={styles.identityCard}>
                            <View style={{ height: 52 }} />
                            <Text style={styles.profileName}>{profile.username}</Text>
                            <View style={styles.emailChip}>
                                <Ionicons name="mail-outline" size={12} color="#888" />
                                <Text style={styles.emailText}>{user?.email || profile.email}</Text>
                            </View>
                            {profile.company && (
                                <View style={styles.companyChip}>
                                    <Ionicons name="business" size={12} color={theme.colors.primary} />
                                    <Text style={styles.companyChipText}>{profile.company}</Text>
                                </View>
                            )}

                            {/* Quick stats row */}
                            <View style={styles.statsRow}>
                                <StatChip
                                    icon="calendar-outline"
                                    label="Member"
                                    value={memberSince}
                                />
                                <View style={styles.statDivider} />
                                <StatChip
                                    icon="home-outline"
                                    label="Office Target"
                                    value={`${profile.office_days_target ?? profile.wfh_days ?? 0} days/${(profile.office_target_period || profile.wfh_period) === 'month' ? 'mo' : 'wk'}`}
                                />
                            </View>
                        </View>
                    </Animated.View>

                    {/* ── VIEW MODE ── */}
                    {!isEditing ? (
                        <View style={styles.cardsContainer}>
                            {/* ── Glowing Digital Member Card ── */}
                            <Animated.View 
                                entering={FadeInDown.delay(50).duration(500).springify()}
                                style={[
                                    styles.premiumMemberCard,
                                    planCode === 'pro_lifetime' && styles.memberCardPro,
                                    planCode === 'auto_lifetime' && styles.memberCardAuto
                                ]}
                            >
                                <LinearGradient
                                    colors={
                                        planCode === 'auto_lifetime'
                                            ? ['#251A1B', '#1D1213', '#2B191B']
                                            : planCode === 'pro_lifetime'
                                            ? ['#121B2D', '#0B111F', '#192842']
                                            : ['#1A1D24', '#111318', '#252932']
                                    }
                                    style={styles.memberCardGradient}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                >
                                    <View style={styles.cardHeaderRow}>
                                        <View style={styles.cardBadge}>
                                            <Ionicons 
                                                name={planCode === 'auto_lifetime' ? 'rocket' : planCode === 'pro_lifetime' ? 'star' : 'planet'} 
                                                size={14} 
                                                color={planCode === 'auto_lifetime' ? '#FF5252' : planCode === 'pro_lifetime' ? '#7B6FFF' : '#4CAF50'} 
                                            />
                                            <Text style={[
                                                styles.cardBadgeText,
                                                { color: planCode === 'auto_lifetime' ? '#FF5252' : planCode === 'pro_lifetime' ? '#7B6FFF' : '#4CAF50' }
                                            ]}>
                                                {planCode === 'auto_lifetime' ? 'AUTO LIFETIME' : planCode === 'pro_lifetime' ? 'PRO LIFETIME' : 'SMART FREE'}
                                            </Text>
                                        </View>
                                        <Text style={styles.cardBrand}>OfficeOrbit</Text>
                                    </View>

                                    <View style={styles.cardContent}>
                                        <Text style={styles.cardName}>{profile.username.toUpperCase()}</Text>
                                        <Text style={styles.cardPlanSub}>
                                            {planCode === 'free' 
                                                ? 'Basic Manual Tracking Account' 
                                                : 'Lifetime Premium Entitlement'}
                                        </Text>
                                    </View>

                                    <View style={styles.cardFooter}>
                                        <Text style={styles.cardSerial}>ID: {profile.id.slice(0, 18).toUpperCase()}</Text>
                                        {planCode === 'free' ? (
                                            <TouchableOpacity 
                                                onPress={() => setPaywallVisible(true)} 
                                                style={styles.cardUpgradeBtn}
                                            >
                                                <Text style={styles.cardUpgradeText}>UPGRADE</Text>
                                                <Ionicons name="arrow-forward" size={10} color="#000" />
                                            </TouchableOpacity>
                                        ) : (
                                            <View style={styles.activePill}>
                                                <Text style={styles.activePillText}>LIFETIME PASS</Text>
                                            </View>
                                        )}
                                    </View>
                                </LinearGradient>
                            </Animated.View>

                            <SectionCard title="Company" icon="business-outline" iconColor={theme.colors.primary} delay={100}>
                                <InfoRow icon="briefcase-outline" label="Company" value={profile.company || 'Not set'} />
                                <InfoRow icon="location-outline" label="Location" value={profile.company_location?.address || 'Not set'} />
                            </SectionCard>

                            <SectionCard title="Office Schedule" icon="time-outline" iconColor="#FF9800" delay={200}>
                                <InfoRow icon="sunny-outline" label="Start" value={formatTimeDisplay(profile.office_window_start)} />
                                <InfoRow icon="moon-outline" label="End" value={formatTimeDisplay(profile.office_window_end)} />
                                <InfoRow
                                    icon="hourglass-outline"
                                    label="Min Login"
                                    value={
                                        profile.minimum_login_time_minutes
                                            ? `${Math.round(profile.minimum_login_time_minutes / 60)} hours`
                                            : 'Not set'
                                    }
                                />
                            </SectionCard>

                            <SectionCard title="Office Days Target" icon="business-outline" iconColor={theme.colors.primary} delay={300}>
                                <InfoRow icon="calendar-outline" label="Office Days" value={profile.office_days_target != null ? String(profile.office_days_target) : (profile.wfh_days != null ? String(profile.wfh_days) : '0')} />
                                <InfoRow icon="repeat-outline" label="Period" value={(profile.office_target_period || profile.wfh_period) === 'month' ? 'Per Month' : 'Per Week'} />
                            </SectionCard>

                            <SectionCard title="Subscription Settings" icon="settings-outline" iconColor="#555" delay={350}>
                                <TouchableOpacity 
                                    onPress={() => {
                                        if (planCode === 'free') {
                                            setPaywallVisible(true);
                                        } else {
                                            Alert.alert(
                                                'Premium Activated ✨', 
                                                `Your account is provisioned with ${planCode === 'pro_lifetime' ? 'Pro Lifetime' : 'Auto Lifetime'} access.`
                                            );
                                        }
                                    }}
                                    style={styles.settingsRowClickable}
                                >
                                    <View style={styles.infoRowLeft}>
                                        <View style={styles.infoRowIconBg}>
                                            <Ionicons name="card-outline" size={14} color="#777" />
                                        </View>
                                        <Text style={styles.infoLabel}>Subscription Tier</Text>
                                    </View>
                                    <View style={styles.settingsBadgeRow}>
                                        <View style={[
                                            styles.settingsPlanBadge,
                                            planCode === 'auto_lifetime' && styles.badgeAuto,
                                            planCode === 'pro_lifetime' && styles.badgePro,
                                        ]}>
                                            <Text style={[
                                                styles.settingsPlanBadgeText,
                                                planCode === 'auto_lifetime' && styles.badgeTextAuto,
                                                planCode === 'pro_lifetime' && styles.badgeTextPro,
                                            ]}>
                                                {planCode === 'auto_lifetime' ? 'Auto Lifetime 🚀' : planCode === 'pro_lifetime' ? 'Pro Lifetime 👑' : 'Free Plan'}
                                            </Text>
                                        </View>
                                        {planCode === 'free' && (
                                            <Ionicons name="chevron-forward" size={16} color="#BBB" />
                                        )}
                                    </View>
                                </TouchableOpacity>
                            </SectionCard>
                        </View>
                    ) : (
                        /* ── EDIT MODE ── */
                        <Animated.View entering={FadeInDown.duration(400)} style={styles.editCard}>
                            {/* Personal */}
                            <View style={styles.editSection}>
                                <View style={styles.editSectionHeader}>
                                    <View style={[styles.editSectionDot, { backgroundColor: theme.colors.primary }]} />
                                    <Text style={styles.editSectionTitle}>Personal Info</Text>
                                </View>
                                <View style={styles.editFieldGroup}>
                                    <Text style={styles.editFieldLabel}>
                                        Username <Text style={styles.mandatoryStar}>*</Text>
                                    </Text>
                                    <View style={styles.editInputWrapper}>
                                        <Ionicons name="person-outline" size={16} color="#AAA" style={styles.editInputIcon} />
                                        <TextInput
                                            style={styles.editInput}
                                            value={username}
                                            onChangeText={setUsername}
                                            placeholder="Your name"
                                            placeholderTextColor="#CCC"
                                            onFocus={() => scrollToY(220)}
                                        />
                                    </View>
                                </View>
                            </View>

                            {/* Company */}
                            <View style={styles.editSection}>
                                <View style={styles.editSectionHeader}>
                                    <View style={[styles.editSectionDot, { backgroundColor: '#FF9800' }]} />
                                    <Text style={styles.editSectionTitle}>Company Details</Text>
                                </View>
                                <View style={styles.editFieldGroup}>
                                    <Text style={styles.editFieldLabel}>
                                        Company <Text style={styles.mandatoryStar}>*</Text>
                                    </Text>
                                    <View style={styles.editInputWrapper}>
                                        <Ionicons name="business-outline" size={16} color="#AAA" style={styles.editInputIcon} />
                                        <TextInput
                                            style={styles.editInput}
                                            value={company}
                                            onChangeText={setCompany}
                                            placeholder="e.g. Google"
                                            placeholderTextColor="#CCC"
                                            onFocus={() => scrollToY(320)}
                                        />
                                    </View>
                                </View>
                                <View style={styles.editFieldGroup}>
                                    <Text style={styles.editFieldLabel}>
                                        Location <Text style={styles.mandatoryStar}>*</Text>
                                    </Text>
                                    <View style={styles.editInputWrapper}>
                                        <Ionicons name="location-outline" size={16} color="#AAA" style={styles.editInputIcon} />
                                        <TextInput
                                            style={styles.editInput}
                                            value={companyLocation}
                                            onChangeText={handleLocationSearch}
                                            placeholder="Search office address or company campus..."
                                            placeholderTextColor="#CCC"
                                            onFocus={() => scrollToY(400)}
                                        />
                                        {isSearchingLocation && (
                                            <ActivityIndicator size="small" color={theme.colors.primary} />
                                        )}
                                    </View>
                                    {locationResults.length > 0 && (
                                        <View style={styles.locationResults}>
                                            {locationResults.map((result) => (
                                                <TouchableOpacity
                                                    key={result.id}
                                                    style={styles.locationResultItem}
                                                    onPress={() => void handleLocationSelect(result as PlaceSuggestion & Partial<CompanyLocation>)}
                                                >
                                                    <Ionicons name="location" size={16} color={theme.colors.primary} />
                                                    <View style={styles.locationResultCopy}>
                                                        <Text style={styles.locationResultPrimary} numberOfLines={1}>
                                                            {result.primaryText || 'Unknown location'}
                                                        </Text>
                                                        {!!result.secondaryText && (
                                                            <Text style={styles.locationResultSecondary} numberOfLines={2}>
                                                                {result.secondaryText}
                                                            </Text>
                                                        )}
                                                    </View>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    )}
                                    {selectedLocation && (
                                        <View style={styles.selectedLocation}>
                                            <View style={styles.selectedLocationIcon}>
                                                <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.selectedLocationTitle}>Office pinned</Text>
                                                <Text style={styles.selectedLocationAddress} numberOfLines={2}>
                                                    {selectedLocation.address}
                                                </Text>
                                            </View>
                                            <TouchableOpacity
                                                onPress={() => {
                                                    setSelectedLocation(null);
                                                    setCompanyLocation('');
                                                }}
                                            >
                                                <Ionicons name="close-circle" size={20} color="#CCC" />
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>
                            </View>

                            {/* Office Schedule */}
                            <View style={styles.editSection}>
                                <View style={styles.editSectionHeader}>
                                    <View style={[styles.editSectionDot, { backgroundColor: '#2196F3' }]} />
                                    <Text style={styles.editSectionTitle}>Office Schedule</Text>
                                </View>
                                <View style={styles.timeRow}>
                                    <View style={styles.timePickerGroup}>
                                        <Text style={styles.editFieldLabel}>Start Time</Text>
                                        <TouchableOpacity
                                            style={styles.timeButton}
                                            onPress={() => setShowStartPicker(true)}
                                        >
                                            <Ionicons name="sunny-outline" size={14} color={theme.colors.primary} />
                                            <Text style={styles.timeButtonText}>{formatTime(officeStart)}</Text>
                                        </TouchableOpacity>
                                        {showStartPicker && (
                                            <DateTimePicker
                                                value={officeStart}
                                                mode="time"
                                                is24Hour={false}
                                                onChange={(event, date) => {
                                                    setShowStartPicker(Platform.OS === 'ios');
                                                    if (date) setOfficeStart(date);
                                                }}
                                            />
                                        )}
                                    </View>
                                    <View style={styles.timePickerGroup}>
                                        <Text style={styles.editFieldLabel}>End Time</Text>
                                        <TouchableOpacity
                                            style={styles.timeButton}
                                            onPress={() => setShowEndPicker(true)}
                                        >
                                            <Ionicons name="moon-outline" size={14} color={theme.colors.primary} />
                                            <Text style={styles.timeButtonText}>{formatTime(officeEnd)}</Text>
                                        </TouchableOpacity>
                                        {showEndPicker && (
                                            <DateTimePicker
                                                value={officeEnd}
                                                mode="time"
                                                is24Hour={false}
                                                onChange={(event, date) => {
                                                    setShowEndPicker(Platform.OS === 'ios');
                                                    if (date) setOfficeEnd(date);
                                                }}
                                            />
                                        )}
                                    </View>
                                </View>
                                <View style={styles.editFieldGroup}>
                                    <Text style={styles.editFieldLabel}>Min Login Hours</Text>
                                    <View style={styles.editInputWrapper}>
                                        <Ionicons name="hourglass-outline" size={16} color="#AAA" style={styles.editInputIcon} />
                                        <TextInput
                                            style={styles.editInput}
                                            value={minimumLoginTime}
                                            onChangeText={setMinimumLoginTime}
                                            placeholder="e.g. 8"
                                            placeholderTextColor="#CCC"
                                            keyboardType="numeric"
                                            onFocus={() => scrollToY(620)}
                                        />
                                    </View>
                                </View>
                            </View>

                            {/* Office Day Target */}
                            <View style={styles.editSection}>
                                <View style={styles.editSectionHeader}>
                                    <View style={[styles.editSectionDot, { backgroundColor: theme.colors.primary }]} />
                                    <Text style={styles.editSectionTitle}>Office Days Target</Text>
                                </View>
                                <View style={styles.editFieldGroup}>
                                    <Text style={styles.editFieldLabel}>Office Days</Text>
                                    <View style={styles.editInputWrapper}>
                                        <Ionicons name="business-outline" size={16} color="#AAA" style={styles.editInputIcon} />
                                        <TextInput
                                            style={styles.editInput}
                                            value={officeTargetDays}
                                            onChangeText={setOfficeTargetDays}
                                            placeholder="e.g. 3"
                                            placeholderTextColor="#CCC"
                                            keyboardType="numeric"
                                            onFocus={() => {
                                                if (officeTargetDays === '0') setOfficeTargetDays('');
                                                scrollToY(780);
                                            }}
                                            onBlur={() => {
                                                if (!officeTargetDays.trim()) setOfficeTargetDays('0');
                                            }}
                                        />
                                    </View>
                                </View>
                                <View style={styles.editFieldGroup}>
                                    <Text style={styles.editFieldLabel}>Target Period</Text>
                                    <View style={styles.periodRow}>
                                        {OFFICE_TARGET_PERIODS.map((opt) => (
                                            <TouchableOpacity
                                                key={opt.value}
                                                style={[
                                                    styles.periodChip,
                                                    officeTargetPeriod === opt.value && styles.periodChipActive,
                                                ]}
                                                onPress={() => setOfficeTargetPeriod(opt.value as 'week' | 'month')}
                                            >
                                                <Text
                                                    style={[
                                                        styles.periodChipText,
                                                        officeTargetPeriod === opt.value && styles.periodChipTextActive,
                                                    ]}
                                                >
                                                    {opt.label}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            </View>

                            {/* Save Button */}
                            <View style={{ marginTop: 4 }}>
                                {isSaving ? (
                                    <View style={styles.savingContainer}>
                                        <ActivityIndicator size="small" color={theme.colors.primary} />
                                        <Text style={styles.savingText}>Saving changes...</Text>
                                    </View>
                                ) : (
                                    <Button title="Save Changes" onPress={handleSave} />
                                )}
                            </View>
                        </Animated.View>
                    )}

                    {/* ── Logout ── */}
                    <Animated.View entering={FadeInDown.delay(400).duration(500)} style={styles.logoutSection}>
                        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                            <Ionicons name="log-out-outline" size={18} color="#E53935" />
                            <Text style={styles.logoutText}>Sign Out</Text>
                        </TouchableOpacity>
                    </Animated.View>

                    {/* ── Footer ── */}
                    <View style={styles.versionFooter}>
                        <Text style={styles.versionText}>OfficeOrbit v1.0.0</Text>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>

        {/* ── Themed Logout Modal ── */}
        <Modal
            visible={showLogoutModal}
            transparent
            animationType="fade"
            onRequestClose={() => setShowLogoutModal(false)}
        >
            <TouchableOpacity
                style={styles.logoutOverlay}
                activeOpacity={1}
                onPress={() => setShowLogoutModal(false)}
            >
                <TouchableOpacity activeOpacity={1} style={styles.logoutModalCard}>
                    <View style={styles.logoutModalIcon}>
                        <Ionicons name="log-out-outline" size={28} color="#E53935" />
                    </View>
                    <Text style={styles.logoutModalTitle}>Sign Out</Text>
                    <Text style={styles.logoutModalMessage}>
                        Are you sure you want to sign out of OfficeOrbit? You'll need to log in again to access your account.
                    </Text>
                    <View style={styles.logoutModalActions}>
                        <TouchableOpacity
                            style={styles.logoutModalCancel}
                            onPress={() => setShowLogoutModal(false)}
                        >
                            <Text style={styles.logoutModalCancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.logoutModalConfirm}
                            onPress={confirmLogout}
                        >
                            <Ionicons name="log-out-outline" size={16} color="#FFF" />
                            <Text style={styles.logoutModalConfirmText}>Sign Out</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>

        <PaywallModal
            visible={paywallVisible}
            onClose={() => setPaywallVisible(false)}
        />
        </>
    );
};

/* ═══════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════ */
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5FA',
    },
    scrollContent: {
        paddingBottom: 40,
    },

    /* ── Banner / Header ── */
    bannerGradient: {
        height: 160,
        paddingTop: Platform.OS === 'ios' ? 54 : 40,
        paddingHorizontal: 20,
    },
    bannerOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.05)',
    },
    editBtnFloat: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 54 : 40,
        right: 20,
        minWidth: 82,
        height: 46,
        borderRadius: 23,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 10,
        gap: 2,
    },
    editBtnLabel: {
        fontSize: 10,
        color: '#FFF',
        fontWeight: '700',
    },

    /* ── Avatar ── */
    avatarContainer: {
        alignItems: 'center',
        marginTop: -52,
        zIndex: 10,
    },
    avatarOuter: {
        shadowColor: theme.colors.primary,
        shadowOpacity: 0.3,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
        elevation: 8,
    },
    avatarRing: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarInner: {
        overflow: 'hidden',
    },
    avatarGradient: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        color: '#FFF',
        fontWeight: '800',
        letterSpacing: 1.5,
    },

    /* ── Identity Card ── */
    identityCard: {
        backgroundColor: '#FFF',
        marginHorizontal: 16,
        marginTop: -48,
        borderRadius: 24,
        paddingTop: 0,
        paddingBottom: 20,
        paddingHorizontal: 20,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 8 },
        elevation: 5,
    },
    profileName: {
        fontSize: 22,
        fontWeight: '800',
        color: '#1A1A2E',
        letterSpacing: 0.3,
        marginBottom: 6,
    },
    emailChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginBottom: 10,
    },
    emailText: {
        fontSize: 13,
        color: '#888',
        fontWeight: '500',
    },
    companyChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: `${theme.colors.primary}0D`,
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 20,
        marginBottom: 16,
    },
    companyChipText: {
        fontSize: 12,
        fontWeight: '700',
        color: theme.colors.primary,
        letterSpacing: 0.3,
    },

    /* ── Stats Row ── */
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FAFAFF',
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 16,
        width: '100%',
    },
    statChip: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    statChipValue: {
        fontSize: 13,
        fontWeight: '700',
        color: '#333',
    },
    statChipLabel: {
        fontSize: 10,
        fontWeight: '500',
        color: '#999',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    statDivider: {
        width: 1,
        height: 28,
        backgroundColor: '#E8E8F0',
        marginHorizontal: 12,
    },

    /* ── Section Cards (View Mode) ── */
    cardsContainer: {
        paddingHorizontal: 16,
        paddingTop: 16,
        gap: 12,
    },
    sectionCard: {
        backgroundColor: '#FFF',
        borderRadius: 18,
        paddingVertical: 16,
        paddingHorizontal: 18,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5FA',
    },
    sectionIconBg: {
        width: 30,
        height: 30,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#444',
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },
    sectionBody: {
        gap: 14,
    },

    /* ── Info Row ── */
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    infoRowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    infoRowIconBg: {
        width: 28,
        height: 28,
        borderRadius: 8,
        backgroundColor: `${theme.colors.primary}08`,
        alignItems: 'center',
        justifyContent: 'center',
    },
    infoLabel: {
        fontSize: 14,
        color: '#777',
        fontWeight: '500',
    },
    infoValue: {
        fontSize: 14,
        color: '#1A1A2E',
        fontWeight: '700',
        maxWidth: '45%',
        textAlign: 'right',
    },

    /* ── Edit Card ── */
    editCard: {
        backgroundColor: '#FFF',
        marginHorizontal: 16,
        marginTop: 16,
        borderRadius: 22,
        padding: 22,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 8 },
        elevation: 4,
    },
    editSection: {
        marginBottom: 22,
    },
    editSectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 14,
    },
    editSectionDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    editSectionTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#555',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    editFieldGroup: {
        marginBottom: 14,
    },
    editFieldLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#777',
        marginBottom: 7,
        letterSpacing: 0.3,
    },
    mandatoryStar: {
        color: '#E53935',
    },
    editInputWrapper: {
        backgroundColor: '#F8F8FC',
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: '#EDEDF5',
        paddingHorizontal: 14,
        height: 48,
        flexDirection: 'row',
        alignItems: 'center',
    },
    editInputIcon: {
        marginRight: 10,
    },
    editInput: {
        flex: 1,
        fontSize: 15,
        color: '#1A1A2E',
        fontWeight: '500',
        height: '100%',
    },
    locationResults: {
        marginTop: 8,
        backgroundColor: '#FFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#EDEDF5',
        overflow: 'hidden',
    },
    locationResultItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5FA',
    },
    locationResultCopy: {
        flex: 1,
    },
    locationResultPrimary: {
        fontSize: 13,
        color: '#333',
        fontWeight: '600',
    },
    locationResultSecondary: {
        fontSize: 12,
        color: '#777',
        marginTop: 3,
        lineHeight: 17,
    },
    selectedLocation: {
        marginTop: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#F0FFF4',
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: '#C8E6C9',
    },
    selectedLocationIcon: {
        marginRight: -4,
    },
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

    /* ── Time Pickers ── */
    timeRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 14,
    },
    timePickerGroup: {
        flex: 1,
    },
    timeButton: {
        backgroundColor: '#F8F8FC',
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: '#EDEDF5',
        paddingHorizontal: 14,
        height: 48,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    timeButtonText: {
        fontSize: 15,
        color: '#1A1A2E',
        fontWeight: '600',
    },

    /* ── Office Target Period chips ── */
    periodRow: {
        flexDirection: 'row',
        gap: 10,
    },
    periodChip: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: `${theme.colors.primary}40`,
        backgroundColor: '#FFF',
    },
    periodChipActive: {
        backgroundColor: theme.colors.primary,
        borderColor: theme.colors.primary,
    },
    periodChipText: {
        fontSize: 13,
        fontWeight: '700',
        color: theme.colors.primary,
    },
    periodChipTextActive: {
        color: '#FFF',
    },

    /* ── Saving ── */
    savingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingVertical: 16,
    },
    savingText: {
        color: theme.colors.primary,
        fontSize: 14,
        fontWeight: '600',
    },

    /* ── Logout ── */
    logoutSection: {
        marginHorizontal: 16,
        marginTop: 24,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 16,
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: '#FFD9D9',
        shadowColor: '#E53935',
        shadowOpacity: 0.06,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 2 },
        elevation: 1,
    },
    logoutText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#E53935',
    },

    /* ── Footer ── */
    versionFooter: {
        alignItems: 'center',
        marginTop: 24,
    },
    versionText: {
        fontSize: 11,
        color: 'rgba(0,0,0,0.2)',
        fontWeight: '500',
    },

    /* ── Logout Modal ── */
    logoutOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    logoutModalCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 24,
        width: '100%',
        maxWidth: 340,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
        elevation: 8,
    },
    logoutModalIcon: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#FEE2E2',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    logoutModalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
    },
    logoutModalMessage: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 24,
    },
    logoutModalActions: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    logoutModalCancel: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoutModalCancelText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
    },
    logoutModalConfirm: {
        flex: 1,
        flexDirection: 'row',
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: '#E53935',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    logoutModalConfirmText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
    },

    /* ── Glowing Digital Member Card ── */
    premiumMemberCard: {
        borderRadius: 24,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 6,
        marginBottom: 8,
    },
    memberCardPro: {
        shadowColor: theme.colors.primary,
        shadowOpacity: 0.25,
        borderWidth: 1,
        borderColor: 'rgba(123, 111, 255, 0.25)',
    },
    memberCardAuto: {
        shadowColor: '#FF5252',
        shadowOpacity: 0.25,
        borderWidth: 1,
        borderColor: 'rgba(255, 82, 82, 0.25)',
    },
    memberCardGradient: {
        padding: 20,
        height: 175,
        justifyContent: 'space-between',
    },
    cardHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    cardBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 6,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    cardBadgeText: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    cardBrand: {
        fontSize: 14,
        fontWeight: '800',
        color: '#FFF',
        letterSpacing: 0.8,
        opacity: 0.85,
    },
    cardContent: {
        marginTop: 6,
    },
    cardName: {
        fontSize: 19,
        fontWeight: '800',
        color: '#FFF',
        letterSpacing: 1.2,
    },
    cardPlanSub: {
        fontSize: 11,
        color: '#AAA',
        marginTop: 3,
        fontWeight: '500',
        letterSpacing: 0.5,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.05)',
    },
    cardSerial: {
        fontSize: 10,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        color: '#777',
        letterSpacing: 0.5,
    },
    cardUpgradeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        gap: 4,
        shadowColor: '#FFF',
        shadowOpacity: 0.15,
        shadowRadius: 6,
    },
    cardUpgradeText: {
        fontSize: 9,
        fontWeight: '800',
        color: '#000',
        letterSpacing: 0.5,
    },
    activePill: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    activePillText: {
        fontSize: 9,
        fontWeight: '800',
        color: '#FFF',
        letterSpacing: 0.5,
    },

    /* ── Settings Row ── */
    settingsRowClickable: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
    },
    settingsBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    settingsPlanBadge: {
        backgroundColor: 'rgba(0,0,0,0.05)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10,
    },
    settingsPlanBadgeText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#555',
    },
    badgeAuto: {
        backgroundColor: 'rgba(255, 82, 82, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255, 82, 82, 0.15)',
    },
    badgePro: {
        backgroundColor: 'rgba(123, 111, 255, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(123, 111, 255, 0.15)',
    },
    badgeTextAuto: {
        color: '#FF5252',
    },
    badgeTextPro: {
        color: '#7B6FFF',
    },
});
