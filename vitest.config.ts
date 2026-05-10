import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * Vitest scope: pure logic only. Anything that imports react,
 * react-native, expo-router, or supabase belongs in an integration
 * test, not here — those need the RN runtime which Vitest can't
 * resolve.
 *
 * Files matching `**\/*.test.ts` under tests/ are picked up; the
 * `@/` alias mirrors tsconfig so test imports look like prod imports.
 */
export default defineConfig({
  resolve: {
    alias: {
      // AsyncStorage is RN-only and imported by onboarding.ts; stub it
      // with an in-memory shim so calculateAge is testable without
      // bringing the whole RN runtime into Vitest.
      '@react-native-async-storage/async-storage': path.resolve(
        __dirname,
        'tests/stubs/asyncStorage.ts'
      ),
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    globals: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['lib/scoring.ts', 'lib/auth.ts', 'lib/community.ts',
                'lib/onboarding.ts', 'constants/emojiKeywords.ts'],
    },
  },
});
