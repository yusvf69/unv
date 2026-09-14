import { useState } from "react";
import { motion } from "framer-motion";
import { ScrollText, ChevronDown, AlertTriangle, ShieldCheck, Ban, Handshake, Scale } from "lucide-react";

const SECTIONS = [
  {
    id: "responsibility",
    icon: Handshake,
    title: "المسؤولية الكاملة عليك",
    color: "text-red-500 bg-red-500/10",
    body: [
      "بمجرد ما توافق على الشروط دي وتبدأ تستخدم السايت، بتبقى مسؤول مسؤولية كاملة عن أي أفعال منك أو من حسابك، وبتتحمل نتيجتها بالكامل.",
      "كل شيء إنت بتعمله في السايت — كتابة، رفع، مشاركة، شراء... إلخ — هو اختيارك الشخصي وإنت اللي محصل نتيجته.",
      "السايت مش مسؤول عن أي خسارة أو ضرر أو نتيجة من سوء استخدامك أو من قراراتك المعتمدة على البيانات اللي فيه.",
      "البيانات والدرجات والجداول كلها معروضة زي ما وردت من إدارة الكلية، واستخدامها أو الاعتماد عليها مسؤوليتك إنت.",
      "أي محاولة اختراق أو غش أو تلاعب أو سرقة بيانات — إنت اللي هتحاسب عليها قانونيًا وأدبيًا، والسايت بيحتفظ بحقه في البلاغ والتعويض.",
      "لو حسابك استخدم في أي مخالفة، إنت مسؤول عن كل حاجة حصلت منه قبل ما تبلغ إن فيه حد تاني استخدمه.",
    ],
  },
  {
    id: "accept",
    icon: ShieldCheck,
    title: "الموافقة على الشروط",
    color: "text-emerald-500 bg-emerald-500/10",
    body: [
      "التسجيل في السايت يعني إنك قريت وفهمت وقبلت كل الشروط والأحكام دي بموافقة صريحة.",
      "لما تدوس «أوافق» و«إنشاء الحساب» ده بيبقى التزام قانوني بينك وبين السايت، ومفيش مجال للرجوع في القبول.",
      "أي حساب متسجل هو قبول صريح وتلقائي للشروط دي، حتى لو محدش قراها — فاللي مش موافق لازم ميسجلش أصلاً.",
      "لو مش موافق على أي بند من البنود دي، من فضلك متستخدمش السايت خالص.",
    ],
  },
  {
    id: "actions",
    icon: Ban,
    title: "الأفعال اللي ممنوعة واللي هتحاسب عليها",
    color: "text-amber-500 bg-amber-500/10",
    body: [
      "نشر أي محتوى مسيء، أو تنمر، أو سب، أو تحريض على أي حد جوه السايت أو خارجه.",
      "محاولة الوصول لبيانات غيرك أو تخمين كلمات سر أو التلاعب بالدرجات أو النقاط أو النتائج.",
      "نسخ أو إعادة نشر مواد السايت أو الكتب في أي مكان تاني بدون إذن.",
      "إنشاء أكتر من حساب، أو استخدام حساب حد تاني.",
      "أي من الأفعال دي هتتحملها بالكامل، والسايت بيحق له حذف حسابك فورًا من غير تعويض.",
    ],
  },
  {
    id: "release",
    icon: ShieldCheck,
    title: "إخلاء كامل للمسؤولية",
    color: "text-sky-500 bg-sky-500/10",
    body: [
      "السايت بيتقدّم خدمته «كما هي» من غير أي ضمانات، وبيتطور بشكل مستمر وفيه أخطاء وقتية طبيعية.",
      "السايت غير مسؤول عن الأضرار اللي ممكن تنتج من انقطاع الخدمة، أو فقدان بيانات، أو تأخر تحديث المعلومات.",
      "إخلاء المسؤولية ده بيشمل المسؤولية عن أي حاجة ممكن تحصل لك، أو لغيرك، أو لأي طرف تالت نتيجه استخدامك للسايت اللي بيدي من إرادتك الحرة",
    ],
  },
  {
    id: "penalties",
    icon: AlertTriangle,
    title: "الجزاءات والموقف النهائي",
    color: "text-violet-500 bg-violet-500/10",
    body: [
      "أي مخالفة بتتقيم حسب جديتها، وممكن توصل لتحذير أو حذف الحساب نهائيًا أو حرمان من الخدمة.",
      "القرار النهائي في أي نزاع بيتبع إدارة السايت والكلية، ومفيش أساس للاعتراض أو التعويض بعد الإيقاف.",
      "بنحتفظ بحقنا إننا نعدّل الشروط دي في أي وقت، وأي تحديث بينشر في الصفحة دي وبيسري من تاريخ نشره.",
    ],
  },
  {
    id: "contact",
    icon: Scale,
    title: "أسئلة أو استفسار",
    color: "text-teal-500 bg-teal-500/10",
    body: [
      "أي استفسار عن الشروط دي تقدر تلغيعه من صفحة الشكاوى، وإحنا هنرد عليك.",
      "باستمرار استخدامك للسايت بعد ما تقرا الصفحة دي، بتعتبر موقف ومعترف بكل البنود إلي فوق.",
    ],
  },
] as const;

export default function Terms() {
  const [openId, setOpenId] = useState<string | null>(SECTIONS[0].id);

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><ScrollText className="h-6 w-6" /></div>
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold">شروط وأحكام</h1>
          <p className="text-sm text-muted-foreground">اقراها كويس قبل التسجيل — بموافقتك إنت بتتحمل كل اللي بيحصل من حسابك</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-red-500/10 border border-red-500/30 p-3 text-xs sm:text-sm text-red-700 dark:text-red-300 leading-relaxed">
        تنبيه مهم: لو مش موافق على الشروط دي، متسجلش في السايت — التسجيل نفسه بيبقى موافقة صريحة بالكامل.
      </div>

      <div className="space-y-3 mt-5">
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

      <p className="text-center text-xs text-muted-foreground mt-8">آخر تحديث للشروط: 2026 — بتسري على كل المستخدمين بدون استثناء</p>
    </div>
  );
}