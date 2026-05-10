import { useGetHomeFeed } from "@workspace/api-client-react";
import { useGetMe } from "@workspace/api-client-react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import {
  Leaf,
  Sparkles,
  GraduationCap,
  BookOpen,
  Award,
  ArrowLeft,
  Wheat,
  Sun,
  TreePine,
  Beaker,
  LogIn,
  UserPlus,
} from "lucide-react";
import { useTranslation, globalI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

function AnimatedCounter({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const dur = 1500;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      setDisplay(Math.round(start + (value - start) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{display.toLocaleString("ar-EG")}</>;
}

const FloatingLeaves = () => {
  const items = Array.from({ length: 12 });
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {items.map((_, i) => (
        <motion.div
          key={i}
          className="absolute text-primary/10"
          initial={{ y: -50, x: `${(i * 73) % 100}%`, rotate: 0 }}
          animate={{
            y: ["-10%", "110%"],
            rotate: [0, 360],
            x: [
              `${(i * 73) % 100}%`,
              `${((i * 73) % 100) + 10}%`,
              `${((i * 73) % 100) - 5}%`,
              `${(i * 73) % 100}%`,
            ],
          }}
          transition={{
            duration: 12 + (i % 5) * 2,
            repeat: Infinity,
            delay: i * 0.6,
            ease: "linear",
          }}
        >
          <Leaf className="h-6 w-6" />
        </motion.div>
      ))}
    </div>
  );
};

export default function Home() {
  const { data: feed, isLoading } = useGetHomeFeed();
  const { data: user } = useGetMe();
  const t = useTranslation(globalI18n);
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 500], [0, 150]);

  if (isLoading || !feed || !feed.stats) {
    return (
      <div className="container mx-auto px-4 py-32 text-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="inline-block"
        >
          <Leaf className="h-12 w-12 text-primary" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden">
      {/* HERO */}
      <section
        ref={heroRef}
        className="relative min-h-[90vh] flex items-center justify-center bg-gradient-to-br from-primary/15 via-background to-accent/20"
      >
        <FloatingLeaves />

        <motion.div
          style={{ y: heroY }}
          className="absolute top-20 start-10 hidden lg:block text-primary/20"
        >
          <Wheat className="h-32 w-32" />
        </motion.div>
        <motion.div
          style={{ y: heroY }}
          className="absolute bottom-20 end-10 hidden lg:block text-secondary/20"
        >
          <TreePine className="h-32 w-32" />
        </motion.div>

        <div className="container mx-auto px-3 sm:px-4 py-16 sm:py-20 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-primary/10 rounded-full border border-primary/20 mb-4 sm:mb-6"
          >
            <Sun className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-accent-foreground" />
            <span className="text-xs sm:text-sm font-medium text-primary">{t("heroBadge")}</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="font-serif text-4xl sm:text-5xl md:text-7xl font-bold leading-tight mb-4 sm:mb-6 bg-gradient-to-br from-primary via-primary to-secondary bg-clip-text text-transparent"
          >
            UniVerse
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="block text-xl sm:text-2xl md:text-4xl text-foreground mt-2 sm:mt-3 font-sans"
            >
              {t("heroSubtitle")}
            </motion.span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-6 sm:mb-10 px-2"
          >
            {t("heroDesc")}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.45 }}
            className="flex flex-wrap items-center justify-center gap-3"
          >
            {user ? (
              <>
                <Link href="/dashboard">
                  <Button
                    size="lg"
                    className="bg-gradient-to-r from-primary to-secondary text-primary-foreground shadow-xl shadow-primary/30 hover:shadow-2xl hover:shadow-primary/40 transition-all rounded-full px-8 h-12"
                  >
                    {t("dashboard")}
                    <ArrowLeft className="me-2 h-5 w-5" />
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button
                    size="lg"
                    className="bg-gradient-to-r from-primary to-secondary text-primary-foreground shadow-xl shadow-primary/30 hover:shadow-2xl hover:shadow-primary/40 transition-all rounded-full px-8 h-12"
                  >
                    {t("login")}
                    <LogIn className="me-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button
                    size="lg"
                    variant="outline"
                    className="rounded-full px-8 h-12 border-2"
                  >
                    {t("signup")}
                    <UserPlus className="me-2 h-5 w-5" />
                  </Button>
                </Link>
              </>
            )}
          </motion.div>

          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute bottom-6 start-1/2 -translate-x-1/2"
          >
            <div className="h-10 w-6 rounded-full border-2 border-primary/40 flex items-start justify-center pt-2">
              <div className="h-2 w-1 rounded-full bg-primary/60" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* STATS */}
      <section className="container mx-auto px-3 sm:px-4 py-10 sm:py-16">
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {[
            { icon: GraduationCap, value: feed.stats.students, labelKey: "statStudents", color: "from-primary to-primary/60" },
            { icon: BookOpen, value: feed.stats.staff, labelKey: "statStaff", color: "from-secondary to-secondary/60" },
            { icon: Beaker, value: feed.stats.courses, labelKey: "statCourses", color: "from-accent to-accent/60" },
            { icon: Award, value: feed.stats.researchProjects, labelKey: "statProjects", color: "from-emerald-600 to-emerald-400" },
          ].map((stat, i) => (
            <motion.div
              key={stat.labelKey}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              whileHover={{ y: -6, scale: 1.02 }}
              className={`relative overflow-hidden rounded-xl sm:rounded-2xl p-4 sm:p-6 bg-gradient-to-br ${stat.color} text-white shadow-xl shadow-primary/10`}
            >
              <stat.icon className="absolute top-2 end-2 sm:top-3 sm:end-3 h-8 w-8 sm:h-10 sm:w-10 opacity-20" />
              <stat.icon className="h-5 w-5 sm:h-7 sm:w-7 mb-2 sm:mb-3" />
              <div className="text-2xl sm:text-4xl font-bold tabular-nums">
                <AnimatedCounter value={stat.value} />
              </div>
              <div className="text-xs sm:text-sm opacity-90 mt-1">{t(stat.labelKey)}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* DEAN */}
      {feed.dean && (
        <section className="container mx-auto px-3 sm:px-4 py-8 sm:py-12">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-card to-card/50 border-2 border-primary/10 rounded-2xl sm:rounded-3xl p-5 sm:p-8 md:p-12 shadow-xl backdrop-blur"
          >
            <div className="flex items-start gap-3 sm:gap-4 mb-3 sm:mb-4">
              <div className="bg-primary/10 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl shrink-0">
                <GraduationCap className="h-5 w-5 sm:h-7 sm:w-7 text-primary" />
              </div>
              <div>
                <div className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground font-bold mb-1">
                  {t("deanMessage")}
                </div>
                <h2 className="text-lg sm:text-2xl md:text-3xl font-serif font-bold">{feed.dean.name}</h2>
              </div>
            </div>
            <p className="text-muted-foreground leading-loose text-sm sm:text-lg">{feed.dean.bio}</p>
          </motion.div>
        </section>
      )}

      {/* NEWS */}
      <section className="container mx-auto px-3 sm:px-4 py-8 sm:py-12">
        <div className="flex items-center justify-between mb-6 sm:mb-8 flex-wrap gap-2">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold">{t("news")}</h2>
          <Link href="/news">
            <Button variant="ghost" className="gap-2 text-sm">
              {t("viewAll")}
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
          {feed.latestNews.map((news, i) => (
            <motion.div
              key={news.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              whileHover={{ y: -6 }}
            >
              <Link
                href={`/news/${news.id}`}
                className="block group bg-card rounded-2xl overflow-hidden shadow-lg shadow-primary/5 hover:shadow-2xl hover:shadow-primary/15 border border-border transition-all"
              >
                {(news as any).imageUrl && (
                  <div className="relative h-36 sm:h-48 overflow-hidden">
                    <img
                      src={(news as any).imageUrl}
                      alt={news.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  </div>
                )}
                <div className="p-4 sm:p-6">
                  <h3 className="font-bold text-base sm:text-lg mb-2 group-hover:text-primary transition-colors line-clamp-2">
                    {news.title}
                  </h3>
                  <p className="text-muted-foreground text-sm line-clamp-2">{news.excerpt}</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-3 sm:px-4 py-10 sm:py-16">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-primary via-primary/90 to-secondary p-6 sm:p-10 md:p-16 text-primary-foreground"
        >
          <div className="absolute -top-10 -end-10 opacity-20 hidden sm:block">
            <Wheat className="h-48 w-48" />
          </div>
          <div className="relative">
            <h2 className="text-xl sm:text-3xl md:text-4xl font-serif font-bold mb-3 sm:mb-4">
              {t("ctaTitle")}
            </h2>
            <p className="text-sm sm:text-lg opacity-90 mb-6 sm:mb-8 max-w-xl">
              {t("ctaDesc")}
            </p>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <Link href="/talents">
                <Button size="sm" variant="secondary" className="rounded-full sm:h-11">
                  {t("browseTalents")}
                </Button>
              </Link>
              <Link href="/games">
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full bg-white/10 text-white border-white/40 hover:bg-white/20 sm:h-11"
                >
                  {t("tryGames")}
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
