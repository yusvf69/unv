import { Link } from "wouter";
import { motion } from "framer-motion";
import { MessageCircle, UserPlus, UserCheck, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStudents, useToggleFollow, useFollows, useMeV2, type StudentLite } from "@/lib/api";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation, globalI18n } from "@/lib/i18n";

export default function Students() {
  const { data: me } = useMeV2();
  const { data: students = [] } = useStudents();
  const { data: follows } = useFollows();
  const toggle = useToggleFollow();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const t = useTranslation(globalI18n);

  const followingIds = useMemo(() => new Set((follows?.following ?? []).map((s) => s?.id)), [follows]);
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return students.filter((s) => s.id !== me?.id && (!term || s.name.toLowerCase().includes(term) || (s.specialization || "").toLowerCase().includes(term)));
  }, [students, q, me?.id]);

  const handleToggle = (userId: number) => {
    const queryKey = ["v2", "follows", "me"];
    const prev = qc.getQueryData<{ followers: StudentLite[]; following: StudentLite[] }>(queryKey);
    if (prev) {
      const isFollowing = prev.following?.some((s) => s?.id === userId);
      qc.setQueryData(queryKey, {
        ...prev,
        following: isFollowing
          ? prev.following.filter((s) => s?.id !== userId)
          : [...(prev.following ?? []), students.find((s) => s.id === userId)],
      });
    }
    toggle.mutate(userId, {
      onError: () => {
        if (prev) qc.setQueryData(queryKey, prev);
      },
    });
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-3xl font-serif font-bold mb-2">{t("studentsPageTitle")}</motion.h1>
      <p className="text-sm text-muted-foreground mb-6">{t("studentsSubtitle")}</p>

      <div className="relative mb-6 max-w-md">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchByName")} className="ps-9" />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((s, i) => (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="bg-card border rounded-2xl p-4 hover:shadow-lg hover:border-primary/30 transition-all"
          >
            <Link href={`/students/${s.id}`} className="block">
              <div className="flex items-center gap-3">
                {s.avatarUrl ? (
                  <img src={s.avatarUrl} alt={s.name} className="w-14 h-14 rounded-full object-cover border-2 border-primary/20" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">{s.name.charAt(0)}</div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate">{s.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{s.specialization || "—"}</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {s.groupName && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">G{s.groupName}</span>}
                    {s.yearInCollege && <span className="text-[10px] bg-secondary/10 text-secondary px-1.5 py-0.5 rounded font-bold">{t("yearInCollege")} {s.yearInCollege}</span>}
                    <span className="text-[10px] bg-amber-500/10 text-amber-700 px-1.5 py-0.5 rounded font-bold">{s.points} pt</span>
                  </div>
                </div>
              </div>
            </Link>
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                variant={followingIds.has(s.id) ? "secondary" : "default"}
                className="flex-1"
                onClick={() => handleToggle(s.id)}
              >
                {followingIds.has(s.id) ? <><UserCheck className="me-1 h-3.5 w-3.5" />{t("following")}</> : <><UserPlus className="me-1 h-3.5 w-3.5" />{t("follow")}</>}
              </Button>
              <Link href={`/messages/${s.id}`}>
                <Button size="sm" variant="outline"><MessageCircle className="h-3.5 w-3.5" /></Button>
              </Link>
            </div>
          </motion.div>
        ))}
      </div>
      {!filtered.length && <p className="text-center text-muted-foreground py-12">{t("noStudentsMatch")}</p>}
    </div>
  );
}
