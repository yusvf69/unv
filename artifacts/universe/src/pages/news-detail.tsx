import { useGetNews, getGetNewsQueryKey } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { ChevronRight, ChevronLeft, Calendar, User } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";

export default function NewsDetail() {
  const { id } = useParams<{ id: string }>();
  const { lang } = useLanguage();
  const { data: article, isLoading } = useGetNews(Number(id), { 
    query: { enabled: !!id, queryKey: getGetNewsQueryKey(Number(id)) } 
  });

  if (isLoading) return <div className="p-6 sm:p-8 text-center text-sm">Loading...</div>;
  if (!article) return <div className="p-6 sm:p-8 text-center text-sm">Not found</div>;

  const BackIcon = lang === "ar" ? ChevronRight : ChevronLeft;

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-4xl">
      <Link href="/news" className="inline-flex items-center text-xs sm:text-sm font-medium text-muted-foreground hover:text-primary mb-4 sm:mb-6 transition-colors">
        <BackIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 mx-1" />
        Back to News
      </Link>

      <article className="bg-card rounded-xl sm:rounded-2xl shadow-sm border border-border overflow-hidden">
        {article.imageUrl && (
          <div className="w-full aspect-[21/9] bg-muted">
            <img src={article.imageUrl} alt={article.title} className="w-full h-full object-cover" />
          </div>
        )}
        
        <div className="p-4 sm:p-8 md:p-12">
          <div className="inline-block px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-secondary/10 text-secondary text-[10px] sm:text-sm font-medium mb-4 sm:mb-6">
            {article.category}
          </div>
          
          <h1 className="text-xl sm:text-3xl md:text-5xl font-serif font-bold text-foreground mb-4 sm:mb-6 leading-tight">
            {article.title}
          </h1>
          
          <div className="flex flex-wrap gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground mb-6 sm:mb-10 pb-6 sm:pb-8 border-b border-border">
            <div className="flex items-center gap-2">
              <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>{article.author}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>{new Date(article.publishedAt).toLocaleDateString()}</span>
            </div>
          </div>
          
          <div className="prose prose-sm sm:prose-lg dark:prose-invert max-w-none prose-p:text-muted-foreground prose-headings:font-serif">
            {article.body.split('\n').map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
        </div>
      </article>
    </div>
  );
}
