import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
    children: React.ReactNode;
    requiredRole?: "student" | "teacher" | "admin";
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole }) => {
    const { user, profile, loading, previewMode } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-background">
                <Loader2 className="w-12 h-12 text-primary animate-spin" />
            </div>
        );
    }

    if (!user) {
        // Not logged in, redirect to auth
        return <Navigate to="/auth" state={{ from: location }} replace />;
    }

    if (requiredRole && profile && profile.role !== requiredRole) {
        // ALLOW TEACHERS IN PREVIEW MODE TO ACCESS STUDENT ROUTES
        if (profile.role === "teacher" && previewMode && requiredRole === "student") {
            return <>{children}</>;
        }

        // Role mismatch: redirect to their own dashboard
        console.warn(`Role mismatch: expected ${requiredRole}, got ${profile.role}. Redirecting...`);

        if (profile.role === "admin") return <Navigate to="/admin/dashboard" replace />;
        if (profile.role === "teacher") return <Navigate to="/teacher/dashboard" replace />;
        return <Navigate to="/student/dashboard" replace />;
    }

    return <>{children}</>;
};

export default ProtectedRoute;
