import { describe, it, expect, beforeEach } from 'vitest';
import {
  isOnboardingComplete,
  setOnboardingComplete,
  ONBOARDING_HOME_KEY,
  ONBOARDING_CONFIGURATION_KEY,
  ONBOARDING_PAGE_KEYS,
} from './onboarding-storage';

describe('onboarding-storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('isOnboardingComplete is false when key missing', () => {
    expect(isOnboardingComplete(ONBOARDING_HOME_KEY)).toBe(false);
  });

  it('setOnboardingComplete then isOnboardingComplete is true', () => {
    setOnboardingComplete(ONBOARDING_HOME_KEY);
    expect(localStorage.getItem(ONBOARDING_HOME_KEY)).toBe('1');
    expect(isOnboardingComplete(ONBOARDING_HOME_KEY)).toBe(true);
  });

  it('uses a separate localStorage key per page (no shared flag)', () => {
    expect(new Set(ONBOARDING_PAGE_KEYS).size).toBe(ONBOARDING_PAGE_KEYS.length);

    setOnboardingComplete(ONBOARDING_HOME_KEY);
    expect(isOnboardingComplete(ONBOARDING_HOME_KEY)).toBe(true);
    expect(isOnboardingComplete(ONBOARDING_CONFIGURATION_KEY)).toBe(false);
    expect(localStorage.length).toBe(1);
    expect(localStorage.getItem(ONBOARDING_CONFIGURATION_KEY)).toBeNull();
  });
});
