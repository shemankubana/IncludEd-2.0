import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { BookOpen, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { API_BASE } from "@/lib/api";

const CLASS_LEVELS = ["P1","P2","P3","P4","P5","P6","S1","S2","S3","S4","S5","S6"];
const TERMS = ["Term 1","Term 2","Term 3"];

type InviteInfo = {
  email: string;
  role: "teacher" | "student";
  schoolName: string;
  schoolCode: string;
};

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "done">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  // Form fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [classLevel, setClassLevel] = useState("P4");
  const [term, setTerm] = useState("Term 1");
  const [submitting, setSubmitting] = useState(false);

  // Validate the token on mount
  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/api/invitations/validate/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Invalid invitation");
        }
        return res.json();
      })
      .then((data: InviteInfo) => {
        setInvite(data);
        setStatus("ready");
      })
      .catch((err) => {
        setErrorMsg(err.message);
        setStatus("error");
      });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (password.length < 8) {
      toast({ title: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      // 1. Create Firebase account
      const credential = await createUserWithEmailAndPassword(auth, invite!.email, password);
      await updateProfile(credential.user, { displayName: `${firstName} ${lastName}` });
      const idToken = await credential.user.getIdToken();

      // 2. Call accept endpoint
      const res = await fetch(`${API_BASE}/api/invitations/accept/${token}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          firstName,
          lastName,
          ...(invite!.role === "student" ? { classLevel, term } : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setStatus("done");
      toast({ title: "Account created!", description: "Welcome to IncludEd." });

      setTimeout(() => {
        if (invite!.role === "student") navigate("/student/dashboard");
        else navigate("/auth"); // Teachers wait for admin approval
      }, 2000);
    } catch (err: any) {
      toast({ title: "Setup failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <BookOpen className="w-8 h-8 text-primary" />
            <span className="text-2xl font-black">IncludEd</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight">You're invited!</h1>
        </div>

        {status === "loading" && (
          <div className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Validating your invitation…</p>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <AlertCircle className="w-12 h-12 text-destructive" />
            <p className="text-lg font-semibold">Invitation Invalid</p>
            <p className="text-muted-foreground">{errorMsg}</p>
            <Button variant="outline" onClick={() => navigate("/auth")}>Go to Login</Button>
          </div>
        )}

        {status === "done" && (
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <CheckCircle2 className="w-14 h-14 text-emerald-500" />
            <p className="text-xl font-black">Account created!</p>
            {invite?.role === "teacher" ? (
              <p className="text-muted-foreground">Your account is pending admin approval. You'll receive an email when it's activated.</p>
            ) : (
              <p className="text-muted-foreground">Redirecting to your dashboard…</p>
            )}
          </div>
        )}

        {status === "ready" && invite && (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Invitation Banner */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
              <p className="font-semibold text-primary">{invite.schoolName}</p>
              <p className="text-muted-foreground capitalize">
                You've been invited as a <strong>{invite.role}</strong>
              </p>
              <p className="text-muted-foreground text-xs mt-1 break-all">{invite.email}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>First Name</Label>
                <Input
                  required
                  placeholder="Jane"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Last Name</Label>
                <Input
                  required
                  placeholder="Doe"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>

            {invite.role === "student" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Class Level</Label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={classLevel}
                    onChange={(e) => setClassLevel(e.target.value)}
                  >
                    {CLASS_LEVELS.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Term</Label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                  >
                    {TERMS.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Password</Label>
              <Input
                type="password"
                required
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Confirm Password</Label>
              <Input
                type="password"
                required
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <Button type="submit" className="w-full h-12 font-black rounded-full" disabled={submitting}>
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Setting up account…</>
              ) : (
                "Create My Account"
              )}
            </Button>

            {invite.role === "teacher" && (
              <p className="text-xs text-center text-muted-foreground">
                Your account will need admin approval before you can log in.
              </p>
            )}
          </form>
        )}
      </motion.div>
    </div>
  );
}
