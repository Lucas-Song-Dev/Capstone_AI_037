import type { SpotlightStep } from '@/components/SpotlightTutorial';

export const HOME_TUTORIAL_STEPS: SpotlightStep[] = [
  {
    selector: '[data-tutorial="hero-intro"]',
    title: 'Welcome',
    body: 'This workspace models DDR5 module power from JEDEC-style electrical and timing data plus a workload you control. Everything downstream—inverse design, deployment planning, core and DIMM views—reads the same Configuration, so you only set memory and activity once.',
    placement: 'bottom',
  },
  {
    selector: '[data-tutorial="get-started"]',
    title: 'Get started',
    body: 'Use this button to open Configuration. There you can pick vendor presets, paste or upload JSON memspecs and workloads, or use the visual DIMM builder. Changes persist in the browser so you can hop between pages without losing work.',
    placement: 'bottom',
  },
  {
    selector: '[data-tutorial="how-to-configure"]',
    title: 'Step 1 — Configure',
    body: 'Start by locking in a memory architecture and power table, then a workload (read/write mix, refresh, timing). Accurate inputs here drive all power numbers; if something looks wrong later, return here first.',
    placement: 'top',
  },
  {
    selector: '[data-tutorial="how-to-core-power"]',
    title: 'Step 2 — Core power',
    body: 'Core Power shows per-die totals, a 3D chip view, line-item breakdown, and charts. It answers “how much does the silicon burn?” Use it to compare presets and to sanity-check IDD-style contributions.',
    placement: 'top',
  },
  {
    selector: '[data-tutorial="how-to-dimm-power"]',
    title: 'Step 3 — DIMM power',
    body: 'DIMM Power adds interface and module overhead on top of core. Use it when you care about stick-level budget, thermal limits at the module, or comparing against system power rails.',
    placement: 'top',
  },
  {
    selector: '[data-tutorial="home-features"]',
    title: 'Features & persistence',
    body: 'JSON upload, autosaved Configuration, live recalculation, and JESD79-5-aligned modeling are summarized here. The header links reach Inverse Design, Deployment Planning, Configuration, Core Power, and DIMM Power anytime.',
    placement: 'top',
  },
];

export const CONFIGURATION_TUTORIAL_STEPS: SpotlightStep[] = [
  {
    selector: '[data-tutorial="configuration-intro"]',
    title: 'Configuration hub',
    body: 'This page is the single source of truth for memspec and workload. Inverse search, server planning, and both power dashboards consume these values. Adjusting voltage, IDD currents, or workload percentages updates every dependent page after recalculation.',
    placement: 'bottom',
  },
  {
    selector: '[data-tutorial="configuration-tabs"]',
    title: 'Preset or build',
    body: 'Preset loads catalog parts and workloads with quick selectors. Build your own opens the visual DIMM layout; applying writes a custom memspec back into Preset mode so you can still use uploads and the parameter panel.',
    placement: 'bottom',
  },
  {
    selector: '[data-tutorial="configuration-presets"]',
    title: 'Memory & workload presets',
    body: 'Choose manufacturer, device, speed bin, and a workload profile. These set the baseline architecture and activity factors before you open the detailed editors. Custom JSON elsewhere overrides preset selection when loaded.',
    placement: 'top',
  },
  {
    selector: '[data-tutorial="configuration-panel"]',
    title: 'Fine-tune parameters',
    body: 'The panel exposes timing, voltage, and current fields from your memspec plus workload knobs. Edits apply immediately to the in-memory model; watch Core and DIMM pages after saving mentally which fields moved the needle.',
    placement: 'top',
  },
  {
    selector: '[data-tutorial="configuration-uploads"]',
    title: 'Upload JSON',
    body: 'Drop in a full memspec package or a standalone workload file when you already have lab or EDA exports. Successful loads switch markers to custom; errors surface in the alerts with format hints below each uploader.',
    placement: 'top',
  },
  {
    selector: '[data-tutorial="configuration-power-nav"]',
    title: 'Open power views',
    body: 'When you are satisfied with Configuration, jump to Core Power for die-level detail or DIMM Power for module-level totals. You can return anytime; navigation preserves your last settings via local storage.',
    placement: 'top',
  },
];

export const TARGET_POWER_TUTORIAL_STEPS: SpotlightStep[] = [
  {
    selector: '[data-tutorial="target-power-header"]',
    title: 'Inverse (target) design',
    body: 'Instead of picking a part first, you declare desired core and optional DIMM power. The search scans compatible presets under your current workload and returns the closest memspec plus achieved power and error metrics.',
    placement: 'bottom',
  },
  {
    selector: '[data-tutorial="target-power-optimization"]',
    title: 'Profile & emphasis',
    body: 'Balanced, core-optimized, and DIMM-optimized profiles change how the solver weights mismatches. Under balanced, the slider tilts penalty toward core versus whole-module power—use it when one target matters slightly more.',
    placement: 'bottom',
  },
  {
    selector: '[data-tutorial="target-power-targets"]',
    title: 'Power targets',
    body: 'Enter target total core power in watts; add optional DIMM power if you want both constraints active. The workload from Configuration defines activity, so tune workload there if search results look offset.',
    placement: 'top',
  },
  {
    selector: '[data-tutorial="target-power-submit"]',
    title: 'Run the search',
    body: 'Click to execute the preset search. Results show best match, loss, modeled powers, and charts. You can push the optimized memspec into Configuration with one action to continue in the rest of the app.',
    placement: 'top',
  },
  {
    selector: '[data-tutorial="target-power-note"]',
    title: 'Good to know',
    body: 'Results are approximate and may not be unique—multiple memspecs can land near the same power. Always verify against your vendor datasheet and lab conditions before committing to hardware.',
    placement: 'top',
  },
];

