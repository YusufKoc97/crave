import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ChevronRight, Crown } from 'lucide-react-native';
import { useReducedMotion } from '@/components/toolkit/useReducedMotion';
import { useIsPremium } from '@/lib/premium';
import { openPaywall } from '@/lib/paywall';
import { useStreakMap, type StreakDay } from '@/lib/streakMap';
import { t } from '@/lib/i18n';
import { hexAlpha } from './coreTheme';

/**
 * STREAK MAP — Profile's per-day resist heatmap (premium history).
 *
 * A GitHub-contribution-graph read of the user's history: 7 weekday
 * rows × N week columns, each cell one calendar day. The ONLY thing a
 * cell colour encodes is how many cravings were resisted that day
 * (0..4+ teal ramp); a give-in day shows a warm diagonal slash.
 *
 * DELIBERATELY NOT a second "streak" number. The app's one streak —
 * consecutive resisted cravings — lives on the Lifetime medallion
 * above. This panel visualises *daily activity*, so it carries no
 * streak count of its own (an earlier version showed a day-based
 * streak here, which competed with the Lifetime number and confused
 * the reading). A numbered legend spells the colour → count mapping in
 * every state, and tapping a day surfaces its exact count.
 *
 * Free vs premium: the last 14 days always render crisp (with the
 * legend, so the colours are legible); premium unlocks the full
 * horizontally-scrolling history back to day one. The free lock is a
 * clean CTA banner — no fake ghost squares, which previously read as
 * real data.
 *
 * RN adaptations (no new deps): CSS grid → flex week columns in a
 * horizontal ScrollView; give-in slash → a tiny SVG <Line>; per-cell
 * pop-in is omitted (≈150 spring cells janks cheap Android) — the panel
 * fades in as one block and honors reduced motion.
 */

// ── Tokens (neutral Profile palette, not an addiction accent) ──
const CORE = '#4fd0dd';
const GOLD = '#e8c87c';
const WARM = '#e0a07a';
const TEXT = '#e8ecf6';
const MUTE = '#8a93a8';
const FAINT = '#5c6a86';

const CELL = 15;
const GAP = 3;
const COL_W = CELL + GAP;
const DAY_LABEL_W = 22;
const RADIUS = 3;

const LEVEL_BG = [
  'rgba(255,255,255,0.05)',
  hexAlpha(CORE, 0.26),
  hexAlpha(CORE, 0.46),
  hexAlpha(CORE, 0.68),
  CORE,
] as const;

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const DAY_NAMES: Record<number, string> = { 0: 'Mon', 2: 'Wed', 4: 'Fri' };

