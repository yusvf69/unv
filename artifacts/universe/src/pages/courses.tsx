import { useState } from "react";
import { Link } from "wouter";
import { BookOpen, Users, ArrowRight } from "lucide-react";
import { useAdminCourses } from "@/lib/api";

export default function Courses() {
  const { data: courses = [], isLoading } = useAdminCourses();

  if (isLoading) return <div className="p-8 text-center">جاري التحميل...</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-serif font-bold text-primary mb-2">المقررات الدراسية</h1>
      <p className="text-muted-foreground mb-8">استعرض المقررات وابدأ التعلم</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.map(course => (
          <Link key={course.id} href={`/courses/${course.id}`} className="group bg-card rounded-2xl border border-border overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col h-full">
            <div className="h-40 bg-muted relative overflow-hidden">
              {course.coverUrl ? (
                <img src={course.coverUrl} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-primary/5">
                  <BookOpen className="w-12 h-12 text-primary/20" />
                </div>
              )}
              <div className="absolute top-4 start-4 bg-background/90 backdrop-blur-sm px-2 py-1 rounded-md text-xs font-bold shadow-sm">
                {course.code}
              </div>
            </div>
            
            <div className="p-6 flex flex-col flex-1">
              <h3 className="font-bold text-xl mb-2 line-clamp-1 group-hover:text-primary transition-colors">{course.title}</h3>
              <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{course.description}</p>
              
              <div className="mt-auto">
                <div className="flex justify-between text-xs text-muted-foreground mb-2">
                  <span>د. {course.instructor}</span>
                  <span>{course.department}</span>
                </div>
                <div className="flex items-center justify-between text-sm font-bold text-primary group-hover:gap-2 transition-all">
                  <span>عرض المقرر</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
      
      {!courses.length && (
        <div className="text-center text-muted-foreground py-12">
          <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
          <p>لا توجد مقررات بعد</p>
        </div>
      )}
    </div>
  );
}
