import { motion } from "framer-motion";
import {
  BookOpen, UserPlus, LayoutDashboard, Calendar, BookOpenCheck,
  GraduationCap, Trophy, MessageSquare, Lightbulb, Star, ArrowLeft,
  ChevronLeft, Monitor,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useTranslation, globalI18n } from "@/lib/i18n";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

const SECTIONS = [
  {
    id: "getting-started",
    icon: UserPlus,
    title: "بدء الاستخدام",
    desc: "كل ما تحتاج لمعرفته للانطلاق في المنصة",
    steps: [
      { title: "إنشاء حساب", desc: "سجل باستخدام بريدك الإلكتروني الجامعي. أدخل اسمك، بريدك، رقم هاتفك، وكلمة مرور قوية." },
      { title: "تفعيل البريد", desc: "ستصلك رسالة تأكيد على بريدك الإلكتروني تحتوي على رمز التفعيل. أدخل الرمز لتفعيل حسابك." },
      { title: "إكمال الملف الشخصي", desc: "أضف صورتك الشخصية وبياناتك ليتعرف عليك زملاؤك. يمكنك أيضاً إضافة نبذة عنك." },
      { title: "استكشاف المنصة", desc: "تصفح الأقسام المختلفة: المقررات، الجدول، المنتدى، والمواهب. ابدأ بمتابعة مقرراتك الدراسية." },
    ],
  },
  {
    id: "dashboard",
    icon: LayoutDashboard,
    title: "لوحة المعلومات",
    desc: "نظرة شاملة على نشاطك الدراسي يومياً",
    steps: [
      { title: "المهام اليومية", desc: "كل يوم تظهر لك مهام محددة. إتمامها يمنحك نقاطاً إضافية ويحفز استمراريتك." },
      { title: "جدول اليوم", desc: "شاهد محاضرات اليوم في نظرة سريعة مع أوقاتها وقاعاتها." },
      { title: "تتبع المذاكرة", desc: "سجل وقت مذاكرتك وشاهد إحصائيات أسبوعية عن تقدمك." },
      { title: "المستوى والنقاط", desc: "تابع نقاطك ومستواك وسلسلة أيام نشاطك المتتالية." },
    ],
  },
  {
    id: "courses",
    icon: BookOpen,
    title: "المقررات الدراسية",
    desc: "تصفح المقررات، المحاضرات، والملفات التعليمية",
    steps: [
      { title: "استعراض المقررات", desc: "من صفحة المقررات، اختر المقرر الذي تريد. ستظهر لك قائمة بالمحاضرات." },
      { title: "المحاضرات", desc: "كل محاضرة تحتوي على فيديو تعليمي، ملفات PDF، وأسئلة تفاعلية." },
      { title: "مشاهدة الفيديوهات", desc: "شاهد فيديوهات المحاضرات مباشرة من المنصة. تتبع تقدمك في كل فيديو." },
      { title: "تحميل الملفات", desc: "حمّل ملفات PDF وأي مرفقات أخرى خاص بكل محاضرة للدراسة دون اتصال." },
    ],
  },
  {
    id: "schedule",
    icon: Calendar,
    title: "الجدول الدراسي",
    desc: "إدارة جدول المحاضرات والامتحانات",
    steps: [
      { title: "جدول المحاضرات", desc: "عرض أسبوعي لمحاضرات مجموعتك مع أوقاتها وقاعاتها وأسماء المحاضرين." },
      { title: "جدول الامتحانات", desc: "مواعيد الامتحانات النصفية والنهائية مع التنبيهات قبل الامتحان." },
      { title: "التنبيهات", desc: "المنصة تنبهك قبل الامتحانات وباقتراب مواعيد المحاضرات." },
    ],
  },
  {
    id: "quizzes",
    icon: GraduationCap,
    title: "الاختبارات",
    desc: "اختبر معلوماتك وتابع نتائجك",
    steps: [
      { title: "الاختبارات المتاحة", desc: "من صفحة الاختبارات، شاهد جميع الاختبارات المتاحة لك." },
      { title: "أثناء الاختبار", desc: "اقرأ الأسئلة جيداً واختر الإجابات. يمكنك التنقل بين الأسئلة بحرية." },
      { title: "النتيجة", desc: "بعد الإنهاء، تظهر نتيجتك فوراً مع تصحيح الإجابات." },
      { title: "المراجعة", desc: "يمكنك العودة لمراجعة اختباراتك السابقة ونتائجها في أي وقت." },
    ],
  },
  {
    id: "community",
    icon: MessageSquare,
    title: "المجتمع",
    desc: "تفاعل مع زملائك في المنتدى والمواهب",
    steps: [
      { title: "المنتدى", desc: "شارك في النقاشات، اطرح أسئلة، وفكر زملاءك. يمكنك التفاعل عبر الإعجابات والردود." },
      { title: "المواهب", desc: "اعرض مواهبك أمام الجميع. أضف صوراً وفيديوهات ووصفاً لموهبتك." },
      { title: "التواصل", desc: "تواصل مع زملائك عبر الرسائل الخاصة. تابع من تريد وتعرف على أصدقاء جدد." },
    ],
  },
  {
    id: "gamification",
    icon: Trophy,
    title: "النقاط والمكافآت",
    desc: "كيف تكسب النقاط وترتقي بالمستويات",
    steps: [
      { title: "كسب النقاط", desc: "أنشطتك اليومية تكسبك نقاطاً: المهام، الاختبارات، المشاركة في المنتدى، مشاهدة المحاضرات." },
      { title: "المستويات", desc: "كل 100 نقطة تصعد مستوى. المستويات الأعلى تظهر تميزك في المنصة." },
      { title: "السلسلة", desc: "حافظ على نشاطك اليومي لبناء سلسلة متصلة. السلسلة الأطول = نقاط إضافية!" },
      { title: "لوحة الشرف", desc: "أفضل الطلاب نشاطاً يظهرون في لوحة الشرف. نافس زملائك وكن الأفضل!" },
    ],
  },
];

