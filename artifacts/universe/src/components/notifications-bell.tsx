import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Check, AlertTriangle, Info, AlertOctagon, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotifications, useMarkAllRead, type NotificationItem } from "@/lib/api";
import { formatISODateTime } from "@/lib/dates";

function iconFor(t: string) {
  if (t === "success") return <Sparkles className="h-4 w-4 text-emerald-600" />;
  if (t === "warning") return <AlertTriangle className="h-4 w-4 text-amber-600" />;
  if (t === "alert") return <AlertOctagon className="h-4 w-4 text-rose-600" />;
  return <Info className="h-4 w-4 text-sky-600" />;
}

export default function NotificationsBell() {
  const { data: notes = [] } = useNotifications();
  const markAll = useMarkAllRead();
  const [open, setOpen] = useState(false);
  const unread = notes.filter((n) => !n.read).length;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          data-testid="button-notifications"
        >
          <Bell className="h-5 w-5" />
          <AnimatePresence>
            {unread > 0 && (
              <motion.span
                key={unread}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -top-0.5 end-0.5 h-5 min-w-5 rounded-full bg-secondary text-secondary-foreground text-[10px] font-bold flex items-center justify-center px-1 shadow-md"
              >
                {unread > 9 ? "9+" : unread}
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 p-0 max-h-[70vh] overflow-y-auto">
        <div className="flex items-center justify-between p-3 border-b sticky top-0 bg-background">
          <span className="font-bold">الإشعارات</span>
          {unread > 0 && (
            <Button size="sm" variant="ghost" onClick={() => markAll.mutate()} className="text-xs">
              <Check className="h-3 w-3 me-1" /> قراءة الكل
            </Button>
          )}
        </div>
        {notes.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">لا توجد إشعارات</div>
        ) : (
          <div className="divide-y">
            {notes.map((n: NotificationItem, i) => (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className={`p-3 flex gap-3 items-start hover:bg-accent/10 ${!n.read ? "bg-primary/5" : ""}`}
              >
                <div className="mt-0.5">{iconFor(n.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm leading-snug">{n.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.body}</div>
                  <div className="text-[10px] text-muted-foreground/70 mt-1">
                    {formatISODateTime(n.createdAt)}
                  </div>
                </div>
                {!n.read && <span className="h-2 w-2 rounded-full bg-secondary mt-2" />}
              </motion.div>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
