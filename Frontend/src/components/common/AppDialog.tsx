/**
 * AppDialog — Branded modal dialog matching OfficeOrbit's design system.
 *
 * Replaces native Alert.alert() across the app with a themed, animated dialog
 * that matches the purple/glass design system.
 *
 * Usage:
 *   <AppDialog
 *     visible={visible}
 *     icon="log-out-outline"
 *     iconColor="#EF4444"
 *     title="Exit OfficeOrbit?"
 *     message="Your attendance tracking will continue in the background."
 *     confirmLabel="Exit"
 *     confirmDestructive
 *     onConfirm={handleConfirm}
 *     onCancel={() => setVisible(false)}
 *   />
 */

import React, { useEffect } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    TouchableWithoutFeedback,
} from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme/theme';

export interface AppDialogProps {
    visible: boolean;
    /** Ionicons icon name shown at the top */
    icon?: keyof typeof Ionicons.glyphMap;
    /** Icon background tint — defaults to primary purple */
    iconColor?: string;
    title: string;
    message?: string;
    /** Primary action label — defaults to "Confirm" */
    confirmLabel?: string;
    /** Secondary action label — defaults to "Cancel" */
    cancelLabel?: string;
    /** Styles the confirm button red/danger */
    confirmDestructive?: boolean;
    /** Disables backdrop-tap-to-dismiss */
    dismissable?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export const AppDialog: React.FC<AppDialogProps> = ({
    visible,
    icon,
    iconColor,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    confirmDestructive = false,
    dismissable = true,
    onConfirm,
    onCancel,
}) => {
    const scale   = useSharedValue(0.88);
    const opacity = useSharedValue(0);

    useEffect(() => {
        if (visible) {
            opacity.value = withTiming(1, { duration: 180 });
            scale.value   = withSpring(1, { damping: 18, stiffness: 260 });
        } else {
            opacity.value = withTiming(0, { duration: 140 });
            scale.value   = withTiming(0.92, { duration: 140 });
        }
    }, [visible]);

    const backdropStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
    const cardStyle     = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: opacity.value }));

    const resolvedIconColor = iconColor ?? theme.colors.primary;
    const iconBg = resolvedIconColor + '18'; // 10% opacity tint

    return (
        <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
            <TouchableWithoutFeedback onPress={dismissable ? onCancel : undefined}>
                <Animated.View style={[styles.backdrop, backdropStyle]} />
            </TouchableWithoutFeedback>

            <View style={styles.centeredWrapper} pointerEvents="box-none">
                <Animated.View style={[styles.card, cardStyle]}>

                    {/* Icon */}
                    {icon && (
                        <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
                            <Ionicons name={icon} size={26} color={resolvedIconColor} />
                        </View>
                    )}

                    {/* Text */}
                    <Text style={styles.title}>{title}</Text>
                    {message ? <Text style={styles.message}>{message}</Text> : null}

                    {/* Divider */}
                    <View style={styles.divider} />

                    {/* Actions */}
                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={[styles.btn, styles.cancelBtn]}
                            onPress={onCancel}
                            activeOpacity={0.75}
                        >
                            <Text style={styles.cancelLabel}>{cancelLabel}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.btn,
                                styles.confirmBtn,
                                confirmDestructive && styles.destructiveBtn,
                            ]}
                            onPress={onConfirm}
                            activeOpacity={0.82}
                        >
                            <Text style={[
                                styles.confirmLabel,
                                confirmDestructive && styles.destructiveLabel,
                            ]}>
                                {confirmLabel}
                            </Text>
                        </TouchableOpacity>
                    </View>

                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
    },
    centeredWrapper: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 28,
    },
    card: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        paddingTop: 28,
        paddingBottom: 20,
        paddingHorizontal: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.18,
        shadowRadius: 24,
        elevation: 16,
    },
    iconWrap: {
        width: 56,
        height: 56,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 17,
        fontWeight: '700',
        color: theme.colors.text.primary,
        textAlign: 'center',
        marginBottom: 8,
        letterSpacing: -0.2,
    },
    message: {
        fontSize: 14,
        color: theme.colors.text.secondary,
        textAlign: 'center',
        lineHeight: 20,
    },
    divider: {
        height: 1,
        backgroundColor: '#F0F0F0',
        width: '100%',
        marginVertical: 20,
    },
    actions: {
        flexDirection: 'row',
        gap: 10,
        width: '100%',
    },
    btn: {
        flex: 1,
        height: 46,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelBtn: {
        backgroundColor: '#F4F4F6',
    },
    confirmBtn: {
        backgroundColor: theme.colors.primary,
    },
    destructiveBtn: {
        backgroundColor: '#FEF2F2',
    },
    cancelLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: theme.colors.text.secondary,
    },
    confirmLabel: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    destructiveLabel: {
        color: '#DC2626',
    },
});
