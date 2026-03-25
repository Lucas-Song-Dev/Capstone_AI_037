import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { waitFor, fireEvent, screen } from '@testing-library/react';
import { render } from '../../tests/unit/next-test-utils';
import Home from '@/app/page';
import Configuration from '@/app/configuration/page';
import TargetPower from '@/app/target-power/page';
import ServerDeployment from '@/app/server-deployment/page';
import CorePower from '@/app/core-power/page';
import DIMMPower from '@/app/dimm-power/page';
import {
  HOME_TUTORIAL_STEPS,
  CONFIGURATION_TUTORIAL_STEPS,
  TARGET_POWER_TUTORIAL_STEPS,
  SERVER_DEPLOYMENT_TUTORIAL_STEPS,
  CORE_POWER_TUTORIAL_STEPS,
  DIMM_POWER_TUTORIAL_STEPS,
} from '@/config/spotlight-page-steps';
import {
  ONBOARDING_HOME_KEY,
  ONBOARDING_CONFIGURATION_KEY,
  ONBOARDING_TARGET_POWER_KEY,
  ONBOARDING_SERVER_DEPLOYMENT_KEY,
  ONBOARDING_CORE_POWER_KEY,
  ONBOARDING_DIMM_POWER_KEY,
} from '@/lib/onboarding-storage';

const MOCK_RECT = {
  left: 120,
  top: 120,
  width: 280,
  height: 120,
  right: 400,
  bottom: 240,
  x: 120,
  y: 120,
  toJSON: () => ({}),
} as DOMRect;

const TUTORIAL_PAGES = [
  {
    name: 'Home',
    Page: Home,
    storageKey: ONBOARDING_HOME_KEY,
    steps: HOME_TUTORIAL_STEPS,
    firstHeading: 'Welcome',
  },
  {
    name: 'Configuration',
    Page: Configuration,
    storageKey: ONBOARDING_CONFIGURATION_KEY,
    steps: CONFIGURATION_TUTORIAL_STEPS,
    firstHeading: 'Configuration hub',
  },
  {
    name: 'TargetPower',
    Page: TargetPower,
    storageKey: ONBOARDING_TARGET_POWER_KEY,
    steps: TARGET_POWER_TUTORIAL_STEPS,
    firstHeading: 'Inverse (target) design',
  },
  {
    name: 'ServerDeployment',
    Page: ServerDeployment,
    storageKey: ONBOARDING_SERVER_DEPLOYMENT_KEY,
    steps: SERVER_DEPLOYMENT_TUTORIAL_STEPS,
    firstHeading: 'Deployment planning',
  },
  {
    name: 'CorePower',
    Page: CorePower,
    storageKey: ONBOARDING_CORE_POWER_KEY,
    steps: CORE_POWER_TUTORIAL_STEPS,
    firstHeading: 'Core power analysis',
  },
  {
    name: 'DIMMPower',
    Page: DIMMPower,
    storageKey: ONBOARDING_DIMM_POWER_KEY,
    steps: DIMM_POWER_TUTORIAL_STEPS,
    firstHeading: 'DIMM power analysis',
  },
] as const;

describe('Page spotlight tutorials', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 });
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      if (this.closest('[data-tutorial]') || this.hasAttribute('data-tutorial')) {
        return { ...MOCK_RECT } as DOMRect;
      }
      return {
        left: 0,
        top: 0,
        width: 0,
        height: 0,
        right: 0,
        bottom: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect;
    });
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (Element.prototype as unknown as { scrollIntoView?: unknown }).scrollIntoView;
  });

  it.each(TUTORIAL_PAGES)(
    '$name exposes every data-tutorial anchor in the DOM',
    ({ Page, steps }) => {
      render(<Page />);
      steps.forEach((step) => {
        expect(document.querySelector(step.selector), step.selector).not.toBeNull();
      });
    },
  );

  it.each(TUTORIAL_PAGES)(
    '$name completes full tour and persists storage',
    async ({ Page, storageKey, steps, firstHeading }) => {
      render(<Page />);

      await waitFor(() => {
        expect(document.querySelector('[data-spotlight-curtain]')).toBeInTheDocument();
      });

      expect(screen.getByRole('heading', { level: 2, name: firstHeading })).toBeInTheDocument();

      for (let i = 0; i < steps.length - 1; i++) {
        await waitFor(() => {
          expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
        });
        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      }

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));

      await waitFor(() => {
        expect(document.querySelector('[data-spotlight-curtain]')).not.toBeInTheDocument();
      });
      expect(localStorage.getItem(storageKey)).toBe('1');
    },
  );
});
