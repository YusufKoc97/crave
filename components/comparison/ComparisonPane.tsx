import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Lock } from 'lucide-react-native';
import type { Addiction } from '@/constants/addictions';
import { t } from '@/lib/i18n';
import { dsSectionHeaderStyle, dsSpacing } from '@/constants/designSystem';
import { ComparisonAurora } from './ComparisonAurora';
import { compColors, compHexAlpha } from './comparisonTheme';
// TEMP-COMPARISON-MOCK-DATA — remove import + call in ComparisonPane
// when the real `comparison-data` Edge Function lands.
import { mockComparisonFor, type ComparisonState } from './__mockData';

/**
 * Modül 4 root panel — the "gözlemevi" (observatory).
 *
 * Renders four vertical sections that compare the user's progress
 * with the anonymous aggregate of everyone resisting the same
 * addiction:
 *   1. Community Pulse (living stats strip)
 *   2. You vs. Community (3 bell-curve metric cards)
 *   3. Your Standing (percentile hero)
 *   4. Community Patterns (3 mini-viz aggregate cards)
 *
 * Four states cycle via a dev-only ◑ chip in the header — Full /
 * Launch / Low-data / Free. Production only ever shows the state
 * the backend signals; the chip is `__DEV__`-only.
 *
 * The addiction's accent color drives every accent surface in
 * this pane (unlike Triggers, which owns violet globally). The
 * pane sits on top of the parent detail screen's two AmbientGlow
 * layers, plus its own subtle ComparisonAurora grey-blue tint.
 *
 * Data flow (temp): `mockComparisonFor(state)` returns a canned
 * dataset for the selected chip state. When the Edge Function
 * lands, replace that single call with the query result.
 *
 * Free-tier gate is intentionally NOT mounted — see
 * TEMP-PREMIUM-GATE-DISABLED in Triggers for the pattern.
 * `FreeGate` component is defined (arrives in M4) so restoring the
 * gate is a single-line JSX swap when the paywall milestone lands.
 */

type Props = {
  addiction: Addiction;
};

export function ComparisonPane({ addiction }: Props) {
  const [state, setState] = useState<ComparisonState>('full');
  const data = mockComparisonFor(state);

  return (
    <View style={styles.root}>
      <ComparisonAurora />

      <View style={styles.wrap}>
        {/* Module kicker — matches Journey's "THE PATH", Toolkit's
            "TRY DURING A CRAVING", Triggers' "WHAT LIGHTS THE
            FUSE". Every module in the detail screen wears the
            same visual family. */}
        <View style={styles.kickerRow}>
          <Text style={styles.kicker}>{t('comparison.section_kicker')}</Text>
          <View style={styles.hairline} />
        </View>

        {/* Dev-only state cycler chip. `__DEV__` guard ensures the
            chip never renders in production bundles — real users
            see the state the backend picks for them. */}
        {__DEV__ ? (
          <DevStateChip
            state={state}
            onCycle={() => setState(cycleState(state))}
            accentColor={addiction.color}
          />
        ) : null}

        {/* M2-M4 cards mount here. For M1 we ship an empty
            placeholder so `tsc` + preview stay green while the
            visual content lands in the following commits. The
            `data` binding is intentionally referenced-but-unused
            for now so it type-checks. */}
        <View style={styles.debugPlaceholder}>
          <Text style={styles.debugText}>
            Comparison scaffold — state: {data.state}
          </Text>
        </View>

        {/* Anonymous footer — the design brief calls it out on
            every state so the trust cue never disappears. */}
        <View style={styles.anonFooter}>
          <Lock size={12} color={compHexAlpha(compColors.community, 0.9)} />
          <Text style={styles.anonText}>
            {t('comparison.anonymous_footer')}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─────────────────── Dev-only state chip ───────────────────

const STATE_ORDER: readonly ComparisonState[] = [
  'full',
  'launch',
  'lowdata',
  'free',
] as const;

function cycleState(current: ComparisonState): ComparisonState {
  const i = STATE_ORDER.indexOf(current);
  return STATE_ORDER[(i + 1) % STATE_ORDER.length];
}

const STATE_LABEL: Record<ComparisonState, string> = {
  full: 'FULL',
  launch: 'LAUNCH',
  lowdata: 'LOW DATA',
  free: 'FREE',
};

function DevStateChip({
  state,
  onCycle,
  accentColor,
}: {
  state: ComparisonState;
  onCycle: () => void;
  accentColor: string;
}) {
  return (
    <Pressable
      onPress={onCycle}
      style={({ pressed }) => [
        styles.devChip,
        {
          borderColor: compHexAlpha(accentColor, 0.35),
          backgroundColor: compHexAlpha(accentColor, pressed ? 0.16 : 0.08),
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Cycle comparison state (currently ${STATE_LABEL[state]})`}
    >
      <Text style={[styles.devChipText, { color: compColors.textSecondary }]}>
        ◑ {STATE_LABEL[state]}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingTop: 8,
    paddingBottom: 32,
  },
  wrap: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 0,
    marginBottom: dsSpacing.md,
  },
  kicker: {
    ...dsSectionHeaderStyle,
    marginTop: 0,
    marginBottom: 0,
  },
  hairline: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  devChip: {
    alignSelf: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 12,
  },
  devChipText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  debugPlaceholder: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    marginBottom: 20,
  },
  debugText: {
    color: compColors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  anonFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 24,
    opacity: 0.6,
  },
  anonText: {
    color: compColors.community,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
