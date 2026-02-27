import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

interface AuthContextType {
    user: User | null;
    profile: any | null;
    loading: boolean;
    logout: () => Promise<void>;
    refreshProfile: () => Promise<void>;
    previewMode: boolean;
    setPreviewMode: (mode: boolean) => void;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    profile: null,
    loading: true,
    logout: async () => { },
    refreshProfile: async () => { },
    previewMode: false,
    setPreviewMode: () => { }
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [previewMode, setPreviewMode] = useState(false);

    const refreshProfile = async () => {
        if (!auth.currentUser) return;
        try {
            const idToken = await auth.currentUser.getIdToken();
            const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/auth/me`, {
                headers: { "Authorization": `Bearer ${idToken}` }
            });
            if (res.ok) setProfile(await res.json());
        } catch (err) {
            console.error("Failed to fetch profile:", err);
        }
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            setUser(firebaseUser);
            if (firebaseUser) {
                await refreshProfile();
            } else {
                setProfile(null);
            }
            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const logout = async () => {
        await signOut(auth);
    };

    return (
        <AuthContext.Provider value={{
            user,
            profile,
            loading,
            logout,
            refreshProfile,
            previewMode,
            setPreviewMode
        }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
