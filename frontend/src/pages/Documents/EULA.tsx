import React from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import ThemeToggle from "@/components/ThemeToggle";

const EULA = () => {
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
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-3xl font-black tracking-tight">End User License Agreement (EULA)</h1>
          </div>

          <div className="prose prose-slate dark:prose-invert max-w-none space-y-6 text-muted-foreground">
            <p className="text-sm italic">Last Updated: March 30, 2026</p>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">1. License Grant</h2>
              <p>
                IncludEd ("the Platform") grants you a personal, non-exclusive, non-transferable, limited license to use the Platform for educational purposes in accordance with the terms of this Agreement.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">2. Restrictions</h2>
              <p>You agree not to, and you will not permit others to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>License, sell, rent, lease, assign, distribute, transmit, host, outsource, disclose or otherwise commercially exploit the Platform.</li>
                <li>Modify, make derivative works of, disassemble, decrypt, reverse compile or reverse engineer any part of the Platform.</li>
                <li>Remove, alter or obscure any proprietary notice (including any notice of copyright or trademark) of IncludEd or its affiliates.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">3. Intellectual Property</h2>
              <p>
                The Platform, including without limitation all copyrights, patents, trademarks, trade secrets and other intellectual property rights are, and shall remain, the sole and exclusive property of IncludEd.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">4. Your Suggestions</h2>
              <p>
                Any feedback, comments, ideas, improvements or suggestions provided by you to IncludEd shall remain the sole and exclusive property of IncludEd.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">5. Termination</h2>
              <p>
                This Agreement shall remain in effect until terminated by you or IncludEd. IncludEd may, in its sole discretion, at any time and for any or no reason, suspend or terminate this Agreement with or without prior notice.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">6. Limitation of Liability</h2>
              <p>
                In no event shall IncludEd be liable for any special, incidental, indirect, or consequential damages whatsoever arising out of or in connection with your access or use or inability to access or use the Platform.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">7. Contact Information</h2>
              <p>
                If you have any questions about this Agreement, please contact us at support@included.rw.
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

export default EULA;
