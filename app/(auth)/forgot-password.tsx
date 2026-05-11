import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { isValidEmail, translateAuthError } from '@/lib/auth';
import { useKeyboardShortcut } from '@/lib/useKeyboardShortcut';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const canSubmit = !submitting && !sent && isValidEmail(email);

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase()
    );
    setSubmitting(false);
    if (resetError) {
      setError(translateAuthError(resetError.message));
      return;
    }
    setSent(true);
  };

  useKeyboardShortcut({
    onEscape: () => router.back(),
    onSubmit: () => submit(),
  });

  return (
    <View style={styles.root}>
      <View style={styles.center}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={18} color="#7BA8C8" />
          <Text style={styles.backText}>Giriş</Text>
        </Pressable>

        <Text style={styles.brand}>CRAVE</Text>
        <Text style={styles.title}>Şifremi unuttum</Text>
        <Text style={styles.subtitle}>
          E-posta adresini gir, sıfırlama bağlantısı yollayalım.
        </Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>E-POSTA</Text>
          <TextInput
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              if (error) setError(null);
            }}
            placeholder="seninadres@ornek.com"
            placeholderTextColor="#3D5470"
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            returnKeyType="send"
            onSubmitEditing={submit}
            editable={!sent}
          />
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={14} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {sent && (
          <View style={styles.infoBox}>
            <Ionicons name="mail-outline" size={14} color="#7DC3FF" />
            <Text style={styles.infoText}>
              Sıfırlama bağlantısını {email.trim().toLowerCase()} adresine gönderdik.
              Gelen kutunu (ve spam'i) kontrol et.
            </Text>
          </View>
        )}

        {!sent && (
          <Pressable
            onPress={submit}
            disabled={!canSubmit}
            style={[
              styles.submitBtn,
              {
                borderColor: canSubmit ? '#3B82F6' : '#1A2A45',
                backgroundColor: canSubmit ? 'rgba(59,130,246,0.12)' : '#080F1C',
                opacity: canSubmit ? 1 : 0.55,
              },
            ]}
          >
            {submitting ? (
              <View style={styles.btnLoading}>
                <ActivityIndicator color="#7DC3FF" size="small" />
                <Text style={[styles.submitText, { color: '#7DC3FF' }]}>
                  Gönderiliyor...
                </Text>
              </View>
            ) : (
              <Text
                style={[
                  styles.submitText,
                  { color: canSubmit ? '#7DC3FF' : '#3D5470' },
                ]}
              >
                Bağlantı gönder
              </Text>
            )}
          </Pressable>
        )}

        {sent && (
          <Pressable
            onPress={() => router.replace('/(auth)/sign-in')}
            style={[
              styles.submitBtn,
              {
                borderColor: '#3B82F6',
                backgroundColor: 'rgba(59,130,246,0.12)',
              },
            ]}
          >
            <Text style={[styles.submitText, { color: '#7DC3FF' }]}>
              Giriş ekranına dön
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#020810',
    paddingHorizontal: 24,
    paddingTop: 70,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingRight: 10,
    marginBottom: 18,
    marginLeft: -4,
  },
  backText: {
    color: '#7BA8C8',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  brand: {
    color: '#3B82F6',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 6,
    marginBottom: 24,
  },
  title: {
    color: '#F1F5F9',
    fontSize: 26,
    fontWeight: '300',
    letterSpacing: 0.5,
  },
  subtitle: {
    marginTop: 10,
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 32,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    color: '#6B8BA4',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#0A1628',
    borderWidth: 1,
    borderColor: '#1A2A45',
    borderRadius: 11,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#F1F5F9',
    fontSize: 15,
    fontWeight: '400',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    marginBottom: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 10,
  },
  errorText: {
    flex: 1,
    color: '#EF4444',
    fontSize: 12.5,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 4,
    marginBottom: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    borderRadius: 10,
  },
  infoText: {
    flex: 1,
    color: '#7DC3FF',
    fontSize: 12.5,
    fontWeight: '500',
    letterSpacing: 0.2,
    lineHeight: 18,
  },
  submitBtn: {
    marginTop: 8,
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    fontSize: 14.5,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  btnLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});
