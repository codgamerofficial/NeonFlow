import React, { useState, useEffect } from 'react';
import { Mic2, Edit3, Save, RotateCcw } from 'lucide-react';

interface LyricsPanelProps {
  lyrics: string;
  loading: boolean;
  onUpdateLyrics: (newLyrics: string) => void;
  trackTitle: string;
}

const LyricsPanel: React.FC<LyricsPanelProps> = ({ lyrics, loading, onUpdateLyrics, trackTitle }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedLyrics, setEditedLyrics] = useState(lyrics);

  // Sync local state when prop changes, unless currently editing
  useEffect(() => {
    if (!isEditing) {
      setEditedLyrics(lyrics);
    }
  }, [lyrics, isEditing]);

  const handleSave = () => {
    onUpdateLyrics(editedLyrics);
    setIsEditing(false);
  };

  return (
    <div className="flex flex-col h-full bg-black/40 backdrop-blur-md border-l border-white/10">
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mic2 className="text-pink-500" size={20} />
          <h2 className="font-bold text-white tracking-wider text-sm">LYRICS</h2>
        </div>
        {!loading && (
          <button 
            onClick={() => setIsEditing(!isEditing)}
            className="text-gray-400 hover:text-white transition-colors"
            title={isEditing ? "Cancel" : "Edit Lyrics"}
          >
             {isEditing ? <RotateCcw size={16} /> : <Edit3 size={16} />}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 relative">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full space-y-4 text-gray-500">
            <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs tracking-widest uppercase animate-pulse">Fetching Lyrics...</span>
          </div>
        ) : isEditing ? (
          <div className="h-full flex flex-col">
             <textarea 
               value={editedLyrics}
               onChange={(e) => setEditedLyrics(e.target.value)}
               className="flex-1 bg-white/5 border border-white/10 rounded-lg p-4 text-sm text-gray-200 focus:outline-none focus:border-pink-500 resize-none font-mono leading-relaxed"
               placeholder="Enter lyrics here..."
             />
             <button 
               onClick={handleSave}
               className="mt-4 flex items-center justify-center gap-2 w-full py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-lg transition-colors text-sm font-bold"
             >
               <Save size={16} /> Save Lyrics
             </button>
          </div>
        ) : (
          <div className="text-center">
            {lyrics ? (
              <p className="whitespace-pre-wrap text-gray-200 leading-8 font-medium text-sm md:text-base">
                {lyrics}
              </p>
            ) : (
              <div className="flex flex-col items-center justify-center pt-20 text-gray-500 gap-4">
                 <p className="italic">Lyrics not found in the grid.</p>
                 <button 
                   onClick={() => setIsEditing(true)}
                   className="px-4 py-2 border border-gray-600 rounded-full hover:border-pink-500 hover:text-pink-400 transition-colors text-xs"
                 >
                   Add Lyrics Manually
                 </button>
              </div>
            )}
            
            {lyrics && (
               <div className="mt-12 mb-4 text-xs text-gray-600 uppercase tracking-widest">
                  End of "{trackTitle}"
               </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LyricsPanel;
