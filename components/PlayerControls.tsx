import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, Share2, Twitter, Facebook, Music } from 'lucide-react';

interface PlayerControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  currentTime: number;
  duration: number;
  onSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onVolumeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  volume: number;
  trackTitle?: string;
  trackArtist?: string;
  coverUrl?: string;
  lyrics: string;
}

// Custom hook to determine the current lyric line
const useCurrentLyricLine = (lyrics: string, currentTime: number, duration: number) => {
  const lines = useMemo(() => lyrics.split('\n').filter(line => line.trim() !== ''), [lyrics]);

  if (!lines.length || !duration || !lyrics) {
    return null;
  }

  // Distribute lines evenly across the track duration
  const lineDuration = duration / lines.length;
  const currentIndex = Math.min(lines.length - 1, Math.floor(currentTime / lineDuration));
  
  return lines[currentIndex];
};


const formatTime = (time: number) => {
  if (!time) return "0:00";
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

const PlayerControls: React.FC<PlayerControlsProps> = ({
  isPlaying,
  onPlayPause,
  onNext,
  onPrev,
  currentTime,
  duration,
  onSeek,
  onVolumeChange,
  volume,
  trackTitle,
  trackArtist,
  coverUrl,
  lyrics
}) => {
  const [showShareMenu, setShowShareMenu] = useState(false);
  const progressContainerRef = useRef<HTMLDivElement>(null);
  const [isSeeking, setIsSeeking] = useState(false);
  const currentLyric = useCurrentLyricLine(lyrics, currentTime, duration);

  const handleShare = (platform: 'twitter' | 'facebook') => {
    const text = encodeURIComponent(`Listening to "${trackTitle}" by ${trackArtist} on NeonFlow 3D! 🎵✨`);
    const url = encodeURIComponent(window.location.href);
    
    let shareUrl = '';
    if (platform === 'twitter') {
      shareUrl = `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
    } else if (platform === 'facebook') {
      shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
    }
    
    window.open(shareUrl, '_blank', 'width=600,height=400');
    setShowShareMenu(false);
  };
  
  const handleSeekInteraction = (e: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
    if (!progressContainerRef.current || !duration) return;
    const rect = progressContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    const progress = Math.max(0, Math.min(1, x / width));
    const newTime = progress * duration;
    
    const syntheticEvent = {
      target: { value: String(newTime) }
    } as React.ChangeEvent<HTMLInputElement>;
    
    onSeek(syntheticEvent);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isSeeking) {
        handleSeekInteraction(e);
      }
    };
    
    const handleMouseUp = () => {
      if (isSeeking) {
        setIsSeeking(false);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isSeeking, duration, onSeek]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
      setIsSeeking(true);
      handleSeekInteraction(e);
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl relative">
      <div className="flex flex-col gap-4">
        {/* Track Info with Album Art */}
        <div className="flex justify-between items-center px-2">
           <div className="flex items-center gap-4 flex-1 overflow-hidden">
              {/* Album Art with Lyrics Overlay */}
               <div className={`relative w-14 h-14 shrink-0 rounded-lg bg-gray-800 overflow-hidden shadow-lg border border-white/10 ${isPlaying ? 'animate-pulse' : ''}`}>
                  {coverUrl ? (
                    <img src={coverUrl} alt={trackTitle} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500">
                      <Music size={20} />
                    </div>
                  )}

                  {/* Lyrics Overlay */}
                  {currentLyric && isPlaying && (
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end justify-center p-1 pointer-events-none">
                        <p 
                            key={currentLyric} // Key to re-trigger animation on change
                            className="text-white text-[10px] font-bold text-center leading-tight shadow-black [text-shadow:0_1px_3px_var(--tw-shadow-color)] animate-fade-in"
                        >
                            {currentLyric}
                        </p>
                    </div>
                  )}
               </div>

               <div className="flex-1 overflow-hidden text-center md:text-left">
                  <h3 className="text-white font-bold text-lg tracking-wide truncate">{trackTitle || "No Track Selected"}</h3>
                  <p className="text-gray-400 text-sm truncate">{trackArtist || "Select a track to begin"}</p>
               </div>
           </div>
           
           {/* Share Button (Desktop) */}
           <div className="relative hidden md:block shrink-0">
              <button 
                onClick={() => setShowShareMenu(!showShareMenu)}
                className="text-gray-400 hover:text-cyan-400 transition-colors p-2"
                title="Share this track"
              >
                <Share2 size={20} />
              </button>
              {showShareMenu && (
                <div className="absolute bottom-full right-0 mb-2 w-32 bg-gray-900 border border-white/10 rounded-xl shadow-xl overflow-hidden z-50">
                  <button onClick={() => handleShare('twitter')} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-300 hover:bg-white/10 hover:text-cyan-400">
                    <Twitter size={14} /> Twitter
                  </button>
                  <button onClick={() => handleShare('facebook')} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-300 hover:bg-white/10 hover:text-blue-400">
                    <Facebook size={14} /> Facebook
                  </button>
                </div>
              )}
           </div>
        </div>

        {/* New Progress Bar */}
        <div className="flex items-center gap-3 text-xs text-gray-400 font-mono">
          <span>{formatTime(currentTime)}</span>
          <div
            ref={progressContainerRef}
            onMouseDown={handleMouseDown}
            className="w-full h-1.5 bg-gray-700 rounded-full cursor-pointer group"
          >
            <div
              className="h-full bg-white group-hover:bg-cyan-400 rounded-full relative transition-colors duration-200"
              style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3.5 h-3.5 bg-white group-hover:bg-cyan-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
            </div>
          </div>
          <span>{formatTime(duration)}</span>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-between px-4">
          <div className="flex items-center gap-2 w-1/4">
             <Volume2 size={16} className="text-gray-400" />
             <input 
               type="range" 
               min="0" 
               max="1" 
               step="0.01" 
               value={volume}
               onChange={onVolumeChange}
               className="w-20 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-gray-400"
             />
          </div>

          <div className="flex items-center gap-6 justify-center w-1/2">
            <button onClick={onPrev} className="text-gray-400 hover:text-white transition-colors">
              <SkipBack size={24} />
            </button>
            <button 
              onClick={onPlayPause} 
              className="w-14 h-14 flex items-center justify-center bg-white text-black rounded-full hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)]"
            >
              {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
            </button>
            <button onClick={onNext} className="text-gray-400 hover:text-white transition-colors">
              <SkipForward size={24} />
            </button>
          </div>

          <div className="w-1/4 flex justify-end">
            {/* Mobile Share trigger could go here if needed */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerControls;