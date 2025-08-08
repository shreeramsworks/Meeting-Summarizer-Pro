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
import { FileText, Save, Bell, Calendar as CalendarIcon, Trash2, Loader2, Send, Upload, Link as LinkIcon, Clock } from "lucide-react";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


const WEBHOOK_URL = "https://adapted-mentally-chimp.ngrok-free.app/webhook-test/meetingsummerize";

export default function MeetingSummarizer() {
  const { toast } = useToast();
  const [transcript, setTranscript] = useState("");
  const [summary, setSummary] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [savedSummaries, setSavedSummaries] = useState<SummaryItem[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [reminderText, setReminderText] = useState("");
  const [reminderDate, setReminderDate] = useState<Date | undefined>();
  const [reminderTime, setReminderTime] = useState("");
  const [manualReminderSummaryId, setManualReminderSummaryId] = useState<string | undefined>();
  const [isMounted, setIsMounted] = useState(false);
  const [activeTab, setActiveTab] = useState("summarizer");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsMounted(true);
    try {
      const storedSummaries = localStorage.getItem("saved_summaries");
      if (storedSummaries) {
        setSavedSummaries(JSON.parse(storedSummaries));
      }
      const storedReminders = localStorage.getItem("meeting_reminders");
      if (storedReminders) {
        setReminders(JSON.parse(storedReminders));
      }
    } catch (error) {
      console.error("Failed to parse from localStorage", error);
    }
  }, []);

  useEffect(() => {
    if(isMounted) {
        localStorage.setItem("saved_summaries", JSON.stringify(savedSummaries));
    }
  }, [savedSummaries, isMounted]);

  useEffect(() => {
    if(isMounted) {
        localStorage.setItem("meeting_reminders", JSON.stringify(reminders));
    }
  }, [reminders, isMounted]);

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

  const handleSaveSummary = () => {
    if (!summary) return;

    const newSummaryItem: SummaryItem = {
        id: new Date().toISOString(),
        transcript,
        summary,
        timestamp: Date.now(),
    };
    
    setSavedSummaries([newSummaryItem, ...savedSummaries]);

    // Parse action items and create reminders
    const actionItemsRegex = /Action Items:\n(  - .+\n)+/g;
    const itemRegex = /  - (.*) \(Assignee: (.*), Due: (.*)\)/g;
    const actionItemsMatch = summary.match(actionItemsRegex);
    
    if (actionItemsMatch) {
      const newReminders: Reminder[] = [];
      let match;
      while ((match = itemRegex.exec(actionItemsMatch[0])) !== null) {
          const [, task, assignee, dueDate] = match;
          const reminderDate = new Date(dueDate);
          if (!isNaN(reminderDate.getTime())) {
              newReminders.push({
                  id: new Date().toISOString() + task,
                  text: `${task} (Assigned to: ${assignee})`,
                  remindAt: reminderDate.getTime(),
                  summaryId: newSummaryItem.id,
              });
          }
      }
      setReminders(prev => [...prev, ...newReminders].sort((a,b) => a.remindAt - b.remindAt));
    }

    toast({
        title: "Success",
        description: "Summary saved and reminders created for action items.",
    });
  };

  const handleAddReminder = () => {
    if (!reminderText.trim() || !reminderDate) {
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

    const newReminder: Reminder = {
      id: new Date().toISOString(),
      text: reminderText,
      remindAt: finalReminderDate.getTime(),
      summaryId: manualReminderSummaryId || "manual",
    };
    setReminders([newReminder, ...reminders].sort((a,b) => a.remindAt - b.remindAt));
    setReminderText("");
    setReminderDate(undefined);
    setReminderTime("");
    setManualReminderSummaryId(undefined);
  };

  const handleDeleteSummary = (id: string) => {
    setSavedSummaries(savedSummaries.filter((item) => item.id !== id));
    // Also delete associated reminders
    setReminders(reminders.filter(r => r.summaryId !== id));
  };

  const handleDeleteReminder = (id: string) => {
    setReminders(reminders.filter((item) => item.id !== id));
  };
  
  const handleReminderLinkClick = (summaryId: string) => {
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


  if (!isMounted) {
    return (
      <div className="flex justify-center items-center min-h-screen">
          <Loader2 className="h-16 w-16 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <header className="flex items-center gap-4 mb-8">
        <FileText className="h-10 w-10 text-primary" />
        <div>
          <h1 className="text-3xl font-bold font-headline">Meeting Summarizer Pro</h1>
          <p className="text-muted-foreground">Your AI-powered meeting assistant</p>
        </div>
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
                <Button onClick={handleSummarize} disabled={isLoading}>
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
                        <Button variant={"outline"} className="w-full justify-start text-left font-normal">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {reminderDate ? format(reminderDate, "PPP") : <span>Pick a date</span>}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={reminderDate} onSelect={setReminderDate} initialFocus />
                        </PopoverContent>
                    </Popover>
                    <div className="relative w-full sm:w-auto">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="time"
                            value={reminderTime}
                            onChange={(e) => setReminderTime(e.target.value)}
                            className="pl-10 w-full"
                        />
                    </div>
                 </div>
                <Select onValueChange={setManualReminderSummaryId} value={manualReminderSummaryId}>
                    <SelectTrigger>
                        <SelectValue placeholder="Link to a saved summary (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                        {savedSummaries.map(s => (
                            <SelectItem key={s.id} value={s.id}>Summary from {format(new Date(s.timestamp), "PPP")}</SelectItem>
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
                      <li key={reminder.id} className="flex items-center justify-between p-3 rounded-md border bg-card">
                        <div className="flex-1">
                          <p className="font-medium">{reminder.text}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(reminder.remindAt), "PPP p")}
                          </p>
                        </div>
                        <div className="flex items-center">
                          {reminder.summaryId !== "manual" && (
                            <Button variant="ghost" size="icon" onClick={() => handleReminderLinkClick(reminder.summaryId)}>
                                <LinkIcon className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteReminder(reminder.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
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
