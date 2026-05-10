import { useParams, Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Users, Heart, FileText, Award, MessageCircle, UserPlus, UserCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUserProfile, useMeV2, useToggleFollow, useDeleteForumPost, useDeleteTalent, useDeleteForumReply, useDeleteTalentComment } from "@/lib/api";
import { useState } from "react";
import { formatISODate } from "@/lib/dates";
import { useTranslation, globalI18n } from "@/lib/i18n";

export default function StudentProfile() {
  const { id } = useParams<{ id: string }>();
  const userId = Number(id);
  const { data: profile, isLoading } = useUserProfile(userId);
  const { data: me } = useMeV2();
  const toggleFollow = useToggleFollow();
  const isAdmin = me?.role === "admin" || me?.role === "super_admin";
  const deleteForumPost = useDeleteForumPost();
  const deleteTalent = useDeleteTalent();
  const [tab, setTab] = useState<"forum" | "talents" | "summaries">("forum");
  const t = useTranslation(globalI18n);

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">{t("loading")}</div>;
  if (!profile) return <div className="p-8 text-center text-muted-foreground">{t("studentNotFound")}</div>;

  const isMe = me?.id === profile.id;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Link href="/students" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" /> {t("backToStudents")}
      </Link>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card border rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-4">
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt={profile.name} className="w-20 h-20 rounded-full object-cover border-2 border-primary/20" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold">{profile.name.charAt(0)}</div>
          )}
          <div className="flex-1">
            <h1 className="text-2xl font-serif font-bold">{profile.name}</h1>
            {profile.title && <Badge className="bg-primary/10 text-primary hover:bg-primary/20">{profile.title}</Badge>}
            {profile.bio && <p className="text-sm text-muted-foreground mt-1">{profile.bio}</p>}
            <div className="flex flex-wrap gap-2 mt-2">
              {profile.groupName && <span className="text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">G{profile.groupName}</span>}
              {profile.yearInCollege && <span className="text-[11px] bg-secondary/10 text-secondary px-2 py-0.5 rounded-full font-bold">{t("yearLabel")} {profile.yearInCollege}</span>}
              {profile.specialization && <span className="text-[11px] bg-accent/10 text-accent px-2 py-0.5 rounded-full font-bold">{profile.specialization}</span>}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mt-6 pt-4 border-t">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{profile.points}</div>
            <div className="text-xs text-muted-foreground">{t("points")}</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{profile.level}</div>
            <div className="text-xs text-muted-foreground">{t("level")}</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{profile.followerCount}</div>
            <div className="text-xs text-muted-foreground">{t("followers")}</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{profile.followingCount}</div>
            <div className="text-xs text-muted-foreground">{t("followingCount")}</div>
          </div>
        </div>
        <div className="text-center mt-2">
          <div className="inline-flex items-center gap-1 text-sm text-muted-foreground">
            <Heart className="h-4 w-4 text-rose-500" /> {profile.totalLikesReceived} {t("likeLabel")}
          </div>
        </div>

        {/* Actions */}
        {!isMe && (
          <div className="flex gap-2 mt-4 pt-4 border-t">
            <Button
              size="sm"
              variant={profile.following ? "secondary" : "default"}
              onClick={() => toggleFollow.mutate(profile.id)}
              className="flex-1"
            >
              {profile.following ? <><UserCheck className="me-1 h-4 w-4" /> {t("unfollow")}</> : <><UserPlus className="me-1 h-4 w-4" /> {t("follow")}</>}
            </Button>
            <Link href={`/messages/${profile.id}`}>
              <Button size="sm" variant="outline"><MessageCircle className="me-1 h-4 w-4" /> {t("sendMessage")}</Button>
            </Link>
          </div>
        )}
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { key: "forum" as const, label: t("forum"), icon: FileText, count: profile.forumPosts.length },
          { key: "talents" as const, label: t("talents"), icon: Award, count: profile.talents.length },
          { key: "summaries" as const, label: t("summaries"), icon: Users, count: profile.summaries.length },
        ].map(({ key, label, icon: Icon, count }) => (
          <button key={key} onClick={() => setTab(key)} className={`px-5 py-2 rounded-full text-sm font-bold flex items-center gap-2 transition ${tab === key ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}>
            <Icon className="h-4 w-4" /> {label} <span className="text-xs opacity-70">({count})</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "forum" && (
        <div className="space-y-3">
          {profile.forumPosts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{t("noForumPosts")}</p>
          ) : (
            profile.forumPosts.map((p) => (
              <motion.div key={p.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="bg-card border rounded-xl p-4">
                <div className="flex justify-between items-start">
                  <Link href={`/forum/${p.id}`} className="flex-1">
                    <h3 className="font-bold">{p.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{p.body}</p>
                    <div className="text-xs text-muted-foreground mt-2">{formatISODate(p.createdAt)}</div>
                  </Link>
                  {isAdmin && (
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteForumPost.mutate(p.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      {tab === "talents" && (
        <div className="space-y-3">
          {profile.talents.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{t("noTalents")}</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {profile.talents.map((t) => (
                <motion.div key={t.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="bg-card border rounded-xl p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold">{t.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{t.description}</p>
                      <Badge variant="outline" className="mt-2">{t.category}</Badge>
                    </div>
                    {isAdmin && (
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteTalent.mutate(t.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "summaries" && (
        <div className="space-y-3">
          {profile.summaries.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{t("noSummariesUploaded")}</p>
          ) : (
            profile.summaries.map((s) => (
              <motion.div key={s.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="bg-card border rounded-xl p-4 flex items-center justify-between">
                <div>
                  <h3 className="font-bold">{s.name}</h3>
                  <div className="text-xs text-muted-foreground mt-1">{formatISODate(s.createdAt)} · {s.likes} {t("likeLabel")} · {s.views} {t("viewsLabel")}</div>
                </div>
                <a href={s.url} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">{t("open")}</a>
              </motion.div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
