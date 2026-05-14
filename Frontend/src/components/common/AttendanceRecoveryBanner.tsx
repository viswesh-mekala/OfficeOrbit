import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PendingAttendanceRecovery } from '../../services/AttendanceRecoveryService';

interface AttendanceRecoveryBannerProps {
    recovery: PendingAttendanceRecovery;
    onDismiss: () => void;
    onOpenSettings?: () => void;
}

const reasonIcon = (recovery: PendingAttendanceRecovery) => {
    if (recovery.requiresSettings) return 'settings-outline';
    if (recovery.reason === 'network_error') return 'cloud-offline-outline';
    if (recovery.action === 'checkout') return 'log-out-outline';
    return 'warning-outline';
};

const helperText = (recovery: PendingAttendanceRecovery) => {
    if (recovery.requiresSettings) {
        return 'Restore location access, then use the swipe below if you still need to finish attendance.';
    }
    if (recovery.queuedOffline) {
        return 'We will retry this automatically when the app reconnects. You can still use the swipe below if you want immediate control.';
    }
    return 'Manual swipe is still available below if you want to finish this yourself.';
};

export const AttendanceRecoveryBanner: React.FC<AttendanceRecoveryBannerProps> = ({
    recovery,
    onDismiss,
    onOpenSettings,
}) => {
    return (
        <View style={styles.card} testID="attendance-recovery-banner">
            <View style={styles.headerRow}>
                <View style={styles.iconWrap}>
                    <Ionicons name={reasonIcon(recovery)} size={18} color="#D97706" />
                </View>
                <View style={styles.copyWrap}>
                    <Text style={styles.title}>{recovery.title}</Text>
                    <Text style={styles.body}>{recovery.body}</Text>
                </View>
                <TouchableOpacity
                    onPress={onDismiss}
                    style={styles.dismissButton}
                    accessibilityLabel="Dismiss recovery message"
                    testID="attendance-recovery-dismiss"
                >
                    <Ionicons name="close" size={18} color="#92400E" />
                </TouchableOpacity>
            </View>

            <Text style={styles.helper}>{helperText(recovery)}</Text>

            {recovery.requiresSettings && onOpenSettings ? (
                <TouchableOpacity
                    style={styles.settingsButton}
                    onPress={onOpenSettings}
                    testID="attendance-recovery-open-settings"
                >
                    <Ionicons name="settings-outline" size={16} color="#92400E" />
                    <Text style={styles.settingsLabel}>Open Settings</Text>
                </TouchableOpacity>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        borderRadius: 18,
        padding: 14,
        backgroundColor: '#FFF7ED',
        borderWidth: 1,
        borderColor: '#FCD9A6',
        gap: 10,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
    },
    iconWrap: {
        width: 34,
        height: 34,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFEDD5',
    },
    copyWrap: {
        flex: 1,
        gap: 4,
    },
    title: {
        fontSize: 14,
        fontWeight: '700',
        color: '#9A3412',
    },
    body: {
        fontSize: 12,
        lineHeight: 18,
        color: '#7C2D12',
    },
    dismissButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFEAD0',
    },
    helper: {
        fontSize: 11,
        lineHeight: 16,
        color: '#B45309',
        fontWeight: '600',
    },
    settingsButton: {
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: '#FFE7CC',
    },
    settingsLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#92400E',
    },
});
