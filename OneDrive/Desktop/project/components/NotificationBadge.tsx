import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Bell } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { theme } from '@/constants/theme';

type NotificationBadgeProps = {
  size?: number;
  color?: string;
};

export default function NotificationBadge({ size = 24, color = theme.colors.surface }: NotificationBadgeProps) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnreadCount = async () => {
    if (!user) return;

    try {
      console.log('NotificationBadge: Loading unread count for user:', user.id);
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) {
        console.error('NotificationBadge: Error loading unread count:', error);
        throw error;
      }

      console.log('NotificationBadge: Unread count =', count);
      setUnreadCount(count || 0);
    } catch (error) {
      console.error('NotificationBadge: Error loading unread count:', error);
    }
  };

  useEffect(() => {
    if (user) {
      loadUnreadCount();

      const channelName = `notifications_badge_${user.id}_${Math.random().toString(36).substring(7)}`;
      console.log('NotificationBadge: Subscribing to channel:', channelName);

      const subscription = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload: any) => {
            console.log('NotificationBadge: Received update:', payload.eventType, payload);
            loadUnreadCount();
          }
        )
        .subscribe((status) => {
          console.log('NotificationBadge: Subscription status:', status);
        });

      return () => {
        console.log('NotificationBadge: Unsubscribing from channel:', channelName);
        subscription.unsubscribe();
      };
    }
  }, [user]);

  return (
    <View style={styles.container}>
      <Bell size={size} color={color} />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: theme.colors.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: theme.colors.surface,
  },
  badgeText: {
    color: theme.colors.surface,
    fontSize: 11,
    fontWeight: '700',
  },
});
