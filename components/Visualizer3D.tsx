import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere, MeshDistortMaterial, Stars, Text } from '@react-three/drei';
import * as THREE from 'three';
import { AudioVisualizerData } from '../types';

interface Visualizer3DProps {
  audioData: AudioVisualizerData;
  primaryColor: string;
}

const Visualizer3D: React.FC<Visualizer3DProps> = ({ audioData, primaryColor }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<any>(null);

  // Frequency data buffer
  const freqData = useMemo(() => new Uint8Array(128), []);

  useFrame((state) => {
    const { analyser, dataArray } = audioData;
    let averageFreq = 0;

    if (analyser && dataArray) {
      analyser.getByteFrequencyData(dataArray);
      
      // Calculate average frequency for scaling
      let sum = 0;
      const length = dataArray.length;
      for (let i = 0; i < length; i++) {
        sum += dataArray[i];
      }
      averageFreq = sum / length;
    }

    // Animate mesh
    if (meshRef.current && materialRef.current) {
      // Scale based on bass/volume
      const scale = 1 + (averageFreq / 255) * 1.5;
      meshRef.current.scale.lerp(new THREE.Vector3(scale, scale, scale), 0.1);
      
      // Rotate slowly
      meshRef.current.rotation.x += 0.001;
      meshRef.current.rotation.y += 0.002;

      // Distort more with higher intensity
      materialRef.current.distort = 0.3 + (averageFreq / 255) * 0.6;
      materialRef.current.speed = 1 + (averageFreq / 255) * 4;
      
      // Update color smoothly
      materialRef.current.color.lerp(new THREE.Color(primaryColor), 0.05);
    }
  });

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <pointLight position={[-10, -10, -5]} color={primaryColor} intensity={2} />

      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

      <Sphere args={[1, 64, 64]} ref={meshRef}>
        <MeshDistortMaterial
          ref={materialRef}
          color={primaryColor}
          envMapIntensity={0.4}
          clearcoat={1}
          clearcoatRoughness={0.1}
          metalness={0.5}
        />
      </Sphere>
      
      {/* Background glow effect */}
      <mesh scale={[10, 10, 10]} position={[0, 0, -5]}>
         <planeGeometry />
         <meshBasicMaterial color={primaryColor} transparent opacity={0.05} />
      </mesh>
    </>
  );
};

export default Visualizer3D;
