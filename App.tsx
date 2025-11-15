
import React, { useState, useCallback } from 'react';
import { Header } from './components/Header';
import { CameraView } from './components/CameraView';
import { MoodSelector } from './components/MoodSelector';
import { SongList } from './components/SongList';
import { Loader } from './components/Loader';
import { getSongsFromGemini } from './services/geminiService';
import type { Song, Mood } from './types';

type AppState = 'idle' | 'camera' | 'loading' | 'results' | 'error';

const CameraIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
);

export default function App() {
    const [appState, setAppState] = useState<AppState>('idle');
    const [songs, setSongs] = useState<Song[]>([]);
    const [currentMood, setCurrentMood] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string>('');

    const handleSongRequest = useCallback(async (mood: string | null, imageBase64: string | null) => {
        setAppState('loading');
        setSongs([]);
        setCurrentMood(mood || 'detected');
        try {
            const recommendedSongs = await getSongsFromGemini(mood, imageBase64);
            setSongs(recommendedSongs);
            setAppState('results');
        } catch (error) {
            const message = error instanceof Error ? error.message : "An unknown error occurred.";
            setErrorMessage(message);
            setAppState('error');
        }
    }, []);

    const handleCapture = (imageDataUrl: string) => {
        handleSongRequest(null, imageDataUrl);
    };

    const handleSelectMood = (mood: Mood) => {
        handleSongRequest(mood, null);
    };

    const reset = () => {
        setAppState('idle');
        setSongs([]);
        setCurrentMood(null);
        setErrorMessage('');
    };

    const renderContent = () => {
        switch (appState) {
            case 'camera':
                return <CameraView onCapture={handleCapture} onClose={() => setAppState('idle')} />;
            case 'loading':
                return <Loader message="Analyzing your mood..." />;
            case 'results':
                return (
                    <div className="w-full">
                        <SongList songs={songs} mood={currentMood} />
                        <div className="text-center mt-8">
                            <button onClick={reset} className="px-6 py-3 bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-white font-semibold rounded-full shadow-lg hover:scale-105 transform transition-transform duration-200">
                                Start Over
                            </button>
                        </div>
                    </div>
                );
            case 'error':
                 return (
                    <div className="w-full max-w-md mx-auto p-6 bg-red-900/50 backdrop-blur-sm rounded-2xl shadow-lg border border-red-700 text-center">
                        <h2 className="text-xl text-red-300 font-semibold mb-4">Oops! Something went wrong.</h2>
                        <p className="text-red-200 mb-6">{errorMessage}</p>
                         <button onClick={reset} className="px-6 py-3 bg-gray-600 text-white font-semibold rounded-full shadow-lg hover:bg-gray-700 transition-colors">
                            Try Again
                        </button>
                    </div>
                );
            case 'idle':
            default:
                return (
                    <div className="space-y-8 w-full flex flex-col items-center">
                        <button 
                            onClick={() => setAppState('camera')} 
                            className="group w-64 h-64 flex flex-col items-center justify-center bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-700 text-center transform transition-all duration-300 hover:border-cyan-500 hover:scale-105 hover:shadow-cyan-500/20"
                        >
                            <CameraIcon className="w-20 h-20 text-gray-400 transition-colors duration-300 group-hover:text-cyan-400" />
                            <span className="mt-4 text-xl text-white font-bold transition-colors duration-300 group-hover:text-cyan-300">
                                Scan Face Expression
                            </span>
                        </button>
                        <MoodSelector onSelectMood={handleSelectMood} />
                    </div>
                );
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white font-sans flex flex-col items-center p-4 bg-cover bg-center" style={{backgroundImage: 'linear-gradient(to bottom, rgba(17, 24, 39, 0.9), rgba(17, 24, 39, 1)), url(https://picsum.photos/1200/800?blur=10)'}}>
            <Header />
            <main className="flex-grow w-full flex items-center justify-center">
               {renderContent()}
            </main>
        </div>
    );
}