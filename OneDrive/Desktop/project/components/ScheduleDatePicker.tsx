import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { X, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { theme } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

type ScheduleDatePickerProps = {
  visible: boolean;
  onClose: () => void;
  onSelectDate: (date: Date) => void;
  workingHours: {
    start: string;
    end: string;
    closed: boolean;
  };
  excludeAppointmentId?: string;
};

type DateAvailability = {
  date: string;
  hasFreeSlots: boolean;
};

export default function ScheduleDatePicker({
  visible,
  onClose,
  onSelectDate,
  workingHours,
  excludeAppointmentId,
}: ScheduleDatePickerProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [availability, setAvailability] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setAvailability({});
      loadMonthAvailability();
    } else {
      setAvailability({});
      setLoading(false);
    }
  }, [visible, currentMonth]);

  const loadMonthAvailability = async () => {
    setLoading(true);
    try {
      const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

      let query = supabase
        .from('appointments')
        .select('appointment_date, start_time, end_time')
        .gte('appointment_date', formatLocalDate(startOfMonth))
        .lte('appointment_date', formatLocalDate(endOfMonth))
        .neq('status', 'cancelled');

      if (excludeAppointmentId) {
        query = query.neq('id', excludeAppointmentId);
      }

      const { data: appointments, error } = await query;

      if (error) throw error;

      const { data: salonInfo, error: salonError } = await supabase
        .from('salon_info')
        .select('working_hours_json')
        .maybeSingle();

      if (salonError) throw salonError;

      console.log('\n🏢 SALON WORKING HOURS FROM DATABASE:');
      console.log(JSON.stringify(salonInfo?.working_hours_json, null, 2));

      const availabilityMap: Record<string, boolean> = {};
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

      const totalDays = Math.ceil((endOfMonth.getTime() - startOfMonth.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      console.log(`\n📅 PROCESSING ${totalDays} DAYS from ${formatLocalDate(startOfMonth)} to ${formatLocalDate(endOfMonth)}`);

      for (let i = 0; i < totalDays; i++) {
        const d = new Date(startOfMonth);
        d.setDate(startOfMonth.getDate() + i);

        const dateStr = formatLocalDate(d);
        const jsDay = d.getDay();
        const dayOfWeek = dayNames[jsDay];
        const dayHours = salonInfo?.working_hours_json?.[dayOfWeek];

        console.log(`\n📌 Day ${i + 1}: ${dateStr} - JS getDay()=${jsDay} -> dayName='${dayOfWeek}'`);
        console.log(`   Working hours for ${dayOfWeek}:`, dayHours);

        if (!dayHours || dayHours.closed === true) {
          console.log(`   ❌ CLOSED (closed=${dayHours?.closed}, no hours=${!dayHours})`);
          availabilityMap[dateStr] = false;
          continue;
        }

        const hours = {
          start: dayHours.start || '09:00',
          end: dayHours.end || '18:00',
          closed: false,
        };

        const dayAppointments = appointments?.filter(apt => apt.appointment_date === dateStr) || [];
        const hasFreeSlots = checkIfHasFreeSlots(dayAppointments, hours, dateStr);
        availabilityMap[dateStr] = hasFreeSlots;
      }

      console.log('AVAILABILITY MAP:', availabilityMap);
      console.log('Setting availability state with', Object.keys(availabilityMap).length, 'dates');
      setAvailability(availabilityMap);
      console.log('After setAvailability, loading will be set to false');
    } catch (error) {
      console.error('Error loading availability:', error);
    } finally {
      setLoading(false);
      console.log('Loading set to FALSE');
    }
  };

  const checkIfHasFreeSlots = (dayAppointments: any[], hours: { start: string; end: string }, dateStr?: string) => {
    const [startHour, startMinute] = hours.start.split(':').map(Number);
    const [endHour, endMinute] = hours.end.split(':').map(Number);

    const workStartMinutes = startHour * 60 + startMinute;
    const workEndMinutes = endHour * 60 + endMinute;

    const occupiedSlots: Array<[number, number]> = dayAppointments.map(apt => {
      const [sHour, sMinute] = apt.start_time.split(':').map(Number);
      const [eHour, eMinute] = apt.end_time.split(':').map(Number);
      return [sHour * 60 + sMinute, eHour * 60 + eMinute];
    });

    if (dateStr) {
      console.log(`\n=== CHECKING ${dateStr} ===`);
      console.log('Work hours:', hours.start, '-', hours.end);
      console.log('Appointments:', dayAppointments.length);
      console.log('Occupied slots:', occupiedSlots);
    }

    let freeSlotFound = false;
    for (let time = workStartMinutes; time < workEndMinutes - 30; time += 30) {
      const isFree = !occupiedSlots.some(([start, end]) =>
        time >= start && time < end
      );
      if (isFree) {
        if (dateStr) console.log(`FREE SLOT at ${Math.floor(time/60)}:${(time%60).toString().padStart(2,'0')}`);
        freeSlotFound = true;
        break;
      }
    }

    if (dateStr) console.log('Result:', freeSlotFound ? 'HAS FREE SLOTS' : 'FULLY BOOKED');
    return freeSlotFound;
  };

  const getDaysInMonth = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const days = [];
    const firstDayOfWeek = firstDay.getDay();
    const adjustedFirstDay = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

    for (let i = 0; i < adjustedFirstDay; i++) {
      days.push(null);
    }

    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day);
      days.push(date);
    }

    while (days.length % 7 !== 0) {
      days.push(null);
    }

    return days;
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const handleSelectDate = (date: Date) => {
    console.log('ScheduleDatePicker - Selected date object:', date);
    console.log('ScheduleDatePicker - Date ISO string:', date.toISOString());
    console.log('ScheduleDatePicker - Date local string:', date.toLocaleDateString());
    onSelectDate(date);
    onClose();
  };

  const days = getDaysInMonth();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const monthNames = [
    'Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни',
    'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември'
  ];

  return (
    <Modal
      key={`calendar-${currentMonth.toISOString()}`}
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Изберете дата</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.monthSelector}>
            <TouchableOpacity onPress={handlePrevMonth} style={styles.monthButton}>
              <ChevronLeft size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={styles.monthText}>
              {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </Text>
            <TouchableOpacity onPress={handleNextMonth} style={styles.monthButton}>
              <ChevronRight size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.weekDays}>
            {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map((day) => (
              <Text key={day} style={styles.weekDay}>{day}</Text>
            ))}
          </View>

          <ScrollView style={styles.calendar}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Зареждане...</Text>
              </View>
            ) : (
              <View style={styles.daysGrid}>
                {days.map((date, index) => {
                if (!date) {
                  return <View key={`empty-${index}`} style={styles.emptyDay} />;
                }

                const dateStr = formatLocalDate(date);
                const isPast = date < today;
                const isToday = date.getTime() === today.getTime();
                const dayOfWeek = date.getDay();
                const isSunday = dayOfWeek === 0;

                let dayStyleArray = [styles.dayButton];
                let textStyleArray = [styles.dayText];
                let isDisabled = false;

                if (isPast) {
                  dayStyleArray.push(styles.pastDay);
                  textStyleArray = [styles.pastDayText];
                  isDisabled = true;
                } else if (isToday) {
                  dayStyleArray.push(styles.todayDay);
                  textStyleArray = [styles.todayDayText];
                } else if (isSunday) {
                  dayStyleArray.push(styles.unavailableDay);
                  textStyleArray = [styles.unavailableDayText];
                  isDisabled = true;
                } else {
                  const hasFreeSlots = availability[dateStr];
                  console.log(`🔍 Date: ${dateStr}, Day: ${dayOfWeek}, hasFreeSlots:`, hasFreeSlots);
                  if (hasFreeSlots === true) {
                    dayStyleArray.push(styles.availableDay);
                    textStyleArray = [styles.availableDayText];
                  } else {
                    dayStyleArray.push(styles.unavailableDay);
                    textStyleArray = [styles.unavailableDayText];
                    isDisabled = true;
                  }
                }

                return (
                  <TouchableOpacity
                    key={dateStr}
                    style={dayStyleArray}
                    onPress={() => !isDisabled && handleSelectDate(date)}
                    disabled={isDisabled}
                  >
                    <Text style={textStyleArray}>
                      {date.getDate()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              </View>
            )}
          </ScrollView>

          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#4CAF50' }]} />
              <Text style={styles.legendText}>Свободни часове</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#F44336' }]} />
              <Text style={styles.legendText}>Заети</Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    width: '92%',
    maxWidth: 380,
    maxHeight: '80%',
    ...theme.shadows.luxury,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
  },
  title: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.text,
  },
  closeButton: {
    padding: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.cream,
  },
  monthSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
  },
  monthButton: {
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.champagne,
  },
  monthText: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  weekDays: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    backgroundColor: theme.colors.cream,
  },
  weekDay: {
    flex: 1,
    textAlign: 'center',
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
    color: theme.colors.textLight,
    letterSpacing: theme.letterSpacing.wide,
  },
  calendar: {
    backgroundColor: theme.colors.surface,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
  },
  emptyDay: {
    width: '14.28%',
    aspectRatio: 1,
  },
  dayButton: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: theme.borderRadius.sm,
  },
  dayText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  pastDay: {
    backgroundColor: theme.colors.borderLight,
    opacity: 0.5,
  },
  pastDayText: {
    color: theme.colors.textMuted,
  },
  todayDay: {
    borderWidth: 2,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.champagne,
  },
  todayDayText: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  availableDay: {
    backgroundColor: theme.colors.success,
  },
  availableDayText: {
    color: theme.colors.surface,
    fontWeight: '700',
  },
  unavailableDay: {
    backgroundColor: theme.colors.error,
  },
  unavailableDayText: {
    color: theme.colors.surface,
    fontWeight: '600',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.cream,
    borderBottomLeftRadius: theme.borderRadius.xl,
    borderBottomRightRadius: theme.borderRadius.xl,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
    color: theme.colors.textLight,
  },
  loadingContainer: {
    padding: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textMuted,
  },
});
