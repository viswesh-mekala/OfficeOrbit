import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme/theme';

/* ── Types ── */
type ToastVariant = 'success' | 'error' | 'info' | 'warning';

interface ToastPayload {
  title: string;
  message?: string;
  variant?: ToastVariant;
  duration?: number; // ms, default 3000
}

interface ToastContextType {
  showToast: (payload: ToastPayload) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
};

/* ── Variant config ── */
const VARIANTS: Record<ToastVariant, {
  bg: string; border: string; icon: string; iconColor: string; titleColor: string; msgColor: string;
}> = {
  success: {
    bg: '#ECFDF5', border: '#A7F3D0',
    icon: 'checkmark-circle', iconColor: '#059669',
    titleColor: '#065F46', msgColor: '#047857',
  },
  error: {
    bg: '#FEF2F2', border: '#FECACA',
    icon: 'close-circle', iconColor: '#DC2626',
    titleColor: '#991B1B', msgColor: '#B91C1C',
  },
  warning: {
    bg: '#FFFBEB', border: '#FDE68A',
    icon: 'alert-circle', iconColor: '#D97706',
    titleColor: '#92400E', msgColor: '#B45309',
  },
  info: {
    bg: '#EEF2FF', border: '#C7D2FE',
    icon: 'information-circle', iconColor: theme.colors.primary,
    titleColor: '#312E81', msgColor: '#4338CA',
  },
};

/* ── Provider ── */
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<(ToastPayload & { key: number }) | null>(null);
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyRef = useRef(0);

  const dismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: -120, duration: 250, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => setToast(null));
  }, [translateY, opacity]);

  const showToast = useCallback((payload: ToastPayload) => {
    if (timerRef.current) clearTimeout(timerRef.current);

    const key = ++keyRef.current;
    setToast({ ...payload, key });

    // Reset to hidden then animate in
    translateY.setValue(-120);
    opacity.setValue(0);

    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 200 }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    timerRef.current = setTimeout(dismiss, payload.duration ?? 3000);
  }, [translateY, opacity, dismiss]);

  const v = VARIANTS[toast?.variant ?? 'info'];

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <Animated.View
          style={[
            styles.container,
            { backgroundColor: v.bg, borderColor: v.border, transform: [{ translateY }], opacity },
          ]}
          pointerEvents="box-none"
        >
          <TouchableOpacity style={styles.inner} activeOpacity={0.85} onPress={dismiss}>
            <View style={styles.iconWrap}>
              <Ionicons name={v.icon as any} size={22} color={v.iconColor} />
            </View>
            <View style={styles.textWrap}>
              <Text style={[styles.title, { color: v.titleColor }]} numberOfLines={1}>{toast.title}</Text>
              {toast.message ? (
                <Text style={[styles.message, { color: v.msgColor }]} numberOfLines={2}>{toast.message}</Text>
              ) : null}
            </View>
            <Ionicons name="close" size={16} color={v.msgColor} style={{ opacity: 0.5 }} />
          </TouchableOpacity>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 40,
    left: 16,
    right: 16,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
    zIndex: 9999,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
    gap: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
  },
  message: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
});
