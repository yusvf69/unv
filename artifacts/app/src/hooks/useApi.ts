import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type MeV2 } from "../lib/api";

export function useMe() {
  return useQuery<MeV2>({
    queryKey: ["v2", "me"],
    queryFn: () => api.get<MeV2>("/v2/me"),
    staleTime: 30_000,
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<{
      name: string; phone: string; avatarUrl: string; bio: string;
      specialization: string; yearInCollege: number; groupName: string;
    }>) => api.patch("/v2/me/profile", body),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/v2/auth/logout"),
    onSuccess: () => {
      qc.invalidateQueries();
    },
  });
}

export interface TalentFeedItem {
  id: number; title: string; description: string; category: string;
  mediaUrl: string | null; votes: number; ownerId: number; status: string;
  groupOnly: string | null; createdAt: string;
  owner: { id: number; name: string; avatarUrl: string | null; groupName: string | null; department: string } | null;
  likesCount: number; likedByMe: boolean; commentsCount: number;
}

export function useTalentsFeed() {
  return useQuery<TalentFeedItem[]>({
    queryKey: ["v2", "talents-feed"],
    queryFn: () => api.get<TalentFeedItem[]>("/v2/talents-feed"),
  });
}

export function useNotifications() {
  return useQuery<any[]>({
    queryKey: ["v2", "notifications"],
    queryFn: () => api.get("/v2/notifications"),
    refetchInterval: 30_000,
  });
}

export interface CourseRow {
  id: number; title: string; code: string; description: string; credits: number;
  department: string; instructor: string; coverUrl: string | null; enrolled: number; semester: number;
}

export function useCourses() {
  return useQuery<CourseRow[]>({
    queryKey: ["courses"],
    queryFn: () => api.get("/courses"),
  });
}

export function useCourseDetail(id: number) {
  return useQuery<any>({
    queryKey: ["courses", id],
    queryFn: () => api.get(`/courses/${id}`),
  });
}

export function useCourseLectures(id: number) {
  return useQuery<any[]>({
    queryKey: ["v2", "courses", id, "lectures"],
    queryFn: () => api.get(`/v2/courses/${id}/lectures`),
  });
}

export interface ForumPost {
  id: number; title: string; body: string; category: string;
  authorId: number; upvotes: number; createdAt: string;
  authorName: string; authorAvatar: string | null; authorGroup: string | null;
  repliesCount: number;
}

export interface ForumReply {
  id: number; postId: number; body: string; authorId: number;
  upvotes: number; isBest: boolean; createdAt: string;
  authorName: string; authorAvatar: string | null; authorRole: string | null;
}

export function useForumPosts() {
  return useQuery<ForumPost[]>({
    queryKey: ["v2", "forum", "posts"],
    queryFn: () => api.get("/v2/forum/posts"),
  });
}

export function useForumReplies(postId: number) {
  return useQuery<ForumReply[]>({
    queryKey: ["v2", "forum", "posts", postId, "replies"],
    queryFn: () => api.get(`/v2/forum/posts/${postId}/replies`),
    enabled: !!postId,
  });
}

export function useCreateReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, body }: { postId: number; body: string }) =>
      api.post(`/v2/forum/posts/${postId}/replies`, { body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["v2", "forum"] }),
  });
}

export function useUpvotePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (postId: number) => api.post(`/v2/forum/posts/${postId}/upvote`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["v2", "forum"] }),
  });
}

export interface GameScore {
  id: number; userId: number; gameKey: string; score: number;
  durationMs: number; createdAt: string;
  userName?: string; userAvatar?: string | null; groupName?: string | null;
}

export function useGameLeaderboard(gameKey?: string) {
  return useQuery<GameScore[]>({
    queryKey: ["v2", "games", "leaderboard", gameKey ?? "all"],
    queryFn: () => api.get(`/v2/games/leaderboard${gameKey ? `?gameKey=${gameKey}` : ""}`),
  });
}

export function useAchievements() {
  return useQuery<any[]>({
    queryKey: ["v2", "achievements"],
    queryFn: () => api.get("/v2/achievements"),
  });
}

// ----- DM / Messages -----
export interface DmThread {
  threadId: number;
  other: { id: number; name: string; avatarUrl: string | null; groupName: string | null } | null;
  lastMessage: { body: string; createdAt: string; fromMe: boolean } | null;
  unread: number;
}

export function useDmThreads() {
  return useQuery<DmThread[]>({
    queryKey: ["v2", "dm", "threads"],
    queryFn: () => api.get("/v2/dm/threads"),
  });
}

