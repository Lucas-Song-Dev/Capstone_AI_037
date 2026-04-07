'use client';

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { useTheme } from 'next-themes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Box } from 'lucide-react';
import type { PowerResult, MemSpec } from '@/lib/types';

interface DDR5Chip3DProps {
  powerResult: PowerResult | null;
  memspec: MemSpec | null;
}

function PowerIndicator({ 
  position, 
  intensity, 
  color 
}: { 
  position: [number, number, number]; 
  intensity: number; 
  color: string;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const baseScale = 0.15;
  const scaleFactor = baseScale + intensity * 0.2;
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.scale.setScalar(scaleFactor + Math.sin(state.clock.elapsedTime * 2) * 0.02 * intensity);
    }
  });

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[1, 16, 16]} />
      <meshStandardMaterial 
        color={color} 
        emissive={color} 
        emissiveIntensity={0.5 + intensity * 0.5}
        transparent
        opacity={0.8}
      />
    </mesh>
  );
}

export function MemoryDie({ 
  position,
  bankGroups = 8,
  banks = 16,
  /** When set (e.g. visual builder), each slot shows that bank group’s real count instead of spreading `banks` evenly (which wrongly put the 5th bank on “rank 2” when 8 groups exist). */
  banksPerGroupExact,
  color = '#3b82f6',
  showIoPads = true
}: { 
  position: [number, number, number];
  bankGroups?: number;
  banks?: number;
  banksPerGroupExact?: number[];
  color?: string;
  /** When false, I/O pads are hidden (e.g. in builder to avoid confusion with rank count). */
  showIoPads?: boolean;
}) {
  const meshRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.02;
    }
  });

  /** Preset DIMM: distribute total banks evenly. Builder: use banksPerGroupExact per slot. */
  const banksPerGroupBase = bankGroups > 0 ? Math.floor(banks / bankGroups) : 0;
  const remainder = bankGroups > 0 ? banks - bankGroups * banksPerGroupBase : 0;
  const useExact = Array.isArray(banksPerGroupExact) && banksPerGroupExact.length > 0;
  /** Max 4 bank groups per row → 2 rows when 8 BGs (2 ranks × 4). */
  const bankRows = Math.ceil(bankGroups / 4);
  const bankCols = Math.min(bankGroups, 4);
  /** Bank tiles: 2 rows, max 4 per row (user-requested layout). */
  const BANK_TILE_ROWS = 2;
  const BANK_TILE_COLS_MAX = 4;

  return (
    <group ref={meshRef} position={position}>
      {/* Main die substrate */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[2.5, 0.15, 1.8]} />
        <meshStandardMaterial color="#1a1a2e" metalness={0.7} roughness={0.3} />
      </mesh>
      
      {/* Bank groups with individual banks */}
      {Array.from({ length: bankGroups }).map((_, groupIdx) => {
        const row = Math.floor(groupIdx / bankCols);
        const col = groupIdx % bankCols;
        const groupX = (col - (bankCols - 1) / 2) * 0.55;
        const groupZ = (row - (bankRows - 1) / 2) * 0.7;
        const banksInThisGroup = useExact
          ? (banksPerGroupExact![groupIdx] ?? 0)
          : groupIdx < remainder
            ? banksPerGroupBase + 1
            : banksPerGroupBase;
        
        // Layout banks in 2 rows, max 4 per row
        const bankSubRows = BANK_TILE_ROWS;
        const bankSubCols = Math.min(BANK_TILE_COLS_MAX, Math.max(1, Math.ceil(banksInThisGroup / bankSubRows)));
        const visibleBanks = Math.min(banksInThisGroup, bankSubRows * bankSubCols);
        
        return (
          <group key={`group-${groupIdx}`} position={[groupX, 0.1, groupZ]}>
            {/* Bank group container (slightly larger, semi-transparent) */}
            <mesh position={[0, -0.02, 0]}>
              <boxGeometry args={[0.45, 0.06, 0.55]} />
              <meshStandardMaterial 
                color={color} 
                emissive={color}
                emissiveIntensity={0.1}
                metalness={0.3}
                roughness={0.5}
                transparent
                opacity={0.3}
              />
            </mesh>
            
            {/* Individual banks: 2 rows × up to 4 cols */}
            {Array.from({ length: visibleBanks }).map((_, bankIdx) => {
              const bankRow = Math.floor(bankIdx / bankSubCols);
              const bankCol = bankIdx % bankSubCols;
              const bankX = (bankCol - (bankSubCols - 1) / 2) * 0.12;
              const bankZ = (bankRow - (bankSubRows - 1) / 2) * 0.12;
              
              return (
                <mesh 
                  key={`bank-${bankIdx}`} 
                  position={[bankX, 0.04, bankZ]}
                >
                  <boxGeometry args={[0.1, 0.06, 0.1]} />
                  <meshStandardMaterial 
                    color={color} 
                    emissive={color}
                    emissiveIntensity={0.3}
                    metalness={0.6}
                    roughness={0.3}
                  />
                </mesh>
              );
            })}
          </group>
        );
      })}
      
      {/* I/O pads (optional; hidden in builder so they are not mistaken for ranks) */}
      {showIoPads && [-1.1, 1.1].map((x, i) => (
        <mesh key={`io-${i}`} position={[x, 0.08, 0]}>
          <boxGeometry args={[0.2, 0.04, 1.5]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.2} />
        </mesh>
      ))}
    </group>
  );
}

