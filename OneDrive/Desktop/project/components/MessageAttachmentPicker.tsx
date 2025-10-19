import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Alert, Platform } from 'react-native';
import { FileText, Mic, Image as ImageIcon, X, StopCircle } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import { theme } from '@/constants/theme';

type AttachmentType = 'image' | 'file' | 'audio';

export type Attachment = {
  type: AttachmentType;
  url: string;
  name: string;
  size: number;
  duration?: number;
};

type Props = {
  onAttachmentSelected: (attachment: Attachment) => void;
  visible: boolean;
  onClose: () => void;
};

export default function MessageAttachmentPicker({ onAttachmentSelected, visible, onClose }: Props) {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.3,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const response = await fetch(asset.uri);
        const blob = await response.blob();

        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        onAttachmentSelected({
          type: 'image',
          url: base64,
          name: asset.fileName || 'image.jpg',
          size: blob.size,
        });
        onClose();
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Грешка', 'Неуспешно избиране на снимка');
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.assets && result.assets[0]) {
        const asset = result.assets[0];

        if (asset.size && asset.size > 5 * 1024 * 1024) {
          Alert.alert('Грешка', 'Файлът е твърде голям. Максимум 5MB.');
          return;
        }

        const response = await fetch(asset.uri);
        const blob = await response.blob();

        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        onAttachmentSelected({
          type: 'file',
          url: base64,
          name: asset.name,
          size: asset.size || blob.size,
        });
        onClose();
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Грешка', 'Неуспешно избиране на файл');
    }
  };

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();

      if (!permission.granted) {
        Alert.alert('Грешка', 'Нуждаем се от достъп до микрофона');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(newRecording);
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Грешка', 'Неуспешно стартиране на записа');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      setIsRecording(false);
      await recording.stopAndUnloadAsync();

      const uri = recording.getURI();
      const status = await recording.getStatusAsync();

      if (uri && status.durationMillis) {
        const response = await fetch(uri);
        const blob = await response.blob();

        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        onAttachmentSelected({
          type: 'audio',
          url: base64,
          name: 'voice_message.m4a',
          size: blob.size,
          duration: Math.round(status.durationMillis / 1000),
        });

        onClose();
      }

      setRecording(null);
    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Грешка', 'Неуспешно спиране на записа');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.container}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X size={24} color={theme.colors.text} />
          </TouchableOpacity>

          <Text style={styles.title}>Прикачи файл</Text>

          <View style={styles.optionsContainer}>
            <TouchableOpacity style={styles.option} onPress={pickImage}>
              <View style={[styles.optionIcon, { backgroundColor: theme.colors.primary }]}>
                <ImageIcon size={28} color={theme.colors.surface} />
              </View>
              <Text style={styles.optionText}>Снимка</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.option} onPress={pickDocument}>
              <View style={[styles.optionIcon, { backgroundColor: theme.colors.secondary }]}>
                <FileText size={28} color={theme.colors.surface} />
              </View>
              <Text style={styles.optionText}>Файл</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.option}
              onPress={isRecording ? stopRecording : startRecording}
            >
              <View style={[styles.optionIcon, { backgroundColor: isRecording ? theme.colors.error : theme.colors.accent }]}>
                {isRecording ? (
                  <StopCircle size={28} color={theme.colors.surface} />
                ) : (
                  <Mic size={28} color={theme.colors.surface} />
                )}
              </View>
              <Text style={styles.optionText}>{isRecording ? 'Спри запис' : 'Гласово'}</Text>
            </TouchableOpacity>
          </View>

          {isRecording && (
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>Записване...</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? 40 : theme.spacing.xl,
  },
  closeButton: {
    position: 'absolute',
    top: theme.spacing.md,
    right: theme.spacing.md,
    padding: theme.spacing.sm,
    zIndex: 1,
  },
  title: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.xl,
    textAlign: 'center',
  },
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: theme.spacing.md,
  },
  option: {
    alignItems: 'center',
    gap: theme.spacing.sm,
    flex: 1,
  },
  optionIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.md,
  },
  optionText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.text,
    textAlign: 'center',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.error,
  },
  recordingText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.error,
  },
});
