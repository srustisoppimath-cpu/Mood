import React, { useState, useCallback, useEffect } from 'react';
import type { Song, Mood, HistoryItem } from './types';
import { View } from './types';
import { getMusicRecommendations, detectMoodFromImage } from './services/geminiService';
import { MOODS } from './constants';
import MoodSelector from './components/MoodSelector';
import CameraDetector from './components/CameraDetector';
import SongList from './components/SongList';
import Loader from './components/Loader';
import { LogoIcon } from './components/icons/LogoIcon';
import HistoryList from './components/HistoryList';
import ThemeToggle from './components/ThemeToggle';

const HISTORY_STORAGE_KEY = 'moodMelodyHistory';
const RATINGS_STORAGE_KEY = 'moodMelodyRatings';
const THEME_STORAGE_KEY = 'moodMelodyTheme';

const getSongKey = (song: {title: string, artist: string}) => `${song.title.toLowerCase()}-${song.artist.toLowerCase()}`;

const getRatingsFromStorage = (): Record<string, number> => {
  try {
    const storedRatingsRaw = localStorage.getItem(RATINGS_STORAGE_KEY);
    return storedRatingsRaw ? JSON.parse(storedRatingsRaw) : {};
  } catch (e) {
    console.error("Failed to load ratings", e);
    return {};
  }
}

type Theme = 'light' | 'dark';

