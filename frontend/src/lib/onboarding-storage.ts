/**
 * Per-page tutorial completion flags in localStorage.
 * Each route uses exactly one key — finishing a tour on page A does not set flags for page B.
 * Bump the `v1` suffix on a key when that page’s tutorial steps change and you want returning users to see it again.
 */
export const ONBOARDING_HOME_KEY = 'ddr5-onboarding-home-v1';
export const ONBOARDING_CONFIGURATION_KEY = 'ddr5-onboarding-configuration-v1';
export const ONBOARDING_TARGET_POWER_KEY = 'ddr5-onboarding-target-power-v1';
export const ONBOARDING_SERVER_DEPLOYMENT_KEY = 'ddr5-onboarding-server-deployment-v1';
export const ONBOARDING_CORE_POWER_KEY = 'ddr5-onboarding-core-power-v1';
export const ONBOARDING_DIMM_POWER_KEY = 'ddr5-onboarding-dimm-power-v1';

/** All spotlight tutorial keys (one distinct localStorage entry per page). */
export const ONBOARDING_PAGE_KEYS = [
  ONBOARDING_HOME_KEY,
  ONBOARDING_CONFIGURATION_KEY,
  ONBOARDING_TARGET_POWER_KEY,
  ONBOARDING_SERVER_DEPLOYMENT_KEY,
  ONBOARDING_CORE_POWER_KEY,
  ONBOARDING_DIMM_POWER_KEY,
] as const;

export function isOnboardingComplete(key: string): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(key) === '1';
}

export function setOnboardingComplete(key: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, '1');
  // Same-tab listeners (e.g. Header lock state) need an explicit signal.
  window.dispatchEvent(new CustomEvent('ddr5:onboarding-updated', { detail: { key } }));
}
