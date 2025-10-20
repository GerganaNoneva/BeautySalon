import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, ChevronDown, Send, User, Clock } from 'lucide-react-native';
import { theme } from '../constants/theme';
import { supabase } from '@/lib/supabase';

interface NewReservationModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  selectedDate: Date;
  selectedTime: string;
  workingHours: {
    start: string;
    end: string;
    closed: boolean;
  };
  appointments: Array<{
    start_time: string;
    end_time: string;
  }>;
}

type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
};

type Client = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  isUnregistered?: boolean;
};

export default function NewReservationModal({
  visible,
  onClose,
  onConfirm,
  selectedDate,
  selectedTime,
  workingHours,
  appointments,
}: NewReservationModalProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [newClientMode, setNewClientMode] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [startTime, setStartTime] = useState(selectedTime);
  const [endTime, setEndTime] = useState('');
  const [showServicePicker, setShowServicePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [endTimeOptions, setEndTimeOptions] = useState<string[]>([]);

  useEffect(() => {
    if (visible) {
      resetForm();
      loadData();
      // Фиксиран начален час
      setStartTime(selectedTime);

      // Изчисляваме края на свободното време до следваща резервация
      const startMinutes = timeToMinutes(selectedTime);
      const nextOccupied = findNextOccupiedSlot(startMinutes);
      const [endHour, endMinute] = workingHours.end.split(':').map(Number);
      const workingEndMinutes = endHour * 60 + endMinute;
      const slotEndMinutes = nextOccupied !== null ? Math.min(nextOccupied, workingEndMinutes) : workingEndMinutes;

      // Генерираме опциите за краен час (от +30 мин до края на свободното време)
      const endOptions: string[] = [];
      for (let mins = startMinutes + 30; mins <= slotEndMinutes; mins += 30) {
        const hour = Math.floor(mins / 60);
        const minute = mins % 60;
        endOptions.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
      }
      setEndTimeOptions(endOptions);
      setEndTime('');
    }
  }, [visible, selectedTime]);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadServices(), loadClients()]);
    setLoading(false);
  };

  const loadServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error('Error loading services:', error);
    }
  };

  const loadClients = async () => {
    try {
      const [registeredResult, unregisteredResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, email, phone')
          .neq('role', 'admin')
          .order('full_name'),
        supabase
          .from('unregistered_clients')
          .select('id, full_name, email, phone')
          .order('full_name')
      ]);

      if (registeredResult.error) throw registeredResult.error;
      if (unregisteredResult.error) throw unregisteredResult.error;

      const allClients = [
        ...(registeredResult.data || []).map(c => ({ ...c, isUnregistered: false })),
        ...(unregisteredResult.data || []).map(c => ({ ...c, isUnregistered: true }))
      ];

      setClients(allClients);
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  };

  const findNextOccupiedSlot = (afterMinutes: number): number | null => {
    const sortedAppointments = [...appointments]
      .map(apt => ({
        start: timeToMinutes(apt.start_time),
        end: timeToMinutes(apt.end_time)
      }))
      .sort((a, b) => a.start - b.start);

    for (const apt of sortedAppointments) {
      if (apt.start > afterMinutes) {
        return apt.start;
      }
    }
    return null;
  };

  const timeToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const validateTimes = () => {
    if (!startTime || !endTime) {
      Alert.alert('Грешка', 'Моля, изберете начален и краен час');
      return false;
    }

    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);

    if (startMinutes >= endMinutes) {
      Alert.alert('Грешка', 'Крайният час трябва да е след началния');
      return false;
    }

    const durationMinutes = endMinutes - startMinutes;
    if (durationMinutes < 15) {
      Alert.alert('Грешка', 'Минималната продължителност е 15 минути');
      return false;
    }

    return true;
  };

  const createReservation = async () => {
    if (!selectedService) {
      Alert.alert('Грешка', 'Моля, изберете услуга');
      return;
    }

    if (!newClientMode && !selectedClient) {
      Alert.alert('Грешка', 'Моля, изберете клиент или създайте нов');
      return;
    }

    if (newClientMode && (!newClientName || !newClientName.trim())) {
      Alert.alert('Грешка', 'Моля, въведете име на клиент');
      return;
    }

    if (!endTime) {
      Alert.alert('Грешка', 'Моля, изберете краен час');
      return;
    }

    if (!validateTimes()) {
      return;
    }

    let clientId = selectedClient?.id;
    let isUnregistered = selectedClient?.isUnregistered || false;

    if (newClientMode) {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          throw new Error('No authenticated user');
        }

        const { data: newClient, error: insertError } = await supabase
          .from('unregistered_clients')
          .insert({
            full_name: newClientName.trim(),
            phone: newClientPhone && newClientPhone.trim() ? newClientPhone.trim() : null,
            created_by: user.id,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        if (!newClient?.id) throw new Error('No client ID returned');

        clientId = newClient.id;
        isUnregistered = true;
      } catch (error: any) {
        Alert.alert('Грешка', `Неуспешно създаване на клиент: ${error.message || 'Неизвестна грешка'}`);
        return;
      }
    }

    if (!clientId) {
      Alert.alert('Грешка', 'Моля, изберете или въведете клиент');
      return;
    }

    try {
      setLoading(true);
      // Use local date format to match schedule.tsx
      const localDate = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate()
      );
      const dateStr = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;

      const startMinutes = timeToMinutes(startTime);
      const endMinutes = timeToMinutes(endTime);

      const { data: existingAppointments, error: checkError } = await supabase
        .from('appointments')
        .select('id, start_time, end_time, profiles!appointments_client_id_fkey(full_name), services(name)')
        .eq('appointment_date', dateStr);

      if (checkError) throw checkError;

      if (existingAppointments && existingAppointments.length > 0) {
        for (const apt of existingAppointments) {
          const aptStartMinutes = timeToMinutes(apt.start_time);
          const aptEndMinutes = timeToMinutes(apt.end_time);

          const hasOverlap =
            (startMinutes >= aptStartMinutes && startMinutes < aptEndMinutes) ||
            (endMinutes > aptStartMinutes && endMinutes <= aptEndMinutes) ||
            (startMinutes <= aptStartMinutes && endMinutes >= aptEndMinutes);

          if (hasOverlap) {
            const aptProfile = Array.isArray(apt.profiles) ? apt.profiles[0] : apt.profiles;
            const aptService = Array.isArray(apt.services) ? apt.services[0] : apt.services;

            Alert.alert(
              'Припокриване',
              `Вече има резервация от ${apt.start_time.substring(0, 5)} до ${apt.end_time.substring(0, 5)}\n\n` +
                `Клиент: ${aptProfile?.full_name || 'Неизвестен'}\n` +
                `Услуга: ${aptService?.name || 'Неизвестна'}\n\n` +
                `Моля, изберете друг час.`
            );
            setLoading(false);
            return;
          }
        }
      }

      const appointmentData: any = {
        service_id: selectedService.id,
        appointment_date: dateStr,
        start_time: startTime,
        end_time: endTime,
        notes: notes || null,
        status: 'confirmed',
      };

      if (isUnregistered) {
        appointmentData.unregistered_client_id = clientId;
      } else {
        appointmentData.client_id = clientId;
      }

      const { data: insertedAppointment, error } = await supabase
        .from('appointments')
        .insert(appointmentData)
        .select()
        .single();

      if (error) {
        console.error('Insert error:', error);
        let errorMessage = 'Неуспешно създаване на резервация';

        if (error.message) {
          errorMessage += '\n\nГрешка: ' + error.message;
        }

        if (error.code === 'PGRST301') {
          errorMessage += '\n\nВъзможна причина: Липсват права за създаване на резервация.';
        } else if (error.code === '23505') {
          errorMessage += '\n\nВъзможна причина: Вече съществува резервация за този час.';
        } else if (error.code === '23503') {
          errorMessage += '\n\nВъзможна причина: Невалиден клиент или услуга.';
        }

        Alert.alert('Грешка при създаване', errorMessage);
        setLoading(false);
        return;
      }

      if (!insertedAppointment) {
        Alert.alert('Грешка', 'Резервацията е създадена, но няма върнати данни.');
        setLoading(false);
        return;
      }

      // Database trigger automatically creates notification, no manual insert needed

      Alert.alert('Успех', 'Резервацията е създадена успешно');
      onConfirm();
      onClose();
      resetForm();
    } catch (error) {
      console.error('Error creating reservation:', error);
      Alert.alert('Грешка', 'Неуспешно създаване на резервация');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedService(null);
    setSelectedClient(null);
    setNewClientMode(false);
    setNewClientName('');
    setNewClientPhone('');
    setSearchQuery('');
    setStartTime(selectedTime);
    setEndTime('');
    setNotes('');
  };

  const filteredClients = clients.filter(
    (client) =>
      client.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (client.email && client.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (client.phone && client.phone.includes(searchQuery))
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Нова резервация</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Дата:</Text>
              <Text style={styles.infoText}>
                {selectedDate.toLocaleDateString('bg-BG')}
              </Text>
            </View>

            <Text style={styles.sectionTitle}>Начален час</Text>
            <View style={[styles.dropdownButton, styles.lockedField]}>
              <Clock size={18} color={theme.colors.textMuted} />
              <Text style={styles.dropdownButtonText}>{startTime}</Text>
            </View>

            <Text style={styles.sectionTitle}>Краен час</Text>
            <TouchableOpacity
              style={styles.dropdownButton}
              onPress={() => setShowEndTimePicker(true)}
            >
              <Clock size={18} color={theme.colors.primary} />
              <Text style={[styles.dropdownButtonText, !endTime && styles.placeholderText]}>
                {endTime || 'Изберете краен час'}
              </Text>
              <ChevronDown size={20} color={theme.colors.text} />
            </TouchableOpacity>

            {startTime && endTime && (
              <View style={styles.durationInfo}>
                <Text style={styles.durationText}>
                  {`Продължителност: ${Math.round((timeToMinutes(endTime) - timeToMinutes(startTime)))} минути`}
                </Text>
              </View>
            )}

            <Text style={styles.sectionTitle}>Услуга</Text>
            <TouchableOpacity
              style={styles.dropdownButton}
              onPress={() => setShowServicePicker(true)}
            >
              <Text style={[styles.dropdownButtonText, !selectedService && styles.placeholderText]}>
                {selectedService ? selectedService.name : 'Избери услуга'}
              </Text>
              <ChevronDown size={20} color={theme.colors.text} />
            </TouchableOpacity>
            {selectedService && (
              <Text style={styles.serviceDetails}>
                {`${selectedService.duration_minutes} мин • ${selectedService.price} лв`}
              </Text>
            )}

            <Text style={styles.sectionTitle}>Бележки (опционално)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Допълнителна информация..."
              placeholderTextColor={theme.colors.textMuted}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
            />

            <Text style={styles.sectionTitle}>Клиент</Text>
            <View style={styles.clientModeToggle}>
              <TouchableOpacity
                style={[styles.toggleButton, !newClientMode && styles.toggleButtonActive]}
                onPress={() => setNewClientMode(false)}
              >
                <Text
                  style={[styles.toggleText, !newClientMode && styles.toggleTextActive]}
                >
                  Съществуващ
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleButton, newClientMode && styles.toggleButtonActive]}
                onPress={() => setNewClientMode(true)}
              >
                <Text style={[styles.toggleText, newClientMode && styles.toggleTextActive]}>
                  Нов клиент
                </Text>
              </TouchableOpacity>
            </View>

            {newClientMode ? (
              <View>
                <TextInput
                  style={styles.input}
                  placeholder="Име"
                  placeholderTextColor={theme.colors.textMuted}
                  value={newClientName}
                  onChangeText={setNewClientName}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Телефон"
                  placeholderTextColor={theme.colors.textMuted}
                  value={newClientPhone}
                  onChangeText={setNewClientPhone}
                  keyboardType="phone-pad"
                />
              </View>
            ) : (
              <View>
                <TextInput
                  style={styles.input}
                  placeholder="Търсене на клиент..."
                  placeholderTextColor={theme.colors.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                <ScrollView style={styles.clientsList} nestedScrollEnabled>
                  {filteredClients.map((client) => (
                    <TouchableOpacity
                      key={client.id}
                      style={[
                        styles.clientCard,
                        selectedClient?.id === client.id && styles.clientCardSelected,
                      ]}
                      onPress={() => setSelectedClient(client)}
                    >
                      <Text style={styles.clientName}>{client.full_name}</Text>
                      {client.phone && (
                        <Text style={styles.clientDetails}>{client.phone}</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Отказ</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={createReservation}
              disabled={loading}
            >
              <LinearGradient
                colors={theme.gradients.primary}
                style={styles.submitGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={theme.colors.surface} />
                ) : (
                  <>
                    <Send size={18} color={theme.colors.surface} />
                    <Text style={styles.submitText}>Създай</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <Modal
        visible={showServicePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowServicePicker(false)}
      >
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setShowServicePicker(false)}
        >
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Изберете услуга</Text>
              <TouchableOpacity onPress={() => setShowServicePicker(false)}>
                <X size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerList}>
              {services.map((service) => (
                <TouchableOpacity
                  key={service.id}
                  style={[
                    styles.pickerItem,
                    selectedService?.id === service.id && styles.pickerItemSelected,
                  ]}
                  onPress={() => {
                    setSelectedService(service);
                    setShowServicePicker(false);
                  }}
                >
                  <Text style={styles.pickerItemName}>{service.name}</Text>
                  <Text style={styles.pickerItemDetails}>
                    {`${service.duration_minutes} мин • ${service.price} лв`}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showEndTimePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEndTimePicker(false)}
      >
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setShowEndTimePicker(false)}
        >
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Изберете краен час</Text>
              <TouchableOpacity onPress={() => setShowEndTimePicker(false)}>
                <X size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerList}>
              {endTimeOptions.map((time: string) => (
                <TouchableOpacity
                  key={time}
                  style={[
                    styles.pickerItem,
                    endTime === time && styles.pickerItemSelected,
                  ]}
                  onPress={() => {
                    setEndTime(time);
                    setShowEndTimePicker(false);
                  }}
                >
                  <Text style={styles.pickerItemName}>{time}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    maxHeight: '90%',
    padding: theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.text,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.accentLight,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
  },
  infoLabel: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  infoText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.text,
  },
  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  lockedField: {
    backgroundColor: '#f5f5f5',
    opacity: 0.7,
  },
  dropdownButtonText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    flex: 1,
  },
  placeholderText: {
    color: theme.colors.textMuted,
  },
  durationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
  },
  durationText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.text,
  },
  serviceDetails: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.md,
    paddingLeft: theme.spacing.md,
    marginTop: -theme.spacing.sm,
  },
  input: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  clientModeToggle: {
    flexDirection: 'row',
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    marginBottom: theme.spacing.md,
  },
  toggleButton: {
    flex: 1,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  toggleText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  toggleTextActive: {
    color: theme.colors.surface,
  },
  clientsList: {
    maxHeight: 200,
  },
  clientCard: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    marginBottom: theme.spacing.sm,
  },
  clientCardSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.accentLight,
  },
  clientName: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  clientDetails: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textLight,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  cancelBtn: {
    flex: 1,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  submitBtn: {
    flex: 1,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  submitText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.surface,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  pickerContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    width: '100%',
    maxHeight: '70%',
    overflow: 'hidden',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  pickerTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  pickerList: {
    maxHeight: 400,
  },
  pickerItem: {
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  pickerItemSelected: {
    backgroundColor: theme.colors.accentLight,
  },
  pickerItemName: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  pickerItemDetails: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
  },
});