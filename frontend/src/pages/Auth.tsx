import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { assignRole, type AppRole } from "@/lib/supabase-helpers";
import { useNavigate, Link } from "react-router-dom";
import ThemeToggle from "@/components/ThemeToggle";

const roles: { value: AppRole; label: string; description: string; icon: string }[] = [
  { value: "student", label: "Student", description: "Access adaptive lessons & track progress", icon: "📚" },
  { value: "teacher", label: "Teacher", description: "Manage classes & view student analytics", icon: "👩‍🏫" },
  { value: "parent", label: "Parent", description: "Monitor your child's learning journey", icon: "👨‍👩‍👧" },
  { value: "admin", label: "Admin", description: "Manage schools, users & platform settings", icon: "⚙️" },
];

const Auth = () => {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [selectedRole, setSelectedRole] = useState<AppRole>("student");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast({ title: "Login failed", description: error.message, variant: "destructive" });
    } else {
      navigate("/");
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) {
      setLoading(false);
      toast({ title: "Signup failed", description: error.message, variant: "destructive" });
      return;
    }
    if (data.user) {
      try {
        await assignRole(data.user.id, selectedRole);
      } catch (roleError: any) {
        console.error("Role assignment error:", roleError);
      }
    }
    setLoading(false);
    toast({
      title: "Check your email",
      description: "We sent you a confirmation link. Please verify your email to continue.",
    });
  };

  return (
    <div className="min-h-screen bg-background bg-grid flex items-center justify-center p-6">
      <div className="absolute top-4 left-4">
        <Link to="/">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
        </Link>
      </div>
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-2xl font-bold text-foreground font-space tracking-tight">IncludEd</span>
        </div>

        <div className="bg-card rounded-2xl border border-border p-8 shadow-lg">
          {/* Tab switcher */}
          <div className="flex bg-secondary rounded-xl p-1 mb-6">
            <button
              onClick={() => setMode("login")}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                mode === "login" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              Log In
            </button>
            <button
              onClick={() => setMode("signup")}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                mode === "signup" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              Sign Up
            </button>
          </div>

          <AnimatePresence mode="wait">
            {mode === "login" ? (
              <motion.form
                key="login"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onSubmit={handleLogin}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full rounded-lg font-semibold" disabled={loading}>
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  Don't have an account?{" "}
                  <button type="button" onClick={() => setMode("signup")} className="text-primary font-medium hover:underline">
                    Sign up
                  </button>
                </p>
              </motion.form>
            ) : (
              <motion.form
                key="signup"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleSignup}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full Name</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Your full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="Min 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>

                {/* Role selection */}
                <div className="space-y-2">
                  <Label>I am a...</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {roles.map((role) => (
                      <button
                        key={role.value}
                        type="button"
                        onClick={() => setSelectedRole(role.value)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          selectedRole === role.value
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-border hover:border-primary/30"
                        }`}
                      >
                        <div className="text-lg mb-1">{role.icon}</div>
                        <div className="text-sm font-semibold text-foreground">{role.label}</div>
                        <div className="text-xs text-muted-foreground leading-tight">{role.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <Button type="submit" className="w-full rounded-lg font-semibold" disabled={loading}>
                  {loading ? "Creating account..." : "Create Account"}
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  Already have an account?{" "}
                  <button type="button" onClick={() => setMode("login")} className="text-primary font-medium hover:underline">
                    Log in
                  </button>
                </p>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-6">
          Adaptive learning for students with learning disabilities in Rwanda
        </p>
      </motion.div>
    </div>
  );
};

export default Auth;
