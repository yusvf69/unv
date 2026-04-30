import { useState } from "react";
import { useListComplaints, useCreateComplaint, getListComplaintsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { AlertCircle, Clock, CheckCircle2, MessageSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormField, FormItem, FormLabel, FormControl } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function Complaints() {
  const { data: complaints, isLoading } = useListComplaints();
  const createComplaint = useCreateComplaint();
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);

  const form = useForm({
    defaultValues: {
      subject: "",
      category: "academic",
      body: ""
    }
  });

  const onSubmit = (data: any) => {
    createComplaint.mutate(
      { data },
      {
        onSuccess: () => {
          form.reset();
          setIsFormOpen(false);
          queryClient.invalidateQueries({ queryKey: getListComplaintsQueryKey() });
        }
      }
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <AlertCircle className="w-4 h-4 text-destructive" />;
      case 'in_review': return <Clock className="w-4 h-4 text-accent" />;
      case 'resolved':
      case 'closed': return <CheckCircle2 className="w-4 h-4 text-primary" />;
      default: return <MessageSquare className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open': return <Badge variant="destructive">Open</Badge>;
      case 'in_review': return <Badge variant="secondary" className="bg-accent text-accent-foreground">In Review</Badge>;
      case 'resolved': return <Badge variant="default" className="bg-primary">Resolved</Badge>;
      case 'closed': return <Badge variant="outline">Closed</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-4xl font-serif font-bold text-primary mb-2">Student Support</h1>
          <p className="text-muted-foreground">Submit requests, inquiries, or complaints directly to the administration.</p>
        </div>
        {!isFormOpen && (
          <Button onClick={() => setIsFormOpen(true)} className="gap-2 shrink-0">
            <Plus className="w-4 h-4" /> New Ticket
          </Button>
        )}
      </div>

      {isFormOpen && (
        <Card className="mb-8 border-primary/20 shadow-md">
          <CardHeader>
            <CardTitle>Submit a New Ticket</CardTitle>
            <CardDescription>We'll review your submission and get back to you as soon as possible.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="subject"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subject</FormLabel>
                        <FormControl>
                          <Input placeholder="Brief summary of your issue" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="academic">Academic Affairs</SelectItem>
                            <SelectItem value="facilities">Facilities & Infrastructure</SelectItem>
                            <SelectItem value="financial">Financial</SelectItem>
                            <SelectItem value="technical">Technical Support</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="body"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Details</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Please provide all necessary details..." className="min-h-[120px]" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="ghost" onClick={() => setIsFormOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={createComplaint.isPending}>
                    {createComplaint.isPending ? "Submitting..." : "Submit Ticket"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      <h3 className="text-xl font-bold mb-4 font-serif">Your Past Tickets</h3>
      
      {isLoading ? (
        <div className="text-center py-8">Loading...</div>
      ) : complaints?.length === 0 ? (
        <div className="text-center py-16 bg-muted/30 rounded-2xl border border-dashed border-border">
          <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-bold mb-2">No tickets yet</h3>
          <p className="text-muted-foreground">You haven't submitted any requests or complaints.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {complaints?.map((complaint) => (
            <div key={complaint.id} className="bg-card rounded-xl border border-border p-6 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-muted rounded-lg">
                    {getStatusIcon(complaint.status)}
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">{complaint.subject}</h4>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">{complaint.category} • {new Date(complaint.createdAt).toLocaleDateString()}</div>
                  </div>
                </div>
                {getStatusBadge(complaint.status)}
              </div>
              
              <div className="bg-background rounded-lg p-4 text-sm text-foreground/80 mb-4 border border-border/50">
                {complaint.body}
              </div>
              
              {complaint.response && (
                <div className="bg-primary/5 rounded-lg p-4 text-sm border border-primary/20 relative">
                  <div className="absolute -top-3 left-4 bg-background px-2 text-xs font-bold text-primary border border-primary/20 rounded-full">Official Response</div>
                  <p className="mt-2 text-foreground/90">{complaint.response}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
