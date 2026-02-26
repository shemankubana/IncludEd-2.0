import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, Star, ArrowRight, RotateCcw, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";

const words = [
  { word: "Amahoro", meaning: "Peace", phonics: "A · ma · ho · ro" },
  { word: "Igitabo", meaning: "Book", phonics: "I · gi · ta · bo" },
  { word: "Ishuri", meaning: "School", phonics: "I · shu · ri" },
  { word: "Umwana", meaning: "Child", phonics: "U · mwa · na" },
];

const DemoLessonSection = () => {
  const [currentWord, setCurrentWord] = useState(0);
  const [showMeaning, setShowMeaning] = useState(false);
  const [score, setScore] = useState(0);
  const [completed, setCompleted] = useState(false);

  const handleNext = () => {
    setScore((s) => s + 1);
    setShowMeaning(false);
    if (currentWord < words.length - 1) {
      setCurrentWord((c) => c + 1);
    } else {
      setCompleted(true);
    }
  };

  const handleReset = () => {
    setCurrentWord(0);
    setShowMeaning(false);
    setScore(0);
    setCompleted(false);
  };

  const progress = ((currentWord + (completed ? 1 : 0)) / words.length) * 100;

  return (
    <section className="py-28 bg-background relative">
      <div className="container mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="text-xs font-semibold text-accent uppercase tracking-widest mb-3">Interactive Demo</div>
            <h2 className="text-4xl lg:text-5xl font-bold text-foreground font-space tracking-tight mb-6">
              Try an{" "}
              <span className="text-gradient-cyan">adaptive lesson</span>
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed mb-8 max-w-md">
              Experience our Kinyarwanda phonics breakdown with syllable highlighting — a key feature for dyslexic learners.
              The full platform uses RL to adapt difficulty in real-time.
            </p>
            <div className="space-y-4">
              {[
                "Syllable-by-syllable breakdown for dyslexia",
                "RL-powered adaptive difficulty scaling",
                "Attention monitoring & micro-break triggers",
                "Gamified progress rewards for engagement",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <span className="text-sm text-secondary-foreground">{item}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            <div className="bg-card rounded-2xl border border-border p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex gap-1">
                  {Array.from({ length: words.length }).map((_, i) => (
                    <Star
                      key={i}
                      className={`w-5 h-5 transition-colors ${
                        i < score ? "text-amber fill-amber" : "text-border"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs text-muted-foreground font-mono">{Math.round(progress)}%</span>
              </div>

              <div className="h-1 bg-secondary rounded-full mb-8 overflow-hidden">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              <AnimatePresence mode="wait">
                {!completed ? (
                  <motion.div
                    key={currentWord}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div className="bg-secondary rounded-xl p-8 text-center">
                      <p className="text-xs text-muted-foreground mb-3 uppercase tracking-widest">Read this word</p>
                      <h3 className="text-5xl font-bold text-foreground font-space mb-3">
                        {words[currentWord].word}
                      </h3>
                      <p className="text-base text-primary font-space tracking-[0.3em]">
                        {words[currentWord].phonics}
                      </p>
                    </div>

                    <div className="flex justify-center">
                      <Button
                        variant="outline"
                        className="rounded-lg gap-2 border-border"
                        onClick={() => setShowMeaning(true)}
                      >
                        <Volume2 className="w-4 h-4" />
                        Reveal Meaning
                      </Button>
                    </div>

                    <AnimatePresence>
                      {showMeaning && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden space-y-4"
                        >
                          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center">
                            <span className="text-muted-foreground text-sm">English: </span>
                            <span className="font-bold text-foreground text-lg">{words[currentWord].meaning}</span>
                          </div>
                          <Button className="w-full rounded-lg gap-2 font-semibold" onClick={handleNext}>
                            Got It <ArrowRight className="w-4 h-4" />
                          </Button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-8 space-y-5"
                  >
                    <div className="w-16 h-16 bg-amber/10 rounded-2xl flex items-center justify-center mx-auto">
                      <Trophy className="w-8 h-8 text-amber" />
                    </div>
                    <h3 className="text-2xl font-bold text-foreground font-space">Mwiza! 🎉</h3>
                    <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                      All {words.length} words complete. The RL engine would now adapt
                      the next lesson based on your performance patterns.
                    </p>
                    <Button variant="outline" className="rounded-lg gap-2 border-border" onClick={handleReset}>
                      <RotateCcw className="w-4 h-4" /> Replay
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default DemoLessonSection;
