import { beforeEach, describe, expect, it } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  RANK_REMINDERS_KEY,
  addRankReminders,
  drainDueRankReminders,
  isEligible,
  markBackgrounded,
  resetRankReminders,
} from '@/lib/rankReminders';

describe('isEligible', () => {
  const r = { id: 'persistent', runId: 'run-A', at: 1000 };

  it('is not due in the same run before any background', () => {
    expect(isEligible(r, 'run-A', 0)).toBe(false);
  });

  it('is due once the app was backgrounded after it was banked', () => {
    expect(isEligible(r, 'run-A', 1000)).toBe(true);
    expect(isEligible(r, 'run-A', 5000)).toBe(true);
  });

  it('is NOT due if the background happened before it was banked', () => {
    expect(isEligible(r, 'run-A', 999)).toBe(false);
  });

  it('is always due in a different run (app was cold-started)', () => {
    expect(isEligible(r, 'run-B', 0)).toBe(true);
  });
});

describe('rank reminder queue', () => {
  beforeEach(async () => {
    await resetRankReminders();
  });

  it('does not surface a rank banked in the current sitting', async () => {
    await addRankReminders(['persistent']);
    expect(await drainDueRankReminders()).toEqual([]);
  });

  it('keeps it queued and surfaces it after the app is backgrounded', async () => {
    await addRankReminders(['persistent']);
    expect(await drainDueRankReminders()).toEqual([]);

    markBackgrounded();
    expect(await drainDueRankReminders()).toEqual(['persistent']);
    // Consumed — never shown twice.
    expect(await drainDueRankReminders()).toEqual([]);
  });

  it('surfaces ranks banked in an earlier run on a cold start', async () => {
    // Simulate a previous process having written the queue.
    await AsyncStorage.setItem(
      RANK_REMINDERS_KEY,
      JSON.stringify([{ id: 'steady', runId: 'some-old-run', at: 1 }])
    );
    expect(await drainDueRankReminders()).toEqual(['steady']);
  });

  it('only drains the due ones and leaves the rest queued', async () => {
    await AsyncStorage.setItem(
      RANK_REMINDERS_KEY,
      JSON.stringify([{ id: 'steady', runId: 'some-old-run', at: 1 }])
    );
    await resetRankReminders(); // drop cache, storage cleared
    await AsyncStorage.setItem(
      RANK_REMINDERS_KEY,
      JSON.stringify([{ id: 'steady', runId: 'some-old-run', at: 1 }])
    );
    // Earlier tests moved the module's last-background clock; step past
    // it so this entry is unambiguously banked AFTER any background.
    await new Promise((r) => setTimeout(r, 5));
    await addRankReminders(['persistent']); // banked this sitting
    expect(await drainDueRankReminders()).toEqual(['steady']);
    // The fresh one is still waiting for a background/return.
    markBackgrounded();
    expect(await drainDueRankReminders()).toEqual(['persistent']);
  });

  it('dedupes the same rank banked twice', async () => {
    await addRankReminders(['persistent', 'persistent']);
    markBackgrounded();
    expect(await drainDueRankReminders()).toEqual(['persistent']);
  });

  it('ignores a corrupt stored blob', async () => {
    await AsyncStorage.setItem(RANK_REMINDERS_KEY, '{not json');
    expect(await drainDueRankReminders()).toEqual([]);
  });

  it('reset wipes the queue', async () => {
    await addRankReminders(['persistent']);
    await resetRankReminders();
    markBackgrounded();
    expect(await drainDueRankReminders()).toEqual([]);
  });
});
