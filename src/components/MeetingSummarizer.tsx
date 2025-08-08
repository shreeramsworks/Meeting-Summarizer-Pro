
"use client";

import { useState, useEffect, useRef } from "react";
import type { SummaryItem, Reminder } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { summarizeMeetingTranscript } from "@/ai/flows/summarize-meeting";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, Save, Bell, Calendar as CalendarIcon, Trash2, Loader2, Send, Upload, Link as LinkIcon, User, LogOut } from "lucide-react";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";


const WEBHOOK_URL = "https://adapted-mentally-chimp.ngrok-free.app/webhook-test/meetingsummerize";
const DELETE_SUMMARY_WEBHOOK_URL = "https://adapted-mentally-chimp.ngrok-free.app/webhook-test/email-delete-summary";

type MeetingSummarizerProps = {
  user: SupabaseUser;
};

export default function MeetingSummarizer({ user }: MeetingSummarizerProps) {
  const { toast } = useToast();
  const router = useRouter();
  const supabase = createClient();
  const [transcript, setTranscript] = useState("");
  const [summary, setSummary] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [savedSummaries, setSavedSummaries] = useState<SummaryItem[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [reminderText, setReminderText] = useState("");
  const [reminderDate, setReminderDate] = useState<Date | undefined>();
  const [reminderTime, setReminderTime] = useState("");
  const [manualReminderSummaryId, setManualReminderSummaryId] = useState<string | undefined>();
  const [activeTab, setActiveTab] = useState("summarizer");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsDataLoading(true);
      
      const summariesPromise = supabase
        .from('summaries')
        .select('*')
        .order('timestamp', { ascending: false });

      const remindersPromise = supabase
        .from('reminders')
        .select('*')
        .order('remindAt', { ascending: true });

      const [summariesResult, remindersResult] = await Promise.all([summariesPromise, remindersPromise]);

      if (summariesResult.error) {
        console.error("Error fetching summaries:", summariesResult.error);
        toast({ variant: 'destructive', title: 'Error fetching summaries', description: summariesResult.error.message });
      } else {
        setSavedSummaries(summariesResult.data || []);
      }
      
      if (remindersResult.error) {
        console.error("Error fetching reminders:", remindersResult.error);
        toast({ variant: 'destructive', title: 'Error fetching reminders', description: remindersResult.error.message });
      } else {
        setReminders(remindersResult.data || []);
      }

      setIsDataLoading(false);
    };

    fetchData();
  }, [supabase, toast]);


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setTranscript(text);
      };
      reader.readAsText(file);
    }
  };
  
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleSummarize = async () => {
    if (!transcript.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Transcript cannot be empty.",
      });
      return;
    }

    setIsLoading(true);
    setSummary("");

    try {
      const result = await summarizeMeetingTranscript({
        transcript,
        webhookUrl: WEBHOOK_URL,
      });
      setSummary(result.summary);
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Summarization Failed",
        description: "Could not summarize the transcript. Please try again later.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSummary = async () => {
    if (!summary || !user) return;

    const newSummaryItem: Omit<SummaryItem, 'id' | 'timestamp'> = {
      user_id: user.id,
      transcript,
      summary,
    };

    const { data, error } = await supabase
        .from('summaries')
        .insert(newSummaryItem)
        .select()
        .single();
    
    if (error || !data) {
        toast({ variant: 'destructive', title: 'Error', description: `Failed to save summary: ${error?.message}` });
        return;
    }

    const savedSummaryItem = data as SummaryItem;
    setSavedSummaries([savedSummaryItem, ...savedSummaries]);
    
    const newRemindersToCreate: Omit<Reminder, 'id' | 'timestamp' | 'completed' | 'user_id'>[] = [];

    // Parse action items
    const actionItemsRegex = /Action Items:\n([\s\S]*?)(?=\n\n[A-Z]|$)/;
    const actionItemsMatch = summary.match(actionItemsRegex);
    if (actionItemsMatch) {
        const itemRegex = /  - (.*) \(Assignee: (.*), Due: (.*)\)/g;
        let match;
        while ((match = itemRegex.exec(actionItemsMatch[1])) !== null) {
            const [, task, assignee, dueDate] = match;
            const reminderDate = new Date(dueDate);
            if (!isNaN(reminderDate.getTime())) {
                newRemindersToCreate.push({
                    text: `Action: ${task} (Assigned to: ${assignee})`,
                    remindAt: reminderDate.toISOString(),
                    summaryId: savedSummaryItem.id,
                });
            }
        }
    }

    // Parse follow-up reminders
    const followUpRegex = /Follow-up Reminders:\n([\s\S]*?)(?=\n\n[A-Z]|$)/;
    const followUpMatch = summary.match(followUpRegex);
    if (followUpMatch) {
        const itemRegex = /  - (.*) \(Due: (.*), Context: (.*)\)/g;
        let match;
        while ((match = itemRegex.exec(followUpMatch[1])) !== null) {
            const [, reminderText, dueDate, context] = match;
            const reminderDate = new Date(dueDate);
            if (!isNaN(reminderDate.getTime())) {
                newRemindersToCreate.push({
                    text: `Follow-up: ${reminderText} (Context: ${context})`,
                    remindAt: reminderDate.toISOString(),
                    summaryId: savedSummaryItem.id,
                });
            }
        }
    }
    
    if (newRemindersToCreate.length > 0) {
        const remindersWithUser = newRemindersToCreate.map(r => ({ ...r, user_id: user.id, completed: false }));
        const { data: remindersData, error: remindersError } = await supabase
            .from('reminders')
            .insert(remindersWithUser)
            .select();

        if (remindersError) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to save reminders: ${remindersError.message}` });
        } else if (remindersData) {
            setReminders(prev => [...prev, ...remindersData].sort((a,b) => new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime()));
            toast({
                title: "Success",
                description: "Summary saved and reminders created for action items and follow-ups.",
            });
        }
    } else {
          toast({
            title: "Success",
            description: "Summary saved.",
        });
    }

    setSummary('');
    setTranscript('');
    setActiveTab('saved');
};

  const handleAddReminder = async () => {
    if (!reminderText.trim() || !reminderDate || !user) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please provide both text and a date for the reminder.",
      });
      return;
    }

    const finalReminderDate = new Date(reminderDate);
    if (reminderTime) {
      const [hours, minutes] = reminderTime.split(':').map(Number);
      if (!isNaN(hours) && !isNaN(minutes)) {
        finalReminderDate.setHours(hours, minutes);
      }
    }

    const newReminder: Omit<Reminder, 'id' | 'timestamp'> = {
      user_id: user.id,
      text: reminderText,
      remindAt: finalReminderDate.toISOString(),
      summaryId: manualReminderSummaryId || null,
      completed: false,
    };
    
    const { data, error } = await supabase.from('reminders').insert(newReminder).select().single();

    if (error || !data) {
        toast({ variant: 'destructive', title: 'Error', description: `Failed to add reminder: ${error?.message}` });
        return;
    }

    setReminders([data as Reminder, ...reminders].sort((a,b) => new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime()));
    setReminderText("");
    setReminderDate(undefined);
    setReminderTime("");
    setManualReminderSummaryId(undefined);
    toast({ title: 'Success', description: 'Manual reminder added.' });
  };

  const handleDeleteSummary = async (id: string) => {
    const summaryToDelete = savedSummaries.find(s => s.id === id);
    if (!summaryToDelete) return;

    // Send webhook
    try {
        await fetch(DELETE_SUMMARY_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: user.user_metadata.full_name,
                email: user.email,
                summary: summaryToDelete.summary,
                transcript: summaryToDelete.transcript,
            }),
        });
    } catch (e) {
        console.error("Failed to send delete summary webhook", e);
        // Do not block deletion if webhook fails
    }
    
    // Because of 'ON DELETE CASCADE', we only need to delete the summary.
    // The database will handle deleting associated reminders.
    const { error } = await supabase.from('summaries').delete().match({ id });

    if (error) {
        toast({ variant: 'destructive', title: 'Error', description: `Could not delete summary: ${error.message}` });
    } else {
        setSavedSummaries(savedSummaries.filter((item) => item.id !== id));
        setReminders(reminders.filter(r => r.summaryId !== id)); // Also update client state
        toast({ title: 'Success', description: 'Summary and associated reminders deleted.' });
    }
  };

  const handleDeleteReminder = async (id: string) => {
    const { error } = await supabase.from('reminders').delete().match({ id });
    if (error) {
        toast({ variant: 'destructive', title: 'Error', description: `Could not delete reminder: ${error.message}` });
    } else {
        setReminders(reminders.filter((item) => item.id !== id));
        toast({ title: 'Success', description: 'Reminder deleted.' });
    }
  };

  const handleToggleReminder = async (id: string, completed: boolean) => {
    const { data, error } = await supabase
        .from('reminders')
        .update({ completed: !completed })
        .match({ id })
        .select()
        .single();
    
    if (error || !data) {
        toast({ variant: 'destructive', title: 'Error', description: `Could not update reminder: ${error?.message}` });
    } else {
        setReminders(reminders.map(r => r.id === id ? data as Reminder : r));
    }
  };
  
  const handleReminderLinkClick = (summaryId: string | null) => {
    if (!summaryId) return;
    setActiveTab("saved");
    // We can't directly open the accordion, but we can scroll to it.
    setTimeout(() => {
        const element = document.getElementById(`summary-item-${summaryId}`);
        if(element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            (element.querySelector('[data-radix-collection-item]') as HTMLElement)?.click();
        }
    }, 100);
  };
  
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };


  if (isDataLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
          <Loader2 className="h-16 w-16 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <header className="flex items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
            <FileText className="h-10 w-10 text-primary" />
            <div>
              <h1 className="text-3xl font-bold font-headline">Meeting Summarizer Pro</h1>
              <p className="text-muted-foreground">Your AI-powered meeting assistant</p>
            </div>
        </div>
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar className="h-10 w-10">
                        <AvatarFallback>
                            <User className="h-5 w-5" />
                        </AvatarFallback>
                    </Avatar>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user.user_metadata.full_name || 'User'}</p>
                        <p className="text-xs leading-none text-muted-foreground">
                            {user.email}
                        </p>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sign Out</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="summarizer"><FileText className="mr-2 h-4 w-4" />Summarizer</TabsTrigger>
          <TabsTrigger value="saved"><Save className="mr-2 h-4 w-4" />Saved</TabsTrigger>
          <TabsTrigger value="reminders"><Bell className="mr-2 h-4 w-4" />Reminders</TabsTrigger>
        </TabsList>
        <TabsContent value="summarizer" className="mt-6">
          <div className="grid grid-cols-1 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Your Transcript</CardTitle>
                <CardDescription>Paste your meeting transcript below or upload a .txt file.</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Paste your full meeting transcript here..."
                  className="min-h-[200px] text-sm"
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  disabled={isLoading}
                />
              </CardContent>
              <CardFooter className="flex-col sm:flex-row items-start sm:items-center gap-2">
                <Button onClick={handleSummarize} disabled={isLoading || !transcript.trim()}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  {isLoading ? 'Summarizing...' : 'Summarize'}
                </Button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept=".txt"
                />
                <Button variant="outline" onClick={handleUploadClick} disabled={isLoading}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload .txt file
                </Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
                <CardDescription>The generated summary will appear here. Save it to create reminders.</CardDescription>
              </CardHeader>
              <CardContent className="min-h-[150px]">
                {isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                ) : summary ? (
                  <p className="text-sm whitespace-pre-wrap font-sans">{summary}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">No summary generated yet.</p>
                )}
              </CardContent>
              {summary && !isLoading && (
                  <CardFooter>
                      <Button onClick={handleSaveSummary}><Save className="mr-2 h-4 w-4" />Save Summary</Button>
                  </CardFooter>
              )}
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="saved" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Saved Summaries</CardTitle>
              <CardDescription>Review your previously saved summaries.</CardDescription>
            </CardHeader>
            <CardContent>
              {savedSummaries.length > 0 ? (
                <Accordion type="single" collapsible className="w-full">
                  {savedSummaries.map((item) => (
                    <AccordionItem value={item.id} key={item.id} id={`summary-item-${item.id}`}>
                      <AccordionTrigger>
                        <div className="flex justify-between w-full pr-4 items-center">
                          <span>Summary from {format(new Date(item.timestamp), "PPP p")}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="p-4 bg-muted/50 rounded-md">
                        <h4 className="font-semibold mb-2">Summary:</h4>
                        <p className="text-sm whitespace-pre-wrap mb-4 font-sans">{item.summary}</p>
                        <h4 className="font-semibold mb-2 mt-4">Original Transcript:</h4>
                        <p className="text-xs whitespace-pre-wrap mb-4 font-sans bg-background p-2 rounded-md">{item.transcript}</p>
                        <Button variant="destructive" size="sm" onClick={() => handleDeleteSummary(item.id)}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </Button>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <p className="text-sm text-muted-foreground">No saved summaries.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="reminders" className="mt-6">
          <div className="grid grid-cols-1 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Set a Manual Reminder</CardTitle>
                <CardDescription>Add a new reminder for items not in a summary.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Reminder details..."
                  value={reminderText}
                  onChange={(e) => setReminderText(e.target.value)}
                />
                 <div className="flex flex-col sm:flex-row gap-2">
                    <Popover>
                        <PopoverTrigger asChild>
                        <Button variant={"outline"} className="w-full justify-start text-left font-normal hover:bg-accent hover:text-accent-foreground">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {reminderDate ? format(reminderDate, "PPP") : <span>Pick a date</span>}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={reminderDate} onSelect={setReminderDate} initialFocus />
                        </PopoverContent>
                    </Popover>
                    <div className="relative w-full">
                        <Button variant="outline" className="w-full justify-start text-left font-normal hover:bg-accent hover:text-accent-foreground" onClick={() => timeInputRef.current?.showPicker()}>
                          <div className="time-picker-loader mr-2"></div>
                           {reminderTime ? reminderTime : <span>Pick a time</span>}
                        </Button>
                        <Input
                            ref={timeInputRef}
                            type="time"
                            value={reminderTime}
                            onChange={(e) => setReminderTime(e.target.value)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                    </div>
                 </div>
                <Select onValueChange={setManualReminderSummaryId} value={manualReminderSummaryId}>
                    <SelectTrigger className="hover:bg-accent hover:text-accent-foreground">
                        <SelectValue placeholder="Link to a saved summary (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                        {savedSummaries.map(s => (
                            <SelectItem key={s.id} value={s.id} className="hover:bg-accent hover:text-accent-foreground">Summary from {format(new Date(s.timestamp), "PPP")}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
              </CardContent>
              <CardFooter>
                <Button onClick={handleAddReminder}><Bell className="mr-2 h-4 w-4" />Add Reminder</Button>
              </CardFooter>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Your Reminders</CardTitle>
                <CardDescription>All your upcoming and past reminders.</CardDescription>
              </CardHeader>
              <CardContent>
                {reminders.length > 0 ? (
                  <ul className="space-y-3">
                    {reminders.map((reminder) => (
                      <li key={reminder.id} className="flex items-center justify-between p-3 rounded-md border bg-card hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3 flex-1">
                          <Checkbox
                            id={`reminder-${reminder.id}`}
                            checked={reminder.completed}
                            onCheckedChange={() => handleToggleReminder(reminder.id, reminder.completed)}
                          />
                          <div className="flex-1">
                            <label htmlFor={`reminder-${reminder.id}`} className={cn("font-medium cursor-pointer", reminder.completed && "line-through text-muted-foreground")}>{reminder.text}</label>
                            <p className={cn("text-sm text-muted-foreground", reminder.completed && "line-through")}>
                              {format(new Date(reminder.remindAt), "PPP p")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center">
                          {reminder.summaryId && (
                            <Button variant="ghost" size="icon" onClick={() => handleReminderLinkClick(reminder.summaryId)} title="Go to summary" className="hover:bg-accent hover:text-accent-foreground">
                                <LinkIcon className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteReminder(reminder.id)} title="Delete reminder" className="hover:bg-destructive/10 hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No reminders set.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
