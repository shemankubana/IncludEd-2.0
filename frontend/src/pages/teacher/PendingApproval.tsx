import { motion } from "framer-motion";
import { Clock, LogOut, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/firebase";
import { useNavigate } from "react-router-dom";

const PendingApproval = () => {
    const navigate = useNavigate();

    const handleLogout = async () => {
        await auth.signOut();
        navigate("/auth");
    };

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-md w-full p-8 bg-card rounded-3xl border border-border shadow-2xl"
            >
                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Clock className="w-10 h-10 text-primary animate-pulse" />
                </div>

                <h1 className="text-2xl font-black mb-4">Account Pending Approval</h1>

                <p className="text-muted-foreground mb-8 text-sm leading-relaxed">
                    Your teacher account has been created successfully! However, for security,
                    an administrator at your school must approve your account before you can
                    access the dashboard.
                </p>

                <div className="space-y-4">
                    <div className="p-4 bg-secondary/50 rounded-2xl flex items-start gap-3 text-left">
                        <Mail className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Contact Admin</p>
                            <p className="text-sm font-medium">Please notify your school's IT department or head teacher to activate your account.</p>
                        </div>
                    </div>

                    <Button
                        onClick={handleLogout}
                        variant="outline"
                        className="w-full h-12 rounded-xl gap-2 font-bold"
                    >
                        <LogOut className="w-4 h-4" /> Back to Login
                    </Button>
                </div>
            </motion.div>

            <p className="mt-8 text-xs text-muted-foreground font-medium">
                IncludEd — Making learning accessible for everyone.
            </p>
        </div>
    );
};

export default PendingApproval;
