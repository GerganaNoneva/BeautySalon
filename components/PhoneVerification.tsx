import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Modal } from 'react-native';
import { supabase } from '@/lib/supabase';
import { theme } from '@/constants/theme';

type PhoneVerificationModalProps = {
  visible: boolean;
  userId: string;
  onVerified: () => void;
  onClose: () => void;
};

export function PhoneVerificationModal({ visible, userId, onVerified, onClose }: PhoneVerificationModalProps) {
  const [phone, setPhone] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');

  const validatePhone = (phoneNumber: string) => {
    const cleaned = phoneNumber.replace(/\D/g, '');
    return cleaned.length >= 10;
  };

  const handleSendCode = async () => {
    if (!validatePhone(phone)) {
      setError('Моля, въведете валиден телефонен номер');
      return;
    }

    setLoading(true);
    setError('');

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedCode(code);

    setTimeout(() => {
      setCodeSent(true);
      setLoading(false);
      alert(`Вашият код за потвърждение е: ${code}\n\n(В продукция, този код ще бъде изпратен чрез SMS)`);
    }, 1000);
  };

  const handleVerifyCode = async () => {
    if (verificationCode !== generatedCode) {
      setError('Невалиден код. Моля, опитайте отново.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ phone })
        .eq('id', userId);

      if (updateError) throw updateError;

      setLoading(false);
      onVerified();
    } catch (err: any) {
      console.error('Error updating phone:', err);
      setError('Грешка при съхраняване на телефона');
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.title}>Потвърдете телефонен номер</Text>
          <Text style={styles.subtitle}>
            За да получавате уведомления за Вашите резервации
          </Text>

          {!codeSent ? (
            <>
              <TextInput
                style={styles.input}
                placeholder="+359 XXX XXX XXX"
                placeholderTextColor={theme.colors.textMuted}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                editable={!loading}
                autoFocus
              />

              {error && <Text style={styles.error}>{error}</Text>}

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleSendCode}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Изпрати код</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.skipButton} onPress={onClose}>
                <Text style={styles.skipText}>Пропусни засега</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.infoText}>
                Код за потвърждение е изпратен на {phone}
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Въведете код"
                placeholderTextColor={theme.colors.textMuted}
                value={verificationCode}
                onChangeText={setVerificationCode}
                keyboardType="number-pad"
                maxLength={6}
              />

              {error && <Text style={styles.error}>{error}</Text>}

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleVerifyCode}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Потвърди</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => {
                  setCodeSent(false);
                  setVerificationCode('');
                  setError('');
                }}
              >
                <Text style={styles.linkText}>Изпрати код отново</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalContent: {
    backgroundColor: theme.colors.cream,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    width: '100%',
    maxWidth: 400,
    ...theme.shadows.luxury,
  },
  title: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.xl,
    textAlign: 'center',
  },
  infoText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    outlineStyle: 'none',
  },
  button: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: theme.colors.cream,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
  },
  skipButton: {
    padding: theme.spacing.sm,
    alignItems: 'center',
  },
  skipText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
  },
  linkButton: {
    padding: theme.spacing.sm,
    alignItems: 'center',
  },
  linkText: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  error: {
    color: theme.colors.error,
    fontSize: theme.fontSize.sm,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
});

type PhoneVerificationProps = {
  phoneNumber?: string;
  onVerified: (phone: string) => void;
  onSkip: () => void;
};

export function PhoneVerification({ phoneNumber = '', onVerified, onSkip }: PhoneVerificationProps) {
  const [phone, setPhone] = useState(phoneNumber);
  const [verificationCode, setVerificationCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');

  const validatePhone = (phoneNumber: string) => {
    const cleaned = phoneNumber.replace(/\D/g, '');
    return cleaned.length >= 10;
  };

  const handleSendCode = async () => {
    if (!validatePhone(phone)) {
      setError('Моля, въведете валиден телефонен номер');
      return;
    }

    setLoading(true);
    setError('');

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedCode(code);

    setTimeout(() => {
      setCodeSent(true);
      setLoading(false);
      alert(`Вашият код за потвърждение е: ${code}\n\n(В продукция, този код ще бъде изпратен чрез SMS)`);
    }, 1000);
  };

  const handleVerifyCode = () => {
    if (verificationCode !== generatedCode) {
      setError('Невалиден код. Моля, опитайте отново.');
      return;
    }

    onVerified(phone);
  };

  return (
    <View style={verificationStyles.container}>
      <Text style={verificationStyles.title}>Потвърдете телефонен номер</Text>
      <Text style={verificationStyles.subtitle}>
        За да получавате SMS уведомления за Вашите резервации
      </Text>

      {!codeSent ? (
        <>
          <TextInput
            style={verificationStyles.input}
            placeholder="+359 XXX XXX XXX"
            placeholderTextColor={theme.colors.textMuted}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            editable={!loading}
            autoFocus
          />

          {error && <Text style={verificationStyles.error}>{error}</Text>}

          <TouchableOpacity
            style={[verificationStyles.button, loading && verificationStyles.buttonDisabled]}
            onPress={handleSendCode}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={verificationStyles.buttonText}>Изпрати код</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={verificationStyles.skipButton} onPress={onSkip}>
            <Text style={verificationStyles.skipText}>Пропусни засега</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={verificationStyles.infoText}>
            Код за потвърждение е изпратен на {phone}
          </Text>

          <TextInput
            style={verificationStyles.input}
            placeholder="Въведете код"
            placeholderTextColor={theme.colors.textMuted}
            value={verificationCode}
            onChangeText={setVerificationCode}
            keyboardType="number-pad"
            maxLength={6}
          />

          {error && <Text style={verificationStyles.error}>{error}</Text>}

          <TouchableOpacity
            style={[verificationStyles.button, loading && verificationStyles.buttonDisabled]}
            onPress={handleVerifyCode}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={verificationStyles.buttonText}>Потвърди</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={verificationStyles.linkButton}
            onPress={() => {
              setCodeSent(false);
              setVerificationCode('');
              setError('');
            }}
          >
            <Text style={verificationStyles.linkText}>Изпрати код отново</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const verificationStyles = StyleSheet.create({
  container: {
    padding: theme.spacing.xl,
  },
  title: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.xl,
    textAlign: 'center',
  },
  infoText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    outlineStyle: 'none',
  },
  button: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: theme.colors.cream,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
  },
  skipButton: {
    padding: theme.spacing.sm,
    alignItems: 'center',
  },
  skipText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
  },
  linkButton: {
    padding: theme.spacing.sm,
    alignItems: 'center',
  },
  linkText: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  error: {
    color: theme.colors.error,
    fontSize: theme.fontSize.sm,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
});
