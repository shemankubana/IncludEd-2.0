import { motion } from "framer-motion";
import { Check, X } from "lucide-react";

const comparisons = [
  { feature: "Offline-first PWA", ours: true, lexia: false, kurzweil: false },
  { feature: "ADHD attention monitoring", ours: true, lexia: false, kurzweil: false },
  { feature: "Dyslexia-specific RL adaptation", ours: true, lexia: false, kurzweil: false },
  { feature: "Under $5/student/year", ours: true, lexia: false, kurzweil: false },
  { feature: "Kinyarwanda & French support", ours: true, lexia: false, kurzweil: false },
  { feature: "Teacher analytics dashboard", ours: true, lexia: true, kurzweil: false },
  { feature: "Parent progress reports", ours: true, lexia: false, kurzweil: false },
  { feature: "Adaptive difficulty (RL)", ours: true, lexia: false, kurzweil: false },
  { feature: "Structured phonics", ours: true, lexia: true, kurzweil: true },
  { feature: "Text-to-speech", ours: true, lexia: false, kurzweil: true },
];

const Icon = ({ yes }: { yes: boolean }) => (
  <div className={`w-7 h-7 ${yes ? "bg-primary/10" : "bg-destructive/10"} rounded-lg flex items-center justify-center`}>
    {yes ? <Check className="w-4 h-4 text-primary" /> : <X className="w-4 h-4 text-destructive" />}
  </div>
);

const ComparisonSection = () => {
  return (
    <section className="py-28 bg-background">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">Comparison</div>
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground font-space tracking-tight">
            IncludEd vs{" "}
            <span className="text-muted-foreground">Existing Solutions</span>
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="overflow-x-auto"
        >
          <div className="bg-card rounded-2xl border border-border overflow-hidden min-w-[600px]">
            <div className="grid grid-cols-[1fr_90px_90px_100px] p-5 border-b border-border">
              <span className="text-sm font-semibold text-muted-foreground">Feature</span>
              <span className="text-sm font-bold text-primary text-center">IncludEd</span>
              <span className="text-sm font-semibold text-muted-foreground text-center">Lexia</span>
              <span className="text-sm font-semibold text-muted-foreground text-center">Kurzweil</span>
            </div>

            {comparisons.map((row, i) => (
              <div
                key={row.feature}
                className={`grid grid-cols-[1fr_90px_90px_100px] p-5 items-center ${
                  i < comparisons.length - 1 ? "border-b border-border" : ""
                }`}
              >
                <span className="text-sm text-foreground">{row.feature}</span>
                <div className="flex justify-center"><Icon yes={row.ours} /></div>
                <div className="flex justify-center"><Icon yes={row.lexia} /></div>
                <div className="flex justify-center"><Icon yes={row.kurzweil} /></div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default ComparisonSection;
