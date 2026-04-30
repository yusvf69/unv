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
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <h1 className="text-4xl font-serif font-bold text-primary">{t("staff")}</h1>
        <Input 
          placeholder="Filter by department..." 
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="max-w-xs"
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {staff?.map(member => (
          <Link key={member.id} href={`/staff/${member.id}`} className="bg-card rounded-2xl p-6 shadow-sm border border-border hover:shadow-md transition-all text-center group block">
            <div className="w-24 h-24 mx-auto bg-primary/10 rounded-full mb-4 overflow-hidden border-4 border-background shadow-sm group-hover:scale-105 transition-transform flex items-center justify-center">
              {member.avatarUrl ? (
                <img src={member.avatarUrl} alt={member.name} className="w-full h-full object-cover" />
              ) : (
                <User className="w-10 h-10 text-primary" />
              )}
            </div>
            <h3 className="font-bold text-lg">{member.name}</h3>
            <p className="text-sm font-medium text-secondary mb-1">{member.title}</p>
            <p className="text-xs text-muted-foreground">{member.department}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