export default function Guide() {
  const t = useTranslation(globalI18n);

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-5xl">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8 sm:mb-12"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full text-xs sm:text-sm font-medium text-primary mb-3">
          <BookOpen className="h-3.5 w-3.5" />
          <span>{t("platformGuide")}</span>
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold mb-3">
          {t("platformGuide")}
        </h1>
        <p className="text-sm sm:text-lg text-muted-foreground max-w-2xl mx-auto">
          دليل شامل لاستخدام منصة UniVerse — من التسجيل إلى الإتقان
        </p>
      </motion.div>

      <Tabs defaultValue="getting-started" dir="rtl" className="w-full">
        <TabsList className="w-full flex-wrap h-auto gap-1 mb-6 sm:mb-8">
          {SECTIONS.map((s) => (
            <TabsTrigger
              key={s.id}
              value={s.id}
              className="text-[10px] sm:text-xs flex-1 min-w-[80px] sm:min-w-[100px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <s.icon className="h-3 w-3 sm:h-3.5 sm:w-3.5 me-1" />
              {s.title}
            </TabsTrigger>
          ))}
        </TabsList>

        {SECTIONS.map((section) => (
          <TabsContent key={section.id} value={section.id}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-3 mb-4 sm:mb-6">
                <div className="p-2.5 sm:p-3 rounded-xl bg-primary/10">
                  <section.icon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-2xl font-bold">{section.title}</h2>
                  <p className="text-xs sm:text-sm text-muted-foreground">{section.desc}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {section.steps.map((step, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                  >
                    <Card className="h-full border-border/50 hover:border-primary/20 transition-colors">
                      <CardContent className="p-3 sm:p-5">
                        <div className="flex items-start gap-3">
                          <div className="flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-primary/10 text-primary text-xs sm:text-sm font-bold shrink-0">
                            {i + 1}
                          </div>
                          <div>
                            <h3 className="font-bold text-xs sm:text-sm mb-1">
                              {step.title}
                            </h3>
                            <p className="text-[10px] sm:text-xs text-muted-foreground leading-relaxed">
                              {step.desc}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
