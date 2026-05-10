import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/theme';
import { useSessions } from '@/context/SessionsContext';
import { useAuth } from '@/context/AuthContext';
import { useAddictions } from '@/context/AddictionsContext';
import type { Addiction } from '@/constants/addictions';

export default function ProfileScreen() {
  const { totalPoints, wonToday, lostToday, momentum, streak } = useSessions();
  const { user, signOut } = useAuth();
  const { addictions, removeAddiction } = useAddictions();

  const onSignOut = async () => {
    await signOut();
    // After sign-out the root index will route us to /(auth)/sign-in.
    router.replace('/');
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>?</Text>
        </View>
        <View style={styles.dash} />

        <View style={styles.totalCard}>
          <Text style={styles.totalNumber}>{totalPoints}</Text>
          <Text style={styles.totalLabel}>TOTAL POINTS</Text>
        </View>

        <View style={styles.statsRow}>
          <StatCard
            value={wonToday}
            label="WON TODAY"
            valueColor="#10B981"
            topBorderColor="#10B981"
          />
          <StatCard
            value={lostToday}
            label="LOST TODAY"
            valueColor="#EF4444"
            topBorderColor="#EF4444"
          />
          <StatCard value={momentum} label="MOMENTUM" valueColor={colors.textPrimary} />
        </View>

        {streak > 0 && (
          <View style={styles.streakCard}>
            <Text style={styles.streakNumber}>{streak}</Text>
            <Text style={styles.streakLabel}>RESIST STREAK</Text>
          </View>
        )}
      </View>

      <View style={styles.addictionsSection}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>BAĞIMLILIKLARIM</Text>
          <Pressable
            onPress={() => router.push('/add-addiction')}
            hitSlop={8}
            style={styles.addLinkBtn}
          >
            <Ionicons name="add" size={13} color="#7DC3FF" />
            <Text style={styles.addLinkText}>Ekle</Text>
          </Pressable>
        </View>
        {addictions.length === 0 ? (
          <Text style={styles.emptyAddictions}>
            Hiç bağımlılık yok. Ana ekrandan ekleyebilirsin.
          </Text>
        ) : (
          addictions.map((a) => (
            <AddictionRow
              key={a.id}
              addiction={a}
              onRemove={() => removeAddiction(a.id)}
              onEdit={
                a.id.startsWith('custom-')
                  ? () =>
                      router.push({
                        pathname: '/add-addiction',
                        params: { id: a.id },
                      })
                  : undefined
              }
            />
          ))
        )}
      </View>

      {user && (
        <View style={styles.bottomSection}>
          <Text style={styles.emailLabel}>{user.email}</Text>
          <Pressable onPress={onSignOut} style={styles.signOutBtn} hitSlop={6}>
            <Text style={styles.signOutText}>Çıkış yap</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

function AddictionRow({
  addiction,
  onRemove,
  onEdit,
}: {
  addiction: Addiction;
  onRemove: () => void;
  onEdit?: () => void;
}) {
  const isCustom = addiction.id.startsWith('custom-');
  const Wrapper = onEdit ? Pressable : View;
  return (
    <Wrapper
      {...(onEdit ? { onPress: onEdit } : {})}
      style={styles.addictionRow}
    >
      <View
        style={[
          styles.addictionTile,
          {
            backgroundColor: hexToRgba(addiction.color, 0.14),
            borderColor: hexToRgba(addiction.color, 0.35),
          },
        ]}
      >
        <Text style={styles.addictionEmoji}>{addiction.emoji}</Text>
      </View>
      <View style={styles.addictionText}>
        <Text style={styles.addictionName} numberOfLines={1}>
          {addiction.name}
        </Text>
        <Text style={styles.addictionMeta}>
          <Text style={{ color: hexToRgba(addiction.color, 0.85) }}>
            {isCustom ? 'özel' : 'varsayılan'}
          </Text>
          <Text style={{ color: '#3D5470' }}>{'  ·  '}</Text>
          <Text style={{ color: '#94A3B8' }}>
            hassasiyet {addiction.sensitivity}
          </Text>
        </Text>
      </View>
      <Pressable onPress={onRemove} hitSlop={10} style={styles.removeBtn}>
        <Ionicons name="close" size={14} color="#6B8BA4" />
      </Pressable>
    </Wrapper>
  );
}

function hexToRgba(hex: string, alpha: number) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function StatCard({
  value,
  label,
  valueColor,
  topBorderColor,
}: {
  value: number;
  label: string;
  valueColor: string;
  topBorderColor?: string;
}) {
  return (
    <View style={styles.statCard}>
      {topBorderColor && (
        <View style={[styles.statTopBorder, { backgroundColor: topBorderColor }]} />
      )}
      <Text style={[styles.statValue, { color: valueColor }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#020810',
  },
  scrollContent: {
    paddingTop: 64,
    paddingHorizontal: 20,
    paddingBottom: 110,
  },
  topSection: {
    alignItems: 'center',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#0D1E35',
    borderWidth: 1,
    borderColor: '#1E3050',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#3B82F6',
    fontSize: 24,
    fontWeight: '500',
  },
  dash: {
    width: 24,
    height: 1.5,
    backgroundColor: '#94A3B8',
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 1,
    opacity: 0.6,
  },
  totalCard: {
    width: 140,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#0A1628',
    borderWidth: 1,
    borderColor: '#1A2840',
    alignItems: 'center',
    marginTop: 4,
  },
  totalNumber: {
    color: '#3B82F6',
    fontSize: 30,
    fontWeight: '600',
  },
  totalLabel: {
    color: '#6B8BA4',
    fontSize: 9,
    letterSpacing: 1.5,
    fontWeight: '500',
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 24,
    width: '100%',
    paddingHorizontal: 4,
  },
  statCard: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: '#0A1628',
    borderWidth: 1,
    borderColor: '#1A2840',
    alignItems: 'center',
    overflow: 'hidden',
  },
  statTopBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '700',
  },
  statLabel: {
    color: '#6B8BA4',
    fontSize: 9,
    letterSpacing: 1.5,
    fontWeight: '500',
    marginTop: 4,
  },
  streakCard: {
    marginTop: 22,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    backgroundColor: '#0A1628',
    borderWidth: 1,
    borderColor: '#3B82F640',
    alignItems: 'center',
  },
  streakNumber: {
    color: '#7DC3FF',
    fontSize: 22,
    fontWeight: '700',
  },
  streakLabel: {
    color: '#6B8BA4',
    fontSize: 9,
    letterSpacing: 1.5,
    fontWeight: '500',
    marginTop: 2,
  },
  addictionsSection: {
    marginTop: 36,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  sectionLabel: {
    color: '#6B8BA4',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 2,
  },
  addLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(125, 195, 255, 0.3)',
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
  },
  addLinkText: {
    color: '#7DC3FF',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  emptyAddictions: {
    color: '#6B8BA4',
    fontSize: 12,
    fontStyle: 'italic',
    paddingVertical: 14,
    textAlign: 'center',
  },
  addictionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  addictionTile: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addictionEmoji: {
    fontSize: 18,
    lineHeight: 22,
  },
  addictionText: {
    flex: 1,
    minWidth: 0,
  },
  addictionName: {
    color: '#F1F5F9',
    fontSize: 13.5,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  addictionMeta: {
    marginTop: 2,
    fontSize: 10.5,
    letterSpacing: 0.3,
  },
  removeBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#1A2A45',
    backgroundColor: '#0A1628',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomSection: {
    alignItems: 'center',
    marginTop: 36,
  },
  emailLabel: {
    color: '#6B8BA4',
    fontSize: 11,
    letterSpacing: 0.4,
    marginBottom: 12,
  },
  signOutBtn: {
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#1A2A45',
    backgroundColor: '#0A1628',
  },
  signOutText: {
    color: '#7BA8C8',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
});
