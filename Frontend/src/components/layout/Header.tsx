import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  ScrollView,
  useWindowDimensions,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme/theme';
import {
  AppNotification,
  AppNotificationType,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeNotifications,
} from '../../services/NotificationService';

/* ── Notification type theme map ── */
const TYPE_CONFIG: Record<
  AppNotificationType,
  { icon: string; color: string; bg: string; label: string }
> = {
  attendance: {
    icon: 'checkmark-circle',
    color: '#059669',
    bg: '#ECFDF5',
    label: 'Attendance',
  },
  location: {
    icon: 'location',
    color: '#D97706',
    bg: '#FFFBEB',
    label: 'Location',
  },
  automation: {
    icon: 'flash',
    color: '#7C3AED',
    bg: '#F5F3FF',
    label: 'Auto',
  },
  system: {
    icon: 'information-circle',
    color: '#2563EB',
    bg: '#EFF6FF',
    label: 'System',
  },
};

export const Header: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [panelAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const unsubscribe = subscribeNotifications((items) => {
      setNotifications(items);
    });
    return unsubscribe;
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.readAt).length,
    [notifications],
  );

  const panelWidth = useMemo(
    () => Math.max(300, Math.min(340, Math.floor(screenWidth * 0.85))),
    [screenWidth],
  );
  const panelMaxHeight = useMemo(() => Math.floor(screenHeight * 0.65), [screenHeight]);
  const listMaxHeight = useMemo(() => Math.max(200, panelMaxHeight - 100), [panelMaxHeight]);

  useEffect(() => {
    if (isOpen) {
      setIsModalVisible(true);
      panelAnim.setValue(0);
      Animated.timing(panelAnim, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }

    if (isModalVisible) {
      Animated.timing(panelAnim, {
        toValue: 0,
        duration: 150,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setIsModalVisible(false);
      });
    }
  }, [isOpen, isModalVisible, panelAnim]);

  const closePanel = () => setIsOpen(false);

  const togglePanel = async () => {
    if (!isOpen) {
      const latest = await getNotifications();
      setNotifications(latest);
    }
    setIsOpen((prev) => !prev);
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
  };

  const getRelativeTime = (isoTime: string) => {
    const diffMs = Date.now() - new Date(isoTime).getTime();
    const minutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(isoTime).toLocaleDateString();
  };

  const iconColor =
    unreadCount > 0 ? theme.colors.primary : theme.colors.text.secondary;

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <View style={styles.logoCircle}>
          <Ionicons name='infinite' size={20} color='white' />
        </View>
        <Text style={styles.logoText}>Orbit</Text>
      </View>
      <TouchableOpacity onPress={togglePanel} style={styles.notificationButton}>
        <Ionicons name='notifications' size={24} color={iconColor} />
        <Text style={styles.bellLabel}>Notifications</Text>
        {unreadCount > 0 ? (
          unreadCount < 10 ? (
            <View style={styles.notificationCountBadge}>
              <Text style={styles.notificationCountText}>{unreadCount}</Text>
            </View>
          ) : (
            <View style={styles.notificationDot} />
          )
        ) : null}
      </TouchableOpacity>

      <Modal
        visible={isModalVisible}
        transparent
        animationType='none'
        onRequestClose={closePanel}
      >
        <Pressable style={styles.overlay} onPress={closePanel}>
          <Animated.View
            style={[
              styles.panel,
              {
                width: panelWidth,
                maxHeight: panelMaxHeight,
                opacity: panelAnim,
                transform: [
                  {
                    translateY: panelAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-12, 0],
                    }),
                  },
                  {
                    scale: panelAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.95, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <Pressable onPress={(event) => event.stopPropagation()}>
              {/* Panel Header */}
              <View style={styles.panelHeader}>
                <View style={styles.panelTitleRow}>
                  <Ionicons name="notifications" size={16} color={theme.colors.primary} />
                  <Text style={styles.panelTitle}>Notifications</Text>
                  {unreadCount > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadBadgeText}>{unreadCount} new</Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity
                  onPress={handleMarkAllRead}
                  disabled={notifications.length === 0}
                  style={styles.markAllBtn}
                >
                  <Ionicons name="checkmark-done" size={14} color={theme.colors.primary} />
                  <Text style={styles.markReadText}>Mark all read</Text>
                </TouchableOpacity>
              </View>

              {notifications.length === 0 ? (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIcon}>
                    <Ionicons
                      name='notifications-off-outline'
                      size={24}
                      color='#C9CDD6'
                    />
                  </View>
                  <Text style={styles.emptyTitle}>All caught up!</Text>
                  <Text style={styles.emptyText}>No notifications to show</Text>
                </View>
              ) : (
                <ScrollView
                  style={[styles.list, { maxHeight: listMaxHeight }]}
                  showsVerticalScrollIndicator
                  persistentScrollbar
                >
                  {notifications.map((item) => {
                    const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.system;
                    const isUnread = !item.readAt;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[
                          styles.item,
                          isUnread && styles.itemUnread,
                        ]}
                        onPress={() => markNotificationRead(item.id)}
                        activeOpacity={0.7}
                      >
                        {/* Type icon */}
                        <View style={[styles.itemIcon, { backgroundColor: cfg.bg }]}>
                          <Ionicons name={cfg.icon as any} size={16} color={cfg.color} />
                        </View>

                        {/* Content */}
                        <View style={styles.itemContent}>
                          <View style={styles.itemTopRow}>
                            <Text style={[styles.itemTitle, isUnread && styles.itemTitleUnread]} numberOfLines={1}>
                              {item.title}
                            </Text>
                            <Text style={styles.itemTime}>
                              {getRelativeTime(item.createdAt)}
                            </Text>
                          </View>
                          <Text style={styles.itemBody} numberOfLines={2}>
                            {item.body}
                          </Text>
                          <View style={styles.itemMeta}>
                            <View style={[styles.typePill, { backgroundColor: cfg.bg }]}>
                              <Text style={[styles.typePillText, { color: cfg.color }]}>
                                {cfg.label}
                              </Text>
                            </View>
                          </View>
                        </View>

                        {/* Unread indicator */}
                        {isUnread && <View style={styles.unreadDot} />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.l,
    paddingVertical: theme.spacing.s,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logoCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  notificationButton: {
    minWidth: 56,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bellLabel: {
    marginTop: 0,
    fontSize: 8,
    fontWeight: '600',
    color: theme.colors.text.secondary,
  },
  notificationDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'red',
    borderWidth: 1,
    borderColor: 'white',
  },
  notificationCountBadge: {
    position: 'absolute',
    top: 0,
    right: 3,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1,
    borderColor: '#FFF',
  },
  notificationCountText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },

  /* ── Panel ── */
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 88,
    paddingHorizontal: 16,
  },
  panel: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E7EAF2',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
    overflow: 'hidden',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F8',
  },
  panelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  panelTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  unreadBadge: {
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  unreadBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  markReadText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },

  /* ── List ── */
  list: {
    minHeight: 80,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F6FA',
    backgroundColor: '#FFF',
  },
  itemUnread: {
    backgroundColor: '#FAFBFF',
  },
  itemIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  itemContent: {
    flex: 1,
    gap: 3,
  },
  itemTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text.primary,
    flex: 1,
    marginRight: 8,
  },
  itemTitleUnread: {
    fontWeight: '700',
    color: '#111827',
  },
  itemBody: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 17,
  },
  itemTime: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  itemMeta: {
    flexDirection: 'row',
    marginTop: 4,
  },
  typePill: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  typePillText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
    marginTop: 6,
  },

  /* ── Empty ── */
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    gap: 6,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '500',
  },
});
