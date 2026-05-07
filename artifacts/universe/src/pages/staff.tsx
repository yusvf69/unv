import { useListStaff } from "@workspace/api-client-react";
import { useTranslation, globalI18n } from "@/lib/i18n";
import { Link } from "wouter";
import { User } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";

export default function Staff() {
  const [department, setDepartment] = useState("");
  const { data: staff, isLoading } = useListStaff({ department: department || undefined });
  const t = useTranslation(globalI18n);

  if (isLoading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-8 gap-3 sm:gap-4">
        <h1 className="text-xl sm:text-4xl font-serif font-bold text-primary">{t("staff")}</h1>
        <Input 
          placeholder="Filter by department..." 
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="max-w-xs h-9 sm:h-10 text-sm"
        />
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
        {staff?.map(member => (
          <Link key={member.id} href={`/staff/${member.id}`} className="bg-card rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm border border-border hover:shadow-md transition-all text-center group block">
            <div className="w-16 h-16 sm:w-24 sm:h-24 mx-auto bg-primary/10 rounded-full mb-2 sm:mb-4 overflow-hidden border-2 sm:border-4 border-background shadow-sm group-hover:scale-105 transition-transform flex items-center justify-center">
              {member.avatarUrl ? (
                <img src={member.avatarUrl} alt={member.name} className="w-full h-full object-cover" />
              ) : (
                <User className="w-6 h-6 sm:w-10 sm:h-10 text-primary" />
              )}
            </div>
            <h3 className="font-bold text-sm sm:text-lg">{member.name}</h3>
            <p className="text-xs sm:text-sm font-medium text-secondary mb-0.5 sm:mb-1">{member.title}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">{member.department}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
