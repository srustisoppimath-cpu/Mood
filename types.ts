
export interface Song {
  title: string;
  artist: string;
  language: string;
  rating?: number;
}

export interface Mood {
  name: string;
  emoji: string;
}

export interface HistoryItem {
  id: string;
  mood: Mood;
  songs: Song[];
  timestamp: number;
}

export enum View {
  Home,
  Camera,
  Results,
  History,
}