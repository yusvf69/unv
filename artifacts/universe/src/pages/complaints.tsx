import { useState } from "react";
import { useListComplaints, useCreateComplaint, getListComplaintsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle, Clock, CheckCircle2, MessageSquare, Plus, X,
  Send, Phone, Mail, Globe, ChevronDown, ChevronUp, Bot,
  Users, MessageCircle, HelpCircle, Lightbulb, Flag,
  ArrowLeft, CheckCircle, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatISODate } from "@/lib/dates";
import { useMeV2, api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useTranslation, globalI18n } from "@/lib/i18n";

const CONTACT_TYPES = [
  { value: "complaint", icon: AlertCircle, color: "from-rose-500 to-rose-600" },
  { value: "suggestion", icon: Lightbulb, color: "from-amber-500 to-orange-500" },
  { value: "inquiry", icon: HelpCircle, color: "from-sky-500 to-blue-500" },
  { value: "report", icon: Flag, color: "from-red-500 to-rose-500" },
  { value: "other", icon: MessageSquare, color: "from-slate-500 to-slate-600" },
];

const CONTACT_TYPE_KEYS: Record<string, string> = {
  complaint: "contactTypeComplaint",
  suggestion: "contactTypeSuggestion",
  inquiry: "contactTypeInquiry",
  report: "contactTypeReport",
  other: "contactTypeOther",
};

const QUICK_CONTACTS = [
  {
    title: "بوت المساعدة",
    subtitle: "Telegram Bot",
    description: "للإجابة السريعة على استفساراتك",
    href: "https://t.me/UniVerseServiceBot",
    icon: Bot,
    gradient: "from-sky-500 to-blue-600",
    shadow: "shadow-sky-500/30",
  },
  {
    title: "جروب التليجرام",
    subtitle: "Telegram Group",
    description: "انضم للمجتمع وناقش زملاءك",
    href: "https://t.me/+RhGPnkEVjAVjMWI8",
    icon: MessageCircle,
    gradient: "from-blue-500 to-indigo-600",
    shadow: "shadow-blue-500/30",
  },
  {
    title: "جروب الواتساب",
    subtitle: "WhatsApp Group",
    description: "للتواصل السريع والمباشر",
    href: "https://chat.whatsapp.com/Ineu3J6B3XD2TJmI5MgpNz",
    icon: MessageCircle,
    gradient: "from-emerald-500 to-green-600",
    shadow: "shadow-emerald-500/30",
  },
  {
    title: "البريد الإلكتروني",
    subtitle: "Email Support",
    description: "راسلنا عبر البريد",
    href: "mailto:support@universe.edu",
    icon: Mail,
    gradient: "from-purple-500 to-violet-600",
    shadow: "shadow-purple-500/30",
  },
];

const STATUS_CONFIG = {
  open: { icon: AlertCircle, label: "مفتوحة", variant: "destructive" as const },
  in_review: { icon: Clock, label: "قيد المراجعة", variant: "secondary" as const },
  resolved: { icon: CheckCircle, label: "تم الحل", variant: "default" as const },
  closed: { icon: X, label: "مغلقة", variant: "outline" as const },
};

