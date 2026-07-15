import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import {
  getCatalogEntry,
  toAddiction,
  type Addiction,
} from '@/constants/addictions';
import { useAddictions } from '@/context/AddictionsContext';
import { useAddictionScores } from '@/context/AddictionScoresContext';
import { JourneyBar } from '@/components/JourneyBar';
import { t } from '@/lib/i18n';

type IoniconName = ComponentProps<typeof Ionicons>['name'];
type SubTab = 'journey' | 'toolkit' | 'triggers' | 'comparison';

const SUB_TABS: {
  id: SubTab;
  icon: IoniconName;
  labelKey: string;
}[] = [
  { id: 'journey', icon: 'trending-up-outline', labelKey: 'modules.journey' },
  { id: 'toolkit', icon: 'construct-outline', labelKey: 'modules.toolkit' },
  { id: 'triggers', icon: 'pulse-outline', labelKey: 'modules.triggers' },
  {
    id: 'comparison',
    icon: 'bar-chart-outline',
    labelKey: 'modules.comparison',
  },
];

export default function AddictionLandingScreen() {
  const params = useLocalSearchParams<{ addictionId: string }>();
  const addictionId = params.addictionId ?? '';
  const [subTab, setSubTab] = useState<SubTab>('journey');

  const catalog = getCatalogEntry(addictionId);
  if (!catalog) {
    // Unknown id — bounce back to the Info list.
    return (
      <View style={styles.root}>
        <Header onBack={() => router.back()} title="" accentColor="#3B82F6" />
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateBody}>{t('info.section_all')}</Text>
        </View>
      </View>
    );
  }
  const addiction: Addiction = toAddiction(catalog);

  return (
    <View style={styles.root}>
      <Header
        onBack={() => router.back()}
        title={addiction.name}
        accentColor={addiction.color}
      />

      <SubTabBar
        active={subTab}
        onSelect={setSubTab}
        accentColor={addiction.color}
      />

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        {subTab === 'journey' && <JourneyPane addiction={addiction} />}
        {subTab === 'toolkit' && <ComingSoonPane />}
        {subTab === 'triggers' && <ComingSoonPane />}
        {subTab === 'comparison' && <ComingSoonPane />}
      </ScrollView>
    </View>
  );
}

function Header({
  onBack,
  title,
  accentColor,
}: {
  onBack: () => void;
  title: string;
  accentColor: string;
}) {
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onBack}
        hitSlop={10}
        style={styles.backBtn}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <Ionicons name="chevron-back" size={22} color="#7BA8C8" />
      </Pressable>
      <Text
        style={[styles.headerTitle, { color: accentColor }]}
        numberOfLines={1}
      >
        {title}
      </Text>
      {/* Right spacer keeps the title visually centred without
          calculating widths — the back button size mirrors it. */}
      <View style={styles.headerSpacer} />
    </View>
  );
}

function SubTabBar({
  active,
  onSelect,
  accentColor,
}: {
  active: SubTab;
  onSelect: (id: SubTab) => void;
  accentColor: string;
}) {
  return (
    <View style={styles.subTabRow}>
      {SUB_TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <Pressable
            key={tab.id}
            onPress={() => onSelect(tab.id)}
            style={styles.subTabBtn}
            accessibilityRole="tab"
            accessibilityLabel={t(tab.labelKey)}
            accessibilityState={{ selected: isActive }}
          >
            <View style={styles.subTabInner}>
              <Ionicons
                name={tab.icon}
                size={16}
                color={isActive ? accentColor : '#6B8BA4'}
              />
              <Text
                style={[
                  styles.subTabLabel,
                  { color: isActive ? accentColor : '#6B8BA4' },
                ]}
              >
                {t(tab.labelKey)}
              </Text>
            </View>
            {isActive && (
              <View
                style={[
                  styles.subTabUnderline,
                  { backgroundColor: accentColor },
                ]}
              />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

function JourneyPane({ addiction }: { addiction: Addiction }) {
  const { activeIds, atLimit, addAddiction } = useAddictions();
  const { viewFor, refresh } = useAddictionScores();
  const isTracked = activeIds.has(addiction.id);

  if (!isTracked) {
    return (
      <NotTrackedCta
        addiction={addiction}
        onStart={async () => {
          if (atLimit) {
            // Free-tier limit hit — bounce to the standard removal
            // Alert so the user knows what to do.
            Alert.alert(
              t('errors.addiction_limit_reached'),
              t('errors.addiction_limit_reached')
            );
            return;
          }
          try {
            await addAddiction(addiction.id);
            await refresh();
          } catch (e) {
            Alert.alert('Error', (e as Error).message);
          }
        }}
      />
    );
  }

  const view = viewFor(addiction.id);
  return <JourneyBar view={view} accentColor={addiction.color} />;
}

function NotTrackedCta({
  addiction,
  onStart,
}: {
  addiction: Addiction;
  onStart: () => void;
}) {
  return (
    <View style={styles.ctaWrap}>
      <View
        style={[
          styles.ctaBadge,
          {
            backgroundColor: addiction.bgGlow,
            borderColor: addiction.color,
          },
        ]}
      >
        <Text style={styles.ctaEmoji}>{addiction.emoji}</Text>
      </View>
      <Text style={styles.ctaTitle}>
        {t('landing.start_tracking_title', { name: addiction.name })}
      </Text>
      <Text style={styles.ctaBody}>
        {t('landing.start_tracking_body', { name: addiction.name })}
      </Text>
      <Pressable
        onPress={onStart}
        style={[
          styles.ctaBtn,
          {
            borderColor: addiction.color,
            backgroundColor: hexAlpha(addiction.color, 0.16),
          },
        ]}
        accessibilityRole="button"
      >
        <Text style={[styles.ctaBtnText, { color: addiction.color }]}>
          {t('landing.start_tracking_cta')}
        </Text>
      </Pressable>
    </View>
  );
}

function ComingSoonPane() {
  return (
    <View style={styles.comingSoonWrap}>
      <Ionicons
        name="hourglass-outline"
        size={32}
        color="#6B8BA4"
        style={{ marginBottom: 14 }}
      />
      <Text style={styles.comingSoonTitle}>
        {t('modules.coming_soon_title')}
      </Text>
      <Text style={styles.comingSoonBody}>{t('modules.coming_soon_body')}</Text>
    </View>
  );
}

function hexAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#020810',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A1628',
    borderWidth: 1,
    borderColor: '#1E2D4D',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.05)',
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.3,
    paddingHorizontal: 12,
  },
  subTabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#1E2D4D',
    marginTop: 8,
  },
  subTabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  subTabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  subTabLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  subTabUnderline: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 0,
    height: 2,
    borderRadius: 1,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingTop: 20,
    paddingBottom: 120,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyStateBody: {
    color: '#6B8BA4',
    fontSize: 13,
    textAlign: 'center',
  },
  ctaWrap: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 40,
  },
  ctaBadge: {
    width: 80,
    height: 80,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: 22,
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.06)',
  },
  ctaEmoji: {
    fontSize: 36,
  },
  ctaTitle: {
    color: '#F1F5F9',
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: 0.3,
    textAlign: 'center',
    marginBottom: 10,
  },
  ctaBody: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 24,
  },
  ctaBtn: {
    height: 48,
    minWidth: 180,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaBtnText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  comingSoonWrap: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  comingSoonTitle: {
    color: '#F1F5F9',
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  comingSoonBody: {
    color: '#6B8BA4',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});
