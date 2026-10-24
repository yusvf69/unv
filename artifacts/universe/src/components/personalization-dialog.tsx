import { useEffect, useState } from "react";
import { Loader2, Sparkles, Target } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { usePersonalization, useSavePersonalization } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function PersonalizationDialog({ open, onOpenChange }: Props) {
  const { data, isLoading } = usePersonalization(open);
  const save = useSavePersonalization();
  const { toast } = useToast();
  const [interests, setInterests] = useState<string[]>([]);
  const [goals, setGoals] = useState<string[]>([]);

  useEffect(() => {
    if (!open || !data) return;
    setInterests(data.interests ?? []);
    setGoals(data.goals ?? []);
  }, [open, data?.updatedAt]);

  const toggle = (key: string, selected: string[], setSelected: (v: string[]) => void, max: number) => {
    if (selected.includes(key)) setSelected(selected.filter((k) => k !== key));
    else if (selected.length < max) setSelected([...selected, key]);
  };

  const submit = async () => {
    try {
      await save.mutateAsync({ interests, goals });
      toast({ title: "اتحفظت اهتماماتك", description: "هنقترح عليك حاجات قريبة منك." });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: err?.message || "تعذر الحفظ", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> خلي UniVerse على مقاسك
          </DialogTitle>
          <DialogDescription>
            اختار اهتماماتك وأهدافك، وإحنا نقترح عليك مسارات مهارات وفرص مناسبة ليك.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold">بتهتم بإيه؟</span>
                <span className="text-[10px] text-muted-foreground">{interests.length}/6</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(data?.catalog.interests ?? []).map((item) => {
                  const active = interests.includes(item.key);
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => toggle(item.key, interests, setInterests, 6)}
                      className={`px-3 py-1.5 rounded-full text-xs border transition ${active ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold flex items-center gap-1.5"><Target className="h-4 w-4 text-secondary" /> هدفك إيه دلوقتي؟</span>
                <span className="text-[10px] text-muted-foreground">{goals.length}/3</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(data?.catalog.goals ?? []).map((item) => {
                  const active = goals.includes(item.key);
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => toggle(item.key, goals, setGoals, 3)}
                      className={`px-3 py-1.5 rounded-full text-xs border transition ${active ? "bg-secondary text-secondary-foreground border-secondary" : "bg-background hover:bg-muted"}`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            بعدين
          </Button>
          <Button type="button" onClick={submit} disabled={save.isPending || isLoading || (interests.length === 0 && goals.length === 0)}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "احفظ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
