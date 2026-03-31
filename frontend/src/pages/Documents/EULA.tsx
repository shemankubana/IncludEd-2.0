import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Shield, FileText, Ban, Copyright, Lightbulb, XCircle, AlertTriangle, Mail, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import ThemeToggle from "@/components/ThemeToggle";

const sections = [
  { id: "license-grant",       number: "01", title: "License Grant",        icon: FileText },
  { id: "restrictions",        number: "02", title: "Restrictions",          icon: Ban },
  { id: "intellectual",        number: "03", title: "Intellectual Property", icon: Copyright },
  { id: "suggestions",         number: "04", title: "Your Suggestions",      icon: Lightbulb },
  { id: "termination",         number: "05", title: "Termination",           icon: XCircle },
  { id: "limitation",          number: "06", title: "Limitation of Liability", icon: AlertTriangle },
  { id: "contact",             number: "07", title: "Contact Information",   icon: Mail },
];

const EULA = () => {
  const [activeSection, setActiveSection] = useState("license-grant");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { rootMargin: "-30% 0px -60% 0px" }
    );
    sections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top nav */}
      <div className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-3 flex justify-between items-center">
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" /> Back to Home
            </Button>
          </Link>
          <span className="text-sm font-semibold text-muted-foreground hidden sm:block">IncludEd Legal</span>
          <ThemeToggle />
        </div>
      </div>

      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-violet-500/5 border-b border-border">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6 py-16 md:py-24">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-semibold px-3 py-1.5 rounded-full mb-6 border border-primary/20">
              <Shield className="w-3.5 h-3.5" /> Legal Agreement
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4 text-foreground">
              End User License<br className="hidden md:block" /> Agreement
            </h1>
            <p className="text-muted-foreground text-lg max-w-xl">
              Please read this agreement carefully before using IncludEd. By using our platform, you agree to be bound by these terms.
            </p>
            <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500" />
              Last updated: March 30, 2026
            </p>
          </motion.div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-7xl mx-auto px-6 py-12 flex gap-12">
        {/* Sticky sidebar TOC */}
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="sticky top-20">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">Table of Contents</p>
            <nav className="space-y-1">
              {sections.map(({ id, number, title }) => (
                <button
                  key={id}
                  onClick={() => scrollTo(id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm transition-all ${
                    activeSection === id
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  <span className={`text-xs font-mono ${activeSection === id ? "text-primary" : "text-muted-foreground/60"}`}>
                    {number}
                  </span>
                  <span className="leading-snug">{title}</span>
                  {activeSection === id && <ChevronRight className="w-3 h-3 ml-auto shrink-0" />}
                </button>
              ))}
            </nav>

            <div className="mt-8 p-4 bg-primary/5 border border-primary/15 rounded-2xl">
              <p className="text-xs font-semibold text-primary mb-1">Questions?</p>
              <p className="text-xs text-muted-foreground">Contact us at <span className="text-foreground font-medium">support@included.rw</span></p>
            </div>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0 space-y-6">
          {[
            {
              id: "license-grant",
              icon: FileText,
              title: "License Grant",
              content: (
                <p>IncludEd ("the Platform") grants you a personal, non-exclusive, non-transferable, limited license to use the Platform for educational purposes in accordance with the terms of this Agreement.</p>
              ),
            },
            {
              id: "restrictions",
              icon: Ban,
              title: "Restrictions",
              content: (
                <>
                  <p className="mb-4">You agree not to, and you will not permit others to:</p>
                  <ul className="space-y-3">
                    {[
                      "License, sell, rent, lease, assign, distribute, transmit, host, outsource, disclose or otherwise commercially exploit the Platform.",
                      "Modify, make derivative works of, disassemble, decrypt, reverse compile or reverse engineer any part of the Platform.",
                      "Remove, alter or obscure any proprietary notice (including any notice of copyright or trademark) of IncludEd or its affiliates.",
                    ].map((item, i) => (
                      <li key={i} className="flex gap-3 items-start">
                        <span className="mt-1 w-5 h-5 rounded-full bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
                          <Ban className="w-3 h-3" />
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ),
            },
            {
              id: "intellectual",
              icon: Copyright,
              title: "Intellectual Property",
              content: (
                <p>The Platform, including without limitation all copyrights, patents, trademarks, trade secrets and other intellectual property rights are, and shall remain, the sole and exclusive property of IncludEd.</p>
              ),
            },
            {
              id: "suggestions",
              icon: Lightbulb,
              title: "Your Suggestions",
              content: (
                <p>Any feedback, comments, ideas, improvements or suggestions provided by you to IncludEd shall remain the sole and exclusive property of IncludEd. IncludEd shall be free to use, copy, modify, publish, or redistribute the submissions for any purpose without compensation to you.</p>
              ),
            },
            {
              id: "termination",
              icon: XCircle,
              title: "Termination",
              content: (
                <p>This Agreement shall remain in effect until terminated by you or IncludEd. IncludEd may, in its sole discretion, at any time and for any or no reason, suspend or terminate this Agreement with or without prior notice. This Agreement will terminate immediately, without prior notice, in the event that you fail to comply with any provision of this Agreement.</p>
              ),
            },
            {
              id: "limitation",
              icon: AlertTriangle,
              title: "Limitation of Liability",
              content: (
                <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                  <p>In no event shall IncludEd be liable for any special, incidental, indirect, or consequential damages whatsoever arising out of or in connection with your access or use or inability to access or use the Platform.</p>
                </div>
              ),
            },
            {
              id: "contact",
              icon: Mail,
              title: "Contact Information",
              content: (
                <div className="flex items-center gap-4 p-5 bg-primary/5 border border-primary/15 rounded-2xl">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                    <Mail className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-0.5">For questions about this Agreement, reach us at:</p>
                    <a href="mailto:support@included.rw" className="font-semibold text-primary hover:underline">support@included.rw</a>
                  </div>
                </div>
              ),
            },
          ].map(({ id, icon: Icon, title, content }, i) => (
            <motion.div
              key={id}
              id={id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card border border-border rounded-2xl p-6 md:p-8 scroll-mt-24"
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                  <Icon className="w-4.5 h-4.5 text-primary" />
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="text-xs font-mono text-muted-foreground/60">{sections[i].number}</span>
                  <h2 className="text-lg font-bold text-foreground">{title}</h2>
                </div>
              </div>
              <div className="text-muted-foreground leading-relaxed text-[15px]">{content}</div>
            </motion.div>
          ))}
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-border mt-12 py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-muted-foreground">
          <p>© 2026 IncludEd. All rights reserved.</p>
          <div className="flex gap-6">
            <Link to="/eula" className="hover:text-primary transition-colors font-medium text-foreground">EULA</Link>
            <Link to="/privacy-policy" className="hover:text-primary transition-colors">Privacy Policy</Link>
            <Link to="/" className="hover:text-primary transition-colors">Home</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default EULA;
