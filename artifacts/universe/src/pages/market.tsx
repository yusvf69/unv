import { useState } from "react";
import { motion } from "framer-motion";
import {
  BadgeDollarSign, BookOpen, ExternalLink, Gem, Link2, Loader2,
  Lock, Minus, PlayCircle, Plus, Search, Store,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  useBuyMarketListing, useCreateMarketListing, useDeleteMarketListing, useMarket,
  type MarketListing as Listing, type MarketListingInput,
} from "@/lib/api";

type TabId = "browse" | "mine" | "library";

const KIND_META: Record<string, { label: string; hint: string }> = {
  note: { label: "ملخص / ملازمة", hint: "ملف أو صفحة فيها ملخصاتك" },
  video: { label: "شرح فيديو", hint: "فيديو أو قناة بتشرح موضوع" },
  link: { label: "مورد / موقع", hint: "أي لينك مفيد للطلبة" },
};

const KIND_QUICK_CATEGORIES = ["تكنولوجي", "ريادة أعمال", "طب", "هندسة", "تصميم", "قانون", "فلاحة", "اختبارات"];

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("ar-EG", { year: "numeric", month: "short" });
  } catch {
    return "—";
  }
}

function KindIcon({ kind, className }: { kind: string; className?: string }) {
  if (kind === "video") return <PlayCircle className={className} />;
  if (kind === "link") return <Link2 className={className} />;
  return <BookOpen className={className} />;
}

