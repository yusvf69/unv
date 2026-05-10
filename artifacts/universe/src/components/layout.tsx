import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { useLanguage } from "@/hooks/use-language";
import { globalI18n, useTranslation } from "@/lib/i18n";
import { useGetMe } from "@workspace/api-client-react";
import { useLogout } from "@/lib/api";
import {
  Leaf,
  User as UserIcon,
  LogOut,
  Menu,
  Sparkles,
  MessageCircle,
  Sun,
  Moon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import NotificationsBell from "@/components/notifications-bell";
import { useTheme } from "@/components/theme-provider";
import { useMeV2 } from "@/lib/api";

export default function Layout({ children }: { children: ReactNode }) {
  const { lang, toggleLang } = useLanguage();
  const t = useTranslation(globalI18n);
  const { data: user } = useGetMe();
  const { data: meV2 } = useMeV2();
  const logout = useLogout();
  const [, setLocation] = useLocation();
  const [location] = useLocation();
  const { theme, toggle: toggleTheme } = useTheme();

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const publicLinks = [
    { href: "/", label: t("home") },
    { href: "/news", label: t("news") },
  ];

  const appLinks = [
    { href: "/dashboard", label: t("dashboard") },
    { href: "/schedule", label: t("schedule") },
    { href: "/courses", label: t("courses") },
    { href: "/materials", label: t("materials") },
    { href: "/summaries", label: t("summaries") },
    { href: "/staff", label: t("staff") },
    { href: "/events", label: t("events") },
    { href: "/quizzes", label: t("quizzes") },
    { href: "/skills", label: t("skills") },
    { href: "/forum", label: t("forum") },
    { href: "/games", label: t("games") },
    { href: "/students", label: t("students") },
    { href: "/leaderboard", label: t("leaderboard") },
    { href: "/talents", label: t("talents") },
    { href: "/complaints", label: t("complaints") },
  ];

  if (isAdmin) appLinks.push({ href: "/admin", label: t("admin") });

  const links = user ? [...publicLinks, ...appLinks] : publicLinks;

  const handleLogout = async () => {
    await logout.mutateAsync();
    setLocation("/");
  };

  const NavLinks = () => (
    <>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`relative px-3 py-2 rounded-lg text-sm font-medium transition-all ${
            location === link.href ? "text-primary" : "text-foreground/70 hover:text-primary"
          }`}
        >
          {location === link.href && (
            <motion.div layoutId="activeNav" className="absolute inset-0 bg-primary/10 rounded-lg" transition={{ type: "spring", stiffness: 380, damping: 30 }} />
          )}
          <span className="relative">{link.label}</span>
        </Link>
      ))}
    </>
  );

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans">
      <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-3 sm:px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-6">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden"><Menu className="h-5 w-5" /></Button>
              </SheetTrigger>
              <SheetContent side={lang === "ar" ? "right" : "left"} className="w-72">
                <div className="flex flex-col gap-1 mt-8"><NavLinks /></div>
              </SheetContent>
            </Sheet>

            <Link href="/" className="flex items-center gap-2 group shrink-0">
              <motion.div whileHover={{ rotate: 15, scale: 1.1 }} className="bg-gradient-to-br from-primary to-primary/70 p-1.5 sm:p-2 rounded-xl shadow-lg shadow-primary/30">
                <Leaf className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
              </motion.div>
              <span className="font-serif font-bold text-lg sm:text-xl tracking-tight bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">UniVerse</span>
            </Link>

            <nav className="hidden lg:flex items-center gap-1"><NavLinks /></nav>
          </div>

          <div className="flex items-center gap-0.5 sm:gap-1">
            <Button variant="ghost" size="icon" onClick={toggleTheme} title={theme === "dark" ? t("lightMode") : t("darkMode")} className="h-8 w-8 sm:h-10 sm:w-10">
              {theme === "dark" ? <Sun className="h-4 w-4 sm:h-5 sm:w-5" /> : <Moon className="h-4 w-4 sm:h-5 sm:w-5" />}
            </Button>
            <Button variant="ghost" onClick={toggleLang} className="font-medium text-xs sm:text-sm w-10 sm:w-12 h-8 sm:h-10">
              {lang === "ar" ? "EN" : "عربي"}
            </Button>

            {user && (
              <Link href="/messages">
                  <Button variant="ghost" size="icon" className="relative h-8 w-8 sm:h-10 sm:w-10" title={t("messages")}>
                  <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                  {meV2 && meV2.unreadDmCount > 0 && (
                    <span className="absolute -top-1 -end-1 bg-destructive text-destructive-foreground text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                      {meV2.unreadDmCount > 9 ? "9+" : meV2.unreadDmCount}
                    </span>
                  )}
                </Button>
              </Link>
            )}

            {user && <NotificationsBell />}

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 sm:h-10 sm:w-10 rounded-full p-0">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.name} className="h-8 w-8 sm:h-10 sm:w-10 rounded-full object-cover border-2 border-primary/30 shadow-sm" />
                    ) : (
                      <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/20"><UserIcon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" /></div>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 sm:w-64">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user.name}</p>
                      <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <span className="text-xs bg-accent/30 text-accent-foreground px-2 py-0.5 rounded-full font-medium">{user.points} pts</span>
                        <span className="text-xs bg-secondary/20 text-secondary-foreground px-2 py-0.5 rounded-full font-medium">Lvl {user.level}</span>
                        {(user as any).groupName && <span className="text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full font-bold">G{(user as any).groupName}</span>}
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild><Link href="/profile" className="cursor-pointer w-full flex items-center"><UserIcon className="me-2 h-4 w-4" /><span>{t("profile")}</span></Link></DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive cursor-pointer">
                    <LogOut className="me-2 h-4 w-4" /><span>{t("logout")}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link href="/login"><Button size="sm" className="h-8 sm:h-10">{t("login")}</Button></Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col">{children}</main>

      {user && (
        <Link href="/ai" className="fixed bottom-4 end-4 sm:bottom-6 sm:end-6 z-50">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
            <Button size="lg" className="rounded-full shadow-2xl shadow-primary/40 h-12 w-12 sm:h-14 sm:w-14 p-0 bg-gradient-to-br from-primary to-secondary">
              <Sparkles className="h-5 w-5 sm:h-6 sm:w-6" />
            </Button>
          </motion.div>
        </Link>
      )}

      <footer className="border-t bg-gradient-to-b from-background to-muted/40 mt-8 sm:mt-12">
        <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs sm:text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Leaf className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
            <span>{t("footerCredit")} © {new Date().getFullYear()}</span>
          </div>
          <a
            href="https://onz-onz-website.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary hover:underline inline-flex items-center gap-1"
          >
            Developed by ONZ
            <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
          </a>
        </div>
      </footer>
    </div>
  );
}
