import React, { useState, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Disc3, Music, ListMusic, Plus, Upload, Trash2, Eye, FolderPlus, MoreVertical, X, MessageSquare, Mic2, Sliders, Save, Search as SearchIcon } from 'lucide-react';
import Visualizer3D from './components/Visualizer3D';
import PlayerControls from './components/PlayerControls';
import AIChat from './components/AIChat';
import LyricsPanel from './components/LyricsPanel';
import { Track, ChatMessage, Playlist, VisualizerMode } from './types';
import { DEMO_TRACKS, INITIAL_DJ_MESSAGE } from './constants';
import { generateDJResponse, analyzeTrackVibe, fetchLyrics } from './services/gemini';

interface VisualizerPreset {
  id: string;
  name: string;
  mode: VisualizerMode;
  color: string;
  intensity: number;
  speed: number;
}

const App: React.FC = () => {
  // --- Audio State ---
  const [tracks, setTracks] = useState<Track[]>(DEMO_TRACKS); // "Library"
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [currentView, setCurrentView] = useState<'library' | 'playlist'>('library');
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null); // For viewing
  
  // What is actually playing context
  const [playbackContext, setPlaybackContext] = useState<'library' | string>('library'); // 'library' or playlist ID
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // --- Search State ---
  const [searchQuery, setSearchQuery] = useState('');

  // --- AI & Visual State ---
  const [visualColor, setVisualColor] = useState<string>('#4f46e5');
  const [visualizerMode, setVisualizerMode] = useState<VisualizerMode>('orb');
  const [visualSettings, setVisualSettings] = useState({ intensity: 1, speed: 1 });
  const [showVisSettings, setShowVisSettings] = useState(false);
  
  // Visualizer Presets
  const [presets, setPresets] = useState<VisualizerPreset[]>([
    { id: '1', name: 'Chill Vibe', mode: 'orb', color: '#4f46e5', intensity: 0.8, speed: 0.5 },
    { id: '2', name: 'Rave Mode', mode: 'bars', color: '#ec4899', intensity: 2.0, speed: 2.5 },
    { id: '3', name: 'Cyber Wave', mode: 'wave', color: '#10b981', intensity: 1.2, speed: 1.0 },
  ]);
  const [newPresetName, setNewPresetName] = useState('');

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: '1', sender: 'ai', text: INITIAL_DJ_MESSAGE, timestamp: new Date() }
  ]);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);

  // --- Right Panel State (Chat vs Lyrics) ---
  const [rightPanelMode, setRightPanelMode] = useState<'chat' | 'lyrics'>('chat');
  const [lyrics, setLyrics] = useState<string>('');
  const [isLyricsLoading, setIsLyricsLoading] = useState(false);
  // Cache for lyrics to avoid re-fetching: { trackId: lyricsText }
  const [lyricsCache, setLyricsCache] = useState<Record<string, string>>({});
  
  // UI helper for "Add to Playlist" modal
  const [trackToAdd, setTrackToAdd] = useState<Track | null>(null);

  // --- Refs ---
  const audioRef = useRef<HTMLAudioElement>(new Audio());
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  // Derived: The list of tracks currently playing
  const playingTracks = playbackContext === 'library' 
    ? tracks 
    : playlists.find(p => p.id === playbackContext)?.tracks || tracks;
    
  const currentTrack = playingTracks[currentTrackIndex] || tracks[0];

  // --- Helper Functions ---
  const fetchLyricsForCurrentTrack = async (track: Track) => {
    // 1. Check Cache
    if (lyricsCache[track.id]) {
      setLyrics(lyricsCache[track.id]);
      return;
    }

    // 2. Fetch if not cached
    setIsLyricsLoading(true);
    setLyrics(''); // Clear old lyrics while loading
    try {
      const fetchedLyrics = await fetchLyrics(track);
      if (fetchedLyrics) {
        setLyrics(fetchedLyrics);
        setLyricsCache(prev => ({ ...prev, [track.id]: fetchedLyrics }));
      } else {
        setLyrics(""); // Ensure empty so UI shows "not found"
      }
    } catch (error) {
      console.error("Failed to fetch lyrics:", error);
      setLyrics("");
    } finally {
      setIsLyricsLoading(false);
    }
  };

  const savePreset = () => {
    if (!newPresetName.trim()) return;
    const newPreset: VisualizerPreset = {
      id: Date.now().toString(),
      name: newPresetName,
      mode: visualizerMode,
      color: visualColor,
      intensity: visualSettings.intensity,
      speed: visualSettings.speed
    };
    setPresets([...presets, newPreset]);
    setNewPresetName('');
  };

  const loadPreset = (preset: VisualizerPreset) => {
    setVisualizerMode(preset.mode);
    setVisualColor(preset.color);
    setVisualSettings({ intensity: preset.intensity, speed: preset.speed });
  };

  const deletePreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPresets(presets.filter(p => p.id !== id));
  };

  // --- Audio Initialization ---
  useEffect(() => {
    const audio = audioRef.current;
    
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleDurationChange = () => setDuration(audio.duration);
    const handleEnded = () => handleNext();

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('ended', handleEnded);

    const initAudioContext = () => {
      if (!audioContextRef.current) {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContext();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        
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
  }, [playbackContext]);

  // --- Track Change Logic ---
  useEffect(() => {
    if (!currentTrack || currentTrack.status === 'uploading') return;
    const audio = audioRef.current;
    
    // Only update source if it's different
    if (decodeURIComponent(audio.src) !== decodeURIComponent(currentTrack.url)) {
       audio.src = currentTrack.url;
       if (isPlaying) {
         audio.play().catch(e => console.error("Play failed:", e));
       }
       // Analyze new track vibe
       analyzeTrackVibe(currentTrack).then((vibe) => {
          setVisualColor(vibe.color);
       });

       // Fetch Lyrics using the new helper function (handles cache)
       fetchLyricsForCurrentTrack(currentTrack);
    }
  }, [currentTrack, isPlaying]);

  useEffect(() => {
    audioRef.current.volume = volume;
  }, [volume]);

  // --- Controls ---
  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (isPlaying) audio.pause();
    else audio.play().catch(e => console.error(e));
    setIsPlaying(!isPlaying);
  };

  const handleNext = () => {
    setCurrentTrackIndex((prev) => (prev + 1) % playingTracks.length);
  };

  const handlePrev = () => {
    setCurrentTrackIndex((prev) => (prev - 1 + playingTracks.length) % playingTracks.length);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const handleTrackSelect = (track: Track, index: number, context: 'library' | string = 'library') => {
    if (context !== playbackContext) {
      setPlaybackContext(context);
    }
    setCurrentTrackIndex(index);
    setIsPlaying(true);
  };

  // --- AI Chat ---
  const handleUserMessage = async (text: string) => {
    setChatMessages(prev => [...prev, { id: Date.now().toString(), sender: 'user', text, timestamp: new Date() }]);
    setIsAiTyping(true);
    const response = await generateDJResponse(text, currentTrack);
    setIsAiTyping(false);
    setChatMessages(prev => [...prev, { id: Date.now().toString(), sender: 'ai', text: response, timestamp: new Date() }]);
  };

  // --- Playlist Management ---
  const createPlaylist = () => {
    const name = prompt("Enter playlist name:");
    if (name) {
      const newPlaylist: Playlist = {
        id: Date.now().toString(),
        name,
        tracks: []
      };
      setPlaylists(prev => [...prev, newPlaylist]);
      setCurrentView('playlist');
      setActivePlaylistId(newPlaylist.id);
    }
  };

  const deletePlaylist = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Delete this playlist?")) {
      setPlaylists(prev => prev.filter(p => p.id !== id));
      if (activePlaylistId === id) {
        setCurrentView('library');
        setActivePlaylistId(null);
      }
      if (playbackContext === id) {
        setPlaybackContext('library');
        setCurrentTrackIndex(0);
        setIsPlaying(false);
      }
    }
  };

  const addToPlaylist = (playlistId: string) => {
    if (!trackToAdd) return;
    setPlaylists(prev => prev.map(p => {
      if (p.id === playlistId) {
        if (p.tracks.find(t => t.id === trackToAdd.id)) return p;
        return { ...p, tracks: [...p.tracks, trackToAdd] };
      }
      return p;
    }));
    setTrackToAdd(null);
    alert(`Added to playlist!`);
  };

  const removeFromPlaylist = (playlistId: string, trackId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPlaylists(prev => prev.map(p => {
       if (p.id === playlistId) {
         return { ...p, tracks: p.tracks.filter(t => t.id !== trackId) };
       }
       return p;
    }));
  };

  // --- File Upload ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      const file = files[0];
      const tempId = `uploading-${Date.now()}`;
      
      // 1. Add placeholder track to state for immediate UI feedback
      const placeholderTrack: Track = {
        id: tempId,
        title: file.name.replace(/\.[^/.]+$/, ""),
        artist: 'Local Upload',
        url: '', // No URL yet, not playable
        status: 'uploading',
      };
      setTracks(prev => [...prev, placeholderTrack]);

      // 2. Process file in the background. A timeout ensures the placeholder renders first.
      setTimeout(() => {
        const url = URL.createObjectURL(file);
        
        const finalTrack: Track = {
          id: Date.now().toString(), // Use a new permanent ID
          title: placeholderTrack.title,
          artist: placeholderTrack.artist,
          url: url,
          status: 'ready',
        };

        // 3. Replace placeholder with the final, playable track and auto-play
        setTracks(prevTracks => {
          const finalTracks = [...prevTracks];
          const placeholderIndex = finalTracks.findIndex(t => t.id === tempId);
          
          if (placeholderIndex !== -1) {
            finalTracks[placeholderIndex] = finalTrack;
            
            // 4. If in library context, auto-play the new track
            if (playbackContext === 'library') {
              setCurrentTrackIndex(placeholderIndex);
              setIsPlaying(true);
            }
          }
          return finalTracks;
        });
      }, 100);
    }
  };

  const switchVisualizer = () => {
     const modes: VisualizerMode[] = ['orb', 'bars', 'wave'];
     const currentIdx = modes.indexOf(visualizerMode);
     setVisualizerMode(modes[(currentIdx + 1) % modes.length]);
  };

  // --- Search Logic ---
  const filteredTracks = searchQuery 
    ? tracks.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()) || t.artist.toLowerCase().includes(searchQuery.toLowerCase()))
    : tracks;

  const filteredPlaylists = searchQuery
    ? playlists.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : playlists;

  return (
    <div className="relative w-full h-full bg-black overflow-hidden font-sans text-white">
      
      {/* 3D Visualizer Background */}
      <div className="absolute inset-0 z-0">
        <Canvas camera={{ position: [0, 0, 4], fov: 45 }}>
          <Visualizer3D 
            audioData={{ analyser: analyserRef.current, dataArray: dataArrayRef.current }} 
            primaryColor={visualColor}
            mode={visualizerMode}
            intensity={visualSettings.intensity}
            speed={visualSettings.speed}
            onSwitchMode={switchVisualizer}
            onChangeColor={setVisualColor}
            onChangeIntensity={(val) => setVisualSettings(prev => ({ ...prev, intensity: val }))}
            onChangeSpeed={(val) => setVisualSettings(prev => ({ ...prev, speed: val }))}
          />
          <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={0.5 * visualSettings.speed} />
        </Canvas>
      </div>

      {/* Main Overlay */}
      <div className="absolute inset-0 z-10 flex flex-col pointer-events-none">
        
        {/* Header */}
        <header className="p-6 flex justify-between items-center pointer-events-auto bg-gradient-to-b from-black/60 to-transparent">
          <div className="flex items-center gap-2">
            <Disc3 className={`text-${visualColor} animate-spin-slow`} color={visualColor} size={32} />
            <h1 className="text-2xl font-bold tracking-tighter">NEON<span className="text-gray-400 font-light">FLOW</span></h1>
          </div>
          
          <div className="flex gap-4 relative">
             {/* Visualizer Settings Popup */}
             {showVisSettings && (
               <div className="absolute top-14 right-4 z-50 bg-black/90 backdrop-blur-md border border-white/20 p-4 rounded-xl w-72 shadow-2xl animate-fade-in-down">
                 <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-white/10 pb-2 flex justify-between">
                   Vis Settings
                   <X size={14} className="cursor-pointer hover:text-white" onClick={() => setShowVisSettings(false)} />
                 </h3>
                 
                 <div className="mb-4">
                   <div className="flex justify-between text-xs text-gray-300 mb-1">
                     <span className="font-medium">Intensity</span>
                     <span className="text-cyan-400">{Math.round(visualSettings.intensity * 100)}%</span>
                   </div>
                   <input 
                     type="range" min="0.1" max="2.5" step="0.1" 
                     value={visualSettings.intensity}
                     onChange={(e) => setVisualSettings({...visualSettings, intensity: Number(e.target.value)})}
                     className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                   />
                 </div>

                 <div className="mb-4">
                   <div className="flex justify-between text-xs text-gray-300 mb-1">
                     <span className="font-medium">Speed</span>
                     <span className="text-pink-400">{Math.round(visualSettings.speed * 100)}%</span>
                   </div>
                   <input 
                     type="range" min="0" max="3" step="0.1" 
                     value={visualSettings.speed}
                     onChange={(e) => setVisualSettings({...visualSettings, speed: Number(e.target.value)})}
                     className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-pink-400"
                   />
                 </div>

                 {/* Presets Section */}
                 <div className="border-t border-white/10 pt-4">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Presets</h4>
                    
                    {/* Save New */}
                    <div className="flex gap-2 mb-3">
                        <input 
                          type="text" 
                          placeholder="Name..." 
                          value={newPresetName}
                          onChange={(e) => setNewPresetName(e.target.value)}
                          className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500"
                        />
                        <button 
                          onClick={savePreset} 
                          disabled={!newPresetName} 
                          className="bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1 rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                        >
                          <Save size={12} />
                        </button>
                    </div>

                    {/* List */}
                    <div className="max-h-32 overflow-y-auto space-y-1 custom-scrollbar">
                        {presets.map(preset => (
                            <div 
                              key={preset.id} 
                              className="group flex justify-between items-center p-2 rounded hover:bg-white/10 cursor-pointer transition-colors" 
                              onClick={() => loadPreset(preset)}
                            >
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: preset.color }}></div>
                                      <span className="text-xs font-medium text-gray-200 group-hover:text-white">{preset.name}</span>
                                    </div>
                                    <span className="text-[10px] text-gray-500 capitalize pl-4">{preset.mode} • {Math.round(preset.speed * 100)}% spd</span>
                                </div>
                                <button 
                                  onClick={(e) => deletePreset(preset.id, e)} 
                                  className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 p-1 transition-opacity"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        ))}
                         {presets.length === 0 && <div className="text-xs text-gray-600 text-center py-2">No presets saved</div>}
                    </div>
                 </div>
               </div>
             )}

             <button 
               onClick={() => setShowVisSettings(!showVisSettings)}
               className={`p-2 rounded-full transition-all backdrop-blur-md border border-white/5 ${showVisSettings ? 'bg-white/20 text-white' : 'bg-white/10 text-gray-400 hover:text-white hover:bg-white/20'}`}
               title="Visualizer Settings"
             >
               <Sliders size={20} />
             </button>

             <button 
               onClick={switchVisualizer}
               className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all backdrop-blur-md border border-white/5"
               title={`Switch Visualizer (Current: ${visualizerMode})`}
             >
               <Eye size={20} className={visualizerMode === 'bars' ? 'text-cyan-400' : visualizerMode === 'wave' ? 'text-purple-400' : 'text-white'} />
             </button>
             <button 
               onClick={() => setShowSidebar(!showSidebar)}
               className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all backdrop-blur-md md:hidden"
             >
               <ListMusic size={20} />
             </button>
             <label className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all backdrop-blur-md cursor-pointer border border-white/5" title="Upload Song">
                <Upload size={20} />
                <input type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} />
             </label>
          </div>
        </header>

        {/* Middle Section (Grid) */}
        <main className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 p-6 overflow-hidden">
           
           {/* Left: Sidebar (Library & Playlists) */}
           <div className={`absolute inset-0 z-50 bg-black/90 md:bg-transparent md:static md:col-span-4 lg:col-span-3 transition-all duration-300 ${showSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} pointer-events-auto`}>
              <div className="h-full bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden flex flex-col shadow-2xl">
                 
                 {/* Search Bar */}
                 <div className="p-4 border-b border-white/10">
                    <div className="relative">
                      <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input 
                        type="text" 
                        placeholder="Search tracks or playlists..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors placeholder-gray-500"
                      />
                      {searchQuery && (
                         <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                            <X size={14} />
                         </button>
                      )}
                    </div>
                 </div>

                 {/* Sidebar Content: Search Results OR Standard Tabs */}
                 {searchQuery ? (
                    <div className="flex-1 overflow-y-auto p-2 space-y-4">
                        {/* Tracks Result */}
                        <div>
                          <h4 className="px-2 mb-2 text-xs font-bold text-gray-500 uppercase tracking-wider">Tracks Found</h4>
                          {filteredTracks.length === 0 && <p className="px-2 text-sm text-gray-600 italic">No tracks found.</p>}
                          {filteredTracks.map((track) => {
                             const originalIndex = tracks.findIndex(t => t.id === track.id);
                             return (
                               <div 
                                 key={track.id}
                                 className="group relative p-2 rounded-lg flex items-center gap-3 cursor-pointer hover:bg-white/10"
                               >
                                  <div className="w-8 h-8 rounded bg-gray-800 flex items-center justify-center overflow-hidden shrink-0" onClick={() => handleTrackSelect(track, originalIndex, 'library')}>
                                     {track.coverUrl ? <img src={track.coverUrl} className="w-full h-full object-cover" /> : <Music size={14} />}
                                  </div>
                                  <div className="overflow-hidden flex-1" onClick={() => handleTrackSelect(track, originalIndex, 'library')}>
                                     <div className="text-sm font-medium text-gray-200 truncate">{track.title}</div>
                                     <div className="text-xs text-gray-500 truncate">{track.artist}</div>
                                  </div>
                               </div>
                             );
                          })}
                        </div>
                        
                        {/* Playlists Result */}
                        <div>
                           <h4 className="px-2 mb-2 text-xs font-bold text-gray-500 uppercase tracking-wider">Playlists Found</h4>
                           {filteredPlaylists.length === 0 && <p className="px-2 text-sm text-gray-600 italic">No playlists found.</p>}
                           {filteredPlaylists.map(playlist => (
                              <div 
                                key={playlist.id}
                                onClick={() => {
                                  setActivePlaylistId(playlist.id);
                                  setCurrentView('playlist');
                                  setSearchQuery('');
                                }}
                                className="p-3 rounded-lg flex items-center justify-between cursor-pointer hover:bg-white/10"
                              >
                                 <span className="text-sm font-medium truncate">{playlist.name}</span>
                                 <span className="text-xs text-gray-500">{playlist.tracks.length} songs</span>
                              </div>
                           ))}
                        </div>
                    </div>
                 ) : (
                    <>
                      {/* Sidebar Navigation */}
                      <div className="p-2 flex gap-1 border-b border-white/10">
                          <button 
                            onClick={() => setCurrentView('library')}
                            className={`flex-1 py-2 text-sm font-bold uppercase tracking-wider rounded-lg transition-colors ${currentView === 'library' ? 'bg-white/20 text-white' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                          >
                            Library
                          </button>
                          <button 
                            onClick={() => setCurrentView('playlist')}
                            className={`flex-1 py-2 text-sm font-bold uppercase tracking-wider rounded-lg transition-colors ${currentView === 'playlist' ? 'bg-white/20 text-white' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                          >
                            Playlists
                          </button>
                      </div>

                      {/* Library View */}
                      {currentView === 'library' && (
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {tracks.map((track, idx) => (
                              <div 
                                key={track.id}
                                className={`group relative p-3 rounded-xl flex items-center gap-3 transition-all ${track.status === 'uploading' ? 'opacity-50' : 'cursor-pointer hover:bg-white/10'} ${playbackContext === 'library' && currentTrackIndex === idx ? 'bg-white/20' : ''}`}
                              >
                                  <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center overflow-hidden shrink-0" onClick={track.status !== 'uploading' ? () => handleTrackSelect(track, idx, 'library') : undefined}>
                                    {track.status === 'uploading' ? (
                                      <div className="w-5 h-5 border-2 border-gray-500 border-t-white rounded-full animate-spin"></div>
                                    ) : track.coverUrl ? (
                                      <img src={track.coverUrl} className="w-full h-full object-cover" />
                                    ) : (
                                      <Music size={16} />
                                    )}
                                  </div>
                                  <div className="overflow-hidden flex-1" onClick={track.status !== 'uploading' ? () => handleTrackSelect(track, idx, 'library') : undefined}>
                                    <div className={`text-sm font-medium truncate ${playbackContext === 'library' && currentTrackIndex === idx ? 'text-white' : 'text-gray-300'}`}>{track.title}</div>
                                    <div className="text-xs text-gray-500 truncate">{track.artist}</div>
                                  </div>
                                  {track.status !== 'uploading' && (
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); setTrackToAdd(track); }}
                                      className="p-1.5 rounded-full hover:bg-white/20 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                      title="Add to Playlist"
                                    >
                                      <Plus size={16} />
                                    </button>
                                  )}
                              </div>
                            ))}
                        </div>
                      )}

                      {/* Playlists View */}
                      {currentView === 'playlist' && (
                        <div className="flex-1 flex flex-col h-full">
                          {/* List of Playlists (Top half if viewing specific, or full if not) */}
                          <div className={`overflow-y-auto p-2 space-y-1 border-b border-white/10 ${activePlaylistId ? 'h-1/3' : 'flex-1'}`}>
                              <button onClick={createPlaylist} className="w-full py-3 mb-2 flex items-center justify-center gap-2 border border-dashed border-gray-600 rounded-xl text-gray-400 hover:text-white hover:border-white transition-all text-sm">
                                <FolderPlus size={16} /> New Playlist
                              </button>
                              {playlists.map(playlist => (
                                <div 
                                  key={playlist.id}
                                  onClick={() => setActivePlaylistId(playlist.id)}
                                  className={`p-3 rounded-xl flex items-center justify-between cursor-pointer transition-all hover:bg-white/10 ${activePlaylistId === playlist.id ? 'bg-white/20 border border-white/10' : ''}`}
                                >
                                    <span className="text-sm font-medium truncate">{playlist.name}</span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-gray-500">{playlist.tracks.length} songs</span>
                                      <button onClick={(e) => deletePlaylist(playlist.id, e)} className="text-gray-500 hover:text-red-400"><Trash2 size={14}/></button>
                                    </div>
                                </div>
                              ))}
                          </div>
                          
                          {/* Tracks in Selected Playlist */}
                          {activePlaylistId && (
                            <div className="flex-1 overflow-y-auto p-2 bg-black/20">
                                <div className="px-2 py-1 text-xs text-gray-500 uppercase font-bold tracking-wider mb-2">
                                  {playlists.find(p => p.id === activePlaylistId)?.name} Tracks
                                </div>
                                {playlists.find(p => p.id === activePlaylistId)?.tracks.length === 0 && (
                                  <div className="text-center text-gray-600 text-xs py-4">No tracks yet. Add from Library.</div>
                                )}
                                {playlists.find(p => p.id === activePlaylistId)?.tracks.map((track, idx) => (
                                  <div 
                                      key={`${track.id}-${idx}`}
                                      className={`group p-2 rounded-lg flex items-center gap-2 cursor-pointer hover:bg-white/5 ${playbackContext === activePlaylistId && currentTrackIndex === idx ? 'bg-white/10' : ''}`}
                                  >
                                      <div className="flex-1 overflow-hidden" onClick={() => handleTrackSelect(track, idx, activePlaylistId)}>
                                        <div className="text-sm text-gray-300 truncate">{track.title}</div>
                                        <div className="text-xs text-gray-600">{track.artist}</div>
                                      </div>
                                      <button 
                                        onClick={(e) => removeFromPlaylist(activePlaylistId, track.id, e)}
                                        className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100"
                                      >
                                        <X size={14} />
                                      </button>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                 )}
                 
                 {/* Mobile Sidebar Close */}
                 <button onClick={() => setShowSidebar(false)} className="md:hidden p-4 text-center text-gray-500 border-t border-white/10">Close</button>
              </div>
           </div>

           {/* Center: Empty Space for Visualizer */}
           <div className="hidden md:block md:col-span-4 lg:col-span-6" />

           {/* Right: AI Chat / Lyrics */}
           <div className="md:col-span-4 lg:col-span-3 pointer-events-auto h-[350px] md:h-auto absolute bottom-32 right-6 w-80 md:static md:w-auto md:block rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col bg-black/40 backdrop-blur-xl">
              
              {/* Tab Switcher */}
              <div className="flex border-b border-white/10">
                 <button 
                   onClick={() => setRightPanelMode('chat')}
                   className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-white/5 transition-colors ${rightPanelMode === 'chat' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-500'}`}
                 >
                   <MessageSquare size={14} /> Chat
                 </button>
                 <button 
                   onClick={() => setRightPanelMode('lyrics')}
                   className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-white/5 transition-colors ${rightPanelMode === 'lyrics' ? 'text-pink-400 border-b-2 border-pink-400' : 'text-gray-500'}`}
                 >
                   <Mic2 size={14} /> Lyrics
                 </button>
              </div>

              {/* Panel Content */}
              <div className="flex-1 overflow-hidden">
                {rightPanelMode === 'chat' ? (
                  <AIChat 
                    messages={chatMessages} 
                    onSendMessage={handleUserMessage} 
                    isTyping={isAiTyping} 
                  />
                ) : (
                  <LyricsPanel 
                    lyrics={lyrics} 
                    loading={isLyricsLoading} 
                    onUpdateLyrics={setLyrics}
                    trackTitle={currentTrack.title}
                  />
                )}
              </div>
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
             trackTitle={currentTrack?.title}
             trackArtist={currentTrack?.artist}
             coverUrl={currentTrack?.coverUrl}
          />
        </footer>

        {/* Modal: Add to Playlist */}
        {trackToAdd && (
          <div className="absolute inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center pointer-events-auto">
             <div className="bg-gray-900 border border-white/20 rounded-2xl p-6 w-80 shadow-2xl">
                <h3 className="text-white font-bold mb-4">Add to Playlist</h3>
                <p className="text-gray-400 text-sm mb-4">Select a playlist for "{trackToAdd.title}":</p>
                <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
                   {playlists.length === 0 && <p className="text-gray-600 italic text-sm">No playlists found. Create one first.</p>}
                   {playlists.map(p => (
                      <button 
                        key={p.id}
                        onClick={() => addToPlaylist(p.id)}
                        className="w-full text-left p-3 rounded-lg bg-white/5 hover:bg-white/10 text-gray-200 text-sm transition-colors"
                      >
                        {p.name}
                      </button>
                   ))}
                </div>
                <button onClick={() => setTrackToAdd(null)} className="w-full py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg text-sm">Cancel</button>
             </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default App;