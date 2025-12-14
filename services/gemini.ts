import { GoogleGenAI } from "@google/genai";
import { Track } from '../types';

let aiClient: GoogleGenAI | null = null;

const getClient = () => {
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return aiClient;
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
    console.error("Gemini Error:", error);
    return "Connection to the grid lost. (Check API Key)";
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
    return { color: "#6366f1", description: "Unknown frequency detected." };
  }
};
