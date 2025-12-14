export interface Track {
  id: string;
  title: string;
  artist: string;
  url: string; // URL to audio file
  coverUrl?: string;
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

export interface AudioVisualizerData {
  analyser: AnalyserNode | null;
  dataArray: Uint8Array | null;
}
