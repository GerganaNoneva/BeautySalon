import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Send, Check, CheckCheck, Paperclip, X } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { theme } from '@/constants/theme';
import MessageAttachmentPicker, { Attachment } from '@/components/MessageAttachmentPicker';
import MessageAttachment from '@/components/MessageAttachment';
import ClickableMessage from '@/components/ClickableMessage';
import { useFocusEffect } from '@react-navigation/native';

type Message = {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  delivered_at: string | null;
  read_at: string | null;
  attachment_type?: string | null;
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_size?: number | null;
  attachment_duration?: number | null;
  profiles: {
    full_name: string;
    role: string;
  };
};

export default function ClientMessagesScreen() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showAttachmentPicker, setShowAttachmentPicker] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<Attachment | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const isFocused = useRef(false);

  useFocusEffect(
    React.useCallback(() => {
      isFocused.current = true;
      if (conversationId) {
        markMessagesAsRead(conversationId);
      }
      return () => {
        isFocused.current = false;
      };
    }, [conversationId])
  );

  useEffect(() => {
    if (user) {
      let subscription: any;

      const initConversation = async () => {
        try {
          // Get the admin
          const { data: admin, error: adminError } = await supabase
            .from('profiles')
            .select('id')
            .eq('role', 'admin')
            .maybeSingle();

          if (adminError || !admin) {
            console.error('No admin found');
            setLoading(false);
            return;
          }

          // Find or create conversation
          let convId: string;

          const { data: existingConv, error: fetchError } = await supabase
            .from('conversations')
            .select('id')
            .eq('client_id', user.id)
            .eq('admin_id', admin.id)
            .maybeSingle();

          if (fetchError) throw fetchError;

          if (existingConv) {
            convId = existingConv.id;
          } else {
            const { data: newConv, error: insertError } = await supabase
              .from('conversations')
              .insert({
                client_id: user.id,
                admin_id: admin.id,
              })
              .select('id')
              .single();

            if (insertError) throw insertError;
            convId = newConv.id;
          }

          setConversationId(convId);
          loadMessages(convId);
          subscription = setupRealtimeSubscription(convId);
        } catch (error) {
          console.error('Error initializing conversation:', error);
          setLoading(false);
        }
      };

      initConversation();

      return () => {
        if (subscription) {
          subscription.unsubscribe();
        }
      };
    }
  }, [user]);

  const markMessagesAsRead = async (convId: string) => {
    if (!isFocused.current) return;

    try {
      const { data: unreadMessages } = await supabase
        .from('messages')
        .select('id')
        .eq('conversation_id', convId)
        .neq('sender_id', user?.id || '')
        .is('read_at', null);

      if (unreadMessages && unreadMessages.length > 0) {
        await supabase
          .from('messages')
          .update({ read_at: new Date().toISOString() })
          .in(
            'id',
            unreadMessages.map((msg) => msg.id)
          );

        const messageIds = unreadMessages.map((msg) => msg.id);
        for (const messageId of messageIds) {
          await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', user?.id)
            .eq('type', 'new_message')
            .contains('data', { message_id: messageId });
        }

        loadMessages(convId);
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const loadMessages = async (convId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          profiles!messages_sender_id_fkey(full_name, role)
        `)
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setMessages(data || []);

      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = (convId: string) => {
    const subscription = supabase
      .channel(`messages:${convId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${convId}`
        },
        async (payload) => {
          const newMessage = payload.new as Message;

          if (newMessage.sender_id !== user?.id && !newMessage.read_at && isFocused.current) {
            await supabase
              .from('messages')
              .update({ read_at: new Date().toISOString() })
              .eq('id', newMessage.id);

            await supabase
              .from('notifications')
              .update({ is_read: true })
              .eq('user_id', user?.id)
              .eq('type', 'new_message')
              .contains('data', { message_id: newMessage.id });
          }

          loadMessages(convId);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${convId}`
        },
        (payload) => {
          const updatedMessage = payload.new as Message;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === updatedMessage.id ? updatedMessage : msg
            )
          );
        }
      )
      .subscribe();

    return subscription;
  };

  const sendMessage = async () => {
    if (!newMessage.trim() && !selectedAttachment) {
      console.log('Message is empty');
      return;
    }

    if (!user) {
      console.log('User not found');
      return;
    }

    if (!conversationId) {
      console.log('Conversation ID not found');
      return;
    }

    setSending(true);
    try {
      const messageData: any = {
        conversation_id: conversationId,
        sender_id: user.id,
        content: newMessage.trim() || (selectedAttachment ? `[${selectedAttachment.type}]` : ''),
      };

      if (selectedAttachment) {
        messageData.attachment_type = selectedAttachment.type;
        messageData.attachment_url = selectedAttachment.url;
        messageData.attachment_name = selectedAttachment.name;
        messageData.attachment_size = selectedAttachment.size;
        if (selectedAttachment.duration) {
          messageData.attachment_duration = selectedAttachment.duration;
        }
      }

      const { data, error } = await supabase
        .from('messages')
        .insert(messageData)
        .select(`
          *,
          profiles!messages_sender_id_fkey(full_name, role)
        `);

      if (error) {
        console.error('Error inserting message:', error);
        throw error;
      }

      console.log('Message sent successfully:', data);

      if (data && data[0]) {
        setMessages(prev => [...prev, data[0] as Message]);

        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }

      setNewMessage('');
      setSelectedAttachment(null);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleAttachmentSelected = (attachment: Attachment) => {
    setSelectedAttachment(attachment);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('bg-BG', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderMessageStatus = (message: Message) => {
    if (message.sender_id !== user?.id) return null;

    if (message.read_at) {
      return <CheckCheck size={16} color="#0066FF" />;
    } else if (message.delivered_at) {
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Check size={16} color="#0066FF" />
          <Check size={16} color="#666666" style={{ marginLeft: -8 }} />
        </View>
      );
    } else {
      return <CheckCheck size={16} color="#666666" />;
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={theme.gradients.primary} style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Съобщения</Text>
            <Text style={styles.headerSubtitle}>Чат със салона</Text>
          </View>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <View style={styles.contentContainer}>
          <>
              <ScrollView
                ref={scrollViewRef}
                style={styles.messagesContainer}
                contentContainerStyle={styles.messagesContent}
                onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
              >
            {messages.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  Все още няма съобщения. Започнете разговор!
                </Text>
              </View>
            ) : (
              messages.map((message) => (
                <View
                  key={message.id}
                  style={[
                    styles.messageRow,
                    message.sender_id === user?.id
                      ? styles.messageRowRight
                      : styles.messageRowLeft,
                  ]}
                >
                  <View
                    style={[
                      styles.messageBubble,
                      message.sender_id === user?.id
                        ? styles.messageBubbleSent
                        : styles.messageBubbleReceived,
                    ]}
                  >
                    {message.sender_id !== user?.id && (
                      <Text style={styles.senderName}>
                        {message.profiles?.full_name || 'Салон'}
                      </Text>
                    )}
                    {message.content && (
                      <>
                        <ClickableMessage
                          content={message.content}
                          style={[
                            styles.messageText,
                            message.sender_id === user?.id && styles.messageTextSent,
                          ]}
                          linkStyle={
                            message.sender_id === user?.id
                              ? { color: theme.colors.surface, textDecorationColor: theme.colors.surface }
                              : { color: theme.colors.primary, textDecorationColor: theme.colors.primary }
                          }
                        />
                      </>
                    )}
                    {message.attachment_type && message.attachment_url && (
                      <MessageAttachment
                        type={message.attachment_type as 'image' | 'file' | 'audio'}
                        url={message.attachment_url}
                        name={message.attachment_name || 'file'}
                        size={message.attachment_size || 0}
                        duration={message.attachment_duration || undefined}
                      />
                    )}
                    <View style={styles.messageFooter}>
                      <Text
                        style={[
                          styles.messageTime,
                          message.sender_id === user?.id && styles.messageTimeSent,
                        ]}
                      >
                        {formatTime(message.created_at)}
                      </Text>
                      {renderMessageStatus(message)}
                    </View>
                    {message.sender_id === user?.id && message.read_at && (
                      <Text
                        style={[
                          styles.readAtText,
                          styles.messageTimeSent,
                        ]}
                      >
                        Видяно {new Date(message.read_at).toLocaleDateString('bg-BG', {
                          day: 'numeric',
                          month: 'short',
                        })}{' '}
                        в {new Date(message.read_at).toLocaleTimeString('bg-BG', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    )}
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          {selectedAttachment && (
            <View style={styles.attachmentPreview}>
              <MessageAttachment
                type={selectedAttachment.type}
                url={selectedAttachment.url}
                name={selectedAttachment.name}
                size={selectedAttachment.size}
                duration={selectedAttachment.duration}
              />
              <TouchableOpacity
                style={styles.removeAttachment}
                onPress={() => setSelectedAttachment(null)}
              >
                <X size={16} color={theme.colors.surface} />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.inputContainer}>
              <TouchableOpacity
                style={styles.attachButton}
                onPress={() => setShowAttachmentPicker(true)}
              >
                <Paperclip size={22} color={theme.colors.primary} />
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                placeholder="Напишете съобщение..."
                placeholderTextColor={theme.colors.textMuted}
                value={newMessage}
                onChangeText={setNewMessage}
                onSubmitEditing={sendMessage}
                multiline
                maxLength={500}
                blurOnSubmit={false}
              />
              <TouchableOpacity
                style={[styles.sendButton, sending && styles.sendButtonDisabled]}
                onPress={sendMessage}
                disabled={sending || (!newMessage.trim() && !selectedAttachment)}
              >
                {sending ? (
                  <ActivityIndicator size="small" color={theme.colors.surface} />
                ) : (
                  <Send size={20} color={theme.colors.surface} />
                )}
              </TouchableOpacity>
            </View>
          </>
        </View>
      )}

      <MessageAttachmentPicker
        visible={showAttachmentPicker}
        onClose={() => setShowAttachmentPicker(false)}
        onAttachmentSelected={handleAttachmentSelected}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  contentContainer: {
    flex: 1,
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
  headerTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.surface,
  },
  headerSubtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.surface,
    opacity: 0.8,
    marginTop: theme.spacing.xs,
  },
  notificationButton: {
    padding: theme.spacing.sm,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: theme.spacing.md,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.xxl,
  },
  emptyText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  messageRow: {
    marginBottom: theme.spacing.md,
  },
  messageRowLeft: {
    alignItems: 'flex-start',
  },
  messageRowRight: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    maxWidth: '75%',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    ...theme.shadows.sm,
  },
  messageBubbleReceived: {
    backgroundColor: theme.colors.surface,
  },
  messageBubbleSent: {
    backgroundColor: theme.colors.primary,
  },
  senderName: {
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
    color: theme.colors.primary,
    marginBottom: theme.spacing.xs,
  },
  messageText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    lineHeight: 20,
  },
  messageTextSent: {
    color: theme.colors.surface,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  messageTime: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  messageTimeSent: {
    color: 'rgba(255, 255, 255, 0.7)',
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
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    gap: theme.spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  attachButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachmentPreview: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
    position: 'relative',
  },
  removeAttachment: {
    position: 'absolute',
    top: theme.spacing.md,
    right: theme.spacing.md,
    backgroundColor: theme.colors.error,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.sm,
  },
});
