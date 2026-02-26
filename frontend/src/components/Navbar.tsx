import { BookOpen, Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import ThemeToggle from "@/components/ThemeToggle";

const Navbar = () => {
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/70 backdrop-blur-xl border-b border-border">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold text-foreground font-space tracking-tight">IncludEd</span>
        </div>

        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a>
          <a href="#demo" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Demo</a>
          <a href="#compare" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Compare</a>
          <ThemeToggle />
          <Link to="/auth">
            <Button size="sm" className="rounded-lg font-semibold">Get Started</Button>
          </Link>
        </div>

        <div className="flex md:hidden items-center gap-2">
          <ThemeToggle />
          <button className="text-foreground" onClick={() => setOpen(!open)}>
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden bg-background border-b border-border px-6 pb-4 space-y-3">
          <a href="#features" className="block text-sm text-muted-foreground" onClick={() => setOpen(false)}>Features</a>
          <a href="#demo" className="block text-sm text-muted-foreground" onClick={() => setOpen(false)}>Demo</a>
          <a href="#compare" className="block text-sm text-muted-foreground" onClick={() => setOpen(false)}>Compare</a>
          <Link to="/auth" onClick={() => setOpen(false)}>
            <Button size="sm" className="rounded-lg w-full">Get Started</Button>
          </Link>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
