import React, { useEffect, useRef } from 'react';

declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    YT: any;
  }
}

interface YouTubeAudioPlayerProps {
  videoId: string;
  isPlaying: boolean;
  volume: number;
  seekTo: number | null; // Timestamp to seek to, or null
  onProgress: (currentTime: number, duration: number) => void;
  onEnded: () => void;
  onReady?: () => void;
}

const YouTubeAudioPlayer: React.FC<YouTubeAudioPlayerProps> = ({
  videoId,
  isPlaying,
  volume,
  seekTo,
  onProgress,
  onEnded,
  onReady
}) => {
  const playerRef = useRef<any>(null);
  const containerId = useRef(`youtube-player-${Math.random().toString(36).substr(2, 9)}`);
  const progressInterval = useRef<number | null>(null);

  // Initialize YouTube API
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = initializePlayer;
    } else {
      initializePlayer();
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
      }
      if (progressInterval.current) {
        window.clearInterval(progressInterval.current);
      }
    };
  }, []);

  // Handle Video ID changes
  useEffect(() => {
    if (playerRef.current && playerRef.current.loadVideoById && videoId) {
      playerRef.current.loadVideoById(videoId);
    }
  }, [videoId]);

  // Handle Play/Pause
  useEffect(() => {
    if (playerRef.current && playerRef.current.getPlayerState) {
      const state = playerRef.current.getPlayerState();
      if (isPlaying && state !== 1 && state !== 3) {
        playerRef.current.playVideo();
      } else if (!isPlaying && state === 1) {
        playerRef.current.pauseVideo();
      }
    }
  }, [isPlaying]);

  // Handle Volume
  useEffect(() => {
    if (playerRef.current && playerRef.current.setVolume) {
      playerRef.current.setVolume(volume * 100);
    }
  }, [volume]);

  // Handle Seek
  useEffect(() => {
    if (seekTo !== null && playerRef.current && playerRef.current.seekTo) {
      playerRef.current.seekTo(seekTo, true);
    }
  }, [seekTo]);

  const initializePlayer = () => {
    if (playerRef.current) return; // Already initialized

    window.YT.ready(() => {
      playerRef.current = new window.YT.Player(containerId.current, {
        height: '0',
        width: '0',
        videoId: videoId,
        playerVars: {
          autoplay: isPlaying ? 1 : 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
        },
        events: {
          onReady: (event: any) => {
             event.target.setVolume(volume * 100);
             if(onReady) onReady();
             startProgressTracker();
          },
          onStateChange: (event: any) => {
             // 0 = ended
             if (event.data === 0) {
               onEnded();
             }
          }
        }
      });
    });
  };

  const startProgressTracker = () => {
    if (progressInterval.current) clearInterval(progressInterval.current);
    
    progressInterval.current = window.setInterval(() => {
      if (playerRef.current && playerRef.current.getCurrentTime) {
        const current = playerRef.current.getCurrentTime();
        const duration = playerRef.current.getDuration();
        onProgress(current, duration);
      }
    }, 1000); // Update every second
  };

  return (
    <div 
      id={containerId.current} 
      style={{ position: 'absolute', top: -9999, left: -9999, visibility: 'hidden' }}
    />
  );
};

export default YouTubeAudioPlayer;