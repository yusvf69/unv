import { useState } from "react";
import { motion } from "framer-motion";
import { ShieldAlert, Scale, Lock, FileText, Info, ChevronDown } from "lucide-react";

const SECTIONS = [
  {
    id: "warning",
    icon: ShieldAlert,
    title: "تحذير والتزام بالاستخدام",
    color: "text-red-500 bg-red-500/10",
    body: [
      "السايت ده مخصوص للطلاب وهيئة التدريس الخاصة بالكلية فقط، وأي استخدام من برّاه ممنوع.",
      "الدرجات والجداول والمعلومات اللي بتظهر فوق هي المرجع الرسمي بتاع الكلية — سيب إن فيه بيانات بتتحدث باستمرار.",
      "أي محاولة غش أو اختراق أو تخمين بيانات أو التلاعب بالدرجات أو المحتوى = إجراء تأديبي فوري بيتعرض عليه مالك الحساب.",
      "ممنوع تحاول تعدّل في أي بيانات ليك أو لغيرك بأي طريقة، وممنوع تشارك كلمة السر بتاعتك مع أي حد.",
      "أي سلوك مخالف أو متكرر ممكن يأدي لحذف الحساب نهائيًا من غير إنذار.",
      "⛔ بأنو حاد: ممنوع تداول أو تصوير أو نسخ أي حاجة من جوه السايت لبرّه — أي حد يثبت عليه كده هيتحول للمساءلة القانونية وهيتحذف حسابه تمامًا فورًا.",
    ],
  },
  {
    id: "rights",
    icon: Scale,
    title: "حقوق الملكية",
    color: "text-emerald-500 bg-emerald-500/10",
    body: [
      "كل المحتوى الموجود في السايت — تصميم، شعارات، أكواد، مواد علمية، اختبارات، ملخصات — هو ملكية خاصة للسايت والكلية.",
      "الطالب اللي بينزل ملخصات أو محتوى فيساهم فيه هو صاحب المجهود، وبيوافق أنه بيشاركه من غير ما يطالب بحقوق مادية.",
      "ممنوع نسخ أو إعادة نشر أي جزء من المحتوى في مكان تاني من غير موافقة كتابية.",
      "الكتب الإلكترونية اللي بتظهر في السايت جزء من محتوى السايت نفسه، بتتصمم وفكرة لكلية، وكل حقوقها تتبع السايت وممنوع نقلها أو إعادة نشرها في مكان تاني.",
      "أي محتوى أجانبي برّان خارجه عن تصاميمنا بينحذف حالاً.",
    ],
  },
  {
    id: "privacy",
    icon: Lock,
    title: "الخصوصية وحماية البيانات",
    color: "text-sky-500 bg-sky-500/10",
    body: [
      "بياناتك الشخصية زي اسمك وصورتك ومجموعتك ودرجاتك بتتستخدم جوه السايت بس، عشان المنظومة كلها تشتغل.",
      "محدش يقدر يشوف بياناتك غير هيئة التدريس ومشرفين النظام، ومفيش حد جوه الطلبة يقدر يشوف بيانات حد تاني بتفاصيلها.",
      "كلمة السر وكل الحسابات مؤمّنة، ومفيش جهة خارجية بتاخد بياناتك لأي إعلانات أو غيرها.",
      "إزالة الحساب أو استفسار عن بياناتك تقدر تبعته من صفحة الشكاوى وإحنا هنتعامل معاه.",
      "⚠️ الملاحظة المهمة: المراسلات والرسايل على السايت غير مشفّرة، والجهة المسؤولة ليها الحق الكامل في الاطلاع على المحادثات متى لزم ذلك للمراجعة أو التحقيق.",
    ],
  },
  {
    id: "rules",
    icon: FileText,
    title: "قواعد عامة",
    color: "text-amber-500 bg-amber-500/10",
    body: [
      "كلام محترم في كل حتة — المنتدى، الشات، التعليقات، والمواهب — وأي تنمر أو إساءة = ملغي الحساب.",
      "المحتوى اللي بيتقسّم لازم يكون تعليمي أو مفيد للمجتمع، وأي شي غير كده بيتمسح وقابل للتحقيق في صاحبه.",
      "فكرة النقاط والمستويات والمسابقات دي للتحفيز — أي محاولة اقتحام في نظام النقاط أو الألعاب بتعملك حظر.",
    ],
  },
  {
    id: "info",
    icon: Info,
    title: "إخلاء مسؤولية",
    color: "text-violet-500 bg-violet-500/10",
    body: [
      "السايت بيتطور باستمرار، فممكن فيـِه أعطال وقتية أو بعض الأرقام تتأخر لحد ما تتحدث.",
      "إحنا مش مسؤولين عن أي خسارة نتيجه سوء استخدام من المستخدم نفسه أو عن الروابط الخارجية اللي خارجه عن سيطرتنا.",
      "أي مشكلة تقدر تبلغها من صفحة الشكاوى أو تراسل الإدارة مباشرة — وإحنا هنتصرف.",
    ],
  },
] as const;

export default function Rights() {
  const [openId, setOpenId] = useState<string | null>(SECTIONS[0].id);

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><Scale className="h-6 w-6" /></div>
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold">حقوق وتحذير</h1>
          <p className="text-sm text-muted-foreground">كل حاجة تخص السايت وقواعده ومسؤوليتك ومسؤوليتنا</p>
        </div>
      </div>

      <div className="space-y-3 mt-6">
        {SECTIONS.map((s) => {
          const open = openId === s.id;
          return (
            <motion.div key={s.id} layout className="rounded-2xl border bg-card overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenId(open ? null : s.id)}
                className="w-full flex items-center gap-3 p-4 text-start cursor-pointer"
              >
                <span className={`rounded-xl p-2 ${s.color}`}><s.icon className="h-5 w-5" /></span>
                <span className="flex-1 font-bold text-sm sm:text-base">{s.title}</span>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
              </button>
              {open && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-4 pb-4 space-y-2">
                  {s.body.map((b, i) => (
                    <p key={i} className="text-sm text-muted-foreground leading-relaxed">• {b}</p>
                  ))}
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground mt-8">آخر تحديث للصفحة: 2026 — للأسئلة والأستفسارات استخدم صفحة الشكاوى</p>
    </div>
  );
}