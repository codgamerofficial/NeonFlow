import { Track } from '../types';

const API_KEY = process.env.YOUTUBE_API_KEY; 
const API_URL = 'https://www.googleapis.com/youtube/v3/search';

// Mock data to ensure functionality without an API Key
const MOCK_RESULTS: Track[] = [
  {
    id: 'yt-1',
    title: 'Midnight City',
    artist: 'M83',
    url: '',
    youtubeId: 'dX3k_QDnzHE',
    coverUrl: 'https://i.ytimg.com/vi/dX3k_QDnzHE/hqdefault.jpg',
    status: 'ready'
  },
  {
    id: 'yt-2',
    title: 'Starboy',
    artist: 'The Weeknd',
    url: '',
    youtubeId: '34Na4j8AVgA',
    coverUrl: 'https://i.ytimg.com/vi/34Na4j8AVgA/hqdefault.jpg',
    status: 'ready'
  },
  {
    id: 'yt-3',
    title: 'Resonance',
    artist: 'Home',
    url: '',
    youtubeId: '8GW6sLrK40k',
    coverUrl: 'https://i.ytimg.com/vi/8GW6sLrK40k/hqdefault.jpg',
    status: 'ready'
  },
  {
    id: 'yt-4',
    title: 'After Dark',
    artist: 'Mr. Kitty',
    url: '',
    youtubeId: 's51VEr1Utso',
    coverUrl: 'https://i.ytimg.com/vi/s51VEr1Utso/hqdefault.jpg',
    status: 'ready'
  },
  {
    id: 'yt-5',
    title: 'Lofi Hip Hop Radio',
    artist: 'Lofi Girl',
    url: '',
    youtubeId: 'jfKfPfyJRdk',
    coverUrl: 'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg',
    status: 'ready'
  }
];

export const searchYouTube = async (query: string): Promise<Track[]> => {
  if (!query) return [];

  // Use Mock if no API Key provided or for specific "demo" query
  if (!API_KEY || query.toLowerCase() === 'demo') {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500));
      return MOCK_RESULTS.filter(t => 
        t.title.toLowerCase().includes(query.toLowerCase()) || 
        t.artist.toLowerCase().includes(query.toLowerCase()) ||
        query.toLowerCase() === 'demo'
      );
  }

  try {
    const response = await fetch(`${API_URL}?part=snippet&maxResults=10&q=${encodeURIComponent(query)}&type=video&videoCategoryId=10&key=${API_KEY}`);
    
    if (!response.ok) {
        throw new Error('YouTube API Error');
    }

    const data = await response.json();
    
    return data.items.map((item: any) => ({
      id: `yt-${item.id.videoId}`,
      title: item.snippet.title,
      artist: item.snippet.channelTitle,
      url: '',
      youtubeId: item.id.videoId,
      coverUrl: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
      status: 'ready'
    }));

  } catch (error) {
    console.warn("YouTube Search Failed (likely quota or missing key), using fallback.", error);
    // Return mock results that match query vaguely to keep UI useful
    return MOCK_RESULTS; 
  }
};