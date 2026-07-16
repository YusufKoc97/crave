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
import { ToolkitGrid } from '@/components/ToolkitGrid';
import { TechniqueRunnerModal } from '@/components/TechniqueRunnerModal';
import { TriggersPane } from '@/components/triggerMap/TriggersPane';
import { AmbientGlow } from '@/components/ui/AmbientGlow';
import {
  dsColors,
  dsFont,
  dsRadius,
  dsSpacing,
  hexAlpha,
} from '@/constants/designSystem';
import type { Technique } from '@/constants/toolkitCatalog';
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
  // Faz 6 — toolkit modal state. Info-tab launches carry no
  // session_id (context = 'info_tab'); active-session launches use
  // their own modal state.
  const [runningTechnique, setRunningTechnique] = useState<Technique | null>(
    null
  );

  const catalog = getCatalogEntry(addictionId);
  if (!catalog) {
    // Unknown id — bounce back to the Info list.
    return (
      <View style={styles.root}>
        <Header
          onBack={() => router.back()}
          title=""
          accentColor={dsColors.accentBlue}
        />
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateBody}>{t('info.section_all')}</Text>
        </View>
      </View>
    );
  }
  const addiction: Addiction = toAddiction(catalog);

  return (
    <View style={styles.root}>
      {/* Atmospheric background — two overlapping radial glows behind
          the content. Blue anchors the design system, addiction color
          adds a subtle personal accent. Both pulse in slow sinusoid. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <AmbientGlow
          color={dsColors.accentBlue}
          size={520}
          intensity="low"
          position={{ x: 190, y: 260 }}
        />
        <AmbientGlow
          color={addiction.color}
          size={340}
          intensity="low"
          position={{ x: 190, y: 520 }}
        />
      </View>

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
        {subTab === 'toolkit' && (
          <View style={{ paddingHorizontal: dsSpacing.xl }}>
            <ToolkitGrid
              accentColor={addiction.color}
              onSelect={setRunningTechnique}
            />
          </View>
        )}
        {subTab === 'triggers' && (
          <TriggersPane
            addiction={addiction}
            onNavigateSubTab={(next) => setSubTab(next)}
          />
        )}
        {subTab === 'comparison' && <ComingSoonPane />}
      </ScrollView>

      {/* Faz 6 — guided-flow overlay. Sits on top of the Info tab
          via RN Modal so the tab bar stays reachable underneath
          for cancel-and-navigate flows. Info-tab context passes
          addictionId but no session_id. */}
      <TechniqueRunnerModal
        technique={runningTechnique}
        accentColor={addiction.color}
        context="info_tab"
        addictionId={addiction.id}
        sessionId={null}
        onClose={() => setRunningTechnique(null)}
      />
    </View>
  );
}

function Header({
  onBack,
  title,
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
        <Ionicons
          name="chevron-back"
          size={22}
          color={dsColors.textSecondary}
        />
      </Pressable>
      <Text style={styles.headerTitle} numberOfLines={1}>
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
                color={isActive ? dsColors.textPrimary : dsColors.textTertiary}
              />
              <Text
                style={[
                  styles.subTabLabel,
                  {
                    color: isActive
                      ? dsColors.textPrimary
                      : dsColors.textTertiary,
                    opacity: isActive ? 1 : 0.5,
                  },
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
            backgroundColor: hexAlpha(addiction.color, 0.15),
            borderColor: hexAlpha(addiction.color, 0.4),
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
        color={dsColors.textTertiary}
        style={{ marginBottom: 14 }}
      />
      <Text style={styles.comingSoonTitle}>
        {t('modules.coming_soon_title')}
      </Text>
      <Text style={styles.comingSoonBody}>{t('modules.coming_soon_body')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: dsColors.bgBase,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: dsSpacing.md,
    paddingHorizontal: dsSpacing.lg,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: dsRadius.button,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: dsColors.cardSurface,
    borderWidth: 1,
    borderColor: dsColors.borderSubtle,
  },
  headerSpacer: {
    width: 44,
    height: 44,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: dsColors.textPrimary,
    fontSize: dsFont.size.heading,
    fontWeight: dsFont.weight.semibold,
    letterSpacing: dsFont.letterSpacing.tight,
    paddingHorizontal: dsSpacing.md,
  },
  subTabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: dsColors.borderSubtle,
    marginTop: dsSpacing.sm,
    height: 48,
  },
  subTabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subTabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subTabLabel: {
    fontSize: 14,
    fontWeight: dsFont.weight.semibold,
    letterSpacing: dsFont.letterSpacing.tight,
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
    paddingTop: dsSpacing.xl,
    paddingBottom: 120,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyStateBody: {
    color: dsColors.textTertiary,
    fontSize: dsFont.size.label,
    textAlign: 'center',
  },
  ctaWrap: {
    alignItems: 'center',
    paddingHorizontal: dsSpacing.x3l,
    paddingTop: dsSpacing.x4l,
  },
  ctaBadge: {
    width: 80,
    height: 80,
    borderRadius: dsRadius.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: dsSpacing.xxl,
  },
  ctaEmoji: {
    fontSize: 36,
  },
  ctaTitle: {
    color: dsColors.textPrimary,
    fontSize: dsFont.size.heading,
    fontWeight: dsFont.weight.semibold,
    letterSpacing: dsFont.letterSpacing.tight,
    textAlign: 'center',
    marginBottom: dsSpacing.md,
  },
  ctaBody: {
    color: dsColors.textSecondary,
    fontSize: dsFont.size.label,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: dsSpacing.xxl,
  },
  ctaBtn: {
    height: 48,
    minWidth: 180,
    paddingHorizontal: dsSpacing.xl,
    borderRadius: dsRadius.button,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaBtnText: {
    fontSize: dsFont.size.body,
    fontWeight: dsFont.weight.semibold,
    letterSpacing: dsFont.letterSpacing.tight,
  },
  comingSoonWrap: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  comingSoonTitle: {
    color: dsColors.textPrimary,
    fontSize: dsFont.size.bodyLg,
    fontWeight: dsFont.weight.semibold,
    letterSpacing: dsFont.letterSpacing.tight,
    marginBottom: dsSpacing.sm,
  },
  comingSoonBody: {
    color: dsColors.textTertiary,
    fontSize: dsFont.size.label,
    lineHeight: 19,
    textAlign: 'center',
  },
});
