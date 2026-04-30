import * as SecureStore from 'expo-secure-store';
import { supabase } from './api/supabaseClient';

const STORAGE_KEY_PREFIX = 'officeorbit_notifications_v1';
const MAX_NOTIFICATIONS = 75;
const DEDUPE_WINDOW_MS = 15 * 60 * 1000;
const MAX_AGE_MS = 10 * 24 * 60 * 60 * 1000;

export type AppNotificationType =
    | 'attendance'
    | 'location'
    | 'automation'
    | 'system';

export interface AppNotification {
    id: string;
    title: string;
    body: string;
    type: AppNotificationType;
    createdAt: string;
    readAt: string | null;
}

type NotificationsListener = (notifications: AppNotification[]) => void;

const listeners = new Set<NotificationsListener>();

const notifyListeners = (notifications: AppNotification[]) => {
    listeners.forEach((listener) => listener(notifications));
};

const applyRetentionPolicy = (notifications: AppNotification[]) => {
    const now = Date.now();
    return notifications
        .filter((item) => now - new Date(item.createdAt).getTime() <= MAX_AGE_MS)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, MAX_NOTIFICATIONS);
};

const safeParse = (raw: string | null): AppNotification[] => {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .filter((item) => item && typeof item.id === 'string')
            .map((item) => ({
                id: String(item.id),
                title: String(item.title ?? ''),
                body: String(item.body ?? ''),
                type: (item.type as AppNotificationType) ?? 'system',
                createdAt: String(item.createdAt ?? new Date().toISOString()),
                readAt: item.readAt ? String(item.readAt) : null,
            }));
    } catch {
        return [];
    }
};

const getStorageKey = async () => {
    const { data } = await supabase.auth.getUser();
    const userId = data?.user?.id;
    return userId ? `${STORAGE_KEY_PREFIX}_${userId}` : `${STORAGE_KEY_PREFIX}_guest`;
};

const saveNotifications = async (notifications: AppNotification[]) => {
    const retained = applyRetentionPolicy(notifications);
    const storageKey = await getStorageKey();
    await SecureStore.setItemAsync(storageKey, JSON.stringify(retained));
    notifyListeners(retained);
};

export const getNotifications = async (): Promise<AppNotification[]> => {
    const storageKey = await getStorageKey();
    const raw = await SecureStore.getItemAsync(storageKey);
    const notifications = applyRetentionPolicy(safeParse(raw));
    return notifications;
};

export const addNotification = async (
    payload: Omit<AppNotification, 'id' | 'createdAt' | 'readAt'>
) => {
    const existing = await getNotifications();
    const now = Date.now();
    const duplicate = existing.find((item) => {
        if (item.title !== payload.title || item.body !== payload.body) return false;
        const age = now - new Date(item.createdAt).getTime();
        return age >= 0 && age < DEDUPE_WINDOW_MS;
    });

    if (duplicate) {
        return duplicate;
    }

    const next: AppNotification = {
        id: `${now}_${Math.random().toString(36).slice(2, 10)}`,
        title: payload.title,
        body: payload.body,
        type: payload.type,
        createdAt: new Date(now).toISOString(),
        readAt: null,
    };

    const updated = [next, ...existing];
    await saveNotifications(updated);
    return next;
};

export const markNotificationRead = async (id: string) => {
    const existing = await getNotifications();
    const updated = existing.map((item) =>
        item.id === id && !item.readAt ? { ...item, readAt: new Date().toISOString() } : item
    );
    await saveNotifications(updated);
};

export const markAllNotificationsRead = async () => {
    const existing = await getNotifications();
    const nowIso = new Date().toISOString();
    const updated = existing.map((item) => (item.readAt ? item : { ...item, readAt: nowIso }));
    await saveNotifications(updated);
};

export const getUnreadNotificationsCount = async () => {
    const existing = await getNotifications();
    return existing.filter((item) => !item.readAt).length;
};

export const subscribeNotifications = (listener: NotificationsListener) => {
    listeners.add(listener);
    getNotifications().then(listener).catch(() => listener([]));
    return () => {
        listeners.delete(listener);
    };
};
