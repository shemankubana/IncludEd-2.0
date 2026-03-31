import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import FeaturesSection from "@/components/FeaturesSection";
import DemoLessonSection from "@/components/DemoLessonSection";
import ComparisonSection from "@/components/ComparisonSection";
import CTASection from "@/components/CTASection";
import { useTranslation } from "@/i18n";

const Index = () => {
  const { t } = useTranslation();
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
            {t("landing.footer.copyright")}
          </p>
          <div className="flex gap-4 justify-center mt-2 text-[10px] text-muted-foreground">
            <a href="/eula" className="hover:text-primary transition-colors">{t("landing.footer.eula")}</a>
            <a href="/privacy-policy" className="hover:text-primary transition-colors">{t("landing.footer.privacy")}</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
