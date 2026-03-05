import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import type { MemSpec, Workload } from '@/lib/types';
import { memoryPresets, defaultWorkload } from '@/lib/presets';

interface ConfigContextType {
  memspec: MemSpec;
  workload: Workload;
  setMemspec: (memspec: MemSpec) => void;
  setWorkload: (workload: Workload) => void;
  loadWorkloadFromFile: (file: File) => Promise<void>;
  loadMemspecFromFile: (file: File) => Promise<void>;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

const STORAGE_KEYS = {
  MEMSPEC: 'ddr5_calculator_memspec',
  WORKLOAD: 'ddr5_calculator_workload',
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
  const [isInitialized, setIsInitialized] = useState(false);

  // Load from localStorage on mount - this ensures we always get the latest saved values
  useEffect(() => {
    const storedMemspec = loadFromStorage<MemSpec>(STORAGE_KEYS.MEMSPEC, null);
    const storedWorkload = loadFromStorage<Workload>(STORAGE_KEYS.WORKLOAD, null);
    
    if (storedMemspec) {
      setMemspecState(storedMemspec);
    }
    if (storedWorkload) {
      setWorkloadState(storedWorkload);
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

  const setMemspec = useCallback((newMemspec: MemSpec) => {
    setMemspecState(newMemspec);
  }, []);

  const setWorkload = useCallback((newWorkload: Workload) => {
    setWorkloadState(newWorkload);
  }, []);

  const loadWorkloadFromFile = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      
      // Handle both direct workload and wrapped in "workload" key
      const workloadData = json.workload || json;
      
      // Validate required fields
      const requiredFields = [
        'BNK_PRE_percent', 'CKE_LO_PRE_percent', 'CKE_LO_ACT_percent',
        'RDsch_percent', 'WRsch_percent', 'tRRDsch_ns'
      ];
      
      for (const field of requiredFields) {
        if (workloadData[field] === undefined) {
          throw new Error(`Missing required field: ${field}`);
        }
      }
      
      setWorkload(workloadData as Workload);
    } catch (error) {
      throw new Error(`Failed to load workload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, []);

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

