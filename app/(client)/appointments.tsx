import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Calendar, Clock, X, Phone } from 'lucide-react-native';
import { theme } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';

type Appointment = {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  services: {
    name: string;
    duration_minutes: number;
    price: number;
  };
  notes: string | null;
};

export default function AppointmentsScreen() {
  console.log("🟡 CLIENT APPOINTMENTS: VERSION 2.0 - Real-time added");
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user?.id) {
      loadAppointments();

      // Real-time subscription for appointments
      const appointmentsChannel = supabase
        .channel('client_appointments_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'appointments',
            filter: `client_id=eq.${user.id}`,
          },
          (payload) => {
            console.log("🔴 CLIENT APPOINTMENTS REAL-TIME EVENT:", payload.eventType, payload.new);
            loadAppointments();
          }
        )
        .subscribe((status) => {
        console.log('🟡 Client Appointments: Subscription status:', status);
      });

      return () => {
        supabase.removeChannel(appointmentsChannel);
      };
    }
  }, [user?.id]);

  const loadAppointments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          start_time,
          end_time,
          status,
          notes,
          services (
            name,
            duration_minutes,
            price
          )
        `)
        .eq('client_id', user?.id)
        .eq('status', 'confirmed')
        .gte('appointment_date', new Date().toISOString().split('T')[0])
        .order('appointment_date', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;

      setAppointments(data || []);
    } catch (error) {
      console.error('Error loading appointments:', error);
      Alert.alert('Грешка', 'Неуспешно зареждане на резервации');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAppointments();
  };

  const handleCancelAppointment = (appointmentId: string) => {
    Alert.alert(
      'Отказ на резервация',
      'Сигурни ли сте, че искате да откажете тази резервация?',
      [
        { text: 'Не', style: 'cancel' },
        {
          text: 'Да',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('appointments')
                .update({ status: 'cancelled' })
                .eq('id', appointmentId);

              if (error) throw error;

              Alert.alert('Успех', 'Резервацията е отказана');
              loadAppointments();
            } catch (error) {
              console.error('Error cancelling appointment:', error);
              Alert.alert('Грешка', 'Неуспешен отказ на резервация');
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    const dayNames = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const dayName = dayNames[date.getDay()];
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2);
    return `${dayName}, ${day}.${month}.${year}г.`;
  };

  const formatTime = (timeString: string) => {
    return timeString.substring(0, 5);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient
        colors={theme.gradients.primary}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <Text style={styles.headerTitle}>Моите резервации</Text>
        <Text style={styles.headerSubtitle}>
          {appointments.length} предстоящи
        </Text>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading && appointments.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Calendar size={64} color={theme.colors.textMuted} />
            <Text style={styles.emptyText}>Зареждане...</Text>
          </View>
        ) : appointments.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Calendar size={64} color={theme.colors.textMuted} />
            <Text style={styles.emptyText}>Няма предстоящи резервации</Text>
            <Text style={styles.emptySubtext}>
              Заяви час от раздел "Заяви час"
            </Text>
          </View>
        ) : (
          appointments.map((appointment) => (
            <View key={appointment.id} style={styles.appointmentCard}>
              <View style={styles.appointmentHeader}>
                <View style={styles.dateContainer}>
                  <Calendar size={20} color={theme.colors.primary} />
                  <Text style={styles.dateText}>
                    {formatDate(appointment.appointment_date)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => handleCancelAppointment(appointment.id)}
                >
                  <X size={20} color={theme.colors.error} />
                </TouchableOpacity>
              </View>

              <View style={styles.appointmentDetails}>
                <View style={styles.detailRow}>
                  <Clock size={18} color={theme.colors.textMuted} />
                  <Text style={styles.detailText}>
                    {formatTime(appointment.start_time)} - {formatTime(appointment.end_time)}
                  </Text>
                </View>

                <Text style={styles.serviceName}>
                  {appointment.services.name}
                </Text>

                <View style={styles.priceRow}>
                  <Text style={styles.durationText}>
                    {appointment.services.duration_minutes} мин
                  </Text>
                  <Text style={styles.priceText}>
                    {appointment.services.price} лв
                  </Text>
                </View>

                {appointment.notes && (
                  <View style={styles.notesContainer}>
                    <Text style={styles.notesLabel}>Бележки:</Text>
                    <Text style={styles.notesText}>{appointment.notes}</Text>
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={styles.contactButton}
                onPress={() => Alert.alert('Обаждане', 'Функционалност за обаждане')}
              >
                <Phone size={16} color={theme.colors.surface} />
                <Text style={styles.contactButtonText}>Свържи се със салона</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.surface,
    marginBottom: theme.spacing.xs,
  },
  headerSubtitle: {
    fontSize: 14,
    color: theme.colors.surface + 'CC',
  },
  content: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xl * 3,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textMuted,
    marginTop: theme.spacing.lg,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.sm,
  },
  appointmentCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  appointmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  cancelButton: {
    padding: theme.spacing.xs,
  },
  appointmentDetails: {
    marginBottom: theme.spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  detailText: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  serviceName: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginVertical: theme.spacing.sm,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  durationText: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  priceText: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  notesContainer: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.xs,
  },
  notesText: {
    fontSize: 14,
    color: theme.colors.text,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  contactButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.surface,
  },
});
