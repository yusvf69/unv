import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, Brain, Wheat, Timer, Star, RotateCcw, Sprout, Beaker,
  Sparkles, Zap, Flame, Target, Medal,
  Gamepad2,
  Calendar, Search, Sword, Shield, Droplets, FlaskConical, Warehouse,
  ShieldAlert, TreePine, Gauge,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api, useMeV2, useGameLeaderboard, useGameStats, useStreak, useChallenges, useClaimDailyReward } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation, globalI18n } from "@/lib/i18n";
import { useLocation } from "wouter";

// ── Star calculation ──
function starsForScore(score: number, maxScore: number): number {
  if (score >= maxScore * 0.8) return 3;
  if (score >= maxScore * 0.5) return 2;
  if (score > 0) return 1;
  return 0;
}

function starDisplay(stars: number) {
  return [1, 2, 3].map((s) => (
    <Star key={s} className={`h-3 w-3 ${s <= stars ? "text-amber-500 fill-amber-500" : "text-muted-foreground/30"}`} />
  ));
}

// ── Game metadata ──
interface GameMeta {
  key: string; labelAr: string; icon: any; levels: { name: string; config: any; maxScore: number }[];
  skillTag: string; desc: string; duration: string;
}
const GAME_META: GameMeta[] = [
  {
    key: "soil_match", labelAr: "ذاكرة المحاصيل", icon: Brain,
    skillTag: "أكاديمية", desc: "طابق أزواج الرموز الزراعية في أقل محاولات", duration: "1-3 د",
    levels: [
      { name: "مبتدئ", config: { pairs: 4 }, maxScore: 450 },
      { name: "متوسط", config: { pairs: 6 }, maxScore: 650 },
      { name: "متقدم", config: { pairs: 8 }, maxScore: 850 },
    ],
  },
  {
    key: "plant_quiz", labelAr: "اختبار النبات", icon: Wheat,
    skillTag: "أكاديمية", desc: "10 أسئلة في علوم الزراعة من 30 سؤال", duration: "2-4 د",
    levels: [
      { name: "مبتدئ", config: {}, maxScore: 1000 },
      { name: "متوسط", config: {}, maxScore: 1000 },
      { name: "متقدم", config: {}, maxScore: 1000 },
    ],
  },
  {
    key: "harvest_run", labelAr: "موسم الحصاد", icon: Trophy,
    skillTag: "عملية", desc: "اجمع المحاصيل وتجنب الآفات في 30 ثانية", duration: "30 ث",
    levels: [
      { name: "سهل", config: {}, maxScore: 1500 },
      { name: "صعب", config: {}, maxScore: 1500 },
    ],
  },
  {
    key: "plant_id", labelAr: "تعرّف على النبات", icon: Sprout,
    skillTag: "عملية", desc: "حدّد اسم النبات من صورته", duration: "1-2 د",
    levels: [
      { name: "مبتدئ", config: { questions: 6 }, maxScore: 480 },
      { name: "متقدم", config: { questions: 12 }, maxScore: 960 },
    ],
  },
  {
    key: "soil_ph", labelAr: "توازن التربة", icon: Beaker,
    skillTag: "مختبرية", desc: "اضبط قيمة pH لتتناسب مع المحصول المطلوب", duration: "1-2 د",
    levels: [
      { name: "مبتدئ", config: { rounds: 6 }, maxScore: 900 },
      { name: "متقدم", config: { rounds: 10 }, maxScore: 1500 },
    ],
  },
  {
    key: "crop_match", labelAr: "مطابقة المحاصيل", icon: Calendar,
    skillTag: "أكاديمية", desc: "طابق كل محصول بموسم زراعته الصحيح", duration: "1-2 د",
    levels: [
      { name: "مبتدئ", config: { questions: 8 }, maxScore: 800 },
      { name: "متقدم", config: { questions: 12 }, maxScore: 1200 },
    ],
  },
  {
    key: "disease_detect", labelAr: "كشف الأمراض", icon: Search,
    skillTag: "مختبرية", desc: "شخّص مرض النبات من الأعراض والصور", duration: "2-4 د",
    levels: [
      { name: "مبتدئ", config: { questions: 6 }, maxScore: 600 },
      { name: "متوسط", config: { questions: 10 }, maxScore: 1000 },
      { name: "متقدم", config: { questions: 14 }, maxScore: 1400 },
    ],
  },
  {
    key: "case_battle", labelAr: "معركة القرار", icon: Sword,
    skillTag: "عملية", desc: "اختر أفضل قرار زراعي في سيناريوهات واقعية", duration: "3-5 د",
    levels: [
      { name: "مبتدئ", config: { cases: 5 }, maxScore: 1000 },
      { name: "متوسط", config: { cases: 8 }, maxScore: 1600 },
      { name: "متقدم", config: { cases: 10 }, maxScore: 2000 },
    ],
  },
  {
    key: "pest_defender", labelAr: "مدافع الآفات", icon: Shield,
    skillTag: "عملية", desc: "احمِ محصولك من هجمات الآفات بإجراءات وقائية", duration: "2-4 د",
    levels: [
      { name: "سهل", config: { waves: 4, speed: 1 }, maxScore: 800 },
      { name: "متوسط", config: { waves: 6, speed: 1.3 }, maxScore: 1200 },
      { name: "صعب", config: { waves: 8, speed: 1.6 }, maxScore: 1600 },
    ],
  },
  {
    key: "irrigation_planner", labelAr: "مخطط الري", icon: Droplets,
    skillTag: "مختبرية", desc: "اختر خطة الري المثلى حسب التربة والمحصول والمناخ", duration: "2-3 د",
    levels: [
      { name: "مبتدئ", config: { cases: 5 }, maxScore: 750 },
      { name: "متقدم", config: { cases: 10 }, maxScore: 1500 },
    ],
  },
  {
    key: "fertilizer_lab", labelAr: "مختبر التسميد", icon: FlaskConical,
    skillTag: "مختبرية", desc: "ركّب خطة التسميد المثلى بناءً على أعراض النقص", duration: "2-4 د",
    levels: [
      { name: "مبتدئ", config: { questions: 6 }, maxScore: 600 },
      { name: "متوسط", config: { questions: 10 }, maxScore: 1000 },
      { name: "متقدم", config: { questions: 14 }, maxScore: 1400 },
    ],
  },
  {
    key: "greenhouse_manager", labelAr: "مدير الصوبة", icon: Warehouse,
    skillTag: "عملية", desc: "أدر صوبة زراعية — حرارة، رطوبة، ري، تسميد، أرباح", duration: "3-6 د",
    levels: [
      { name: "سهل", config: { days: 7 }, maxScore: 1400 },
      { name: "متوسط", config: { days: 14 }, maxScore: 2000 },
      { name: "صعب", config: { days: 21 }, maxScore: 2800 },
    ],
  },
  {
    key: "lab_safety", labelAr: "سلامة المعمل", icon: ShieldAlert,
    skillTag: "مختبرية", desc: "رتّب خطوات العمل المعملي بالترتيب الصحيح", duration: "1-2 د",
    levels: [
      { name: "مبتدئ", config: { steps: 5 }, maxScore: 500 },
      { name: "متقدم", config: { steps: 8 }, maxScore: 800 },
    ],
  },
  {
    key: "seed_to_harvest", labelAr: "من البذرة للحصاد", icon: TreePine,
    skillTag: "أكاديمية", desc: "اختر القرارات الصحيحة في كل مرحلة من حياة النبات", duration: "3-5 د",
    levels: [
      { name: "مبتدئ", config: { stages: 5 }, maxScore: 1000 },
      { name: "متوسط", config: { stages: 7 }, maxScore: 1400 },
      { name: "متقدم", config: { stages: 9 }, maxScore: 1800 },
    ],
  },
  {
    key: "exam_blitz", labelAr: "الاجتياح", icon: Gauge,
    skillTag: "أكاديمية", desc: "60 ثانية من الأسئلة الخاطفة — أجب بأسرع ما يمكنك", duration: "1 د",
    levels: [
      { name: "مبتدئ", config: {}, maxScore: 1000 },
      { name: "متوسط", config: {}, maxScore: 1000 },
      { name: "متقدم", config: {}, maxScore: 1000 },
    ],
  },
];

// ── Existing game components (ported with level support) ──
const ICONS_FULL = ["🌱","🌾","🌻","🌽","🍅","🥕","🍇","🌿","🍎","🌶️","🥒","🥦","🍓","🍑","🌳","🍃"];

function MemoryMatch({ onScore, level }: { onScore: (s: number) => void; level: number }) {
  const t = useTranslation(globalI18n);
  const pairs = GAME_META[0].levels[level]?.config.pairs || 6;
  const [cards, setCards] = useState<{ id: number; icon: string; flipped: boolean; matched: boolean }[]>([]);
  const [first, setFirst] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [start, setStart] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  const init = useCallback((n: number = pairs) => {
    const pool = [...ICONS_FULL].sort(() => Math.random() - 0.5).slice(0, n);
    const deck = [...pool, ...pool].sort(() => Math.random() - 0.5).map((icon, i) => ({ id: i, icon, flipped: false, matched: false }));
    setCards(deck); setFirst(null); setMoves(0); setStart(Date.now()); setDone(false);
  }, [pairs]);

  useEffect(() => { init(); }, [init]);

  const flip = (id: number) => {
    if (done) return;
    const c = cards[id];
    if (c.flipped || c.matched) return;
    const next = cards.map((x) => (x.id === id ? { ...x, flipped: true } : x));
    setCards(next);
    if (first === null) setFirst(id);
    else {
      setMoves((m) => m + 1);
      const a = next[first], b = next[id];
      if (a.icon === b.icon) {
        setTimeout(() => { setCards((cur) => cur.map((x) => (x.id === a.id || x.id === b.id ? { ...x, matched: true } : x))); setFirst(null); }, 300);
      } else {
        setTimeout(() => { setCards((cur) => cur.map((x) => (x.id === a.id || x.id === b.id ? { ...x, flipped: false } : x))); setFirst(null); }, 700);
      }
    }
  };

  useEffect(() => {
    if (cards.length && cards.every((c) => c.matched) && !done) {
      setDone(true);
      const dur = Date.now() - (start ?? 0);
      const score = Math.max(50, pairs * 100 - moves * 15 - Math.floor(dur / 1000) * 2);
      onScore(score);
    }
  }, [cards, done]);

  const cols = pairs <= 4 ? 4 : pairs <= 6 ? 4 : 5;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs sm:text-sm text-muted-foreground">
        <span>حركات: {moves}</span>
        <Button size="sm" variant="outline" onClick={() => init()} className="h-7 text-xs gap-1"><RotateCcw className="h-3 w-3" />إعادة</Button>
      </div>
      <div className="grid gap-1.5 sm:gap-2" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {cards.map((c) => (
          <button key={c.id} onClick={() => flip(c.id)}
            className={`aspect-square rounded-xl text-lg sm:text-2xl font-bold transition-all ${c.flipped || c.matched ? "bg-card border shadow-sm" : "bg-primary/10 border border-primary/20 hover:bg-primary/20"} ${c.matched ? "opacity-60" : ""}`}>
            {c.flipped || c.matched ? c.icon : "?"}
          </button>
        ))}
      </div>
      {done && <p className="text-center text-sm font-bold text-emerald-600">اكتمل! 🎉</p>}
    </div>
  );
}

