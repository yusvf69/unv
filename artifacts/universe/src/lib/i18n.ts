import { useLanguage } from "@/hooks/use-language";

type Translations = Record<string, { ar: string; en: string }>;

export const useTranslation = (translations: Translations) => {
  const { lang } = useLanguage();

  return (key: keyof typeof translations) => {
    return translations[key as string]?.[lang] || key as string;
  };
};

export const globalI18n = {
  home: { ar: "الرئيسية", en: "Home" },
  news: { ar: "الأخبار", en: "News" },
  staff: { ar: "أعضاء هيئة التدريس", en: "Staff" },
  leaderboard: { ar: "لوحة الشرف", en: "Leaderboard" },
  courses: { ar: "المقررات", en: "Courses" },
  quizzes: { ar: "الاختبارات", en: "Quizzes" },
  forum: { ar: "المنتدى", en: "Forum" },
  talents: { ar: "المواهب", en: "Talents" },
  skills: { ar: "المهارات", en: "Skills" },
  complaints: { ar: "الشكاوى", en: "Complaints" },
  dashboard: { ar: "لوحة المعلومات", en: "Dashboard" },
  admin: { ar: "الإدارة", en: "Admin" },
  profile: { ar: "الملف الشخصي", en: "Profile" },
  login: { ar: "تسجيل الدخول", en: "Login" },
  games: { ar: "الألعاب", en: "Games" },
  notifications: { ar: "الإشعارات", en: "Notifications" },
  proposals: { ar: "اقتراحات الإدارة", en: "Admin Proposals" },
  superAdminPanel: { ar: "لوحة السوبر أدمن", en: "Super Admin" },
  manageNews: { ar: "إدارة الأخبار", en: "Manage News" },
  manageStaff: { ar: "إدارة هيئة التدريس", en: "Manage Staff" },
  manageTalents: { ar: "إدارة المواهب", en: "Moderate Talents" },
  manageCourses: { ar: "إدارة المقررات", en: "Manage Courses" },
  myGroup: { ar: "مجموعتي", en: "My Group" },
  group: { ar: "مجموعة", en: "Group" },
  attendance: { ar: "الحضور", en: "Attendance" },
  grades: { ar: "الدرجات", en: "Grades" },
  schedule: { ar: "الجدول", en: "Schedule" },
  logout: { ar: "تسجيل الخروج", en: "Logout" },
};
