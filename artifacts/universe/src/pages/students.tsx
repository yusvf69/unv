import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, UserPlus, UserCheck, Search, Shield, ShieldOff, X, Check, ChevronDown, ChevronUp, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStudents, useToggleFollow, useFollows, useMeV2, type StudentLite } from "@/lib/api";
import { useAdminPermissions, useAdminAdmins, usePromoteToAdmin, useUpdateAdminPermissions, useDemoteAdmin } from "@/lib/api";
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

  const isSuper = me?.role === "super_admin";

  const { data: permissionsDefs = [] } = useAdminPermissions();
  const { data: admins = [] } = useAdminAdmins();
  const promote = usePromoteToAdmin();
  const updatePerms = useUpdateAdminPermissions();
  const demote = useDemoteAdmin();

  const [promoteTarget, setPromoteTarget] = useState<StudentLite | null>(null);
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [showAdmins, setShowAdmins] = useState(isSuper);

  const followingIds = useMemo(() => new Set((follows?.following ?? []).map((s) => s?.id)), [follows]);
  const adminIds = useMemo(() => new Set(admins.map((a: any) => a.id)), [admins]);

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

  const openPromote = (student: StudentLite) => {
    setPromoteTarget(student);
    setSelectedPerms(permissionsDefs.map((p: any) => p.key));
  };

  const openEdit = (admin: any) => {
    setEditTarget(admin);
    setSelectedPerms(admin.permissions || []);
  };

  const togglePerm = (key: string) => {
    setSelectedPerms((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handlePromote = async () => {
    if (!promoteTarget) return;
    await promote.mutateAsync({ userId: promoteTarget.id, permissions: selectedPerms });
    setPromoteTarget(null);
  };

  const handleUpdatePerms = async () => {
    if (!editTarget) return;
    await updatePerms.mutateAsync({ id: editTarget.id, permissions: selectedPerms });
    setEditTarget(null);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-3xl font-serif font-bold mb-2">{t("studentsPageTitle")}</motion.h1>
      <p className="text-sm text-muted-foreground mb-6">{t("studentsSubtitle")}</p>

      <div className="relative mb-6 max-w-md">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchByName")} className="ps-9" />
      </div>

      {/* Super Admin: Admins section */}
      {isSuper && (
        <div className="mb-8 bg-card border rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowAdmins(!showAdmins)}
            className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition"
          >
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-amber-500" />
              <span className="font-bold text-sm">Admin Management</span>
              <span className="text-xs text-muted-foreground">({admins.length} admins)</span>
            </div>
            {showAdmins ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <AnimatePresence>
            {showAdmins && (
              <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                <div className="border-t divide-y">
                  {admins.map((admin: any) => (
                    <div key={admin.id} className="flex items-center gap-3 p-3">
                      <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-700 text-xs font-bold">
                        {admin.name?.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold truncate">{admin.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {admin.role === "super_admin" ? "Super Admin" : `${admin.permissions?.length || 0} permissions`}
                        </div>
                      </div>
                      {admin.role !== "super_admin" && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => openEdit(admin)} className="h-8 text-xs">
                            <Settings className="h-3 w-3 me-1" /> Permissions
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => { if (confirm("Demote this admin?")) demote.mutate(admin.id); }} className="h-8 text-xs">
                            <ShieldOff className="h-3 w-3 me-1" /> Demote
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                  {admins.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No admins yet</p>}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Promote Dialog */}
      <AnimatePresence>
        {promoteTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setPromoteTarget(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-card border rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg flex items-center gap-2"><Shield className="h-5 w-5 text-amber-500" /> Promote to Admin</h3>
                <button onClick={() => setPromoteTarget(null)}><X className="h-4 w-4" /></button>
              </div>
              <p className="text-sm text-muted-foreground mb-4">Select permissions for <strong>{promoteTarget.name}</strong>:</p>
              <div className="space-y-2 mb-4">
                {permissionsDefs.map((p: any) => (
                  <label key={p.key} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedPerms.includes(p.key)}
                      onChange={() => togglePerm(p.key)}
                      className="h-4 w-4 rounded border-muted-foreground text-primary"
                    />
                    <span className="text-sm">{p.en}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setPromoteTarget(null)}>Cancel</Button>
                <Button className="flex-1" onClick={handlePromote} disabled={selectedPerms.length === 0}>
                  <Shield className="h-4 w-4 me-1" /> Promote ({selectedPerms.length} perms)
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Permissions Dialog */}
      <AnimatePresence>
        {editTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditTarget(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-card border rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg flex items-center gap-2"><Settings className="h-5 w-5 text-amber-500" /> Edit Permissions</h3>
                <button onClick={() => setEditTarget(null)}><X className="h-4 w-4" /></button>
              </div>
              <p className="text-sm text-muted-foreground mb-4">Update permissions for <strong>{editTarget.name}</strong>:</p>
              <div className="space-y-2 mb-4">
                {permissionsDefs.map((p: any) => (
                  <label key={p.key} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedPerms.includes(p.key)}
                      onChange={() => togglePerm(p.key)}
                      className="h-4 w-4 rounded border-muted-foreground text-primary"
                    />
                    <span className="text-sm">{p.en}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setEditTarget(null)}>Cancel</Button>
                <Button className="flex-1" onClick={handleUpdatePerms}>
                  <Check className="h-4 w-4 me-1" /> Save ({selectedPerms.length} perms)
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Students list */}
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
              {isSuper && !adminIds.has(s.id) && (
                <Button size="sm" variant="outline" onClick={() => openPromote(s)} className="text-amber-600 border-amber-300 hover:bg-amber-50">
                  <Shield className="h-3.5 w-3.5" />
                </Button>
              )}
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
