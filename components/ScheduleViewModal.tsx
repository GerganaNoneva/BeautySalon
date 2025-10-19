import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Calendar, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { theme } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type TimeSlot = {
  time: string;
  isAvailable: boolean;
};

type ScheduleViewModalProps = {
  visible: boolean;
  onClose: () => void;
  onSelectSlot: (date: string, time: string) => void;
  serviceDuration: number;
};

export default function ScheduleViewModal({
  visible,
  onClose,
  onSelectSlot,
  serviceDuration,
}: ScheduleViewModalProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [workingHours, setWorkingHours] = useState<any>(null);

  useEffect(() => {
    if (visible) {
      loadWorkingHours();
    }
  }, [visible]);

  useEffect(() => {
    if (workingHours) {
      loadSchedule();
    }
  }, [selectedDate, workingHours]);

  const loadWorkingHours = async () => {
    try {
      const { data } = await supabase
        .from('salon_info')
        .select('working_hours_json')
        .maybeSingle();

      if (data?.working_hours_json) {
        setWorkingHours(data.working_hours_json);
      }
    } catch (error) {
      console.error('Error loading working hours:', error);
    }
  };

  const loadSchedule = async () => {
    setLoading(true);
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      const dayOfWeek = selectedDate.getDay();
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayHours = workingHours[dayNames[dayOfWeek]];

      if (!dayHours || dayHours.closed) {
        setTimeSlots([]);
        return;
      }

      const { data: appointments } = await supabase
        .from('appointments')
        .select('start_time, end_time')
        .eq('appointment_date', dateStr)
        .neq('status', 'cancelled');

      const slots: TimeSlot[] = [];
      const [startHour, startMinute] = dayHours.start.split(':').map(Number);
      const [endHour, endMinute] = dayHours.end.split(':').map(Number);

      const startTotalMinutes = startHour * 60 + startMinute;
      const endTotalMinutes = endHour * 60 + endMinute;

      for (let totalMinutes = startTotalMinutes; totalMinutes + serviceDuration <= endTotalMinutes; totalMinutes += 30) {
        const hour = Math.floor(totalMinutes / 60);
        const minute = totalMinutes % 60;
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

        const isAvailable = !appointments?.some((apt) => {
          const aptStartMinutes = timeToMinutes(apt.start_time);
          const aptEndMinutes = timeToMinutes(apt.end_time);
          const slotEndMinutes = totalMinutes + serviceDuration;

          return (
            (totalMinutes >= aptStartMinutes && totalMinutes < aptEndMinutes) ||
            (slotEndMinutes > aptStartMinutes && slotEndMinutes <= aptEndMinutes) ||
            (totalMinutes <= aptStartMinutes && slotEndMinutes >= aptEndMinutes)
          );
        });

        slots.push({ time: timeStr, isAvailable });
      }

      setTimeSlots(slots);
    } catch (error) {
      console.error('Error loading schedule:', error);
    } finally {
      setLoading(false);
    }
  };

  const timeToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const handlePreviousDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
  };

  const handleNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    setSelectedDate(newDate);
  };

  const handleSlotPress = (slot: TimeSlot) => {
    if (slot.isAvailable) {
      const dateStr = selectedDate.toISOString().split('T')[0];
      onSelectSlot(dateStr, slot.time);
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <LinearGradient
            colors={theme.gradients.primary}
            style={styles.modalHeader}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.modalTitle}>Графика</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={theme.colors.surface} />
            </TouchableOpacity>
          </LinearGradient>

          <View style={styles.dateNavigation}>
            <TouchableOpacity onPress={handlePreviousDay} style={styles.navButton}>
              <ChevronLeft size={24} color={theme.colors.primary} />
            </TouchableOpacity>

            <View style={styles.dateDisplay}>
              <Calendar size={20} color={theme.colors.primary} />
              <Text style={styles.dateText}>
                {selectedDate.toLocaleDateString('bg-BG', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long'
                })}
              </Text>
            </View>

            <TouchableOpacity onPress={handleNextDay} style={styles.navButton}>
              <ChevronRight size={24} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
          ) : timeSlots.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Салонът е затворен в този ден</Text>
            </View>
          ) : (
            <ScrollView style={styles.slotsContainer}>
              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: theme.colors.success }]} />
                  <Text style={styles.legendText}>Свободен</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: theme.colors.error }]} />
                  <Text style={styles.legendText}>Зает</Text>
                </View>
              </View>

              <View style={styles.slotsGrid}>
                {timeSlots.map((slot, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.slotCard,
                      {
                        backgroundColor: slot.isAvailable
                          ? theme.colors.success + '20'
                          : theme.colors.error + '20',
                        borderColor: slot.isAvailable
                          ? theme.colors.success
                          : theme.colors.error,
                      },
                    ]}
                    onPress={() => handleSlotPress(slot)}
                    disabled={!slot.isAvailable}
                  >
                    <Text
                      style={[
                        styles.slotTime,
                        {
                          color: slot.isAvailable
                            ? theme.colors.success
                            : theme.colors.error,
                        },
                      ]}
                    >
                      {slot.time}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    width: '90%',
    maxHeight: '80%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.surface,
  },
  closeButton: {
    padding: theme.spacing.xs,
  },
  dateNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  navButton: {
    padding: theme.spacing.sm,
  },
  dateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    textTransform: 'capitalize',
  },
  loadingContainer: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  slotsContainer: {
    flex: 1,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.lg,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  legendColor: {
    width: 20,
    height: 20,
    borderRadius: theme.borderRadius.sm,
  },
  legendText: {
    fontSize: 14,
    color: theme.colors.text,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  slotCard: {
    width: '30%',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    alignItems: 'center',
  },
  slotTime: {
    fontSize: 16,
    fontWeight: '600',
  },
});
