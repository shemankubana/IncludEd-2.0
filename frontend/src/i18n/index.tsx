/**
 * i18n/index.ts
 * ==============
 * Lightweight i18n implementation for IncludEd.
 *
 * Uses a custom hook (no react-i18next dependency required)
 * to keep the bundle lean for low-resource Rwandan infrastructure.
 *
 * Supports: English (en), French (fr)
 * Extensible to: Kinyarwanda (rw)
 *
 * Usage:
 *   const { t, language, setLanguage } = useTranslation();
 *   t("reader.adaptive_engine_active")
 *   t("reader.chapter_of", { current: 1, total: 5 })
 */

import { useState, useCallback, useEffect, createContext, useContext } from "react";
import en from "./locales/en.json";
import fr from "./locales/fr.json";

// ── Types ──────────────────────────────────────────────────────────────────────

export type SupportedLanguage = "en" | "fr";

type TranslationObject = Record<string, any>;
const TRANSLATIONS: Record<SupportedLanguage, TranslationObject> = { en, fr };

export interface I18nContextValue {
    language:    SupportedLanguage;
    setLanguage: (lang: SupportedLanguage) => void;
    t:           (key: string, vars?: Record<string, string | number>) => string;
}

// ── Context ────────────────────────────────────────────────────────────────────

import React from "react";

export const I18nContext = createContext<I18nContextValue>({
    language:    "en",
    setLanguage: () => {},
    t:           (k) => k,
});

// ── Translation resolver ───────────────────────────────────────────────────────

function resolve(
    obj: TranslationObject,
    key: string,
    vars?: Record<string, string | number>
): string {
    const parts = key.split(".");
    let current: any = obj;
    for (const part of parts) {
        if (current == null) return key;
        current = current[part];
    }
    if (typeof current !== "string") return key;

    // Template substitution: {{variable}}
    if (vars) {
        return current.replace(/\{\{(\w+)\}\}/g, (_, name) =>
            vars[name] !== undefined ? String(vars[name]) : `{{${name}}}`
        );
    }
    return current;
}

// ── Provider ───────────────────────────────────────────────────────────────────

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [language, setLang] = useState<SupportedLanguage>(() => {
        const saved = localStorage.getItem("included_language") as SupportedLanguage | null;
        return saved ?? (navigator.language.startsWith("fr") ? "fr" : "en");
    });

    const setLanguage = useCallback((lang: SupportedLanguage) => {
        setLang(lang);
        localStorage.setItem("included_language", lang);
        document.documentElement.lang = lang;
    }, []);

    const t = useCallback(
        (key: string, vars?: Record<string, string | number>) =>
            resolve(TRANSLATIONS[language], key, vars),
        [language]
    );

    useEffect(() => {
        document.documentElement.lang = language;
    }, [language]);

    return (
        <I18nContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </I18nContext.Provider>
    );
};

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useTranslation(): I18nContextValue {
    return useContext(I18nContext);
}

// ── Language selector component ────────────────────────────────────────────────

export const LanguageSelector: React.FC<{ className?: string }> = ({ className }) => {
    const { language, setLanguage } = useTranslation();

    return (
        <div className={`flex items-center gap-1 ${className || ""}`}>
            <button
                onClick={() => setLanguage("en")}
                className={`text-xs font-black px-2 py-1 rounded-lg transition-all ${
                    language === "en"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                }`}
                aria-label="Switch to English"
            >
                EN
            </button>
            <span className="text-muted-foreground text-xs">|</span>
            <button
                onClick={() => setLanguage("fr")}
                className={`text-xs font-black px-2 py-1 rounded-lg transition-all ${
                    language === "fr"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                }`}
                aria-label="Passer au Français"
            >
                FR
            </button>
        </div>
    );
};
