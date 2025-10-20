import NewReservationModal from '../../components/NewReservationModal';
import NewReservationModal2 from '../../components/NewReservationModal2';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Linking,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Calendar, Clock, Bell, X, Send, UserPlus, Pencil, Trash2, Phone, MessageCircle, Plus, Info } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import { theme } from '@/constants/theme';
import NotificationsModal from '@/components/NotificationsModal';
import FreeSlotNotificationModal from '@/components/FreeSlotNotificationModal';
import ReservationModal from '@/components/ReservationModal';
import NotificationBadge from '@/components/NotificationBadge';
import { VoiceRecorder } from '@/components/VoiceRecorder';

type Appointment = {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  client_id: string;
  service_id: string;
  notes: string | null;
  profiles: {
    full_name: string;
    phone: string;
  };
  unregistered_clients?: {
    full_name: string;
    phone: string;
  } | null;
  services: {
    name: string;
  } | null;
};

type TimeSlot = {
  time: string;
  hour: number;
  minute: number;
  isFree: boolean;
  appointment?: Appointment;
  isPartOfAppointment?: boolean;
};

type WorkingHours = {
  start: string;
  end: string;
  closed: boolean;
};

export default function AdminScheduleScreen() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingHours, setWorkingHours] = useState<WorkingHours>({ start: '09:00', end: '18:00', closed: false });
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSlotActionModal, setShowSlotActionModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [showFreeSlotModal, setShowFreeSlotModal] = useState(false);
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    loadWorkingHours();
  }, [selectedDate]);

  useEffect(() => {
    loadAppointments();
  }, [selectedDate]);

  useEffect(() => {
    generateTimeSlots();
  }, [appointments, workingHours, selectedDate]);

  const loadWorkingHours = async () => {
    try {
      const { data, error } = await supabase
        .from('salon_info')
        .select('working_hours_json')
        .maybeSingle();

      if (error) throw error;

      if (data?.working_hours_json) {
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayOfWeek = dayNames[selectedDate.getDay()];
        const dayHours = data.working_hours_json[dayOfWeek];

        if (dayHours) {
          setWorkingHours({
            start: dayHours.start || '09:00',
            end: dayHours.end || '18:00',
            closed: dayHours.closed || false,
          });
        }
      }
    } catch (error) {
      console.error('Error loading working hours:', error);
    }
  };

  const timeStringToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.substring(0, 5).split(':').map(Number);
    return hours * 60 + minutes;
  };

  const generateTimeSlots = () => {
    if (workingHours.closed) {
      setTimeSlots([]);
      return;
    }

    const slots: TimeSlot[] = [];
    const [startHour, startMinute] = workingHours.start.split(':').map(Number);
    const [endHour, endMinute] = workingHours.end.split(':').map(Number);

    const startTotalMinutes = startHour * 60 + startMinute;
    const endTotalMinutes = endHour * 60 + endMinute;

    for (let totalMinutes = startTotalMinutes; totalMinutes < endTotalMinutes; totalMinutes += 30) {
      const hour = Math.floor(totalMinutes / 60);
      const minute = totalMinutes % 60;
      const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

      const matchingAppointments = appointments.filter((apt) => {
        const aptStartMinutes = timeStringToMinutes(apt.start_time);
        const aptEndMinutes = timeStringToMinutes(apt.end_time);
        return totalMinutes >= aptStartMinutes && totalMinutes < aptEndMinutes;
      });

      const appointment = matchingAppointments[0];
      const isStartOfAppointment = appointment && timeStringToMinutes(appointment.start_time) === totalMinutes;

      if (matchingAppointments.length > 1 && isStartOfAppointment) {
        console.warn(`⚠️ OVERLAP DETECTED at ${timeStr}: ${matchingAppointments.length} appointments!`);
        matchingAppointments.forEach(apt => {
          console.warn(`  - ${apt.start_time} to ${apt.end_time} (${apt.services?.name})`);
        });
      }

      slots.push({
        time: timeStr,
        hour,
        minute,
        isFree: !appointment,
        appointment: isStartOfAppointment ? appointment : undefined,
        isPartOfAppointment: !!appointment && !isStartOfAppointment,
      });
    }

    setTimeSlots(slots);
  };

  const loadAppointments = async () => {
    try {
      setAppointments([]);
      const localDate = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate()
      );
      // use local date string instead of UTC ISO conversion
      const dateStr = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;

      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id,
          client_id,
          unregistered_client_id,
          service_id,
          appointment_date,
          start_time::text,
          end_time::text,
          client_message,
          status,
          notes,
          created_at,
          updated_at,
          profiles!appointments_client_id_fkey(full_name, phone),
          unregistered_clients!appointments_unregistered_client_id_fkey(full_name, phone),
          services(name)
        `)
        .eq('appointment_date', dateStr)
        .order('start_time');

      if (error) throw error;
      console.log('📅 Loaded appointments:', data);
      if (data && data.length > 0) {
        console.log('📋 First appointment:', JSON.stringify(data[0], null, 2));
      }
      setAppointments(
        (data || []).map((apt: any) => ({
          ...apt,
          profiles: Array.isArray(apt.profiles) ? apt.profiles[0] : apt.profiles,
          services: Array.isArray(apt.services) ? apt.services[0] : apt.services,
          unregistered_clients: Array.isArray(apt.unregistered_clients)
            ? apt.unregistered_clients[0]
            : apt.unregistered_clients,
        })) as Appointment[]
      );
    } catch (error) {
      console.error('Error loading appointments:', error);
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  };

  const changeDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setLoading(true);
    setAppointments([]);
    setTimeSlots([]);
    setSelectedDate(newDate);
  };

  const generateAllTimeSlots = (hours: { start: string; end: string; closed: boolean }) => {
    if (hours.closed) return [];
    const slots: string[] = [];
    const [startHour, startMinute] = hours.start.split(':').map(Number);
    const [endHour, endMinute] = hours.end.split(':').map(Number);
    const startTotalMinutes = startHour * 60 + startMinute;
    const endTotalMinutes = endHour * 60 + endMinute;

    for (let totalMinutes = startTotalMinutes; totalMinutes < endTotalMinutes; totalMinutes += 30) {
      const hour = Math.floor(totalMinutes / 60);
      const minute = totalMinutes % 60;
      slots.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
    }
    return slots;
  };

  const timeToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const formatDate = (date: Date) => {
    const weekdayShort = date.toLocaleDateString('bg-BG', { weekday: 'short' });
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2);
    return `${weekdayShort}, ${day}.${month}.${year}г.`;
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setShowDatePicker(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return theme.colors.champagne;
      case 'pending':
        return theme.colors.warning;
      case 'cancelled':
        return theme.colors.error;
      default:
        return theme.colors.textMuted;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'Потвърдена';
      case 'pending':
        return 'Изчаква';
      case 'cancelled':
        return 'Отказана';
      default:
        return status;
    }
  };

  const handleSlotPress = (slot: TimeSlot) => {
    if (slot.isPartOfAppointment) return;
    setSelectedSlot(slot);
    setShowSlotActionModal(true);
  };

  const handleNotificationChoice = () => {
    setShowSlotActionModal(false);
    setShowFreeSlotModal(true);
  };

  const handleReservationChoice = () => {
    setShowSlotActionModal(false);
    setShowNewReservationModal(true);
  };

  const [showNewReservationModal, setShowNewReservationModal] = React.useState<boolean>(false);
  const [showNewReservationModal2, setShowNewReservationModal2] = React.useState<boolean>(false);

  React.useEffect(() => {
    setShowNewReservationModal(false);
    setShowNewReservationModal2(false);
  }, []);

  const handleVoiceTranscription = (data: { text: string; parsed: any }) => {
  };

  const handleCallClient = (phone: string) => {
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    } else {
      Alert.alert('Грешка', 'Няма телефонен номер за този клиент');
    }
  };

  const handleSendSMS = (phone: string) => {
    if (phone) {
      Linking.openURL(`sms:${phone}`);
    } else {
      Alert.alert('Грешка', 'Няма телефонен номер за този клиент');
    }
  };

  const handleMessageClient = async (appointment: Appointment) => {
    if (!appointment.client_id) {
      Alert.alert('Информация', 'Клиентът не е регистриран');
      return;
    }

    try {
      if (!user?.id) {
        Alert.alert('Грешка', 'Не сте влезли в системата');
        return;
      }

      console.log('Admin user.id:', user.id);
      console.log('Client profile id:', appointment.client_id);

      const { data: clientProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', appointment.client_id)
        .maybeSingle();

      console.log('Client profile:', clientProfile, 'Error:', profileError);

      if (profileError) {
        console.error('Profile error:', profileError);
        throw profileError;
      }

      if (!clientProfile?.id) {
        Alert.alert('Информация', 'Клиентът няма потребителски акаунт');
        return;
      }

      const clientUserId = clientProfile.id;
      console.log('Client user_id:', clientUserId);
      console.log('Searching for conversation between admin:', user.id, 'and client:', clientUserId);

      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .select('id')
        .eq('admin_id', user.id)
        .eq('client_id', clientUserId)
        .maybeSingle();

      console.log('Conversation found:', conversation, 'Error:', convError);

      if (convError) {
        console.error('Conversation error:', convError);
        throw convError;
      }

      if (conversation) {
        console.log('Navigating to existing conversation:', conversation.id);
        router.push(`/(admin)/messages?conversationId=${conversation.id}`);
      } else {
        console.log('Creating new chat with:', clientUserId);
        router.push(`/(admin)/messages?newChat=${clientUserId}`);
      }
    } catch (error) {
      console.error('Error opening chat:', error);
      Alert.alert('Грешка', 'Неуспешно отваряне на чат');
    }
  };

  const handleEditAppointment = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    setShowReservationModal(true);
  };


  const handleDeleteAppointment = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    setCancelReason('');
    setShowCancelModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!editingAppointment) return;

    try {
      console.log('[Delete] Deleting appointment:', editingAppointment.id);

      const { error, data } = await supabase
        .from('appointments')
        .delete()
        .eq('id', editingAppointment.id)
        .select();

      console.log('[Delete] Response:', { data, error });

      if (error) {
        console.error('[Delete] Error:', error);
        Alert.alert('Грешка', `Неуспешно изтриване: ${error.message}`);
        return;
      }

      let isRegisteredClient = false;
      let clientNotified = false;

      if (editingAppointment.client_id) {
        isRegisteredClient = true;

        let notificationBody = `Вашата резервация за ${editingAppointment.services?.name} на ${selectedDate.toLocaleDateString('bg-BG')} в ${editingAppointment.start_time.slice(0, 5)} е отменена.`;

        if (cancelReason.trim()) {
          notificationBody += `\n\nПричина: ${cancelReason}`;
        }

        const { error: notifError } = await supabase
          .from('notifications')
          .insert({
            user_id: editingAppointment.client_id,
            type: 'booking_cancelled',
            title: 'Резервацията е отменена',
            body: notificationBody,
          });

        if (notifError) {
          console.error('[Delete] Notification error:', notifError);
        } else {
          clientNotified = true;
        }
      }

      setShowCancelModal(false);
      setCancelReason('');
      await loadAppointments();

      const message = isRegisteredClient && clientNotified
        ? 'Резервацията е отменена и клиентът е уведомен'
        : 'Резервацията е отменена';

      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('Успех', message);
      }
    } catch (error: any) {
      console.error('[Delete] Exception:', error);
      if (Platform.OS === 'web') {
        window.alert(`Грешка: ${error?.message || 'Неизвестна грешка'}`);
      } else {
        Alert.alert('Грешка', `Грешка: ${error?.message || 'Неизвестна грешка'}`);
      }
    }
  };

  const calculateSlotHeight = (appointment: Appointment): number => {
    const startMinutes = timeStringToMinutes(appointment.start_time);
    const endMinutes = timeStringToMinutes(appointment.end_time);
    const durationMinutes = endMinutes - startMinutes;
    const slots = durationMinutes / 30;
    const cellHeight = 80;
    const marginBottom = 4;
    const totalHeight = (slots * cellHeight) - marginBottom;
    return totalHeight;
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={theme.gradients.primary} style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>График</Text>
            <Text style={styles.headerSubtitle}>Управление на часове</Text>
          </View>
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={() => setShowNotifications(true)}
          >
            <NotificationBadge size={24} color={theme.colors.surface} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={styles.voiceContainer}>
        <TouchableOpacity
          style={styles.voiceActionButton}
          onPress={() => setShowNewReservationModal2(true)}
        >
          <Plus size={24} color={theme.colors.primary} />
        </TouchableOpacity>

        <VoiceRecorder onTranscriptionComplete={handleVoiceTranscription} />

        <TouchableOpacity
          style={styles.voiceActionButton}
          onPress={() =>
            Alert.alert(
              'Гласови резервации',
              'Можете да използвате микрофона за гласови резервации. Кажете име на клиент, услуга, дата и час.'
            )
          }
        >
          <Info size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.dateSelector}>
        <TouchableOpacity style={styles.dateButton} onPress={() => changeDate(-1)}>
          <Text style={styles.dateButtonText}>←</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dateDisplay}
          onPress={() => setShowDatePicker(true)}
          activeOpacity={0.7}
        >
          <Calendar size={20} color={theme.colors.primary} />
          <Text style={styles.dateText}>{formatDate(selectedDate)}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.dateButton} onPress={() => changeDate(1)}>
          <Text style={styles.dateButtonText}>→</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : workingHours.closed ? (
        <View style={styles.closedContainer}>
          <Text style={styles.closedText}>Почивен ден</Text>
        </View>
      ) : (
        <ScrollView style={styles.scheduleContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.scheduleGrid}>
            <View style={styles.timeColumn}>
              <View style={styles.gridHeader}>
                <Clock size={16} color={theme.colors.primary} />
                <Text style={styles.headerText}>Час</Text>
              </View>
              {generateAllTimeSlots(workingHours).map((time, index) => (
                <View key={`time-${time}`} style={styles.timeCell}>
                  <Text style={styles.timeText}>{time}</Text>
                </View>
              ))}
            </View>

            <View style={styles.appointmentsColumn}>
              <View style={styles.gridHeader}>
                <Text style={styles.headerText}>Резервации</Text>
              </View>
              <View style={styles.gridContent}>
                {generateAllTimeSlots(workingHours).map((time, index) => {
                  const [hour, minute] = time.split(':').map(Number);
                  return (
                    <TouchableOpacity
                      key={`slot-${time}`}
                      style={styles.gridSlot}
                      onPress={() => handleSlotPress({ time, hour, minute, isFree: true, isPartOfAppointment: false })}
                    >
                      <View style={styles.gridSlotBorder} />
                    </TouchableOpacity>
                  );
                })}
                {appointments.map((appointment) => {
                  const startMinutes = timeToMinutes(appointment.start_time);
                  const endMinutes = timeToMinutes(appointment.end_time);
                  const workingStartMinutes = timeToMinutes(workingHours.start);
                  const topOffset = ((startMinutes - workingStartMinutes) / 30) * 60;
                  const height = ((endMinutes - startMinutes) / 30) * 60;
                  const profile = Array.isArray(appointment.profiles) ? appointment.profiles[0] : appointment.profiles;
                  const unregisteredClient = Array.isArray(appointment.unregistered_clients) ? appointment.unregistered_clients[0] : appointment.unregistered_clients;
                  const clientInfo = profile || unregisteredClient;
                  const isRegistered = !!appointment.client_id;
                  const service = Array.isArray(appointment.services) ? appointment.services[0] : appointment.services;

                  if (appointment.notes) {
                    console.log('📝 Appointment with notes:', {
                      id: appointment.id,
                      notes: appointment.notes,
                      notesType: typeof appointment.notes,
                      notesLength: appointment.notes?.length,
                    });
                  }

                  const durationMinutes = endMinutes - startMinutes;
                  const isShort = durationMinutes <= 30;
                  const minHeight = isShort ? height : 100;

                  return (
                    <View
                      key={appointment.id}
                      style={[
                        styles.appointmentOverlay,
                        {
                          top: topOffset,
                          height: Math.max(height, minHeight),
                        },
                      ]}
                    >
                      <View style={[styles.appointmentContent, isShort && {paddingVertical: 2}]}>
                        <View style={[styles.appointmentInfo, isShort && {padding: 2}]}>
                          <View style={[styles.clientNameRow, isShort && {marginBottom: 0}]}>
                            <Text style={[styles.clientName, isShort && {fontSize: 11, lineHeight: 13}]}>
                              {clientInfo?.full_name || 'Неизвестен клиент'}
                            </Text>
                            <View style={styles.appointmentActions}>
                              {clientInfo?.phone && (
                                <TouchableOpacity
                                  style={styles.actionIconButton}
                                  onPress={() => handleCallClient(clientInfo.phone)}
                                >
                                  <Phone size={isShort ? 18 : 21} color={theme.colors.primary} />
                                </TouchableOpacity>
                              )}
                              {isRegistered && (
                                <TouchableOpacity
                                  style={styles.actionIconButton}
                                  onPress={() => handleMessageClient(appointment)}
                                >
                                  <MessageCircle size={isShort ? 18 : 21} color={theme.colors.primary} />
                                </TouchableOpacity>
                              )}
                              {!isRegistered && clientInfo?.phone && (
                                <TouchableOpacity
                                  style={styles.actionIconButton}
                                  onPress={() => handleSendSMS(clientInfo.phone)}
                                >
                                  <MessageCircle size={isShort ? 18 : 21} color={theme.colors.primary} />
                                </TouchableOpacity>
                              )}
                              <TouchableOpacity
                                style={styles.actionIconButton}
                                onPress={() => handleEditAppointment(appointment)}
                              >
                                <Pencil size={isShort ? 18 : 21} color={theme.colors.primary} />
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.actionIconButton}
                                onPress={() => handleDeleteAppointment(appointment)}
                              >
                                <Trash2 size={isShort ? 18 : 21} color={theme.colors.error} />
                              </TouchableOpacity>
                            </View>
                          </View>
                          <Text style={[styles.serviceName, isShort && {fontSize: 9, marginBottom: 0, lineHeight: 10}]}>
                            {service?.name || 'Без услуга'}{appointment.notes ? ` - ${appointment.notes}` : ''}
                          </Text>
                          <Text style={[styles.timeRange, isShort && {fontSize: 8, lineHeight: 9}]}>
                            {appointment.start_time.slice(0, 5)} - {appointment.end_time.slice(0, 5)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        </ScrollView>
      )}

      <NotificationsModal
        visible={showNotifications}
        onClose={() => setShowNotifications(false)}
      />

      <FreeSlotNotificationModal
        visible={showFreeSlotModal}
        onClose={() => setShowFreeSlotModal(false)}
        selectedDate={selectedDate}
        startTime={selectedSlot?.time || '09:00'}
      />

      {/* New Reservation Modal from slot click */}
      <NewReservationModal
        visible={showNewReservationModal}
        onClose={() => setShowNewReservationModal(false)}
        onConfirm={() => {
          setShowNewReservationModal(false);
          loadAppointments();
        }}
        selectedDate={selectedDate}
        selectedTime={selectedSlot?.time || '09:00'}
        workingHours={workingHours}
        appointments={appointments}
      />

      {/* New Separate Reservation Modal from + button */}
      <NewReservationModal2
        visible={showNewReservationModal2}
        onClose={() => setShowNewReservationModal2(false)}
        onConfirm={(date) => {
          setShowNewReservationModal2(false);
          if (date) {
            setSelectedDate(date);
          }
          loadAppointments();
        }}
      />

      <ReservationModal
        visible={showReservationModal}
        onClose={() => {
          setShowReservationModal(false);
          setEditingAppointment(null);
        }}
        selectedDate={selectedDate}
        selectedTime={selectedSlot?.time || '09:00'}
        onSuccess={loadAppointments}
        workingHours={workingHours}
        appointments={appointments}
        editingAppointment={editingAppointment}
      />

      <Modal
        visible={showDatePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.calendarModal}>
            <View style={styles.calendarHeader}>
              <Text style={styles.calendarTitle}>Изберете дата</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                <X size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.calendarContainer}>
              {(() => {
                const year = selectedDate.getFullYear();
                const month = selectedDate.getMonth();
                const firstDay = new Date(year, month, 1);
                const lastDay = new Date(year, month + 1, 0);
                const daysInMonth = lastDay.getDate();
                const startDayOfWeek = firstDay.getDay();
                const adjustedStartDay = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

                const monthName = selectedDate.toLocaleDateString('bg-BG', { month: 'long', year: 'numeric' });
                const days = [];

                for (let i = 0; i < adjustedStartDay; i++) {
                  days.push(<View key={`empty-${i}`} style={styles.calendarDay} />);
                }

                for (let day = 1; day <= daysInMonth; day++) {
                  const date = new Date(year, month, day);
                  const isSelected = date.toDateString() === selectedDate.toDateString();
                  const isToday = date.toDateString() === new Date().toDateString();

                  days.push(
                    <TouchableOpacity
                      key={day}
                      style={[
                        styles.calendarDay,
                        isSelected && styles.calendarDaySelected,
                        isToday && !isSelected && styles.calendarDayToday,
                      ]}
                      onPress={() => handleDateSelect(date)}
                    >
                      <Text
                        style={[
                          styles.calendarDayText,
                          isSelected && styles.calendarDayTextSelected,
                        ]}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                }

                return (
                  <>
                    <View style={styles.calendarMonthHeader}>
                      <TouchableOpacity
                        onPress={() => {
                          const newDate = new Date(selectedDate);
                          newDate.setMonth(newDate.getMonth() - 1);
                          setSelectedDate(newDate);
                        }}
                        style={styles.calendarNavButton}
                      >
                        <Text style={styles.calendarNavText}>←</Text>
                      </TouchableOpacity>

                      <Text style={styles.calendarMonthText}>{monthName}</Text>

                      <TouchableOpacity
                        onPress={() => {
                          const newDate = new Date(selectedDate);
                          newDate.setMonth(newDate.getMonth() + 1);
                          setSelectedDate(newDate);
                        }}
                        style={styles.calendarNavButton}
                      >
                        <Text style={styles.calendarNavText}>→</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.calendarWeekdays}>
                      {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map((day) => (
                        <Text key={day} style={styles.calendarWeekdayText}>
                          {day}
                        </Text>
                      ))}
                    </View>

                    <View style={styles.calendarDays}>{days}</View>
                  </>
                );
              })()}
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showSlotActionModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSlotActionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.actionModalContent}>
            <Text style={styles.modalTitle}>Изберете действие</Text>
            <Text style={styles.modalSubtitle}>
              {selectedSlot && `${selectedSlot.time} - ${selectedDate.toLocaleDateString('bg-BG')}`}
            </Text>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleNotificationChoice}
            >
              <LinearGradient
                colors={theme.gradients.secondary}
                style={styles.actionButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Bell size={20} color={theme.colors.surface} />
                <Text style={styles.actionButtonText}>Пусни уведомление за свободен час</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleReservationChoice}
            >
              <LinearGradient
                colors={theme.gradients.primary}
                style={styles.actionButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <UserPlus size={20} color={theme.colors.surface} />
                <Text style={styles.actionButtonText}>Направи резервация</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowSlotActionModal(false)}
            >
              <Text style={styles.cancelButtonText}>Затвори</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showCancelModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCancelModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.actionModalContent}>
            <Text style={styles.modalTitle}>Отмяна на резервация</Text>
            {editingAppointment && (
              <Text style={styles.modalSubtitle}>
                Сигурни ли сте, че искате да отмените тази резервация?
              </Text>
            )}

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Причина (опционално):</Text>
              <TextInput
                style={[styles.timeTextInput, { height: 80, textAlignVertical: 'top' }]}
                value={cancelReason}
                onChangeText={setCancelReason}
                placeholder="Въведете причина за отмяната..."
                placeholderTextColor={theme.colors.textMuted}
                multiline
                numberOfLines={3}
              />
            </View>

            <TouchableOpacity
              style={styles.cancelAppointmentButton}
              onPress={handleConfirmDelete}
            >
              <LinearGradient
                colors={['#E53935', '#C62828']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.cancelButtonGradient}
              >
                <Text style={styles.cancelAppointmentText}>Отмени резервацията</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setShowCancelModal(false);
                setCancelReason('');
              }}
            >
              <Text style={styles.cancelButtonText}>Назад</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingTop: 50,
    paddingBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notificationButton: {
    padding: theme.spacing.sm,
  },
  headerTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.surface,
    marginBottom: theme.spacing.xs,
  },
  headerSubtitle: {
    fontSize: theme.fontSize.md,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  voiceContainer: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    minHeight: 90,
    gap: theme.spacing.md,
  },
  voiceActionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dateSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  dateButton: {
    paddingVertical: 4,
    paddingHorizontal: theme.spacing.sm,
    backgroundColor: theme.colors.cream,
    borderRadius: theme.borderRadius.md,
    minWidth: 50,
    alignItems: 'center',
  },
  dateButtonText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  dateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  dateText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  closedText: {
    fontSize: theme.fontSize.lg,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  scheduleContainer: {
    flex: 1,
  },
  scheduleGrid: {
    flexDirection: 'row',
    padding: theme.spacing.lg,
  },
  timeColumn: {
    width: 80,
    marginRight: theme.spacing.sm,
  },
  appointmentsColumn: {
    flex: 1,
  },
  gridHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingBottom: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.primary,
  },
  headerText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
    color: theme.colors.primary,
    textTransform: 'uppercase',
  },
  timeCell: {
    height: 60,
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  timeText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    fontWeight: '600',
  },
  gridContent: {
    position: 'relative',
    flex: 1,
  },
  gridSlot: {
    height: 60,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  gridSlotBorder: {
    flex: 1,
  },
  appointmentOverlay: {
    position: 'absolute',
    left: 4,
    right: 4,
    backgroundColor: '#FFF8E7',
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: '#E6D5B8',
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  appointmentContent: {
    flex: 1,
    justifyContent: 'center',
  },
  appointmentHeader: {
    flexDirection: 'column',
    gap: 2,
  },
  appointmentInfo: {
    flex: 1,
    padding: 4,
  },
  clientNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 0,
  },
  clientName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
    flex: 1,
    lineHeight: 16,
  },
  serviceName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 0,
    lineHeight: 14,
  },
  appointmentNotes: {
    fontSize: 11,
    fontWeight: '500',
    color: '#333333',
    fontStyle: 'italic',
    marginBottom: 0,
    lineHeight: 13,
  },
  timeRange: {
    fontSize: 10,
    color: theme.colors.primary,
    fontWeight: '600',
    lineHeight: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  appointmentActions: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 2,
  },
  actionIconButton: {
    padding: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  freeText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  actionModalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    width: '100%',
    maxWidth: 400,
    ...theme.shadows.luxury,
  },
  modalTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.xl,
    textAlign: 'center',
  },
  appointmentDetails: {
    backgroundColor: theme.colors.cream,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.lg,
  },
  detailsTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  detailsService: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.xs,
  },
  detailsTime: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  actionButton: {
    marginBottom: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  actionButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.surface,
  },
  cancelAppointmentButton: {
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    shadowColor: '#E53935',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  cancelButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  cancelAppointmentText: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  cancelButton: {
    padding: theme.spacing.md,
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  cancelButtonText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
  inputContainer: {
    marginBottom: theme.spacing.lg,
  },
  timeInputContainer: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  timeInput: {
    flex: 1,
  },
  inputLabel: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
  },
  timeTextInput: {
    backgroundColor: theme.colors.cream,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
    textAlign: 'center',
  },
  calendarModal: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    width: '90%',
    maxWidth: 400,
    padding: theme.spacing.lg,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  calendarTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.text,
  },
  calendarContainer: {
    gap: theme.spacing.md,
  },
  calendarMonthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  calendarMonthText: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.text,
    textTransform: 'capitalize',
  },
  calendarNavButton: {
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.champagne + '20',
    borderRadius: theme.borderRadius.md,
  },
  calendarNavText: {
    fontSize: theme.fontSize.xl,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  calendarWeekdays: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: theme.spacing.xs,
  },
  calendarWeekdayText: {
    width: 40,
    textAlign: 'center',
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  calendarDays: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: theme.borderRadius.md,
  },
  calendarDaySelected: {
    backgroundColor: theme.colors.primary,
  },
  calendarDayToday: {
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  calendarDayText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
  },
  calendarDayTextSelected: {
    color: theme.colors.surface,
    fontWeight: '700',
  },
});
