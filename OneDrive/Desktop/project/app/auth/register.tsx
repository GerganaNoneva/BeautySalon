import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/contexts/AuthContext';
import { theme } from '@/constants/theme';

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp, signInWithGoogle, signInWithFacebook, session, loading: authLoading, isAdmin } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (session && !authLoading) {
      if (isAdmin) {
        router.replace('/(admin)/schedule');
      } else {
        router.replace('/(client)/booking');
      }
    }
  }, [session, authLoading, isAdmin]);


  const handleRegister = async () => {
    if (!fullName || !email || !password || !confirmPassword) {
      setError('Моля, попълнете всички полета');
      return;
    }

    if (password !== confirmPassword) {
      setError('Паролите не съвпадат');
      return;
    }

    if (password.length < 6) {
      setError('Паролата трябва да е поне 6 символа');
      return;
    }

    setLoading(true);
    setError('');

    const { error: signUpError, userId } = await signUp(email, password, fullName);

    if (signUpError) {
      setError(signUpError.message || 'Грешка при регистрацията');
    }
    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    const { error: signInError } = await signInWithGoogle();
    if (signInError) {
      setError('Грешка при вход с Google');
    }
    setLoading(false);
  };

  const handleFacebookSignIn = async () => {
    setLoading(true);
    setError('');
    const { error: signInError } = await signInWithFacebook();
    if (signInError) {
      setError('Грешка при вход с Facebook');
    }
    setLoading(false);
  };

  return (
    <LinearGradient
      colors={theme.gradients.champagne}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.title}>URBAN</Text>
            <Text style={styles.subtitle}>Регистрация</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Име и фамилия</Text>
              <TextInput
                style={styles.input}
                placeholder="Вашето име"
                placeholderTextColor={theme.colors.textMuted}
                value={fullName}
                onChangeText={setFullName}
                editable={!loading}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Имейл</Text>
              <TextInput
                style={styles.input}
                placeholder="your@email.com"
                placeholderTextColor={theme.colors.textMuted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!loading}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Парола</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={theme.colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                editable={!loading}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Потвърди парола</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={theme.colors.textMuted}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                editable={!loading}
              />
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={loading}
            >
              <LinearGradient
                colors={theme.gradients.primary}
                style={styles.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {loading ? (
                  <ActivityIndicator color={theme.colors.surface} />
                ) : (
                  <Text style={styles.buttonText}>Регистрация</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>или</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={[styles.socialButton, loading && styles.buttonDisabled]}
              onPress={handleGoogleSignIn}
              disabled={loading}
            >
              <View style={styles.socialButtonContent}>
                <View style={styles.googleIcon}>
                  <Text style={styles.googleIconText}>G</Text>
                </View>
                <Text style={styles.socialButtonText}>Продължи с Google</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.socialButton, loading && styles.buttonDisabled]}
              onPress={handleFacebookSignIn}
              disabled={loading}
            >
              <View style={styles.socialButtonContent}>
                <View style={styles.facebookIcon}>
                  <Text style={styles.facebookIconText}>f</Text>
                </View>
                <Text style={styles.socialButtonText}>Продължи с Facebook</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => router.back()}
              disabled={loading}
            >
              <Text style={styles.linkText}>
                Имате профил? <Text style={styles.linkTextBold}>Влезте</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.xxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  title: {
    fontSize: theme.fontSize.xxxl,
    fontWeight: '700',
    color: theme.colors.primary,
    letterSpacing: 4,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: theme.fontSize.lg,
    color: theme.colors.textLight,
    fontWeight: '300',
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    fontWeight: '500',
    marginBottom: theme.spacing.xs,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    ...theme.shadows.sm,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: theme.fontSize.sm,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  button: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    marginTop: theme.spacing.md,
    ...theme.shadows.md,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonGradient: {
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  buttonText: {
    color: theme.colors.surface,
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
  },
  linkButton: {
    marginTop: theme.spacing.lg,
    alignItems: 'center',
  },
  linkText: {
    color: theme.colors.textLight,
    fontSize: theme.fontSize.sm,
  },
  linkTextBold: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: theme.spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border,
  },
  dividerText: {
    marginHorizontal: theme.spacing.md,
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
  },
  socialButton: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  socialButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  socialButtonText: {
    flex: 1,
    textAlign: 'center',
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.text,
  },
  googleIcon: {
    width: 24,
    height: 24,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleIconText: {
    color: theme.colors.surface,
    fontSize: theme.fontSize.md,
    fontWeight: '700',
  },
  facebookIcon: {
    width: 24,
    height: 24,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: '#1877F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  facebookIconText: {
    color: theme.colors.surface,
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
  },
});
