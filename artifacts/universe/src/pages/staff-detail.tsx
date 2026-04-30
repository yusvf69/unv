import { useGetStaffMember, getGetStaffMemberQueryKey } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { ChevronLeft, User, Mail, Clock, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function StaffDetail() {
  const { id } = useParams<{ id: string }>();
  const staffId = Number(id);
  const { data: member, isLoading } = useGetStaffMember(staffId, {
    query: { enabled: !!staffId, queryKey: getGetStaffMemberQueryKey(staffId) }
  });

  if (isLoading) return <div className="p-8 text-center">Loading...</div>;
  if (!member) return <div className="p-8 text-center">Not found</div>;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Link href="/staff" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4 mr-1" />
        Back to Staff Directory
      </Link>

      <div className="bg-card rounded-3xl border border-border shadow-sm overflow-hidden mb-8">
        <div className="h-32 md:h-48 bg-primary/10 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
        </div>
        <div className="px-6 md:px-10 pb-10 relative">
          <div className="flex flex-col md:flex-row gap-6 md:gap-8 -mt-16 md:-mt-24 mb-6">
            <div className="w-32 h-32 md:w-48 md:h-48 rounded-2xl border-4 border-background bg-muted flex items-center justify-center shrink-0 overflow-hidden shadow-lg relative">
              {member.avatarUrl ? (
                <img src={member.avatarUrl} alt={member.name} className="w-full h-full object-cover" />
              ) : (
                <User className="w-16 h-16 text-primary/30" />
              )}
            </div>
            
            <div className="flex-1 flex flex-col justify-end pt-4 md:pt-0">
              <div className="flex flex-wrap gap-2 mb-3">
                <Badge variant="secondary" className="uppercase tracking-wider">{member.department}</Badge>
                <Badge variant="outline" className="uppercase tracking-wider capitalize">{member.role.replace('_', ' ')}</Badge>
              </div>
              <h1 className="text-3xl md:text-5xl font-serif font-bold text-foreground mb-2">{member.name}</h1>
              <p className="text-xl text-secondary font-medium">{member.title}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-8">
              <section>
                <h3 className="text-xl font-bold mb-4 font-serif">Biography</h3>
                <div className="prose dark:prose-invert text-muted-foreground">
                  <p className="whitespace-pre-line leading-relaxed">{member.bio}</p>
                </div>
              </section>

              {member.researchInterests.length > 0 && (
                <section>
                  <h3 className="text-xl font-bold mb-4 font-serif flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-primary" /> Research Interests
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {member.researchInterests.map((interest, i) => (
                      <span key={i} className="px-3 py-1.5 bg-accent/10 text-accent-foreground border border-accent/20 rounded-full text-sm font-medium">
                        {interest}
                      </span>
                    ))}
                  </div>
                </section>
              )}
            </div>

            <div className="space-y-6">
              <div className="bg-background rounded-2xl p-6 border border-border">
                <h3 className="font-bold mb-4">Contact Information</h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-3 text-sm">
                    <Mail className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Email</p>
                      <a href={`mailto:${member.email}`} className="text-muted-foreground hover:text-primary transition-colors break-all">
                        {member.email}
                      </a>
                    </div>
                  </div>
                  
                  {member.officeHours && (
                    <div className="flex items-start gap-3 text-sm">
                      <Clock className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">Office Hours</p>
                        <p className="text-muted-foreground whitespace-pre-line">{member.officeHours}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
