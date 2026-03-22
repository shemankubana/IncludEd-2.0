import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, X, Info, Sparkles } from "lucide-react";

interface PhonicsData {
  word: string;
  syllables: string[];
  phonics: string[];
  display: string;
  pronunciation: string;
}

interface PronunciationHelperProps {
  word: string;
  onClose: () => void;
  language?: string;
}

const PronunciationHelper: React.FC<PronunciationHelperProps> = ({
  word,
  onClose,
  language = "en",
}) => {
  const [data, setData] = useState<PhonicsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPhonics = async () => {
      setLoading(true);
      try {
        const resp = await fetch(`${import.meta.env.VITE_AI_URL || "http://localhost:8082"}/word/phonics`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ word }),
        });
        if (resp.ok) {
          const result = await resp.json();
          setData(result);
        }
      } catch (err) {
        console.error("Failed to fetch phonics:", err);
      } finally {
        setLoading(false);
      }
    };

    if (word) fetchPhonics();
  }, [word]);

  const [isSynthesizing, setIsSynthesizing] = useState(false);

  const speak = async () => {
    setIsSynthesizing(true);
    try {
      const resp = await fetch(`${import.meta.env.VITE_AI_URL || "http://localhost:8082"}/tts/synthesize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: word,
          language: language === "fr" ? "french" : "english",
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        const audio = new Audio(`data:audio/mp3;base64,${data.audio_base64}`);
        window.speechSynthesis?.cancel(); // Ensure robotic voice is stopped
        audio.play();
      } else {
        throw new Error("AI TTS failed");
      }
    } catch (err) {
      console.warn("AI TTS failed, falling back to local:", err);
      if (!window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(word);
      utter.rate = 0.8;
      if (language === "fr") utter.lang = "fr-FR";
      window.speechSynthesis.speak(utter);
    } finally {
      setIsSynthesizing(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 10 }}
      className="bg-card border border-primary/30 rounded-3xl p-5 shadow-2xl max-w-[280px] w-full"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-[10px] font-black uppercase tracking-widest text-primary">
            Pronunciation Helper
          </span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-secondary rounded-lg transition-colors">
          <X className="w-3 h-3 text-muted-foreground" />
        </button>
      </div>

      {loading ? (
        <div className="py-4 flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-[10px] text-muted-foreground font-bold">Breaking it down...</p>
        </div>
      ) : data ? (
        <div className="space-y-4">
          <div className="text-center">
            <h3 className="text-2xl font-black text-foreground mb-1">
              {data.word}
            </h3>
            <p className="text-sm font-bold text-primary tracking-wide">
              {data.display}
            </p>
          </div>

          <div className="bg-secondary/40 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">
                Phonics Guide
              </span>
              <span className="text-lg font-black text-foreground">
                {data.pronunciation}
              </span>
            </div>
            <button
              onClick={speak}
              className="p-3 bg-primary text-primary-foreground rounded-full shadow-lg shadow-primary/20 hover:scale-110 active:scale-95 transition-transform"
            >
              <Volume2 className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-start gap-2 text-[10px] text-muted-foreground bg-blue-50/50 p-3 rounded-xl border border-blue-100/50">
            <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <p className="leading-relaxed">
              Say it slowly, one part at a time. The bold parts are where you put the most energy!
            </p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-4">
          Could not break down this word.
        </p>
      )}
    </motion.div>
  );
};

export default PronunciationHelper;
