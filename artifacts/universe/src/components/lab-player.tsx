import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, CheckCircle2, Circle, Beaker, FileText, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input as InputField } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import type { LabStep } from "@/lib/api";

interface LabPlayerProps {
  steps: LabStep[];
  lessonTitle: string;
  onComplete: () => void;
  onClose: () => void;
}

export default function LabPlayer({ steps, lessonTitle, onComplete, onClose }: LabPlayerProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [showSummary, setShowSummary] = useState(false);

  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;
  const isLast = currentStep >= steps.length - 1;
  const allAnswered = useMemo(() => {
    const inputSteps = steps.filter((s) => s.kind === "input");
    return inputSteps.every((s) => (answers[s.id]?.trim().length ?? 0) > 0);
  }, [steps, answers]);

  const handleNext = () => {
    if (isLast) {
      setShowSummary(true);
    } else {
      setCurrentStep((c) => c + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep((c) => c - 1);
  };

  const Icon = step?.kind === "input" ? FileText : Beaker;

  if (showSummary) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card border rounded-2xl p-6 text-center max-w-lg mx-auto"
      >
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="h-8 w-8 text-emerald-500" />
        </div>
        <h2 className="text-xl font-bold mb-2">تم إكمال التجربة!</h2>
        <p className="text-sm text-muted-foreground mb-4">{lessonTitle}</p>
        <div className="bg-muted/30 rounded-xl p-4 mb-4 text-right">
          <h3 className="font-bold text-sm mb-2">ملاحظاتك:</h3>
          {steps.filter((s) => s.kind === "input").map((s) => (
            <div key={s.id} className="mb-2 text-xs">
              <span className="font-medium">{s.title}:</span>
              <p className="text-muted-foreground mt-0.5">{answers[s.id] || "—"}</p>
            </div>
          ))}
        </div>
        <Button onClick={onComplete} className="gap-2">
          <CheckCircle2 className="h-4 w-4" /> تأكيد الإكمال
        </Button>
      </motion.div>
    );
  }

  if (!step) return null;

  return (
    <div className="bg-card border rounded-xl sm:rounded-2xl overflow-hidden max-w-2xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 to-secondary/10 p-3 sm:p-4 flex items-center gap-3">
        <div className="p-1.5 rounded-lg bg-primary/10">
          <FlaskConical className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm truncate">{lessonTitle}</h3>
          <p className="text-[10px] text-muted-foreground">تجربة معملية</p>
        </div>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onClose}>إغلاق</Button>
      </div>

      {/* Progress */}
      <div className="px-3 sm:px-4 pt-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>الخطوة {currentStep + 1} من {steps.length}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>

      {/* Step content */}
      <div className="p-3 sm:p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="p-1.5 rounded-lg bg-primary/5 shrink-0">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h4 className="font-bold text-sm">{step.title}</h4>
                {step.kind === "input" && (
                  <p className="text-[10px] text-muted-foreground">أدخل إجابتك أدناه</p>
                )}
              </div>
            </div>

            <div className="bg-muted/20 rounded-xl p-3 sm:p-4 mb-3 text-xs sm:text-sm leading-relaxed whitespace-pre-line">
              {step.description}
            </div>

            {step.kind === "input" && (
              <div className="space-y-2">
                {(step.description?.includes("سجّل") || step.description?.includes("سجل")) ? (
                  <Textarea
                    placeholder={step.config?.placeholder || "أدخل إجابتك..."}
                    value={answers[step.id] ?? ""}
                    onChange={(e) => setAnswers((a) => ({ ...a, [step.id]: e.target.value }))}
                    rows={4}
                    className="text-sm"
                  />
                ) : (
                  <InputField
                    placeholder={step.config?.placeholder || "أدخل إجابتك..."}
                    value={answers[step.id] ?? ""}
                    onChange={(e) => setAnswers((a) => ({ ...a, [step.id]: e.target.value }))}
                    className="text-sm"
                  />
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="border-t px-3 sm:px-4 py-3 flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrev}
          disabled={currentStep === 0}
          className="gap-1 text-xs"
        >
          <ChevronRight className="h-3 w-3" /> السابق
        </Button>
        <div className="flex items-center gap-1">
          {steps.map((_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full ${i <= currentStep ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>
        <Button
          size="sm"
          onClick={handleNext}
          disabled={step.kind === "input" && !(answers[step.id]?.trim().length > 0)}
          className="gap-1 text-xs"
        >
          {isLast ? "النتائج" : "التالي"} {!isLast && <ChevronLeft className="h-3 w-3" />}
        </Button>
      </div>
    </div>
  );
}
