import { motion } from "framer-motion";
import { HelpCircle, Search, MessageCircle } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslation, globalI18n } from "@/lib/i18n";
import { useState } from "react";

const FAQ_ITEMS = [
  {
    categoryKey: "faqCatAccount",
    questions: [
      { qKey: "faqQ1", aKey: "faqA1" },
      { qKey: "faqQ2", aKey: "faqA2" },
      { qKey: "faqQ3", aKey: "faqA3" },
    ],
  },
  {
    categoryKey: "faqCatCourses",
    questions: [
      { qKey: "faqQ4", aKey: "faqA4" },
      { qKey: "faqQ5", aKey: "faqA5" },
      { qKey: "faqQ6", aKey: "faqA6" },
    ],
  },
  {
    categoryKey: "faqCatSchedule",
    questions: [
      { qKey: "faqQ7", aKey: "faqA7" },
      { qKey: "faqQ8", aKey: "faqA8" },
    ],
  },
  {
    categoryKey: "faqCatQuizzes",
    questions: [
      { qKey: "faqQ9", aKey: "faqA9" },
      { qKey: "faqQ10", aKey: "faqA10" },
    ],
  },
  {
    categoryKey: "faqCatPointsLevels",
    questions: [
      { qKey: "faqQ11", aKey: "faqA11" },
      { qKey: "faqQ12", aKey: "faqA12" },
      { qKey: "faqQ13", aKey: "faqA13" },
    ],
  },
  {
    categoryKey: "faqCatContact",
    questions: [
      { qKey: "faqQ14", aKey: "faqA14" },
      { qKey: "faqQ15", aKey: "faqA15" },
      { qKey: "faqQ16", aKey: "faqA16" },
    ],
  },
  {
    categoryKey: "faqCatTalentsSkills",
    questions: [
      { qKey: "faqQ17", aKey: "faqA17" },
      { qKey: "faqQ18", aKey: "faqA18" },
    ],
  },
];

export default function FAQ() {
  const t = useTranslation(globalI18n);
  const [search, setSearch] = useState("");

  const filtered = FAQ_ITEMS.map((cat) => ({
    ...cat,
    questions: cat.questions.filter(
      (item) =>
        t(item.qKey).includes(search) || t(item.aKey).includes(search) || !search,
    ),
  })).filter((cat) => cat.questions.length > 0);

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-4xl">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8 sm:mb-12"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full text-xs sm:text-sm font-medium text-primary mb-3">
          <HelpCircle className="h-3.5 w-3.5" />
          <span>{t("faq")}</span>
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold mb-3">
          {t("faq")}
        </h1>
        <p className="text-sm sm:text-lg text-muted-foreground max-w-2xl mx-auto">
          {t("faqSubtitle")}
        </p>
      </motion.div>

      <div className="relative max-w-md mx-auto mb-8 sm:mb-10">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("faqSearchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 sm:h-11 pr-10 text-sm"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-6"
      >
        {filtered.map((cat, i) => (
          <motion.div
            key={cat.categoryKey}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
          >
            <Card>
              <CardContent className="p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl font-bold mb-4 text-primary">
                  {t(cat.categoryKey)}
                </h2>
                <Accordion type="multiple" className="w-full">
                  {cat.questions.map((item, j) => (
                    <AccordionItem key={j} value={`${i}-${j}`}>
                      <AccordionTrigger className="text-xs sm:text-sm text-start">
                        {t(item.qKey)}
                      </AccordionTrigger>
                      <AccordionContent className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                        {t(item.aKey)}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="mt-8 sm:mt-10 text-center p-6 sm:p-8 bg-gradient-to-br from-primary/5 to-secondary/5 rounded-2xl border border-primary/10"
      >
        <MessageCircle className="h-8 w-8 text-primary mx-auto mb-3" />
        <h3 className="text-base sm:text-lg font-bold mb-2">{t("faqNotFound")}</h3>
        <p className="text-xs sm:text-sm text-muted-foreground mb-4">
          {t("faqSupportReady")}
        </p>
        <a
          href="/complaints"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <MessageCircle className="h-4 w-4" />
          {t("faqContactUs")}
        </a>
      </motion.div>
    </div>
  );
}
