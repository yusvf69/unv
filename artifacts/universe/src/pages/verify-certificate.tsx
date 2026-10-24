import { useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { motion } from "framer-motion";
import {
  Award, CheckCircle2, Loader2, Search, ShieldCheck, XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useVerifyCertificate } from "@/lib/api";

const LEVEL_LABELS: Record<string, string> = {
  mastered: "متقن",
  practitioner: "ممارس",
  learner: "متعلم",
  beginner: "مبتدئ",
};
const LEVEL_STYLES: Record<string, string> = {
  mastered: "bg-amber-100 text-amber-700 border-amber-300",
  practitioner: "bg-emerald-100 text-emerald-700 border-emerald-300",
  learner: "bg-blue-100 text-blue-700 border-blue-300",
  beginner: "bg-slate-100 text-slate-600 border-slate-300",
};

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return "—";
  }
}

export default function VerifyCertificatePage() {
  const { code: routeCode } = useParams<{ code?: string }>();
  const [, setLocation] = useLocation();
  const [input, setInput] = useState(routeCode ?? "");
  const code = routeCode ? decodeURIComponent(routeCode).trim().toUpperCase() : null;
  const { data, isLoading, isError } = useVerifyCertificate(code);

  return (
    <div className="container mx-auto px-3 sm:px-4 py-6 max-w-xl">
      <div className="flex items-center justify-between mb-4">
        <Link href="/" className="text-xs text-muted-foreground hover:text-primary transition">← الرئيسية</Link>
        <Link href="/passport" className="text-xs text-primary hover:text-primary/80 transition">جواز المهارات</Link>
      </div>

      <div className="text-center mb-5">
        <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
          <ShieldCheck className="h-7 w-7 text-emerald-600" />
        </div>
        <h1 className="text-xl sm:text-2xl font-serif font-bold">التحقق من شهادة مهارة</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          أدخل كود الشهادة للتأكد من صحتها ومن بيانات صاحبها.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const clean = input.trim().toUpperCase();
          if (clean) setLocation(`/verify-certificate/${encodeURIComponent(clean)}`);
        }}
        className="flex gap-2 mb-5"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase())}
          placeholder="UNV-SK-XXXXXXXXXX"
          className="font-mono text-sm"
          dir="ltr"
        />
        <Button type="submit" className="gap-1.5 shrink-0">
          <Search className="h-4 w-4" /> تحقق
        </Button>
      </form>

      {!code && (
        <div className="text-center text-[11px] text-muted-foreground border-2 border-dashed rounded-xl p-6">
          الكود موجود في كارت الشهادة داخل جواز المهارات.
        </div>
      )}

      {code && isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {code && !isLoading && isError && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="border-2 border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900 rounded-2xl p-5 text-center">
          <XCircle className="h-10 w-10 mx-auto text-red-500 mb-2" />
          <div className="font-bold text-sm text-red-700 dark:text-red-400">الشهادة غير موجودة أو الكود غير صحيح</div>
          <div className="text-[11px] text-muted-foreground mt-1 font-mono" dir="ltr">{code}</div>
        </motion.div>
      )}

      {code && !isLoading && data && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-2 border-emerald-300 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 rounded-2xl p-4 sm:p-6"
        >
          <div className="flex items-center justify-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold text-sm mb-4">
            <CheckCircle2 className="h-5 w-5" /> شهادة صحيحة وموثّقة
          </div>

          <div className="bg-white dark:bg-background border-2 border-amber-300 dark:border-amber-700 rounded-xl p-4 text-center">
            <Award className="h-10 w-10 mx-auto text-amber-500 mb-2" />
            <div className="text-[10px] text-muted-foreground">تُمنح هذه الشهادة إلى</div>
            <div className="font-bold text-base sm:text-lg mt-1">{data.holderName}</div>
            <div className="text-[10px] text-muted-foreground">@{data.username}</div>
            <div className="mt-3 text-sm font-bold">{data.trackTitle}</div>
            <div className="text-[10px] text-muted-foreground">{data.trackCategory}</div>
            <div className={`inline-block mt-2 px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${LEVEL_STYLES[data.level] ?? LEVEL_STYLES.beginner}`}>
              {LEVEL_LABELS[data.level] ?? data.level}
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              الدرجة: {data.score}% · تاريخ الإصدار: {fmtDate(data.issuedAt)}
            </div>
            <div className="mt-3 pt-3 border-t font-mono text-[11px] text-muted-foreground" dir="ltr">
              {data.code}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Badge variant="outline" className="text-[10px] gap-1 text-emerald-700 border-emerald-300 bg-emerald-50">
              <ShieldCheck className="h-3 w-3" /> صادرة من UniVerse
            </Badge>
            <Link href={`/passport/${data.userId}`} className="text-[10px] text-primary hover:text-primary/80 transition">
              عرض جواز صاحب الشهادة
            </Link>
          </div>
        </motion.div>
      )}
    </div>
  );
}
