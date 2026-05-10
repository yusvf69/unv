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
    category: "الحساب والتسجيل",
    questions: [
      {
        q: "كيف يمكنني إنشاء حساب في المنصة؟",
        a: "يمكنك التسجيل عبر صفحة تسجيل الدخول باستخدام بريدك الإلكتروني الجامعي. ستحتاج لإدخال اسمك، بريدك الإلكتروني، رقم هاتفك، وكلمة مرور قوية. بعد التسجيل، سيتم إرسال رمز تأكيد لبريدك الإلكتروني.",
      },
      {
        q: "نسيت كلمة المرور، ماذا أفعل؟",
        a: "من صفحة تسجيل الدخول، اختر 'نسيت كلمة المرور' وأدخل بريدك الإلكتروني المسجل. سيتم إرسال رابط إعادة تعيين كلمة المرور لبريدك.",
      },
      {
        q: "هل يمكنني تغيير بياناتي الشخصية؟",
        a: "نعم، من صفحة الملف الشخصي يمكنك تعديل اسمك، صورتك الشخصية، رقم هاتفك، وغيرها من البيانات.",
      },
    ],
  },
  {
    category: "المقررات الدراسية",
    questions: [
      {
        q: "كيف أجد المقررات الدراسية الخاصة بي؟",
        a: "من صفحة 'المقررات' ستظهر قائمة بجميع المقررات المتاحة. يمكنك اختيار مقرك لمشاهدة المحاضرات، ملفات المواد، والفيديوهات التعليمية.",
      },
      {
        q: "هل يمكنني تحميل ملفات المواد؟",
        a: "نعم، من صفحة المحاضرات يمكنك تحميل ملفات PDF الخاصة بكل محاضرة. كما يمكنك مشاهدة الفيديوهات التعليمية مباشرة من المنصة.",
      },
      {
        q: "كيف أتابع تقدمي في المقرر؟",
        a: "من لوحة المعلومات، يمكنك رؤية نسبة تقدمك في كل مقرر دراسي، بالإضافة إلى عدد المحاضرات التي شاهدتها والملفات التي حملتها.",
      },
    ],
  },
  {
    category: "الجدول الدراسي",
    questions: [
      {
        q: "كيف أعرف جدول المحاضرات الخاص بي؟",
        a: "من صفحة 'الجدول' يمكنك مشاهدة جدول المحاضرات والامتحانات الخاصة بمجموعتك الدراسية. يعرض الجدول أيام الأسبوع مع أوقات المحاضرات وأسماء القاعات.",
      },
      {
        q: "ماذا أفعل إذا كان الجدول غير محدث؟",
        a: "في حال وجود أي خطأ أو نقص في الجدول، يمكنك التواصل مع الإدارة عبر صفحة 'الشكاوى' أو مراسلة الدعم الفني.",
      },
    ],
  },
  {
    category: "الاختبارات",
    questions: [
      {
        q: "كيف أشارك في الاختبارات؟",
        a: "من صفحة 'الاختبارات' ستظهر قائمة بالاختبارات المتاحة. اختر الاختبار الذي تريد وابدأ الإجابة. تأكد من اتصالك الجيد بالإنترنت قبل البدء.",
      },
      {
        q: "هل يمكنني رؤية نتائج اختباراتي السابقة؟",
        a: "نعم، بعد إتمام الاختبار يمكنك رؤية نتيجتك فوراً. كما يمكنك العودة لاحقاً لمراجعة إجاباتك ونتائجك من نفس الصفحة.",
      },
    ],
  },
  {
    category: "النقاط والمستويات",
    questions: [
      {
        q: "كيف أحصل على النقاط؟",
        a: "يمكنك كسب النقاط بعدة طرق: إتمام المهام اليومية، المشاركة في المنتدى، حل الاختبارات، مشاهدة المحاضرات، وتحميل الملخصات.",
      },
      {
        q: "ما هي فائدة المستويات؟",
        a: "كلما زادت نقاطك، ارتفع مستواك. المستويات تعكس نشاطك وتفاعلك في المنصة، وتفتح لك ميزات جديدة وتقديراً بين زملائك.",
      },
      {
        q: "كيف أشارك في لوحة الشرف؟",
        a: "لوحة الشرف تعرض الطلاب الأكثر نشاطاً بناءً على نقاطهم. كلما زاد نشاطك، زادت فرصك في الظهور في لوحة الشرف.",
      },
    ],
  },
  {
    category: "التواصل والدعم",
    questions: [
      {
        q: "كيف أتواصل مع الدعم الفني؟",
        a: "يمكنك التواصل معنا عبر صفحة 'الشكاوى والتواصل'، أو عبر بوت التليجرام، أو جروب التليجرام، أو الواتساب. فريق الدعم يرد خلال 24-48 ساعة عمل.",
      },
      {
        q: "كيف أبلغ عن مشكلة تقنية؟",
        a: "يمكنك الإبلاغ عن المشاكل التقنية من صفحة 'الإبلاغ عن مشكلة تقنية' أو عبر صفحة التواصل. يرجى تقديم وصف تفصيلي للمشكلة مع صور إن أمكن.",
      },
      {
        q: "هل يمكنني اقتراح ميزات جديدة؟",
        a: "بالتأكيد! نرحب باقتراحاتك دائماً. يمكنك إرسال اقتراحاتك عبر صفحة التواصل، وسيتم دراستها من قبل فريق التطوير.",
      },
    ],
  },
  {
    category: "المواهب والمهارات",
    questions: [
      {
        q: "كيف أشارك مواهبي في المنصة؟",
        a: "من صفحة 'المواهب' يمكنك إنشاء منشور يعرض موهبتك. يمكنك إضافة صور وفيديو ووصف لموهبتك ليطلع عليها زملاؤك.",
      },
      {
        q: "ما هي مسارات المهارات؟",
        a: "مسارات المهارات هي دورات تدريبية قصيرة داخل المنصة تغطي مواضيع مختلفة. يمكنك الالتحاق بها وتطوير مهاراتك والحصول على شهادات إتمام.",
      },
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
        item.q.includes(search) || item.a.includes(search) || !search,
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
          إجابات لأكثر الأسئلة شيوعاً عن منصة UniVerse
        </p>
      </motion.div>

      <div className="relative max-w-md mx-auto mb-8 sm:mb-10">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="ابحث في الأسئلة..."
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
            key={cat.category}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
          >
            <Card>
              <CardContent className="p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl font-bold mb-4 text-primary">
                  {cat.category}
                </h2>
                <Accordion type="multiple" className="w-full">
                  {cat.questions.map((item, j) => (
                    <AccordionItem key={j} value={`${i}-${j}`}>
                      <AccordionTrigger className="text-xs sm:text-sm text-start">
                        {item.q}
                      </AccordionTrigger>
                      <AccordionContent className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                        {item.a}
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
        <h3 className="text-base sm:text-lg font-bold mb-2">لم تجد إجابتك؟</h3>
        <p className="text-xs sm:text-sm text-muted-foreground mb-4">
          فريق الدعم لدينا جاهز لمساعدتك
        </p>
        <a
          href="/complaints"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <MessageCircle className="h-4 w-4" />
          تواصل معنا
        </a>
      </motion.div>
    </div>
  );
}
