import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Building2, Loader2, Mail, ArrowRight, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { API_BASE } from "@/lib/api";

type Step = "identity" | "school" | "verify" | "done";

export default function AdminSchoolSetup() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("identity");
  const [loading, setLoading] = useState(false);

  // Identity fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // School fields
  const [schoolName, setSchoolName] = useState("");
  const [country, setCountry] = useState("Rwanda");
  const [city, setCity] = useState("");

  const handleIdentitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast({ title: "Password too short", description: "Please use at least 8 characters.", variant: "destructive" });
      return;
    }
    setStep("school");
  };

  const handleSchoolSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // 1. Create Firebase account (or sign in if it already exists)
      let credential;
      try {
        credential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(credential.user, { displayName: `${firstName} ${lastName}` });
      } catch (fbErr: any) {
        if (fbErr.code === "auth/email-already-in-use") {
          credential = await signInWithEmailAndPassword(auth, email, password);
          await updateProfile(credential.user, { displayName: `${firstName} ${lastName}` });
        } else {
          throw fbErr;
        }
      }

      // 2. Send verification email
      await sendEmailVerification(credential.user);

      // 3. Create school + admin user on backend
      const idToken = await credential.user.getIdToken();
      const res = await fetch(`${API_BASE}/api/auth/admin-setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ firstName, lastName, schoolName, country, city }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setStep("verify");
    } catch (err: any) {
      toast({ title: "Setup failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCheck = async () => {
    setLoading(true);
    try {
      await auth.currentUser?.reload();
      if (auth.currentUser?.emailVerified) {
        setStep("done");
        toast({ title: "Email verified!", description: "Your school is ready." });
        setTimeout(() => navigate("/admin/dashboard"), 1500);
      } else {
        toast({
          title: "Not verified yet",
          description: "Check your inbox and click the verification link, then try again.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-8"
      >
        {/* Header */}
        <div className="text-center space-y-2">
          <img src="/logo.png" alt="IncludEd Logo" className="w-[70%] mx-auto" />
          <h1 className="text-3xl font-black tracking-tight">Register Your School</h1>
          <p className="text-muted-foreground">Set up your school admin account to get started.</p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2">
          {(["identity", "school", "verify"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black transition-all ${
                step === s ? "bg-primary text-primary-foreground" :
                (["school","verify","done"].indexOf(step) > i ? "bg-emerald-500 text-white" : "bg-secondary text-muted-foreground")
              }`}>
                {["school","verify","done"].indexOf(step) > i ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
              </div>
              {i < 2 && <div className={`w-8 h-0.5 rounded-full ${["school","verify","done"].indexOf(step) > i ? "bg-emerald-500" : "bg-border"}`} />}
            </div>
          ))}
        </div>

        {/* Step 1: Identity */}
        {step === "identity" && (
          <form onSubmit={handleIdentitySubmit} className="space-y-4">
            <div className="p-4 rounded-xl bg-secondary/50 border text-sm font-medium text-muted-foreground">
              Only school administrators can sign up directly. Teachers and students receive email invitations from their admin or teacher.
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>First Name</Label>
                <Input required placeholder="Jane" value={firstName} onChange={e => setFirstName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Last Name</Label>
                <Input required placeholder="Doe" value={lastName} onChange={e => setLastName(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Work Email</Label>
              <Input type="email" required placeholder="admin@school.edu" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <Input type="password" required placeholder="Min. 8 characters" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full h-12 font-black rounded-full gap-2">
              Continue <ArrowRight className="w-4 h-4" />
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account? <a href="/auth" className="text-primary font-bold hover:underline">Log in</a>
            </p>
          </form>
        )}

        {/* Step 2: School */}
        {step === "school" && (
          <form onSubmit={handleSchoolSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label><Building2 className="inline w-4 h-4 mr-1" />School Name</Label>
              <Input required placeholder="e.g. Kigali Primary School" value={schoolName} onChange={e => setSchoolName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Country</Label>
                <Input required value={country} onChange={e => setCountry(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>City</Label>
                <Input placeholder="Kigali" value={city} onChange={e => setCity(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" className="flex-1 h-12 font-bold rounded-full" onClick={() => setStep("identity")}>
                Back
              </Button>
              <Button type="submit" className="flex-1 h-12 font-black rounded-full gap-2" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ArrowRight className="w-4 h-4" /> Create School</>}
              </Button>
            </div>
          </form>
        )}

        {/* Step 3: Email Verification */}
        {step === "verify" && (
          <div className="text-center space-y-6">
            <Mail className="w-16 h-16 text-primary mx-auto" />
            <div className="space-y-2">
              <h2 className="text-xl font-black">Verify your email</h2>
              <p className="text-muted-foreground">
                We've sent a verification link to <strong>{email}</strong>.<br />
                Click the link, then come back and press the button below.
              </p>
            </div>
            <Button className="w-full h-12 font-black rounded-full" onClick={handleVerifyCheck} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              I've Verified My Email
            </Button>
            <button
              className="text-sm text-muted-foreground hover:text-primary underline-offset-4 hover:underline"
              onClick={async () => {
                await sendEmailVerification(auth.currentUser!);
                toast({ title: "Email resent!", description: "Check your inbox." });
              }}
            >
              Resend verification email
            </button>
          </div>
        )}

        {/* Done */}
        {step === "done" && (
          <div className="text-center space-y-4 py-8">
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
            <h2 className="text-xl font-black">School set up!</h2>
            <p className="text-muted-foreground">Redirecting to your dashboard…</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
