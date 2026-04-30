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
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeNotifications,
} from '../../services/NotificationService';

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
    () => Math.max(180, Math.min(210, Math.floor(screenWidth * 0.48))),
    [screenWidth],
  );
  const panelMaxHeight = useMemo(() => Math.floor(screenHeight * 0.6), [screenHeight]);
  const listMaxHeight = useMemo(() => Math.max(160, panelMaxHeight - 90), [panelMaxHeight]);

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
                      outputRange: [-8, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Pressable onPress={(event) => event.stopPropagation()}>
              <View style={styles.panelHeader}>
                <TouchableOpacity
                  onPress={handleMarkAllRead}
                  disabled={notifications.length === 0}
                >
                  <Text style={styles.markReadText}>Mark all read</Text>
                </TouchableOpacity>
              </View>

              {notifications.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons
                    name='notifications-off-outline'
                    size={18}
                    color={theme.colors.text.secondary}
                  />
                  <Text style={styles.emptyText}>No notifications yet</Text>
                </View>
              ) : (
                <ScrollView
                  style={[styles.list, { maxHeight: listMaxHeight }]}
                  showsVerticalScrollIndicator
                  persistentScrollbar
                >
                  {notifications.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.item}
                      onPress={() => markNotificationRead(item.id)}
                      activeOpacity={0.85}
                    >
                      <View style={styles.itemTextBlock}>
                        <Text style={styles.itemTitle}>{item.title}</Text>
                        <Text style={styles.itemBody}>{item.body}</Text>
                        <Text style={styles.itemTime}>
                          {getRelativeTime(item.createdAt)}
                        </Text>
                      </View>
                      {!item.readAt ? <View style={styles.unreadDot} /> : null}
                    </TouchableOpacity>
                  ))}
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
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.16)',
    alignItems: 'flex-end',
    paddingTop: 92,
    paddingRight: 12,
  },
  panel: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E7EAF2',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    paddingVertical: 8,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF1F7',
  },
  markReadText: {
    color: theme.colors.primary,
    fontSize: 15,
    fontWeight: '800',
  },
  list: {
    minHeight: 120,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F5FA',
  },
  itemTextBlock: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.text.primary,
    marginBottom: 2,
  },
  itemBody: {
    fontSize: 10,
    color: theme.colors.text.secondary,
    lineHeight: 15,
  },
  itemTime: {
    marginTop: 5,
    fontSize: 10,
    color: '#8E95A3',
    fontWeight: '500',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
    marginTop: 5,
  },
  emptyState: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 26,
  },
  emptyText: {
    color: theme.colors.text.secondary,
    fontSize: 13,
    fontWeight: '500',
  },
});
