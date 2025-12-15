import React, { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere, MeshDistortMaterial, Stars, Plane, Text, Float } from '@react-three/drei';
import * as THREE from 'three';
import { AudioVisualizerData, VisualizerMode } from '../types';

interface Visualizer3DProps {
  audioData: AudioVisualizerData;
  primaryColor: string;
  mode: VisualizerMode;
  intensity: number;
  speed: number;
  isSimulated?: boolean; // New prop for YouTube simulation
  onSwitchMode: () => void;
  onChangeColor: (color: string) => void;
  onChangeIntensity: (val: number) => void;
  onChangeSpeed: (val: number) => void;
}

interface VisualizerModeProps {
  audioData: AudioVisualizerData;
  color: string;
  intensity: number;
  speed: number;
  isSimulated?: boolean;
  onChangeIntensity: (val: number) => void;
  onChangeSpeed: (val: number) => void;
}

// Custom hook for drag logic to be reused by visualizers
const useVisualizerDrag = (
  intensity: number, 
  speed: number, 
  onChangeIntensity: (v: number) => void, 
  onChangeSpeed: (v: number) => void
) => {
  const dragState = useRef({
    isDragging: false,
    startPos: { x: 0, y: 0 },
    startIntensity: 0,
    startSpeed: 0,
  });

  const onPointerDown = (e: any) => {
    e.stopPropagation();
    dragState.current = {
      isDragging: true,
      startPos: { x: e.clientX, y: e.clientY },
      startIntensity: intensity,
      startSpeed: speed,
    };
    e.target.setPointerCapture(e.pointerId);
    document.body.style.cursor = 'grabbing';
  };

  const onPointerMove = (e: any) => {
    if (!dragState.current.isDragging) return;
    e.stopPropagation();
    
    const deltaX = e.clientX - dragState.current.startPos.x;
    const deltaY = e.clientY - dragState.current.startPos.y;

    // Sensitivity factor: 150px drag = 1.0 change in value
    const speedChange = deltaX / 150;
    const intensityChange = -deltaY / 150; // Invert Y-axis

    const newSpeed = Math.max(0, Math.min(4.0, dragState.current.startSpeed + speedChange));
    const newIntensity = Math.max(0.1, Math.min(3.0, dragState.current.startIntensity + intensityChange));

    onChangeSpeed(newSpeed);
    onChangeIntensity(newIntensity);
  };

  const onPointerUp = (e: any) => {
    if (!dragState.current.isDragging) return;
    e.stopPropagation();
    dragState.current.isDragging = false;
    e.target.releasePointerCapture(e.pointerId);
    document.body.style.cursor = 'grab';
  };

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerOut: onPointerUp, // End drag if pointer leaves
    onPointerOver: () => { document.body.style.cursor = 'grab'; },
    onPointerLeave: () => { document.body.style.cursor = 'auto'; }
  };
};

// --- SIMULATION HELPER ---
// Generates fake frequency data based on time if simulation is active
const getFrequencyData = (audioData: AudioVisualizerData, isSimulated: boolean, time: number) => {
  const { analyser, dataArray } = audioData;
  
  if (!isSimulated && analyser && dataArray) {
    analyser.getByteFrequencyData(dataArray);
    // Return average freq
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
    return { dataArray, average: sum / dataArray.length };
  }
  
  // Simulation Mode
  if (isSimulated) {
     const simulatedAvg = (Math.sin(time * 4) * 0.5 + 0.5) * 128 + 64; // Beat pulse
     return { dataArray: null, average: simulatedAvg };
  }

  return { dataArray: null, average: 0 };
};


// 1. ORB VISUALIZER
const OrbVisualizer = ({ audioData, color, intensity, speed, isSimulated, onChangeIntensity, onChangeSpeed }: VisualizerModeProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<any>(null);
  const dragHandlers = useVisualizerDrag(intensity, speed, onChangeIntensity, onChangeSpeed);

  useFrame((state) => {
    const { average } = getFrequencyData(audioData, !!isSimulated, state.clock.elapsedTime);

    if (meshRef.current && materialRef.current) {
      // Intensity affects scale amplitude
      const scale = 1 + (average / 255) * (1.5 * intensity);
      meshRef.current.scale.lerp(new THREE.Vector3(scale, scale, scale), 0.1);
      
      // Speed affects rotation
      meshRef.current.rotation.x += 0.001 * speed;
      meshRef.current.rotation.y += 0.002 * speed;
      
      // Intensity affects distortion amount
      materialRef.current.distort = (0.3 * intensity) + (average / 255) * (0.6 * intensity);
      
      // Speed affects texture movement speed
      materialRef.current.speed = (1 * speed) + (average / 255) * 4;
      
      materialRef.current.color.lerp(new THREE.Color(color), 0.05);
    }
  });

  return (
    <Sphere args={[1, 64, 64]} ref={meshRef} {...dragHandlers}>
      <MeshDistortMaterial ref={materialRef} color={color} envMapIntensity={0.4} clearcoat={1} clearcoatRoughness={0.1} metalness={0.5} />
    </Sphere>
  );
};

