import { useState, useEffect } from "react";
import { Link } from "wouter";
import { BookOpen, ArrowRight, Loader2, RefreshCw, Plus, Check, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useCourses, useRetakeOptions, useAddMyRetake, useDeleteMyRetake } from "@/lib/api";
import { useTranslation, globalI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

export default function Courses() {
  const { data: courses = [], isPending, isError } = useCourses();
  const { data: retakeOptions = [] } = useRetakeOptions();
  const queryClient = useQueryClient();
  const addRetake = useAddMyRetake();
  const delRetake = useDeleteMyRetake();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const t = useTranslation(globalI18n);

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["v2", "courses"] });
    queryClient.removeQueries({ queryKey: ["v2", "courses"] });
  }, []);

  if (isPending || isError) return <div className="p-8 text-center flex items-center justify-center gap-2"><Loader2 className="h-5 w-5 animate-spin" /> {t("loading")}</div>;

  const byYear = new Map<number, typeof courses>();
  for (const c of courses) {
    const y = c.yearInCollege || 0;
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y)!.push(c);
  }
  const years = Array.from(byYear.keys()).sort((a, b) => (b === 0 ? -1 : a === 0 ? 1 : a - b));
  const yearName = (y: number) => (y === 0 ? "عام" : `سنة ${y}`);

  const retakeByYear = new Map<number, typeof retakeOptions>();
  for (const r of retakeOptions) {
    const y = r.sourceYear;
    if (!retakeByYear.has(y)) retakeByYear.set(y, []);
    retakeByYear.get(y)!.push(r);
  }
  const retakeYears = Array.from(retakeByYear.keys()).sort((a, b) => b - a);

  const toggleRetake = async (courseTitle: string, sourceYear: number, carried: boolean, carriedId: number | null) => {
    try {
      if (carried) {
        await delRetake.mutateAsync(carriedId!);
        toast({ title: `تمت إزالة «${courseTitle}» من المعادات` });
      } else {
        await addRetake.mutateAsync({ courseTitle, sourceYear });
        toast({ title: `تمت إضافة «${courseTitle}» كاستعادة للمادة` });
      }
    } catch (e) {
      toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" });
    }
  };

  function renderSection(year: number, semester: number) {
    const list = byYear.get(year)!.filter((c) => (c.semester || 1) === semester);
    if (!list.length) return null;
    return (
      <div className="mb-5">
        <h3 className="text-sm sm:text-lg font-bold mb-3 flex items-center gap-2">
          <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${semester === 1 ? "bg-primary" : "bg-secondary"}`} />
          {semester === 1 ? t("firstSemester") : t("secondSemester")}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {list.map(renderCourse)}
        </div>
      </div>
    );
  }

  function renderCourse(course: any) {
    return (
      <Link key={course.id} href={`/courses/${course.id}`} className="group bg-card rounded-2xl border border-border overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col h-full">
        <div className="h-32 sm:h-40 bg-muted relative overflow-hidden">
          {course.coverUrl ? (
            <img src={course.coverUrl} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-primary/5">
              <BookOpen className="w-10 h-10 sm:w-12 sm:h-12 text-primary/20" />
            </div>
          )}
          <div className="absolute top-3 sm:top-4 start-3 sm:start-4 bg-background/90 backdrop-blur-sm px-2 py-1 rounded-md text-[10px] sm:text-xs font-bold shadow-sm">
            {course.code}
          </div>
          {course.yearInCollege && (
            <div className="absolute bottom-3 start-3 max-w-[calc(100%-24px)] bg-background/90 backdrop-blur-sm px-2 py-1 rounded-md text-[10px] sm:text-xs font-bold shadow-sm">
              {yearName(course.yearInCollege)}
            </div>
          )}
        </div>

        <div className="p-4 sm:p-6 flex flex-col flex-1">
          <h3 className="font-bold text-base sm:text-xl mb-1.5 sm:mb-2 line-clamp-1 group-hover:text-primary transition-colors">{course.title}</h3>
          <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4 line-clamp-2">{course.description}</p>

          <div className="mt-auto">
            <div className="flex justify-between text-[10px] sm:text-xs text-muted-foreground mb-1.5 sm:mb-2 flex-wrap gap-1">
              <span>{t("instructorPrefix")}{course.instructor}</span>
              <span>{course.department}</span>
            </div>
            <div className="flex items-center justify-between text-sm font-bold text-primary group-hover:gap-2 transition-all">
              <span>{t("viewCourse")}</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
      <div className="flex items-start justify-between flex-wrap gap-2 sm:gap-3 mb-4 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-4xl font-serif font-bold text-primary mb-1 sm:mb-2">{t("coursesPageTitle")}</h1>
          <p className="text-muted-foreground text-xs sm:text-sm">{t("coursesSubtitle")}</p>
        </div>
        {!!retakeOptions.length && (
          <Button onClick={() => setOpen(true)} className="h-9 sm:h-10 text-xs sm:text-sm"><RefreshCw className="me-2 h-3.5 w-3.5 sm:h-4 sm:w-4" /> المواد المعادة</Button>
        )}
      </div>

      {years.map((year) => (
        <section key={year} className="mb-6 sm:mb-10">
          <h2 className="text-lg sm:text-2xl font-bold mb-3 sm:mb-4 flex items-center gap-2">
            <span className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-primary" />
            {yearName(year)}
          </h2>
          {renderSection(year, 1)}
          {renderSection(year, 2)}
        </section>
      ))}

      {!courses.length && (
        <div className="text-center text-muted-foreground py-10 sm:py-12">
          <BookOpen className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm">{t("noCoursesYet")}</p>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh]">
          <DialogHeader><DialogTitle className="text-base sm:text-lg flex items-center gap-2"><RefreshCw className="h-4 w-4 text-primary" /> المواد المعادة</DialogTitle></DialogHeader>
          <p className="text-xs sm:text-sm text-muted-foreground">
            المادة اللي إنت معيدها من سنّة قبل سنتك هتظهر هنا — سواء في المقررات أو في جدولك. اختار المقرر بتاعك:
          </p>
          <div className="space-y-3 max-h-[55vh] overflow-y-auto pe-1">
            {retakeYears.map((y) => (
              <div key={y}>
                <h4 className="text-xs sm:text-sm font-bold text-primary mb-1.5">سنة {y}</h4>
                <div className="space-y-1.5">
                  {retakeByYear.get(y)!.map((r) => (
                    <div key={`${y}|${r.courseTitle}`} className={`flex items-center justify-between gap-2 border rounded-lg px-3 py-2 ${r.carried ? "bg-primary/10 border-primary/40" : "bg-card"}`}>
                      <div className="min-w-0">
                        <div className="text-sm font-bold truncate">{r.courseTitle}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{r.blocks.map((b) => `${b.day} ${b.startTime}`).join(" · ") || "مقرر معاد"}</div>
                      </div>
                      <button
                        onClick={() => toggleRetake(r.courseTitle, r.sourceYear, r.carried, r.carriedId)}
                        disabled={addRetake.isPending || delRetake.isPending}
                        className={`shrink-0 text-xs font-bold px-2.5 py-1.5 rounded-lg border flex items-center gap-1 ${
                          r.carried ? "text-destructive border-destructive/40 hover:bg-destructive/10" : "text-primary border-primary/40 bg-primary/5 hover:bg-primary/10"
                        }`}
                      >
                        {r.carried ? <><X className="h-3.5 w-3.5" /> مُضافة</> : <><Plus className="h-3.5 w-3.5" /> إضافة</>}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {!retakeYears.length && <p className="text-center text-muted-foreground text-sm py-6">مفيش مواد متاحة للاستعادة من سنوات قبل سنتك.</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} className="text-xs sm:text-sm"><Check className="me-1.5 h-4 w-4" /> تم</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}