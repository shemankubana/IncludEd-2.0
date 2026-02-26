import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import heroChild from "@/assets/hero-child.jpg";

const HeroSection = () => {
  return (
    <section className="relative min-h-screen bg-background bg-grid overflow-hidden pt-16">
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px]" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-accent/5 blur-[100px]" />

      <div className="container mx-auto px-6 py-24 lg:py-32 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-8"
          >
            <div className="inline-flex items-center gap-2 border border-primary/30 bg-primary/5 px-4 py-1.5 rounded-full">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-semibold text-primary tracking-wide uppercase">RL-Powered Adaptive Learning</span>
            </div>

            <h1 className="text-5xl lg:text-7xl font-bold leading-[0.95] tracking-tight">
              <span className="text-foreground">Inclusive</span>
              <br />
              <span className="text-gradient-lime">education</span>
              <br />
              <span className="text-foreground">for every learner</span>
            </h1>

            <p className="text-lg text-muted-foreground max-w-md leading-relaxed">
              An AI-powered adaptive platform for students with dyslexia & ADHD in Rwanda.
              Offline-first, multilingual, and built for classrooms that need it most.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link to="/auth">
                <Button size="lg" className="rounded-lg text-base px-7 gap-2 font-semibold">
                  Get Started <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Button variant="outline" size="lg" className="rounded-lg text-base px-7 border-border hover:bg-secondary">
                Watch Demo
              </Button>
            </div>

            <div className="flex gap-10 pt-4">
              {[
                { value: "< $5", label: "per student/year", color: "text-primary" },
                { value: "100%", label: "offline capable", color: "text-accent" },
                { value: "P3–P6", label: "grade levels", color: "text-amber" },
              ].map((stat) => (
                <div key={stat.label}>
                  <div className={`text-3xl font-bold font-space ${stat.color}`}>{stat.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            <div className="relative rounded-2xl overflow-hidden border-glow glow-lime">
              <img
                src={heroChild}
                alt="Student with learning disability using adaptive tablet platform"
                className="w-full h-auto object-cover"
              />
              <div className="absolute bottom-6 left-6 right-6 bg-card/80 backdrop-blur-md rounded-xl p-4 border border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground">Adaptive Session</div>
                    <div className="text-sm font-semibold text-foreground">Kinyarwanda Phonics — Level 3</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <span className="text-xs text-primary font-medium">Live</span>
                  </div>
                </div>
                <div className="mt-3 h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full w-3/5 bg-primary rounded-full" />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
