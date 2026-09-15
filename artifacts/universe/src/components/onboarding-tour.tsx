import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  Sparkles, Home, Newspaper, LayoutDashboard, CalendarDays, BookOpen,
  Files, Library, GraduationCap, Calendar, ClipboardList, Zap, MessagesSquare,
  Gamepad2, Star, ShieldAlert, Ban, PhoneCall, CheckCircle2, ChevronRight, ChevronLeft, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMeV2, useMarkOnboardingSeen } from "@/lib/api";

interface TourStep {
  icon: React.ReactNode;
  title: string;
  body: string;
  route?: string;
  tone?: "default" | "warn" | "danger" | "success";
}

export default function OnboardingTour() {
  const { data: me, isPending } = useMeV2();
  const markSeen = useMarkOnboardingSeen();
  const [, navigate] = useLocation();
  const [step, setStep] = useState(0);

  const name = me?.name?.split(" ")[0] || "صديقي";

  const steps: TourStep[] = [
    { icon: <Sparkles className="h-5 w-5" />, title: `أهلاً بيك ${name}!`, body: "ده موقع كلية الزراعة الذكية — UniVerse. جولة سريعة هتعرفك بكل قسم في السايت وإيه اللي هتعمله فيه، وفي الآخر هقولك التحذيرات المهمة. كمل معايا." },
    { icon: <Home className="h-5 w-5" />, title: "الرئيسية", route: "/", body: "أول صفحة تشوفها بعد الدخول. فيها آخر الأخبار والفعاليات والحاجات المهمة المحصلة جوه السايت كله." },
    { icon: <Newspaper className="h-5 w-5" />, title: "الأخبار", route: "/news", body: "أخبار الكلية الرسمية والنشاطات اللي بتحصل — كل جديد بيتنشر هنا أول بأول." },
    { icon: <LayoutDashboard className="h-5 w-5" />, title: "لوحة المعلومات", route: "/dashboard", body: "داشبوردك الشخصي: نقاطك، مستواك، تقدمك في المقررات، درجاتك، ومساراتك — كل حاجة في مكان واحد." },
    { icon: <CalendarDays className="h-5 w-5" />, title: "الجدول", route: "/schedule", body: "جدول محاضراتك باليوم والساعة. لو إنت معيد مادة من سنة، هتلاقيها مظبوطة في جدولك في وقتها." },
    { icon: <BookOpen className="h-5 w-5" />, title: "المقررات", route: "/courses", body: "مقرراتك الدراسية مقسّمة حسب سنتك (أولى، تانية، تالتة، رابعة) وترمين — الترم الأول والثاني. إنت وحدك شايف مقررات سنتك، ولو معيد مادة من سنة قبل كده هتظهر مقررتها لوحدها." },
    { icon: <Files className="h-5 w-5" />, title: "ملفات المواد", route: "/materials", body: "ملفات ومحاضرات كل مقرر — PDF وفيديوهات وشرائح. ادخل على مقررك وحمّل أو شوف كل الملفات المرفوعة." },
    { icon: <Library className="h-5 w-5" />, title: "الكتب الإلكترونية", route: "/ebooks", body: "مكتبة الكتب الإلكترونية بتاعة الكلية — كل كتاب ليه غلاف، وبتقدر تدوّر بالموضوع، ومقسّمة على السنين الأربعة." },
    { icon: <GraduationCap className="h-5 w-5" />, title: "ملخصات الطلبة", route: "/summaries", body: "ملخصات بينشرها زمايلك الطلبة لبعض — فيه لايكات وترتيب. تقدر تستفيد بيها وتنشر ملخصك إنت كمان." },
    { icon: <Calendar className="h-5 w-5" />, title: "الأحداث", route: "/events", body: "مواعيد الامتحانات والفعاليات القادمة — هتحضّر قبل ما ييجي وقتها." },
    { icon: <ClipboardList className="h-5 w-5" />, title: "الاختبارات", route: "/quizzes", body: "امتحانات تجريبية وكويزات لكل مقرر — مقيّم نفسك وتشوف نتيجتك فورًا." },
    { icon: <Zap className="h-5 w-5" />, title: "المهارات", route: "/skills", body: "تعلم مهارات في مسارات متسلسلة خطوة بخطوة — خد كل خطوة ورا اللي قبلها واجمع نقاط." },
    { icon: <MessagesSquare className="h-5 w-5" />, title: "المنتدى", route: "/forum", body: "منطقة النقاش العامة — اسأل على أي حاجة دراسية وأجوب زمايلك، وشارك برأيك في المواضيع." },
    { icon: <Gamepad2 className="h-5 w-5" />, title: "الألعاب", route: "/games", body: "ألعاب تعليمية وتحديات بين زمايلك — التعلم بيسليك وبيزيد نقاطك." },
    { icon: <Star className="h-5 w-5" />, title: "المواهب", route: "/talents", body: "اعرض موهبتك وشوف مواهب زمايلك — لايكات وتعليقات لكل موهبة." },
    { icon: <ShieldAlert className="h-5 w-5" />, title: "تحذير مهم: المراسلات", tone: "warn", body: "الرسايل والمراسلات اللي على السايت غير مشفّرة، والجهة المسؤولة ليها الحق الكامل تطلع على المحادثات في أي وقت يلزم فيه للمراجعة أو التحقيق." },
    { icon: <Ban className="h-5 w-5" />, title: "تحذير صارم: ممنوع التداول", tone: "danger", body: "ممنوع نهائيًا تداول أو مشاركة أي حاجة من السايت — محاضرات، ملفات، ملخصات، كتب — برا السايت. اللي بيعمل كده بيبقى عرضة للمساءلة القانونية وحسابه بيتشال نهائيًا." },
    { icon: <PhoneCall className="h-5 w-5" />, title: "تحذير: مضايقة أو إساءة", tone: "danger", body: "ممنوع مضايقة أو سب أو إهانة أي حد في السايت (في الرسايل أو المنتدى). أي إساءة بتتحاسب قانونيًا وحسابك في خطر." },
    { icon: <CheckCircle2 className="h-5 w-5" />, title: "دي كل حاجة!", tone: "success", body: "كده عرفت كل الأقسام والتحذيرات. افتح أي قسم وخد وقتك، وإنت في أي وقت تقدر ترجع لأي صفحة من القايمة. نتمنى لك سنة حلوة!" },
  ];

  const last = steps.length - 1;
  const s = steps[step];

  const go = (dir: number) => setStep((p) => Math.min(last, Math.max(0, p + dir)));

  const finish = async () => {
    try { await markSeen.mutateAsync(); } catch {}
  };

  if (isPending) return null;
  if (!me || me.onboarded) return null;

  const toneStyles: Record<string, string> = {
    default: "border bg-card",
    warn: "border-amber-500/60 bg-amber-500/10",
    danger: "border-red-500/60 bg-red-500/10",
    success: "border-green-500/60 bg-green-500/10",
  };

  return (
    <div className="fixed bottom-20 start-4 sm:bottom-24 sm:start-5 z-[100] w-[calc(100vw-2rem)] max-w-sm">
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className={`rounded-2xl shadow-2xl border p-4 ${toneStyles[s.tone ?? "default"]}`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-primary/10 text-primary">{s.icon}</span>
              <h3 className="font-bold text-sm sm:text-base">{s.title}</h3>
            </div>
            <button onClick={finish} className="p-1 rounded hover:bg-muted" title="إغلاق الجولة"><X className="h-4 w-4 text-muted-foreground" /></button>
          </div>

          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{s.body}</p>

          <div className="mt-4 space-y-2.5">
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              {step > 0 && (
                <Button variant="ghost" size="sm" onClick={() => go(-1)} className="text-xs px-2" title="السابق"><ChevronRight className="h-4 w-4" /></Button>
              )}
              {s.route && !["warn", "danger", "success"].includes(s.tone ?? "") && (
                <Button variant="outline" size="sm" onClick={() => navigate(s.route!)} className="text-xs px-2.5 whitespace-nowrap">افتح القسم</Button>
              )}
              {step < last ? (
                <Button size="sm" onClick={() => go(1)} className="text-xs px-3 whitespace-nowrap">{step === 0 ? "يلا بينا" : "التالي"} <ChevronLeft className="h-4 w-4" /></Button>
              ) : (
                <Button size="sm" onClick={finish} className="text-xs px-3 whitespace-nowrap"><CheckCircle2 className="me-1.5 h-4 w-4" /> ابدأ السايت</Button>
              )}
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                {steps.map((_, i) => (
                  <span key={i} className={`h-1 rounded-full transition-all ${i === step ? "w-4 bg-primary" : "w-1.5 bg-muted"}`} />
                ))}
              </div>
              <span className="text-[10px] text-muted-foreground">خطوة {step + 1} من {last + 1}</span>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}