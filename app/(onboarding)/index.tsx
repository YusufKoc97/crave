import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { calculateAge } from '@/lib/onboarding';
import { StepIndicator } from '@/components/StepIndicator';

const MIN_AGE = 18;

export default function AgeGateScreen() {
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');

  const monthRef = useRef<TextInput>(null);
  const yearRef = useRef<TextInput>(null);

  const d = parseInt(day, 10);
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);

  const age = calculateAge(y, m, d);
  const isValidDate = age >= 0;
  const isAdult = age >= MIN_AGE;
  const tooYoung = isValidDate && !isAdult;
  const showRejection =
    tooYoung && day.length > 0 && month.length > 0 && year.length === 4;

  const allFieldsFilled =
    day.length > 0 && month.length > 0 && year.length === 4;

  const canContinue = isValidDate && isAdult;

  const onContinue = () => {
    if (!canContinue) return;
    const iso = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    router.push({
      pathname: '/(onboarding)/consent',
      params: { dob: iso },
    });
  };

  return (
    <View style={styles.root}>
      <View style={styles.center}>
        <StepIndicator step={1} total={2} />
        <Text style={styles.title}>Yaş Doğrulama</Text>
        <Text style={styles.subtitle}>
          Devam etmek için doğum tarihinizi girin.
        </Text>

        <View style={styles.dobRow}>
          <DobField
            value={day}
            onChange={(v) => {
              setDay(v);
              if (v.length === 2) monthRef.current?.focus();
            }}
            placeholder="GG"
            maxLength={2}
            autoFocus
          />
          <Text style={styles.dobSeparator}>/</Text>
          <DobField
            ref={monthRef}
            value={month}
            onChange={(v) => {
              setMonth(v);
              if (v.length === 2) yearRef.current?.focus();
            }}
            placeholder="AA"
            maxLength={2}
          />
          <Text style={styles.dobSeparator}>/</Text>
          <DobField
            ref={yearRef}
            value={year}
            onChange={setYear}
            placeholder="YYYY"
            maxLength={4}
            wide
          />
        </View>

        <View style={styles.statusArea}>
          {showRejection ? (
            <Text style={styles.rejectionText}>
              Bu uygulama 18 yaş ve üzeri içindir.
            </Text>
          ) : isValidDate && allFieldsFilled ? (
            <Text style={styles.ageText}>{age} yaşındasınız</Text>
          ) : (
            <Text style={styles.hintText}>
              Verileriniz bu cihazda kalır, dış servislerle paylaşılmaz.
            </Text>
          )}
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable
          onPress={onContinue}
          disabled={!canContinue}
          style={[
            styles.continueBtn,
            canContinue ? styles.continueBtnActive : styles.continueBtnIdle,
          ]}
        >
          <Text
            style={[
              styles.continueText,
              { color: canContinue ? '#7DC3FF' : '#3D5470' },
            ]}
          >
            Devam et
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

type DobFieldProps = {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  maxLength: number;
  wide?: boolean;
  autoFocus?: boolean;
};

const DobField = ({
  ref,
  value,
  onChange,
  placeholder,
  maxLength,
  wide,
  autoFocus,
}: DobFieldProps & { ref?: React.Ref<TextInput> }) => (
  <TextInput
    ref={ref}
    value={value}
    onChangeText={(v) => onChange(v.replace(/\D/g, '').slice(0, maxLength))}
    placeholder={placeholder}
    placeholderTextColor="#3D5470"
    keyboardType="number-pad"
    maxLength={maxLength}
    autoFocus={autoFocus}
    style={[styles.dobInput, wide && styles.dobInputWide]}
  />
);

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
  },
  dobRow: {
    marginTop: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,
  },
  dobInput: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: '#0A1628',
    borderWidth: 1,
    borderColor: '#1E2D4D',
    color: '#F1F5F9',
    fontSize: 24,
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 1.5,
    // 1px alpha-white cap on each square so the digits sit *inside*
    // a real recessed surface, not on a flat hex block.
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.04)',
  },
  dobInputWide: {
    width: 96,
  },
  dobSeparator: {
    color: '#3D5470',
    fontSize: 22,
    fontWeight: '300',
  },
  statusArea: {
    marginTop: 24,
    minHeight: 24,
  },
  hintText: {
    color: '#6B8BA4',
    fontSize: 12,
    fontWeight: '400',
  },
  ageText: {
    color: '#7BA8C8',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  rejectionText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  footer: {
    paddingTop: 12,
  },
  continueBtn: {
    height: 54,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueBtnActive: {
    borderColor: '#3B82F6',
    backgroundColor: 'rgba(59, 130, 246, 0.16)',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 4,
    // Same accent halo + inset highlight pattern as the auth CTAs.
    boxShadow:
      '0 0 14px rgba(59, 130, 246, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
  },
  continueBtnIdle: {
    borderColor: '#1A2A45',
    backgroundColor: '#080F1C',
    opacity: 0.55,
  },
  continueText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 1,
  },
});
