import { GoogleGenAI } from "@google/genai";
import { Track } from '../types';

let aiClient: GoogleGenAI | null = null;

const getClient = () => {
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return aiClient;
};

// Helper to identify quota/rate limit errors
const isQuotaError = (error: any): boolean => {
  const msg = error?.message || JSON.stringify(error);
  const status = error?.status;
  const code = error?.error?.code;
  return (
    status === 429 || 
    code === 429 || 
    msg.includes('429') || 
    msg.includes('quota') || 
    msg.includes('RESOURCE_EXHAUSTED')
  );
};

export const generateDJResponse = async (userMessage: string, currentTrack?: Track): Promise<string> => {
  try {
    const ai = getClient();
    const trackInfo = currentTrack 
      ? `Currently playing: "${currentTrack.title}" by ${currentTrack.artist}.` 
      : "No music playing right now.";

    const systemPrompt = `
      You are NeonFlow's holographic AI DJ. 
      Your personality is cool, futuristic, and enthusiastic about music.
      Keep responses concise (max 2 sentences) and conversational.
      Context: User is using a 3D web music player. ${trackInfo}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: userMessage,
      config: {
        systemInstruction: systemPrompt,
      }
    });

    return response.text || "I'm vibing too hard to answer right now.";
  } catch (error) {
    if (isQuotaError(error)) {
      console.warn("Gemini Quota Exceeded (DJ)");
      return "I'm currently recharging my neural networks (Quota Exceeded). Catch you later!";
    }
    console.error("Gemini Error:", error);
    return "Connection to the grid lost.";
  }
};

export const analyzeTrackVibe = async (track: Track): Promise<{ color: string, description: string }> => {
  try {
    const ai = getClient();
    const prompt = `Analyze the song title "${track.title}" by "${track.artist}". 
    1. Pick a hex color code that matches its mood.
    2. Write a super short, 1-sentence poetic description of the vibe.
    Return JSON only: { "color": "#hex", "description": "text" }`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const json = JSON.parse(response.text || '{}');
    return {
      color: json.color || "#6366f1",
      description: json.description || "A mystery track from the void."
    };
  } catch (error) {
    if (isQuotaError(error)) {
      console.warn("Gemini Quota Exceeded (Vibe Analysis)");
      // Fallback to a pseudo-random color based on the title length to keep the UI dynamic
      const colors = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];
      const fallbackColor = colors[(track.title.length + track.artist.length) % colors.length];
      return { 
        color: fallbackColor, 
        description: "Vibe analysis offline (Quota Limit)." 
      };
    }
    return { color: "#6366f1", description: "Unknown frequency detected." };
  }
};

export const fetchLyrics = async (track: Track): Promise<string> => {
  try {
    const ai = getClient();
    const prompt = `Fetch the lyrics for the song "${track.title}" by "${track.artist}".
    If the lyrics are not publicly known or it is an instrumental, generate a creative, abstract poem that fits the vibe of the song title.
    Do not include any intro text (e.g., "Here are the lyrics"). Just output the lyrics/poem directly.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "";
  } catch (error) {
    if (isQuotaError(error)) {
      console.warn("Gemini Quota Exceeded (Lyrics)");
      return "Lyrics unavailable: API Quota Limit Exceeded.\n\nPlease try again later or manually add lyrics.";
    }
    console.error("Lyrics Fetch Error:", error);
    return ""; // Return empty to trigger manual input or empty state
  }
};