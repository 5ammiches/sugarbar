"use client";

import React, { createContext, useContext, useRef, useCallback, ReactNode } from "react";

interface SingleAudioContextType {
  requestPlay: (audioElement: HTMLAudioElement) => void;
  notifyPause: (audioElement: HTMLAudioElement) => void;
}

const SingleAudioContext = createContext<SingleAudioContextType | null>(null);

interface SingleAudioProviderProps {
  children: ReactNode;
}

export function SingleAudioProvider({ children }: SingleAudioProviderProps) {
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  const requestPlay = useCallback((audioElement: HTMLAudioElement) => {
    // Pause any currently playing audio
    if (currentAudioRef.current && currentAudioRef.current !== audioElement) {
      currentAudioRef.current.pause();
    }

    // Set this as the current audio
    currentAudioRef.current = audioElement;
  }, []);

  const notifyPause = useCallback((audioElement: HTMLAudioElement) => {
    // If this was the current audio, clear the reference
    if (currentAudioRef.current === audioElement) {
      currentAudioRef.current = null;
    }
  }, []);

  const contextValue: SingleAudioContextType = {
    requestPlay,
    notifyPause,
  };

  return <SingleAudioContext.Provider value={contextValue}>{children}</SingleAudioContext.Provider>;
}

export function useSingleAudio(): SingleAudioContextType {
  const context = useContext(SingleAudioContext);

  if (!context) {
    throw new Error("useSingleAudio must be used within a SingleAudioProvider");
  }

  return context;
}
