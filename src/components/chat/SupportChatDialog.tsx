
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Send, Paperclip, X, FileImage, MessageSquarePlus, ArrowLeft, Eye, UserCircle, CheckCircle } from "lucide-react";
import type { User, SupportTicket, SupportMessageAttachment } from "@/types";
import { addSupportTicket, getAllSupportTickets, addMessageToTicket, getTicketMessageCounts } from "@/lib/support-ticket-storage";
import { format } from 'date-fns';
import { cn } from "@/lib/utils";

const MAX_FILES_PER_MESSAGE = 4;
const MAX_FILE_SIZE_MB = 2;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_MESSAGES_PER_SENDER_TOTAL = 6; // Max 6 messages from user, 6 from admin per ticket

const newTicketFormSchema = z.object({
  message: z.string().min(10, { message: "Message must be at least 10 characters." }).max(1000, { message: "Message cannot exceed 1000 characters." }),
  attachments: z.custom<FileList | null>((val) => val === null || val instanceof FileList, "Invalid file list")
    .refine((files) => !files || files.length <= MAX_FILES_PER_MESSAGE, `You can upload a maximum of ${MAX_FILES_PER_MESSAGE} images per message.`)
    .refine((files) => {
      if (!files) return true;
      for (let i = 0; i < files.length; i++) {
        if (files[i].size > MAX_FILE_SIZE_BYTES) return false;
      }
      return true;
    }, `Each file must be ${MAX_FILE_SIZE_MB}MB or less.`)
    .refine((files) => {
      if (!files) return true;
      for (let i = 0; i < files.length; i++) {
        if (!ALLOWED_IMAGE_TYPES.includes(files[i].type)) return false;
      }
      return true;
    }, "Only JPEG, PNG, GIF, and WEBP images are allowed.")
    .nullable(),
});
type NewTicketFormValues = z.infer<typeof newTicketFormSchema>;

const replyFormSchema = z.object({
  replyText: z.string().min(1, { message: "Reply cannot be empty." }).max(1000, { message: "Reply cannot exceed 1000 characters." }),
});
type ReplyFormValues = z.infer<typeof replyFormSchema>;


interface SupportChatDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  user: User;
}

const statusColors: Record<SupportTicket['status'], string> = {
  open: "bg-blue-100 text-blue-700 dark:bg-blue-700/30 dark:text-blue-300 border-blue-300 dark:border-blue-600",
  pending_admin_reply: "bg-yellow-100 text-yellow-700 dark:bg-yellow-700/30 dark:text-yellow-300 border-yellow-300 dark:border-yellow-600",
  pending_user_reply: "bg-orange-100 text-orange-700 dark:bg-orange-700/30 dark:text-orange-300 border-orange-300 dark:border-orange-600",
  closed: "bg-gray-100 text-gray-700 dark:bg-gray-700/30 dark:text-gray-400 border-gray-300 dark:border-gray-600",
};