// 2. BARS VISUALIZER (Circular Spectrum)
const BarsVisualizer = ({ audioData, color, intensity, speed, isSimulated, onChangeIntensity, onChangeSpeed }: VisualizerModeProps) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = 64; // Number of bars
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const radius = 2.5;
  const dragHandlers = useVisualizerDrag(intensity, speed, onChangeIntensity, onChangeSpeed);

  useFrame((state) => {
    const { dataArray, average } = getFrequencyData(audioData, !!isSimulated, state.clock.elapsedTime);

    if (meshRef.current) {
      
      for (let i = 0; i < count; i++) {
        let value = 0;
        
        if (dataArray) {
             const freqIndex = Math.floor((i / count) * (dataArray.length / 2)); 
             value = dataArray[freqIndex] / 255;
        } else if (isSimulated) {
             // Fake frequency spread based on index and time
             value = (Math.sin(state.clock.elapsedTime * 10 + i * 0.5) * 0.5 + 0.5) * (average / 255);
        }

        const angle = (i / count) * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        
        dummy.position.set(x, 0, z);
        dummy.rotation.y = -angle;
        
        // Intensity affects bar height
        const heightMultiplier = 8 * intensity;
        // Ensure minimum scale of 0.1 to avoid invisible bars
        const scaleY = 0.1 + (value * heightMultiplier);
        
        dummy.scale.set(1, scaleY, 1); 
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
      }
      meshRef.current.instanceMatrix.needsUpdate = true;
      // Rotate entire ring based on speed
      meshRef.current.rotation.y += 0.002 * speed;
    }
  });

  return (
    <group>
      {/* Invisible sphere to act as a unified drag target for all bars */}
      <Sphere args={[radius + 0.5, 32, 32]} visible={false} {...dragHandlers} />
      <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
        <boxGeometry args={[0.1, 1, 0.1]} />
        <meshStandardMaterial color={color} toneMapped={false} emissive={color} emissiveIntensity={2} />
      </instancedMesh>
    </group>
  );
};

// 3. WAVE VISUALIZER (Wireframe Terrain)
const WaveVisualizer = ({ audioData, color, intensity, speed, isSimulated, onChangeIntensity, onChangeSpeed }: VisualizerModeProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);
  const dragHandlers = useVisualizerDrag(intensity, speed, onChangeIntensity, onChangeSpeed);
  
  useFrame((state, delta) => {
    const { dataArray } = getFrequencyData(audioData, !!isSimulated, state.clock.elapsedTime);
    
    // Accumulate time based on speed to prevent jumps when changing speed
    timeRef.current += delta * speed;
    const time = timeRef.current;

    if (meshRef.current) {
      
      const geometry = meshRef.current.geometry;
      const positionAttribute = geometry.attributes.position;
      
      for (let i = 0; i < positionAttribute.count; i++) {
         const x = positionAttribute.getX(i);
         const y = positionAttribute.getY(i);
         
         let freqVal = 0;
         if (dataArray) {
             const freqIdx = Math.abs(Math.floor(x * 5) % dataArray.length);
             freqVal = dataArray[freqIdx] / 255;
         } else if (isSimulated) {
             // Fake frequency val
             freqVal = (Math.sin(x * 5 + time) * Math.cos(y * 5 + time) * 0.5 + 0.5) * 0.5;
         }
         
         // Intensity scales the Z height
         // Use a mix of time and frequency data
         const waveHeight = (Math.sin(x * 2 + time) * Math.cos(y * 2 + time) * 0.5) + (freqVal * 2);
         const z = waveHeight * intensity;
         
         positionAttribute.setZ(i, z);
      }
      positionAttribute.needsUpdate = true;
      (meshRef.current.material as THREE.MeshBasicMaterial).color.lerp(new THREE.Color(color), 0.1);
    }
  });

  return (
    <Plane args={[10, 10, 32, 32]} rotation={[-Math.PI / 2.5, 0, 0]} ref={meshRef} {...dragHandlers}>
      <meshBasicMaterial color={color} wireframe transparent opacity={0.5} />
    </Plane>
  );
};

// --- Helper Components ---

