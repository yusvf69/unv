import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Search, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useEbooks } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const YEARS = [1, 2, 3, 4];

function BookCard({ book }: { book: any }) {
  const { toast } = useToast();
  const [broken, setBroken] = useState(false);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="group rounded-2xl border bg-card overflow-hidden flex flex-col hover:shadow-lg transition-shadow"
    >
      <div className="relative aspect-[3/4] bg-muted overflow-hidden">
        {book.coverUrl && !broken ? (
          <img
            src={book.coverUrl}
            alt={book.title}
            loading="lazy"
            onError={() => setBroken(true)}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform"
          />
        ) : (
          <div className="h-full w-full flex flex-col items-center justify-center gap-3 text-muted-foreground/70">
            <BookOpen className="h-14 w-14" />
            <span className="px-4 text-center text-lg font-bold leading-snug line-clamp-4 px-3">{book.title}</span>
          </div>
        )}
        {book.yearInCollege ? (
          <Badge className="absolute top-2 end-2 bg-background/85 backdrop-blur text-foreground">
            سنة {book.yearInCollege}
          </Badge>
        ) : null}
      </div>
      <div className="p-4 flex flex-col gap-2 flex-1">
        <h3 className="font-bold text-sm sm:text-base leading-snug line-clamp-2">{book.title}</h3>
        {book.subject ? (
          <span className="w-fit rounded-full bg-primary/10 text-primary text-[11px] font-semibold px-2.5 py-0.5">{book.subject}</span>
        ) : null}
        {book.description ? <p className="text-xs text-muted-foreground line-clamp-2">{book.description}</p> : null}
        <div className="mt-auto pt-2">
          <Button
            size="sm"
            className="w-full"
            onClick={() => {
              window.open(book.bookUrl, "_blank", "noopener,noreferrer");
              toast({ title: "جاري فتح الكتاب…" });
            }}
          >
            <ExternalLink className="me-2 h-3.5 w-3.5" /> اقرأ الكتاب
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

export default function Ebooks() {
  const { data: books = [], isLoading } = useEbooks();
  const [q, setQ] = useState("");
  const [year, setYear] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return books.filter((b) => {
      if (year !== null && b.yearInCollege !== year) return false;
      if (!term) return true;
      return (b.title + " " + b.subject + " " + (b.description || "")).toLowerCase().includes(term);
    });
  }, [books, q, year]);

  return (
    <div className="pace-y-6 px-4 py-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><BookOpen className="h-6 w-6" /></div>
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold">الكتب الإلكترونية</h1>
          <p className="text-sm text-muted-foreground">دوّر على كتاب بمادة معيّنة وأقراه مباشرة من هنا</p>
        </div>
      </div>

      <div className="mb-4 relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث باسم الكتاب أو المادة…"
          className="ps-9 h-10"
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <Button
          size="sm"
          variant={year === null ? "default" : "outline"}
          onClick={() => setYear(null)}
          className="rounded-full h-8"
        >
          كل السنوات
        </Button>
        {YEARS.map((y) => (
          <Button
            key={y}
            size="sm"
            variant={year === y ? "default" : "outline"}
            onClick={() => setYear(year === y ? null : y)}
            className="rounded-full h-8"
          >
            {y}سنة
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center text-muted-foreground py-16">جاري التحميل…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-muted-foreground py-16">
          <BookOpen className="mx-auto h-10 w-10 mb-3 opacity-50" />
          مفيش كتب مطابقة لبحثك حاليًا
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((b) => <BookCard key={b.id} book={b} />)}
        </div>
      )}
    </div>
  );
}