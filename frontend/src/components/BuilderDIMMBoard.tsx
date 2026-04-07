'use client';

import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useTheme } from 'next-themes';
import { MemoryDie } from '@/components/DDR5Chip3D';
import type { BoardState } from '@/lib/builderState';
import { MAX_BANK_GROUPS } from '@/lib/builderState';
import { cn } from '@/lib/utils';

export interface BuilderDIMMBoardProps {
  boardState: BoardState;
  nbrOfBanks: number;
  nbrOfBankGroups: number;
  nbrOfRanks: number;
  /** Total BG count across ranks for 3D layout (e.g. 8 = 2 rows × 4). */
  totalBankGroups: number;
  /** Actual bank count for 3D chip visual (0 when bank group is new). */
  displayBanks: number;
  /** Per bank group in rank order — real bank counts so the die does not spread totals across ranks. */
  banksPerGroupExact: number[];
  width: number;
  nbrOfColumns: number;
  burstLength: number;
  nbrOfDevices: number;
}

const CHIP_POSITION: [number, number, number] = [0, 0, 0];

function BuilderBoardInner(props: BuilderDIMMBoardProps) {
  const rotatingRef = useRef<THREE.Group>(null);
  const {
    boardState,
    nbrOfRanks,
    totalBankGroups,
    displayBanks,
    banksPerGroupExact,
  } = props;

  const rank0 = boardState.ranks[0] ?? null;
  const rank1 = boardState.ranks[1] ?? null;

  useFrame((state) => {
    if (rotatingRef.current) {
      rotatingRef.current.rotation.y = state.clock.elapsedTime * 0.08;
    }
  });

  return (
    <group ref={rotatingRef}>
      {/* PCB */}
      <mesh position={[0, -0.5, 0]}>
        <boxGeometry args={[6, 0.12, 2.5]} />
        <meshStandardMaterial color="#0f7d40" metalness={0.3} roughness={0.65} />
      </mesh>
      <mesh position={[0, -0.6, 0]}>
        <boxGeometry args={[5, 0.06, 0.4]} />
        <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Chip: totalBankGroups for layout (2 rows × 4), displayBanks for tile count. No I/O pads in builder so orange strips are not mistaken for ranks. */}
      {nbrOfRanks > 0 ? (
        <MemoryDie
          position={CHIP_POSITION}
          bankGroups={Math.max(totalBankGroups, 1)}
          banks={displayBanks}
          banksPerGroupExact={banksPerGroupExact}
          color="#3b82f6"
          showIoPads={false}
        />
      ) : (
        <group position={CHIP_POSITION}>
          <mesh>
            <boxGeometry args={[2.5, 0.15, 1.8]} />
            <meshStandardMaterial color="#1a1a2e" metalness={0.5} roughness={0.5} />
          </mesh>
        </group>
      )}

      {/* Rank indicators: show only the number of ranks actually added (1 = left strip, 2 = left + right strip) so it matches "Ranks 1" / "Ranks 2" in the UI */}
      {nbrOfRanks >= 1 && (
        <group position={[-1.35, 0.06, 0]}>
          <mesh>
            <boxGeometry args={[0.12, 0.05, 1.2]} />
            <meshStandardMaterial color="#0ea5e9" emissive="#06b6d4" emissiveIntensity={0.2} metalness={0.4} roughness={0.5} />
          </mesh>
        </group>
      )}
      {nbrOfRanks >= 2 && (
        <group position={[1.35, 0.06, 0]}>
          <mesh>
            <boxGeometry args={[0.12, 0.05, 1.2]} />
            <meshStandardMaterial color="#0ea5e9" emissive="#06b6d4" emissiveIntensity={0.2} metalness={0.4} roughness={0.5} />
          </mesh>
        </group>
      )}

      {/* Caps: full indicator when rank has max (4) bank groups */}
      {rank0 && rank0.bankGroups.length >= MAX_BANK_GROUPS && (
        <group position={[-1.5, 0.08, 0.85]}>
          <mesh>
            <boxGeometry args={[0.15, 0.08, 0.25]} />
            <meshStandardMaterial color="#64748b" metalness={0.5} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.06, 0]}>
            <boxGeometry args={[0.12, 0.04, 0.12]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.4} />
          </mesh>
        </group>
      )}
      {rank1 && rank1.bankGroups.length >= MAX_BANK_GROUPS && (
        <group position={[1.5, 0.08, 0.85]}>
          <mesh>
            <boxGeometry args={[0.15, 0.08, 0.25]} />
            <meshStandardMaterial color="#64748b" metalness={0.5} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.06, 0]}>
            <boxGeometry args={[0.12, 0.04, 0.12]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.4} />
          </mesh>
        </group>
      )}
    </group>
  );
}

export function BuilderDIMMBoard(props: BuilderDIMMBoardProps) {
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === 'light';
  const canvasBg = isLight ? '#ffffff' : '#243044';
  const gridA = isLight ? '#94a3b8' : '#334155';
  const gridB = isLight ? '#cbd5e1' : '#1e293b';

  return (
    <div
      className={cn(
        'relative h-[400px] w-full rounded-lg overflow-hidden',
        isLight ? 'bg-white' : 'bg-[#243044]'
      )}
    >
      <Canvas camera={{ position: [4, 3, 4], fov: 45 }} gl={{ antialias: true }}>
        <color attach="background" args={[canvasBg]} />
        <ambientLight intensity={isLight ? 0.75 : 0.65} />
        <directionalLight position={[5, 5, 5]} intensity={isLight ? 1.05 : 1.0} />
        <directionalLight position={[-5, 3, -5]} intensity={isLight ? 0.45 : 0.5} color="#3b82f6" />
        <directionalLight position={[0, 8, 2]} intensity={isLight ? 0.55 : 0.4} color="#e2e8f0" />
        <pointLight position={[0, 3, 0]} intensity={isLight ? 0.5 : 0.6} color="#10b981" />
        <BuilderBoardInner {...props} />
        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minDistance={3}
          maxDistance={12}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2.2}
        />
        <gridHelper args={[10, 20, gridA, gridB]} position={[0, -1, 0]} />
      </Canvas>
      <div
        className={cn(
          'absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-2 rounded-md text-xs font-mono pointer-events-none border',
          isLight
            ? 'bg-white/90 text-slate-800 border-border shadow-sm'
            : 'bg-black/60 text-slate-200 border-transparent'
        )}
      >
        <span className="text-slate-400">1 DIMM</span>
        {' · Banks '}
        {props.nbrOfBanks}
        {' · BG '}
        {props.nbrOfBankGroups}
        {' · Ranks '}
        {props.nbrOfRanks}
        {' · x'}
        {props.width}
        {' · Cols '}
        {props.nbrOfColumns.toLocaleString()}
        {' · BL '}
        {props.burstLength}
        {' · Dev '}
        {props.nbrOfDevices}
      </div>
    </div>
  );
}
