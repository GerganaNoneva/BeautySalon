import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
  Modal,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Phone, Mail, MessageCircle, CheckCircle, X, Send, Check, CheckCheck, Calendar, Clock, CheckSquare, XSquare, Bell, Edit, Search, Info, UserPlus } from 'lucide-react-native';
import { theme } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import ClientHistoryModal from '@/components/ClientHistoryModal';
import UnregisteredClientModal from '@/components/UnregisteredClientModal';
import CreateClientModal from '@/components/CreateClientModal';

type Client = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
  is_registered?: boolean;
};

type AppointmentRequest = {
  id: string;
  client_id: string;
  service_id: string;
  requested_date: string;
  requested_time: string;
  client_message: string;
  status: string;
  created_at: string;
  profiles: {
    full_name: string;
    phone: string;
  };
  services: {
    name: string;
  };
};

type Message = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read: boolean;
  delivered_at: string | null;
  read_at: string | null;
};

export default function ClientsScreen() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [requests, setRequests] = useState<AppointmentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showActions, setShowActions] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [activeTab, setActiveTab] = useState<'requests' | 'clients'>('requests');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showUnregisteredModal, setShowUnregisteredModal] = useState(false);
  const [showCreateClientModal, setShowCreateClientModal] = useState(false);

  useEffect(() => {
    loadClients();
    loadRequests();

    const clientsChannel = supabase
      .channel('unregistered_clients_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'unregistered_clients',
        },
        () => {
          console.log('New unregistered client created, refreshing list...');
          loadClients();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'unregistered_clients',
        },
        () => {
          console.log('Unregistered client deleted, refreshing list...');
          loadClients();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(clientsChannel);
    };
  }, []);

  const loadClients = async () => {
    try {
      console.log('=== LOADING CLIENTS START ===');
      console.log('Current clients count:', clients.length);

      setError('');
      setClientSearchQuery('');

      const { data: registeredClients, error: error1 } = await supabase
        .from('profiles')
        .select('id, full_name, phone, email, created_at')
        .eq('role', 'client')
        .order('full_name', { ascending: true });

      if (error1) {
        console.error('Error loading registered clients:', error1);
        throw error1;
      }

      const { data: unregisteredClients, error: error2 } = await supabase
        .from('unregistered_clients')
        .select('id, full_name, phone, email, notes, created_at, created_by')
        .order('full_name', { ascending: true });

      if (error2) {
        console.error('Error loading unregistered clients:', error2);
        throw error2;
      }

      const allClients = [
        ...(registeredClients || []).map(c => ({ ...c, notes: null, created_by: null, is_registered: true })),
        ...(unregisteredClients || []).map(c => ({ ...c, is_registered: false }))
      ].sort((a, b) => a.full_name.localeCompare(b.full_name));

      console.log('Loaded clients count from DB:', allClients.length);
      console.log('Registered:', registeredClients?.length || 0, 'Unregistered:', unregisteredClients?.length || 0);

      setClients(allClients);
      console.log('=== LOADING CLIENTS END ===');
    } catch (err) {
      console.error('Error loading clients:', err);
      setError('Грешка при зареждане на клиенти');
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  const loadRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('appointment_requests')
        .select(`
          id,
          client_id,
          service_id,
          requested_date,
          requested_time::text,
          client_message,
          status,
          created_at,
          updated_at,
          profiles(full_name, phone),
          services(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (err) {
      console.error('Error loading requests:', err);
    }
  };

  const handleApproveRequest = async (request: AppointmentRequest) => {
    try {
      const endTime = calculateEndTime(
        request.requested_time,
        request.services.duration_minutes
      );

      const { error: appointmentError } = await supabase.from('appointments').insert({
        client_id: request.client_id,
        service_id: request.service_id,
        appointment_date: request.requested_date,
        start_time: request.requested_time,
        end_time: endTime,
        status: 'confirmed',
      });

      if (appointmentError) throw appointmentError;

      const { error: updateError } = await supabase
        .from('appointment_requests')
        .update({ status: 'approved' })
        .eq('id', request.id);

      if (updateError) throw updateError;

      const { error: notifError } = await supabase.from('notifications').insert({
        user_id: request.client_id,
        type: 'booking_confirmed',
        title: 'Заявката е одобрена',
        body: `${request.services.name} на ${new Date(request.requested_date).toLocaleDateString('bg-BG')} в ${request.requested_time.slice(0, 5)}`,
      });

      if (notifError) console.error('Notification error:', notifError);

      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user?.id)
        .eq('type', 'new_booking_request')
        .contains('data', { request_id: request.id });

      loadRequests();
      Alert.alert('Успех', 'Заявката е одобрена и резервацията е създадена');
    } catch (err) {
      console.error('Error approving request:', err);
      Alert.alert('Грешка', 'Неуспешно одобряване на заявката');
    }
  };

  const handleRejectRequest = async (request: AppointmentRequest) => {
    try {
      const { error: updateError } = await supabase
        .from('appointment_requests')
        .update({ status: 'rejected' })
        .eq('id', request.id);

      if (updateError) throw updateError;

      const { error: notifError } = await supabase.from('notifications').insert({
        user_id: request.client_id,
        type: 'booking_rejected',
        title: 'Заявката е отхвърлена',
        body: `${request.services.name} на ${new Date(request.requested_date).toLocaleDateString('bg-BG')} в ${request.requested_time.slice(0, 5)}`,
      });

      if (notifError) console.error('Notification error:', notifError);

      loadRequests();
      Alert.alert('Успех', 'Заявката е отхвърлена');
    } catch (err) {
      console.error('Error rejecting request:', err);
      Alert.alert('Грешка', 'Неуспешно отхвърляне на заявката');
    }
  };

  const handleDeleteRequest = async (requestId: string) => {
    console.log('Deleting request:', requestId);
    try {
      const { error } = await supabase
        .from('appointment_requests')
        .delete()
        .eq('id', requestId);

      if (error) {
        console.error('Delete error:', error);
        throw error;
      }

      console.log('Request deleted successfully');
      await loadRequests();
      Alert.alert('Успех', 'Заявката е изтрита');
    } catch (err) {
      console.error('Error deleting request:', err);
      Alert.alert('Грешка', 'Неуспешно изтриване на заявката');
    }
  };

  const handleClearAllRejected = async () => {
    console.log('Clear all rejected clicked');
    Alert.alert(
      'Потвърждение',
      'Сигурни ли сте, че искате да изтриете всички отхвърлени заявки?',
      [
        { text: 'Отказ', style: 'cancel' },
        {
          text: 'Изтрий',
          style: 'destructive',
          onPress: async () => {
            console.log('Clearing all rejected requests');
            try {
              const { error } = await supabase
                .from('appointment_requests')
                .delete()
                .eq('status', 'rejected');

              if (error) {
                console.error('Clear all error:', error);
                throw error;
              }

              console.log('All rejected requests cleared');
              await loadRequests();
              Alert.alert('Успех', 'Всички отхвърлени заявки са изтрити');
            } catch (err) {
              console.error('Error clearing rejected requests:', err);
              Alert.alert('Грешка', 'Неуспешно изтриване на заявките');
            }
          }
        }
      ]
    );
  };

  const calculateEndTime = (startTime: string, durationMinutes: number): string => {
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const endHours = Math.floor(totalMinutes / 60);
    const endMinutes = totalMinutes % 60;
    return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
  };

  const handleClientPress = (client: Client) => {
    setSelectedClient(client);
    setShowActions(true);
  };

  const handleEditClient = () => {
    if (!selectedClient) return;
    setEditName(selectedClient.full_name);
    setEditPhone(selectedClient.phone || '');
    setShowActions(false);
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedClient || !editName.trim()) {
      Alert.alert('Грешка', 'Моля, попълнете име');
      return;
    }

    setSavingEdit(true);

    try {
      const { error } = await supabase
        .from('unregistered_clients')
        .update({
          full_name: editName.trim(),
          phone: editPhone.trim() || null,
        })
        .eq('id', selectedClient.id);

      if (error) throw error;

      await loadClients();
      setShowEditModal(false);
      Alert.alert('Успех', 'Клиентът е редактиран');
    } catch (err) {
      console.error('Error updating client:', err);
      Alert.alert('Грешка', 'Неуспешна редакция на клиент');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCallPhone = () => {
    if (!selectedClient?.phone) {
      Alert.alert('Няма телефон', 'Този клиент все още няма телефонен номер.');
      return;
    }
    Linking.openURL(`tel:${selectedClient.phone}`);
    setShowActions(false);
  };

  const handleSendSMS = () => {
    if (!selectedClient?.phone) {
      Alert.alert('Няма телефон', 'Този клиент все още няма телефонен номер.');
      return;
    }
    Linking.openURL(`sms:${selectedClient.phone}`);
    setShowActions(false);
  };

  const handleShowHistory = () => {
    setShowActions(false);
    setShowHistoryModal(true);
  };

  const handleOpenChat = async () => {
    if (!selectedClient || !user) return;

    setShowActions(false);
    setShowUnregisteredModal(true);
  };

  const loadMessages = async (convId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setMessages(data || []);

      await supabase
        .from('messages')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('conversation_id', convId)
        .neq('sender_id', user?.id)
        .is('read_at', null);
    } catch (err) {
      console.error('Error loading messages:', err);
    }
  };

  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const newMessage = payload.new as Message;
          setMessages((prev) => [...prev, newMessage]);

          if (newMessage.sender_id !== profile?.id && !newMessage.read_at) {
            await supabase
              .from('messages')
              .update({ read_at: new Date().toISOString() })
              .eq('id', newMessage.id);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === payload.new.id ? (payload.new as Message) : msg
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  const sendMessage = async () => {
    if (!messageText.trim() || !conversationId || !user) return;

    setSendingMessage(true);

    try {
      const { error } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: messageText.trim(),
      });

      if (error) throw error;

      setMessageText('');
    } catch (err) {
      console.error('Error sending message:', err);
      Alert.alert('Грешка', 'Неуспешно изпращане на съобщение');
    } finally {
      setSendingMessage(false);
    }
  };

  const closeChatModal = () => {
    setShowChatModal(false);
    setConversationId(null);
    setMessages([]);
    setMessageText('');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('bg-BG', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const handleDeleteClient = (client: Client) => {
    Alert.alert(
      'Изтриване на клиент',
      `Сигурни ли сте, че искате да изтриете ${client.full_name}? Това действие не може да бъде отменено.`,
      [
        { text: 'Отказ', style: 'cancel' },
        {
          text: 'Изтрий',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('unregistered_clients')
                .delete()
                .eq('id', client.id);

              if (error) throw error;

              Alert.alert('Успех', 'Клиентът е изтрит успешно');
              loadClients();
            } catch (error) {
              console.error('Error deleting client:', error);
              Alert.alert('Грешка', 'Неуспешно изтриване на клиент');
            }
          },
        },
      ]
    );
  };

  const renderClient = ({ item }: { item: Client }) => (
    <View style={styles.clientCard}>
      <TouchableOpacity
        style={styles.clientCardContent}
        onPress={() => handleClientPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.clientHeader}>
          <Text style={styles.clientName}>{item.full_name}</Text>
          {item.is_registered && (
            <View style={styles.registeredBadge}>
              <CheckCircle size={16} color={theme.colors.success} />
              <Text style={styles.registeredBadgeText}>С приложение</Text>
            </View>
          )}
        </View>

        <View style={styles.clientInfo}>
          <View style={styles.infoRow}>
            <Phone size={18} color={theme.colors.primary} />
            <Text style={styles.infoText}>
              {item.phone || 'Няма телефон'}
            </Text>
          </View>
        </View>

        <Text style={styles.clientDate}>
          Регистриран: {formatDate(item.created_at)}
        </Text>
      </TouchableOpacity>

      {!item.is_registered && (
        <TouchableOpacity
          style={styles.deleteClientButton}
          onPress={() => handleDeleteClient(item)}
        >
          <XSquare size={20} color={theme.colors.error} />
        </TouchableOpacity>
      )}
    </View>
  );

  const renderRequest = ({ item }: { item: AppointmentRequest }) => (
    <View style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <Text style={styles.requestClientName}>{item.profiles.full_name}</Text>
        <View style={[
          styles.requestStatusBadge,
          { backgroundColor: item.status === 'pending' ? theme.colors.warning : item.status === 'approved' ? theme.colors.success : theme.colors.error }
        ]}>
          <Text style={styles.requestStatusText}>
            {item.status === 'pending' ? 'В очакване' : item.status === 'approved' ? 'Одобрена' : 'Отхвърлена'}
          </Text>
        </View>
      </View>

      <Text style={styles.requestService}>{item.services.name}</Text>

      <View style={styles.requestInfo}>
        <View style={styles.requestInfoRow}>
          <Calendar size={16} color={theme.colors.textLight} />
          <Text style={styles.requestInfoText}>
            {new Date(item.requested_date).toLocaleDateString('bg-BG')}
          </Text>
        </View>
        <View style={styles.requestInfoRow}>
          <Clock size={16} color={theme.colors.textLight} />
          <Text style={styles.requestInfoText}>
            {item.requested_time.slice(0, 5)}
          </Text>
        </View>
      </View>

      {item.client_message && (
        <Text style={styles.requestMessage}>"{item.client_message}"</Text>
      )}

      {item.status === 'pending' && (
        <View style={styles.requestActions}>
          <TouchableOpacity
            style={[styles.requestActionButton, styles.approveButton]}
            onPress={() => handleApproveRequest(item)}
          >
            <CheckSquare size={18} color={theme.colors.surface} />
            <Text style={styles.requestActionButtonText}>Одобри</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.requestActionButton, styles.rejectButton]}
            onPress={() => handleRejectRequest(item)}
          >
            <XSquare size={18} color={theme.colors.surface} />
            <Text style={styles.requestActionButtonText}>Откажи</Text>
          </TouchableOpacity>
        </View>
      )}

      {item.status === 'rejected' && (
        <View style={styles.requestActions}>
          <TouchableOpacity
            style={[styles.requestActionButton, styles.deleteButton]}
            onPress={() => handleDeleteRequest(item.id)}
          >
            <X size={18} color={theme.colors.surface} />
            <Text style={styles.requestActionButtonText}>Изтрий</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <LinearGradient colors={theme.gradients.champagne} style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const pendingRequests = requests.filter(r => r.status === 'pending');

  const filteredClients = clients.filter((client) => {
    if (!clientSearchQuery.trim()) return true;
    const searchLower = clientSearchQuery.toLowerCase().trim();
    return (
      client.full_name.toLowerCase().includes(searchLower) ||
      (client.phone && client.phone.includes(searchLower)) ||
      (client.email && client.email.toLowerCase().includes(searchLower))
    );
  });

  return (
    <LinearGradient colors={theme.gradients.champagne} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.title}>Клиенти</Text>
          </View>
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'requests' && styles.tabActive]}
              onPress={() => setActiveTab('requests')}
            >
              <Text style={[styles.tabText, activeTab === 'requests' && styles.tabTextActive]}>
                Заявки {pendingRequests.length > 0 && `(${pendingRequests.length})`}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'clients' && styles.tabActive]}
              onPress={() => setActiveTab('clients')}
            >
              <Text style={[styles.tabText, activeTab === 'clients' && styles.tabTextActive]}>
                Клиенти ({clients.length})
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {activeTab === 'clients' && (
          <>
            <View style={styles.searchContainer}>
              <Search size={20} color={theme.colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                value={clientSearchQuery}
                onChangeText={setClientSearchQuery}
                placeholder="Търсене по име или телефон..."
                placeholderTextColor={theme.colors.textMuted}
              />
              {clientSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setClientSearchQuery('')}>
                  <X size={20} color={theme.colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={styles.createClientButton}
              onPress={() => setShowCreateClientModal(true)}
            >
              <UserPlus size={20} color="#fff" />
              <Text style={styles.createClientButtonText}>Създай клиент</Text>
            </TouchableOpacity>
          </>
        )}

        {activeTab === 'requests' ? (
          <>
            {requests.some(r => r.status === 'rejected') && (
              <View style={styles.clearRejectedContainer}>
                <TouchableOpacity
                  style={styles.clearRejectedButton}
                  onPress={handleClearAllRejected}
                >
                  <Text style={styles.clearRejectedText}>Изчисти всички отхвърлени</Text>
                </TouchableOpacity>
              </View>
            )}
            <FlatList
              data={requests}
              renderItem={renderRequest}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>Няма заявки за часове</Text>
                </View>
              }
              refreshing={loading}
              onRefresh={loadRequests}
            />
          </>
        ) : (
          <FlatList
            data={filteredClients}
            renderItem={renderClient}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {clientSearchQuery.trim() ? 'Няма намерени клиенти' : 'Все още няма клиенти'}
                </Text>
              </View>
            }
            refreshing={loading}
            onRefresh={loadClients}
          />
        )}

        <Modal
          visible={showActions}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowActions(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowActions(false)}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{selectedClient?.full_name}</Text>
              <Text style={styles.modalPhone}>{selectedClient?.phone}</Text>

              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={handleShowHistory}
                >
                  <Info size={16} color={theme.colors.primary} />
                  <Text style={styles.actionButtonText}>Информация</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={handleEditClient}
                >
                  <Edit size={16} color={theme.colors.primary} />
                  <Text style={styles.actionButtonText}>Редакция</Text>
                </TouchableOpacity>

                {selectedClient?.is_registered ? (
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={handleOpenChat}
                  >
                    <MessageCircle size={16} color={theme.colors.primary} />
                    <Text style={styles.actionButtonText}>Чат</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={handleOpenChat}
                  >
                    <UserPlus size={16} color={theme.colors.primary} />
                    <Text style={styles.actionButtonText}>Покана</Text>
                  </TouchableOpacity>
                )}

                {selectedClient?.phone && (
                  <>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={handleSendSMS}
                    >
                      <Mail size={16} color={theme.colors.primary} />
                      <Text style={styles.actionButtonText}>SMS</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={handleCallPhone}
                    >
                      <Phone size={16} color={theme.colors.primary} />
                      <Text style={styles.actionButtonText}>Обади се</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowActions(false)}
              >
                <Text style={styles.cancelButtonText}>Отказ</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        <Modal
          visible={showChatModal}
          animationType="slide"
          onRequestClose={closeChatModal}
        >
          <SafeAreaView style={styles.chatModalContainer}>
            <View style={styles.chatHeader}>
              <View>
                <Text style={styles.chatTitle}>{selectedClient?.full_name}</Text>
                <Text style={styles.chatSubtitle}>Чат</Text>
              </View>
              <TouchableOpacity onPress={closeChatModal} style={styles.closeButton}>
                <X size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.chatContent}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
              <ScrollView
                style={styles.messagesScroll}
                contentContainerStyle={styles.messagesContent}
                ref={(ref) => {
                  if (ref && messages.length > 0) {
                    ref.scrollToEnd({ animated: true });
                  }
                }}
              >
                {messages.map((msg) => {
                  const isOwn = msg.sender_id === user?.id;
                  return (
                    <View
                      key={msg.id}
                      style={[
                        styles.messageBubbleContainer,
                        isOwn ? styles.ownMessageContainer : styles.otherMessageContainer,
                      ]}
                    >
                      <View
                        style={[
                          styles.messageBubble,
                          isOwn ? styles.ownMessageBubble : styles.otherMessageBubble,
                        ]}
                      >
                        <Text
                          style={[
                            styles.messageText,
                            isOwn ? styles.ownMessageText : styles.otherMessageText,
                          ]}
                        >
                          {msg.content}
                        </Text>
                        <View style={styles.messageFooter}>
                          <Text
                            style={[
                              styles.messageTime,
                              isOwn ? styles.ownMessageTimeText : styles.otherMessageTimeText,
                            ]}
                          >
                            {new Date(msg.created_at).toLocaleTimeString('bg-BG', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </Text>
                          {isOwn && (
                            <>
                              {msg.read_at ? (
                                <CheckCheck size={14} color="#0066FF" />
                              ) : msg.delivered_at ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                  <Check size={14} color="#0066FF" />
                                  <Check size={14} color="#666666" style={{ marginLeft: -8 }} />
                                </View>
                              ) : (
                                <CheckCheck size={14} color="#666666" />
                              )}
                            </>
                          )}
                        </View>
                        {isOwn && msg.read_at && (
                          <Text
                            style={[
                              styles.readAtText,
                              styles.ownMessageTimeText,
                            ]}
                          >
                            Видяно {new Date(msg.read_at).toLocaleDateString('bg-BG', {
                              day: 'numeric',
                              month: 'short',
                            })}{' '}
                            в {new Date(msg.read_at).toLocaleTimeString('bg-BG', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>

              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.textInput}
                  value={messageText}
                  onChangeText={setMessageText}
                  placeholder="Напишете съобщение..."
                  placeholderTextColor={theme.colors.textMuted}
                  multiline
                  maxLength={1000}
                />
                <TouchableOpacity
                  style={[
                    styles.sendButton,
                    (!messageText.trim() || sendingMessage) && styles.sendButtonDisabled,
                  ]}
                  onPress={sendMessage}
                  disabled={!messageText.trim() || sendingMessage}
                >
                  {sendingMessage ? (
                    <ActivityIndicator size="small" color={theme.colors.surface} />
                  ) : (
                    <Send size={20} color={theme.colors.surface} />
                  )}
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </Modal>

        <Modal
          visible={showEditModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowEditModal(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalOverlay}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setShowEditModal(false)}
            >
              <TouchableOpacity
                activeOpacity={1}
                onPress={(e) => e.stopPropagation()}
                style={styles.editModalContent}
              >
                <Text style={styles.editModalTitle}>Редакция на клиент</Text>

                <View style={styles.editField}>
                  <Text style={styles.editLabel}>Име</Text>
                  <TextInput
                    style={styles.editInput}
                    value={editName}
                    onChangeText={setEditName}
                    placeholder="Име на клиент"
                    placeholderTextColor={theme.colors.textMuted}
                  />
                </View>

                <View style={styles.editField}>
                  <Text style={styles.editLabel}>Телефон</Text>
                  <TextInput
                    style={styles.editInput}
                    value={editPhone}
                    onChangeText={setEditPhone}
                    placeholder="Телефонен номер"
                    placeholderTextColor={theme.colors.textMuted}
                    keyboardType="phone-pad"
                  />
                </View>

                <View style={styles.editActions}>
                  <TouchableOpacity
                    style={[styles.editButton, styles.editCancelButton]}
                    onPress={() => setShowEditModal(false)}
                    disabled={savingEdit}
                  >
                    <Text style={styles.editCancelButtonText}>Отказ</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.editButton, styles.editSaveButton]}
                    onPress={handleSaveEdit}
                    disabled={savingEdit}
                  >
                    {savingEdit ? (
                      <ActivityIndicator size="small" color={theme.colors.surface} />
                    ) : (
                      <Text style={styles.editSaveButtonText}>Запази</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </Modal>

        <ClientHistoryModal
          visible={showHistoryModal}
          clientId={selectedClient?.id || null}
          clientName={selectedClient?.full_name || ''}
          onClose={() => setShowHistoryModal(false)}
        />

        <UnregisteredClientModal
          visible={showUnregisteredModal}
          clientName={selectedClient?.full_name || ''}
          clientPhone={selectedClient?.phone || ''}
          onClose={() => setShowUnregisteredModal(false)}
        />

        <CreateClientModal
          visible={showCreateClientModal}
          onClose={() => setShowCreateClientModal(false)}
          onClientCreated={loadClients}
        />

      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    gap: theme.spacing.sm,
    ...theme.shadows.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    paddingVertical: 0,
  },
  createClientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.sm,
    gap: theme.spacing.sm,
    ...theme.shadows.md,
  },
  createClientButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: '#fff',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  notificationButton: {
    padding: theme.spacing.xs,
  },
  title: {
    fontSize: theme.fontSize.xxl,
    fontWeight: '700',
    color: theme.colors.text,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: theme.borderRadius.md,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
    borderRadius: theme.borderRadius.sm,
  },
  tabActive: {
    backgroundColor: theme.colors.surface,
    ...theme.shadows.sm,
  },
  tabText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  tabTextActive: {
    color: theme.colors.primary,
  },
  errorContainer: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.error + '20',
    margin: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
  },
  errorText: {
    color: theme.colors.error,
    textAlign: 'center',
  },
  listContent: {
    padding: theme.spacing.md,
  },
  clientCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: theme.borderRadius.sm,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  clientCardContent: {
    flex: 1,
    padding: theme.spacing.md,
  },
  deleteClientButton: {
    padding: theme.spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  clientName: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
  },
  registeredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.xs,
  },
  registeredBadgeText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.success,
    fontWeight: '600',
  },
  clientInfo: {
    marginBottom: theme.spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  infoText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textLight,
    flex: 1,
  },
  clientDate: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.xl,
    width: '100%',
    maxWidth: 400,
    ...theme.shadows.xl,
  },
  modalTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },
  modalPhone: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textLight,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  actionButton: {
    alignItems: 'center',
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.accentLight,
    width: '48%',
  },
  actionButtonText: {
    fontSize: 11,
    color: theme.colors.text,
    marginTop: 4,
    fontWeight: '600',
  },
  cancelButton: {
    padding: theme.spacing.md,
    alignItems: 'center',
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.border,
  },
  cancelButtonText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    fontWeight: '600',
  },
  chatModalContainer: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  chatTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.text,
  },
  chatSubtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textLight,
    marginTop: 2,
  },
  closeButton: {
    padding: theme.spacing.sm,
  },
  chatContent: {
    flex: 1,
  },
  messagesScroll: {
    flex: 1,
  },
  messagesContent: {
    padding: theme.spacing.md,
  },
  messageBubbleContainer: {
    marginBottom: theme.spacing.md,
    maxWidth: '75%',
  },
  ownMessageContainer: {
    alignSelf: 'flex-end',
  },
  otherMessageContainer: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
  },
  ownMessageBubble: {
    backgroundColor: theme.colors.primary,
  },
  otherMessageBubble: {
    backgroundColor: '#f0f0f0',
  },
  messageText: {
    fontSize: theme.fontSize.md,
    marginBottom: 4,
  },
  ownMessageText: {
    color: theme.colors.surface,
  },
  otherMessageText: {
    color: theme.colors.text,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    justifyContent: 'flex-end',
  },
  messageTime: {
    fontSize: theme.fontSize.xs,
  },
  ownMessageTimeText: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  otherMessageTimeText: {
    color: theme.colors.textMuted,
  },
  readAtText: {
    fontSize: 10,
    marginTop: 2,
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    gap: theme.spacing.sm,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: theme.colors.primary,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: theme.colors.border,
  },
  requestCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  requestClientName: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
  },
  requestStatusBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
  },
  requestStatusText: {
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
    color: theme.colors.surface,
  },
  requestService: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.primary,
    marginBottom: theme.spacing.sm,
  },
  requestInfo: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  requestInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  requestInfoText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textLight,
  },
  requestMessage: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textLight,
    fontStyle: 'italic',
    marginBottom: theme.spacing.sm,
  },
  requestActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  requestActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
  },
  approveButton: {
    backgroundColor: theme.colors.success,
  },
  rejectButton: {
    backgroundColor: theme.colors.error,
  },
  deleteButton: {
    backgroundColor: theme.colors.error,
  },
  clearRejectedContainer: {
    padding: theme.spacing.md,
    paddingTop: 0,
  },
  clearRejectedButton: {
    backgroundColor: theme.colors.error,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
  },
  clearRejectedText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.surface,
  },
  requestActionButtonText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.surface,
  },
  editModalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.xl,
    width: '90%',
    maxWidth: 400,
    ...theme.shadows.xl,
  },
  editModalTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
  editField: {
    marginBottom: theme.spacing.md,
  },
  editLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  editInput: {
    backgroundColor: '#f0f0f0',
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
  },
  editActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
  },
  editButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editCancelButton: {
    backgroundColor: theme.colors.border,
  },
  editCancelButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.text,
  },
  editSaveButton: {
    backgroundColor: theme.colors.primary,
  },
  editSaveButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.surface,
  },
});
