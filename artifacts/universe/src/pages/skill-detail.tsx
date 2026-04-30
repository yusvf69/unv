import { useGetSkillTrack, getGetSkillTrackQueryKey } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { ChevronLeft, PlayCircle, CheckCircle2, Circle, Clock, FileText, Target, Trophy } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function SkillDetail() {
  const { id } = useParams<{ id: string }>();
  const trackId = Number(id);
  const { data: track, isLoading } = useGetSkillTrack(trackId, {
    query: { enabled: !!trackId, queryKey: getGetSkillTrackQueryKey(trackId) }
  });

  if (isLoading) return <div className="p-8 text-center">Loading...</div>;
  if (!track) return <div className="p-8 text-center">Not found</div>;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Link href="/skills" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4 mr-1" />
        Back to Skills
      </Link>

      <div className="bg-card rounded-2xl border border-border shadow-sm p-6 md:p-8 mb-8 flex flex-col md:flex-row gap-8 items-center md:items-start">
        {track.coverUrl ? (
          <div className="w-32 h-32 md:w-48 md:h-48 rounded-2xl overflow-hidden shrink-0 shadow-sm border border-border">
            <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-32 h-32 md:w-48 md:h-48 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 border border-border">
            <Target className="w-16 h-16 text-primary/30" />
          </div>
        )}
        
        <div className="flex-1 text-center md:text-left">
          <div className="flex flex-wrap justify-center md:justify-start gap-2 mb-3">
            <span className="bg-secondary/10 text-secondary px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">{track.category}</span>
            <span className="bg-muted text-muted-foreground px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">{track.difficulty}</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-4">{track.title}</h1>
          <p className="text-muted-foreground mb-6">{track.description}</p>
          
          <div className="bg-background rounded-xl p-4 border border-border/50">
            <div className="flex justify-between text-sm font-medium mb-2">
              <span>Overall Progress</span>
              <span className="text-primary">{Math.round(track.progress * 100)}%</span>
            </div>
            <Progress value={track.progress * 100} className="h-2" />
          </div>
        </div>
      </div>

      <h3 className="text-2xl font-bold mb-6 font-serif">Curriculum</h3>
      
      <div className="space-y-3 relative before:absolute before:inset-y-0 before:left-6 before:w-0.5 before:bg-border">
        {track.lessons.map((lesson, index) => (
          <div key={lesson.id} className="relative pl-14">
            <div className={`absolute left-5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full ring-4 ring-background ${lesson.completed ? 'bg-primary' : 'bg-border'}`} />
            
            <div className={`bg-card p-4 rounded-xl border transition-colors flex items-center gap-4 ${lesson.completed ? 'border-primary/20 bg-primary/5 shadow-sm' : 'border-border hover:border-primary/30'}`}>
              <div className="shrink-0">
                {lesson.completed ? (
                  <CheckCircle2 className="w-6 h-6 text-primary" />
                ) : (
                  <Circle className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              
              <div className="flex-1">
                <div className="text-xs text-secondary font-bold mb-1 uppercase tracking-wider">Lesson {index + 1}</div>
                <h4 className={`font-bold ${lesson.completed ? 'text-foreground' : 'text-foreground/80'}`}>{lesson.title}</h4>
              </div>
              
              <div className="flex items-center gap-4 shrink-0 text-sm text-muted-foreground">
                <span className="flex items-center gap-1 hidden md:flex">
                  {lesson.kind === 'lesson' && <PlayCircle className="w-4 h-4" />}
                  {lesson.kind === 'task' && <FileText className="w-4 h-4" />}
                  {lesson.kind === 'quiz' && <Target className="w-4 h-4" />}
                  {lesson.kind === 'challenge' && <Trophy className="w-4 h-4" />}
                  <span className="capitalize">{lesson.kind}</span>
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {lesson.durationMinutes}m
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