export function useDmConversation(userId: number) {
  return useQuery<any>({
    queryKey: ["v2", "dm", "with", userId],
    queryFn: () => api.get(`/v2/dm/with/${userId}`),
    enabled: !!userId,
  });
}

export function useSendDm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, body }: { userId: number; body: string }) =>
      api.post(`/v2/dm/with/${userId}`, { body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["v2", "dm"] }),
  });
}

// ----- AI Chat -----
export interface AiMessage {
  role: "user" | "assistant";
  content: string;
}

export function useAiChat() {
  return useMutation({
    mutationFn: (messages: AiMessage[]) =>
      api.post<{ reply: string; suggestions: string[] }>("/ai/chat", { messages }),
  });
}

// ----- Quiz types -----
export interface QuizRow {
  id: number; title: string; description: string; courseId: number;
  courseTitle: string; durationMinutes: number; totalPoints: number;
  difficulty: string; groupOnly: string | null; yearOnly: number | null;
  isOpen: boolean; passPercent: number; createdAt: string;
  myAttemptsCount: number; myBestScore: number;
}

export interface QuizQuestion {
  id: number; text: string; options: string[]; optionMap: number[]; points: number;
}

export interface StartedQuiz {
  quiz: QuizRow;
  questions: QuizQuestion[];
}

export interface SubmitAnswer {
  questionId: number; chosenOriginalIndex: number;
}

export interface QuestionResult {
  questionId: number; text: string; options: string[];
  correctIndex: number; explanation: string; points: number;
  userChosen: number; correct: boolean;
}

export interface QuizResult {
  id: number; quizId: number; score: number; total: number;
  durationSec: number; passed: boolean; pointsAwarded: number;
  questionDetails: QuestionResult[];
}

export function useOpenQuizzes() {
  return useQuery<QuizRow[]>({
    queryKey: ["v2", "quizzes", "open"],
    queryFn: () => api.get<QuizRow[]>("/v2/quizzes/open"),
  });
}

export function useStartQuiz(id: number) {
  return useQuery<StartedQuiz>({
    queryKey: ["v2", "quizzes", id, "start"],
    queryFn: () => api.get<StartedQuiz>(`/v2/quizzes/${id}/start`),
    enabled: false,
    retry: false,
  });
}

export function useSubmitQuiz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ quizId, answers, durationSec }: { quizId: number; answers: SubmitAnswer[]; durationSec: number }) =>
      api.post<QuizResult>(`/v2/quizzes/${quizId}/submit`, { answers, durationSec }),
    onSuccess: () => qc.invalidateQueries(),
  });
}

// ----- Schedule -----
export interface ScheduleItem {
  id: number; groupName: string; yearInCollege: number; day: string;
  dayNumber: number; startTime: string; endTime: string;
  courseTitle: string; instructor: string; room: string;
}

export function useSchedule() {
  return useQuery<ScheduleItem[]>({
    queryKey: ["v2", "group-schedule"],
    queryFn: () => api.get("/v2/group-schedule"),
  });
}

// ----- Talents -----
export function useTalentLike() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (talentId: number) => api.post(`/v2/talents/${talentId}/like`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["v2", "talents-feed"] }),
  });
}

// ----- Games -----
export function useSubmitGameScore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ gameKey, score, durationMs }: { gameKey: string; score: number; durationMs?: number }) =>
      api.post("/v2/games/score", { gameKey, score, durationMs }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["v2", "games"] }),
  });
}

// ----- Skills -----
export interface SkillTrack {
  id: number; title: string; description: string; icon: string;
  lessons: { id: number; trackId: number; title: string; description: string; ord: number; completed: boolean }[];
}

export function useSkillTracks() {
  return useQuery<SkillTrack[]>({
    queryKey: ["v2", "skills", "tracks"],
    queryFn: () => api.get("/v2/skills/tracks"),
  });
}

// ----- News -----
export function useNews() {
  return useQuery<any[]>({
    queryKey: ["news"],
    queryFn: () => api.get("/news"),
  });
}

// ----- Staff -----
export interface StaffMember {
  id: number; name: string; role: string; department: string;
  avatarUrl: string | null; title: string | null;
}

export function useStaffDoctors() {
  return useQuery<StaffMember[]>({
    queryKey: ["v2", "staff", "doctors"],
    queryFn: () => api.get("/v2/staff/doctors"),
  });
}

// ----- Events -----
export function useEvents() {
  return useQuery<any[]>({
    queryKey: ["events"],
    queryFn: () => api.get("/events"),
  });
}
