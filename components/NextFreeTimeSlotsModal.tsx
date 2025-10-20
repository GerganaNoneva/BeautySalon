import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { X, Calendar, Clock } from 'lucide-react-native';
import { theme } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type FreeSlot = {
  date: Date;
  time: string;
  dateStr: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelectSlot: (slot: FreeSlot) => void;
};

export default function NextFreeTimeSlotsModal({ visible, onClose, onSelectSlot }: Props) {
  const [freeSlots, setFreeSlots] = useState<FreeSlot[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      loadFreeSlots();
    }
  }, [visible]);

  const timeToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.substring(0, 5).split(':').map(Number);
    return hours * 60 + minutes;
  };

  const loadFreeSlots = async () => {
    setLoading(true);
    try {
      const slots: FreeSlot[] = [];
      const today = new Date();
      const now = new Date();

      // Look ahead up to 30 days
      for (let dayOffset = 0; dayOffset < 30 && slots.length < 10; dayOffset++) {
        const currentDate = new Date(today);
        currentDate.setDate(today.getDate() + dayOffset);

        const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;

        // Get working hours for this day
        const { data: salonData } = await supabase
          .from('salon_info')
          .select('working_hours_json')
          .maybeSingle();

        if (!salonData?.working_hours_json) continue;

        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayOfWeek = dayNames[currentDate.getDay()];
        const dayHours = salonData.working_hours_json[dayOfWeek];

        if (!dayHours || dayHours.closed) continue;

        const workingHours = {
          start: dayHours.start || '09:00',
          end: dayHours.end || '18:00',
          closed: dayHours.closed || false,
        };

        // Get appointments for this day
        const { data: appointments } = await supabase
          .from('appointments')
          .select('start_time::text, end_time::text')
          .eq('appointment_date', dateStr)
          .neq('status', 'cancelled');

        // Generate time slots
        const [startHour, startMinute] = workingHours.start.split(':').map(Number);
        const [endHour, endMinute] = workingHours.end.split(':').map(Number);
        const startTotalMinutes = startHour * 60 + startMinute;
        const endTotalMinutes = endHour * 60 + endMinute;

        for (let totalMinutes = startTotalMinutes; totalMinutes < endTotalMinutes && slots.length < 10; totalMinutes += 30) {
          const hour = Math.floor(totalMinutes / 60);
          const minute = totalMinutes % 60;
          const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

          // Skip if in the past
          if (dayOffset === 0) {
            const slotTime = new Date(now);
            slotTime.setHours(hour, minute, 0, 0);
            if (slotTime <= now) continue;
          }

          // Check if slot is occupied
          const isOccupied = (appointments || []).some((apt) => {
            const aptStartMinutes = timeToMinutes(apt.start_time);
            const aptEndMinutes = timeToMinutes(apt.end_time);
            return totalMinutes >= aptStartMinutes && totalMinutes < aptEndMinutes;
          });

          if (!isOccupied) {
            slots.push({
              date: new Date(currentDate),
              time: timeStr,
              dateStr,
            });
          }
        }
      }

      setFreeSlots(slots);
    } catch (error) {
      console.error('Error loading free slots:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date) => {
    const weekday = date.toLocaleDateString('bg-BG', { weekday: 'short' });
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${weekday}, ${day}.${month}`;
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isTomorrow = (date: Date) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return date.toDateString() === tomorrow.toDateString();
  };

  const getDateLabel = (date: Date) => {
    if (isToday(date)) return 'Днес';
    if (isTomorrow(date)) return 'Утре';
    return formatDate(date);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Следващи свободни часове</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.loadingText}>Търсене на свободни часове...</Text>
            </View>
          ) : freeSlots.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Няма свободни часове в следващите 30 дни</Text>
            </View>
          ) : (
            <ScrollView style={styles.slotsList} showsVerticalScrollIndicator={false}>
              {freeSlots.map((slot, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.slotCard}
                  onPress={() => {
                    onSelectSlot(slot);
                    onClose();
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.slotInfo}>
                    <View style={styles.dateInfo}>
                      <Calendar size={18} color={theme.colors.primary} />
                      <Text style={styles.dateText}>{getDateLabel(slot.date)}</Text>
                    </View>
                    <View style={styles.timeInfo}>
                      <Clock size={18} color={theme.colors.champagne} />
                      <Text style={styles.timeText}>{slot.time}</Text>
                    </View>
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    ...theme.shadows.luxury,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.text,
  },
  closeButton: {
    padding: theme.spacing.xs,
  },
  loadingContainer: {
    padding: theme.spacing.xxl,
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  loadingText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textMuted,
  },
  emptyContainer: {
    padding: theme.spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  slotsList: {
    padding: theme.spacing.md,
  },
  slotCard: {
    backgroundColor: theme.colors.cream,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.sm,
  },
  slotInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  dateText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.text,
  },
  timeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  timeText: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.champagne,
  },
});
