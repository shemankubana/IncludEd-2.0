import { motion } from "framer-motion";
import { WifiOff, Brain, DollarSign, BarChart3, Globe, Cpu } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  accentColor: string;
  iconBg: string;
  span?: string;
}

const FeatureCard = ({ icon: Icon, title, description, accentColor, iconBg, span }: FeatureCardProps) => (
  <div className={`group relative bg-card rounded-2xl p-7 border border-border hover:border-primary/30 transition-all duration-300 ${span || ""}`}>
    <div className={`w-11 h-11 ${iconBg} rounded-xl flex items-center justify-center mb-5`}>
      <Icon className={`w-5 h-5 ${accentColor}`} />
    </div>
    <h3 className="text-lg font-bold text-foreground font-space mb-2">{title}</h3>
    <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
  </div>
);

const features: (FeatureCardProps & { delay: number })[] = [
  {
    icon: Cpu,
    title: "Reinforcement Learning Engine",
    description: "PPO/DQN algorithms continuously learn from student interactions, optimising content delivery and pacing for each learner in real-time.",
    accentColor: "text-primary",
    iconBg: "bg-primary/10",
    span: "md:col-span-2",
    delay: 0,
  },
  {
    icon: Brain,
    title: "Dyslexia & ADHD Support",
    description: "Adaptive micro-breaks, syllable highlighting, attention monitoring via mouse/keyboard telemetry — no cameras needed.",
    accentColor: "text-accent",
    iconBg: "bg-accent/10",
    delay: 0.1,
  },
  {
    icon: WifiOff,
    title: "Offline-First PWA",
    description: "Full lessons cached locally with Service Workers. Auto-syncs progress when connectivity returns. Zero internet dependency.",
    accentColor: "text-amber",
    iconBg: "bg-amber/10",
    delay: 0.2,
  },
  {
    icon: BarChart3,
    title: "Teacher & Parent Dashboards",
    description: "Real-time analytics per student. Identify struggles early, track class-wide progress, and share reports with parents.",
    accentColor: "text-primary",
    iconBg: "bg-primary/10",
    delay: 0.3,
  },
  {
    icon: Globe,
    title: "Multilingual: Kinyarwanda, French & English",
    description: "Content aligned with Rwanda's Competence-Based Curriculum. Culturally relevant stories for P3–P6 students.",
    accentColor: "text-accent",
    iconBg: "bg-accent/10",
    span: "md:col-span-2",
    delay: 0.4,
  },
];

const FeaturesSection = () => {
  return (
    <section className="py-28 bg-background relative">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">Why IncludEd</div>
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground font-space tracking-tight max-w-xl">
            Built for inclusion.{" "}
            <span className="text-gradient-cyan">Built for Rwanda.</span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-4">
          {features.map((feature) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: feature.delay }}
              className={feature.span || ""}
            >
              <FeatureCard {...feature} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