export default function MarketPage() {
  const { toast } = useToast();
  const { data, isLoading } = useMarket();
  const buy = useBuyMarketListing();
  const create = useCreateMarketListing();
  const removeListing = useDeleteMarketListing();

  const [tab, setTab] = useState<TabId>("browse");
  const [q, setQ] = useState("");
  const [kindFilter, setKindFilter] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ kind: "note", title: "", description: "", url: "", category: "", tags: "", pricePoints: 0 });

  const listings = data?.listings ?? [];
  const myPoints = data?.myPoints ?? 0;
  const mine = listings.filter((l) => l.mine);
  const library = listings.filter((l) => l.purchased);
  const activeList = tab === "mine" ? mine : tab === "library" ? library : listings;

  const filtered = activeList
    .filter((l) => !kindFilter || l.kind === kindFilter)
    .filter((l) => {
      const needle = q.trim().toLowerCase();
      if (!needle) return true;
      return (
        l.title.toLowerCase().includes(needle) ||
        (l.description || "").toLowerCase().includes(needle) ||
        (l.tags ?? []).some((t) => t.toLowerCase().includes(needle)) ||
        (l.category || "").toLowerCase().includes(needle)
      );
    });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function saveListing() {
    const title = form.title.trim();
    if (title.length < 2) {
      toast({ title: "العنوان مطلوب", variant: "destructive" });
      return;
    }
    const url = form.url.trim();
    if (!/^https?:\/\//i.test(url)) {
      toast({ title: "الرابط لازم يبدأ بـhttp", variant: "destructive" });
      return;
    }
    const body: MarketListingInput = {
      kind: form.kind,
      title,
      description: form.description.trim(),
      url,
      category: form.category.trim(),
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      pricePoints: Math.max(0, Math.min(500, Math.floor(Number(form.pricePoints) || 0))),
    };
    setSaving(true);
    create.mutate(body, {
      onSuccess: () => {
        toast({ title: "تم نشر الإعلان في سوق المعرفة" });
        setOpen(false);
        setForm({ kind: "note", title: "", description: "", url: "", category: "", tags: "", pricePoints: 0 });
        setSaving(false);
      },
      onError: (e: any) => {
        toast({ title: e?.message || "تعذر نشر الإعلان", variant: "destructive" });
        setSaving(false);
      },
    });
  }

  function doBuy(listing: Listing) {
    if (listing.pricePoints > 0) {
      const ok = window.confirm(`هتدفع ${listing.pricePoints} نقطة لفتح «${listing.title}»؟`);
      if (!ok) return;
    }
    buy.mutate(listing.id, {
      onSuccess: (res) => {
        if (res.pointsSpent > 0) {
          toast({ title: `تم الشراء بـ ${res.pointsSpent} نقطة` });
        } else {
          toast({ title: listing.mine ? "إعلانك انت" : "تم فتح المحتوى" });
        }
      },
      onError: (e: any) => {
        toast({ title: e?.message || "تعذر الشراء", variant: "destructive" });
      },
    });
  }

  function remove(project: Listing) {
    if (!window.confirm(`حذف إعلان "${project.title}"؟`)) return;
    removeListing.mutate(project.id, {
      onSuccess: () => toast({ title: "تم حذف الإعلان" }),
      onError: (e: any) => toast({ title: e?.message || "تعذر حذف الإعلان", variant: "destructive" }),
    });
  }

  function priceBadge(listing: Listing) {
    if (listing.pricePoints === 0) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full text-[9px] border font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 border-emerald-200">
          <Gem className="h-2.5 w-2.5" /> مجاني
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full text-[9px] border font-bold px-2 py-0.5 bg-amber-50 text-amber-700 border-amber-200">
        <Gem className="h-2.5 w-2.5" /> {listing.pricePoints} نقطة
      </span>
    );
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-6xl space-y-4 sm:space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-700 via-purple-700 to-fuchsia-900 text-white p-4 sm:p-6"
      >
        <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-16 -right-10 w-52 h-52 rounded-full bg-white/5" />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0 border border-white/20">
            <Store className="h-6 w-6 text-violet-50" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="font-bold text-lg sm:text-xl">سوق المعرفة</h1>
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/15 text-violet-50 border border-white/20">شارك اللي تعرفه، واكسب نقاط</span>
            </div>
            <p className="text-[11px] sm:text-xs text-violet-50/90 max-w-xl">
              نشر ملخصاتك وشروحاتك للطلبة — مجانًا أو بنقاط. كل شراء بيتحول لنقطة في جيبك.
            </p>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <Button onClick={() => setOpen(true)} size="sm" className="bg-white text-violet-800 hover:bg-violet-50 gap-1 h-8 text-[11px]">
              <Plus className="h-3.5 w-3.5" /> إعلان جديد
            </Button>
            <div className="flex gap-2">
              <span className="rounded-xl bg-white/10 backdrop-blur px-3 py-1.5 text-center min-w-14 border border-white/15 flex-1">
                <span className="font-bold text-sm leading-none block">{myPoints}</span>
                <span className="text-[9px] text-violet-100/80">نقطتك</span>
              </span>
              <span className="rounded-xl bg-white/10 backdrop-blur px-3 py-1.5 text-center min-w-14 border border-white/15 flex-1">
                <span className="font-bold text-sm leading-none block">{mine.length}</span>
                <span className="text-[9px] text-violet-100/80">إعلانك</span>
              </span>
              <span className="rounded-xl bg-white/10 backdrop-blur px-3 py-1.5 text-center min-w-14 border border-white/15 flex-1">
                <span className="font-bold text-sm leading-none block">{library.length}</span>
                <span className="text-[9px] text-violet-100/80">مكتبتك</span>
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setTab("browse")}
          className={`text-[11px] rounded-full px-4 py-1.5 border transition ${tab === "browse" ? "bg-violet-600 text-white border-violet-600 font-bold" : "bg-card text-muted-foreground border-border hover:border-violet-300"}`}
        >
          الكل
        </button>
        <button
          onClick={() => setTab("mine")}
          className={`text-[11px] rounded-full px-4 py-1.5 border transition ${tab === "mine" ? "bg-violet-600 text-white border-violet-600 font-bold" : "bg-card text-muted-foreground border-border hover:border-violet-300"}`}
        >
          إعلاناتي {mine.length > 0 && `(${mine.length})`}
        </button>
        <button
          onClick={() => setTab("library")}
          className={`text-[11px] rounded-full px-4 py-1.5 border transition ${tab === "library" ? "bg-violet-600 text-white border-violet-600 font-bold" : "bg-card text-muted-foreground border-border hover:border-violet-300"}`}
        >
          مكتبتي {library.length > 0 && `(${library.length})`}
        </button>
        <div className="relative flex-1 min-w-48 max-w-xs mr-auto">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث في السوق..." className="h-9 pr-8 text-xs" />
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {[null, "note", "video", "link"].map((k) => (
          <button
            key={k ?? "all-kind"}
            onClick={() => setKindFilter(k)}
            className={`text-[10px] rounded-lg px-2.5 py-1 border transition inline-flex items-center gap-1 ${kindFilter === k ? "bg-muted font-bold text-foreground border-border" : "text-muted-foreground border-transparent hover:bg-muted/60"}`}
          >
            {k && <KindIcon kind={k} className="h-3 w-3" />}
            {k ? KIND_META[k].label : "كل الأنواع"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="py-16 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center">
          <Store className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
          <h2 className="font-bold text-sm sm:text-base mb-1">
            {tab === "library" ? "مكتبتك لسه فاضية" : tab === "mine" ? "لسه منشرتش إعلانات" : "مفيش حاجة بالفلتر ده"}
          </h2>
          <p className="text-xs text-muted-foreground mb-4 max-w-md mx-auto">
            {tab === "browse"
              ? "شارك ملخص أو شرح — صحابك بيدفعوا نقاط، والنقاط بتراكم في حسابك."
              : tab === "library"
                ? "اشترِ أول معرفة من التاب «الكل» وهتلاقيها هنا دايمًا."
                : "انشر أول إعلان ليك بـ زر «إعلان جديد»."}
          </p>
          {tab !== "library" && (
            <Button onClick={() => setOpen(true)} size="sm" className="gap-1">
              <Plus className="h-4 w-4" /> إعلان جديد
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filtered.map((listing) => {
            const locked = !listing.mine && !listing.purchased;
            return (
              <motion.article
                key={listing.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card border rounded-2xl overflow-hidden flex flex-col hover:shadow-md hover:border-primary/30 transition"
              >
                <div className="p-4 flex flex-col flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-bold text-sm leading-snug min-w-0 break-words">{listing.title}</h2>
                    {priceBadge(listing)}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mt-1.5">
                    <span className="text-[9px] rounded-full bg-primary/10 text-primary px-2 py-0.5 font-bold inline-flex items-center gap-1">
                      <KindIcon kind={listing.kind} className="h-2.5 w-2.5" /> {KIND_META[listing.kind]?.label}
                    </span>
                    {listing.category && (
                      <span className="text-[9px] text-muted-foreground">{listing.category}</span>
                    )}
                    <span className="text-[9px] text-muted-foreground">{fmtDate(listing.createdAt)}</span>
                  </div>
                  {listing.owner && (
                    <div className="flex items-center gap-2 mt-2.5">
                      {listing.owner.avatarUrl ? (
                        <img src={listing.owner.avatarUrl} alt={listing.owner.name} className="w-6 h-6 rounded-full object-cover border" />
                      ) : (
                        <span className="w-6 h-6 rounded-full bg-muted text-[10px] font-bold flex items-center justify-center border">
                          {(listing.owner.name || "?").slice(0, 1)}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground truncate">
                        {listing.owner.name}
                        {listing.owner.faculty ? ` — ${listing.owner.faculty}` : ""}
                      </span>
                    </div>
                  )}
                  {listing.description && (
                    <p className="text-[11px] text-muted-foreground mt-2 line-clamp-2 leading-relaxed">{listing.description}</p>
                  )}
                  {!!listing.tags?.length && (
                    <div className="flex flex-wrap gap-1 mt-2.5">
                      {listing.tags.map((tag) => (
                        <span key={tag} className="text-[9px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground">#{tag}</span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-auto pt-3 border-t mt-3">
                    {listing.mine ? (
                      <>
                        <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                          <BadgeDollarSign className="h-3 w-3" /> إعلانك انت
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-[10px] gap-1 px-3 mr-auto text-red-600 hover:text-red-700 hover:bg-red-50"
                          disabled={removeListing.isPending}
                          onClick={() => remove(listing)}
                        >
                          <Minus className="h-3 w-3" /> إزالة
                        </Button>
                      </>
                    ) : listing.purchased ? (
                      <Button size="sm" variant="outline" asChild className="h-7 text-[10px] gap-1 px-3 border-emerald-300 text-emerald-700 hover:bg-emerald-50">
                        <a href={listing.url ?? "#"} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3" /> مفتوح — افتحه
                        </a>
                      </Button>
                    ) : locked ? (
                      <>
                        <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                          <Lock className="h-3 w-3" /> محتاج شراء
                        </span>
                        <Button
                          size="sm"
                          className="h-7 text-[10px] gap-1 px-3 mr-auto bg-amber-500 hover:bg-amber-600 text-white"
                          disabled={buy.isPending}
                          onClick={() => doBuy(listing)}
                        >
                          {buy.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Gem className="h-3 w-3" />}
                          {listing.pricePoints === 0 ? "احصل مجانًا" : `شراء بـ ${listing.pricePoints}`}
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>إعلان جديد في سوق المعرفة</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">النوع *</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {(["note", "video", "link"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => set("kind", k)}
                    className={`flex flex-col items-center gap-1 text-[10px] rounded-lg border px-2 py-2.5 transition ${form.kind === k ? "border-violet-500 bg-violet-50 text-violet-700 font-bold" : "border-border text-muted-foreground"}`}
                  >
                    <KindIcon kind={k} className="h-4 w-4" />
                    {KIND_META[k].label}
                  </button>
                ))}
              </div>
              <p className="text-[9px] text-muted-foreground mt-1">{KIND_META[form.kind]?.hint}</p>
            </div>
            <div>
              <Label className="text-xs">العنوان *</Label>
              <Input
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="مثال: ملخص أصول البرمجة - الوحدة 3"
                maxLength={120}
              />
            </div>
            <div>
              <Label className="text-xs">الرابط (محتواك) *</Label>
              <Input dir="ltr" value={form.url} onChange={(e) => set("url", e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <Label className="text-xs">الوصف</Label>
              <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="فيه إيه؟ ينفع لمين؟" rows={3} maxLength={2000} />
            </div>
            <div>
              <Label className="text-xs">المجال</Label>
              <Input value={form.category} onChange={(e) => set("category", e.target.value)} placeholder="مثال: تكنولوجي" maxLength={40} />
              <div className="flex flex-wrap gap-1 mt-1.5">
                {KIND_QUICK_CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => set("category", c)}
                    className="text-[9px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground hover:bg-muted/70"
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs">السعر بالنقاط (0 = مجاني، حتى 500)</Label>
              <Input
                type="number"
                min={0}
                max={500}
                value={form.pricePoints}
                onChange={(e) => set("pricePoints", Number(e.target.value))}
                className="w-32"
              />
            </div>
            <div>
              <Label className="text-xs">المهارات / الوسوم (فاصلة بينهم)</Label>
              <Input value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="رياضة, فيزياء, شبكات" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={saving}>
              إلغاء
            </Button>
            <Button size="sm" onClick={saveListing} disabled={saving} className="gap-1 bg-violet-600 hover:bg-violet-700 text-white">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              نشر الإعلان
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