export function SupportChatDialog({ isOpen, onOpenChange, user }: SupportChatDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [viewMode, setViewMode] = useState<'list' | 'view_ticket' | 'create_ticket'>('list');
  const [userTickets, setUserTickets] = useState<SupportTicket[]>([]);
  const [selectedTicketForViewing, setSelectedTicketForViewing] = useState<SupportTicket | null>(null);
  
  // For new ticket form
  const [newTicketAttachments, setNewTicketAttachments] = useState<File[]>([]);
  const newTicketFileInputRef = useRef<HTMLInputElement>(null);
  
  // For replying to existing ticket
  const [replyAttachments, setReplyAttachments] = useState<File[]>([]);
  const replyFileInputRef = useRef<HTMLInputElement>(null);

  const newTicketForm = useForm<NewTicketFormValues>({
    resolver: zodResolver(newTicketFormSchema),
    defaultValues: { message: "", attachments: null },
  });

  const replyForm = useForm<ReplyFormValues>({
    resolver: zodResolver(replyFormSchema),
    defaultValues: { replyText: "" },
  });


  const fetchUserTickets = useCallback(() => {
    if (user && user.id) { 
      const allTickets = getAllSupportTickets();
      const filteredTickets = allTickets.filter(t => t.userId === user.id).sort((a,b) => b.updatedAt - a.createdAt);
      setUserTickets(filteredTickets);
      return filteredTickets; // Return the tickets for immediate use
    } else {
      setUserTickets([]); 
      return [];
    }
  }, [user]); 

  useEffect(() => {
    if (isOpen) {
      // Reset forms and common states immediately
      setSelectedTicketForViewing(null);
      newTicketForm.reset();
      setNewTicketAttachments([]);
      if (newTicketFileInputRef.current) newTicketFileInputRef.current.value = "";
      replyForm.reset();
      setReplyAttachments([]);
      if (replyFileInputRef.current) replyFileInputRef.current.value = "";
  
      // Fetch tickets and then set viewMode based on the result
      if (user && user.id) {
        const fetchedUserTickets = fetchUserTickets(); 
  
        if (fetchedUserTickets.length === 0) {
          setViewMode('create_ticket'); 
        } else {
          setViewMode('list'); 
        }
      } else {
        setUserTickets([]);
        setViewMode('create_ticket'); 
      }
    }
  }, [isOpen, user, fetchUserTickets, newTicketForm, replyForm]);


  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>,
    currentFiles: File[],
    setFilesState: React.Dispatch<React.SetStateAction<File[]>>,
    formSetValue: (name: "attachments" | "replyAttachments", value: FileList | null, options?: { shouldValidate?: boolean }) => void, 
    formFieldName: "attachments" | "replyAttachments" 
  ) => {
    const newFilesFromInput = event.target.files;
    if (newFilesFromInput) {
        const newFilesArray = Array.from(newFilesFromInput);
        let updatedFilesList = [...currentFiles];

        for (const file of newFilesArray) {
            if (updatedFilesList.length >= MAX_FILES_PER_MESSAGE) {
                toast({ title: "Attachment Limit", description: `Max ${MAX_FILES_PER_MESSAGE} images per message.`, variant: "destructive" });
                break;
            }
            if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
                toast({ title: "Invalid File Type", description: `${file.name} unsupported.`, variant: "destructive" });
                continue;
            }
            if (file.size > MAX_FILE_SIZE_BYTES) {
                toast({ title: "File Too Large", description: `${file.name} > ${MAX_FILE_SIZE_MB}MB.`, variant: "destructive" });
                continue;
            }
            updatedFilesList.push(file);
        }
        
        setFilesState(updatedFilesList.slice(0, MAX_FILES_PER_MESSAGE));

        if (formFieldName === "attachments") {
            const dataTransfer = new DataTransfer();
            updatedFilesList.slice(0, MAX_FILES_PER_MESSAGE).forEach(f => dataTransfer.items.add(f));
            (formSetValue as any)("attachments", dataTransfer.files.length > 0 ? dataTransfer.files : null, { shouldValidate: true });
        }
    }
  };

  const removeFile = (
    fileName: string,
    currentFiles: File[],
    setFilesState: React.Dispatch<React.SetStateAction<File[]>>,
    formSetValue: (name: "attachments" | "replyAttachments", value: FileList | null, options?: { shouldValidate?: boolean }) => void,
    formFieldName: "attachments" | "replyAttachments"
  ) => {
    const updatedFiles = currentFiles.filter(file => file.name !== fileName);
    setFilesState(updatedFiles);
    if (formFieldName === "attachments") {
        const dataTransfer = new DataTransfer();
        updatedFiles.forEach(f => dataTransfer.items.add(f));
        (formSetValue as any)("attachments", dataTransfer.files.length > 0 ? dataTransfer.files : null, { shouldValidate: true });
    }
    if (formFieldName === "replyAttachments" && replyFileInputRef.current) { 
        replyFileInputRef.current.value = "";
    }
  };


  const onNewTicketSubmit = async (data: NewTicketFormValues) => {
    setIsSubmitting(true);
    if (!user || !user.id) { 
        toast({ title: "Error", description: "User information is missing.", variant: "destructive" });
        setIsSubmitting(false);
        return;
    }
    const attachmentPromises = newTicketAttachments.map(fileToDataUrl);
    try {
      const attachments = await Promise.all(attachmentPromises);
      const result = addSupportTicket({
        userId: user.id, 
        userEmail: user.email,
        initialMessage: data.message,
        attachments: attachments,
      });

      if (result.ticket) {
        toast({ title: "Ticket Created!", description: "Support will reply soon." });
        newTicketForm.reset();
        setNewTicketAttachments([]);
        if(newTicketFileInputRef.current) newTicketFileInputRef.current.value = "";
        fetchUserTickets(); 
        setViewMode('list'); 
      } else {
        toast({ title: "Failed", description: result.error || "Could not create ticket.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error processing new ticket attachments:", error);
      toast({ title: "Error", description: "Attachment processing failed.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onReplySubmit = async (data: ReplyFormValues) => {
    if (!selectedTicketForViewing) return;
    setIsSubmitting(true);

    const { userMessages } = getTicketMessageCounts(selectedTicketForViewing);
    if (userMessages >= MAX_MESSAGES_PER_SENDER_TOTAL) {
        toast({ title: "Message Limit", description: `You can send max ${MAX_MESSAGES_PER_SENDER_TOTAL} messages per ticket.`, variant: "destructive" });
        setIsSubmitting(false);
        return;
    }

    const attachmentPromises = replyAttachments.map(fileToDataUrl);
    try {
      const attachments = await Promise.all(attachmentPromises);
      const result = addMessageToTicket(selectedTicketForViewing.id, {
        sender: 'user',
        text: data.replyText,
        attachments: attachments,
      });

      if (result.ticket) {
        toast({ title: "Reply Sent!" });
        replyForm.reset();
        setReplyAttachments([]);
        if(replyFileInputRef.current) replyFileInputRef.current.value = "";
        setSelectedTicketForViewing(result.ticket); 
        fetchUserTickets(); 
      } else {
        toast({ title: "Failed", description: result.error || "Could not send reply.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error processing reply attachments:", error);
      toast({ title: "Error", description: "Attachment processing failed for reply.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const fileToDataUrl = (file: File): Promise<SupportMessageAttachment> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve({ name: file.name, type: file.type, dataUrl: reader.result as string });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };
  
  const handleDialogClose = () => {
    onOpenChange(false); 
  };


  return (
    <Dialog open={isOpen} onOpenChange={handleDialogClose}>
      <DialogContent className="sm:max-w-lg md:max-w-xl lg:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {viewMode === 'list' && "Your Support Tickets"}
            {viewMode === 'create_ticket' && "Create New Support Ticket"}
            {viewMode === 'view_ticket' && selectedTicketForViewing && `Ticket: ${selectedTicketForViewing.id.substring(0,15)}...`}
          </DialogTitle>
          {viewMode === 'create_ticket' && 
            <DialogDescription>
             Send a message to our support team. You can attach up to {MAX_FILES_PER_MESSAGE} images per message (max {MAX_FILE_SIZE_MB}MB each). You can send up to {MAX_MESSAGES_PER_SENDER_TOTAL} messages per ticket. Your message will be sent to the admin panel.
            </DialogDescription>
          }
           {viewMode === 'view_ticket' && selectedTicketForViewing &&
            <DialogDescription>
                Status: <span className={cn("font-semibold", statusColors[selectedTicketForViewing.status].split(" ")[1])}>{selectedTicketForViewing.status.replace(/_/g, ' ')}</span>. Max {MAX_MESSAGES_PER_SENDER_TOTAL} messages from you per ticket. You can attach up to {MAX_FILES_PER_MESSAGE} images per message.
            </DialogDescription>
           }
        </DialogHeader>

        {(viewMode === 'create_ticket' || viewMode === 'view_ticket') && (
            <Button variant="outline" size="sm" onClick={() => {
                setViewMode('list');
                fetchUserTickets(); 
                setSelectedTicketForViewing(null);
                newTicketForm.reset(); setNewTicketAttachments([]); if(newTicketFileInputRef.current) newTicketFileInputRef.current.value = "";
                replyForm.reset(); setReplyAttachments([]); if(replyFileInputRef.current) replyFileInputRef.current.value = "";
            }} className="mb-2 self-start">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Ticket List
            </Button>
        )}

        <div className="flex-grow overflow-y-auto">
            {viewMode === 'list' && (
                <div className="space-y-4">
                <Button onClick={() => setViewMode('create_ticket')} className="w-full sm:w-auto">
                    <MessageSquarePlus className="mr-2 h-4 w-4" /> Create New Ticket
                </Button>
                {userTickets.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">You have no support tickets.</p>
                ) : (
                    <ScrollArea className="h-[calc(60vh-150px)]"> 
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead>Ticket ID / Last Message</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Last Updated</TableHead>
                            <TableHead className="text-center">Actions</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {userTickets.map(ticket => (
                            <TableRow key={ticket.id}>
                            <TableCell>
                                <div className="font-medium text-sm">{ticket.id.substring(0,15)}...</div>
                                <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                                    {ticket.messages[ticket.messages.length -1]?.text || "No message content"}
                                </div>
                            </TableCell>
                            <TableCell>
                                <Badge variant="outline" className={cn("text-xs capitalize font-normal min-w-[120px] text-center justify-center", statusColors[ticket.status])}>
                                    {ticket.status.replace(/_/g, ' ')}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-xs">{format(new Date(ticket.updatedAt), "PPpp")}</TableCell>
                            <TableCell className="text-center">
                                <Button variant="outline" size="sm" onClick={() => { setSelectedTicketForViewing(ticket); setViewMode('view_ticket'); }}>
                                <Eye className="mr-2 h-4 w-4" /> View
                                </Button>
                            </TableCell>
                            </TableRow>
                        ))}
                        </TableBody>
                    </Table>
                    </ScrollArea>
                )}
                </div>
            )}

            {viewMode === 'create_ticket' && (
                <Form {...newTicketForm}>
                <form onSubmit={newTicketForm.handleSubmit(onNewTicketSubmit)} className="space-y-4">
                    <FormField control={newTicketForm.control} name="message" render={({ field }) => (
                        <FormItem>
                        <FormLabel className="text-base">Your Message</FormLabel>
                        <FormControl><Textarea placeholder="Describe your issue..." rows={5} {...field} className="text-base" /></FormControl>
                        <FormMessage />
                        </FormItem>
                    )} />
                    <FormItem>
                        <FormLabel className="text-base">Attachments (Optional, Max ${MAX_FILES_PER_MESSAGE} per message)</FormLabel>
                        <FormControl>
                        <Input id="newTicketAttachments" type="file" multiple accept={ALLOWED_IMAGE_TYPES.join(",")}
                            ref={newTicketFileInputRef}
                            onChange={(e) => handleFileChange(e, newTicketAttachments, setNewTicketAttachments, newTicketForm.setValue, "attachments")}
                            className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                            disabled={newTicketAttachments.length >= MAX_FILES_PER_MESSAGE} />
                        </FormControl>
                        <FormMessage>{newTicketForm.formState.errors.attachments?.message}</FormMessage>
                        {newTicketAttachments.length > 0 && (
                        <div className="mt-2 space-y-1">
                            {newTicketAttachments.map((file) => (
                            <div key={file.name} className="flex items-center justify-between text-xs p-1 bg-muted rounded">
                                <span className="truncate max-w-[200px]">{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                                <Button type="button" variant="ghost" size="xs" onClick={() => removeFile(file.name, newTicketAttachments, setNewTicketAttachments, newTicketForm.setValue, "attachments")}><X className="h-3 w-3"/></Button>
                            </div>))}
                        </div>
                        )}
                    </FormItem>
                    <DialogFooter className="pt-2">
                        <Button type="submit" disabled={isSubmitting || !newTicketForm.formState.isValid}>
                        <Send className="mr-2 h-4 w-4" /> {isSubmitting ? "Sending..." : "Create Ticket"}
                        </Button>
                    </DialogFooter>
                </form>
                </Form>
            )}

            {viewMode === 'view_ticket' && selectedTicketForViewing && (
                <div className="space-y-4">
                    <ScrollArea className="h-[calc(50vh-180px)] border rounded-md p-4 space-y-3 bg-muted/30">
                        {selectedTicketForViewing.messages.map(msg => (
                        <div key={msg.id} className={cn("p-3 rounded-lg shadow-sm max-w-[85%]", msg.sender === 'user' ? "bg-primary/10 ml-auto text-right" : "bg-card mr-auto text-left")}>
                            <p className="text-xs text-muted-foreground mb-1">
                                {msg.sender === 'user' ? <UserCircle className="inline h-4 w-4 mr-1 text-primary" /> : msg.sender === 'admin' ? <CheckCircle className="inline h-4 w-4 mr-1 text-accent" /> : null}
                                {msg.sender.toUpperCase()} - {format(new Date(msg.timestamp), "PP HH:mm")}
                            </p>
                            <p className="whitespace-pre-wrap">{msg.text}</p>
                            {msg.attachments && msg.attachments.length > 0 && (
                                <div className="mt-2 space-y-1 border-t pt-2">
                                <p className="text-xs font-medium">Attachments:</p>
                                {msg.attachments.map((att, index) => (
                                    <div key={index} className="my-1">
                                    <a href={att.dataUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline flex items-center gap-1 mb-1">
                                        <FileImage className="h-3 w-3" /> {att.name}
                                    </a>
                                    {att.type.startsWith('image/') && <img src={att.dataUrl} alt={att.name} className="max-w-xs max-h-40 rounded-md border object-contain" data-ai-hint="message attachment" />}
                                    </div>
                                ))}
                                </div>
                            )}
                        </div>
                        ))}
                    </ScrollArea>
                    
                    {selectedTicketForViewing.status !== 'closed' && getTicketMessageCounts(selectedTicketForViewing).userMessages < MAX_MESSAGES_PER_SENDER_TOTAL && (
                        <Form {...replyForm}>
                        <form onSubmit={replyForm.handleSubmit(onReplySubmit)} className="space-y-3 pt-2">
                            <FormField control={replyForm.control} name="replyText" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-base">Your Reply</FormLabel>
                                <FormControl><Textarea placeholder="Type your reply..." rows={3} {...field} className="text-base" /></FormControl>
                                <FormMessage />
                            </FormItem>
                            )} />
                             <FormItem>
                                <FormLabel className="text-base">Attachments (Optional, Max ${MAX_FILES_PER_MESSAGE} per message)</FormLabel>
                                <FormControl>
                                <Input id="replyAttachments" type="file" multiple accept={ALLOWED_IMAGE_TYPES.join(",")}
                                    ref={replyFileInputRef}
                                    onChange={(e) => handleFileChange(e, replyAttachments, setReplyAttachments, newTicketForm.setValue , "replyAttachments")}
                                    className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                                    disabled={replyAttachments.length >= MAX_FILES_PER_MESSAGE} />
                                </FormControl>
                                {replyAttachments.length > 0 && (
                                <div className="mt-2 space-y-1">
                                    {replyAttachments.map((file) => (
                                    <div key={file.name} className="flex items-center justify-between text-xs p-1 bg-muted rounded">
                                        <span className="truncate max-w-[200px]">{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                                        <Button type="button" variant="ghost" size="xs" onClick={() => removeFile(file.name, replyAttachments, setReplyAttachments, newTicketForm.setValue, "replyAttachments")}><X className="h-3 w-3"/></Button>
                                    </div>))}
                                </div>
                                )}
                            </FormItem>
                            <DialogFooter className="pt-2">
                                <Button type="submit" disabled={isSubmitting || !replyForm.formState.isValid}>
                                <Send className="mr-2 h-4 w-4" /> {isSubmitting ? "Sending..." : "Send Reply"}
                                </Button>
                            </DialogFooter>
                        </form>
                        </Form>
                    )}
                    {selectedTicketForViewing.status === 'closed' && <p className="text-sm text-muted-foreground text-center">This ticket is closed. Create a new ticket if you need further assistance.</p>}
                    {selectedTicketForViewing.status !== 'closed' && getTicketMessageCounts(selectedTicketForViewing).userMessages >= MAX_MESSAGES_PER_SENDER_TOTAL && (
                        <p className="text-sm text-destructive text-center">You have reached the message limit for this ticket.</p>
                    )}
                </div>
            )}
        </div>
        
        {viewMode === 'list' && (
             <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={handleDialogClose}>Close</Button>
            </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}


    