interface ColorOrbProps {
  color: string;
  position: [number, number, number];
  onClick: () => void;
  isActive: boolean;
}

const ColorOrb: React.FC<ColorOrbProps> = ({ color, position, onClick, isActive }) => {
  const [hovered, setHovered] = useState(false);
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      // Rotate slightly
      meshRef.current.rotation.y += 0.01;
      // Pulse scale if active or hovered
      const scale = isActive ? 1.3 : hovered ? 1.2 : 1;
      meshRef.current.scale.lerp(new THREE.Vector3(scale, scale, scale), 0.1);
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={position}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onPointerOver={() => { document.body.style.cursor = 'pointer'; setHovered(true); }}
      onPointerOut={() => { document.body.style.cursor = 'auto'; setHovered(false); }}
    >
      <sphereGeometry args={[0.25, 32, 32]} />
      <meshStandardMaterial 
        color={color} 
        emissive={color} 
        emissiveIntensity={isActive ? 2 : 0.5} 
        roughness={0.2} 
        metalness={0.8} 
      />
    </mesh>
  );
};

// --- Slider 3D Component ---
interface Slider3DProps {
  value: number;
  min: number;
  max: number;
  onChange: (val: number) => void;
  position: [number, number, number];
  height?: number;
  color: string;
  label: string;
}

const Slider3D: React.FC<Slider3DProps> = ({ value, min, max, onChange, position, height = 3, color, label }) => {
  const [active, setActive] = useState(false);
  const [hovered, setHovered] = useState(false);

  const updateValue = (pointY: number) => {
    // Determine local Y position relative to the slider's center
    // We assume the slider is vertical. 
    // The touch point Y needs to be offset by the group position Y.
    const localY = Math.max(-height / 2, Math.min(height / 2, pointY - position[1]));
    const pct = (localY + height / 2) / height;
    const newValue = min + pct * (max - min);
    onChange(newValue);
  };

  const bind = {
    onPointerDown: (e: any) => {
      e.stopPropagation();
      e.target.setPointerCapture(e.pointerId);
      setActive(true);
      updateValue(e.point.y);
    },
    onPointerMove: (e: any) => {
      if (active) {
        e.stopPropagation();
        updateValue(e.point.y);
      }
    },
    onPointerUp: (e: any) => {
      e.stopPropagation();
      e.target.releasePointerCapture(e.pointerId);
      setActive(false);
    },
    onPointerOver: () => {
      document.body.style.cursor = 'grab';
      setHovered(true);
    },
    onPointerOut: () => {
      document.body.style.cursor = 'auto';
      setHovered(false);
    }
  };

  // Calculate knob position based on value
  const knobY = ((value - min) / (max - min)) * height - height / 2;

  return (
    <group position={position}>
      {/* Label */}
      <Text position={[0, height/2 + 0.4, 0]} fontSize={0.25} color="white" anchorX="center" anchorY="bottom" outlineColor="black" outlineWidth={0.02}>
        {label}
      </Text>
      {/* Value Readout */}
      <Text position={[0, -height/2 - 0.4, 0]} fontSize={0.2} color="gray" anchorX="center" anchorY="top">
        {value.toFixed(1)}
      </Text>

      {/* Invisible Hit Area for easier interaction */}
      <mesh visible={false} {...bind}>
         <planeGeometry args={[1, height + 0.5]} />
      </mesh>

      {/* Track Background */}
      <mesh position={[0, 0, -0.01]}>
        <boxGeometry args={[0.08, height, 0.02]} />
        <meshStandardMaterial color="#333" />
      </mesh>

      {/* Active Track Bar */}
       <mesh position={[0, -height/2 + (knobY + height/2)/2, 0]}>
        <boxGeometry args={[0.08, knobY + height/2, 0.03]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1} />
      </mesh>

      {/* Knob */}
      <mesh position={[0, knobY, 0.05]} scale={active || hovered ? 1.2 : 1}>
        <capsuleGeometry args={[0.15, 0.1, 4, 8]} />
        <meshStandardMaterial color="white" roughness={0.1} metalness={0.9} />
      </mesh>
    </group>
  );
};

// --- Interactive Controls Component ---

interface InteractiveControlsProps {
  onSwitchMode: () => void;
  onChangeColor: (c: string) => void;
  currentColor: string;
  intensity: number;
  speed: number;
  onChangeIntensity: (val: number) => void;
  onChangeSpeed: (val: number) => void;
}

