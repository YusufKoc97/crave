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
import { useAuth } from '@/context/AuthContext';

export default function SignUpScreen() {
  const { applySession } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const canSubmit =
    !submitting && !info && isValidEmail(email) && password.length >= 6;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    setInfo(null);
    const { data, error: authError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
    });
    if (authError) {
      setError(translateAuthError(authError.message));
      setSubmitting(false);
      return;
    }
    if (!data.session) {
      // Email confirmation is on — let the user know to check their inbox.
      setInfo(
        'Hesabın oluşturuldu. E-posta adresine gönderdiğimiz onay linkine tıkla.'
      );
      setSubmitting(false);
      return;
    }
    // Push the session into AuthContext synchronously so the root index
    // gate sees a non-null session on the same render — onAuthStateChange
    // would arrive a tick too late and bounce us back to sign-in.
    applySession(data.session);
    // Brand-new accounts have no username yet; let the root index route
    // them through /setup-username before landing in /(tabs).
    router.replace('/');
  };

  return (
    <View style={styles.root}>
      <View style={styles.center}>
        <Text style={styles.brand}>CRAVE</Text>
        <Text style={styles.title}>Hesap oluştur</Text>
        <Text style={styles.subtitle}>
          Dürüst bir başlangıç. Tek bir e-posta yeter.
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
            returnKeyType="next"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>ŞİFRE</Text>
          <View style={styles.passwordWrap}>
            <TextInput
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                if (error) setError(null);
              }}
              placeholder="en az 6 karakter"
              placeholderTextColor="#3D5470"
              style={[styles.input, styles.passwordInput]}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              autoComplete="password-new"
              returnKeyType="done"
              onSubmitEditing={submit}
            />
            <Pressable
              onPress={() => setShowPassword((v) => !v)}
              style={styles.eyeBtn}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={
                showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'
              }
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color="#6B8BA4"
              />
            </Pressable>
          </View>
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={14} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {info && (
          <View style={styles.infoBox}>
            <Ionicons name="mail-outline" size={14} color="#7DC3FF" />
            <Text style={styles.infoText}>{info}</Text>
          </View>
        )}

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
                Oluşturuluyor...
              </Text>
            </View>
          ) : (
            <Text
              style={[
                styles.submitText,
                { color: canSubmit ? '#7DC3FF' : '#3D5470' },
              ]}
            >
              Hesap oluştur
            </Text>
          )}
        </Pressable>

        <Text style={styles.legal}>
          Devam ederek kullanım koşullarını ve gizlilik politikasını kabul
          ediyorsun.
        </Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Zaten hesabın var mı?</Text>
        <Pressable
          onPress={() => router.replace('/(auth)/sign-in')}
          hitSlop={8}
        >
          <Text style={styles.footerLink}>Giriş yap</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#020810',
    paddingHorizontal: 24,
    paddingTop: 90,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
  },
  brand: {
    color: '#3B82F6',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 6,
    marginBottom: 28,
  },
  title: {
    color: '#F1F5F9',
    fontSize: 28,
    fontWeight: '300',
    letterSpacing: 0.5,
  },
  subtitle: {
    marginTop: 10,
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 36,
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
  passwordWrap: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 44,
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingVertical: 9,
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
  legal: {
    marginTop: 14,
    color: '#3D5470',
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 16,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 12,
  },
  footerText: {
    color: '#6B8BA4',
    fontSize: 13,
  },
  footerLink: {
    color: '#7DC3FF',
    fontSize: 13,
    fontWeight: '600',
  },
});
