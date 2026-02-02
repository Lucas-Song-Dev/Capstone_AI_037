'use client';

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ServerRackVisualizationProps {
  numServers: number;
  powerPerServer: number;
  selectedConfig: {
    dimmsPerServer: number;
    totalCapacity: number;
    dataRate: number;
    preset: { name: string };
  } | null;
}

// Constants for visualization
const SERVERS_PER_RACK = 42; // Standard rack units
const RACK_WIDTH = 2;
const RACK_DEPTH = 1;
const RACK_HEIGHT = 2;
const SERVER_HEIGHT = 0.04; // Height of each server unit
const SPACING = 0.1;

function ServerCube({ 
  position, 
  power, 
  index,
  totalServers 
}: { 
  position: [number, number, number]; 
  power: number;
  index: number;
  totalServers: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const targetY = useRef(position[1]);
  const currentY = useRef(position[1]);
  const hasAnimated = useRef(false);
  
  // Calculate color based on power (normalize to 0-1 range, assuming max 500W per server)
  const powerNormalized = Math.min(power / 500, 1);
  const color = useMemo(() => {
    const c = new THREE.Color();
    return c.lerpColors(
      new THREE.Color(0x00ff00), // Green for low power
      new THREE.Color(0xff0000), // Red for high power
      powerNormalized
    );
  }, [powerNormalized]);
  
  // Animate cube popping up
  useFrame((state) => {
    if (meshRef.current) {
      // Staggered animation - each cube pops up slightly after the previous
      const delay = Math.min(index * 0.01, 5); // Cap delay at 5 seconds
      const time = state.clock.elapsedTime;
      
      if (time > delay && !hasAnimated.current) {
        targetY.current = position[1];
        currentY.current += (targetY.current - currentY.current) * 0.1;
        meshRef.current.position.y = currentY.current;
        
        if (Math.abs(currentY.current - targetY.current) < 0.01) {
          hasAnimated.current = true;
        }
        
        // Add a subtle pulse based on power
        const pulse = Math.sin(time * 2 + index) * 0.02 * powerNormalized;
        meshRef.current.scale.y = 1 + pulse;
      } else if (!hasAnimated.current) {
        // Start from below
        meshRef.current.position.y = position[1] - 0.5;
        currentY.current = position[1] - 0.5;
      } else {
        // Subtle animation after pop-up
        const pulse = Math.sin(time * 2 + index) * 0.01 * powerNormalized;
        meshRef.current.scale.y = 1 + pulse;
      }
      
      // Rotate slightly for visual interest
      meshRef.current.rotation.y = Math.sin(time * 0.5 + index) * 0.05;
    }
  });

  return (
    <mesh ref={meshRef} position={position}>
      <boxGeometry args={[RACK_WIDTH - SPACING, SERVER_HEIGHT, RACK_DEPTH - SPACING]} />
      <meshStandardMaterial 
        color={color}
        emissive={color}
        emissiveIntensity={powerNormalized * 0.3}
        metalness={0.3}
        roughness={0.7}
      />
    </mesh>
  );
}

function Rack({ 
  position, 
  serversInRack, 
  powerPerServer,
  rackIndex,
  startServerIndex 
}: { 
  position: [number, number, number]; 
  serversInRack: number;
  powerPerServer: number;
  rackIndex: number;
  startServerIndex: number;
}) {
  const rackRef = useRef<THREE.Group>(null);
  
  // Create server cubes
  const serverPositions = useMemo(() => {
    const positions: [number, number, number][] = [];
    for (let i = 0; i < serversInRack; i++) {
      const row = Math.floor(i / 2); // 2 servers per row
      const col = i % 2;
      const y = (row * SERVER_HEIGHT * 2) + SERVER_HEIGHT / 2;
      const x = (col - 0.5) * (RACK_WIDTH - SPACING) * 0.5;
      positions.push([x, y, 0]);
    }
    return positions;
  }, [serversInRack]);

  return (
    <group ref={rackRef} position={position}>
      {/* Rack frame */}
      <mesh position={[0, RACK_HEIGHT / 2, 0]}>
        <boxGeometry args={[RACK_WIDTH, RACK_HEIGHT, RACK_DEPTH]} />
        <meshStandardMaterial 
          color="#2a2a2a" 
          metalness={0.8}
          roughness={0.2}
          transparent
          opacity={0.3}
        />
      </mesh>
      
      {/* Server cubes */}
      {serverPositions.map((pos, idx) => (
        <ServerCube
          key={idx}
          position={[pos[0], pos[1], pos[2]]}
          power={powerPerServer}
          index={startServerIndex + idx}
          totalServers={serversInRack}
        />
      ))}
      
      {/* Rack label - only show for first few racks to avoid clutter */}
      {rackIndex < 10 && (
        <Text
          position={[0, RACK_HEIGHT + 0.2, 0]}
          fontSize={0.15}
          color="white"
          anchorX="center"
          anchorY="middle"
        >
          Rack {rackIndex + 1}
        </Text>
      )}
    </group>
  );
}

function ServerFarm({ 
  numServers, 
  powerPerServer 
}: { 
  numServers: number; 
  powerPerServer: number;
}) {
  const numRacks = Math.ceil(numServers / SERVERS_PER_RACK);
  // Limit visualization to reasonable number for performance
  const maxRacksToRender = 100;
  const racksToRender = Math.min(numRacks, maxRacksToRender);
  const racksPerRow = Math.ceil(Math.sqrt(racksToRender));
  
  const rackPositions = useMemo(() => {
    const positions: [number, number, number][] = [];
    for (let i = 0; i < racksToRender; i++) {
      const row = Math.floor(i / racksPerRow);
      const col = i % racksPerRow;
      const x = (col - (racksPerRow - 1) / 2) * (RACK_WIDTH + 1);
      const z = (row - (Math.ceil(racksToRender / racksPerRow) - 1) / 2) * (RACK_DEPTH + 1);
      positions.push([x, 0, z]);
    }
    return positions;
  }, [racksToRender, racksPerRow]);
  
  return (
    <>
      {rackPositions.map((pos, idx) => {
        const startServerIndex = idx * SERVERS_PER_RACK;
        const serversInRack = Math.min(SERVERS_PER_RACK, numServers - startServerIndex);
        return (
          <Rack
            key={idx}
            position={pos}
            serversInRack={serversInRack}
            powerPerServer={powerPerServer}
            rackIndex={idx}
            startServerIndex={startServerIndex}
          />
        );
      })}
      
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
        <planeGeometry args={[racksPerRow * (RACK_WIDTH + 1) * 2, Math.ceil(racksToRender / racksPerRow) * (RACK_DEPTH + 1) * 2]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      
      {/* Info text if rendering is limited */}
      {numRacks > maxRacksToRender && (
        <Text
          position={[0, 5, 0]}
          fontSize={0.3}
          color="yellow"
          anchorX="center"
          anchorY="middle"
        >
          Showing {maxRacksToRender} of {numRacks} racks
        </Text>
      )}
      
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 5]} intensity={0.8} />
      <pointLight position={[-10, 10, -10]} intensity={0.5} />
    </>
  );
}

