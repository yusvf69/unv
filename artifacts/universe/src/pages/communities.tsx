import { useMemo, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Building2, GraduationCap, Loader2, Search, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useCommunities, useMyCommunities, type CommunityRow } from "@/lib/api";
import { useTranslation, globalI18n } from "@/lib/i18n";

const translations = {
  ...globalI18n,
  communitiesTitle: { ar: "المجتمعات", en: "Communities" },
  communitiesSubtitle: { ar: "مجتمع جامعتك وكليتك ودفعتك في مكان واحد", en: "Your university, faculty, and cohort in one place" },
  myCommunities: { ar: "مجتمعاتي", en: "My communities" },
  exploreCommunities: { ar: "استكشف", en: "Explore" },
  all: { ar: "الكل", en: "All" },
  universities: { ar: "الجامعات", en: "Universities" },
  faculties: { ar: "الكليات", en: "Faculties" },
  member: { ar: "عضو", en: "members" },
  postCount: { ar: "منشور", en: "posts" },
  universityKind: { ar: "جامعة", en: "University" },
  facultyKind: { ar: "كلية", en: "Faculty" },
  cohortKind: { ar: "دفعة", en: "Cohort" },
  communitySearch: { ar: "دوّر على مجتمع...", en: "Search communities..." },
  noMyCommunities: { ar: "لسه مفيش مجتمعات ليك — كمّل بياناتك الأكاديمية من البروفايل.", en: "No communities yet — complete your academic info in your profile." },
  noCommunitiesFound: { ar: "مفيش نتائج مطابقة.", en: "No matching communities." },
  openCommunity: { ar: "افتح المجتمع", en: "Open community" },
};

function kindIcon(kind: CommunityRow["kind"]) {
  if (kind === "university") return Building2;
  if (kind === "faculty") return GraduationCap;
  return Users;
}

function KindLabel({ kind, t }: { kind: CommunityRow["kind"]; t: (key: string) => string }) {
  const Icon = kindIcon(kind);
  const label = kind === "university" ? t("universityKind") : kind === "faculty" ? t("facultyKind") : t("cohortKind");
  return (
    <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
      <Icon className="w-3 h-3" /> {label}
    </span>
  );
}

function CommunityCard({ community, t }: { community: CommunityRow; t: (key: string) => string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Link href={`/communities/${community.id}`} className="block bg-card border rounded-2xl p-4 sm:p-5 hover:border-primary/50 hover:shadow-md transition h-full">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            {(() => { const Icon = kindIcon(community.kind); return <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />; })()}
          </div>
          <div className="flex-1 min-w-0">
            <KindLabel kind={community.kind} t={t} />
            <h3 className="font-bold text-sm sm:text-base mt-1 line-clamp-2">{community.nameAr}</h3>
            {community.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{community.description}</p>
            )}
            <div className="flex items-center gap-3 mt-2 text-[11px] sm:text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {community.membersCount} {t("member")}</span>
              <span className="inline-flex items-center gap-1"><GraduationCap className="w-3.5 h-3.5" /> {community.postsCount} {t("postCount")}</span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export default function Communities() {
  const t = useTranslation(translations);
  const [tab, setTab] = useState<"mine" | "explore">("mine");
  const [exploreKind, setExploreKind] = useState<"all" | "university" | "faculty">("all");
  const [search, setSearch] = useState("");
  const mineQuery = useMyCommunities();
  const browseQuery = useCommunities(exploreKind === "all" ? undefined : { kind: exploreKind });

  const list = useMemo(() => {
    const source = tab === "mine" ? mineQuery.data ?? [] : browseQuery.data ?? [];
    const term = search.trim();
    if (!term) return source;
    return source.filter((c) => c.nameAr.includes(term) || (c.description || "").includes(term));
  }, [tab, mineQuery.data, browseQuery.data, search]);

  const isLoading = tab === "mine" ? mineQuery.isLoading : browseQuery.isLoading;

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 max-w-5xl">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold flex items-center gap-2">
          <Users className="w-7 h-7 text-primary" /> {t("communitiesTitle")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t("communitiesSubtitle")}</p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="flex bg-muted/50 rounded-xl p-1 w-fit">
          <button
            type="button"
            onClick={() => setTab("mine")}
            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition ${tab === "mine" ? "bg-background shadow text-primary" : "text-muted-foreground"}`}
          >
            {t("myCommunities")}
          </button>
          <button
            type="button"
            onClick={() => setTab("explore")}
            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition ${tab === "explore" ? "bg-background shadow text-primary" : "text-muted-foreground"}`}
          >
            {t("exploreCommunities")}
          </button>
        </div>
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("communitySearch")} className="ps-9 h-10" />
        </div>
      </div>

      {tab === "explore" && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {([
            ["all", t("all")],
            ["university", t("universities")],
            ["faculty", t("faculties")],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setExploreKind(value)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${exploreKind === value ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="py-16 text-center text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
      ) : list.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground bg-muted/20 rounded-2xl border border-dashed px-4">
          {tab === "mine" ? t("noMyCommunities") : t("noCommunitiesFound")}
          {tab === "mine" && (
            <div className="mt-3">
              <Link href="/profile" className="text-primary font-bold underline text-xs">{t("profile")}</Link>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {list.map((community) => <CommunityCard key={community.id} community={community} t={t} />)}
        </div>
      )}
    </div>
  );
}
