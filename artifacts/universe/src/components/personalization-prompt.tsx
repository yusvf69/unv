import { useEffect, useState } from "react";
import { usePersonalization } from "@/lib/api";
import PersonalizationDialog from "@/components/personalization-dialog";

const DISMISS_KEY = "uv_personalization_dismissed";

export default function PersonalizationPrompt({ enabled }: { enabled: boolean }) {
  const { data } = usePersonalization(enabled);
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!enabled || checked || !data) return;
    setChecked(true);
    if (!data.completed && !sessionStorage.getItem(DISMISS_KEY)) setOpen(true);
  }, [enabled, checked, data]);

  if (!enabled || !data || data.completed) return null;

  return (
    <PersonalizationDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) sessionStorage.setItem(DISMISS_KEY, "1");
      }}
    />
  );
}
