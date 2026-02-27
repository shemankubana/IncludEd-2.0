import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  sendPasswordResetEmail
} from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { useNavigate, Link } from "react-router-dom";
import ThemeToggle from "@/components/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";

const roles: { value: string; label: string; description: string; icon: string }[] = [
  { value: "student", label: "Student", description: "Access adaptive lessons & track progress", icon: "📚" },
  { value: "teacher", label: "Teacher", description: "Manage classes & view student analytics", icon: "👩‍🏫" },
  { value: "parent", label: "Parent", description: "Monitor your child's learning journey", icon: "👨‍👩‍👧" },
  { value: "admin", label: "Admin", description: "Manage schools, users & platform settings", icon: "⚙️" },
];

const Auth = () => {
  const { user } = useAuth();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [selectedRole, setSelectedRole] = useState("student");
  const [loginRole, setLoginRole] = useState("student");
  const [schoolCode, setSchoolCode] = useState("");
  const [classLevel, setClassLevel] = useState("P4");
  const [term, setTerm] = useState("Term 1");
  const [loading, setLoading] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      const fetchRoleAndRedirect = async () => {
        try {
          const idToken = await user.getIdToken();
          const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/auth/me`, {
            headers: { "Authorization": `Bearer ${idToken}` }
          });
          if (response.ok) {
            const userData = await response.json();
            if (userData.status === "pending_approval") {
              navigate("/teacher/pending");
              return;
            }
            if (userData.role === "teacher") navigate("/teacher/dashboard");
            else if (userData.role === "admin") navigate("/admin/dashboard");
            else if (userData.role === "student") navigate("/student/dashboard");
            else navigate("/"); // Fallback
          }
        } catch (err) {
          console.error("Auto-redirect check failed:", err);
        }
      };
      fetchRoleAndRedirect();
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await userCredential.user.getIdToken();

      // Fetch user profile with role check
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/auth/me?expectedRole=${loginRole}`,
        { headers: { "Authorization": `Bearer ${idToken}` } }
      );

      const data = await response.json();

      if (response.ok) {
        toast({ title: "Welcome back!", description: `Successfully logged in as ${data.role}.` });
        if (data.role === "teacher") navigate("/teacher/dashboard");
        else if (data.role === "admin") navigate("/admin/dashboard");
        else if (data.role === "student") navigate("/student/dashboard");
        else navigate("/");
      } else {
        // Handle specific errors like ROLE_MISMATCH or PENDING_APPROVAL
        if (data.code === "ROLE_MISMATCH") {
          toast({
            title: "Access Denied",
            description: data.error,
            variant: "destructive"
          });
          await auth.signOut(); // Log them out if role mismatch
        } else if (data.code === "PENDING_APPROVAL") {
          toast({
            title: "Account Pending",
            description: data.error,
          });
          await auth.signOut();
        } else {
          toast({ title: "Login Error", description: data.error || "Unknown error", variant: "destructive" });
        }
      }
    } catch (error: any) {
      toast({ title: "Login failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Validate school code first? (Optional, but good UX)
    try {
      const schoolRes = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/schools/by-code/${schoolCode}`);
      if (!schoolRes.ok) {
        throw new Error("Invalid school code. Please verify with your school.");
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      if (userCredential.user) {
        const idToken = await userCredential.user.getIdToken();
        await updateProfile(userCredential.user, { displayName: fullName });

        const names = fullName.split(" ");
        const syncRes = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/auth/sync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${idToken}`
          },
          body: JSON.stringify({
            email,
            firstName: names[0] || "",
            lastName: names.slice(1).join(" ") || "",
            role: selectedRole,
            schoolCode,
            classLevel: selectedRole === "student" ? classLevel : null,
            term: selectedRole === "student" ? term : null,
            yearEnrolled: new Date().getFullYear()
          })
        });

        const syncData = await syncRes.json();
        if (!syncRes.ok) throw new Error(syncData.error);

        toast({
          title: "Account created!",
          description: selectedRole === "teacher"
            ? "Your account is pending admin approval."
            : "Welcome to IncludEd!",
        });

        if (selectedRole === "teacher") {
          setMode("login"); // Teachers must wait for approval
          await auth.signOut();
        } else if (selectedRole === "student") {
          navigate("/onboarding");
        } else if (selectedRole === "admin") {
          navigate("/admin/dashboard");
        } else {
          navigate("/");
        }
      }
    } catch (error: any) {
      toast({ title: "Signup failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, forgotEmail);
      toast({
        title: "Reset Email Sent!",
        description: `Check your inbox for a password reset link.`,
      });
      setMode("login");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    // Note: Google sign-in is harder with mandatory school codes. 
    // We should probably redirect to a "Complete Profile" page if schoolId is missing.
    // For now, let's just use the selectedRole/schoolCode from inputs.
    try {
      if (mode === "signup" && !schoolCode) {
        throw new Error("Please enter your school code first.");
      }

      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const idToken = await user.getIdToken();

      const checkRes = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/auth/me`, {
        headers: { "Authorization": `Bearer ${idToken}` }
      });

      if (checkRes.status === 404) {
        if (mode === "login") throw new Error("Account not found. Please sign up first.");

        const nameParts = (user.displayName || "").split(" ");
        await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/auth/sync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${idToken}`
          },
          body: JSON.stringify({
            email: user.email,
            firstName: nameParts[0] || "",
            lastName: nameParts.slice(1).join(" ") || "",
            role: selectedRole,
            schoolCode,
            classLevel: selectedRole === "student" ? classLevel : null,
            term: selectedRole === "student" ? term : null
          })
        });

        toast({ title: "Welcome!", description: `Account created!` });
        if (selectedRole === "student") navigate("/onboarding");
        else if (selectedRole === "teacher") { setMode("login"); await auth.signOut(); }
      } else if (checkRes.ok) {
        const userData = await checkRes.json();

        // Check role mismatch for login
        if (mode === "login" && userData.role !== loginRole) {
          toast({ title: "Access Denied", description: `This account is ${userData.role}, not ${loginRole}`, variant: "destructive" });
          await auth.signOut();
          return;
        }

        if (userData.role === "teacher" && userData.status === "pending_approval") {
          toast({ title: "Pending", description: "Account waiting for admin approval" });
          await auth.signOut();
          return;
        }

        if (userData.role === "teacher") navigate("/teacher/dashboard");
        else if (userData.role === "admin") navigate("/admin/dashboard");
        else navigate("/student/dashboard");
      }
    } catch (error: any) {
      toast({ title: "Auth Failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
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
        <div className="flex items-center justify-center mb-8">
          <img src="/logo.png" alt="IncludEd Logo" className="w-48 h-auto" />
        </div>

        <div className="bg-card rounded-2xl border border-border p-8 shadow-lg overflow-y-auto max-h-[85vh] scrollbar-hide">
          {/* Tab switcher */}
          <div className="flex bg-secondary rounded-xl p-1 mb-6">
            <button
              onClick={() => setMode("login")}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${mode === "login" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
            >
              Log In
            </button>
            <button
              onClick={() => setMode("signup")}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${mode === "signup" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
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
                <div className="p-1 bg-secondary rounded-lg grid grid-cols-3 gap-1 mb-2">
                  {["student", "teacher", "admin"].map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setLoginRole(r)}
                      className={`py-1.5 text-[10px] uppercase tracking-widest font-black rounded-md transition-all ${loginRole === r ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-secondary/80"}`}
                    >
                      {r}
                    </button>
                  ))}
                </div>

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
                <div className="flex justify-end -mt-1">
                  <button
                    type="button"
                    onClick={() => setMode("forgot")}
                    className="text-xs text-primary font-medium hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <Button type="submit" className="w-full rounded-lg font-semibold" disabled={loading}>
                  {loading ? "Signing in..." : `Sign In as ${loginRole}`}
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  Don't have an account?{" "}
                  <button type="button" onClick={() => setMode("signup")} className="text-primary font-medium hover:underline">
                    Sign up
                  </button>
                </p>
              </motion.form>
            ) : mode === "forgot" ? (
              <motion.form
                key="forgot"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleForgotPassword}
                className="space-y-4"
              >
                <div className="text-center mb-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <BookOpen className="w-6 h-6 text-primary" />
                  </div>
                  <h2 className="text-lg font-black">Reset Password</h2>
                  <p className="text-xs text-muted-foreground">We'll send you a reset link.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="forgot-email">Email Address</Label>
                  <Input id="forgot-email" type="email" placeholder="you@example.com" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full rounded-lg font-semibold" disabled={loading}>
                  {loading ? "Sending..." : "Send Reset Link"}
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  Remember your password?{" "}
                  <button type="button" onClick={() => setMode("login")} className="text-primary font-medium hover:underline">
                    Back to Log In
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
                  <Input id="signup-name" type="text" placeholder="Your full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input id="signup-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input id="signup-password" type="password" placeholder="Min 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="school-code">School Code</Label>
                  <Input
                    id="school-code"
                    placeholder="e.g. KPS2024"
                    value={schoolCode}
                    onChange={(e) => setSchoolCode(e.target.value.toUpperCase())}
                    required
                    className="border-primary/50 text-center font-black tracking-widest uppercase"
                  />
                  <p className="text-[10px] text-muted-foreground">Ask your school for the code.</p>
                </div>

                {selectedRole === "student" && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label>Grade Level</Label>
                      <select
                        value={classLevel}
                        onChange={e => setClassLevel(e.target.value)}
                        className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        {["P1", "P2", "P3", "P4", "P5", "P6", "S1", "S2", "S3", "S4", "S5", "S6"].map(g => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Term</Label>
                      <select
                        value={term}
                        onChange={e => setTerm(e.target.value)}
                        className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        {["Term 1", "Term 2", "Term 3"].map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Register as...</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {roles.filter(r => r.value !== 'parent').map((role) => (
                      <button
                        key={role.value}
                        type="button"
                        onClick={() => setSelectedRole(role.value)}
                        className={`p-2 rounded-xl border flex flex-col items-center justify-center transition-all ${selectedRole === role.value ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border"}`}
                      >
                        <div className="text-xl mb-1">{role.icon}</div>
                        <div className="text-[10px] font-black uppercase tracking-widest">{role.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <Button type="submit" className="w-full rounded-lg font-semibold" disabled={loading}>
                  {loading ? "Creating account..." : "Sign Up"}
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

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest bg-card px-2 text-muted-foreground">
              Or
            </div>
          </div>

          <Button
            variant="outline"
            type="button"
            className="w-full rounded-lg font-semibold gap-3 h-12"
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1.01.68-2.31 1.05-3.71 1.05-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Sign in with Google
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-6">
          Adaptive learning for students with learning disabilities in Rwanda
        </p>
      </motion.div>
    </div>
  );
};

export default Auth;
