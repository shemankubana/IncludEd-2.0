import { BookOpen, Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import ThemeToggle from "@/components/ThemeToggle";
import { useTranslation, LanguageSelector } from "@/i18n";

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/70 backdrop-blur-xl border-b border-border">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center">
          <img src="/logo.png" alt="IncludEd Logo" className="h-9 w-auto md:h-11 transition-all" />
        </Link>

        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t("landing.navbar.features")}</a>
          <a href="#demo" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t("landing.navbar.demo")}</a>
          <a href="#compare" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t("landing.navbar.compare")}</a>
          <div className="flex items-center gap-3">
             <LanguageSelector />
             <ThemeToggle />
          </div>
          <Link to="/auth">
            <Button size="sm" className="rounded-lg font-semibold">{t("landing.navbar.get_started")}</Button>
          </Link>
        </div>

        <div className="flex md:hidden items-center gap-2">
          <LanguageSelector />
          <ThemeToggle />
          <button className="text-foreground" onClick={() => setOpen(!open)}>
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden bg-background border-b border-border px-6 pb-4 space-y-3">
          <a href="#features" className="block text-sm text-muted-foreground" onClick={() => setOpen(false)}>{t("landing.navbar.features")}</a>
          <a href="#demo" className="block text-sm text-muted-foreground" onClick={() => setOpen(false)}>{t("landing.navbar.demo")}</a>
          <a href="#compare" className="block text-sm text-muted-foreground" onClick={() => setOpen(false)}>{t("landing.navbar.compare")}</a>
          <Link to="/auth" onClick={() => setOpen(false)}>
            <Button size="sm" className="rounded-lg w-full">{t("landing.navbar.get_started")}</Button>
          </Link>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
