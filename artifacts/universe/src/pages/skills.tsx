import { motion } from "framer-motion";
import { Sparkles, CheckCircle2, Circle, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSkillTracks, useCompleteLesson } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useTranslation, globalI18n } from "@/lib/i18n";

export default function Skills() {
  const { data: tracks = [], isLoading } = useSkillTracks();
  const complete = useCompleteLesson();
  const { toast } = useToast();
  const [busyId, setBusyId] = useState<number | null>(null);
  const t = useTranslation(globalI18n);

  const onComplete = async (id: number) => {
    setBusyId(id);
    try {
      await complete.mutateAsync(id);
      toast({ title: t("goodJobPoints") });
    } catch (e) {
      toast({ title: t("error"), description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-3xl font-serif font-bold flex items-center gap-2"><Sparkles className="h-5 w-5 sm:h-7 sm:w-7" />{t("myTracks")}</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">{t("developSkills")}</p>
      </motion.div>

      {isLoading && <p className="text-center py-8 sm:py-12 text-muted-foreground text-sm">{t("loading")}</p>}

      {!isLoading && !tracks.length && (
        <div className="text-center py-12 sm:py-16 border-2 border-dashed rounded-xl sm:rounded-2xl">
          <Sparkles className="h-8 w-8 sm:h-12 sm:w-12 mx-auto text-muted-foreground mb-2 sm:mb-3" />
          <p className="text-muted-foreground text-sm">{t("noTracksYet")}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6">
        {tracks.map((track, i) => {
          const done = track.lessons.filter((l) => l.completed).length;
          const pct = track.lessons.length ? Math.round((done / track.lessons.length) * 100) : 0;
          return (
            <motion.div key={track.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="bg-card border rounded-xl sm:rounded-2xl p-3 sm:p-5">
              <div className="flex items-start justify-between gap-2 sm:gap-3">
                <div>
                  <div className="text-[10px] sm:text-xs text-secondary font-bold uppercase">{track.category}</div>
                  <h2 className="font-bold text-base sm:text-xl mt-0.5 sm:mt-1">{track.title}</h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">{track.description}</p>
                </div>
                <span className="text-[10px] sm:text-xs bg-primary/10 text-primary px-2 py-0.5 sm:py-1 rounded-full font-bold flex-shrink-0">{track.difficulty}</span>
              </div>

              <div className="mt-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-xs sm:text-sm">{t("progress")}</span>
                  <span className="font-bold">{pct}%</span>
                </div>
                <div className="h-1.5 sm:h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} className="h-full bg-gradient-to-r from-primary to-secondary rounded-full" />
                </div>
              </div>

              <div className="mt-3 sm:mt-4 space-y-1 sm:space-y-1.5">
                {track.lessons.map((l) => (
                  <div key={l.id} className={`flex items-center gap-2 p-2 rounded-lg text-xs sm:text-sm ${l.completed ? "bg-emerald-500/10" : "bg-muted/30"}`}>
                    {l.completed ? (
                      <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600 shrink-0" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                    )}
                    <span className={`flex-1 ${l.completed ? "line-through text-muted-foreground" : ""}`}>{l.title}</span>
                    <span className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> {l.durationMinutes}{t("minShort")}</span>
                    {!l.completed && (
                      <Button size="sm" variant="outline" className="h-6 sm:h-7 text-[10px] sm:text-xs flex-shrink-0" onClick={() => onComplete(l.id)} disabled={busyId === l.id}>
                        {busyId === l.id ? <Loader2 className="h-3 w-3 animate-spin" /> : t("complete")}
                      </Button>
                    )}
                  </div>
                ))}
                {!track.lessons.length && <p className="text-center text-xs text-muted-foreground py-4">{t("noLessonsYet")}</p>}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
