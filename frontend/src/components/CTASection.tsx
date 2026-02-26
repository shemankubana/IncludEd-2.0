import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const CTASection = () => {
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
            Inclusive education{" "}
            <span className="text-gradient-lime">starts here.</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-lg mx-auto">
            Join our pilot programme across Kigali & Gasabo District schools.
            Free for up to 100 students. No internet required.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/auth">
              <Button size="lg" className="rounded-lg text-base px-8 gap-2 font-semibold">
                Start Free Pilot <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Button variant="outline" size="lg" className="rounded-lg text-base px-8 border-border hover:bg-secondary">
              Talk to Our Team
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Aligned with Rwanda's Competence-Based Curriculum · Dyslexia & ADHD focused · Data stored in Rwanda (DPL compliant)
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default CTASection;
