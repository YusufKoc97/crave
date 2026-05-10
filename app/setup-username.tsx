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
import { useAuth } from '@/context/AuthContext';
import { setUsername as persistUsername } from '@/lib/community';

const MIN_LEN = 3;
const MAX_LEN = 24;

/**
 * One-shot post-auth gate that captures a community handle. Routed into
 * by app/index.tsx whenever the active session has a profile with a
 * null/empty username. Once saved we send the user back to '/' so the
 * router decides where they truly belong (typically /(tabs)).
 */
export default function SetupUsernameScreen() {
  const { user } = useAuth();
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = value.trim();
  const valid = trimmed.length >= MIN_LEN && trimmed.length <= MAX_LEN;
  const canSubmit = !!user && !saving && valid;

  const submit = async () => {
    if (!canSubmit || !user) return;
    setSaving(true);
    setError(null);
    try {
      await persistUsername(user.id, trimmed);
      router.replace('/');
    } catch {
      setError('Kaydedilemedi. Tekrar deneyin.');
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.center}>
        <Text style={styles.kicker}>NEREDEYSE BİTTİ</Text>
        <Text style={styles.title}>Toplulukta nasıl görünmek istersin?</Text>
        <Text style={styles.subtitle}>
          Bu kullanıcı adı, paylaşımlarında görünür. Sonra profil ekranından
          değiştirebilirsin.
        </Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>KULLANICI ADI</Text>
          <TextInput
            value={value}
            onChangeText={(v) => {
              setValue(v.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, MAX_LEN));
              if (error) setError(null);
            }}
            placeholder="ör. quiet_resister"
            placeholderTextColor="#3D5470"
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            maxLength={MAX_LEN}
            returnKeyType="done"
            onSubmitEditing={submit}
          />
          <Text style={styles.helper}>
            {MIN_LEN}-{MAX_LEN} karakter. Harf, rakam, _ ve - kullanılabilir.
          </Text>
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>

      <View style={styles.footer}>
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
          {saving ? (
            <View style={styles.btnLoading}>
              <ActivityIndicator color="#7DC3FF" size="small" />
              <Text style={[styles.submitText, { color: '#7DC3FF' }]}>
                Kaydediliyor...
              </Text>
            </View>
          ) : (
            <Text
              style={[
                styles.submitText,
                { color: canSubmit ? '#7DC3FF' : '#3D5470' },
              ]}
            >
              Devam et
            </Text>
          )}
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
    paddingTop: 80,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
  },
  kicker: {
    color: '#3D5470',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 3,
  },
  title: {
    marginTop: 8,
    color: '#F1F5F9',
    fontSize: 24,
    fontWeight: '300',
    letterSpacing: 0.5,
    lineHeight: 30,
  },
  subtitle: {
    marginTop: 12,
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 32,
  },
  fieldGroup: {
    marginTop: 12,
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
  helper: {
    marginTop: 8,
    color: '#6B8BA4',
    fontSize: 11,
  },
  errorText: {
    marginTop: 14,
    color: '#EF4444',
    fontSize: 12.5,
    fontWeight: '500',
  },
  footer: {
    paddingTop: 12,
  },
  submitBtn: {
    height: 54,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 1,
  },
  btnLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});
