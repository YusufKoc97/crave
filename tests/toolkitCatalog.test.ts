import { describe, expect, it } from 'vitest';
import {
  FEEDBACK_OPTIONS,
  RIDE_THE_WAVE_ADDICTIONS,
  TOOLKIT_TECHNIQUES,
  getTechnique,
  techniquesForAddiction,
  techniqueDurationLabel,
  techniqueLongDescription,
  techniqueName,
  techniqueShortDescription,
  type Technique,
  type TechniqueFeedback,
} from '@/constants/toolkitCatalog';

describe('TOOLKIT_TECHNIQUES', () => {
  it('has exactly 5 techniques (Faz 6 MVP + Ride the Wave)', () => {
    expect(TOOLKIT_TECHNIQUES.length).toBe(5);
  });

  it('carries the canonical technique ids', () => {
    expect(TOOLKIT_TECHNIQUES.map((t) => t.id)).toEqual([
      'breathing_478',
      'urge_surfing',
      'grounding_54321',
      'body_scan',
      'ride_the_wave',
    ]);
  });

  it('every technique has a positive duration', () => {
    for (const tech of TOOLKIT_TECHNIQUES) {
      expect(tech.durationSeconds).toBeGreaterThan(0);
    }
  });

  it('displayOrder is 1..N monotonic', () => {
    const sorted = [...TOOLKIT_TECHNIQUES].sort(
      (a, b) => a.displayOrder - b.displayOrder
    );
    for (let i = 0; i < sorted.length; i++) {
      expect(sorted[i].displayOrder).toBe(i + 1);
    }
  });

  it('duration values match the brief spec exactly', () => {
    // 4 cycles × 19s
    expect(getTechnique('breathing_478')?.durationSeconds).toBe(76);
    // 5 min urge surfing
    expect(getTechnique('urge_surfing')?.durationSeconds).toBe(300);
    // 3 min grounding
    expect(getTechnique('grounding_54321')?.durationSeconds).toBe(180);
    // 6 min body scan (8 regions × 45s)
    expect(getTechnique('body_scan')?.durationSeconds).toBe(360);
    // 4 min single-wave urge surfing
    expect(getTechnique('ride_the_wave')?.durationSeconds).toBe(240);
  });

  it('every technique type maps to a registered scene handler', () => {
    const validTypes = new Set([
      'breathing',
      'mindfulness',
      'grounding',
      'body_scan',
      'ride_the_wave',
    ]);
    for (const tech of TOOLKIT_TECHNIQUES) {
      expect(validTypes.has(tech.type)).toBe(true);
    }
  });
});

describe('getTechnique', () => {
  it('returns the right technique for a known id', () => {
    const tech = getTechnique('urge_surfing');
    expect(tech).toBeDefined();
    expect(tech?.emoji).toBe('🌊');
    expect(tech?.type).toBe('mindfulness');
  });

  it('returns undefined for an unknown id', () => {
    expect(getTechnique('does_not_exist')).toBeUndefined();
  });
});

describe('technique display helpers', () => {
  const tech: Technique = TOOLKIT_TECHNIQUES[0]; // breathing_478

  it('techniqueName routes through i18n', () => {
    expect(techniqueName(tech)).toBe('4-7-8 Breathing');
  });

  it('techniqueShortDescription routes through i18n', () => {
    expect(techniqueShortDescription(tech)).toBe('Calm your body');
  });

  it('techniqueLongDescription routes through i18n', () => {
    expect(techniqueLongDescription(tech)).toContain('Inhale');
  });

  it('techniqueDurationLabel rounds up short durations', () => {
    // 76s should read "2 min" not "1 min" — closer to the actual
    // time the user will spend on the flow.
    expect(techniqueDurationLabel(tech)).toBe('2 min');
  });

  it('techniqueDurationLabel formats 5-min urge surfing', () => {
    const surf = getTechnique('urge_surfing');
    if (!surf) throw new Error('urge_surfing missing');
    expect(techniqueDurationLabel(surf)).toBe('5 min');
  });

  it('techniqueDurationLabel formats 3-min grounding', () => {
    const ground = getTechnique('grounding_54321');
    if (!ground) throw new Error('grounding_54321 missing');
    expect(techniqueDurationLabel(ground)).toBe('3 min');
  });

  it('techniqueDurationLabel formats 6-min body scan', () => {
    const scan = getTechnique('body_scan');
    if (!scan) throw new Error('body_scan missing');
    expect(techniqueDurationLabel(scan)).toBe('6 min');
  });

  it('techniqueDurationLabel minimum is 1 min', () => {
    const tiny: Technique = { ...tech, durationSeconds: 20 };
    expect(techniqueDurationLabel(tiny)).toBe('1 min');
  });
});

describe('FEEDBACK_OPTIONS', () => {
  it('has exactly 4 rating options', () => {
    expect(FEEDBACK_OPTIONS.length).toBe(4);
  });

  it('carries the four canonical feedback ids', () => {
    const ids = FEEDBACK_OPTIONS.map((o) => o.id);
    expect(ids).toEqual(['much_better', 'better', 'same', 'worse']);
  });

  it('every option has a distinct emoji', () => {
    const emojis = new Set(FEEDBACK_OPTIONS.map((o) => o.emoji));
    expect(emojis.size).toBe(FEEDBACK_OPTIONS.length);
  });

  it('every option maps to an i18n label key', () => {
    for (const opt of FEEDBACK_OPTIONS) {
      expect(opt.labelKey).toMatch(/^toolkit\.feedback\.\w+$/);
    }
  });

  it('the feedback union stays in sync with the constant', () => {
    // Compile-time guard: any drift between the runtime array and
    // the TypeScript union will trip TS. We assert one value here
    // to keep this test executable, but the real guarantee is the
    // `TechniqueFeedback` type reference itself.
    const first: TechniqueFeedback = FEEDBACK_OPTIONS[0].id;
    expect(first).toBe('much_better');
  });
});

describe('i18n coverage', () => {
  it('every technique has a non-fallback name in en.json', () => {
    for (const tech of TOOLKIT_TECHNIQUES) {
      const name = techniqueName(tech);
      expect(
        name.startsWith('toolkit.'),
        `missing i18n for toolkit.techniques.${tech.id}.name`
      ).toBe(false);
    }
  });

  it('every technique has a non-fallback short description', () => {
    for (const tech of TOOLKIT_TECHNIQUES) {
      const short = techniqueShortDescription(tech);
      expect(
        short.startsWith('toolkit.'),
        `missing i18n for toolkit.techniques.${tech.id}.short_description`
      ).toBe(false);
    }
  });

  it('every technique has a non-fallback long description', () => {
    for (const tech of TOOLKIT_TECHNIQUES) {
      const long = techniqueLongDescription(tech);
      expect(
        long.startsWith('toolkit.'),
        `missing i18n for toolkit.techniques.${tech.id}.long_description`
      ).toBe(false);
    }
  });

  describe('techniquesForAddiction', () => {
    const idsFor = (a: string | null) =>
      techniquesForAddiction(a).map((tech) => tech.id);

    it('offers ride_the_wave only to the substance addictions', () => {
      for (const id of RIDE_THE_WAVE_ADDICTIONS) {
        expect(idsFor(id), `${id} should offer ride_the_wave`).toContain(
          'ride_the_wave'
        );
      }
    });

    it('hides ride_the_wave from every other addiction', () => {
      const others = [
        'caffeine',
        'gambling',
        'junk_food',
        'shopping',
        'doomscroll',
        'gaming',
      ];
      for (const id of others) {
        expect(idsFor(id), `${id} must not offer ride_the_wave`).not.toContain(
          'ride_the_wave'
        );
      }
    });

    it('keeps the four universal techniques for every addiction', () => {
      const universal = TOOLKIT_TECHNIQUES.filter((tech) => !tech.addictions);
      for (const id of ['nicotine', 'caffeine', 'gaming']) {
        const ids = idsFor(id);
        for (const tech of universal) {
          expect(ids, `${id} lost ${tech.id}`).toContain(tech.id);
        }
      }
    });

    it('falls back to the universal set when the addiction is unknown', () => {
      expect(idsFor(null)).not.toContain('ride_the_wave');
      expect(idsFor('not_a_real_addiction')).not.toContain('ride_the_wave');
      expect(idsFor(null)).toContain('breathing_478');
    });
  });
});
