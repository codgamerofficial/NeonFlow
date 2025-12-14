import React, { useState, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Disc3, Music, ListMusic, Plus, Upload } from 'lucide-react';
import Visualizer3D from './components/Visualizer3D';
import PlayerControls from './components/PlayerControls';
import AIChat from './components/AIChat';
import { Track, ChatMessage, AudioVisualizerData } from './types';
import { DEMO_TRACKS, INITIAL_DJ_MESSAGE } from './constants';
import { generateDJResponse, analyzeTrackVibe } from './services/gemini';

const App: React.FC = () => {
  // Audio State
  const [tracks, setTracks] = useState<Track[]>(DEMO_TRACKS);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // AI & Visual State
  const [visualColor, setVisualColor] = useState<string>('#4f46e5');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: '1', sender: 'ai', text: INITIAL_DJ_MESSAGE, timestamp: new Date() }
  ]);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(false);

  // Refs
  const audioRef = useRef<HTMLAudioElement>(new Audio());
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  const currentTrack = tracks[currentTrackIndex];

  // Initialize Audio Context (Standard HTML5 Audio + Web Audio API for Viz)
  useEffect(() => {
    const audio = audioRef.current;
    
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleDurationChange = () => setDuration(audio.duration);
    const handleEnded = () => handleNext();

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('ended', handleEnded);

    // Setup visualizer context on user interaction (first play)
    const initAudioContext = () => {
      if (!audioContextRef.current) {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContext();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        
        // Connect nodes
        if (!sourceRef.current) {
             sourceRef.current = ctx.createMediaElementSource(audio);
             sourceRef.current.connect(analyser);
             analyser.connect(ctx.destination);
        }

        audioContextRef.current = ctx;
        analyserRef.current = analyser;
        dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
      }
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
      }
    };

    audio.addEventListener('play', initAudioContext);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', initAudioContext);
    };
  }, []);

  // Track Change Effect
  useEffect(() => {
    const audio = audioRef.current;
    audio.src = currentTrack.url;
    audio.volume = volume;
    if (isPlaying) {
      audio.play().catch(e => console.error("Play failed:", e));
    }
    
    // Trigger AI Vibe Analysis
    analyzeTrackVibe(currentTrack).then((vibe) => {
       setVisualColor(vibe.color);
       // Optional: Add a small toast or message about the vibe
       addAiMessage(vibe.description);
    });

  }, [currentTrackIndex]); // Only re-run when index changes

  // Play/Pause Effect
  useEffect(() => {
    const audio = audioRef.current;
    if (isPlaying) audio.play().catch(() => setIsPlaying(false));
    else audio.pause();
  }, [isPlaying]);

  // Volume Effect
  useEffect(() => {
    audioRef.current.volume = volume;
  }, [volume]);

  const handlePlayPause = () => setIsPlaying(!isPlaying);
  
  const handleNext = () => {
    setCurrentTrackIndex((prev) => (prev + 1) % tracks.length);
  };

  const handlePrev = () => {
    setCurrentTrackIndex((prev) => (prev - 1 + tracks.length) % tracks.length);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  // AI Chat Logic
  const addAiMessage = (text: string) => {
    setChatMessages(prev => [...prev, {
      id: Date.now().toString(),
      sender: 'ai',
      text,
      timestamp: new Date()
    }]);
  };

  const handleUserMessage = async (text: string) => {
    // Add user message
    setChatMessages(prev => [...prev, {
      id: Date.now().toString(),
      sender: 'user',
      text,
      timestamp: new Date()
    }]);

    setIsAiTyping(true);
    const response = await generateDJResponse(text, currentTrack);
    setIsAiTyping(false);
    addAiMessage(response);
  };

  // File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      const file = files[0];
      const url = URL.createObjectURL(file);
      const newTrack: Track = {
        id: Date.now().toString(),
        title: file.name.replace(/\.[^/.]+$/, ""),
        artist: 'Local Upload',
        url: url
      };
      setTracks(prev => [...prev, newTrack]);
      setCurrentTrackIndex(tracks.length); // Switch to new track immediately
      setIsPlaying(true);
    }
  };

  return (
    <div className="relative w-full h-full bg-black overflow-hidden font-sans text-white">
      
      {/* 3D Visualizer Background */}
      <div className="absolute inset-0 z-0">
        <Canvas camera={{ position: [0, 0, 4], fov: 45 }}>
          <Visualizer3D 
            audioData={{ analyser: analyserRef.current, dataArray: dataArrayRef.current }} 
            primaryColor={visualColor}
          />
          <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={0.5} />
        </Canvas>
      </div>

      {/* Main Overlay */}
      <div className="absolute inset-0 z-10 flex flex-col pointer-events-none">
        
        {/* Header */}
        <header className="p-6 flex justify-between items-center pointer-events-auto">
          <div className="flex items-center gap-2">
            <Disc3 className={`text-${visualColor} animate-spin-slow`} color={visualColor} size={32} />
            <h1 className="text-2xl font-bold tracking-tighter">NEON<span className="text-gray-400 font-light">FLOW</span></h1>
          </div>
          
          <div className="flex gap-4">
             <button 
               onClick={() => setShowPlaylist(!showPlaylist)}
               className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all backdrop-blur-md"
             >
               <ListMusic size={20} />
             </button>
             <label className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all backdrop-blur-md cursor-pointer">
                <Plus size={20} />
                <input type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} />
             </label>
          </div>
        </header>

        {/* Middle Section (Grid) */}
        <main className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 p-6 overflow-hidden">
           
           {/* Left: Playlist (Conditional on Mobile, visible on Desktop) */}
           <div className={`md:col-span-3 lg:col-span-3 transition-all duration-300 ${showPlaylist ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0 md:translate-x-0 md:opacity-100'} pointer-events-auto`}>
              <div className="h-full bg-black/30 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden flex flex-col">
                 <div className="p-4 border-b border-white/5 font-bold text-gray-400 text-xs tracking-widest uppercase">Library</div>
                 <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {tracks.map((track, idx) => (
                       <div 
                         key={track.id}
                         onClick={() => setCurrentTrackIndex(idx)}
                         className={`p-3 rounded-xl flex items-center gap-3 cursor-pointer transition-all hover:bg-white/10 ${currentTrackIndex === idx ? 'bg-white/20' : ''}`}
                       >
                          <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center overflow-hidden">
                             {track.coverUrl ? <img src={track.coverUrl} className="w-full h-full object-cover" /> : <Music size={16} />}
                          </div>
                          <div className="overflow-hidden">
                             <div className={`text-sm font-medium truncate ${currentTrackIndex === idx ? 'text-white' : 'text-gray-300'}`}>{track.title}</div>
                             <div className="text-xs text-gray-500 truncate">{track.artist}</div>
                          </div>
                          {currentTrackIndex === idx && isPlaying && (
                             <div className="ml-auto w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                          )}
                       </div>
                    ))}
                 </div>
              </div>
           </div>

           {/* Center: Empty Space for Visualizer */}
           <div className="md:col-span-6 lg:col-span-6" />

           {/* Right: AI Chat */}
           <div className="md:col-span-3 lg:col-span-3 pointer-events-auto h-[400px] md:h-auto absolute bottom-24 right-6 w-80 md:static md:w-auto md:block rounded-3xl overflow-hidden shadow-2xl border border-white/10">
              <AIChat 
                messages={chatMessages} 
                onSendMessage={handleUserMessage} 
                isTyping={isAiTyping} 
              />
           </div>

        </main>

        {/* Footer: Controls */}
        <footer className="p-6 pointer-events-auto">
          <PlayerControls
             isPlaying={isPlaying}
             onPlayPause={handlePlayPause}
             onNext={handleNext}
             onPrev={handlePrev}
             currentTime={currentTime}
             duration={duration}
             onSeek={handleSeek}
             volume={volume}
             onVolumeChange={(e) => setVolume(Number(e.target.value))}
             trackTitle={currentTrack.title}
             trackArtist={currentTrack.artist}
          />
        </footer>
      </div>
    </div>
  );
};

export default App;
