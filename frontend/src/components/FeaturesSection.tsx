import { motion } from "framer-motion";
import { WifiOff, Brain, DollarSign, BarChart3, Globe, Cpu } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "@/i18n";

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

const features = [
  {
    icon: Cpu,
    key: "f1",
    accentColor: "text-primary",
    iconBg: "bg-primary/10",
    span: "md:col-span-2",
    delay: 0,
  },
  {
    icon: Brain,
    key: "f2",
    accentColor: "text-accent",
    iconBg: "bg-accent/10",
    delay: 0.1,
  },
  {
    icon: WifiOff,
    key: "f3",
    accentColor: "text-amber",
    iconBg: "bg-amber/10",
    delay: 0.2,
  },
  {
    icon: BarChart3,
    key: "f4",
    accentColor: "text-primary",
    iconBg: "bg-primary/10",
    delay: 0.3,
  },
  {
    icon: Globe,
    key: "f5",
    accentColor: "text-accent",
    iconBg: "bg-accent/10",
    span: "md:col-span-2",
    delay: 0.4,
  },
];

const FeaturesSection = () => {
  const { t } = useTranslation();

  return (
    <section className="py-28 bg-background relative">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">{t("landing.features.tag")}</div>
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground font-space tracking-tight max-w-xl">
            {t("landing.features.title_1")}
            <span className="text-gradient-cyan">{t("landing.features.title_2")}</span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-4">
          {features.map((feature) => (
            <motion.div
              key={feature.key}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: feature.delay }}
              className={feature.span || ""}
            >
              <FeatureCard 
                icon={feature.icon}
                accentColor={feature.accentColor}
                iconBg={feature.iconBg}
                span={feature.span}
                title={t(`landing.features.items.${feature.key}_title`)}
                description={t(`landing.features.items.${feature.key}_desc`)}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
