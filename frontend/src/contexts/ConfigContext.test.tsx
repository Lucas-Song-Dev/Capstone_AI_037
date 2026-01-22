import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { ConfigProvider, useConfig } from './ConfigContext';
import { memoryPresets, defaultWorkload } from '@/lib/presets';
import type { MemSpec, Workload } from '@/lib/types';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('ConfigContext', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('should provide default memspec and workload', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ConfigProvider>{children}</ConfigProvider>
    );

    const { result } = renderHook(() => useConfig(), { wrapper });

    expect(result.current.memspec).toBeDefined();
    expect(result.current.workload).toBeDefined();
    expect(result.current.memspec.memoryId).toBe(memoryPresets[0].memspec.memoryId);
  });

  it('should save memspec to localStorage when changed', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ConfigProvider>{children}</ConfigProvider>
    );

    const { result } = renderHook(() => useConfig(), { wrapper });

    const newMemspec: MemSpec = {
      ...memoryPresets[0].memspec,
      memoryId: 'test_memory',
    };

    await act(async () => {
      result.current.setMemspec(newMemspec);
    });

    // Wait for useEffect to save
    await new Promise((resolve) => setTimeout(resolve, 100));

    const saved = localStorageMock.getItem('ddr5_calculator_memspec');
    expect(saved).toBeTruthy();
    if (saved) {
      const parsed = JSON.parse(saved);
      expect(parsed.memoryId).toBe('test_memory');
    }
  });

  it('should save workload to localStorage when changed', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ConfigProvider>{children}</ConfigProvider>
    );

    const { result } = renderHook(() => useConfig(), { wrapper });

    const newWorkload: Workload = {
      ...defaultWorkload,
      RDsch_percent: 30.0,
    };

    await act(async () => {
      result.current.setWorkload(newWorkload);
    });

    // Wait for useEffect to save
    await new Promise((resolve) => setTimeout(resolve, 100));

    const saved = localStorageMock.getItem('ddr5_calculator_workload');
    expect(saved).toBeTruthy();
    if (saved) {
      const parsed = JSON.parse(saved);
      expect(parsed.RDsch_percent).toBe(30.0);
    }
  });

  it('should load memspec from localStorage on mount', async () => {
    const savedMemspec: MemSpec = {
      ...memoryPresets[0].memspec,
      memoryId: 'loaded_from_storage',
    };

    localStorageMock.setItem(
      'ddr5_calculator_memspec',
      JSON.stringify(savedMemspec)
    );

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ConfigProvider>{children}</ConfigProvider>
    );

    const { result } = renderHook(() => useConfig(), { wrapper });

    // Wait for useEffect to load
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
    });

    expect(result.current.memspec.memoryId).toBe('loaded_from_storage');
  });

  it('should load workload from localStorage on mount', async () => {
    const savedWorkload: Workload = {
      ...defaultWorkload,
      RDsch_percent: 35.0,
    };

    localStorageMock.setItem(
      'ddr5_calculator_workload',
      JSON.stringify(savedWorkload)
    );

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ConfigProvider>{children}</ConfigProvider>
    );

    const { result } = renderHook(() => useConfig(), { wrapper });

    // Wait for useEffect to load
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
    });

    expect(result.current.workload.RDsch_percent).toBe(35.0);
  });
});

