import { useListNews } from "@workspace/api-client-react";
import { useTranslation, globalI18n } from "@/lib/i18n";
import { Link } from "wouter";

export default function News() {
  const { data: news, isLoading } = useListNews();
  const t = useTranslation(globalI18n);

  if (isLoading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-serif font-bold text-primary mb-8">{t("news")}</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {news?.map(item => (
          <Link key={item.id} href={`/news/${item.id}`} className="bg-card rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all border border-border group block">
            {item.imageUrl && (
              <div className="aspect-video w-full overflow-hidden bg-muted">
                <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>
            )}
            <div className="p-6">
              <div className="text-xs font-medium text-secondary mb-2 uppercase tracking-wider">{item.category}</div>
              <h3 className="font-bold text-xl mb-3 line-clamp-2">{item.title}</h3>
              <p className="text-muted-foreground text-sm line-clamp-3 mb-4">{item.excerpt}</p>
              <div className="flex justify-between items-center text-xs text-muted-foreground mt-auto">
                <span>{item.author}</span>
                <span>{new Date(item.publishedAt).toLocaleDateString()}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