const PLANT_QUESTIONS = [
  { q: "أي عنصر غذائي رئيسي يعزز النمو الخضري؟", options: ["نيتروجين", "فوسفور", "بوتاسيوم", "كالسيوم"], answer: 0 },
  { q: "ما هو نطاق pH المناسب لمعظم المحاصيل؟", options: ["4-5", "6-7.5", "8-9", "9-10"], answer: 1 },
  { q: "أي مما يلي يعتبر آفة زراعية؟", options: ["دودة القطن", "نحلة العسل", "دودة الأرض", "الخنفساء"], answer: 0 },
  { q: "ما هي طريقة الري الأكثر كفاءة في استخدام المياه؟", options: ["الري بالتنقيط", "الري بالغمر", "الري بالرش", "الري السطحي"], answer: 0 },
  { q: "أي محصول يتحمل الملوحة العالية؟", options: ["الشعير", "الأرز", "الموز", "الفراولة"], answer: 0 },
  { q: "ما هو العنصر المسؤول عن تكوين الزهور والثمار؟", options: ["نيتروجين", "فوسفور", "بوتاسيوم", "حديد"], answer: 1 },
  { q: "أي الأمراض التالية يسببه فطر؟", options: ["البياض الدقيقي", "اللفحة البكتيرية", "تورد القمة", "موزاييك التبغ"], answer: 0 },
  { q: "ما هي وظيفة الجذور في النبات؟", options: ["امتصاص الماء والعناصر", "البناء الضوئي", "التكاثر", "نقل العصارة"], answer: 0 },
  { q: "أي نوع تربة يحتفظ بالماء أكثر؟", options: ["التربة الطينية", "التربة الرملية", "التربة الطميية", "التربة الحصوية"], answer: 0 },
  { q: "ما هو أفضل وقت لري المحاصيل في الصيف؟", options: ["الصباح الباكر", "الظهر", "العصر", "منتصف الليل"], answer: 0 },
  { q: "أي محصول يعتبر مصدراً رئيسياً للبروتين في مصر؟", options: ["الفول", "الأرز", "القمح", "الذرة"], answer: 0 },
  { q: "ما هو العنصر الذي يسبب أعراض نقصه اصفرار الأوراق؟", options: ["الحديد", "الكالسيوم", "الماغنسيوم", "الكبريت"], answer: 0 },
  { q: "أي المبيدات التالية تعتبر صديقة للبيئة؟", options: ["المبيدات الحيوية", "المبيدات الكلورية", "مبيدات الفوسفور", "مبيدات الكربامات"], answer: 0 },
  { q: "ما هو العامل الأكثر تأثيراً في سرعة إنبات البذور؟", options: ["درجة الحرارة", "شدة الإضاءة", "سرعة الرياح", "الرطوبة الجوية"], answer: 0 },
  { q: "أي نوع من الأسمدة يوفر العناصر ببطء؟", options: ["السماد العضوي", "سماد اليوريا", "سماد نترات الأمونيوم", "سماد سوبر فوسفات"], answer: 0 },
  { q: "ما هو المرض الذي يصيب القمح ويسبب صدأ الأوراق؟", options: ["الصدأ الأصفر", "البياض الدقيقي", "اللفحة", "تبقع الأوراق"], answer: 0 },
  { q: "ما هي أفضل درجة حرارة لتخزين الحبوب؟", options: ["أقل من 15°م", "20-25°م", "30-35°م", "فوق 40°م"], answer: 0 },
  { q: "أي محاصيل المجموع الخضري يتطلب تقليم مستمر؟", options: ["الطماطم", "القمح", "الأرز", "الشعير"], answer: 0 },
  { q: "ما هو العنصر الذي يدخل في تكوين الكلوروفيل؟", options: ["الماغنسيوم", "المنجنيز", "الزنك", "النحاس"], answer: 0 },
  { q: "ما هو المحصول الأكثر استهلاكاً للمياه؟", options: ["الأرز", "القمح", "الذرة", "الشعير"], answer: 0 },
  { q: "أي من الآفات التالية تصيب محصول القطن؟", options: ["دودة ورق القطن", "حفار الساق", "من الخوخ", "ذبابة الفاكهة"], answer: 0 },
  { q: "ما هو أفضل pH للتربة الرملية؟", options: ["6-7", "4-5", "8-9", "أقل من 4"], answer: 0 },
  { q: "أي مما يلي يعتبر محصولاً زيتياً؟", options: ["فول الصويا", "القمح", "الأرز", "الذرة"], answer: 0 },
  { q: "ما هو الهرمون النباتي المسؤول عن النضج؟", options: ["الإيثيلين", "الأوكسين", "الجبرلين", "السيتوكينين"], answer: 0 },
  { q: "أي النباتات التالية تثبت النيتروجين الجوي؟", options: ["البقوليات", "النباتات النجيلية", "الصبار", "النباتات المائية"], answer: 0 },
  { q: "ما هو تأثير ملوحة التربة على النبات؟", options: ["تقليل الامتصاص", "زيادة النمو", "تحسين الإزهار", "تكبير الثمار"], answer: 0 },
  { q: "أي العمليات التالية تتم في مرحلة ما بعد الحصاد؟", options: ["التدريج والفرز", "الزراعة", "التقليم", "التسميد"], answer: 0 },
  { q: "ما هو نظام الزراعة بدون تربة؟", options: ["الزراعة المائية", "الزراعة الحقلية", "الزراعة الجافة", "الزراعة المطرية"], answer: 0 },
  { q: "أي من هذه المحاصيل يزرع شتلاً وليس بذوراً؟", options: ["الطماطم", "القمح", "الشعير", "العدس"], answer: 0 },
  { q: "ما هو العامل المسبب لمرض اللفحة المبكرة في الطماطم؟", options: ["فطر Alternaria", "بكتيريا", "فيروس", "نيماتودا"], answer: 0 },
];