function DDR5Module({
  powerResult,
  memspec,
  titleColor,
}: {
  powerResult: PowerResult | null;
  memspec: MemSpec | null;
  titleColor: string;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.1;
    }
  });

  const normalizedPower = useMemo(() => {
    if (!powerResult) return { vdd: 0, vpp: 0, read: 0, write: 0 };
    const total = powerResult.P_total_core || 1;
    return {
      vdd: Math.min(powerResult.P_VDD_core / total, 1),
      vpp: Math.min(powerResult.P_VPP_core / total, 1),
      read: Math.min(powerResult.P_RD_core / (total * 0.3), 1),
      write: Math.min(powerResult.P_WR_core / (total * 0.3), 1),
    };
  }, [powerResult]);

  const bankGroups = memspec?.memarchitecturespec.nbrOfBankGroups || 8;
  const banks = memspec?.memarchitecturespec.nbrOfBanks || 16;

  return (
    <group ref={groupRef}>
      {/* PCB Board */}
      <mesh position={[0, -0.5, 0]}>
        <boxGeometry args={[6, 0.12, 2.5]} />
        <meshStandardMaterial color="#0d5c2e" metalness={0.3} roughness={0.7} />
      </mesh>

      {/* Gold fingers/contacts */}
      <mesh position={[0, -0.6, 0]}>
        <boxGeometry args={[5, 0.06, 0.4]} />
        <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Memory chips (2 per side) */}
      <MemoryDie position={[-1.4, 0, 0]} bankGroups={bankGroups} banks={banks} color="#3b82f6" />
      <MemoryDie position={[1.4, 0, 0]} bankGroups={bankGroups} banks={banks} color="#3b82f6" />

      {/* Power Management IC */}
      <mesh position={[0, 0, 0.8]}>
        <boxGeometry args={[0.6, 0.2, 0.4]} />
        <meshStandardMaterial color="#1f2937" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* Power indicators */}
      <PowerIndicator position={[-1.4, 0.6, 0]} intensity={normalizedPower.vdd} color="#3b82f6" />
      <PowerIndicator position={[1.4, 0.6, 0]} intensity={normalizedPower.vpp} color="#f97316" />
      
      {/* Activity indicators */}
      {powerResult && (
        <>
          <PowerIndicator position={[-0.7, 0.5, 0]} intensity={normalizedPower.read} color="#22c55e" />
          <PowerIndicator position={[0.7, 0.5, 0]} intensity={normalizedPower.write} color="#a855f7" />
        </>
      )}

      {/* Labels */}
      <Text
        position={[0, 1.2, 0]}
        fontSize={0.2}
        color={titleColor}
        anchorX="center"
        anchorY="middle"
      >
        {memspec?.memoryId || 'DDR5 Module'}
      </Text>
    </group>
  );
}

export function DDR5Chip3D({ powerResult, memspec }: DDR5Chip3DProps) {
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === 'light';
  const canvasBg = isLight ? '#ffffff' : '#111827';
  const gridPrimary = isLight ? '#94a3b8' : '#1e3a5f';
  const gridSecondary = isLight ? '#e2e8f0' : '#0f172a';
  const titleColor = isLight ? '#64748b' : '#94a3b8';

  return (
    <Card className="power-card">
      <CardHeader className="!p-4 !pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Box className="w-4 h-4 text-primary" />
          3D Visualization
        </CardTitle>
      </CardHeader>
      <CardContent className="!p-0">
        <div className="h-[300px] w-full bg-white dark:bg-transparent">
          <Canvas
            camera={{ position: [4, 3, 4], fov: 45 }}
            gl={{ antialias: true }}
          >
            <color attach="background" args={[canvasBg]} />
            <ambientLight intensity={isLight ? 0.55 : 0.4} />
            <directionalLight position={[5, 5, 5]} intensity={isLight ? 1.0 : 0.8} />
            <directionalLight position={[-5, 3, -5]} intensity={isLight ? 0.35 : 0.4} color="#3b82f6" />
            <pointLight position={[0, 3, 0]} intensity={isLight ? 0.45 : 0.5} color="#10b981" />

            <DDR5Module
              powerResult={powerResult}
              memspec={memspec}
              titleColor={titleColor}
            />

            <OrbitControls
              enablePan={false}
              enableZoom={true}
              minDistance={4}
              maxDistance={12}
              minPolarAngle={Math.PI / 6}
              maxPolarAngle={Math.PI / 2.2}
            />

            <gridHelper args={[10, 20, gridPrimary, gridSecondary]} position={[0, -1, 0]} />
          </Canvas>
        </div>
        
        {/* Legend */}
        <div className="px-4 py-2 border-t border-border flex flex-wrap gap-3 justify-center text-xs">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-power-vdd" />
            VDD
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-power-vpp" />
            VPP
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-power-read" />
            Read
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-power-write" />
            Write
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