function todayMidnight(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function formatDay(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

// One week column = 7 weekday slots (Mon..Sun). Leading slots before the
// first day stay null (transparent, ragged edge like GitHub).
type Slot = { day: StreakDay; index: number } | null;

function toColumns(days: StreakDay[]): Slot[][] {
  const cols: Slot[][] = [];
  let col: Slot[] = new Array(7).fill(null);
  let dirty = false;
  days.forEach((day, index) => {
    const wd = (new Date(day.dateMs).getDay() + 6) % 7; // Mon=0 … Sun=6
    col[wd] = { day, index };
    dirty = true;
    if (wd === 6) {
      cols.push(col);
      col = new Array(7).fill(null);
      dirty = false;
    }
  });
  if (dirty) cols.push(col);
  return cols;
}

// ──────────────────────────── Cells ────────────────────────────

function Slash({ size = CELL }: { size?: number }) {
  return (
    <Svg width={size} height={size}>
      <Line
        x1={2.5}
        y1={size - 2.5}
        x2={size - 2.5}
        y2={2.5}
        stroke={hexAlpha(WARM, 0.8)}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function DayCell({
  slot,
  todayMs,
  selectedMs,
  onSelect,
}: {
  slot: Slot;
  todayMs: number;
  selectedMs: number | null;
  onSelect: (day: StreakDay) => void;
}) {
  if (!slot) return <View style={styles.cellSpacer} />;
  const { day } = slot;

  const isToday = day.dateMs === todayMs;
  const isSelected = day.dateMs === selectedMs;
  const ring = isSelected
    ? { borderWidth: 1.5, borderColor: '#ffffff' }
    : isToday
      ? { borderWidth: 1.5, borderColor: hexAlpha(CORE, 0.9) }
      : null;

  return (
    <Pressable onPress={() => onSelect(day)} hitSlop={2}>
      {day.giveIn ? (
        <View style={[styles.giveIn, ring]}>
          <Slash />
        </View>
      ) : (
        <View
          style={[styles.cell, { backgroundColor: LEVEL_BG[day.level] }, ring]}
        />
      )}
    </Pressable>
  );
}

function GhostCell({ level = 0 }: { level?: number }) {
  return <View style={[styles.cell, { backgroundColor: LEVEL_BG[level] }]} />;
}

// ──────────────────────────── Grid pieces ────────────────────────────

function DayLabels() {
  return (
    <View style={styles.dayLabelCol}>
      {Array.from({ length: 7 }).map((_, r) => (
        <View key={r} style={styles.cell}>
          <Text style={styles.dayLabelText}>{DAY_NAMES[r] ?? ''}</Text>
        </View>
      ))}
    </View>
  );
}

function MonthRow({ columns }: { columns: Slot[][] }) {
  let prev = -1;
  const labels = columns.map((col) => {
    const first = col.find((s): s is NonNullable<Slot> => !!s);
    if (!first) return '';
    const m = new Date(first.day.dateMs).getMonth();
    if (m === prev) return '';
    prev = m;
    return MONTHS[m];
  });
  return (
    <View style={styles.monthRow}>
      {labels.map((lab, ci) => (
        <View key={ci} style={styles.monthCell}>
          <Text style={styles.monthText} numberOfLines={1}>
            {lab}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Columns({
  columns,
  todayMs,
  selectedMs,
  onSelect,
}: {
  columns: Slot[][];
  todayMs: number;
  selectedMs: number | null;
  onSelect: (day: StreakDay) => void;
}) {
  return (
    <View style={styles.columnsRow}>
      {columns.map((col, ci) => (
        <View key={ci} style={styles.column}>
          {col.map((slot, ri) => (
            <DayCell
              key={ri}
              slot={slot}
              todayMs={todayMs}
              selectedMs={selectedMs}
              onSelect={onSelect}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

// The colour → count key the design asked for ("her rengin temsil
// ettiği direniş sayısı"). Shown in every populated state.
function Legend() {
  return (
    <View style={styles.legend}>
      <Text style={styles.legendCap}>
        {t('profile.streak_map.legend_resisted')}
      </Text>
      <View style={styles.legendItems}>
        {[0, 1, 2, 3, 4].map((n) => (
          <View key={n} style={styles.legendItem}>
            <View
              style={[styles.legendSwatch, { backgroundColor: LEVEL_BG[n] }]}
            />
            <Text style={styles.legendNum}>{n === 4 ? '4+' : n}</Text>
          </View>
        ))}
        <View style={styles.legendItem}>
          <View style={styles.legendGiveIn}>
            <Slash size={13} />
          </View>
          <Text style={styles.legendNum}>
            {t('profile.streak_map.legend_gave_in')}
          </Text>
        </View>
      </View>
    </View>
  );
}

function Header({ right }: { right?: React.ReactNode }) {
  return (
    <View style={styles.header}>
      <Text style={styles.headerLabel}>{t('profile.streak_map.label')}</Text>
      <View style={styles.headerRule} />
      {right}
    </View>
  );
}

// The tap read-out — turns the grid into an answer to "how many resists
// that day?" without a heavy tooltip layer.
function Caption({ selected }: { selected: StreakDay | null }) {
  let text: string;
  if (!selected) {
    text = t('profile.streak_map.tap_hint');
  } else if (selected.giveIn) {
    text = `${formatDay(selected.dateMs)} · ${t('profile.streak_map.day_gave_in')}`;
  } else if (selected.resisted > 0) {
    text = `${formatDay(selected.dateMs)} · ${t(
      'profile.streak_map.day_resisted',
      {
        count: selected.resisted,
      }
    )}`;
  } else {
    text = `${formatDay(selected.dateMs)} · ${t('profile.streak_map.day_none')}`;
  }
  return <Text style={styles.caption}>{text}</Text>;
}

// ──────────────────────────── States ────────────────────────────

function EmptyState() {
  const columns = useMemo(() => {
    const cols: null[][] = [];
    for (let c = 0; c < 14; c++) cols.push(new Array(7).fill(null));
    return cols;
  }, []);
  return (
    <>
      <Header />
      <View style={styles.ghostBlock}>
        <View style={styles.columnsRow}>
          {columns.map((col, ci) => (
            <View key={ci} style={styles.column}>
              {col.map((_, ri) => (
                <GhostCell key={ri} />
              ))}
            </View>
          ))}
        </View>
      </View>
      <View style={styles.copyBlock}>
        <Text style={styles.copyTitle}>
          {t('profile.streak_map.empty_title')}
        </Text>
        <Text style={styles.copyBody}>
          {t('profile.streak_map.empty_body')}
        </Text>
      </View>
    </>
  );
}

function LoadingState() {
  const columns = useMemo(() => {
    const cols: null[][] = [];
    for (let c = 0; c < 14; c++) cols.push(new Array(7).fill(null));
    return cols;
  }, []);
  return (
    <>
      <Header />
      <View style={styles.loadingBlock}>
        <View style={styles.columnsRow}>
          {columns.map((col, ci) => (
            <View key={ci} style={styles.column}>
              {col.map((_, ri) => (
                <GhostCell key={ri} />
              ))}
            </View>
          ))}
        </View>
      </View>
    </>
  );
}

function LowDataState({
  days,
  recordCount,
  todayMs,
  selectedMs,
  selected,
  onSelect,
}: {
  days: StreakDay[];
  recordCount: number;
  todayMs: number;
  selectedMs: number | null;
  selected: StreakDay | null;
  onSelect: (day: StreakDay) => void;
}) {
  const columns = useMemo(() => toColumns(days), [days]);
  return (
    <>
      <Header
        right={
          <Text style={styles.headerMeta}>
            {t('profile.streak_map.lowdata_days', { count: recordCount })}
          </Text>
        }
      />
      <Caption selected={selected} />
      <Legend />
      <View style={styles.gridRow}>
        <DayLabels />
        <Columns
          columns={columns}
          todayMs={todayMs}
          selectedMs={selectedMs}
          onSelect={onSelect}
        />
      </View>
      <View style={styles.copyBlock}>
        <Text style={styles.copyTitleSm}>
          {t('profile.streak_map.lowdata_title')}
        </Text>
        <Text style={styles.copyBody}>
          {t('profile.streak_map.lowdata_body')}
        </Text>
      </View>
    </>
  );
}

const FREE_WINDOW = 14;

function FreeState({
  days,
  todayMs,
  selectedMs,
  selected,
  onSelect,
  onUnlock,
}: {
  days: StreakDay[];
  todayMs: number;
  selectedMs: number | null;
  selected: StreakDay | null;
  onSelect: (day: StreakDay) => void;
  onUnlock: () => void;
}) {
  const columns = useMemo(() => toColumns(days.slice(-FREE_WINDOW)), [days]);
  return (
    <>
      <Header
        right={
          <Text style={styles.headerMeta}>
            {t('profile.streak_map.last_14')}
          </Text>
        }
      />
      <Caption selected={selected} />
      <Legend />
      <View style={styles.gridRow}>
        <DayLabels />
        <Columns
          columns={columns}
          todayMs={todayMs}
          selectedMs={selectedMs}
          onSelect={onSelect}
        />
      </View>

      {/* Clean premium lock — no fake squares. */}
      <Pressable
        onPress={onUnlock}
        style={({ pressed }) => [
          styles.lockBanner,
          pressed && { opacity: 0.85 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('profile.streak_map.unlock_cta')}
      >
        <View style={styles.lockIcon}>
          <Crown size={15} color={GOLD} strokeWidth={2.2} />
        </View>
        <View style={styles.lockTextWrap}>
          <Text style={styles.lockTitle}>
            {t('profile.streak_map.unlock_cta')}
          </Text>
          <Text style={styles.lockBody}>
            {t('profile.streak_map.unlock_body')}
          </Text>
        </View>
        <ChevronRight size={18} color={hexAlpha(GOLD, 0.7)} strokeWidth={2.2} />
      </Pressable>
    </>
  );
}

function FullState({
  days,
  todayMs,
  selectedMs,
  selected,
  onSelect,
}: {
  days: StreakDay[];
  todayMs: number;
  selectedMs: number | null;
  selected: StreakDay | null;
  onSelect: (day: StreakDay) => void;
}) {
  const columns = useMemo(() => toColumns(days), [days]);
  const scrollRef = useRef<ScrollView>(null);

  // Open on today (newest week, right edge).
  useEffect(() => {
    const id = setTimeout(
      () => scrollRef.current?.scrollToEnd({ animated: false }),
      0
    );
    return () => clearTimeout(id);
  }, [columns.length]);

  return (
    <>
      <Header />
      <Caption selected={selected} />
      <Legend />
      <View style={styles.fullRow}>
        {/* Weekday labels stay fixed (GitHub-style) while the grid scrolls
            — a spacer keeps their 7 rows aligned below the month row. */}
        <View>
          <View style={styles.monthSpacer} />
          <DayLabels />
        </View>
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.gridScrollPad}
        >
          <View>
            <MonthRow columns={columns} />
            <Columns
              columns={columns}
              todayMs={todayMs}
              selectedMs={selectedMs}
              onSelect={onSelect}
            />
          </View>
        </ScrollView>
      </View>
    </>
  );
}

// ──────────────────────────── Panel ────────────────────────────

export function StreakMapPanel() {
  const premium = useIsPremium();
  const reduced = useReducedMotion();
  const { days, recordCount, loading } = useStreakMap();
  const [selected, setSelected] = useState<StreakDay | null>(null);

  const todayMs = useMemo(() => todayMidnight(), []);
  const selectedMs = selected?.dateMs ?? null;
  const onSelect = (day: StreakDay) => setSelected(day);

  const onUnlock = () => openPaywall('streak_map');

  let body: React.ReactNode;
  if (loading) body = <LoadingState />;
  else if (recordCount === 0) body = <EmptyState />;
  else if (recordCount < 5)
    body = (
      <LowDataState
        days={days}
        recordCount={recordCount}
        todayMs={todayMs}
        selectedMs={selectedMs}
        selected={selected}
        onSelect={onSelect}
      />
    );
  else if (!premium)
    body = (
      <FreeState
        days={days}
        todayMs={todayMs}
        selectedMs={selectedMs}
        selected={selected}
        onSelect={onSelect}
        onUnlock={onUnlock}
      />
    );
  else
    body = (
      <FullState
        days={days}
        todayMs={todayMs}
        selectedMs={selectedMs}
        selected={selected}
        onSelect={onSelect}
      />
    );

  const entering = reduced ? undefined : FadeInDown.duration(500);

  return (
    <Animated.View entering={entering} style={styles.panel}>
      {body}
    </Animated.View>
  );
}

// ──────────────────────────── Styles ────────────────────────────

const styles = StyleSheet.create({
  panel: {
    marginTop: 22,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.055)',
    backgroundColor: 'rgba(12,19,37,0.55)',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 18,
    overflow: 'hidden',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  headerLabel: {
    color: hexAlpha(CORE, 0.85),
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 2.3,
  },
  headerRule: {
    flex: 1,
    height: 1,
    backgroundColor: hexAlpha(CORE, 0.18),
  },
  headerMeta: {
    color: hexAlpha(CORE, 0.9),
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
  },

  caption: {
    color: MUTE,
    fontSize: 11.5,
    fontWeight: '600',
    marginBottom: 10,
  },

  // Legend
  legend: {
    marginBottom: 12,
  },
  legendCap: {
    color: FAINT,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  legendItems: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    flexWrap: 'wrap',
  },
  legendItem: {
    alignItems: 'center',
    gap: 3,
  },
  legendSwatch: {
    width: 15,
    height: 15,
    borderRadius: RADIUS,
  },
  legendGiveIn: {
    width: 15,
    height: 15,
    borderRadius: RADIUS,
    backgroundColor: hexAlpha(WARM, 0.14),
    borderWidth: 1,
    borderColor: hexAlpha(WARM, 0.42),
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendNum: {
    color: MUTE,
    fontSize: 8.5,
    fontWeight: '700',
  },

  // Grid
  gridRow: {
    flexDirection: 'row',
    gap: 6,
  },
  gridScrollPad: {
    paddingRight: 4,
  },
  columnsRow: {
    flexDirection: 'row',
    gap: GAP,
  },
  column: {
    flexDirection: 'column',
    gap: GAP,
  },
  cell: {
    width: CELL,
    height: CELL,
    borderRadius: RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellSpacer: {
    width: CELL,
    height: CELL,
  },
  giveIn: {
    width: CELL,
    height: CELL,
    borderRadius: RADIUS,
    backgroundColor: hexAlpha(WARM, 0.14),
    borderWidth: 1,
    borderColor: hexAlpha(WARM, 0.42),
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayLabelCol: {
    flexDirection: 'column',
    gap: GAP,
    width: DAY_LABEL_W,
  },
  dayLabelText: {
    color: FAINT,
    fontSize: 8.5,
    fontWeight: '600',
  },
  monthRow: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  monthCell: {
    width: COL_W,
  },
  monthText: {
    // Absolute so a 3-letter month can overflow its 18px column into the
    // blank cells that follow instead of wrapping to "Ma / y".
    position: 'absolute',
    width: 34,
    color: FAINT,
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  fullRow: {
    flexDirection: 'row',
    gap: 6,
  },
  monthSpacer: {
    height: 16,
  },

  // Empty / loading
  ghostBlock: {
    opacity: 0.55,
    alignItems: 'center',
  },
  loadingBlock: {
    opacity: 0.28,
    alignItems: 'center',
  },
  copyBlock: {
    alignItems: 'center',
    marginTop: 16,
  },
  copyTitle: {
    color: TEXT,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  copyTitleSm: {
    color: TEXT,
    fontSize: 12.5,
    fontWeight: '700',
    textAlign: 'center',
  },
  copyBody: {
    color: MUTE,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 5,
    maxWidth: 260,
  },

  // Free lock banner
  lockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: hexAlpha(GOLD, 0.08),
    borderWidth: 1,
    borderColor: hexAlpha(GOLD, 0.32),
  },
  lockIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: hexAlpha(GOLD, 0.14),
    borderWidth: 1,
    borderColor: hexAlpha(GOLD, 0.35),
  },
  lockTextWrap: {
    flex: 1,
  },
  lockTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  lockBody: {
    color: MUTE,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
    marginTop: 2,
  },
});
