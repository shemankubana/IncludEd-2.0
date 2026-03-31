import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useTranslation } from "@/i18n";

const CTASection = () => {
  const { t } = useTranslation();
  return (
    <section className="py-28 bg-background relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-primary/5 blur-[120px] rounded-full" />

      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto text-center space-y-8"
        >
          <h2 className="text-4xl lg:text-6xl font-bold text-foreground font-space tracking-tight">
            {t("landing.cta.title_1")}
            <span className="text-gradient-lime">{t("landing.cta.title_2")}</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-lg mx-auto">
            {t("landing.cta.subtitle")}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/auth">
              <Button size="lg" className="rounded-lg text-base px-8 gap-2 font-semibold">
                {t("landing.cta.start")} <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Button variant="outline" size="lg" className="rounded-lg text-base px-8 border-border hover:bg-secondary">
              {t("landing.cta.talk")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("landing.cta.footer")}
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default CTASection;
