import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { FileText, Download, Play, Pause } from 'lucide-react-native';
import { Audio } from 'expo-av';
import { theme } from '@/constants/theme';

type Props = {
  type: 'image' | 'file' | 'audio';
  url: string;
  name: string;
  size: number;
  duration?: number;
};

export default function MessageAttachment({ type, url, name, size, duration }: Props) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioPosition, setAudioPosition] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration || 0);

  useEffect(() => {
    return sound
      ? () => {
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const playAudio = async () => {
    try {
      if (sound) {
        if (isPlaying) {
          await sound.pauseAsync();
          setIsPlaying(false);
        } else {
          await sound.playAsync();
          setIsPlaying(true);
        }
      } else {
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: url },
          { shouldPlay: true },
          (status) => {
            if (status.isLoaded) {
              setAudioPosition(status.positionMillis / 1000);
              setAudioDuration(status.durationMillis ? status.durationMillis / 1000 : duration || 0);

              if (status.didJustFinish) {
                setIsPlaying(false);
                setAudioPosition(0);
              }
            }
          }
        );
        setSound(newSound);
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  };

  if (type === 'image') {
    return (
      <View style={styles.imageContainer}>
        <Image source={{ uri: url }} style={styles.image} resizeMode="cover" />
        <Text style={styles.imageName}>{name}</Text>
      </View>
    );
  }

  if (type === 'audio') {
    return (
      <View style={styles.audioContainer}>
        <TouchableOpacity style={styles.audioPlayButton} onPress={playAudio}>
          {isPlaying ? (
            <Pause size={24} color={theme.colors.surface} />
          ) : (
            <Play size={24} color={theme.colors.surface} />
          )}
        </TouchableOpacity>
        <View style={styles.audioInfo}>
          <Text style={styles.audioTitle}>Гласово съобщение</Text>
          <Text style={styles.audioTime}>{formatTime(isPlaying ? audioPosition : audioDuration)}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.fileContainer}>
      <View style={styles.fileIcon}>
        <FileText size={28} color={theme.colors.primary} />
      </View>
      <View style={styles.fileInfo}>
        <Text style={styles.fileName} numberOfLines={1}>{name}</Text>
        <Text style={styles.fileSize}>{formatBytes(size)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  imageContainer: {
    marginTop: theme.spacing.xs,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  image: {
    width: 200,
    height: 200,
    borderRadius: theme.borderRadius.md,
  },
  imageName: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
  audioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.accentLight,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.xs,
  },
  audioPlayButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioInfo: {
    flex: 1,
  },
  audioTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.text,
  },
  audioTime: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.accentLight,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.xs,
  },
  fileIcon: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.text,
  },
  fileSize: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
});
