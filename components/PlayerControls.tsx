import React from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2 } from 'lucide-react';

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
}

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
  trackArtist
}) => {
  return (
    <div className="w-full max-w-3xl mx-auto bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl">
      <div className="flex flex-col gap-4">
        {/* Track Info (Mobile mostly, or compact mode) */}
        <div className="text-center">
           <h3 className="text-white font-bold text-lg tracking-wide">{trackTitle || "No Track Selected"}</h3>
           <p className="text-gray-400 text-sm">{trackArtist || "Select a track to begin"}</p>
        </div>

        {/* Progress Bar */}
        <div className="flex items-center gap-3 text-xs text-gray-400 font-mono">
          <span>{formatTime(currentTime)}</span>
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={onSeek}
            className="flex-1 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-white hover:accent-cyan-400 transition-all"
          />
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

          <div className="flex items-center gap-6">
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
            {/* Placeholder for future buttons like shuffle/repeat */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerControls;
