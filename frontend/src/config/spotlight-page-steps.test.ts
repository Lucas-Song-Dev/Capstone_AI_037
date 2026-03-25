import { describe, it, expect } from 'vitest';
import {
  HOME_TUTORIAL_STEPS,
  CONFIGURATION_TUTORIAL_STEPS,
  TARGET_POWER_TUTORIAL_STEPS,
  SERVER_DEPLOYMENT_TUTORIAL_STEPS,
  CORE_POWER_TUTORIAL_STEPS,
  DIMM_POWER_TUTORIAL_STEPS,
  SPOTLIGHT_TUTORIAL_MIN_STEPS,
} from './spotlight-page-steps';

const SELECTOR_RE = /^\[data-tutorial="([\w-]+)"\]$/;

function assertTutorialSteps(
  name: keyof typeof SPOTLIGHT_TUTORIAL_MIN_STEPS,
  steps: { selector: string; title: string; body: string }[],
) {
  const min = SPOTLIGHT_TUTORIAL_MIN_STEPS[name];
  expect(steps.length, `${name} step count`).toBeGreaterThanOrEqual(min);

  const slugs = steps.map((s) => {
    const m = s.selector.match(SELECTOR_RE);
    expect(m, `selector format: ${s.selector}`).toBeTruthy();
    return m![1];
  });
  expect(new Set(slugs).size, `${name} duplicate selectors`).toBe(slugs.length);

  steps.forEach((step, i) => {
    expect(step.title.trim().length, `${name}[${i}].title`).toBeGreaterThan(2);
    expect(step.body.trim().length, `${name}[${i}].body length`).toBeGreaterThanOrEqual(80);
  });
}

describe('spotlight-page-steps', () => {
  it('enforces minimum lengths and unique data-tutorial selectors per page', () => {
    assertTutorialSteps('home', HOME_TUTORIAL_STEPS);
    assertTutorialSteps('configuration', CONFIGURATION_TUTORIAL_STEPS);
    assertTutorialSteps('targetPower', TARGET_POWER_TUTORIAL_STEPS);
    assertTutorialSteps('serverDeployment', SERVER_DEPLOYMENT_TUTORIAL_STEPS);
    assertTutorialSteps('corePower', CORE_POWER_TUTORIAL_STEPS);
    assertTutorialSteps('dimmPower', DIMM_POWER_TUTORIAL_STEPS);
  });

  it('uses only allowed slug characters in selectors', () => {
    const all = [
      ...HOME_TUTORIAL_STEPS,
      ...CONFIGURATION_TUTORIAL_STEPS,
      ...TARGET_POWER_TUTORIAL_STEPS,
      ...SERVER_DEPLOYMENT_TUTORIAL_STEPS,
      ...CORE_POWER_TUTORIAL_STEPS,
      ...DIMM_POWER_TUTORIAL_STEPS,
    ];
    all.forEach((s) => {
      expect(s.selector).toMatch(SELECTOR_RE);
    });
  });
});
