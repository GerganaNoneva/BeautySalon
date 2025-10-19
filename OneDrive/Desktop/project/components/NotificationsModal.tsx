import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { X, Bell, Calendar, Image as ImageIcon, MessageCircle, CheckCircle, Trash2, DollarSign } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { theme } from '@/constants/theme';
import { router } from 'expo-router';

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  data: any;
};

type NotificationsModalProps = {
  visible: boolean;
  onClose: () => void;
};

export default function NotificationsModal({ visible, onClose }: NotificationsModalProps) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (visible && user?.id) {
      setLoading(true);
      loadNotifications();
      const subscription = setupRealtimeSubscription();
      return () => {
        subscription.unsubscribe();
      };
    }
  }, [visible, user?.id]);

  const loadNotifications = async () => {
    if (!user?.id) {
      console.log('NotificationsModal: No user ID');
      setLoading(false);
      return;
    }

    try {
      console.log('NotificationsModal: Loading notifications for user:', user.id);
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('NotificationsModal: Error loading notifications:', error);
        throw error;
      }

      const notifList = data || [];
      const unread = notifList.filter((n) => !n.is_read).length;
      setNotifications(notifList);
      setUnreadCount(unread);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    const subscription = supabase
      .channel('notifications_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user?.id}`,
        },
        () => {
          loadNotifications();
        }
      )
      .subscribe();

    return subscription;
  };

  const handleNotificationPress = async (notification: Notification) => {
    try {
      if (!notification.is_read) {
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('id', notification.id);

        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }

      if (notification.type === 'new_message' && notification.data?.conversation_id) {
        onClose();

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user?.id)
          .single();

        if (profile?.role === 'admin') {
          router.push({
            pathname: '/(admin)/messages',
            params: { selectedConversationId: notification.data.conversation_id }
          });
        } else {
          router.push('/(client)/messages');
        }
      } else if (notification.type === 'free_slot' && notification.data?.date && notification.data?.start_time) {
        onClose();
        console.log('Navigating to booking with prefill:', notification.data.date, notification.data.start_time, notification.data.end_time);
        router.push({
          pathname: '/(client)/booking',
          params: {
            prefillDate: notification.data.date,
            prefillStartTime: notification.data.start_time,
            prefillEndTime: notification.data.end_time
          }
        });
      } else if (notification.type === 'new_photo') {
        onClose();
        router.push('/(client)/gallery');
      } else if (notification.type === 'gallery_comment' && notification.data?.photo_id) {
        onClose();
        router.push({
          pathname: '/(admin)/gallery',
          params: { scrollToPhotoId: notification.data.photo_id }
        });
      } else if (notification.type === 'new_promotion' || notification.type === 'price_change') {
        onClose();
        const promotionId = notification.data?.promotion_id;
        if (promotionId) {
          router.push({
            pathname: '/(client)/pricing',
            params: { highlightPromotionId: promotionId }
          });
        } else {
          router.push('/(client)/pricing');
        }
      }
    } catch (error) {
      console.error('Error handling notification press:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadNotifications = notifications.filter(n => !n.is_read);

      const messageNotifications = unreadNotifications.filter(n => n.type === 'new_message');
      if (messageNotifications.length > 0) {
        const messageIds = messageNotifications
          .map(n => n.data?.message_id)
          .filter(Boolean);

        if (messageIds.length > 0) {
          await supabase
            .from('messages')
            .update({ read_at: new Date().toISOString() })
            .in('id', messageIds)
            .is('read_at', null);
        }
      }

      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user?.id)
        .eq('is_read', false);

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const clearAllRead = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user?.id)
        .eq('is_read', true);

      if (error) {
        console.error('Delete error:', error);
        throw error;
      }

      setNotifications((prev) => prev.filter((n) => !n.is_read));
    } catch (error) {
      console.error('Error clearing read notifications:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'appointment_request':
      case 'appointment':
      case 'free_slot':
        return <Calendar size={24} color={theme.colors.primary} />;
      case 'message':
        return <MessageCircle size={24} color={theme.colors.primary} />;
      case 'gallery':
        return <ImageIcon size={24} color={theme.colors.primary} />;
      case 'price_change':
        return <DollarSign size={24} color={theme.colors.warning} />;
      case 'new_promotion':
        return <DollarSign size={24} color={theme.colors.accent} />;
      default:
        return <Bell size={24} color={theme.colors.primary} />;
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Сега';
    if (diffMins < 60) return `Преди ${diffMins} мин`;
    if (diffHours < 24) return `Преди ${diffHours} ч`;
    if (diffDays < 7) return `Преди ${diffDays} дни`;

    return date.toLocaleDateString('bg-BG', {
      day: 'numeric',
      month: 'short',
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>Уведомления</Text>
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.actionsContainer}>
            {unreadCount > 0 && (
              <TouchableOpacity style={styles.markAllButton} onPress={markAllAsRead}>
                <CheckCircle size={18} color={theme.colors.primary} />
                <Text style={styles.markAllText}>Маркирай всички като прочетени</Text>
              </TouchableOpacity>
            )}
            {notifications.some((n) => n.is_read) && (
              <TouchableOpacity style={styles.clearButton} onPress={clearAllRead}>
                <Trash2 size={18} color="#ef4444" />
                <Text style={styles.clearButtonText}>Изчисти всички прочетени</Text>
              </TouchableOpacity>
            )}
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
          ) : notifications.length === 0 ? (
            <View style={styles.emptyState}>
              <Bell size={48} color={theme.colors.textMuted} />
              <Text style={styles.emptyText}>Няма уведомления</Text>
            </View>
          ) : (
            <ScrollView style={styles.notificationsList}>
              {notifications.map((notification) => (
                <TouchableOpacity
                  key={notification.id}
                  style={[
                    styles.notificationItem,
                    !notification.is_read && styles.notificationItemUnread,
                  ]}
                  onPress={() => handleNotificationPress(notification)}
                >
                  <View style={styles.notificationIcon}>
                    {getNotificationIcon(notification.type)}
                  </View>
                  <View style={styles.notificationContent}>
                    <View style={styles.notificationHeader}>
                      <Text style={styles.notificationTitle}>{notification.title}</Text>
                      {!notification.is_read && <View style={styles.unreadDot} />}
                    </View>
                    <Text style={styles.notificationBody}>{notification.body}</Text>
                    <Text style={styles.notificationTime}>
                      {formatTime(notification.created_at)}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    paddingTop: 40,
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    maxHeight: '90%',
    marginHorizontal: theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  headerTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.text,
  },
  badge: {
    backgroundColor: theme.colors.error,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xs,
  },
  badgeText: {
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
    color: theme.colors.surface,
  },
  closeButton: {
    padding: theme.spacing.xs,
  },
  actionsContainer: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.accentLight,
    borderRadius: theme.borderRadius.sm,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    padding: theme.spacing.md,
    backgroundColor: '#fef2f2',
    borderRadius: theme.borderRadius.sm,
  },
  clearButtonText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: '#ef4444',
  },
  markAllText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  loadingContainer: {
    padding: theme.spacing.xxl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    padding: theme.spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.md,
  },
  notificationsList: {
    maxHeight: 500,
  },
  notificationItem: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: theme.spacing.md,
  },
  notificationItemUnread: {
    backgroundColor: theme.colors.accentLight,
  },
  notificationIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.xs,
  },
  notificationTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
  },
  notificationBody: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textLight,
    marginBottom: theme.spacing.xs,
  },
  notificationTime: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
});
