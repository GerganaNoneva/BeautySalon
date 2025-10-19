import { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Alert, Platform, Linking } from 'react-native';
import { Audio } from 'expo-av';
import { Mic, Square, Loader } from 'lucide-react-native';
import { router } from 'expo-router';
import { theme } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type RecordingState = 'idle' | 'recording' | 'processing';

interface VoiceRecorderProps {
  onTranscriptionComplete: (data: {
    text: string;
    parsed: {
      customerName: string;
      phone: string | null;
      service: string;
      date: string;
      startTime: string;
      endTime: string;
      notes: string | null;
    };
  }) => void;
}

export function VoiceRecorder({ onTranscriptionComplete }: VoiceRecorderProps) {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [duration, setDuration] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const durationInterval = useRef<NodeJS.Timeout | null>(null);

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const stopPulseAnimation = () => {
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
  };

  const startRecording = async () => {
    try {
      console.log('startRecording called, Platform:', Platform.OS);

      if (Platform.OS === 'web') {
        console.log('Web platform detected - showing alert');
        Alert.alert(
          'Недостъпно на Web',
          'Гласовата резервация изисква мобилно устройство (iOS/Android) и development build. Моля, вижте VOICE_SETUP_REQUIREMENTS.md за инструкции.',
          [{ text: 'OK', onPress: () => console.log('Alert dismissed') }]
        );
        return;
      }

      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Грешка', 'Необходимо е разрешение за достъп до микрофона');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(recording);
      setRecordingState('recording');
      setDuration(0);
      startPulseAnimation();

      durationInterval.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Грешка', 'Неуспешно стартиране на запис');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      setRecordingState('processing');
      stopPulseAnimation();

      if (durationInterval.current) {
        clearInterval(durationInterval.current);
        durationInterval.current = null;
      }

      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      const uri = recording.getURI();
      setRecording(null);

      if (!uri) {
        throw new Error('No recording URI');
      }

      await processAudio(uri);
    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Грешка', 'Неуспешно спиране на запис');
      setRecordingState('idle');
    }
  };

  const processAudio = async (uri: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Моля, влезте отново в системата');
      }

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase не е конфигуриран правилно');
      }

      const formData = new FormData();
      formData.append('audio', {
        uri: uri,
        type: 'audio/m4a',
        name: 'recording.m4a',
      } as any);

      console.log('Uploading audio to transcribe...');
      let transcribeResponse;
      try {
        transcribeResponse = await fetch(
          `${supabaseUrl}/functions/v1/transcribe`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              'apikey': supabaseAnonKey!,
            },
            body: formData,
          }
        );
      } catch (networkError: any) {
        console.error('Network error:', networkError);
        console.error('Error details:', JSON.stringify(networkError));
        throw new Error(
          'Network грешка при свързване с Edge Functions.\n\n' +
          'Моля проверете:\n' +
          '1. Интернет връзката\n' +
          '2. Дали OPENAI_API_KEY е добавен като Supabase secret\n' +
          '3. Дали Edge Functions са активни в Dashboard\n\n' +
          `Техническа информация: ${networkError.message || 'Unknown error'}`
        );
      }

      if (!transcribeResponse.ok) {
        const errorText = await transcribeResponse.text();
        console.error('Transcribe error:', transcribeResponse.status, errorText);

        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }

        console.error('Parsed error:', errorData);

        if (transcribeResponse.status === 500) {
          if (errorData.error?.includes('OpenAI API key not configured')) {
            throw new Error(
              'OpenAI API Key не е конфигуриран!\n\n' +
              'Моля добавете OPENAI_API_KEY като Supabase secret:\n' +
              '1. Отворете Supabase Dashboard\n' +
              '2. Settings → Edge Functions → Secrets\n' +
              '3. Add secret: OPENAI_API_KEY\n\n' +
              'Вижте VOICE_SETUP_REQUIREMENTS.md за повече информация'
            );
          }

          throw new Error(
            'Edge Function грешка.\n\n' +
            `Детайли: ${errorData.error || 'Unknown error'}\n\n` +
            'Проверете Supabase Dashboard → Edge Functions → Logs'
          );
        }

        if (transcribeResponse.status === 401) {
          throw new Error(
            'Неоторизиран достъп до Edge Function.\n\n' +
            'Моля влезте отново в системата.'
          );
        }

        throw new Error(
          `Грешка при транскрипция (${transcribeResponse.status})\n\n` +
          `Детайли: ${errorData.error || errorText}`
        );
      }

      const transcribeData = await transcribeResponse.json();
      console.log('Transcription response:', transcribeData);

      const { text } = transcribeData;

      if (!text) {
        throw new Error('Няма разпознат текст от записа');
      }

      console.log('Transcribed text:', text);

      const textLower = text.toLowerCase();
      const isQuery =
        textLower.includes('кажи ми следващ') ||
        textLower.includes('кажи ми кога') ||
        textLower.includes('покажи ми следващ') ||
        textLower.includes('свободен час') ||
        textLower.includes('свободни часове') ||
        textLower.includes('кога има час') ||
        textLower.includes('има ли час') ||
        textLower.includes('кога има място') ||
        textLower.includes('позвъни') ||
        textLower.includes('обади се') ||
        textLower.includes('изпрати съобщение') ||
        textLower.includes('прати съобщение') ||
        textLower.includes('напиши на');

      if (isQuery) {
        console.log('Detected query, calling query-schedule...');
        let queryResponse;
        try {
          queryResponse = await fetch(
            `${supabaseUrl}/functions/v1/query-schedule`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${session.access_token}`,
                'apikey': supabaseAnonKey!,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ text }),
            }
          );
        } catch (networkError: any) {
          console.error('Network error on query:', networkError);
          throw new Error(
            'Network грешка при обработка на запитването.\n\n' +
            `Детайли: ${networkError.message || 'Unknown error'}`
          );
        }

        if (!queryResponse.ok) {
          const errorText = await queryResponse.text();
          console.error('Query error:', queryResponse.status, errorText);
          throw new Error(`Грешка при обработка на запитването: ${errorText}`);
        }

        const queryData = await queryResponse.json();
        console.log('Query response:', queryData);

        if (queryData.action === 'call' && queryData.data?.phone) {
          Alert.alert(
            'Обаждане',
            queryData.answer || `Обаждам се на ${queryData.data.clientName}...`,
            [
              { text: 'Отказ', style: 'cancel' },
              {
                text: 'Обади се',
                onPress: () => {
                  Linking.openURL(`tel:${queryData.data.phone}`);
                }
              }
            ]
          );
        } else if (queryData.action === 'open_chat' && queryData.data?.clientId) {
          const { data: conversations } = await supabase
            .from('conversations')
            .select('id')
            .or(`participant1.eq.${queryData.data.clientId},participant2.eq.${queryData.data.clientId}`)
            .maybeSingle();

          if (conversations) {
            router.push({
              pathname: '/(admin)/messages',
              params: { selectedConversationId: conversations.id }
            });
          } else {
            Alert.alert('Грешка', `Няма чат с ${queryData.data.clientName}`);
          }
        } else {
          Alert.alert('Отговор', queryData.answer || 'Няма отговор');
        }

        setRecordingState('idle');
        return;
      }

      console.log('Parsing reservation...');
      let parseResponse;
      try {
        parseResponse = await fetch(
          `${supabaseUrl}/functions/v1/parse-reservation`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              'apikey': supabaseAnonKey!,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text }),
          }
        );
      } catch (networkError: any) {
        console.error('Network error on parse:', networkError);
        throw new Error(
          'Network грешка при парсиране на резервация.\n\n' +
          `Детайли: ${networkError.message || 'Unknown error'}`
        );
      }

      if (!parseResponse.ok) {
        const errorText = await parseResponse.text();
        console.error('Parse error:', parseResponse.status, errorText);

        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }

        if (parseResponse.status === 500 && errorData.error?.includes('OpenAI API key')) {
          throw new Error(
            'OpenAI API Key не е конфигуриран!\n\n' +
            'Вижте предишното съобщение за инструкции.'
          );
        }

        const details = errorData.details || errorData.error || errorText;
        throw new Error(
          `Грешка при парсиране (${parseResponse.status})\n\n` +
          `Детайли: ${details}\n\n` +
          `Транскрибиран текст: "${text}"`
        );
      }

      const parsed = await parseResponse.json();
      console.log('Parsed reservation:', parsed);

      onTranscriptionComplete({ text, parsed });
      setRecordingState('idle');
      setDuration(0);
    } catch (error: any) {
      console.error('Failed to process audio:', error);
      const errorMessage = error.message || 'Неуспешна обработка на аудиото. Моля, опитайте отново.';
      Alert.alert('Грешка', errorMessage);
      setRecordingState('idle');
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePress = () => {
    console.log('handlePress called, recordingState:', recordingState);
    if (recordingState === 'idle') {
      console.log('Starting recording...');
      startRecording();
    } else if (recordingState === 'recording') {
      console.log('Stopping recording...');
      stopRecording();
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.button,
          recordingState === 'recording' && styles.buttonRecording,
        ]}
        onPress={handlePress}
        disabled={recordingState === 'processing'}
        activeOpacity={0.7}
        testID="voice-recorder-button"
      >
        <Animated.View
          style={[
            styles.iconContainer,
            { transform: [{ scale: recordingState === 'recording' ? pulseAnim : 1 }] },
          ]}
        >
          {recordingState === 'idle' && (
            <Mic size={24} color={theme.colors.primary} />
          )}
          {recordingState === 'recording' && (
            <Square size={20} color={theme.colors.error} fill={theme.colors.error} />
          )}
          {recordingState === 'processing' && (
            <Loader size={24} color={theme.colors.primary} />
          )}
        </Animated.View>
      </TouchableOpacity>

      {recordingState === 'recording' && (
        <View style={styles.durationContainer}>
          <View style={styles.recordingDot} />
          <Text style={styles.durationText}>{formatDuration(duration)}</Text>
        </View>
      )}

      {recordingState === 'processing' && (
        <Text style={styles.statusText}>Обработка...</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  button: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 10,
  },
  buttonRecording: {
    borderColor: theme.colors.error,
    backgroundColor: theme.colors.errorLight,
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    backgroundColor: theme.colors.errorLight,
    borderRadius: theme.borderRadius.full,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.error,
  },
  durationText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.error,
  },
  statusText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
  },
});
