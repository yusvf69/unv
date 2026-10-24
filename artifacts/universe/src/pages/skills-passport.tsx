import { useState } from "react";
import { Link, useParams } from "wouter";
import { motion } from "framer-motion";
import {
  Award, BookOpen, Building2, Check, Clock, Copy, ExternalLink, FolderKanban,
  Github, GraduationCap, Loader2, Printer, Share2, ShieldCheck, Sparkles, Target, Trophy,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useMySkillPassport, useUserSkillPassport, type SkillPassport, type SkillPassportTrack } from "@/lib/api";

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
const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: "مبتدئ",
  intermediate: "متوسط",
  advanced: "متقدم",
};

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return "—";
  }
}

function CopyButton({ value, label = "نسخ" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {}
      }}
      className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
      {copied ? "تم النسخ" : label}
    </button>
  );
}

function TrackRow({ track }: { track: SkillPassportTrack }) {
  const completed = track.status === "completed";
  return (
    <Link href={`/skills/${track.id}`} className="block">
      <div className="border rounded-xl p-3 sm:p-4 bg-card hover:border-primary/40 transition">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <Badge variant="outline" className="text-[10px]">{track.category}</Badge>
              <Badge variant="outline" className="text-[10px]">{DIFFICULTY_LABELS[track.difficulty] ?? track.difficulty}</Badge>
              {completed && (
                <Badge className="text-[10px] bg-emerald-600 hover:bg-emerald-600 gap-1">
                  <Check className="h-2.5 w-2.5" /> مكتمل
                </Badge>
              )}
            </div>
            <div className="font-bold text-sm truncate">{track.title}</div>
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 ${LEVEL_STYLES[track.level] ?? LEVEL_STYLES.beginner}`}>
            {LEVEL_LABELS[track.level] ?? track.level}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Progress value={Math.round(track.progress * 100)} className="h-1.5 flex-1" />
          <span className="text-[10px] text-muted-foreground shrink-0">
            {track.completedLessons}/{track.totalLessons}
          </span>
        </div>
        {completed && track.certificateCode && (
          <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
            <span className="font-mono" dir="ltr">{track.certificateCode}</span>
            <CopyButton value={track.certificateCode} label="نسخ الكود" />
          </div>
        )}
      </div>
    </Link>
  );
}

function PassportBody({ passport, isPublic }: { passport: SkillPassport; isPublic: boolean }) {
  const { user, stats } = passport;
  const profileUrl = `${window.location.origin}/passport/${user.id}`;
  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-4 sm:space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-700 via-teal-700 to-emerald-900 text-white p-4 sm:p-6"
      >
        <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-16 -right-10 w-52 h-52 rounded-full bg-white/5" />
        <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-3 sm:gap-5">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.name} className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-white/60 shrink-0" />
          ) : (
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/20 border-2 border-white/60 flex items-center justify-center text-2xl font-bold shrink-0">
              {user.name?.charAt(0) || "؟"}
            </div>
          )}
          <div className="flex-1 min-w-0 text-center sm:text-right">
            <div className="flex items-center justify-center sm:justify-start gap-1.5 text-[10px] sm:text-xs text-emerald-100 mb-1">
              <ShieldCheck className="h-3.5 w-3.5" /> جواز مهارات موثّق من UniVerse
            </div>
            <h1 className="text-xl sm:text-2xl font-serif font-bold truncate">{user.name}</h1>
            <div className="text-xs text-emerald-100/90 mb-2">@{user.username}</div>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-3 gap-y-1 text-[10px] sm:text-xs text-emerald-50/90">
              {user.university && <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" />{user.university}</span>}
              {user.faculty && <span className="inline-flex items-center gap-1"><GraduationCap className="h-3 w-3" />{user.faculty}</span>}
              <span className="inline-flex items-center gap-1"><Target className="h-3 w-3" />مستوى {LEVEL_LABELS[passport.level] ?? passport.level}</span>
            </div>
          </div>
          <div className="flex flex-row sm:flex-col gap-2 shrink-0">
            <span className={`text-[10px] px-2.5 py-1 rounded-full border font-bold ${LEVEL_STYLES[passport.level] ?? LEVEL_STYLES.beginner}`}>
              {LEVEL_LABELS[passport.level] ?? passport.level}
            </span>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(profileUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1600);
                } catch {}
              }}
              className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full bg-white/15 hover:bg-white/25 transition"
            >
              {copied ? <Check className="h-3 w-3" /> : <Share2 className="h-3 w-3" />}
              {copied ? "تم نسخ الرابط" : "مشاركة"}
            </button>
          </div>
        </div>
        <div className="relative mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { icon: Trophy, label: "مسارات مكتملة", value: stats.completedTracks },
            { icon: Award, label: "شهادات", value: stats.certificates },
            { icon: BookOpen, label: "دروس مكتملة", value: stats.completedLessons },
            { icon: Clock, label: "دقائق تعلم", value: stats.learningMinutes },
          ].map((s, i) => (
            <div key={i} className="bg-white/10 backdrop-blur rounded-xl p-2 sm:p-3 text-center">
              <s.icon className="h-4 w-4 mx-auto mb-1 text-emerald-100" />
              <div className="font-bold text-sm sm:text-lg leading-tight">{s.value}</div>
              <div className="text-[9px] sm:text-[10px] text-emerald-100/80">{s.label}</div>
            </div>
          ))}
        </div>
      </motion.div>

      {!isPublic && (
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/skills" className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition">
            <Sparkles className="h-3.5 w-3.5" /> استكشف المسارات
          </Link>
          <span className="text-muted-foreground">·</span>
          <Link href="/skills/me" className="text-xs text-primary hover:text-primary/80 transition">ملفي التدريبي</Link>
          <span className="text-muted-foreground">·</span>
          <Link href="/portfolio" className="text-xs text-primary hover:text-primary/80 transition">معرض أعمالي</Link>
          <span className="text-muted-foreground">·</span>
          <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={() => window.print()}>
            <Printer className="h-3 w-3" /> طباعة / حفظ PDF
          </Button>
        </div>
      )}

      <div>
        <div className="flex items-center gap-2 mb-2">
          <Award className="h-4 w-4 text-amber-600" />
          <h2 className="font-bold text-sm sm:text-base">الشهادات</h2>
          <span className="text-[10px] text-muted-foreground">({passport.certificates.length})</span>
        </div>
        {passport.certificates.length === 0 ? (
          <div className="border-2 border-dashed rounded-xl p-6 text-center text-xs text-muted-foreground">
            {isPublic ? "لا توجد شهادات معلنة بعد." : "لسه مفيش شهادات — كمل أي مسار مهارات للحصول على شهادة موثّقة."}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
            {passport.certificates.map((cert) => (
              <div key={cert.code} className="border-2 border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20 rounded-xl p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-xs sm:text-sm truncate">{cert.trackTitle}</div>
                    <div className="text-[10px] text-muted-foreground">{cert.category} · {DIFFICULTY_LABELS[cert.difficulty] ?? cert.difficulty}</div>
                  </div>
                  <Award className="h-6 w-6 text-amber-500 shrink-0" />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-[10px]">
                  <span className="font-mono text-muted-foreground" dir="ltr">{cert.code}</span>
                  <span className={`px-1.5 py-0.5 rounded-full border ${LEVEL_STYLES[cert.level] ?? LEVEL_STYLES.beginner}`}>
                    {LEVEL_LABELS[cert.level] ?? cert.level}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>الدرجة: {cert.score}%</span>
                  <span>{fmtDate(cert.issuedAt)}</span>
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <CopyButton value={cert.code} label="نسخ كود التحقق" />
                  <Link href={`/verify-certificate/${cert.code}`} className="text-[10px] text-primary hover:text-primary/80 transition">تحقق من الشهادة</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <FolderKanban className="h-4 w-4 text-teal-600" />
          <h2 className="font-bold text-sm sm:text-base">معرض الأعمال</h2>
          <span className="text-[10px] text-muted-foreground">({passport.projects?.length ?? 0})</span>
          {!isPublic && (
            <Link href="/portfolio" className="ms-auto text-[10px] text-primary hover:text-primary/80 transition">إدارة المشاريع</Link>
          )}
        </div>
        {!passport.projects?.length ? (
          <div className="border-2 border-dashed rounded-xl p-6 text-center text-xs text-muted-foreground">
            {isPublic ? "لا توجد مشاريع معلنة بعد." : "لسه مفيش مشاريع — ضيف أول مشروع ليك في معرض الأعمال."}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
            {passport.projects.map((project) => (
              <div key={project.id} className="border rounded-xl overflow-hidden bg-card">
                {project.imageUrl && (
                  <img src={project.imageUrl} alt={project.title} className="w-full h-28 object-cover" />
                )}
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-bold text-xs sm:text-sm min-w-0 break-words">{project.title}</div>
                    {project.role && <span className="text-[9px] text-muted-foreground shrink-0">{project.role}</span>}
                  </div>
                  {project.description && (
                    <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2 whitespace-pre-line">{project.description}</p>
                  )}
                  {!!project.tags?.length && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {project.tags.map((tag) => (
                        <span key={tag} className="text-[9px] rounded-full bg-muted px-1.5 py-0.5 text-muted-foreground">#{tag}</span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    {project.projectUrl && (
                      <a href={project.projectUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline">
                        <ExternalLink className="h-3 w-3" /> المشروع
                      </a>
                    )}
                    {project.repoUrl && (
                      <a href={project.repoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline">
                        <Github className="h-3 w-3" /> الكود
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <Target className="h-4 w-4 text-emerald-600" />
          <h2 className="font-bold text-sm sm:text-base">{isPublic ? "المسارات المكتملة" : "مساراتي"}</h2>
          <span className="text-[10px] text-muted-foreground">({passport.tracks.length})</span>
        </div>
        {passport.tracks.length === 0 ? (
          <div className="border-2 border-dashed rounded-xl p-6 text-center text-xs text-muted-foreground">
            {isPublic ? "لا توجد مسارات مكتملة معلنة." : "ابدأ أول مسار مهارات من صفحة المهارات."}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
            {passport.tracks.map((track) => <TrackRow key={track.id} track={track} />)}
          </div>
        )}
      </div>

      <div className="text-center text-[10px] text-muted-foreground border-t pt-3">
        <span className="inline-flex items-center gap-1">
          <ShieldCheck className="h-3 w-3 text-emerald-600" />
          شهادات جواز المهارات صادرة ومحفوظة بشكل دائم على منصة UniVerse — العضو منذ {fmtDate(user.memberSince)}
        </span>
      </div>
    </div>
  );
}

export default function SkillsPassportPage() {
  const { id } = useParams<{ id?: string }>();
  const publicId = id ? Number(id) : null;
  const isValidId = publicId !== null && !Number.isNaN(publicId);
  const invalidId = !!id && !isValidId;
  const myQuery = useMySkillPassport(!id);
  const publicQuery = useUserSkillPassport(isValidId ? publicId : null);
  const query = id ? publicQuery : myQuery;
  const isPublic = !!id;

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-4xl">
      <div className="flex items-center justify-between mb-3">
        <Link href={isPublic ? "/" : "/skills"} className="text-xs text-muted-foreground hover:text-primary transition">
          ← {isPublic ? "الرئيسية" : "المهارات"}
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/verify-certificate" className="text-xs text-emerald-700 dark:text-emerald-400 hover:text-emerald-600 transition inline-flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5" /> تحقق من شهادة
          </Link>
          {!isPublic && (
            <Link href="/profile" className="text-xs text-primary hover:text-primary/80 transition">تعديل بياناتي</Link>
          )}
        </div>
      </div>

      {query.isLoading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!query.isLoading && (query.isError || invalidId) && (
        <div className="text-center py-20 border-2 border-dashed rounded-2xl">
          <ShieldCheck className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm font-bold mb-1">{isPublic ? "الجواز غير موجود" : "مش قادرين نحمّل جوازك"}</p>
          <p className="text-xs text-muted-foreground">تأكد من الرابط أو جرّب تاني بعد شوية.</p>
        </div>
      )}

      {query.data && <PassportBody passport={query.data} isPublic={isPublic} />}
    </div>
  );
}
