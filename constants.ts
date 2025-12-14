import { Track } from './types';

export const DEMO_TRACKS: Track[] = [
  {
    id: '1',
    title: 'Neon Dreams',
    artist: 'CyberSynth',
    url: 'https://cdn.pixabay.com/audio/2022/03/10/audio_c8c8a73467.mp3', // Synthwave track
    coverUrl: 'https://picsum.photos/id/10/200/200'
  },
  {
    id: '2',
    title: 'Deep Focus',
    artist: 'Lofi Labs',
    url: 'https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3', // Lofi track
    coverUrl: 'https://picsum.photos/id/20/200/200'
  },
  {
    id: '3',
    title: 'Space Voyager',
    artist: 'Stardust',
    url: 'https://cdn.pixabay.com/audio/2022/01/18/audio_d0a13f69d2.mp3', // Ambient
    coverUrl: 'https://picsum.photos/id/30/200/200'
  }
];

export const INITIAL_DJ_MESSAGE = "Welcome to NeonFlow. I'm your AI DJ. Drop a track or ask me to set the vibe!";
