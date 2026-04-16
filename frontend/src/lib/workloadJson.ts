import type { Workload } from './types';

const REQUIRED_FIELDS: (keyof Workload)[] = [
  'BNK_PRE_percent',
  'CKE_LO_PRE_percent',
  'CKE_LO_ACT_percent',
  'PageHit_percent',
  'RDsch_percent',
  'RD_Data_Low_percent',
  'WRsch_percent',
  'WR_Data_Low_percent',
  'termRDsch_percent',
  'termWRsch_percent',
  'System_tRC_ns',
  'tRRDsch_ns',
];

/**
 * Parse workload JSON (root fields or `{ "workload": { ... } }`).
 * Throws Error with a short message when validation fails.
 */
export function parseWorkloadJson(text: string): Workload {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON');
  }
  if (!json || typeof json !== 'object') {
    throw new Error('Invalid JSON structure');
  }
  const root = json as Record<string, unknown>;
  const workloadData = (root.workload ?? root) as Partial<Workload>;

  for (const field of REQUIRED_FIELDS) {
    if (typeof workloadData[field] !== 'number' || Number.isNaN(workloadData[field])) {
      throw new Error(`Missing or invalid required field: ${field}`);
    }
  }

  return workloadData as Workload;
}
