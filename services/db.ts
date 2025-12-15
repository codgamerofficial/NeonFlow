import { Track } from '../types';

const DB_NAME = 'NeonFlowDB';
const DB_VERSION = 1;
const STORE_NAME = 'tracks';

let db: IDBDatabase;

// This interface represents the object stored in IndexedDB
interface StoredTrack {
  id: string;
  title: string;
  artist: string;
  coverUrl?: string;
  isLocal: boolean;
  file: File; // The actual audio file blob
}

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      return resolve(db);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('IndexedDB error:', request.error);
      reject('Error opening DB');
    };

    request.onsuccess = (event) => {
      db = request.result;
      console.log('Database opened successfully');
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const dbInstance = (event.target as IDBOpenDBRequest).result;
      if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
        dbInstance.createObjectStore(STORE_NAME, { keyPath: 'id' });
        console.log('Object store created');
      }
    };
  });
};

export const saveTrack = (trackData: Omit<Track, 'url' | 'status'>, file: File): Promise<string> => {
  return new Promise(async (resolve, reject) => {
    const dbInstance = await initDB();
    const transaction = dbInstance.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const storedObject: StoredTrack = { ...trackData, file, isLocal: true };
    
    const request = store.put(storedObject);

    request.onsuccess = () => {
      resolve(request.result as string);
    };

    request.onerror = () => {
      console.error('Error saving track:', request.error);
      reject(request.error);
    };
  });
};

export const getAllTracks = (): Promise<Track[]> => {
  return new Promise(async (resolve, reject) => {
    const dbInstance = await initDB();
    const transaction = dbInstance.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const storedTracks: StoredTrack[] = request.result;
      const tracks: Track[] = storedTracks.map(st => ({
        id: st.id,
        title: st.title,
        artist: st.artist,
        coverUrl: st.coverUrl,
        isLocal: st.isLocal,
        url: URL.createObjectURL(st.file), // Create a blob URL for playback
        status: 'ready'
      }));
      resolve(tracks);
    };

    request.onerror = () => {
      console.error('Error fetching tracks:', request.error);
      reject(request.error);
    };
  });
};

export const deleteTrackFromDB = (id: string): Promise<void> => {
    return new Promise(async (resolve, reject) => {
        const dbInstance = await initDB();
        const transaction = dbInstance.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => {
            resolve();
        };

        request.onerror = () => {
            console.error('Error deleting track:', request.error);
            reject(request.error);
        };
    });
};