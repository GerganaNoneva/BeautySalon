import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import { ExpoWebSpeechRecognition } from 'expo-speech-recognition';
import { parseVoiceCommand, ParsedVoiceCommand } from '@/utils/voiceCommandParser';

interface UseRealtimeVoiceCommandsOptions {
  onCommand: (command: ParsedVoiceCommand) => void;
  openAiApiKey: string;
  language?: string;
  continuous?: boolean;
}

interface UseRealtimeVoiceCommandsReturn {
  isListening: boolean;
  transcript: string;
  startListening: () => void;
  stopListening: () => void;
  isSupported: boolean;
  error: string | null;
  isProcessing: boolean;
}

export function useRealtimeVoiceCommands({
  onCommand,
  openAiApiKey,
  language = 'bg-BG',
  continuous = true,
}: UseRealtimeVoiceCommandsOptions): UseRealtimeVoiceCommandsReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true); // expo-speech-recognition работи навсякъде
  const [isProcessing, setIsProcessing] = useState(false);

  const recognitionRef = useRef<ExpoWebSpeechRecognition | null>(null);
  const lastCommandTimeRef = useRef<number>(0);

  // Обработка на резултатите
  const handleTranscript = useCallback(async (transcriptResult: string) => {
    console.log('🎤 Realtime transcript:', transcriptResult);
    setTranscript(transcriptResult);

    const now = Date.now();
    // Предотвратяваме множество изпълнения (debounce 2 секунди)
    if (now - lastCommandTimeRef.current < 2000) {
      return;
    }

    // Проверяваме дали транскрипцията е достатъчно дълга
    if (transcriptResult.trim().length < 5) {
      return;
    }

    try {
      setIsProcessing(true);
      lastCommandTimeRef.current = now;

      // Използваме AI за парсиране на командата
      console.log('🤖 Parsing command with AI...');
      const parsedCommand = await parseVoiceCommand(transcriptResult, openAiApiKey);

      console.log('✅ Parsed command:', parsedCommand);

      // Ако командата е разпозната с достатъчна увереност
      if (parsedCommand.type !== 'unknown' && parsedCommand.confidence > 0.7) {
        // Извикваме callback-а с командата
        onCommand(parsedCommand);

        // Спираме разпознаването след изпълнена команда
        stopListening();
      } else {
        console.log('⚠️ Command not recognized or low confidence:', parsedCommand.confidence);
        setError('Командата не беше разпозната. Опитайте отново.');
      }
    } catch (error) {
      console.error('Error parsing command:', error);
      setError('Грешка при обработка на командата');
    } finally {
      setIsProcessing(false);
    }
  }, [openAiApiKey, onCommand]);

  // Инициализация на Speech Recognition
  useEffect(() => {
    const recognition = new ExpoWebSpeechRecognition();
    recognition.lang = language;
    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log('🎤 Speech recognition started');
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: any) => {
      const results = event.results;
      if (results && results.length > 0) {
        const result = results[results.length - 1];
        if (result && result.length > 0) {
          const transcriptResult = result[0].transcript;
          handleTranscript(transcriptResult);
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.error('❌ Speech recognition error:', event.error);

      const errorMsg = event.error || 'unknown';

      if (errorMsg === 'no-speech') {
        setError('Няма разпознат глас');
      } else if (errorMsg === 'audio-capture') {
        setError('Няма достъп до микрофон');
      } else if (errorMsg === 'not-allowed') {
        setError('Разрешението за микрофон е отказано');
      } else {
        setError(`Грешка: ${errorMsg}`);
      }

      setIsListening(false);
    };

    recognition.onend = () => {
      console.log('🎤 Speech recognition ended');
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore
        }
      }
    };
  }, [continuous, language, handleTranscript]);

  const startListening = useCallback(() => {
    if (!isSupported) {
      setError('Гласовото разпознаване не е поддържано на това устройство');
      return;
    }

    if (recognitionRef.current && !isListening) {
      try {
        setTranscript('');
        setError(null);
        recognitionRef.current.start();
      } catch (error) {
        console.error('Error starting recognition:', error);
        setError('Грешка при стартиране на разпознаването');
      }
    }
  }, [isSupported, isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.error('Error stopping recognition:', error);
      }
    }
  }, [isListening]);

  return {
    isListening,
    transcript,
    startListening,
    stopListening,
    isSupported,
    error,
    isProcessing,
  };
}
