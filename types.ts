
export interface Song {
  title: string;
  artist: string;
  youtubeLink: string;
}

export type Mood = 'Happy' | 'Sad' | 'Energetic' | 'Calm' | 'Reflective' | 'Romantic' | 'Stressed' | 'Party' | 'Surprised' | 'Angry' | 'Anxious' | 'Loved' | 'Silly' | 'Tired' | 'Hopeful' | 'Proud' | 'Curious' | 'Festive';

export interface MoodOption {
  mood: Mood;
  emoji: string;
}