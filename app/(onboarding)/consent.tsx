import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { markOnboardingCompleted } from '@/lib/onboarding';
import { StepIndicator } from '@/components/StepIndicator';

export default function ConsentScreen() {
  const params = useLocalSearchParams<{ dob?: string }>();
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptHealth, setAcceptHealth] = useState(false);

  const canSubmit = acceptTerms && acceptHealth;

  const onSubmit = async () => {
    if (!canSubmit) return;
    await markOnboardingCompleted({
      dob: params.dob ?? '',
      consentSignedAt: new Date().toISOString(),
    });
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <StepIndicator step={2} total={2} />
        <Text style={styles.title}>Son Adım</Text>
        <Text style={styles.subtitle}>
          Devam etmek için aşağıdaki onayların ikisini de işaretleyin.
        </Text>

        <ConsentRow
          checked={acceptTerms}
          onToggle={() => setAcceptTerms((v) => !v)}
          title="Kullanım koşullarını kabul ediyorum"
          body="Uygulamanın kullanım şartlarını ve gizlilik politikasını okudum, hükümlerini kabul ediyorum."
        />

        <ConsentRow
          checked={acceptHealth}
          onToggle={() => setAcceptHealth((v) => !v)}
          title="Sağlık verisi açık rıza"
          body="Sağlık kategorisi verilerimin (bağımlılık türü, dürtü-direnme oturumlarım, başarım istatistiklerim) bu uygulama tarafından işlenmesine açık rıza veriyorum."
          highlight
        />

        <Text style={styles.helperText}>
          Bu onayları istediğiniz zaman profil ekranından geri çekebilirsiniz.
          Geri çekildiğinde verileriniz 30 gün içinde silinir.
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={onSubmit}
          disabled={!canSubmit}
          style={[
            styles.submitBtn,
            canSubmit ? styles.submitBtnActive : styles.submitBtnIdle,
          ]}
        >
          <Text
            style={[
              styles.submitText,
              { color: canSubmit ? '#7DC3FF' : '#3D5470' },
            ]}
          >
            Kaydı Tamamla
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function ConsentRow({
  checked,
  onToggle,
  title,
  body,
  highlight,
}: {
  checked: boolean;
  onToggle: () => void;
  title: string;
  body: string;
  highlight?: boolean;
}) {
  return (
    <Pressable
      onPress={onToggle}
      style={[
        styles.row,
        checked
          ? highlight
            ? styles.rowCheckedHighlight
            : styles.rowChecked
          : styles.rowIdle,
      ]}
    >
      <View
        style={[
          styles.checkbox,
          {
            borderColor: checked ? '#3B82F6' : '#3D5470',
            backgroundColor: checked ? '#3B82F6' : 'transparent',
          },
        ]}
      >
        {checked && <Text style={styles.checkmark}>✓</Text>}
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowBody}>{body}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#020810',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 24,
  },
  title: {
    marginTop: 18,
    color: '#F1F5F9',
    fontSize: 28,
    fontWeight: '300',
    letterSpacing: 1,
  },
  subtitle: {
    marginTop: 12,
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 21,
    marginBottom: 28,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  rowIdle: {
    borderColor: '#1E2D4D',
    backgroundColor: '#0A1628',
    // Resting state: just a faint inset highlight to give the card
    // a real top edge instead of flat hex.
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.03)',
  },
  rowChecked: {
    borderColor: 'rgba(59, 130, 246, 0.5)',
    backgroundColor: 'rgba(59, 130, 246, 0.06)',
    // Soft accent halo for a "lit" feel when toggled on — but not as
    // strong as primary CTAs since this is a passive accept state.
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 2,
    boxShadow:
      '0 0 10px rgba(59, 130, 246, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
  },
  rowCheckedHighlight: {
    // Health-data row when checked: stronger accent because it's the
    // explicit KVKK rıza — the user should feel they actively opted in.
    borderColor: '#3B82F6',
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 3,
    boxShadow:
      '0 0 12px rgba(59, 130, 246, 0.26), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 16,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    color: '#F1F5F9',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  rowBody: {
    marginTop: 6,
    color: '#94A3B8',
    fontSize: 12.5,
    fontWeight: '400',
    lineHeight: 18,
  },
  helperText: {
    marginTop: 18,
    color: '#6B8BA4',
    fontSize: 11.5,
    fontWeight: '400',
    lineHeight: 17,
    fontStyle: 'italic',
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 32,
  },
  submitBtn: {
    height: 54,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnActive: {
    borderColor: '#3B82F6',
    backgroundColor: 'rgba(59, 130, 246, 0.16)',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 4,
    // Final-step CTA — same accent halo as the age gate + auth CTAs.
    boxShadow:
      '0 0 14px rgba(59, 130, 246, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
  },
  submitBtnIdle: {
    borderColor: '#1A2A45',
    backgroundColor: '#080F1C',
    opacity: 0.55,
  },
  submitText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 1,
  },
});