export function ServerRackVisualization({ 
  numServers, 
  powerPerServer,
  selectedConfig 
}: ServerRackVisualizationProps) {
  const totalPower = numServers * powerPerServer;
  const numRacks = Math.ceil(numServers / SERVERS_PER_RACK);
  
  return (
    <Card className="power-card">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Server Farm Visualization</span>
          <div className="text-sm font-normal text-muted-foreground">
            {numServers.toLocaleString()} servers • {numRacks} rack{numRacks !== 1 ? 's' : ''}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Total Servers</p>
              <p className="text-2xl font-bold">{numServers.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Total Power</p>
              <p className="text-2xl font-bold">{(totalPower / 1000).toFixed(1)} kW</p>
            </div>
            <div>
              <p className="text-muted-foreground">Power/Server</p>
              <p className="text-2xl font-bold">{powerPerServer.toFixed(1)} W</p>
            </div>
          </div>
          
          {/* 3D Visualization */}
          <div className="h-[500px] w-full rounded-lg overflow-hidden bg-black">
            <Canvas camera={{ position: [0, 5, 10], fov: 50 }}>
              <ServerFarm numServers={numServers} powerPerServer={powerPerServer} />
              <OrbitControls 
                enablePan={true}
                enableZoom={true}
                enableRotate={true}
                minDistance={5}
                maxDistance={50}
              />
            </Canvas>
          </div>
          
          {/* Legend */}
          {selectedConfig && (
            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>Configuration:</strong> {selectedConfig.preset.name}</p>
              <p><strong>DIMMs per Server:</strong> {selectedConfig.dimmsPerServer}</p>
              <p><strong>Capacity per Server:</strong> {selectedConfig.totalCapacity} GB</p>
              <p><strong>Data Rate:</strong> {selectedConfig.dataRate} MT/s</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

