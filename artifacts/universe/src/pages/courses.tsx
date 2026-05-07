import { useState } from "react";
import { BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { useCourses } from "@/lib/api";

export default function Courses() {
  const { data: courses = [], isLoading } = useCourses();
  const [expanded, setExpanded] = useState<number | null>(null);

  if (isLoading) return <div className="p-8 text-center">جاري التحميل...</div>;

  const firstSemester = courses.filter(c => c.semester === 1);
  const secondSemester = courses.filter(c => c.semester === 2);

  function renderCourse(course: any) {
    const open = expanded === course.id;
    return (
      <div key={course.id} className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
        <button onClick={() => setExpanded(open ? null : course.id)} className="w-full flex items-center gap-3 p-3 sm:p-4 text-start hover:bg-muted/50 transition-colors">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] sm:text-xs font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{course.code}</span>
              <h3 className="font-bold text-sm sm:text-base truncate">{course.title}</h3>
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{course.department} - د. {course.instructor}</p>
          </div>
          {open ? <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground shrink-0" />}
        </button>
        {open && (
          <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-0 border-t border-border">
            <p className="text-xs sm:text-sm text-muted-foreground mt-2 sm:mt-3 leading-relaxed">{course.description || "لا يوجد وصف"}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 sm:mt-3 text-[10px] sm:text-xs text-muted-foreground">
              <span>عدد الساعات: {course.credits}</span>
              <span>القسم: {course.department}</span>
              <span>المحاضر: د. {course.instructor}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
      <h1 className="text-2xl sm:text-4xl font-serif font-bold text-primary mb-1 sm:mb-2">المقررات الدراسية</h1>
      <p className="text-muted-foreground text-xs sm:text-sm mb-4 sm:mb-8">اختر المقرر للاطلاع على التفاصيل</p>

      {firstSemester.length > 0 && (
        <div className="mb-6 sm:mb-8">
          <h2 className="text-lg sm:text-2xl font-bold mb-3 sm:mb-4 flex items-center gap-2">
            <span className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-primary" />
            الترم الأول
          </h2>
          <div className="space-y-2 sm:space-y-3">{firstSemester.map(renderCourse)}</div>
        </div>
      )}

      {secondSemester.length > 0 && (
        <div className="mb-6 sm:mb-8">
          <h2 className="text-lg sm:text-2xl font-bold mb-3 sm:mb-4 flex items-center gap-2">
            <span className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-secondary" />
            الترم الثاني
          </h2>
          <div className="space-y-2 sm:space-y-3">{secondSemester.map(renderCourse)}</div>
        </div>
      )}

      {!courses.length && (
        <div className="text-center text-muted-foreground py-10 sm:py-12">
          <BookOpen className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm">لا توجد مقررات بعد</p>
        </div>
      )}
    </div>
  );
}