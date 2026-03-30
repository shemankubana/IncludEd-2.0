import React from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import ThemeToggle from "@/components/ThemeToggle";

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-background p-6 md:p-12">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <Link to="/">
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Back to Home
            </Button>
          </Link>
          <ThemeToggle />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-2xl border border-border p-8 md:p-12 shadow-sm"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
              <Lock className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-3xl font-black tracking-tight">Privacy Policy</h1>
          </div>

          <div className="prose prose-slate dark:prose-invert max-w-none space-y-6 text-muted-foreground">
            <p className="text-sm italic">Last Updated: March 30, 2026</p>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">1. Information We Collect</h2>
              <p>We collect information you provide directly to us when you create an account, such as:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Name, email address, and school affiliation.</li>
                <li>Learning progress, quiz results, and interaction data within the adaptive reader.</li>
                <li>Profile information and preferences.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">2. How We Use Your Information</h2>
              <p>We use the collected information to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Provide, maintain, and improve our educational services.</li>
                <li>Personalize the learning experience through our adaptive AI service.</li>
                <li>Communicate with you about updates, features, and support.</li>
                <li>Monitor and analyze usage trends and activities.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">3. Data Sharing and Disclosure</h2>
              <p>
                We do not share your personal data with third parties except as necessary to provide our services, comply with the law, or protect our rights. Educational data may be shared with your school administrators and teachers as part of the platform's functionality.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">4. Data Security</h2>
              <p>
                We take reasonable measures to help protect information about you from loss, theft, misuse, and unauthorized access, disclosure, alteration, and destruction.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">5. Data Retention</h2>
              <p>
                We store the information we collect about you for as long as is necessary for the purposes for which we originally collected it, or for other legitimate business purposes, including to meet our legal, regulatory, or other compliance obligations.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">6. Your Rights</h2>
              <p>
                Depending on your location, you may have certain rights regarding your personal information, including the right to access, correct, or delete the data we hold about you.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">7. Contact Us</h2>
              <p>
                If you have any questions about this Privacy Policy, please contact us at privacy@included.rw.
              </p>
            </section>
          </div>
        </motion.div>
        
        <p className="text-center text-xs text-muted-foreground mt-8">
          © 2026 IncludEd. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
