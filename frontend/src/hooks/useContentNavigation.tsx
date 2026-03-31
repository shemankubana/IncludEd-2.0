import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import { API_BASE } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

type LangMismatch = {
    lesson: any;
    alternateId: string | null;
};

export const useContentNavigation = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { language, t } = useTranslation();
    const [mismatch, setMismatch] = useState<LangMismatch | null>(null);
    const [isChecking, setIsChecking] = useState(false);

    // This function can be called from anywhere to open a piece of content (lesson)
    const openContent = useCallback(async (lesson: any) => {
        if (!user) return;
        
        const userLang = language === "fr" ? "french" : "english";
        const contentLang = lesson.language || "english";

        if (contentLang !== userLang) {
            setIsChecking(true);
            try {
                // Fetch all literature to find alternate logic. 
                // Caching could be applied here if performance is an issue later.
                const idToken = await user.getIdToken();
                const headers = { "Authorization": `Bearer ${idToken}` };
                const res = await fetch(`${API_BASE}/api/literature`, { headers });
                
                let alternateId = null;
                if (res.ok) {
                    const allLessons = await res.json();
                    const targetLang = contentLang === "english" ? "french" : "english";
                    const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
                    const alt = allLessons.find(
                        (l: any) => l.id !== lesson.id &&
                             l.language === targetLang &&
                             normalise(l.title) === normalise(lesson.title)
                    );
                    alternateId = alt?.id ?? null;
                }
                setMismatch({ lesson, alternateId });
            } catch (error) {
                console.error("Failed to check for alternate lesson language", error);
                setMismatch({ lesson, alternateId: null });
            } finally {
                setIsChecking(false);
            }
        } else {
            // Language matches user preference, straight to reader
            navigate(`/student/reader/${lesson.id}`);
        }
    }, [user, language, navigate]);

    const mismatchModal = (
        <AnimatePresence>
            {mismatch && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                    onClick={() => setMismatch(null)}
                >
                    <motion.div
                        initial={{ scale: 0.92, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.92 }}
                        className="bg-card border border-border rounded-3xl p-8 max-w-sm w-full shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center mb-4">
                            <AlertTriangle className="w-6 h-6 text-amber-500" />
                        </div>
                        <h2 className="font-black text-lg mb-1">{t("language.mismatch_title")}</h2>
                        <div className="flex flex-col gap-1 text-xs text-muted-foreground mb-4 mt-2">
                            <span className="bg-muted px-2 py-1 rounded-lg font-semibold flex items-center justify-between">
                                <span>{t("language.your_language")}:</span> 
                                <span>{language === "fr" ? t("language.fr") : t("language.en")}</span>
                            </span>
                            <span className="bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-1 rounded-lg font-semibold flex items-center justify-between">
                                <span>{t("language.content_language")}:</span> 
                                <span>{mismatch.lesson.language === "french" ? t("language.fr") : t("language.en")}</span>
                            </span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-6">
                            {mismatch.alternateId
                                ? (language === "fr" ? t("language.available_in_fr") : t("language.available_in_en"))
                                : (mismatch.lesson.language === "english" ? t("language.only_in_en") : t("language.only_in_fr"))
                            }
                        </p>
                        <div className="space-y-2">
                            {mismatch.alternateId && (
                                <Button
                                    className="w-full rounded-2xl font-black gap-2"
                                    onClick={() => { setMismatch(null); navigate(`/student/reader/${mismatch.alternateId}`); }}
                                >
                                    <Globe className="w-4 h-4" />
                                    {language === "fr" ? t("language.switch_to_fr") : t("language.switch_to_en")}
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                className="w-full rounded-2xl font-bold"
                                onClick={() => { setMismatch(null); navigate(`/student/reader/${mismatch.lesson.id}`); }}
                            >
                                {t("language.continue_anyway")}
                            </Button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );

    return {
        openContent,
        isChecking,
        mismatchModal,
    };
};
