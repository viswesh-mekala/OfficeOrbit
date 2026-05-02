import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme/theme';

export interface AlertCardProps {
  variant: 'on_track' | 'behind' | 'critical' | 'no_target';
  daysNeeded: number;
  periodLabel: string;
  currentOfficeDays: number;
  targetDays: number;
  remainingBusinessDays: number;
}

const VARIANT_THEME = {
  on_track: {
    bg: '#ECFDF5',
    accent: '#10B981',
    iconBg: '#D1FAE5',
    iconColor: '#059669',
    icon: 'checkmark-circle' as const,
    titleColor: '#065F46',
    subtextColor: '#047857',
    barTrack: '#A7F3D0',
  },
  behind: {
    bg: '#FFFBEB',
    accent: '#F59E0B',
    iconBg: '#FEF3C7',
    iconColor: '#D97706',
    icon: 'alert-circle' as const,
    titleColor: '#92400E',
    subtextColor: '#B45309',
    barTrack: '#FDE68A',
  },
  critical: {
    bg: '#FEF2F2',
    accent: '#EF4444',
    iconBg: '#FEE2E2',
    iconColor: '#DC2626',
    icon: 'warning' as const,
    titleColor: '#991B1B',
    subtextColor: '#B91C1C',
    barTrack: '#FECACA',
  },
  no_target: {
    bg: '#F8FAFC',
    accent: '#94A3B8',
    iconBg: '#E2E8F0',
    iconColor: '#64748B',
    icon: 'information-circle' as const,
    titleColor: '#334155',
    subtextColor: '#64748B',
    barTrack: '#CBD5E1',
  },
};

export const AlertCard: React.FC<AlertCardProps> = ({
  variant,
  daysNeeded,
  periodLabel,
  currentOfficeDays,
  targetDays,
  remainingBusinessDays,
}) => {
  const t = VARIANT_THEME[variant];
  const progress = targetDays > 0 ? Math.min(currentOfficeDays / targetDays, 1) : 0;

  /* ── Copy ── */
  const title = (() => {
    switch (variant) {
      case 'on_track':
        return 'Looking Good! 🎉';
      case 'behind':
        return `${daysNeeded} more office day${daysNeeded > 1 ? 's' : ''} needed`;
      case 'critical':
        return 'Target may be out of reach';
      case 'no_target':
        return 'Set your office target';
    }
  })();

  const subtitle = (() => {
    switch (variant) {
      case 'on_track':
        return `You're on track this ${periodLabel}`;
      case 'behind':
        return `${remainingBusinessDays} workday${remainingBusinessDays !== 1 ? 's' : ''} remaining to catch up`;
      case 'critical':
        return `Only ${remainingBusinessDays} workday${remainingBusinessDays !== 1 ? 's' : ''} left — need ${daysNeeded}`;
      case 'no_target':
        return 'Configure in Profile for personalized insights';
    }
  })();

  return (
    <View style={[styles.card, { backgroundColor: t.bg }]}>
      {/* Left accent bar */}
      <View style={[styles.accentBar, { backgroundColor: t.accent }]} />

      <View style={styles.body}>
        {/* Header row: icon + title */}
        <View style={styles.headerRow}>
          <View style={[styles.iconCircle, { backgroundColor: t.iconBg }]}>
            <Ionicons name={t.icon} size={16} color={t.iconColor} />
          </View>
          <Text style={[styles.title, { color: t.titleColor }]} numberOfLines={1}>
            {title}
          </Text>
        </View>

        {/* Progress bar — shown when target is set */}
        {variant !== 'no_target' && targetDays > 0 && (
          <View style={styles.progressSection}>
            <View style={[styles.progressTrack, { backgroundColor: t.barTrack }]}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.round(progress * 100)}%`, backgroundColor: t.accent },
                ]}
              />
            </View>
            <Text style={[styles.progressLabel, { color: t.subtextColor }]}>
              {currentOfficeDays}/{targetDays} office days this {periodLabel}
            </Text>
          </View>
        )}

        {/* Subtitle */}
        <Text style={[styles.subtitle, { color: t.subtextColor }]}>{subtitle}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: theme.borderRadius.m,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  accentBar: {
    width: 4,
  },
  body: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  progressSection: {
    gap: 4,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
});