export const SERVER_DEPLOYMENT_TUTORIAL_STEPS: SpotlightStep[] = [
  {
    selector: '[data-tutorial="server-deployment-intro"]',
    title: 'Deployment planning',
    body: 'Model fleet-scale DDR5 choices: per-server power ceiling, minimum data rate, total memory footprint, DIMM slot count, server count, and workload class. The tool ranks configurations that fit and estimates per-server power.',
    placement: 'bottom',
  },
  {
    selector: '[data-tutorial="server-requirements-card"]',
    title: 'Requirements card',
    body: 'All inputs live in this card. Start with electrical and capacity limits, then fleet size, then workload behavior. Invalid combinations raise inline errors before search so you do not burn time on empty result sets.',
    placement: 'bottom',
  },
  {
    selector: '[data-tutorial="server-req-hardware"]',
    title: 'Power, speed, capacity',
    body: 'Power budget caps memory rail draw per box. Minimum data rate filters slow parts. Total capacity and max DIMMs shape how many modules and which densities are feasible—tighten these to match your motherboard and SKU policy.',
    placement: 'top',
  },
  {
    selector: '[data-tutorial="server-req-fleet"]',
    title: 'Fleet & workload',
    body: 'Server count scales energy and procurement totals in summaries. Workload type biases read/write mix assumptions so ranked configs align with database, web, HPC, or idle-ish profiles.',
    placement: 'top',
  },
  {
    selector: '[data-tutorial="server-deployment-search"]',
    title: 'Find configurations',
    body: 'Run the search to populate the results list. Select an entry to inspect DIMM mix, power, and charts. You can apply a chosen memspec back through the rest of the calculator workflow when needed.',
    placement: 'top',
  },
];

export const CORE_POWER_TUTORIAL_STEPS: SpotlightStep[] = [
  {
    selector: '[data-tutorial="core-power-intro"]',
    title: 'Core power analysis',
    body: 'This view aggregates per-die DDR5 core power from your Configuration: refresh, activate, read/write, and related IDD contributors. It is the right place to validate architecture-sensitive totals before trusting DIMM-level numbers.',
    placement: 'bottom',
  },
  {
    selector: '[data-tutorial="core-power-back"]',
    title: 'Back to Configuration',
    body: 'Use this any time you need to change memspec or workload. After edits, return here; the hook recalculates automatically so you see fresh totals, 3D, and charts without manual refresh.',
    placement: 'bottom',
  },
  {
    selector: '[data-tutorial="core-power-summary"]',
    title: 'Summary & 3D chip',
    body: 'The headline number is total core power for the configured die. The 3D block visualizes bank/rank context from your memspec—helpful when explaining where power is coming from in reviews.',
    placement: 'top',
  },
  {
    selector: '[data-tutorial="core-power-details"]',
    title: 'Detailed breakdown',
    body: 'Line items list major power components with values you can trace to inputs. Use this column when debugging a spike—often a single timing or current term moved more than expected.',
    placement: 'top',
  },
  {
    selector: '[data-tutorial="core-power-charts"]',
    title: 'Charts',
    body: 'Breakdown and distribution charts compress the same results for slides or quick comparisons. They update live with Configuration changes, so they are ideal before/after checks when tuning workload percentages.',
    placement: 'top',
  },
];

export const DIMM_POWER_TUTORIAL_STEPS: SpotlightStep[] = [
  {
    selector: '[data-tutorial="dimm-power-intro"]',
    title: 'DIMM power analysis',
    body: 'Module power equals core die power plus I/O and miscellaneous overhead modeled for a DIMM. It is the number you compare to thermal limits on the module and to supply planning at the edge connector.',
    placement: 'bottom',
  },
  {
    selector: '[data-tutorial="dimm-power-back"]',
    title: 'Back to Configuration',
    body: 'DIMM results always track the same memspec and workload as Core Power. If totals disagree with expectation, adjust inputs here first, then re-open this page to see interface and overhead recompute.',
    placement: 'bottom',
  },
  {
    selector: '[data-tutorial="dimm-power-visual"]',
    title: 'Visualizer',
    body: 'The diagram splits contributions so you can see core versus interface versus overhead at a glance. Hover or legend cues (if present) reinforce which block maps to which physical budget line item.',
    placement: 'top',
  },
  {
    selector: '[data-tutorial="dimm-power-footer"]',
    title: 'Nominal rails',
    body: 'Footer reminders list nominal VDD, VPP, and VDDQ for context. Your configured voltages in the memspec may differ slightly; always cross-check against the vendor data sheet for the exact SKU.',
    placement: 'top',
  },
];

/** Minimum step counts enforced by tests when expanding tours. */
export const SPOTLIGHT_TUTORIAL_MIN_STEPS = {
  home: 6,
  configuration: 6,
  targetPower: 5,
  serverDeployment: 5,
  corePower: 5,
  dimmPower: 4,
} as const;
