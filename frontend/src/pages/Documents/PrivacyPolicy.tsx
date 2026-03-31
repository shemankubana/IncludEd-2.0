import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Lock, Database, Settings, Share2, ShieldCheck, Clock, UserCheck, Mail, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import ThemeToggle from "@/components/ThemeToggle";

const sections = [
  { id: "info-collect",   number: "01", title: "Information We Collect",      icon: Database },
  { id: "how-use",        number: "02", title: "How We Use Your Information",  icon: Settings },
  { id: "data-sharing",   number: "03", title: "Data Sharing & Disclosure",    icon: Share2 },
  { id: "data-security",  number: "04", title: "Data Security",                icon: ShieldCheck },
  { id: "data-retention", number: "05", title: "Data Retention",               icon: Clock },
  { id: "your-rights",    number: "06", title: "Your Rights",                  icon: UserCheck },
  { id: "contact",        number: "07", title: "Contact Us",                   icon: Mail },
];

const PrivacyPolicy = () => {
  const [activeSection, setActiveSection] = useState("info-collect");

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
      <div className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-primary/5 border-b border-border">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6 py-16 md:py-24">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-semibold px-3 py-1.5 rounded-full mb-6 border border-primary/20">
              <Lock className="w-3.5 h-3.5" /> Privacy &amp; Data Protection
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4 text-foreground">
              Privacy<br className="hidden md:block" /> Policy
            </h1>
            <p className="text-muted-foreground text-lg max-w-xl">
              We are committed to protecting your personal data. This policy explains what we collect, how we use it, and the rights you have over your information.
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
              <p className="text-xs font-semibold text-primary mb-1">Privacy concerns?</p>
              <p className="text-xs text-muted-foreground">Reach us at <span className="text-foreground font-medium">privacy@included.rw</span></p>
            </div>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0 space-y-6">
          {[
            {
              id: "info-collect",
              icon: Database,
              title: "Information We Collect",
              content: (
                <>
                  <p className="mb-4">We collect information you provide directly when you create an account:</p>
                  <ul className="space-y-3">
                    {[
                      { label: "Identity", text: "Name, email address, and school affiliation." },
                      { label: "Learning Data", text: "Learning progress, quiz results, and interaction data within the adaptive reader." },
                      { label: "Preferences", text: "Profile information, accessibility settings, and reading preferences." },
                    ].map(({ label, text }) => (
                      <li key={label} className="flex gap-3 items-start p-3 bg-muted/30 rounded-xl">
                        <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md shrink-0 mt-0.5">{label}</span>
                        <span>{text}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ),
            },
            {
              id: "how-use",
              icon: Settings,
              title: "How We Use Your Information",
              content: (
                <>
                  <p className="mb-4">We use the collected information to:</p>
                  <ul className="space-y-3">
                    {[
                      "Provide, maintain, and improve our educational services.",
                      "Personalize the learning experience through our adaptive AI service.",
                      "Communicate with you about updates, features, and support.",
                      "Monitor and analyze usage trends and activities.",
                    ].map((item, i) => (
                      <li key={i} className="flex gap-3 items-start">
                        <span className="mt-1.5 w-4 h-4 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0 text-[10px] font-bold">
                          {i + 1}
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ),
            },
            {
              id: "data-sharing",
              icon: Share2,
              title: "Data Sharing & Disclosure",
              content: (
                <div className="space-y-4">
                  <p>We do not share your personal data with third parties except as necessary to provide our services, comply with the law, or protect our rights.</p>
                  <div className="p-4 bg-primary/5 border border-primary/15 rounded-xl flex gap-3 items-start">
                    <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <p className="text-sm">Educational data may be shared with your school administrators and teachers as part of the platform's core functionality. This is necessary to support your learning journey.</p>
                  </div>
                </div>
              ),
            },
            {
              id: "data-security",
              icon: ShieldCheck,
              title: "Data Security",
              content: (
                <div className="space-y-4">
                  <p>We take reasonable measures to help protect information about you from loss, theft, misuse, and unauthorized access, disclosure, alteration, and destruction.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { label: "Encrypted", desc: "Data in transit and at rest" },
                      { label: "Access Control", desc: "Role-based permissions" },
                      { label: "Monitored", desc: "Regular security audits" },
                    ].map(({ label, desc }) => (
                      <div key={label} className="p-3 bg-green-500/5 border border-green-500/15 rounded-xl text-center">
                        <p className="font-semibold text-green-600 dark:text-green-400 text-sm">{label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ),
            },
            {
              id: "data-retention",
              icon: Clock,
              title: "Data Retention",
              content: (
                <p>We store the information we collect about you for as long as is necessary for the purposes for which we originally collected it, or for other legitimate business purposes, including to meet our legal, regulatory, or other compliance obligations.</p>
              ),
            },
            {
              id: "your-rights",
              icon: UserCheck,
              title: "Your Rights",
              content: (
                <>
                  <p className="mb-4">Depending on your location, you may have certain rights regarding your personal information:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { right: "Access", desc: "Request a copy of data we hold about you" },
                      { right: "Correct", desc: "Update or fix inaccurate information" },
                      { right: "Delete", desc: "Request deletion of your personal data" },
                    ].map(({ right, desc }) => (
                      <div key={right} className="p-4 bg-muted/40 rounded-xl border border-border">
                        <p className="font-bold text-foreground text-sm mb-1">Right to {right}</p>
                        <p className="text-xs text-muted-foreground">{desc}</p>
                      </div>
                    ))}
                  </div>
                </>
              ),
            },
            {
              id: "contact",
              icon: Mail,
              title: "Contact Us",
              content: (
                <div className="flex items-center gap-4 p-5 bg-primary/5 border border-primary/15 rounded-2xl">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                    <Mail className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-0.5">For privacy-related questions, reach us at:</p>
                    <a href="mailto:privacy@included.rw" className="font-semibold text-primary hover:underline">privacy@included.rw</a>
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
                  <Icon className="w-4 h-4 text-primary" />
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
            <Link to="/eula" className="hover:text-primary transition-colors">EULA</Link>
            <Link to="/privacy-policy" className="hover:text-primary transition-colors font-medium text-foreground">Privacy Policy</Link>
            <Link to="/" className="hover:text-primary transition-colors">Home</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PrivacyPolicy;
