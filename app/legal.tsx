import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { X } from 'lucide-react-native';
import { colors } from '@/constants/theme';
import { dsColors } from '@/constants/designSystem';
import { legalDoc, type LegalDocId } from '@/constants/legal';
import { t } from '@/lib/i18n';
import { useLanguage } from '@/lib/useLanguage';

/**
 * Privacy Policy / Terms of Use reader. Presented as a modal from the
 * onboarding consent step and from Profile → Settings, so the consent the
 * user gives ("I've read the terms and privacy policy") is backed by
 * documents they can actually open. Content lives in constants/legal.ts.
 */
export default function LegalScreen() {
  const params = useLocalSearchParams<{ doc?: string }>();
  const lang = useLanguage();
  const id: LegalDocId = params.doc === 'terms' ? 'terms' : 'privacy';
  const doc = legalDoc(id, lang);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <View style={styles.root}>
      <Pressable
        onPress={close}
        style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}
        accessibilityRole="button"
        accessibilityLabel={t('legal.close')}
        hitSlop={10}
      >
        <X size={20} strokeWidth={2} color={dsColors.textSecondary} />
      </Pressable>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{doc.title}</Text>
        <Text style={styles.updated}>{doc.updated}</Text>

        {doc.sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <Text style={styles.heading}>{section.heading}</Text>
            {section.body.map((para, i) => (
              <Text key={i} style={styles.para}>
                {para}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  closeBtn: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 40 : 16,
    right: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? 72 : 56,
    paddingBottom: 56,
  },
  title: {
    color: dsColors.textPrimary,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  updated: {
    marginTop: 6,
    color: dsColors.textTertiary,
    fontSize: 13,
    fontWeight: '500',
  },
  section: {
    marginTop: 26,
  },
  heading: {
    color: dsColors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  para: {
    color: dsColors.textSecondary,
    fontSize: 14.5,
    lineHeight: 22,
    marginBottom: 10,
  },
});
