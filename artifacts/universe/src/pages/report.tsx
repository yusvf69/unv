import { useState } from "react";
import { useForm } from "react-hook-form";
import { motion } from "framer-motion";
import {
  Flag, Bug, Send, Loader2, AlertTriangle, Monitor,
  Smartphone, Globe, ChevronDown, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTranslation, globalI18n } from "@/lib/i18n";
import { useMeV2, api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const PROBLEM_TYPES = [
  { value: "bug", label: "خلل تقني", icon: Bug },
  { value: "ui", label: "مشكلة في الواجهة", icon: Monitor },
  { value: "mobile", label: "مشكلة في الجوال", icon: Smartphone },
  { value: "performance", label: "بطء في الأداء", icon: Globe },
  { value: "login", label: "مشكلة في تسجيل الدخول", icon: AlertTriangle },
  { value: "other", label: "أخرى", icon: Flag },
];

const SEVERITY_LEVELS = [
  { value: "low", label: "بسيطة" },
  { value: "medium", label: "متوسطة" },
  { value: "high", label: "عالية" },
  { value: "critical", label: "حرجة" },
];

export default function Report() {
  const t = useTranslation(globalI18n);
  const { data: me } = useMeV2();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const form = useForm({
    defaultValues: {
      name: "",
      email: "",
      type: "bug",
      severity: "medium",
      subject: "",
      description: "",
      steps: "",
      expected: "",
      actual: "",
    },
  });

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    try {
      const detail = [
        data.description && `**الوصف:** ${data.description}`,
        data.steps && `**خطوات إعادة الإنتاج:** ${data.steps}`,
        data.expected && `**النتيجة المتوقعة:** ${data.expected}`,
        data.actual && `**النتيجة الفعلية:** ${data.actual}`,
        data.severity && `**الأولوية:** ${SEVERITY_LEVELS.find((s) => s.value === data.severity)?.label}`,
      ]
        .filter(Boolean)
        .join("\n");

      await api.post("/v2/contact", {
        name: data.name || undefined,
        email: data.email || undefined,
        type: "report",
        subject: `[${data.type}] ${data.subject}`,
        message: detail,
      });

      toast({
        title: "تم الإبلاغ بنجاح ✅",
        description: "شكراً لك! فريق الدعم سيراجع المشكلة في أقرب وقت.",
      });
      form.reset();
      setIsSubmitted(true);
    } catch (e) {
      toast({
        title: "خطأ في الإرسال",
        description: (e as Error).message || "حاول مرة أخرى لاحقاً",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-2xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-16 sm:py-24"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-green-100 dark:bg-green-900/30 mb-6">
            <CheckCircle2 className="h-8 w-8 sm:h-10 sm:w-10 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">تم استلام البلاغ!</h1>
          <p className="text-sm sm:text-base text-muted-foreground mb-6 max-w-md mx-auto">
            شكراً لمساعدتك في تحسين المنصة. فريق التقنية سيراجع المشكلة ويتواصل معك إن لزم الأمر.
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => setIsSubmitted(false)}>
              الإبلاغ عن مشكلة أخرى
            </Button>
            <Button onClick={() => (window.location.href = "/")}>
              العودة للرئيسية
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-3xl">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-destructive/10 rounded-full text-xs sm:text-sm font-medium text-destructive mb-3">
          <Flag className="h-3.5 w-3.5" />
          <span>{t("reportProblem")}</span>
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold mb-3">
          {t("reportProblem")}
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground max-w-2xl">
          واجهت مشكلة تقنية؟ أخبرنا بها وسنعمل على حلها في أسرع وقت.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bug className="h-5 w-5 text-destructive" />
              تفاصيل المشكلة
            </CardTitle>
            <CardDescription>
              كلما زادت التفاصيل، كان من الأسهل حل المشكلة بسرعة.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs sm:text-sm">الاسم</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={me?.name || "اسمك"}
                            className="h-9 sm:h-10 text-sm"
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs sm:text-sm">البريد الإلكتروني</FormLabel>
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
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs sm:text-sm">نوع المشكلة</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-9 sm:h-10 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {PROBLEM_TYPES.map((t) => (
                              <SelectItem key={t.value} value={t.value}>
                                <div className="flex items-center gap-2">
                                  <t.icon className="h-3.5 w-3.5" />
                                  <span>{t.label}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="severity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs sm:text-sm">درجة التأثير</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-9 sm:h-10 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {SEVERITY_LEVELS.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                <div className="flex items-center gap-2">
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                  <span>{s.label}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="subject"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs sm:text-sm">عنوان المشكلة</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="ملخص مختصر"
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
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs sm:text-sm">وصف المشكلة</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="صِف المشكلة بالتفصيل..."
                          className="min-h-[100px] text-sm"
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="steps"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs sm:text-sm">خطوات إعادة الإنتاج</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="1. اذهب إلى..."
                            className="min-h-[80px] text-sm"
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="expected"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs sm:text-sm">النتيجة المتوقعة</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="ماذا كان يجب أن يحدث؟"
                            className="min-h-[80px] text-sm"
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="actual"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs sm:text-sm">النتيجة الفعلية</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="ماذا حدث بالفعل؟"
                            className="min-h-[80px] text-sm"
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>سيتم إرسال تأكيد لبريدك الإلكتروني</span>
                  </div>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <><Loader2 className="me-1.5 h-4 w-4 animate-spin" /> جاري الإرسال...</>
                    ) : (
                      <><Send className="me-1.5 h-4 w-4" /> إرسال البلاغ</>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
