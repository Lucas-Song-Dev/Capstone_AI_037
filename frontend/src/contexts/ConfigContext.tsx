import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
  type SetStateAction,
} from 'react';
import type { MemSpec, Workload } from '@/lib/types';
import { memoryPresets, defaultWorkload } from '@/lib/presets';
import { getInitialBoardState, type BoardState } from '@/lib/builderState';

/** Persisted state for Build your own (board + DIMM sliders). */
export type VisualBuilderDraft = {
  boardState: BoardState;
  width: 8 | 16;
  nbrOfColumns: number;
  nbrOfDevices: number;
  speed: number;
};

function defaultVisualBuilderDraft(): VisualBuilderDraft {
  return {
    boardState: getInitialBoardState(),
    width: 8,
    nbrOfColumns: 1024,
    nbrOfDevices: 8,
    speed: 5600,
  };
}

function parseVisualBuilderDraft(raw: unknown): VisualBuilderDraft | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const bs = o.boardState as BoardState | undefined;
  if (!bs || typeof bs !== 'object' || !Array.isArray(bs.ranks)) return null;
  return {
    boardState: bs,
    width: o.width === 16 ? 16 : 8,
    nbrOfColumns: typeof o.nbrOfColumns === 'number' ? o.nbrOfColumns : 1024,
    nbrOfDevices: typeof o.nbrOfDevices === 'number' ? o.nbrOfDevices : 8,
    speed: typeof o.speed === 'number' ? o.speed : 5600,
  };
}

interface ConfigContextType {
  memspec: MemSpec;
  workload: Workload;
  setMemspec: (memspec: MemSpec) => void;
  setWorkload: (workload: Workload) => void;
  visualBuilderDraft: VisualBuilderDraft;
  setVisualBuilderDraft: (u: SetStateAction<VisualBuilderDraft>) => void;
  loadWorkloadFromFile: (file: File) => Promise<void>;
  loadMemspecFromFile: (file: File) => Promise<void>;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

const STORAGE_KEYS = {
  MEMSPEC: 'ddr5_calculator_memspec',
  WORKLOAD: 'ddr5_calculator_workload',
  BUILDER_DRAFT: 'ddr5_calculator_visual_builder_draft',
};

function loadFromStorage<T>(key: string, defaultValue: T | null): T | null {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored) as T;
    }
  } catch (error) {
    console.warn(`Failed to load ${key} from localStorage:`, error);
  }
  return defaultValue;
}