const App: React.FC = () => {
  const [view, setView] = useState<View>(View.Home);
  const [previousView, setPreviousView] = useState<View>(View.Home);
  const [mood, setMood] = useState<Mood | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(savedTheme || (prefersDark ? 'dark' : 'light'));
  }, []);

  useEffect(() => {
      const root = window.document.documentElement;
      if (theme === 'dark') {
          root.classList.add('dark');
      } else {
          root.classList.remove('dark');
      }
      localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  }, []);

  const enrichSongsWithRatings = useCallback((songsToEnrich: Song[]): Song[] => {
    const ratings = getRatingsFromStorage();
    return songsToEnrich.map(song => ({
      ...song,
      rating: ratings[getSongKey(song)] || 0,
    }));
  }, []);

  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (storedHistory) {
        let parsedHistory = JSON.parse(storedHistory) as HistoryItem[];
        parsedHistory = parsedHistory.map(item => ({
          ...item,
          songs: enrichSongsWithRatings(item.songs),
        }));
        parsedHistory.sort((a, b) => b.timestamp - a.timestamp);
        setHistory(parsedHistory);
      }
    } catch (e) {
      console.error("Failed to load or parse history from localStorage", e);
      setHistory([]);
    }
  }, [enrichSongsWithRatings]);

  const saveToHistory = useCallback((moodToSave: Mood, songsToSave: Song[]) => {
    setHistory(prevHistory => {
      const newHistoryItem: HistoryItem = {
        id: new Date().toISOString(),
        mood: moodToSave,
        songs: songsToSave, // Songs are already rated from the state
        timestamp: Date.now(),
      };
      const updatedHistory = [newHistoryItem, ...prevHistory.filter(item => item.id !== newHistoryItem.id)];
      try {
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updatedHistory));
      } catch (e) {
        console.error("Failed to save history to localStorage", e);
      }
      return updatedHistory;
    });
  }, []);
  
  const clearHistory = useCallback(() => {
    if (window.confirm("Are you sure you want to clear your entire mood history? This cannot be undone.")) {
      setHistory([]);
      try {
        localStorage.removeItem(HISTORY_STORAGE_KEY);
      } catch (e) {
        console.error("Failed to clear history from localStorage", e);
      }
    }
  }, []);

  const navigate = useCallback((newView: View) => {
    setPreviousView(view);
    setView(newView);
  }, [view]);

  const goBack = useCallback(() => {
    setView(previousView);
  }, [previousView]);

  const handleGetMusic = useCallback(async (detectedMoodName: string) => {
    setError(null);
    setLoadingMessage('Finding the perfect songs for your mood...');
    setIsLoading(true);

    const detectedMood = MOODS.find(m => m.name.toLowerCase() === detectedMoodName.toLowerCase().trim()) || { name: detectedMoodName, emoji: '🎵' };
    setMood(detectedMood);

    try {
      let recommendedSongs = await getMusicRecommendations(detectedMood.name);
      recommendedSongs = enrichSongsWithRatings(recommendedSongs);
      setSongs(recommendedSongs);
      saveToHistory(detectedMood, recommendedSongs);
      navigate(View.Results);
    } catch (err) {
      setError('Sorry, we couldn\'t generate a playlist. Please try again.');
      setView(View.Home);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [navigate, saveToHistory, enrichSongsWithRatings]);

  const handleMoodSelect = useCallback((selectedMood: Mood) => {
    handleGetMusic(selectedMood.name);
  }, [handleGetMusic]);

  const handleMoodDetect = useCallback(async (imageBase64: string) => {
    setError(null);
    setLoadingMessage('Analyzing your mood...');
    setIsLoading(true);
    setView(View.Home); // Show loader on home screen

    try {
      const detectedMoodName = await detectMoodFromImage(imageBase64);
      if (detectedMoodName) {
        await handleGetMusic(detectedMoodName);
      } else {
        throw new Error('Mood detection failed.');
      }
    } catch (err) {
      setError('Could not detect mood from the image. Please try again.');
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [handleGetMusic]);
  
  const handleHistorySelect = useCallback((item: HistoryItem) => {
    setMood(item.mood);
    setSongs(enrichSongsWithRatings(item.songs));
    navigate(View.Results);
  }, [navigate, enrichSongsWithRatings]);

  const handleRateSong = useCallback((songToRate: Song, rating: number) => {
    const key = getSongKey(songToRate);
    const ratings = getRatingsFromStorage();
    if (rating === 0) {
      delete ratings[key];
    } else {
      ratings[key] = rating;
    }
    localStorage.setItem(RATINGS_STORAGE_KEY, JSON.stringify(ratings));

    const updatedSongs = songs.map(s => 
      getSongKey(s) === key ? { ...s, rating } : s
    );
    setSongs(updatedSongs);
    
    // Also update history with the new rating
    setHistory(prevHistory => {
        const updatedHistory = prevHistory.map(item => ({
            ...item,
            songs: item.songs.map(s => getSongKey(s) === key ? { ...s, rating } : s)
        }));
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updatedHistory));
        return updatedHistory;
    });
  }, [songs]);

  const renderContent = () => {
    if (isLoading) {
      return <Loader message={loadingMessage} />;
    }

    switch (view) {
      case View.Camera:
        return <CameraDetector onCapture={handleMoodDetect} onBack={() => setView(View.Home)} />;
      case View.Results:
        const backButtonText = previousView === View.History ? "Back to History" : "Back to Moods";
        return mood && <SongList mood={mood} songs={songs} onBack={goBack} backButtonText={backButtonText} onRateSong={handleRateSong} />;
      case View.History:
        return <HistoryList history={history} onSelect={handleHistorySelect} onBack={() => setView(View.Home)} onClearHistory={clearHistory} />;
      case View.Home:
      default:
        return (
          <MoodSelector 
            onMoodSelect={handleMoodSelect} 
            onOpenCamera={() => navigate(View.Camera)}
            onOpenHistory={() => navigate(View.History)}
            error={error}
          />
        );
    }
  };
  
  const appClasses = `min-h-screen bg-gray-50 dark:bg-gradient-to-br dark:from-slate-900 dark:via-purple-900 dark:to-slate-900 text-slate-800 dark:text-white flex flex-col items-center justify-center p-4 font-sans transition-colors duration-500 ${theme === 'dark' ? 'animated-gradient' : ''}`

  return (
    <div className={appClasses}>
      <div className="w-full max-w-2xl mx-auto">
        <header className="mb-8">
            <div className="relative text-center flex flex-col items-center">
                <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
                <LogoIcon />
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-pink-500 mt-2">
                MoodMelody AI
                </h1>
                <p className="text-lg text-gray-500 dark:text-purple-200 mt-2 font-light tracking-wide">Your Personal AI Music Sommelier</p>
            </div>
        </header>
        <main className="w-full bg-white/60 dark:bg-black/40 backdrop-blur-xl rounded-2xl shadow-2xl p-6 md:p-8 border border-purple-200 dark:border-purple-500/30">
          {renderContent()}
        </main>
        <footer className="text-center mt-8">
            <p className="text-sm text-purple-600/60 dark:text-purple-400/60">Powered by Gemini</p>
        </footer>
      </div>
    </div>
  );
};

export default App;