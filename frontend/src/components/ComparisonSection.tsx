import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { useTranslation } from "@/i18n";

const comparisons = [
  { key: "c1", ours: true, lexia: false, kurzweil: false },
  { key: "c2", ours: true, lexia: false, kurzweil: false },
  { key: "c3", ours: true, lexia: false, kurzweil: false },
  { key: "c4", ours: true, lexia: false, kurzweil: false },
  { key: "c5", ours: true, lexia: false, kurzweil: false },
  { key: "c6", ours: true, lexia: true, kurzweil: false },
  { key: "c7", ours: true, lexia: false, kurzweil: false },
  { key: "c8", ours: true, lexia: false, kurzweil: false },
  { key: "c9", ours: true, lexia: true, kurzweil: true },
  { key: "c10", ours: true, lexia: false, kurzweil: true },
];

const Icon = ({ yes }: { yes: boolean }) => (
  <div className={`w-7 h-7 ${yes ? "bg-primary/10" : "bg-destructive/10"} rounded-lg flex items-center justify-center`}>
    {yes ? <Check className="w-4 h-4 text-primary" /> : <X className="w-4 h-4 text-destructive" />}
  </div>
);

const ComparisonSection = () => {
  const { t } = useTranslation();

  return (
    <section className="py-28 bg-background">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">{t("landing.comparison.tag")}</div>
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground font-space tracking-tight">
            {t("landing.comparison.title_1")}
            <span className="text-muted-foreground">{t("landing.comparison.title_2")}</span>
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
              <span className="text-sm font-semibold text-muted-foreground">{t("landing.comparison.col_feature")}</span>
              <span className="text-sm font-bold text-primary text-center">{t("landing.comparison.col_ours")}</span>
              <span className="text-sm font-semibold text-muted-foreground text-center">{t("landing.comparison.col_lexia")}</span>
              <span className="text-sm font-semibold text-muted-foreground text-center">{t("landing.comparison.col_kurz")}</span>
            </div>

            {comparisons.map((row, i) => (
              <div
                key={row.key}
                className={`grid grid-cols-[1fr_90px_90px_100px] p-5 items-center ${
                  i < comparisons.length - 1 ? "border-b border-border" : ""
                }`}
              >
                <span className="text-sm text-foreground">{t(`landing.comparison.rows.${row.key}`)}</span>
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