function PlantQuiz({ onScore, level }: { onScore: (s: number) => void; level: number }) {
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const pool = useMemo(() => [...PLANT_QUESTIONS].sort(() => Math.random() - 0.5).slice(0, 10), [level]);
  const q = pool[idx];

  const answer = (i: number) => {
    if (done) return;
    if (i === q.answer) {
      const newScore = score + 100;
      setScore(newScore);
      if (idx >= pool.length - 1) { setDone(true); onScore(newScore); }
      else setIdx((x) => x + 1);
    } else {
      if (idx >= pool.length - 1) { setDone(true); onScore(score); }
      else setIdx((x) => x + 1);
    }
  };

  if (!q && !done) return null;
  if (done) return <p className="text-center text-sm font-bold text-emerald-600">النتيجة: {score}/1000 🎉</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs sm:text-sm text-muted-foreground">
        <span>سؤال {idx + 1}/{pool.length}</span>
        <span className="font-bold">{score}/{pool.length * 100}</span>
      </div>
      <p className="font-bold text-sm sm:text-base">{q.q}</p>
      <div className="space-y-1.5">
        {q.options.map((opt, i) => (
          <button key={i} onClick={() => answer(i)}
            className="w-full text-right p-2.5 rounded-lg border hover:bg-primary/5 hover:border-primary/30 transition text-xs sm:text-sm">
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function HarvestRun({ onScore, level }: { onScore: (s: number) => void; level: number }) {
  const [pos, setPos] = useState(50);
  const [items, setItems] = useState<{ id: number; x: number; y: number; good: boolean }[]>([]);
  const [score, setScore] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [done, setDone] = useState(false);
  const speed = level === 1 ? 25 : 35;

  useEffect(() => {
    if (!playing) return;
    const iv = setInterval(() => {
      setItems((prev) => {
        const falling = prev.map((i) => ({ ...i, y: i.y + speed }));
        const collected = falling.filter((i) => i.y > 90 && Math.abs(i.x - pos / 5) < 8);
        let newScore = score;
        for (const c of collected) { newScore += c.good ? 50 : -30; }
        if (collected.length) setScore(newScore);
        const remaining = falling.filter((i) => i.y < 100 && !collected.includes(i));
        if (Math.random() < 0.08) {
          remaining.push({ id: Date.now() + Math.random(), x: Math.random() * 95, y: 0, good: Math.random() > 0.3 });
        }
        return remaining;
      });
    }, 100);
    const timeout = setTimeout(() => { setPlaying(false); setDone(true); onScore(score); }, 30000);
    return () => { clearInterval(iv); clearTimeout(timeout); };
  }, [playing, score, pos]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>النتيجة: {score}</span>
        <Timer className="h-3.5 w-3.5" />
      </div>
      <div className="relative h-80 bg-gradient-to-b from-sky-50 to-amber-50 rounded-xl border overflow-hidden"
        onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setPos(((e.clientX - r.left) / r.width) * 100); }}
        onTouchMove={(e) => { const t = e.touches[0]; const r = e.currentTarget.getBoundingClientRect(); setPos(((t.clientX - r.left) / r.width) * 100); }}>
        {items.map((i) => (
          <div key={i.id} className="absolute text-lg sm:text-xl transition-all" style={{ left: `${i.x}%`, top: `${i.y}%` }}>
            {i.good ? "🌾" : "🦗"}
          </div>
        ))}
        <div className="absolute bottom-2 left-0 right-0 flex justify-center">
          <div className="text-2xl sm:text-3xl transition-all" style={{ transform: `translateX(${pos - 50}%)` }}>🧺</div>
        </div>
      </div>
      {done && <p className="text-center text-xs font-bold text-emerald-600">انتهى! النتيجة: {score}</p>}
    </div>
  );
}

function PlantIdGame({ onScore, level }: { onScore: (s: number) => void; level: number }) {
  const PLANTS = [
    { emoji: "🌽", nameAr: "ذرة" }, { emoji: "🌾", nameAr: "قمح" }, { emoji: "🍅", nameAr: "طماطم" },
    { emoji: "🥕", nameAr: "جزر" }, { emoji: "🌻", nameAr: "دوّار الشمس" }, { emoji: "🍇", nameAr: "عنب" },
    { emoji: "🌶️", nameAr: "فلفل" }, { emoji: "🍓", nameAr: "فراولة" }, { emoji: "🥦", nameAr: "بروكلي" },
    { emoji: "🥒", nameAr: "خيار" }, { emoji: "🍑", nameAr: "خوخ" }, { emoji: "🫒", nameAr: "زيتون" },
  ];
  const totalQ = GAME_META[3].levels[level]?.config.questions || 8;
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const pool = useMemo(() => [...PLANTS].sort(() => Math.random() - 0.5).slice(0, totalQ), [level]);
  const plant = pool[round];
  const options = useMemo(() => {
    const others = PLANTS.filter((p) => p.nameAr !== plant?.nameAr).sort(() => Math.random() - 0.5).slice(0, 3);
    return plant ? [plant, ...others].sort(() => Math.random() - 0.5) : [];
  }, [round, plant]);

  const guess = (name: string) => {
    if (done) return;
    const correct = name === plant.nameAr;
    const newScore = correct ? score + 80 : score;
    setScore(newScore);
    if (round >= pool.length - 1) { setDone(true); onScore(newScore); }
    else setRound((r) => r + 1);
  };

  if (!plant) return null;
  if (done) return <p className="text-center text-sm font-bold text-emerald-600">النتيجة: {score}/{totalQ * 80} 🎉</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{round + 1}/{pool.length}</span>
        <span className="font-bold">{score}/{pool.length * 80}</span>
      </div>
      <div className="text-6xl sm:text-7xl text-center py-4">{plant.emoji}</div>
      <p className="text-xs text-center text-muted-foreground">ما اسم هذا النبات؟</p>
      <div className="grid grid-cols-2 gap-2">
        {options.map((opt, i) => (
          <button key={i} onClick={() => guess(opt.nameAr)}
            className="p-2.5 rounded-lg border text-xs sm:text-sm hover:bg-primary/5 hover:border-primary/30 transition font-medium">
            {opt.nameAr}
          </button>
        ))}
      </div>
    </div>
  );
}

function SoilPhGame({ onScore, level }: { onScore: (s: number) => void; level: number }) {
  const rounds = GAME_META[4].levels[level]?.config.rounds || 6;
  const [round, setRound] = useState(0);
  const [target, setTarget] = useState(7);
  const [value, setValue] = useState(7);
  const [score, setScore] = useState(0);
  const [result, setResult] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => { setTarget(Math.round((3 + Math.random() * 7) * 10) / 10); setResult(null); setValue(7); }, [round]);

  const submit = () => {
    const diff = Math.abs(value - target);
    const pts = Math.max(0, Math.round(150 - diff * 80));
    const newScore = score + pts;
    setScore(newScore);
    setResult(pts);
    setTimeout(() => {
      if (round >= rounds - 1) { setDone(true); onScore(newScore); }
      else setRound((r) => r + 1);
    }, 1500);
  };

  if (done) return <p className="text-center text-sm font-bold text-emerald-600">النتيجة: {score} 🎉</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>جولة {round + 1}/{rounds}</span>
        <span className="font-bold">{score}</span>
      </div>
      <p className="text-center text-sm font-bold">اضبط pH لـ <span className="text-primary">{target}</span></p>
      <input type="range" min="3" max="10" step="0.1" value={value} onChange={(e) => setValue(Number(e.target.value))}
        className="w-full accent-primary" />
      <div className="text-center text-lg font-bold">{value.toFixed(1)}</div>
      <div className="h-3 rounded-full" style={{
        background: `linear-gradient(to right, #ef4444, #f59e0b, #84cc16, #22c55e, #84cc16, #f59e0b, #ef4444)`
      }} />
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>حامضي 3</span><span>متعادل 7</span><span>قلوي 10</span>
      </div>
      <Button onClick={submit} disabled={result !== null} className="w-full h-9 text-sm">
        {result !== null ? `+${result} نقطة` : "تأكيد"}
      </Button>
    </div>
  );
}

