import { create } from "zustand";
import { persist } from "zustand/middleware";

type LanguageState = {
  lang: "ar" | "en";
  setLang: (lang: "ar" | "en") => void;
  toggleLang: () => void;
};

export const useLanguage = create<LanguageState>()(
  persist(
    (set) => ({
      lang: "ar",
      setLang: (lang) => {
        document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
        document.documentElement.lang = lang;
        set({ lang });
      },
      toggleLang: () =>
        set((state) => {
          const newLang = state.lang === "ar" ? "en" : "ar";
          document.documentElement.dir = newLang === "ar" ? "rtl" : "ltr";
          document.documentElement.lang = newLang;
          return { lang: newLang };
        }),
    }),
    {
      name: "universe-lang",
      onRehydrateStorage: () => (state) => {
        if (state) {
          document.documentElement.dir = state.lang === "ar" ? "rtl" : "ltr";
          document.documentElement.lang = state.lang;
        }
      },
    }
  )
);
