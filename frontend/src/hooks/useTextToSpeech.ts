import { useState, useEffect, useCallback } from 'react';

export const useTextToSpeech = (text: string) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Initialize the speech synthesis utterance
  const [utterance, setUtterance] = useState<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    const u = new SpeechSynthesisUtterance(text);
    
    // Accessibility defaults: slightly slower pace helps with processing
    u.rate = 0.9; 
    u.pitch = 1;

    u.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };

    setUtterance(u);

    return () => {
      window.speechSynthesis.cancel();
    };
  }, [text]);

  const play = useCallback(() => {
    if (!utterance) return;
    
    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    } else {
      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
    }
  }, [utterance, isPaused]);

  const pause = useCallback(() => {
    window.speechSynthesis.pause();
    setIsPaused(true);
  }, []);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
  }, []);

  return { play, pause, stop, isSpeaking, isPaused };
};