function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Failed to save ${key} to localStorage:`, error);
  }
}

export function ConfigProvider({ children }: { children: ReactNode }) {
  // Initialize with defaults - we'll load from localStorage in useEffect
  const [memspec, setMemspecState] = useState<MemSpec>(memoryPresets[0].memspec);
  const [workload, setWorkloadState] = useState<Workload>(defaultWorkload);
  const [visualBuilderDraft, setVisualBuilderDraftState] = useState<VisualBuilderDraft>(
    defaultVisualBuilderDraft
  );
  const [isInitialized, setIsInitialized] = useState(false);

  // Load from localStorage on mount - memspec, workload, and visual builder draft together
  useEffect(() => {
    const storedMemspec = loadFromStorage<MemSpec>(STORAGE_KEYS.MEMSPEC, null);
    const storedWorkload = loadFromStorage<Workload>(STORAGE_KEYS.WORKLOAD, null);
    const storedDraft = loadFromStorage<unknown>(STORAGE_KEYS.BUILDER_DRAFT, null);
    const draft = storedDraft != null ? parseVisualBuilderDraft(storedDraft) : null;

    if (storedMemspec) {
      setMemspecState(storedMemspec);
    }
    if (storedWorkload) {
      setWorkloadState(storedWorkload);
    }
    if (draft) {
      setVisualBuilderDraftState(draft);
    }

    setIsInitialized(true);
  }, []); // Only run on mount

  // Save to localStorage whenever memspec or workload changes (but only after initial load)
  useEffect(() => {
    if (isInitialized) {
      saveToStorage(STORAGE_KEYS.MEMSPEC, memspec);
    }
  }, [memspec, isInitialized]);

  useEffect(() => {
    if (isInitialized) {
      saveToStorage(STORAGE_KEYS.WORKLOAD, workload);
    }
  }, [workload, isInitialized]);

  useEffect(() => {
    if (isInitialized) {
      saveToStorage(STORAGE_KEYS.BUILDER_DRAFT, visualBuilderDraft);
    }
  }, [visualBuilderDraft, isInitialized]);

  const setMemspec = useCallback((newMemspec: MemSpec) => {
    setMemspecState(newMemspec);
  }, []);

  const setWorkload = useCallback((newWorkload: Workload) => {
    setWorkloadState(newWorkload);
  }, []);

  const setVisualBuilderDraft = useCallback((u: SetStateAction<VisualBuilderDraft>) => {
    setVisualBuilderDraftState((prev) => (typeof u === 'function' ? u(prev) : u));
  }, []);

  const loadWorkloadFromFile = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const workloadData = (json.workload ?? json) as Partial<Workload>;
      const requiredFields: (keyof Workload)[] = [
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
      for (const field of requiredFields) {
        if (typeof workloadData[field] !== 'number' || Number.isNaN(workloadData[field])) {
          throw new Error(`Missing or invalid required field: ${field}`);
        }
      }
      setWorkload(workloadData as Workload);
    } catch (error) {
      throw new Error(
        `Failed to load workload file: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }, [setWorkload]);

  const loadMemspecFromFile = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      
      // Handle both direct memspec and wrapped in "memspec" key
      const memspecData = json.memspec || json;
      
      // Validate required sections
      if (!memspecData.memarchitecturespec) {
        throw new Error('Missing memarchitecturespec');
      }
      if (!memspecData.mempowerspec) {
        throw new Error('Missing mempowerspec');
      }
      if (!memspecData.memtimingspec) {
        throw new Error('Missing memtimingspec');
      }
      
      // Convert current values from A to mA if needed
      const powerSpec = memspecData.mempowerspec;
      const convertToMa = (val: number) => {
        // If value is less than 1, assume it's in Amps and convert to mA
        return val < 1 ? val * 1000 : val;
      };
      
      const normalizedPowerSpec = {
        ...powerSpec,
        idd0: convertToMa(powerSpec.idd0 || powerSpec.IDD0 || 0),
        idd2n: convertToMa(powerSpec.idd2n || powerSpec.IDD2N || 0),
        idd3n: convertToMa(powerSpec.idd3n || powerSpec.IDD3N || 0),
        idd4r: convertToMa(powerSpec.idd4r || powerSpec.IDD4R || 0),
        idd4w: convertToMa(powerSpec.idd4w || powerSpec.IDD4W || 0),
        idd5b: convertToMa(powerSpec.idd5b || powerSpec.IDD5B || 0),
        idd6n: convertToMa(powerSpec.idd6n || powerSpec.IDD6N || 0),
        idd2p: convertToMa(powerSpec.idd2p || powerSpec.IDD2P || 0),
        idd3p: convertToMa(powerSpec.idd3p || powerSpec.IDD3P || 0),
        ipp0: convertToMa(powerSpec.ipp0 || powerSpec.IPP0 || 0),
        ipp2n: convertToMa(powerSpec.ipp2n || powerSpec.IPP2N || 0),
        ipp3n: convertToMa(powerSpec.ipp3n || powerSpec.IPP3N || 0),
        ipp4r: convertToMa(powerSpec.ipp4r || powerSpec.IPP4R || 0),
        ipp4w: convertToMa(powerSpec.ipp4w || powerSpec.IPP4W || 0),
        ipp5b: convertToMa(powerSpec.ipp5b || powerSpec.IPP5B || 0),
        ipp6n: convertToMa(powerSpec.ipp6n || powerSpec.IPP6N || 0),
        ipp2p: convertToMa(powerSpec.ipp2p || powerSpec.IPP2P || 0),
        ipp3p: convertToMa(powerSpec.ipp3p || powerSpec.IPP3P || 0),
      };
      
      setMemspec({
        ...memspecData,
        mempowerspec: normalizedPowerSpec,
      } as MemSpec);
    } catch (error) {
      throw new Error(`Failed to load memory spec file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, []);

  return (
    <ConfigContext.Provider
      value={{
        memspec,
        workload,
        setMemspec,
        setWorkload,
        visualBuilderDraft,
        setVisualBuilderDraft,
        loadWorkloadFromFile,
        loadMemspecFromFile,
      }}
    >
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
}