export default function Complaints() {
  const { data: me } = useMeV2();
  const { data: complaints, isLoading } = useListComplaints();
  const createComplaint = useCreateComplaint();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const t = useTranslation(globalI18n);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPastTickets, setShowPastTickets] = useState(false);

  const form = useForm({
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      type: "complaint",
      subject: "",
      message: "",
    },
  });

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    try {
      await api.post("/v2/contact", {
        name: data.name || undefined,
        email: data.email || undefined,
        phone: data.phone || undefined,
        type: data.type,
        subject: data.subject,
        message: data.message,
      });
      toast({
        title: t("contactSuccessTitle"),
        description: t("contactSuccessDesc"),
      });
      form.reset();
      setIsFormOpen(false);
      queryClient.invalidateQueries({ queryKey: getListComplaintsQueryKey() });
    } catch (e) {
      toast({
        title: t("contactErrorTitle"),
        description: (e as Error).message || t("contactErrorDesc"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-6xl">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-primary via-primary/90 to-secondary p-6 sm:p-10 md:p-14 text-primary-foreground mb-6 sm:mb-10"
      >
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -end-20 opacity-10">
            <MessageSquare className="h-48 w-48 sm:h-64 sm:w-64" />
          </div>
        </div>
        <div className="relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/15 rounded-full text-xs sm:text-sm font-medium backdrop-blur-sm mb-4"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            <span>{t("contactHeroBadge")}</span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold mb-3"
          >
            {t("contactHeroTitle")}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-sm sm:text-lg opacity-90 max-w-2xl leading-relaxed"
          >
            {t("contactHeroDesc")}
          </motion.p>
        </div>
      </motion.div>

      {/* Quick Contact Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8 sm:mb-10">
        {QUICK_CONTACTS.map((item, i) => (
          <motion.a
            key={item.title}
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.08 }}
            whileHover={{ y: -4, scale: 1.02 }}
            className="group relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br p-4 sm:p-5 text-white shadow-lg hover:shadow-xl transition-all cursor-pointer"
            style={{ backgroundImage: `linear-gradient(135deg, var(--tw-gradient-stops))`, background: undefined }}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-100`} />
            <div className="relative">
              <item.icon className="h-6 w-6 sm:h-7 sm:w-7 mb-2 sm:mb-3 opacity-90" />
              <h3 className="font-bold text-sm sm:text-base">{item.title}</h3>
              <p className="text-[10px] sm:text-xs opacity-80 mt-0.5">{item.subtitle}</p>
              <p className="text-[10px] sm:text-xs opacity-70 mt-1 sm:mt-2 line-clamp-2">{item.description}</p>
            </div>
          </motion.a>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
        {/* Contact Form */}
        <div className="lg:col-span-3">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className={`border-2 transition-all duration-300 ${isFormOpen ? "border-primary/30 shadow-lg shadow-primary/10" : "border-border"}`}>
              <CardHeader className="pb-3 sm:pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                      <MessageSquare className="h-5 w-5 text-primary" />
                      {isFormOpen ? t("contactFormNewMessage") : t("contactHeroTitle")}
                    </CardTitle>
                    {!isFormOpen && (
                      <CardDescription className="mt-1">
                        {t("contactFormDesc")}
                      </CardDescription>
                    )}
                  </div>
                  {!isFormOpen && (
                    <Button onClick={() => setIsFormOpen(true)} className="gap-2 shrink-0">
                      <Plus className="h-4 w-4" /> {t("contactFormNewMessage")}
                    </Button>
                  )}
                  {isFormOpen && (
                    <Button variant="ghost" size="icon" onClick={() => setIsFormOpen(false)} className="shrink-0">
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>

              <AnimatePresence>
                {isFormOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <CardContent>
                      <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                            <FormField
                              control={form.control}
                              name="name"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs sm:text-sm">{t("contactFormName")}</FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder={me?.name || t("contactFormNamePlaceholder")}
                                      className="h-9 sm:h-10 text-sm"
                                      {...field}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="type"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs sm:text-sm">{t("contactFormType")}</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                      <SelectTrigger className="h-9 sm:h-10 text-sm">
                                        <SelectValue />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {CONTACT_TYPES.map((type) => (
                                        <SelectItem key={type.value} value={type.value}>
                                          <div className="flex items-center gap-2">
                                            <type.icon className="h-3.5 w-3.5" />
                                            <span>{t(CONTACT_TYPE_KEYS[type.value])}</span>
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                            <FormField
                              control={form.control}
                              name="email"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs sm:text-sm">{t("contactFormEmail")}</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="email"
                                      placeholder={me?.email || "email@example.com"}
                                      className="h-9 sm:h-10 text-sm"
                                      {...field}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="phone"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs sm:text-sm">{t("contactFormPhone")}</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="tel"
                                      placeholder="+20XXXXXXXXX"
                                      className="h-9 sm:h-10 text-sm"
                                      {...field}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>

                          <FormField
                            control={form.control}
                            name="subject"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs sm:text-sm">{t("contactFormSubject")}</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder={t("contactFormSubjectPlaceholder")}
                                    className="h-9 sm:h-10 text-sm"
                                    {...field}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="message"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs sm:text-sm">{t("contactFormMessage")}</FormLabel>
                                <FormControl>
                                  <Textarea
                                    placeholder={t("contactFormMessagePlaceholder")}
                                    className="min-h-[140px] sm:min-h-[180px] text-sm"
                                    {...field}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />

                          <div className="flex items-center justify-between pt-2">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Mail className="h-3.5 w-3.5" />
                              <span>{t("contactFormEmailConfirm")}</span>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setIsFormOpen(false)}
                                className="text-xs sm:text-sm"
                              >
                                {t("cancel")}
                              </Button>
                              <Button
                                type="submit"
                                size="sm"
                                disabled={isSubmitting}
                                className="text-xs sm:text-sm"
                              >
                                {isSubmitting ? (
                                  <><Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" /> {t("contactFormSending")}</>
                                ) : (
                                  <><Send className="me-1.5 h-3.5 w-3.5" /> {t("submit")}</>
                                )}
                              </Button>
                            </div>
                          </div>
                        </form>
                      </Form>
                    </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>

              {!isFormOpen && (
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {CONTACT_TYPES.map((type, i) => {
                      const Icon = type.icon;
                      return (
                        <motion.button
                          key={type.value}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}
                          whileHover={{ scale: 1.02 }}
                          onClick={() => {
                            form.setValue("type", type.value);
                            setIsFormOpen(true);
                          }}
                          className="flex flex-col items-center gap-2 p-3 sm:p-4 rounded-xl bg-muted/50 hover:bg-muted border border-border hover:border-primary/30 transition-all text-center group"
                        >
                          <div className={`p-2 sm:p-2.5 rounded-lg bg-gradient-to-br ${type.color} text-white shadow-md`}>
                            <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                          </div>
                          <span className="text-xs sm:text-sm font-bold group-hover:text-primary transition-colors">
                            {t(CONTACT_TYPE_KEYS[type.value])}
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>
                </CardContent>
              )}
            </Card>
          </motion.div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-2 space-y-3 sm:space-y-4">
          {/* Info Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <Card>
              <CardHeader className="pb-2 sm:pb-3">
                <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-primary" />
                  {t("contactInfoTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs sm:text-sm">
                <div className="flex items-center gap-3 p-2.5 sm:p-3 bg-muted/50 rounded-lg">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Mail className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="font-bold">{t("contactFormEmail")}</div>
                    <div className="text-muted-foreground text-[11px] sm:text-xs">support@universe.edu</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-2.5 sm:p-3 bg-muted/50 rounded-lg">
                  <div className="p-2 rounded-lg bg-secondary/10">
                    <Clock className="h-4 w-4 text-secondary" />
                  </div>
                  <div>
                    <div className="font-bold">{t("contactInfoWorkingHours")}</div>
                    <div className="text-muted-foreground text-[11px] sm:text-xs">{t("contactInfoWorkingHoursValue")}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-2.5 sm:p-3 bg-muted/50 rounded-lg">
                  <div className="p-2 rounded-lg bg-accent/10">
                    <Clock className="h-4 w-4 text-accent" />
                  </div>
                  <div>
                    <div className="font-bold">{t("contactInfoResponseTime")}</div>
                    <div className="text-muted-foreground text-[11px] sm:text-xs">{t("contactInfoResponseTimeValue")}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Previous Tickets Toggle */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card>
              <CardHeader className="pb-2 sm:pb-3">
                <button
                  onClick={() => setShowPastTickets(!showPastTickets)}
                  className="w-full flex items-center justify-between"
                >
                  <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    {t("pastTickets")}
                    {complaints && complaints.length > 0 && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {complaints.length}
                      </Badge>
                    )}
                  </CardTitle>
                  {showPastTickets ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </CardHeader>
              <AnimatePresence>
                {showPastTickets && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <CardContent className="pt-0">
                      {isLoading ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : !complaints?.length ? (
                        <div className="text-center py-6">
                          <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                          <p className="text-xs text-muted-foreground">{t("noPastTickets")}</p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[400px] overflow-y-auto pe-1">
                          {complaints.map((ticket, i) => {
                            const status = STATUS_CONFIG[ticket.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.open;
                            const StatusIcon = status.icon;
                            return (
                              <motion.div
                                key={ticket.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.03 }}
                                className="p-2.5 sm:p-3 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors cursor-default"
                              >
                                <div className="flex items-start justify-between gap-2 mb-1.5">
                                  <h4 className="font-bold text-xs sm:text-sm line-clamp-1 flex-1">
                                    {ticket.subject.replace(/^\[(.*?)\] /, "")}
                                  </h4>
                                  <Badge variant={status.variant} className="text-[9px] px-1.5 py-0 shrink-0">
                                    <StatusIcon className="h-2.5 w-2.5 me-1" />
                                    {status.label}
                                  </Badge>
                                </div>
                                <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-2 mb-1">
                                  {ticket.body}
                                </p>
                                <div className="text-[9px] text-muted-foreground/70">
                                  {formatISODate(ticket.createdAt)}
                                </div>
                                {ticket.response && (
                                  <div className="mt-1.5 p-2 bg-primary/5 rounded-lg border border-primary/10">
                                    <p className="text-[10px] font-bold text-primary mb-0.5">{t("ticketResponse")}</p>
                                    <p className="text-[10px] text-muted-foreground">{ticket.response}</p>
                                  </div>
                                )}
                              </motion.div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </motion.div>

          {/* Quick Links */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
          >
            <Card>
              <CardHeader className="pb-2 sm:pb-3">
                <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                  <Globe className="h-4 w-4 text-primary" />
                  {t("quickLinks")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  { href: "/faq", label: t("faq"), icon: HelpCircle },
                  { href: "/guide", label: t("platformGuide"), icon: MessageSquare },
                  { href: "/report", label: t("reportProblem"), icon: Flag },
                ].map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors text-xs sm:text-sm text-muted-foreground hover:text-foreground group"
                  >
                    <link.icon className="h-3.5 w-3.5 text-primary" />
                    <span className="flex-1">{link.label}</span>
                    <ArrowLeft className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
