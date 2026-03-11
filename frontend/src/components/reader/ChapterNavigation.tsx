import React, { useRef } from "react";
import { motion } from "framer-motion";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Section {
  title: string;
  [key: string]: any;
}

interface ChapterNavigationProps {
  sections: Section[];
  currentIndex: number;
  onSelect: (index: number) => void;
}

const ChapterNavigation: React.FC<ChapterNavigationProps> = ({
  sections,
  currentIndex,
  onSelect,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollTo = direction === "left" ? scrollLeft - 200 : scrollLeft + 200;
      scrollRef.current.scrollTo({ left: scrollTo, behavior: "smooth" });
    }
  };

  return (
    <div className="relative group w-full bg-card/40 backdrop-blur-sm border-b border-border/50 py-2">
      {/* Scroll Left Button */}
      <button
        onClick={() => scroll("left")}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-1 bg-background/80 rounded-r-lg border border-l-0 border-border opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <ChevronLeft className="w-4 h-4 text-muted-foreground" />
      </button>

      {/* Chapters Scroll Area */}
      <div
        ref={scrollRef}
        className="flex gap-2 px-8 overflow-x-auto no-scrollbar scroll-smooth"
      >
        {sections.map((section, idx) => {
          const isActive = currentIndex === idx;
          // Simple cleaning for short labels like "Chapter 1"
          const label = section.title.length > 20 ? section.title.slice(0, 17) + "..." : section.title;

          return (
            <motion.button
              key={idx}
              whileTap={{ scale: 0.95 }}
              onClick={() => onSelect(idx)}
              className={`whitespace-nowrap px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                  : "bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              {label}
            </motion.button>
          );
        })}
      </div>

      {/* Scroll Right Button */}
      <button
        onClick={() => scroll("right")}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-1 bg-background/80 rounded-l-lg border border-r-0 border-border opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </button>

      {/* Styles for hiding scrollbar */}
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default ChapterNavigation;
