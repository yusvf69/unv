import { Link } from "wouter";
import { BookOpen, ArrowRight } from "lucide-react";
import { useCourses } from "@/lib/api";
import { useTranslation, globalI18n } from "@/lib/i18n";

export default function Courses() {
  const { data: courses = [], isLoading } = useCourses();
  const t = useTranslation(globalI18n);

  if (isLoading) return <div className="p-8 text-center">{t("loading")}</div>;

  const firstSemester = courses.filter(c => c.semester === 1);
  const secondSemester = courses.filter(c => c.semester === 2);

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
      <h1 className="text-2xl sm:text-4xl font-serif font-bold text-primary mb-1 sm:mb-2">{t("coursesPageTitle")}</h1>
      <p className="text-muted-foreground text-xs sm:text-sm mb-4 sm:mb-8">{t("coursesSubtitle")}</p>

      {firstSemester.length > 0 && (
        <div className="mb-6 sm:mb-8">
          <h2 className="text-lg sm:text-2xl font-bold mb-3 sm:mb-4 flex items-center gap-2">
            <span className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-primary" />
            {t("firstSemester")}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {firstSemester.map(renderCourse)}
          </div>
        </div>
      )}

      {secondSemester.length > 0 && (
        <div className="mb-6 sm:mb-8">
          <h2 className="text-lg sm:text-2xl font-bold mb-3 sm:mb-4 flex items-center gap-2">
            <span className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-secondary" />
            {t("secondSemester")}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {secondSemester.map(renderCourse)}
          </div>
        </div>
      )}

      {!courses.length && (
        <div className="text-center text-muted-foreground py-10 sm:py-12">
          <BookOpen className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm">{t("noCoursesYet")}</p>
        </div>
      )}
    </div>
  );
}