// ── New Game: Crop Match ──
const CROPS = [
  { nameAr: "قمح", season: "شتوي", icon: "🌾" },
  { nameAr: "ذرة", season: "صيفي", icon: "🌽" },
  { nameAr: "أرز", season: "صيفي", icon: "🍚" },
  { nameAr: "فول", season: "شتوي", icon: "🫘" },
  { nameAr: "طماطم", season: "صيفي", icon: "🍅" },
  { nameAr: "برسيم", season: "شتوي", icon: "🌿" },
  { nameAr: "قطن", season: "صيفي", icon: "☁️" },
  { nameAr: "شعير", season: "شتوي", icon: "🌾" },
  { nameAr: "بطاطس", season: "شتوي", icon: "🥔" },
  { nameAr: "بطيخ", season: "صيفي", icon: "🍉" },
  { nameAr: "بصل", season: "شتوي", icon: "🧅" },
  { nameAr: "فلفل", season: "صيفي", icon: "🌶️" },
  { nameAr: "بنجر", season: "شتوي", icon: "🟣" },
  { nameAr: "قصب سكر", season: "صيفي", icon: "🎋" },
  { nameAr: "كرنب", season: "شتوي", icon: "🥬" },
  { nameAr: "خيار", season: "صيفي", icon: "🥒" },
];
function CropMatch({ onScore, level }: { onScore: (s: number) => void; level: number }) {
  const totalQ = GAME_META[5].levels[level]?.config.questions || 8;
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const pool = useMemo(() => [...CROPS].sort(() => Math.random() - 0.5).slice(0, totalQ), [level]);
  const crop = pool[round];
  const seasons = ["شتوي", "صيفي"];

  const pick = (season: string) => {
    if (done || !crop) return;
    const correct = season === crop.season;
    const newScore = correct ? score + 100 : score;
    setScore(newScore);
    if (round >= pool.length - 1) { setDone(true); onScore(newScore); }
    else setRound((r) => r + 1);
  };

  if (!crop) return null;
  if (done) return <p className="text-center text-sm font-bold text-emerald-600">النتيجة: {score}/{totalQ * 100} 🎉</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{round + 1}/{pool.length}</span>
        <span className="font-bold">{score}/{totalQ * 100}</span>
      </div>
      <div className="text-center py-4">
        <span className="text-5xl sm:text-6xl">{crop.icon}</span>
        <p className="font-bold text-base mt-2">{crop.nameAr}</p>
        <p className="text-[10px] text-muted-foreground">في أي موسم يُزرع هذا المحصول؟</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {seasons.map((s) => (
          <button key={s} onClick={() => pick(s)}
            className={`p-4 rounded-xl border text-sm font-bold transition hover:bg-primary/5 hover:border-primary/30 ${
              s === "شتوي" ? "border-blue-300 bg-blue-50/50 dark:bg-blue-950/20" : "border-orange-300 bg-orange-50/50 dark:bg-orange-950/20"
            }`}
          >
            <span className="text-xl block mb-1">{s === "شتوي" ? "❄️" : "☀️"}</span>
            {s === "شتوي" ? "موسم شتوي" : "موسم صيفي"}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── New Game: Disease Detective ──
const DISEASES = [
  { nameAr: "البياض الدقيقي", symptoms: "مسحوق أبيض على الأوراق والسيقان", cause: "فطر", crop: "عنبية", icon: "🍇" },
  { nameAr: "الصدأ الأصفر", symptoms: "بقع صفراء-برتقالية على الأوراق", cause: "فطر", crop: "قمح", icon: "🌾" },
  { nameAr: "اللفحة المبكرة", symptoms: "بقع بنية داكنة على الأوراق السفلية", cause: "فطر Alternaria", crop: "طماطم", icon: "🍅" },
  { nameAr: "الذبول البكتيري", symptoms: "ذبول مفاجئ دون اصفرار", cause: "بكتيريا", crop: "خيار", icon: "🥒" },
  { nameAr: "تورد القمة", symptoms: "تقزم واصفرار وتجعد الأوراق", cause: "فيروس", crop: "فلفل", icon: "🌶️" },
  { nameAr: "العفن الرمادي", symptoms: "عفن رمادي على الثمار والأزهار", cause: "فطر Botrytis", crop: "فراولة", icon: "🍓" },
  { nameAr: "تبقع الأوراق", symptoms: "بقع دائرية بنية على الأوراق", cause: "فطر", crop: "فول", icon: "🫘" },
  { nameAr: "النيماتودا", symptoms: "تقرحات على الجذور وتقزم", cause: "نيماتودا", crop: "طماطم", icon: "🍅" },
  { nameAr: "اللفحة المتأخرة", symptoms: "بقع مائية داكنة على الأوراق والثمار", cause: "فطر Phytophthora", crop: "بطاطس", icon: "🥔" },
  { nameAr: "موزاييك التبغ", symptoms: "تبقع فسيفسائي أصفر-أخضر", cause: "فيروس", crop: "تبغ", icon: "🌿" },
  { nameAr: "العفن الطري", symptoms: "تليّن الثمار مع عفن مائي", cause: "فطر Rhizopus", crop: "خوخ", icon: "🍑" },
  { nameAr: "الأنثراكنوز", symptoms: "بقع غائرة داكنة على الثمار", cause: "فطر Colletotrichum", crop: "فلفل", icon: "🌶️" },
  { nameAr: "البياض الزغبي", symptoms: "زغب رمادي-بنفسجي تحت الأوراق", cause: "فطر Peronospora", crop: "عنب", icon: "🍇" },
  { nameAr: "حفار الساق", symptoms: "ثقوب في الساق وذبول", cause: "حشرة", crop: "ذرة", icon: "🌽" },
  { nameAr: "من الخوخ", symptoms: "تجعد الأوراق وإفراز عسلي", cause: "حشرة", crop: "خوخ", icon: "🍑" },
  { nameAr: "ذبابة الفاكهة", symptoms: "ثقوب صغيرة وتعفن الثمار", cause: "حشرة", crop: "فاكهة", icon: "🍎" },
];
function DiseaseDetective({ onScore, level }: { onScore: (s: number) => void; level: number }) {
  const totalQ = GAME_META[6].levels[level]?.config.questions || 10;
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [choices, setChoices] = useState<string[]>([]);
  const pool = useMemo(() => [...DISEASES].sort(() => Math.random() - 0.5).slice(0, totalQ), [level]);
  const disease = pool[round];

  useEffect(() => {
    if (disease) {
      const others = DISEASES.filter((d) => d.nameAr !== disease.nameAr).sort(() => Math.random() - 0.5).slice(0, 3);
      setChoices([disease, ...others].sort(() => Math.random() - 0.5).map((d) => d.nameAr));
    }
  }, [round, disease]);

  const guess = (name: string) => {
    if (done || !disease) return;
    const correct = name === disease.nameAr;
    const newScore = correct ? score + 100 : score;
    setScore(newScore);
    if (round >= pool.length - 1) { setDone(true); onScore(newScore); }
    else setRound((r) => r + 1);
  };

  if (!disease) return null;
  if (done) return <p className="text-center text-sm font-bold text-emerald-600">النتيجة: {score}/{totalQ * 100} 🎉</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>حالة {round + 1}/{pool.length}</span>
        <span className="font-bold">{score}/{totalQ * 100}</span>
      </div>
      <div className="bg-amber-50 dark:bg-amber-950/20 border rounded-xl p-3 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-lg">{disease.icon}</span>
          <Badge variant="outline" className="text-[10px]">{disease.crop}</Badge>
        </div>
        <p className="font-bold text-sm">{disease.symptoms}</p>
        <p className="text-[10px] text-muted-foreground">ما اسم هذا المرض؟</p>
      </div>
      <div className="space-y-1.5">
        {choices.map((name, i) => (
          <button key={i} onClick={() => guess(name)}
            className="w-full text-right p-2.5 rounded-lg border hover:bg-primary/5 hover:border-primary/30 transition text-xs sm:text-sm"
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── New Game: Agronomy Case Battle ──
const AGRO_CASES = [
  {
    scenario: "حقل قمح يعاني من اصفرار الأوراق السفلية مع ضعف النمو. ماذا تفعل أولاً؟",
    options: [
      "تحليل التربة لقياس NPK",
      "ري فوري بكمية كبيرة",
      "إضافة سماد عضوي فقط",
      "رش مبيد فطري واسع الطيف",
    ],
    correct: 0,
    explanation: "تحليل التربة يعطي تشخيص دقيق لنقص العناصر قبل أي تدخل",
  },
  {
    scenario: "مزارع يريد تقليل استهلاك المياه في الأرز. ما أفضل نظام ري؟",
    options: [
      "الري بالتنقيط تحت السطحي",
      "الري بالغمر مع فترات أطول",
      "الري بالرش المحوري",
      "الري السطحي في الليل",
    ],
    correct: 0,
    explanation: "التنقيط تحت السطحي يوفر 70% من مياه الري مقارنة بالغمر التقليدي",
  },
  {
    scenario: "ظهور حشرات المن على محصول الفلفل في بداية الموسم. أفضل مكافحة؟",
    options: [
      "رش مبيد حشري حيوي",
      "ري الأرض بالمبيد",
      "حرق النباتات المصابة",
      "استخدام مصائد ضوئية",
    ],
    correct: 0,
    explanation: "المبيدات الحيوية آمنة في بداية الموسم ولا تؤثر على الأعداء الطبيعية",
  },
  {
    scenario: "تربة طينية ثقيلة بها مشكلة تصريف. كيف تحسن تهوية التربة؟",
    options: [
      "إضافة جبس زراعي وحرث عميق",
      "ري مستمر لتخفيف التربة",
      "إضافة سماد نيتروجيني",
      "تغطية التربة بالبلاستيك",
    ],
    correct: 0,
    explanation: "الجسيم يعمل على تحسين بناء التربة الطينية ويزيد المسامية",
  },
  {
    scenario: "أشجار موز تعاني من تقزم الأوراق وتشوه الثمار. السبب الأكثر احتمالاً؟",
    options: [
      "نقص البوتاسيوم",
      "زيادة الري",
      "إصابة فيروسية",
      "حرارة زائدة",
    ],
    correct: 0,
    explanation: "البوتاسيوم أساسي لتكوين الثمار وجودتها في الموز",
  },
  {
    scenario: "حقل بطاطس ظهرت عليه أعراض اللفحة المتأخرة. أسرع إجراء؟",
    options: [
      "رش مبيد فطري نحاسي",
      "إزالة النباتات المصابة فقط",
      "وقف الري تماماً",
      "إضافة سماد بوتاسي",
    ],
    correct: 0,
    explanation: "المبيدات النحاسية تعمل كدرع وقائي وعلاجي ضد الفطريات البيضية",
  },
  {
    scenario: "أفضل وقت لتطبيق السماد الفوسفاتي في محصول القمح؟",
    options: [
      "مع الزراعة مباشرة",
      "بعد شهر من الزراعة",
      "في مرحلة طرد السنابل",
      "عند نضج الحبوب",
    ],
    correct: 0,
    explanation: "الفوسفور ضروري لتطوير الجذور في المراحل المبكرة ويُضاف مع التسميد الأساسي",
  },
  {
    scenario: "تربة رملية بمنطقة جافة. أي محصول هو الأنسب للزراعة؟",
    options: [
      "الصباريات والنباتات المتحملة للجفاف",
      "الأرز الغمري",
      "الموز الاستوائي",
      "قصب السكر",
    ],
    correct: 0,
    explanation: "الصباريات والنباتات المتحملة للجفاف تناسب التربة الرملية والظروف الجافة",
  },
  {
    scenario: "ظهور أعفان على ثمار الطماطم بعد العقد. ما الإجراء الوقائي؟",
    options: [
      "تحسين التهوية وتقليل الرطوبة",
      "زيادة التسميد النيتروجيني",
      "ري بشكل متكرر",
      "تغطية الثمار بأكياس",
    ],
    correct: 0,
    explanation: "الأعفان تنتشر في الرطوبة العالية؛ تحسين التهوية يقلل الرطوبة حول الثمار",
  },
  {
    scenario: "انخفاض نسبة البروتين في حبوب القمح. العنصر الأكثر نقصاً؟",
    options: [
      "النيتروجين",
      "الفسفور",
      "البوتاسيوم",
      "الكالسيوم",
    ],
    correct: 0,
    explanation: "النيتروجين هو العنصر الأساسي لتكوين البروتين في الحبوب",
  },
  {
    scenario: "مشروع زراعي جديد بمياه مالحة (EC=4 dS/m). أي المحاصيل تختار؟",
    options: [
      "الشعير والسلق",
      "الفراولة والفول",
      "الخوخ والمشمش",
      "الأرز والموز",
    ],
    correct: 0,
    explanation: "الشعير والسلق من المحاصيل المتحملة للملوحة العالية",
  },
  {
    scenario: "حقل مصاب بالنيماتودا تعقدية الجذور. أفضل ممارسة إدارية؟",
    options: [
      "دورة زراعية مع بقوليات",
      "حرق بقايا المحصول السابق",
      "ري غزير بإفراط",
      "زراعة مستمرة لنفس المحصول",
    ],
    correct: 0,
    explanation: "البقوليات تكسر دورة حياة النيماتودا وتقلل تعدادها في التربة",
  },
];
function CaseBattle({ onScore, level }: { onScore: (s: number) => void; level: number }) {
  const totalQ = GAME_META[7].levels[level]?.config.cases || 8;
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState<number | null>(null);
  const pool = useMemo(() => [...AGRO_CASES].sort(() => Math.random() - 0.5).slice(0, totalQ), [level]);
  const c = pool[round];

  const pick = (i: number) => {
    if (selected !== null) return;
    setSelected(i);
    setRevealed(c.correct === i ? c.correct : i);
  };

  const next = () => {
    const pts = selected === c.correct ? (level + 1) * 100 : 0;
    const newScore = score + pts;
    setScore(newScore);
    setSelected(null);
    setRevealed(null);
    if (round >= pool.length - 1) { setDone(true); onScore(newScore); }
    else setRound((r) => r + 1);
  };

  if (!c) return null;
  if (done) return <p className="text-center text-sm font-bold text-emerald-600">النتيجة: {score} 🎉</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>قضية {round + 1}/{pool.length}</span>
        <span className="font-bold">{score} نقطة</span>
      </div>
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border rounded-xl p-3">
        <div className="flex items-center gap-2 mb-1">
          <Sword className="h-4 w-4 text-primary" />
          <span className="font-bold text-sm">سيناريو {round + 1}</span>
        </div>
        <p className="text-xs sm:text-sm">{c.scenario}</p>
      </div>
      <div className="space-y-1.5">
        {c.options.map((opt, i) => (
          <button key={i} onClick={() => pick(i)}
            className={`w-full text-right p-2.5 rounded-lg border text-xs sm:text-sm transition ${
              selected === null
                ? "hover:bg-primary/5 hover:border-primary/30"
                : i === c.correct
                ? "bg-emerald-50 border-emerald-400 text-emerald-800"
                : i === selected
                ? "bg-red-50 border-red-400 text-red-800"
                : "opacity-50"
            }`}
            disabled={selected !== null}
          >
            {opt}
          </button>
        ))}
      </div>
      {revealed !== null && (
        <div className="bg-muted/30 rounded-lg p-2 text-[10px] sm:text-xs text-muted-foreground">
          {c.explanation}
        </div>
      )}
      {selected !== null && (
        <Button onClick={next} className="w-full h-9 text-sm">
          {round >= pool.length - 1 ? "عرض النتيجة" : "التالي ←"}
        </Button>
      )}
    </div>
  );
}

// ── New Game: Pest Defender ──
const PEST_WAVES = [
  { pest: "🦗", name: "جراد", action: "مبيد حيوي", points: 100 },
  { pest: "🐛", name: "دودة", action: "مصيدة فرمونية", points: 120 },
  { pest: "🦋", name: "فراشة", action: "شبكة واقية", points: 80 },
  { pest: "🐜", name: "نمل", action: "مادة طاردة", points: 90 },
  { pest: "🕷️", name: "عنكبوت", action: "مفترس طبيعي", points: 110 },
  { pest: "🪰", name: "ذبابة", action: "مصيدة ضوئية", points: 70 },
];
function PestDefender({ onScore, level }: { onScore: (s: number) => void; level: number }) {
  const config = GAME_META[8].levels[level]?.config || { waves: 4, speed: 1 };
  const [wave, setWave] = useState(0);
  const [score, setScore] = useState(0);
  const [pests, setPests] = useState<{ id: number; icon: string; name: string; action: string; health: number }[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (done) return;
    const n = Math.min(3 + wave, 5);
    const wavePests = [...PEST_WAVES].sort(() => Math.random() - 0.5).slice(0, n).map((p, i) => ({
      id: i, icon: p.pest, name: p.name, action: p.action, health: 100,
    }));
    setPests(wavePests);
    setSelected(null);
    setProgress(0);
  }, [wave, done]);

  const defend = (action: string) => {
    if (!selected) { setSelected(action); return; }
    const correctAction = pests[progress]?.action;
    const pts = action === correctAction ? 100 : 0;
    const newScore = score + pts;
    setScore(newScore);
    const nextProg = progress + 1;
    setProgress(nextProg);
    setSelected(null);
    if (nextProg >= pests.length) {
      if (wave >= config.waves - 1) { setDone(true); onScore(newScore); }
      else { setTimeout(() => setWave((w) => w + 1), 500); }
    }
  };

  if (done) return <p className="text-center text-sm font-bold text-emerald-600">النتيجة: {score} 🎉</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>موجة {wave + 1}/{config.waves}</span>
        <span className="font-bold">{score}</span>
      </div>
      <div className="bg-gradient-to-b from-amber-50 to-green-50 dark:from-amber-950/20 dark:to-green-950/20 border rounded-xl p-3 min-h-[120px]">
        <div className="flex items-center justify-center gap-3 flex-wrap">
          {pests.map((p, i) => (
            <div key={p.id} className={`text-center p-2 rounded-lg border ${i === progress ? "bg-red-50 dark:bg-red-950/20 border-red-300" : "bg-background"}`}>
              <span className="text-3xl block">{p.icon}</span>
              <span className="text-[10px] font-bold">{p.name}</span>
              <span className="text-[9px] text-muted-foreground block">{p.action}</span>
            </div>
          ))}
        </div>
      </div>
      {progress < pests.length && (
        <div>
          <p className="text-xs font-bold mb-1">اختر الإجراء المناسب لـ {pests[progress]?.name}:</p>
          <div className="grid grid-cols-2 gap-1.5">
            {PEST_WAVES.map((p, i) => (
              <button key={i} onClick={() => defend(p.action)}
                className={`p-2 rounded-lg border text-[10px] transition ${selected === p.action ? "bg-primary/10 border-primary" : "hover:bg-primary/5"}`}
              >
                {p.pest} {p.action}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── New Game: Irrigation Planner ──
const IRRIGATION_CASES = [
  { soil: "رملية", crop: "طماطم", temp: "حار", answer: "التنقيط 3 مرات/أسبوع", options: ["التنقيط 3 مرات/أسبوع", "الغمر يومياً", "الرش مرتين/أسبوع", "ري سطحي يوم"], explanation: "التربة الرملية تصرف بسرعة، التنقيط يحافظ على رطوبة ثابتة" },
  { soil: "طينية", crop: "أرز", temp: "معتدل", answer: "الغمر المستمر", options: ["التنقيط", "الغمر المستمر", "الرش", "ري بالتنقيط تحت سطحي"], explanation: "الأرز يحتاج غمر مستمر والتربة الطينية تحتفظ بالماء" },
  { soil: "طميية", crop: "قمح", temp: "بارد", answer: "الرش مرة/أسبوع", options: ["التنقيط يومياً", "الرش مرة/أسبوع", "الغمر كل أسبوعين", "ري سطحي يوم"], explanation: "القمح في تربة طميية يحتاج رش أسبوعي في الجو البارد" },
  { soil: "رملية", crop: "بطيخ", temp: "حار جداً", answer: "التنقيط يومياً", options: ["التنقيط يومياً", "الغمر كل 3 أيام", "الرش مرتين/أسبوع", "ري بالتنقيط كل أسبوع"], explanation: "البطيخ في الرمل والحر يحتاج رطوبة يومية" },
  { soil: "طينية", crop: "زيتون", temp: "جاف", answer: "التنقيط كل 10 أيام", options: ["التنقيط كل 10 أيام", "الغمر الأسبوعي", "الرش يومياً", "ري سطحي كل شهر"], explanation: "الزيتون يتحمل الجفاف والتربة الطينية تحتفظ بالرطوبة" },
  { soil: "طميية", crop: "خيار", temp: "معتدل", answer: "التنقيط كل يومين", options: ["التنقيط كل يومين", "الغمر الأسبوعي", "الرش 3 مرات/أسبوع", "ري سطحي يوم"], explanation: "الخيار يحتاج رطوبة منتظمة في تربة جيدة التصريف" },
  { soil: "رملية", crop: "فول", temp: "بارد", answer: "التنقيط مرتين/أسبوع", options: ["التنقيط مرتين/أسبوع", "الغمر الأسبوعي", "الرش يومياً", "ري سطحي كل 3 أيام"], explanation: "الفول يحتاج رطوبة معتدلة والتربة الرملية تفقد الماء بسرعة" },
  { soil: "طينية", crop: "موز", temp: "حار رطب", answer: "التنقيط يومياً", options: ["الغمر كل أسبوع", "التنقيط يومياً", "الرش مرتين/أسبوع", "ري سطحي يوم"], explanation: "الموز يحتاج رطوبة عالية يومياً في الجو الحار" },
  { soil: "طميية", crop: "بطاطس", temp: "معتدل", answer: "التنقيط كل 3 أيام", options: ["التنقيط كل 3 أيام", "الغمر الأسبوعي", "الرش يومياً", "ري سطحي كل أسبوع"], explanation: "البطاطس تحتاج رطوبة منتظمة بدون تشبع" },
  { soil: "رملية", crop: "فراولة", temp: "معتدل", answer: "التنقيط يومياً", options: ["التنقيط يومياً", "الغمر كل 3 أيام", "الرش مرتين/أسبوع", "ري سطحي يوم"], explanation: "الفراولة تحتاج رطوبة سطحية ثابتة والرمل يجف سريعاً" },
];
function IrrigationPlanner({ onScore, level }: { onScore: (s: number) => void; level: number }) {
  const total = GAME_META[9].levels[level]?.config.cases || 5;
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const pool = useMemo(() => [...IRRIGATION_CASES].sort(() => Math.random() - 0.5).slice(0, total), [level]);
  const c = pool[round];

  const pick = (opt: string) => {
    if (selected) return;
    setSelected(opt);
    const pts = opt === c.answer ? (level + 1) * 50 : 0;
    const newScore = score + pts;
    setScore(newScore);
    setTimeout(() => {
      setSelected(null);
      if (round >= pool.length - 1) { setDone(true); onScore(newScore); }
      else setRound((r) => r + 1);
    }, 1200);
  };

  if (!c) return null;
  if (done) return <p className="text-center text-sm font-bold text-emerald-600">النتيجة: {score} 🎉</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>حالة {round + 1}/{pool.length}</span>
        <span className="font-bold">{score}</span>
      </div>
      <div className="bg-blue-50 dark:bg-blue-950/20 border rounded-xl p-3 text-center">
        <div className="flex items-center justify-center gap-4 text-sm font-bold mb-2">
          <span>🌾 {c.crop}</span>
          <span>🪨 {c.soil}</span>
          <span>🌡️ {c.temp}</span>
        </div>
        <p className="text-xs text-muted-foreground">اختر أفضل نظام ري لهذه الحالة</p>
      </div>
      <div className="space-y-1.5">
        {c.options.map((opt, i) => (
          <button key={i} onClick={() => pick(opt)}
            className={`w-full text-right p-2.5 rounded-lg border text-xs transition ${
              selected === null ? "hover:bg-primary/5 hover:border-primary/30" :
              opt === c.answer ? "bg-emerald-50 border-emerald-400" :
              opt === selected ? "bg-red-50 border-red-400" : "opacity-50"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
      {selected && <div className="text-[10px] text-muted-foreground bg-muted/30 rounded-lg p-2">{c.explanation}</div>}
    </div>
  );
}

// ── New Game: Fertilizer Mix Lab ──
const FERTILIZER_CASES = [
  { symptoms: "أوراق صفراء مع عروق خضراء", crop: "طماطم", answer: "حديد", options: ["حديد", "نيتروجين", "فوسفور", "بوتاسيوم"], explanation: "اصفرار مع عروق خضراء = نقص حديد (كلوروز)" },
  { symptoms: "أوراق سفلية صفراء مع ضعف نمو", crop: "قمح", answer: "نيتروجين", options: ["نيتروجين", "زئبق", "كالسيوم", "ماغنسيوم"], explanation: "الأوراق السفلية الصفراء = نقص نيتروجين" },
  { symptoms: "أوراق بنفسجية محمرة مع ضعف جذور", crop: "ذرة", answer: "فوسفور", options: ["فوسفور", "نيتروجين", "بوتاسيوم", "كبريت"], explanation: "الأوراق المحمرة مع ضعف جذور = نقص فوسفور" },
  { symptoms: "احتراق أطراف الأوراق السفلية", crop: "فول", answer: "بوتاسيوم", options: ["بوتاسيوم", "كالسيوم", "ماغنسيوم", "حديد"], explanation: "احتراق الأطراف السفلية = نقص بوتاسيوم" },
  { symptoms: "أوراق جديدة ملتوية ومشوهة", crop: "فلفل", answer: "كالسيوم", options: ["كالسيوم", "بورون", "زنك", "نحاس"], explanation: "الأوراق الجديدة الملتفة = نقص كالسيوم" },
  { symptoms: "تبقع بين العروق مع جفاف", crop: "بطاطس", answer: "ماغنسيوم", options: ["ماغنسيوم", "حديد", "زنك", "منجنيز"], explanation: "تبقع بين العروق = نقص ماغنسيوم" },
  { symptoms: "تقزم النبات مع أوراق صغيرة", crop: "ذرة", answer: "زنك", options: ["زنك", "بورون", "نحاس", "مولبيدنيوم"], explanation: "التقزم مع أوراق صغيرة = نقص زنك" },
  { symptoms: "موت القمة النامية", crop: "دوار الشمس", answer: "بورون", options: ["بورون", "كالسيوم", "نحاس", "حديد"], explanation: "موت القمة النامية = نقص بورون" },
  { symptoms: "أوراق رمادية مائلة للزرقة", crop: "بصل", answer: "كبريت", options: ["كبريت", "فوسفور", "نيتروجين", "بوتاسيوم"], explanation: "الأوراق الرمادية المزرقة = نقص كبريت" },
  { symptoms: "أوراق شاحبة مع خطوط صفراء", crop: "شعير", answer: "منجنيز", options: ["منجنيز", "حديد", "زنك", "ماغنسيوم"], explanation: "الخطوط الصفراء بين العروق = نقص منجنيز" },
  { symptoms: "ذبول الأوراق العليا مع تعفن الجذور", crop: "خيار", answer: "نحاس", options: ["نحاس", "بورون", "زنك", "مولبيدنيوم"], explanation: "الذبول العلوي مع تعفن = نقص نحاس" },
  { symptoms: "أوراق داكنة مع تجعد", crop: "فول", answer: "مولبيدنيوم", options: ["مولبيدنيوم", "حديد", "نيتروجين", "فوسفور"], explanation: "الأوراق الداكنة المتجعده = نقص مولبيدنيوم" },
  { symptoms: "تبقع بني على الثمار", crop: "طماطم", answer: "كالسيوم", options: ["كالسيوم", "بورون", "بوتاسيوم", "ماغنسيوم"], explanation: "تبقع الثمار البني = نقص كالسيوم (تعفن طرفي)" },
  { symptoms: "أوراق شاحبة + ضعف في الإزهار", crop: "فلفل", answer: "فوسفور", options: ["فوسفور", "بوتاسيوم", "نيتروجين", "زنك"], explanation: "ضعف الإزهار مع شحوب = نقص فوسفور" },
];
function FertilizerLab({ onScore, level }: { onScore: (s: number) => void; level: number }) {
  const total = GAME_META[10].levels[level]?.config.questions || 10;
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const pool = useMemo(() => [...FERTILIZER_CASES].sort(() => Math.random() - 0.5).slice(0, total), [level]);
  const c = pool[round];

  const pick = (opt: string) => {
    if (selected) return;
    setSelected(opt);
    const pts = opt === c.answer ? 100 : 0;
    const newScore = score + pts;
    setScore(newScore);
    setTimeout(() => {
      setSelected(null);
      if (round >= pool.length - 1) { setDone(true); onScore(newScore); }
      else setRound((r) => r + 1);
    }, 1000);
  };

  if (!c) return null;
  if (done) return <p className="text-center text-sm font-bold text-emerald-600">النتيجة: {score}/{total * 100} 🎉</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>حالة {round + 1}/{pool.length}</span>
        <span className="font-bold">{score}/{total * 100}</span>
      </div>
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border rounded-xl p-3">
        <div className="flex items-center gap-2 mb-1">
          <FlaskConical className="h-4 w-4 text-emerald-600" />
          <span className="text-xs text-muted-foreground">المحصول: {c.crop}</span>
        </div>
        <p className="font-bold text-sm">{c.symptoms}</p>
        <p className="text-[10px] text-muted-foreground mt-1">ما العنصر الناقص؟</p>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {c.options.map((opt, i) => (
          <button key={i} onClick={() => pick(opt)}
            className={`p-2.5 rounded-lg border text-xs transition ${
              selected === null ? "hover:bg-primary/5" :
              opt === c.answer ? "bg-emerald-50 border-emerald-400" :
              opt === selected ? "bg-red-50 border-red-400" : "opacity-50"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
      {selected && <div className="text-[10px] text-muted-foreground bg-muted/30 rounded-lg p-2">{c.explanation}</div>}
    </div>
  );
}

// ── New Game: Greenhouse Manager ──
function GreenhouseManager({ onScore, level }: { onScore: (s: number) => void; level: number }) {
  const days = GAME_META[11].levels[level]?.config.days || 7;
  const [day, setDay] = useState(0);
  const [temp, setTemp] = useState(25);
  const [humidity, setHumidity] = useState(60);
  const [soilMoisture, setSoilMoisture] = useState(50);
  const [score, setScore] = useState(1000);
  const [done, setDone] = useState(false);
  const [events, setEvents] = useState<string[]>([]);

  const nextDay = (t: number, h: number, irr: boolean, fert: boolean) => {
    let newScore = score;
    let newTemp = temp + t;
    let newHumidity = humidity + h;
    let newMoisture = soilMoisture + (irr ? 20 : -15);
    newTemp = Math.max(15, Math.min(40, newTemp));
    newHumidity = Math.max(30, Math.min(100, newHumidity));
    newMoisture = Math.max(0, Math.min(100, newMoisture));
    const idealTemp = newTemp >= 20 && newTemp <= 30;
    const idealHum = newHumidity >= 50 && newHumidity <= 80;
    const idealMoist = newMoisture >= 40 && newMoisture <= 80;
    if (!idealTemp) newScore -= 20;
    if (!idealHum) newScore -= 15;
    if (!idealMoist) newScore -= 15;
    if (irr && fert) newScore += 30;
    else if (fert) newScore += 10;
    const newEvents: string[] = [];
    if (!idealTemp) newEvents.push(idealTemp ? "" : "🌡️ حرارة غير مناسبة");
    if (!idealHum) newEvents.push(idealHum ? "" : "💧 رطوبة غير مناسبة");
    if (Math.random() > 0.7) newEvents.push("🐛 ظهرت آفة!");
    setTemp(newTemp);
    setHumidity(newHumidity);
    setSoilMoisture(newMoisture);
    setScore(newScore);
    setEvents(newEvents);
    if (day >= days - 1) { setDone(true); onScore(Math.max(0, newScore)); }
    else setDay((d) => d + 1);
  };

  if (done) return <p className="text-center text-sm font-bold text-emerald-600">النتيجة: {score} 🎉</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>يوم {day + 1}/{days}</span>
        <span className="font-bold text-amber-600">{score} نقطة</span>
      </div>
      <div className="bg-gradient-to-br from-green-50 to-sky-50 dark:from-green-950/20 dark:to-sky-950/20 border rounded-xl p-3">
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div><span className="font-bold text-lg block">{temp}°</span>حرارة</div>
          <div><span className="font-bold text-lg block">{humidity}%</span>رطوبة</div>
          <div><span className="font-bold text-lg block">{soilMoisture}%</span>رطوبة تربة</div>
        </div>
      </div>
      {events.length > 0 && (
        <div className="space-y-1">
          {events.map((e, i) => e && <div key={i} className="text-[10px] text-amber-700 bg-amber-50 dark:bg-amber-950/20 rounded-lg p-1.5">{e}</div>)}
        </div>
      )}
      <div className="grid grid-cols-2 gap-1.5">
        <button onClick={() => nextDay(-5, 10, false, false)} className="p-2 rounded-lg border text-[10px] hover:bg-primary/5">❄️ خفض حرارة</button>
        <button onClick={() => nextDay(5, -10, false, false)} className="p-2 rounded-lg border text-[10px] hover:bg-primary/5">🔥 رفع حرارة</button>
        <button onClick={() => nextDay(-3, 5, true, false)} className="p-2 rounded-lg border text-[10px] hover:bg-primary/5">💧 ري</button>
        <button onClick={() => nextDay(0, 0, false, true)} className="p-2 rounded-lg border text-[10px] hover:bg-primary/5">🧪 تسميد</button>
        <button onClick={() => nextDay(-5, 10, true, true)} className="p-2 rounded-lg border text-[10px] hover:bg-primary/5 col-span-2 bg-primary/5">✅ ري + تسميد</button>
      </div>
    </div>
  );
}

// ── New Game: Lab Safety Challenge ──
const LAB_STEPS_SETS = [
  { title: "تحليل عينة تربة", steps: ["ارتداء القفازات", "تعقيم الأدوات", "وزن العينة", "إضافة المحلول", "قراءة النتيجة", "تسجيل البيانات"] },
  { title: "فحص pH", steps: ["أخذ عينة", "إضافة الماء المقطر", "تحريك العينة", "وضع ورق pH", "مقارنة اللون", "تسجيل القيمة"] },
  { title: "تشخيص مرض نباتي", steps: ["فحص الأعراض الظاهرية", "أخذ عينة من النسيج المصاب", "زرع العينة في الوسط", "تحضين 48 ساعة", "فحص المستعمرة", "تأكيد التشخيص"] },
  { title: "تحليل النيتروجين", steps: ["تحضير العينة", "إضافة العامل المحفز", "تسخين حتى الغليان", "التقطير", "المعايرة", "حساب النتيجة"] },
];
function LabSafety({ onScore, level }: { onScore: (s: number) => void; level: number }) {
  const stepCount = GAME_META[12].levels[level]?.config.steps || 5;
  const [setIdx, setSetIdx] = useState(0);
  const [ordered, setOrdered] = useState<string[]>([]);
  const [remaining, setRemaining] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const set = LAB_STEPS_SETS[setIdx % LAB_STEPS_SETS.length];

  useEffect(() => {
    const shuffled = [...set.steps].sort(() => Math.random() - 0.5);
    setRemaining(shuffled);
    setOrdered([]);
  }, [setIdx]);

  const pickStep = (step: string) => {
    const newOrdered = [...ordered, step];
    setOrdered(newOrdered);
    setRemaining(remaining.filter((s) => s !== step));
    if (newOrdered.length >= stepCount) {
      let pts = 0;
      for (let i = 0; i < stepCount; i++) {
        if (newOrdered[i] === set.steps[i]) pts += 100;
      }
      const newScore = score + pts;
      setScore(newScore);
      setTimeout(() => {
        if (setIdx >= 2) { setDone(true); onScore(newScore); }
        else setSetIdx((s) => s + 1);
      }, 1000);
    }
  };

  if (done) return <p className="text-center text-sm font-bold text-emerald-600">النتيجة: {score} 🎉</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{set.title}</span>
        <span className="font-bold">{score}</span>
      </div>
      <div className="bg-card border rounded-xl p-3 min-h-[80px]">
        <p className="text-[10px] text-muted-foreground mb-1">الترتيب الصحيح:</p>
        <div className="flex flex-wrap gap-1">
          {ordered.map((s, i) => (
            <span key={i} className="text-[10px] bg-primary/10 rounded px-1.5 py-0.5">{s}</span>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">الخطوة التالية: {set.steps[ordered.length]}</p>
      </div>
      <div className="space-y-1">
        {remaining.slice(0, Math.min(stepCount, remaining.length)).map((step) => (
          <button key={step} onClick={() => pickStep(step)}
            className="w-full text-right p-2 rounded-lg border text-[10px] hover:bg-primary/5 transition"
          >
            {step}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── New Game: Seed to Harvest Journey ──
const STAGES = [
  { name: "اختيار البذرة", desc: "اختر أفضل بذرة للموسم", choices: ["بذرة هجين مقاومة", "بذرة محلية", "بذرة مستوردة"], correct: 0, explanation: "البذور الهجين المقاومة تعطي إنتاجية أعلى ومقاومة للأمراض" },
  { name: "تحضير التربة", desc: "كيف تحضّر التربة؟", choices: ["حرث عميق + تسميد عضوي", "ري فقط", "حرث سطحي", "إضافة مبيدات"], correct: 0, explanation: "الحرث العميق مع السماد العضوي يحسن بنية التربة" },
  { name: "الزراعة", desc: "أفضل طريقة للزراعة؟", choices: ["زراعة في سطور منتظمة", "نثر عشوائي", "زراعة عميقة جداً", "زراعة سطحية"], correct: 0, explanation: "السطور المنتظمة تسهل إدارة المحصول" },
  { name: "الري", desc: "اختر نظام الري المناسب", choices: ["ري بالتنقيط", "ري بالغمر", "ري بالرش", "ري سطحي"], correct: 0, explanation: "التنقيط الأكثر كفاءة ويوفر 70% ماء" },
  { name: "التسميد", desc: "ما نوع السماد المناسب؟", choices: ["سماد متوازن NPK", "نيتروجين فقط", "فوسفور فقط", "سماد بلدي"], correct: 0, explanation: "السماد المتوازن يعطي جميع العناصر المطلوبة" },
  { name: "مكافحة الآفات", desc: "أفضل استراتيجية؟", choices: ["إدارة متكاملة IPM", "مبيدات كيميائية فقط", "إزالة يدوية", "مبيدات حيوية فقط"], correct: 0, explanation: "الإدارة المتكاملة تجمع بين كل الطرق بأقل ضرر" },
  { name: "الحصاد", desc: "ما علامة نضج المحصول؟", choices: ["اصفرار 70% من النبات", "لون أخضر", "سقوط الأوراق", "جفاف كامل"], correct: 0, explanation: "اصفرار 70% دليل نضج مثالي للحصاد" },
  { name: "ما بعد الحصاد", desc: "أفضل طريقة للتخزين؟", choices: ["تبريد + تهوية", "تخزين في الشمس", "تعبئة بدون تهوية", "تجميد فوري"], correct: 0, explanation: "التبريد والتهوية يطيلان عمر التخزين" },
  { name: "تسويق", desc: "أفضل استراتيجية تسويق؟", choices: ["تجميع Productor", "بيع فردي", "تخزين طويل", "تصدير خام"], correct: 0, explanation: "التجميع يزيد القيمة السوقية" },
];
function SeedToHarvest({ onScore, level }: { onScore: (s: number) => void; level: number }) {
  const stageCount = GAME_META[13].levels[level]?.config.stages || 5;
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const pool = STAGES.slice(0, stageCount);

  const pick = (i: number) => {
    if (selected !== null) return;
    setSelected(i);
    const pts = i === pool[round].correct ? 200 : 0;
    const newScore = score + pts;
    setTimeout(() => {
      setScore(newScore);
      setSelected(null);
      if (round >= pool.length - 1) { setDone(true); onScore(newScore); }
      else setRound((r) => r + 1);
    }, 1000);
  };

  const stage = pool[round];
  if (!stage) return null;
  if (done) return <p className="text-center text-sm font-bold text-emerald-600">النتيجة: {score}/{pool.length * 200} 🎉</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>مرحلة {round + 1}/{pool.length}: {stage.name}</span>
        <span className="font-bold">{score}/{pool.length * 200}</span>
      </div>
      <div className="flex items-center gap-1 mb-1">
        {pool.map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full ${i < round ? "bg-emerald-500" : i === round ? "bg-primary" : "bg-muted"}`} />
        ))}
      </div>
      <div className="bg-gradient-to-br from-amber-50 to-green-50 dark:from-amber-950/20 dark:to-green-950/20 border rounded-xl p-3">
        <p className="font-bold text-sm">{stage.desc}</p>
      </div>
      <div className="space-y-1.5">
        {stage.choices.map((choice, i) => (
          <button key={i} onClick={() => pick(i)}
            className={`w-full text-right p-2.5 rounded-lg border text-xs transition ${
              selected === null ? "hover:bg-primary/5 hover:border-primary/30" :
              i === stage.correct ? "bg-emerald-50 border-emerald-400" :
              i === selected ? "bg-red-50 border-red-400" : "opacity-50"
            }`}
          >
            {choice}
          </button>
        ))}
      </div>
      {selected !== null && (
        <div className="text-[10px] text-muted-foreground bg-muted/30 rounded-lg p-2">{stage.explanation}</div>
      )}
    </div>
  );
}

// ── New Game: Exam Blitz ──
const BLITZ_QUESTIONS = [
  { q: "ما العنصر الأهم للنمو الخضري؟", options: ["نيتروجين", "فوسفور", "بوتاسيوم", "كالسيوم"], answer: 0 },
  { q: "ما نطاق pH المناسب للتربة؟", options: ["6-7.5", "4-5", "8-9", "3-4"], answer: 0 },
  { q: "أي محصول يتحمل الملوحة؟", options: ["شعير", "أرز", "موز", "فراولة"], answer: 0 },
  { q: "ما أفضل نظام ري توفيراً؟", options: ["تنقيط", "رش", "غمر", "سطحي"], answer: 0 },
  { q: "أي مرض يسببه فطر؟", options: ["بياض دقيقي", "لفحة بكتيرية", "تورد قمة", "موزاييك"], answer: 0 },
  { q: "ما وظيفة الجذور؟", options: ["امتصاص ماء", "بناء ضوئي", "تكاثر", "نقل عصارة"], answer: 0 },
  { q: "أي تربة تحتفظ بالماء؟", options: ["طينية", "رملية", "حصوية", "صخرية"], answer: 0 },
  { q: "أفضل وقت للري صيفاً؟", options: ["صباح باكر", "ظهر", "عصر", "ليل"], answer: 0 },
  { q: "أي محصول مصدر بروتين؟", options: ["فول", "أرز", "قمح", "ذرة"], answer: 0 },
  { q: "نقص الحديد يسبب؟", options: ["اصفرار عروق خضراء", "احتراق أطراف", "موت قمة", "تقزم"], answer: 0 },
  { q: "أي آفة تصيب القطن؟", options: ["دودة ورق", "حفار ساق", "من", "ذبابة"], answer: 0 },
  { q: "ما العنصر لتكوين الكلوروفيل؟", options: ["ماغنسيوم", "حديد", "زنك", "نحاس"], answer: 0 },
  { q: "أي محصول زيتي؟", options: ["فول صويا", "قمح", "أرز", "شعير"], answer: 0 },
  { q: "ما هرمون النضج؟", options: ["إيثيلين", "أوكسين", "جبرلين", "سيتوكينين"], answer: 0 },
  { q: "أي نبات يثبت نيتروجين؟", options: ["بقوليات", "نجيليات", "صبار", "مائية"], answer: 0 },
  { q: "تأثير الملوحة على النبات؟", options: ["تقليل امتصاص", "زيادة نمو", "تحسين إزهار", "تكبير ثمار"], answer: 0 },
  { q: "نظام زراعة بلا تربة؟", options: ["مائية", "حقلية", "جافة", "مطرية"], answer: 0 },
  { q: "أي محصول يزرع شتلاً؟", options: ["طماطم", "قمح", "شعير", "عدس"], answer: 0 },
  { q: "ما يسبب اللفحة المبكرة؟", options: ["Alternaria", "بكتيريا", "فيروس", "نيماتودا"], answer: 0 },
  { q: "أفضل تخزين حبوب؟", options: ["أقل من 15°م", "25°م", "35°م", "فوق 40°م"], answer: 0 },
  { q: "وظيفة الفوسفور؟", options: ["تطوير جذور", "نمو خضري", "نضج ثمار", "تكوين بذور"], answer: 0 },
  { q: "أكثر محصول استهلاك ماء؟", options: ["أرز", "قمح", "ذرة", "شعير"], answer: 0 },
  { q: "نقص البوتاسيوم يسبب؟", options: ["احتراق أطراف", "اصفرار عروق", "تقزم", "موت قمة"], answer: 0 },
  { q: "مبيد صديق للبيئة؟", options: ["مبيد حيوي", "كلوري", "فوسفوري", "كاربامات"], answer: 0 },
  { q: "أسرع محصول نضجاً؟", options: ["فجل", "طماطم", "بطاطس", "جزر"], answer: 0 },
  { q: "ما يؤثر بإنبات البذور؟", options: ["درجة حرارة", "إضاءة", "رياح", "رطوبة جوية"], answer: 0 },
  { q: "سماد بطيء التحلل؟", options: ["عضوي", "يوريا", "نترات أمونيوم", "سوبر فوسفات"], answer: 0 },
  { q: "مرض صدأ القمح؟", options: ["صدأ أصفر", "بياض دقيقي", "لفحة", "تبقع"], answer: 0 },
  { q: "محصول يحتاج تقليم؟", options: ["طماطم", "قمح", "أرز", "شعير"], answer: 0 },
  { q: "أي يسبب النيماتودا؟", options: ["تقرحات جذور", "صدأ", "ذبول", "تبقع"], answer: 0 },
];
function ExamBlitz({ onScore, level }: { onScore: (s: number) => void; level: number }) {
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const pool = useMemo(() => [...BLITZ_QUESTIONS].sort(() => Math.random() - 0.5).slice(0, 15), [level]);
  const q = pool[round];

  useEffect(() => {
    if (done) return;
    const iv = setInterval(() => setTimeLeft((t) => { if (t <= 1) { clearInterval(iv); setDone(true); onScore(score); return 0; } return t - 1; }), 1000);
    return () => clearInterval(iv);
  }, [done, score]);

  const answer = (i: number) => {
    if (done || !q) return;
    const combo = Math.max(1, Math.floor((pool.length - round) / 3));
    const pts = i === q.answer ? (100 + (combo - 1) * 20) : 0;
    const newScore = score + pts;
    setScore(newScore);
    if (round >= pool.length - 1) { setDone(true); onScore(newScore); }
    else setRound((r) => r + 1);
  };

  if (done) return <p className="text-center text-sm font-bold text-emerald-600">النتيجة: {score} 🎉</p>;
  if (!q) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold text-red-500">{timeLeft}s</span>
        <span className="font-bold">{score}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${(timeLeft / 60) * 100}%`, background: timeLeft < 10 ? "#ef4444" : "#22c55e" }} />
      </div>
      <p className="font-bold text-sm">{q.q}</p>
      <div className="space-y-1.5">
        {q.options.map((opt, i) => (
          <button key={i} onClick={() => answer(i)}
            className="w-full text-right p-2.5 rounded-lg border text-xs hover:bg-primary/5 hover:border-primary/30 transition"
          >
            {opt}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-center text-muted-foreground">سؤال {round + 1}/{pool.length} — combo ×{Math.max(1, Math.floor((pool.length - round) / 3))}</p>
    </div>
  );
}

// ── Game component resolver ──
const GAME_COMPS: Record<string, React.ComponentType<{ onScore: (s: number) => void; level: number }>> = {
  soil_match: MemoryMatch, plant_quiz: PlantQuiz, harvest_run: HarvestRun, plant_id: PlantIdGame, soil_ph: SoilPhGame,
  crop_match: CropMatch, disease_detect: DiseaseDetective, case_battle: CaseBattle,
  pest_defender: PestDefender, irrigation_planner: IrrigationPlanner, fertilizer_lab: FertilizerLab,
  greenhouse_manager: GreenhouseManager, lab_safety: LabSafety, seed_to_harvest: SeedToHarvest, exam_blitz: ExamBlitz,
};

// ── Daily challenge rotation ──
const DAY_KEYS = ["soil_match", "plant_quiz", "harvest_run", "plant_id", "soil_ph", "crop_match", "disease_detect", "case_battle", "pest_defender", "irrigation_planner", "fertilizer_lab", "greenhouse_manager", "lab_safety", "seed_to_harvest", "exam_blitz"];

// ── Main Games page (old-system style: live tabs + side leaderboard) ──
export default function Games() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const t = useTranslation(globalI18n);
  const [, setLocation] = useLocation();
  const [gameKey, setGameKey] = useState(GAME_META[0].key);
  const [levelByGame, setLevelByGame] = useState<Record<string, number>>({});
  const [gameStartTime, setGameStartTime] = useState<number | null>(null);
  const { data: lb } = useGameLeaderboard(gameKey);
  const { data: gameStats } = useGameStats();
  const { data: streak } = useStreak();
  const { data: user } = useMeV2();
  const { data: challenges = [] } = useChallenges();
  const claimReward = useClaimDailyReward();

  const todayKey = DAY_KEYS[new Date().getDay() % 5];
  const dailyChallenge = challenges[0];
  const perGame = gameStats?.byGame?.[gameKey];
  const bestScore = perGame?.best ?? 0;
  const bestStars = bestScore > 0 ? starsForScore(bestScore, GAME_META.find((g) => g.key === gameKey)?.levels[0]?.maxScore || 1000) : 0;

  const currentMeta = GAME_META.find((g) => g.key === gameKey)!;
  const currentLevel = Math.min(levelByGame[gameKey] ?? 0, currentMeta.levels.length - 1);
  const maxScore = currentMeta.levels[currentLevel]?.maxScore || 1000;
  const GameComp = GAME_COMPS[gameKey];

  const changeLevel = (li: number) => { setLevelByGame((m) => ({ ...m, [gameKey]: li })); setGameStartTime(Date.now()); };
  const switchGame = (key: string) => {
    setGameKey(key);
    setGameStartTime(Date.now());
  };

  const submitScore = async (score: number) => {
    const stars = starsForScore(score, maxScore);
    const durationMs = gameStartTime ? Date.now() - gameStartTime : 0;
    try {
      await api.post("/v2/games/score", { gameKey, score, durationMs });
      toast({ title: `+${Math.floor(score / 10)} XP`, description: `${stars} نجوم من ${currentMeta.labelAr}` });
      qc.invalidateQueries({ queryKey: ["v2", "games", "leaderboard"] });
      qc.invalidateQueries({ queryKey: ["v2", "me"] });
      qc.invalidateQueries({ queryKey: ["v2", "achievements"] });
      qc.invalidateQueries({ queryKey: ["v2", "games", "stats"] });
    } catch (e) {
      toast({ title: t("error"), description: (e as Error).message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-6xl">
        {/* HERO — daily challenge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-amber-500/10 via-primary/5 to-background border rounded-xl sm:rounded-2xl p-3 sm:p-5 mb-4"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground mb-1">
                <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                <span>تحدي اليوم</span>
                <button onClick={() => setLocation("/games/profile")} className="mr-auto flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors shrink-0">
                  <Medal className="h-3 w-3" /> ملفي
                </button>
                <button onClick={() => setLocation("/missions")} className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors shrink-0">
                  <Target className="h-3 w-3" /> مهام
                </button>
              </div>
              {dailyChallenge ? (
                <>
                  <h2 className="font-bold text-base sm:text-xl break-words">
                    احصل على {dailyChallenge.targetScore} نقطة في {GAME_META.find((g) => g.key === dailyChallenge.gameKey)?.labelAr || dailyChallenge.gameKey}
                  </h2>
                  <p className="text-xs text-muted-foreground">المكافأة: +{dailyChallenge.xpReward} XP</p>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="h-2 flex-1 bg-muted rounded-full overflow-hidden max-w-[200px]">
                      <div className="h-full bg-gradient-to-r from-amber-500 to-primary rounded-full" style={{ width: `${Math.min((dailyChallenge.progress / dailyChallenge.targetScore) * 100, 100)}%` }} />
                    </div>
                    <span className="text-[10px] font-bold">{dailyChallenge.progress}/{dailyChallenge.targetScore}</span>
                    {dailyChallenge.completed && <Badge className="text-[9px] bg-emerald-500">مكتمل ✓</Badge>}
                  </div>
                </>
              ) : (
                <>
                  <h2 className="font-bold text-base sm:text-xl">ساحة الألعاب</h2>
                  <p className="text-xs text-muted-foreground">اختَر لعبة من التبويبات ولعب مباشرة — النقاط تُضاف لرصيدك</p>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" variant="outline" onClick={async () => {
                try {
                  const res: any = await claimReward.mutateAsync();
                  toast({ title: res.message, description: `+${res.xp} XP` });
                } catch (e: any) {
                  toast({ title: "المكافأة اليومية", description: e.message, variant: "default" });
                }
              }} className="gap-1">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-[10px]">مكافأة</span>
              </Button>
            </div>
          </div>
        </motion.div>

        {/* GAME TABS (select a game — plays instantly) */}
        <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1" dir="rtl">
          {GAME_META.map((meta) => (
            <button
              key={meta.key}
              onClick={() => switchGame(meta.key)}
              className={`flex flex-col items-center gap-1 px-3.5 py-2 rounded-xl whitespace-nowrap transition border text-xs font-medium ${
                gameKey === meta.key
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card border-border text-muted-foreground hover:bg-muted/60"
              }`}
            >
              <meta.icon className="h-4 w-4" />
              {meta.labelAr}
            </button>
          ))}
        </div>

        {/* MAIN CONTENT: game + leaderboard */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="lg:col-span-2 bg-card border rounded-xl sm:rounded-2xl p-4 sm:p-6">
            <div className="flex items-center justify-between gap-2 mb-1">
              <h2 className="font-bold text-sm sm:text-base">{currentMeta.labelAr}</h2>
              <span className="text-[10px] text-muted-foreground">{currentMeta.skillTag} · {currentMeta.duration}</span>
            </div>
            <p className="text-[11px] text-muted-foreground mb-3">{currentMeta.desc}</p>

            {/* Level selector */}
            {currentMeta.levels.length > 1 && (
              <div className="flex items-center gap-1.5 mb-4 flex-wrap">
                <span className="text-[10px] text-muted-foreground">المستوى:</span>
                {currentMeta.levels.map((lvl, li) => (
                  <button
                    key={li}
                    onClick={() => changeLevel(li)}
                    className={`text-[10px] px-3 py-1.5 rounded-full border transition font-medium ${
                      currentLevel === li
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/30 text-muted-foreground hover:bg-muted/60"
                    }`}
                  >
                    {lvl.name}
                  </button>
                ))}
              </div>
            )}

            <GameComp key={`${gameKey}-${currentLevel}`} onScore={submitScore} level={currentLevel} />
          </div>

          <div className="bg-card border rounded-xl sm:rounded-2xl p-4 h-fit">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm flex items-center gap-2"><Medal className="h-4 w-4 text-amber-500" />أفضل النتائج</h3>
              {bestStars > 0 && <div className="flex gap-0.5">{starDisplay(bestStars)}</div>}
            </div>
            <div className="space-y-2">
              {(lb ?? []).slice(0, 10).map((r, i) => (
                <motion.div key={r.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-2 p-1.5 rounded-lg">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${i === 0 ? "bg-amber-200 text-amber-900" : i < 3 ? "bg-primary/15 text-primary" : "bg-muted"}`}>{i + 1}</div>
                  {r.userAvatar ? <img src={r.userAvatar} className="w-6 h-6 rounded-full object-cover" /> : <div className="w-6 h-6 rounded-full bg-primary/10 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-bold truncate">{r.userName}</div>
                  </div>
                  <div className="text-xs font-bold tabular-nums">{r.score}</div>
                </motion.div>
              ))}
              {(!lb || !lb.length) && (
                <div className="text-xs text-muted-foreground text-center py-6">
                  <div className="text-3xl mb-2">🏆</div>
                  لم تُسجل نتائج بعد — كن أول من يلعب!
                </div>
              )}
            </div>

            {/* Quick stats */}
            <div className="mt-4 pt-3 border-t space-y-2">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><Gamepad2 className="h-3 w-3" /> مرات لعبك</span>
                <span className="font-bold">{perGame?.count ?? 0}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> أفضل نتيجة</span>
                <span className="font-bold">{bestScore ?? 0}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><Flame className="h-3 w-3" /> تتابعك</span>
                <span className="font-bold">{streak?.currentStreak ?? 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
