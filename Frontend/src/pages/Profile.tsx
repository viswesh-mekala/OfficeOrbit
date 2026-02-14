import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { theme } from '../theme/theme';
import { Button } from '../components/common/Button';
import { useAuth, CompanyLocation } from '../context/AuthContext';

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

/* ─────────── Time Helpers ─────────── */
const parseTimeToDate = (timeStr: string | null): Date => {
    const d = new Date();
    if (timeStr) {
        const parts = timeStr.split(':');
        d.setHours(parseInt(parts[0]) || 9, parseInt(parts[1]) || 0, 0, 0);
    } else {
        d.setHours(9, 0, 0, 0);
    }
    return d;
};

const formatTimeDisplay = (timeStr: string | null): string => {
    if (!timeStr) return '--:--';
    const parts = timeStr.split(':');
    const hours = parseInt(parts[0]);
    const minutes = parts[1] || '00';
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes} ${ampm}`;
};

const formatTimeForDB = (date: Date): string => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
};

const formatTime = (date: Date) => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes < 10 ? `0${minutes}` : minutes;
    return `${displayHours}:${displayMinutes} ${ampm}`;
};

const WFH_PERIODS = [
    { label: 'Per Week', value: 'week' },
    { label: 'Per Month', value: 'month' },
];

/* ═══════════════════════════════════════════════════════
   PROFILE PAGE
   ═══════════════════════════════════════════════════════ */
export const Profile: React.FC = () => {
    const { profile, user, updateProfile, signOut, refreshProfile } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Edit form state
    const [username, setUsername] = useState('');
    const [company, setCompany] = useState('');
    const [companyLocation, setCompanyLocation] = useState('');
    const [officeStart, setOfficeStart] = useState(new Date());
    const [officeEnd, setOfficeEnd] = useState(new Date());
    const [minimumLoginTime, setMinimumLoginTime] = useState('');
    const [wfhDays, setWfhDays] = useState('');
    const [wfhPeriod, setWfhPeriod] = useState<'week' | 'month'>('week');
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);

    // Initialize form from profile
    useEffect(() => {
        if (profile) {
            setUsername(profile.username || '');
            setCompany(profile.company || '');
            setCompanyLocation(profile.company_location?.address || '');
            setOfficeStart(parseTimeToDate(profile.office_window_start));
            setOfficeEnd(parseTimeToDate(profile.office_window_end));
            setMinimumLoginTime(
                profile.minimum_login_time_minutes
                    ? String(Math.round(profile.minimum_login_time_minutes / 60))
                    : '8'
            );
            setWfhDays(profile.wfh_days != null ? String(profile.wfh_days) : '0');
            setWfhPeriod(profile.wfh_period || 'week');
        }
    }, [profile]);

    const handleEdit = () => setIsEditing(true);

    const handleCancel = () => {
        if (profile) {
            setUsername(profile.username || '');
            setCompany(profile.company || '');
            setCompanyLocation(profile.company_location?.address || '');
            setOfficeStart(parseTimeToDate(profile.office_window_start));
            setOfficeEnd(parseTimeToDate(profile.office_window_end));
            setMinimumLoginTime(
                profile.minimum_login_time_minutes
                    ? String(Math.round(profile.minimum_login_time_minutes / 60))
                    : '8'
            );
            setWfhDays(profile.wfh_days != null ? String(profile.wfh_days) : '0');
            setWfhPeriod(profile.wfh_period || 'week');
        }
        setIsEditing(false);
    };

    const handleSave = async () => {
        if (!username.trim() || !company.trim() || !companyLocation.trim()) {
            Alert.alert('Required Fields', 'Please fill in all required fields.');
            return;
        }

        setIsSaving(true);
        const loginTimeMinutes = Math.round(parseFloat(minimumLoginTime || '8') * 60);

        const { error } = await updateProfile({
            username: username.trim(),
            company: company.trim(),
            company_location: profile?.company_location
                ? { ...profile.company_location, address: companyLocation.trim() }
                : ({ latitude: 0, longitude: 0, address: companyLocation.trim() } as CompanyLocation),
            office_window_start: formatTimeForDB(officeStart),
            office_window_end: formatTimeForDB(officeEnd),
            minimum_login_time_minutes: loginTimeMinutes,
            wfh_days: parseInt(wfhDays || '0'),
            wfh_period: wfhPeriod,
        });

        setIsSaving(false);

        if (error) {
            Alert.alert('Error', error.message);
        } else {
            setIsEditing(false);
        }
    };

    const handleLogout = () => {
        Alert.alert('Sign Out', 'Are you sure you want to sign out of OfficeOrbit?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign Out', style: 'destructive', onPress: signOut },
        ]);
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
        <View style={styles.container}>
            <StatusBar style="light" />
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
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
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity style={styles.editBtnFloat} onPress={handleCancel}>
                                    <Ionicons name="close" size={18} color="#FFF" />
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
                                    label="WFH"
                                    value={`${profile.wfh_days ?? 0} days/${profile.wfh_period === 'month' ? 'mo' : 'wk'}`}
                                />
                            </View>
                        </View>
                    </Animated.View>

                    {/* ── VIEW MODE ── */}
                    {!isEditing ? (
                        <View style={styles.cardsContainer}>
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

                            <SectionCard title="Work From Home" icon="home-outline" iconColor="#4CAF50" delay={300}>
                                <InfoRow icon="calendar-outline" label="WFH Days" value={profile.wfh_days != null ? String(profile.wfh_days) : '0'} />
                                <InfoRow icon="repeat-outline" label="Period" value={profile.wfh_period === 'month' ? 'Per Month' : 'Per Week'} />
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
                                            onChangeText={setCompanyLocation}
                                            placeholder="e.g. Bangalore, HSR Layout"
                                            placeholderTextColor="#CCC"
                                        />
                                    </View>
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
                                        />
                                    </View>
                                </View>
                            </View>

                            {/* WFH */}
                            <View style={styles.editSection}>
                                <View style={styles.editSectionHeader}>
                                    <View style={[styles.editSectionDot, { backgroundColor: '#4CAF50' }]} />
                                    <Text style={styles.editSectionTitle}>Work From Home</Text>
                                </View>
                                <View style={styles.editFieldGroup}>
                                    <Text style={styles.editFieldLabel}>WFH Days</Text>
                                    <View style={styles.editInputWrapper}>
                                        <Ionicons name="home-outline" size={16} color="#AAA" style={styles.editInputIcon} />
                                        <TextInput
                                            style={styles.editInput}
                                            value={wfhDays}
                                            onChangeText={setWfhDays}
                                            placeholder="Number of days"
                                            placeholderTextColor="#CCC"
                                            keyboardType="numeric"
                                        />
                                    </View>
                                </View>
                                <View style={styles.editFieldGroup}>
                                    <Text style={styles.editFieldLabel}>WFH Period</Text>
                                    <View style={styles.periodRow}>
                                        {WFH_PERIODS.map((opt) => (
                                            <TouchableOpacity
                                                key={opt.value}
                                                style={[
                                                    styles.periodChip,
                                                    wfhPeriod === opt.value && styles.periodChipActive,
                                                ]}
                                                onPress={() => setWfhPeriod(opt.value as 'week' | 'month')}
                                            >
                                                <Text
                                                    style={[
                                                        styles.periodChipText,
                                                        wfhPeriod === opt.value && styles.periodChipTextActive,
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
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
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

    /* ── WFH Period chips ── */
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
});
