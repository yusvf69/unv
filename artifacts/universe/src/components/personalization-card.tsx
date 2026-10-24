import { useState } from "react";
import { Sparkles, Target, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePersonalization } from "@/lib/api";
import PersonalizationDialog from "@/components/personalization-dialog";

export default function PersonalizationCard() {
  const { data } = usePersonalization();
  const [open, setOpen] = useState(false);
  if (!data) return null;

  const interestLabels = data.catalog.interests.filter((i) => data.interests.includes(i.key));
  const goalLabels = data.catalog.goals.filter((g) => data.goals.includes(g.key));

  return (
    <div className="bg-card border rounded-2xl p-4 sm:p-5 mb-4 sm:mb-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-bold text-sm flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-primary" /> اهتماماتي وأهدافي
          </h2>
          {data.completed ? (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {interestLabels.map((i) => (
                <span key={i.key} className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">{i.label}</span>
              ))}
              {goalLabels.map((g) => (
                <span key={g.key} className="text-[10px] bg-secondary/15 text-secondary-foreground px-2 py-0.5 rounded-full inline-flex items-center gap-0.5">
                  <Target className="h-2.5 w-2.5" /> {g.label}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">
              حدد اهتماماتك وأهدافك عشان نقترح عليك مسارات وفرص مناسبة ليك.
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => setOpen(true)}>
          <Pencil className="h-3 w-3" /> {data.completed ? "تعديل" : "اختار"}
        </Button>
      </div>
      <PersonalizationDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
