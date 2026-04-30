import { useGetCourse, getGetCourseQueryKey } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { ChevronLeft, FileText, Video, Link as LinkIcon, Download } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function CourseDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: course, isLoading } = useGetCourse(Number(id), {
    query: { enabled: !!id, queryKey: getGetCourseQueryKey(Number(id)) }
  });

  if (isLoading) return <div className="p-8 text-center">Loading...</div>;
  if (!course) return <div className="p-8 text-center">Not found</div>;

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <Link href="/courses" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4 mr-1" />
        Back to Courses
      </Link>

      <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden mb-8">
        <div className="h-64 bg-primary/10 relative">
          {course.coverUrl && (
            <img src={course.coverUrl} alt={course.title} className="w-full h-full object-cover mix-blend-overlay opacity-50" />
          )}
          <div className="absolute inset-0 p-8 flex flex-col justify-end bg-gradient-to-t from-background/90 to-transparent">
            <div className="inline-block px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold w-fit mb-3">
              {course.code}
            </div>
            <h1 className="text-3xl md:text-5xl font-serif font-bold text-foreground mb-2">{course.title}</h1>
            <p className="text-muted-foreground max-w-2xl">{course.description}</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="materials">
        <TabsList className="grid w-full grid-cols-3 mb-8">
          <TabsTrigger value="materials">Materials</TabsTrigger>
          <TabsTrigger value="syllabus">Syllabus</TabsTrigger>
          <TabsTrigger value="instructor">Instructor</TabsTrigger>
        </TabsList>
        
        <TabsContent value="materials" className="space-y-4">
          {course.materials.map((material) => (
            <a key={material.id} href={material.url} target="_blank" rel="noopener noreferrer" className="flex items-center p-4 bg-card border border-border rounded-xl hover:border-primary/50 transition-colors group">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mr-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                {material.kind === 'video' && <Video className="w-5 h-5" />}
                {material.kind === 'pdf' && <FileText className="w-5 h-5" />}
                {material.kind === 'slides' && <Download className="w-5 h-5" />}
                {material.kind === 'link' && <LinkIcon className="w-5 h-5" />}
              </div>
              <div className="flex-1">
                <h3 className="font-bold group-hover:text-primary transition-colors">{material.title}</h3>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{material.kind} {material.durationMinutes && `• ${material.durationMinutes} min`}</p>
              </div>
            </a>
          ))}
        </TabsContent>
        
        <TabsContent value="syllabus">
          <div className="bg-card border border-border rounded-xl p-6">
            <ul className="space-y-4 relative before:absolute before:inset-y-0 before:left-4 before:w-px before:bg-border">
              {course.syllabus.map((item, index) => (
                <li key={index} className="relative pl-10">
                  <div className="absolute left-[11px] top-1.5 w-2 h-2 rounded-full bg-primary ring-4 ring-background" />
                  <div className="font-medium text-sm text-secondary mb-1">Week {index + 1}</div>
                  <div className="text-foreground">{item}</div>
                </li>
              ))}
            </ul>
          </div>
        </TabsContent>
        
        <TabsContent value="instructor">
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="font-bold text-xl mb-4">{course.instructor}</h3>
            <p className="text-muted-foreground whitespace-pre-line">{course.instructorBio}</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