const InteractiveControls: React.FC<InteractiveControlsProps> = ({ 
  onSwitchMode, 
  onChangeColor, 
  currentColor,
  intensity,
  speed,
  onChangeIntensity,
  onChangeSpeed
}) => {
  const [hoveredMode, setHoveredMode] = useState(false);
  
  // Palette colors
  const colors = ['#22d3ee', '#a855f7', '#ec4899', '#10b981', '#f97316'];

  return (
    <group>
      {/* 1. Mode Switcher (Top Center) */}
      <Float speed={2} rotationIntensity={1} floatIntensity={1}>
        <group position={[0, 2.8, 0]}>
          <mesh 
            onClick={(e) => { e.stopPropagation(); onSwitchMode(); }}
            onPointerOver={() => { document.body.style.cursor = 'pointer'; setHoveredMode(true); }}
            onPointerOut={() => { document.body.style.cursor = 'auto'; setHoveredMode(false); }}
            scale={hoveredMode ? 1.2 : 1}
          >
            <icosahedronGeometry args={[0.4, 0]} />
            <meshStandardMaterial 
              color="white" 
              wireframe 
              emissive={currentColor} 
              emissiveIntensity={hoveredMode ? 2 : 0.5}
            />
          </mesh>
          <Text 
            position={[0, -0.6, 0]} 
            fontSize={0.2} 
            color="white" 
            anchorX="center" 
            anchorY="middle"
            fillOpacity={0.7}
            outlineColor="black"
            outlineWidth={0.02}
          >
            SWITCH MODE
          </Text>
        </group>
      </Float>

      {/* 2. Intensity Slider (Left) */}
      <Slider3D 
        value={intensity} 
        min={0.1} 
        max={3.0} 
        onChange={onChangeIntensity} 
        position={[-4.5, 0, 0]}
        height={3}
        color={currentColor}
        label="INTENSITY"
      />

      {/* 3. Speed Slider (Right) */}
      <Slider3D 
        value={speed} 
        min={0} 
        max={4.0} 
        onChange={onChangeSpeed} 
        position={[4.5, 0, 0]}
        height={3}
        color={currentColor}
        label="SPEED"
      />

      {/* 4. Color Palette (Bottom Arc) */}
      <group position={[0, -3, 0]}>
        {colors.map((c, i) => {
          // Arrange in a slight arc
          const angle = (i - 2) * 0.3; // Center around index 2
          const x = Math.sin(angle) * 2;
          const y = Math.cos(angle) * 0.5; // Slight curve
          return (
            <ColorOrb 
              key={c} 
              color={c} 
              position={[x, y, 0]} 
              onClick={() => onChangeColor(c)} 
              isActive={c === currentColor}
            />
          );
        })}
        <Text 
            position={[0, -0.8, 0]} 
            fontSize={0.2} 
            color="white" 
            anchorX="center" 
            anchorY="middle"
            fillOpacity={0.7}
          >
            COLOR VIBE
          </Text>
      </group>
    </group>
  );
};

const Visualizer3D: React.FC<Visualizer3DProps> = ({ 
  audioData, 
  primaryColor, 
  mode, 
  intensity, 
  speed, 
  isSimulated,
  onSwitchMode, 
  onChangeColor,
  onChangeIntensity,
  onChangeSpeed
}) => {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <pointLight position={[-10, -10, -5]} color={primaryColor} intensity={2} />

      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

      {/* Main Visualizer */}
      {mode === 'orb' && <OrbVisualizer audioData={audioData} color={primaryColor} intensity={intensity} speed={speed} isSimulated={isSimulated} onChangeIntensity={onChangeIntensity} onChangeSpeed={onChangeSpeed} />}
      {mode === 'bars' && <BarsVisualizer audioData={audioData} color={primaryColor} intensity={intensity} speed={speed} isSimulated={isSimulated} onChangeIntensity={onChangeIntensity} onChangeSpeed={onChangeSpeed} />}
      {mode === 'wave' && <WaveVisualizer audioData={audioData} color={primaryColor} intensity={intensity} speed={speed} isSimulated={isSimulated} onChangeIntensity={onChangeIntensity} onChangeSpeed={onChangeSpeed} />}
      
      {/* Interactive 3D Controls */}
      <InteractiveControls 
        onSwitchMode={onSwitchMode} 
        onChangeColor={onChangeColor} 
        currentColor={primaryColor}
        intensity={intensity}
        speed={speed}
        onChangeIntensity={onChangeIntensity}
        onChangeSpeed={onChangeSpeed}
      />

      {/* Background glow effect */}
      <mesh scale={[10, 10, 10]} position={[0, 0, -5]}>
         <planeGeometry />
         <meshBasicMaterial color={primaryColor} transparent opacity={0.05} />
      </mesh>
    </>
  );
};

export default Visualizer3D;