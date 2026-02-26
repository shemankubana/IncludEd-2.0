import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import FeaturesSection from "@/components/FeaturesSection";
import DemoLessonSection from "@/components/DemoLessonSection";
import ComparisonSection from "@/components/ComparisonSection";
import CTASection from "@/components/CTASection";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <HeroSection />
      <div id="features">
        <FeaturesSection />
      </div>
      <div id="demo">
        <DemoLessonSection />
      </div>
      <div id="compare">
        <ComparisonSection />
      </div>
      <CTASection />
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-6 text-center">
          <p className="text-xs text-muted-foreground">
            © 2026 IncludEd. Adaptive learning for students with learning disabilities in Rwanda.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
