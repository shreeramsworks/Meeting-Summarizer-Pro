"use client";

import { useState, useEffect } from "react";
import type { SummaryHistoryItem, Reminder } from "@/lib/types";
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
import { FileText, History, Bell, Calendar as CalendarIcon, Trash2, Loader2, Send } from "lucide-react";
import { format } from "date-fns";

const WEBHOOK_URL = "https://adapted-mentally-chimp.ngrok-free.app/webhook-test/meetingsummerize";

export default function MeetingSummarizer() {
  const { toast } = useToast();
  const [transcript, setTranscript] = useState("");
  const [summary, setSummary] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<SummaryHistoryItem[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [reminderText, setReminderText] = useState("");
  const [reminderDate, setReminderDate] = useState<Date | undefined>();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    try {
      const storedHistory = localStorage.getItem("meeting_history");
      if (storedHistory) {
        setHistory(JSON.parse(storedHistory));
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
        localStorage.setItem("meeting_history", JSON.stringify(history));
    }
  }, [history, isMounted]);

  useEffect(() => {
    if(isMounted) {
        localStorage.setItem("meeting_reminders", JSON.stringify(reminders));
    }
  }, [reminders, isMounted]);

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
      const newHistoryItem: SummaryHistoryItem = {
        id: new Date().toISOString(),
        transcript,
        summary: result.summary,
        timestamp: Date.now(),
      };
      setHistory([newHistoryItem, ...history]);
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

  const handleAddReminder = () => {
    if (!reminderText.trim() || !reminderDate) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please provide both text and a date for the reminder.",
      });
      return;
    }
    const newReminder: Reminder = {
      id: new Date().toISOString(),
      text: reminderText,
      remindAt: reminderDate.getTime(),
    };
    setReminders([newReminder, ...reminders].sort((a,b) => a.remindAt - b.remindAt));
    setReminderText("");
    setReminderDate(undefined);
  };

  const handleDeleteHistory = (id: string) => {
    setHistory(history.filter((item) => item.id !== id));
  };

  const handleDeleteReminder = (id: string) => {
    setReminders(reminders.filter((item) => item.id !== id));
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

      <Tabs defaultValue="summarizer" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="summarizer"><FileText className="mr-2 h-4 w-4" />Summarizer</TabsTrigger>
          <TabsTrigger value="history"><History className="mr-2 h-4 w-4" />History</TabsTrigger>
          <TabsTrigger value="reminders"><Bell className="mr-2 h-4 w-4" />Reminders</TabsTrigger>
        </TabsList>
        <TabsContent value="summarizer" className="mt-6">
          <div className="grid grid-cols-1 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Upload Transcript</CardTitle>
                <CardDescription>Paste your meeting transcript below to get a summary.</CardDescription>
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
              <CardFooter>
                <Button onClick={handleSummarize} disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  {isLoading ? 'Summarizing...' : 'Summarize'}
                </Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
                <CardDescription>The generated summary will appear here.</CardDescription>
              </CardHeader>
              <CardContent className="min-h-[150px]">
                {isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                ) : summary ? (
                  <p className="text-sm whitespace-pre-wrap">{summary}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">No summary generated yet.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="history" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Past Summaries</CardTitle>
              <CardDescription>Review your previously generated summaries.</CardDescription>
            </CardHeader>
            <CardContent>
              {history.length > 0 ? (
                <Accordion type="single" collapsible className="w-full">
                  {history.map((item) => (
                    <AccordionItem value={item.id} key={item.id}>
                      <AccordionTrigger>
                        <div className="flex justify-between w-full pr-4 items-center">
                          <span>Summary from {format(new Date(item.timestamp), "PPP p")}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="p-4 bg-muted/50 rounded-md">
                        <h4 className="font-semibold mb-2">Summary:</h4>
                        <p className="text-sm whitespace-pre-wrap mb-4">{item.summary}</p>
                        <Button variant="destructive" size="sm" onClick={() => handleDeleteHistory(item.id)}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </Button>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <p className="text-sm text-muted-foreground">No history available.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="reminders" className="mt-6">
          <div className="grid grid-cols-1 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Set a Reminder</CardTitle>
                <CardDescription>Add a new reminder for your action items.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Reminder details..."
                  value={reminderText}
                  onChange={(e) => setReminderText(e.target.value)}
                />
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
                        <div>
                          <p className="font-medium">{reminder.text}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(reminder.remindAt), "PPP")}
                          </p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteReminder(reminder.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
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
