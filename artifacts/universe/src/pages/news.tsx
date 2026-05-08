import { useListNews } from "@workspace/api-client-react";
import { useTranslation, globalI18n } from "@/lib/i18n";
import { Link } from "wouter";
import { formatISODate } from "@/lib/dates";

export default function News() {
  const { data: news, isLoading } = useListNews();
  const t = useTranslation(globalI18n);

  if (isLoading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
      <h1 className="text-xl sm:text-4xl font-serif font-bold text-primary mb-4 sm:mb-8">{t("news")}</h1>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
        {news?.map(item => (
          <Link key={item.id} href={`/news/${item.id}`} className="bg-card rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all border border-border group block">
            {item.imageUrl && (
              <div className="aspect-video w-full overflow-hidden bg-muted">
                <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>
            )}
            <div className="p-4 sm:p-6">
              <div className="text-[10px] sm:text-xs font-medium text-secondary mb-1 sm:mb-2 uppercase tracking-wider">{item.category}</div>
              <h3 className="font-bold text-base sm:text-xl mb-2 sm:mb-3 line-clamp-2">{item.title}</h3>
              <p className="text-xs sm:text-sm text-muted-foreground line-clamp-3 mb-3 sm:mb-4">{item.excerpt}</p>
              <div className="flex justify-between items-center text-[10px] sm:text-xs text-muted-foreground mt-auto">
                <span>{item.author}</span>
                <span>{formatISODate(item.publishedAt)}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
