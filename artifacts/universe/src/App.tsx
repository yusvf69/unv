import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useGetMe } from "@workspace/api-client-react";
import { useEffect } from "react";
import NotFound from "@/pages/not-found";
import Layout from "@/components/layout";
import Home from "@/pages/home";
import News from "@/pages/news";
import NewsDetail from "@/pages/news-detail";
import Staff from "@/pages/staff";
import StaffDetail from "@/pages/staff-detail";
import Leaderboard from "@/pages/leaderboard";
import Dashboard from "@/pages/dashboard";
import Courses from "@/pages/courses";
import CourseDetail from "@/pages/student-course-detail";
import Quizzes, { QuizTakePage } from "@/pages/quizzes";
import Forum from "@/pages/forum";
import ForumDetail from "@/pages/forum-detail";
import Talents from "@/pages/talents";
import Skills from "@/pages/skills";
import SkillDetail from "@/pages/skill-detail";
import Complaints from "@/pages/complaints";
import AiChat from "@/pages/ai-chat";
import Profile from "@/pages/profile";
import AdminDashboard from "@/pages/admin-dashboard";
import AdminUsers from "@/pages/admin-users";
import Login from "@/pages/login";
import Games from "@/pages/games";
import AdminProposalsPage from "@/pages/admin-proposals";
import AdminNews from "@/pages/admin-news";
import AdminTalents from "@/pages/admin-talents";
import AdminStaff from "@/pages/admin-staff";
import Students from "@/pages/students";
import Messages from "@/pages/messages";
import DmThread from "@/pages/dm-thread";
import Materials from "@/pages/materials";
import AdminQuizzes from "@/pages/admin-quizzes";
import AdminCourses from "@/pages/admin-courses";
import AdminDmMonitor from "@/pages/admin-dm-monitor";
import AdminCourseDetail from "@/pages/admin-course-detail";
import AdminMaterials from "@/pages/admin-materials";
import AdminSchedule from "@/pages/admin-schedule";
import Events from "@/pages/events";
import AdminEvents from "@/pages/admin-events";
import StudentSummaries from "@/pages/student-summaries";
import Schedule from "@/pages/schedule";
import StudentProfile from "@/pages/student-profile";

const PUBLIC_ROUTES = ["/", "/login", "/news"];

function ProtectedRoute({ path, component: Component }: { path: string; component: () => React.ReactNode }) {
  const { data: user, isLoading } = useGetMe();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user && !PUBLIC_ROUTES.includes(path)) {
      setLocation("/login");
    }
  }, [user, isLoading, path, setLocation]);

  if (isLoading) {
    return <div className="container mx-auto px-4 py-32 text-center">جاري التحميل...</div>;
  }

  if (!user && !PUBLIC_ROUTES.includes(path)) {
    return null;
  }

  return <Route path={path} component={Component} />;
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/" component={Home} />
        <ProtectedRoute path="/news" component={News} />
        <ProtectedRoute path="/news/:id" component={NewsDetail} />
        <ProtectedRoute path="/staff" component={Staff} />
        <ProtectedRoute path="/staff/:id" component={StaffDetail} />
        <ProtectedRoute path="/talents" component={Talents} />
        <ProtectedRoute path="/leaderboard" component={Leaderboard} />
        <ProtectedRoute path="/dashboard" component={Dashboard} />
        <ProtectedRoute path="/courses" component={Courses} />
        <ProtectedRoute path="/courses/:id" component={CourseDetail} />
        <ProtectedRoute path="/materials" component={Materials} />
        <ProtectedRoute path="/quizzes" component={Quizzes} />
        <ProtectedRoute path="/quizzes/:id" component={QuizTakePage} />
        <ProtectedRoute path="/forum" component={Forum} />
        <ProtectedRoute path="/forum/:id" component={ForumDetail} />
        <ProtectedRoute path="/skills" component={Skills} />
        <ProtectedRoute path="/skills/:id" component={SkillDetail} />
        <ProtectedRoute path="/complaints" component={Complaints} />
        <ProtectedRoute path="/games" component={Games} />
        <ProtectedRoute path="/students" component={Students} />
        <ProtectedRoute path="/messages" component={Messages} />
        <ProtectedRoute path="/messages/:id" component={DmThread} />
        <ProtectedRoute path="/ai" component={AiChat} />
        <ProtectedRoute path="/profile" component={Profile} />
        <ProtectedRoute path="/admin" component={AdminDashboard} />
        <ProtectedRoute path="/admin/users" component={AdminUsers} />
        <ProtectedRoute path="/admin/proposals" component={AdminProposalsPage} />
        <ProtectedRoute path="/admin/news" component={AdminNews} />
        <ProtectedRoute path="/admin/talents" component={AdminTalents} />
        <ProtectedRoute path="/admin/staff" component={AdminStaff} />
        <ProtectedRoute path="/admin/quizzes" component={AdminQuizzes} />
        <ProtectedRoute path="/admin/courses" component={AdminCourses} />
        <ProtectedRoute path="/admin/courses/:id" component={AdminCourseDetail} />
        <ProtectedRoute path="/admin/materials" component={AdminMaterials} />
        <ProtectedRoute path="/admin/dm" component={AdminDmMonitor} />
        <ProtectedRoute path="/admin/schedule" component={AdminSchedule} />
        <ProtectedRoute path="/events" component={Events} />
        <ProtectedRoute path="/admin/events" component={AdminEvents} />
        <ProtectedRoute path="/summaries" component={StudentSummaries} />
        <ProtectedRoute path="/schedule" component={Schedule} />
        <ProtectedRoute path="/students/:id" component={StudentProfile} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
