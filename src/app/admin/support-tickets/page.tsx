
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { SupportTicket, SupportMessageAttachment } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Eye, MessageSquare, Send, Paperclip, Inbox, RefreshCw, UserCircle, CheckCircle, AlertCircle, X, FileImage, UploadCloud } from "lucide-react"; // Changed ImageIcon to FileImage
import { format } from 'date-fns';
import { cn } from "@/lib/utils";
import { getAllSupportTickets, addMessageToTicket, updateTicketStatus, getTicketMessageCounts } from "@/lib/support-ticket-storage";

const statusColors: Record<SupportTicket['status'], string> = {
  open: "bg-blue-100 text-blue-700 dark:bg-blue-700/30 dark:text-blue-300 border-blue-300 dark:border-blue-600",
  pending_admin_reply: "bg-yellow-100 text-yellow-700 dark:bg-yellow-700/30 dark:text-yellow-300 border-yellow-300 dark:border-yellow-600",
  pending_user_reply: "bg-orange-100 text-orange-700 dark:bg-orange-700/30 dark:text-orange-300 border-orange-300 dark:border-orange-600",
  closed: "bg-gray-100 text-gray-700 dark:bg-gray-700/30 dark:text-gray-400 border-gray-300 dark:border-gray-600",
};

const MAX_ADMIN_ATTACHMENTS = 4;
const MAX_FILE_SIZE_MB = 2;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export default function AdminSupportTicketsPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [adminAttachments, setAdminAttachments] = useState<File[]>([]);
  const adminFileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const fetchTickets = useCallback(() => {
    setIsLoading(true);
    const allTickets = getAllSupportTickets().sort((a,b) => b.updatedAt - a.createdAt); // Show newest first
    setTickets(allTickets);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchTickets();
    const intervalId = setInterval(fetchTickets, 5000); // Refresh tickets every 5 seconds
    return () => clearInterval(intervalId);
  }, [fetchTickets]);
  
  const handleViewTicket = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setReplyMessage(""); 
    setAdminAttachments([]);
    if (adminFileInputRef.current) adminFileInputRef.current.value = "";
  };

  const handleCloseDialog = () => {
    setSelectedTicket(null);
    setReplyMessage("");
    setAdminAttachments([]);
    if (adminFileInputRef.current) adminFileInputRef.current.value = "";
  };

  const handleAdminFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
        const newFilesArray = Array.from(files);
        let currentFiles = [...adminAttachments];

        for (const file of newFilesArray) {
            if (currentFiles.length >= MAX_ADMIN_ATTACHMENTS) {
                toast({ title: "Attachment Limit", description: `You can attach a maximum of ${MAX_ADMIN_ATTACHMENTS} images.`, variant: "destructive" });
                break;
            }
            if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
                toast({ title: "Invalid File Type", description: `${file.name} is not a supported image type.`, variant: "destructive" });
                continue;
            }
            if (file.size > MAX_FILE_SIZE_BYTES) {
                toast({ title: "File Too Large", description: `${file.name} exceeds the ${MAX_FILE_SIZE_MB}MB size limit.`, variant: "destructive" });
                continue;
            }
            currentFiles.push(file);
        }
        setAdminAttachments(currentFiles.slice(0, MAX_ADMIN_ATTACHMENTS));
    }
  };

  const removeAdminFile = (fileName: string) => {
    setAdminAttachments(prev => prev.filter(file => file.name !== fileName));
    if (adminFileInputRef.current) adminFileInputRef.current.value = ""; // Allow re-selecting same file if removed
  };


  const handleSendReply = async () => {
    if (!selectedTicket || !replyMessage.trim()) {
      toast({ title: "Cannot Send", description: "Reply message cannot be empty.", variant: "destructive" });
      return;
    }

    const { adminMessages } = getTicketMessageCounts(selectedTicket);
    if (adminMessages >= 6) {
        toast({ title: "Message Limit Reached", description: "You have reached the maximum of 6 replies for this ticket.", variant: "destructive" });
        return;
    }

    const attachmentPromises: Promise<SupportMessageAttachment>[] = adminAttachments.map(file => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve({ name: file.name, type: file.type, dataUrl: reader.result as string });
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
    });
    
    try {
        const attachments = await Promise.all(attachmentPromises);
        const result = addMessageToTicket(selectedTicket.id, {
          sender: 'admin',
          text: replyMessage,
          attachments: attachments,
        });

        if (result.ticket) {
          toast({ title: "Reply Sent", description: "Your reply has been sent to the user." });
          setSelectedTicket(result.ticket); 
          setReplyMessage("");
          setAdminAttachments([]);
          if (adminFileInputRef.current) adminFileInputRef.current.value = "";
          fetchTickets(); 
        } else {
          toast({ title: "Error Sending Reply", description: result.error || "Failed to send reply.", variant: "destructive" });
        }
    } catch (error) {
        console.error("Error processing admin attachments:", error);
        toast({ title: "Attachment Error", description: "Could not process attachments. Please try again.", variant: "destructive"});
    }
  };
  
  const handleChangeTicketStatus = (ticketId: string, status: SupportTicket['status']) => {
    const updated = updateTicketStatus(ticketId, status);
    if (updated) {
        toast({ title: "Status Updated", description: `Ticket status changed to ${status.replace(/_/g, ' ')}.`});
        fetchTickets(); 
        if (selectedTicket && selectedTicket.id === ticketId) {
            setSelectedTicket(updated); 
        }
    } else {
        toast({ title: "Error", description: "Failed to update ticket status.", variant: "destructive"});
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
            <h1 className="text-3xl font-bold text-primary flex items-center"><MessageSquare className="mr-3 h-8 w-8"/>Support Tickets</h1>
            <p className="text-muted-foreground">View and respond to user support requests.</p>
        </div>
        <Button onClick={fetchTickets} variant="outline" disabled={isLoading}>
            <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
            Refresh Tickets
        </Button>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl">All Tickets</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && tickets.length === 0 ? (
             <div className="text-center py-10 text-muted-foreground">
                <RefreshCw className="mx-auto h-8 w-8 animate-spin mb-2" />
                Loading support tickets...
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
                <Inbox className="mx-auto h-12 w-12 mb-2" />
                <p className="text-lg">No support tickets found.</p>
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-20rem)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket ID</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Last Message Preview</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.map((ticket) => (
                    <TableRow key={ticket.id} className={cn(ticket.status === 'pending_admin_reply' && 'bg-yellow-500/10 dark:bg-yellow-700/10')}>
                      <TableCell className="font-mono text-xs">{ticket.id.substring(0,15)}...</TableCell>
                      <TableCell>{ticket.userEmail}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                        {ticket.messages[ticket.messages.length -1]?.text || "No message content"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-xs capitalize font-normal min-w-[120px] justify-center", statusColors[ticket.status])}>
                            {ticket.status.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{format(new Date(ticket.updatedAt), "MMM d, yyyy HH:mm")}</TableCell>
                      <TableCell className="text-center">
                        <Button variant="outline" size="sm" onClick={() => handleViewTicket(ticket)}>
                          <Eye className="mr-2 h-4 w-4" /> View / Reply
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {selectedTicket && (
        <Dialog open={!!selectedTicket} onOpenChange={(open) => !open && handleCloseDialog()}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl">Ticket: {selectedTicket.id.substring(0,15)}...</DialogTitle>
              <DialogDescription>User: {selectedTicket.userEmail} | Status: <span className={cn("font-semibold", statusColors[selectedTicket.status].split(" ")[1])}>{selectedTicket.status.replace(/_/g, ' ')}</span></DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-[300px] border rounded-md p-4 my-4 space-y-4 bg-muted/30">
              {selectedTicket.messages.map((msg) => (
                <div key={msg.id} className={cn("p-3 rounded-lg shadow-sm max-w-[85%]", msg.sender === 'user' ? "bg-card ml-auto text-right" : "bg-primary/10 mr-auto text-left")}>
                  <p className="text-xs text-muted-foreground mb-1">
                    {msg.sender === 'user' ? <UserCircle className="inline h-4 w-4 mr-1" /> : msg.sender === 'admin' ? <CheckCircle className="inline h-4 w-4 mr-1 text-primary" /> : <AlertCircle className="inline h-4 w-4 mr-1 text-muted-foreground" /> }
                    {msg.sender.toUpperCase()} - {format(new Date(msg.timestamp), "MMM d, HH:mm")}
                  </p>
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mt-2 space-y-1 border-t pt-2">
                      <p className="text-xs font-medium">Attachments:</p>
                      {msg.attachments.map((att, index) => (
                        <div key={index} className="my-1">
                            <a href={att.dataUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline flex items-center gap-1 mb-1">
                                <FileImage className="h-3 w-3" /> {att.name} ({(att.dataUrl.length * 0.75 / (1024*1024)).toFixed(2)} MB)
                            </a>
                            {att.type.startsWith('image/') && (
                                <img src={att.dataUrl} alt={att.name} className="max-w-xs max-h-40 rounded-md border object-contain" data-ai-hint="user attachment"/>
                            )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </ScrollArea>
            {selectedTicket.status !== 'closed' && (
                <>
                    <Textarea
                        value={replyMessage}
                        onChange={(e) => setReplyMessage(e.target.value)}
                        placeholder="Type your reply..."
                        rows={3}
                        className="mb-2"
                        disabled={getTicketMessageCounts(selectedTicket).adminMessages >= 6}
                    />
                    {getTicketMessageCounts(selectedTicket).adminMessages >= 6 && (
                        <p className="text-xs text-destructive mb-2">Admin message limit (6) reached for this ticket.</p>
                    )}

                    {/* Admin Attachments */}
                    <div className="mb-2">
                        <label htmlFor="admin-attachments" className="text-sm font-medium text-muted-foreground block mb-1">Attach Images (Up to {MAX_ADMIN_ATTACHMENTS}, {MAX_FILE_SIZE_MB}MB each)</label>
                        <Input
                            id="admin-attachments"
                            type="file"
                            multiple
                            accept={ALLOWED_IMAGE_TYPES.join(",")}
                            onChange={handleAdminFileChange}
                            ref={adminFileInputRef}
                            className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                            disabled={adminAttachments.length >= MAX_ADMIN_ATTACHMENTS || getTicketMessageCounts(selectedTicket).adminMessages >= 6}
                        />
                        {adminAttachments.length > 0 && (
                            <div className="mt-2 space-y-1">
                            {adminAttachments.map(file => (
                                <div key={file.name} className="flex items-center justify-between text-xs p-1 bg-muted rounded">
                                    <span className="truncate max-w-[200px]">{file.name}</span>
                                    <Button type="button" variant="ghost" size="xs" onClick={() => removeAdminFile(file.name)}><X className="h-3 w-3"/></Button>
                                </div>
                            ))}
                            </div>
                        )}
                    </div>
                    
                    <DialogFooter className="gap-2 sm:gap-0 flex-col sm:flex-row sm:justify-between items-stretch">
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => handleChangeTicketStatus(selectedTicket.id, selectedTicket.status === 'closed' ? 'pending_admin_reply' : 'closed')}>
                                {selectedTicket.status === 'closed' ? 'Re-open Ticket' : 'Close Ticket'}
                            </Button>
                             {selectedTicket.status === 'pending_admin_reply' && (
                                <Button variant="outline" onClick={() => handleChangeTicketStatus(selectedTicket.id, 'pending_user_reply')}>
                                    Mark as Awaiting User
                                </Button>
                            )}
                        </div>
                        <Button onClick={handleSendReply} disabled={!replyMessage.trim() || getTicketMessageCounts(selectedTicket).adminMessages >= 6}>
                            <Send className="mr-2 h-4 w-4" /> Send Reply
                        </Button>
                    </DialogFooter>
                </>
            )}
             {selectedTicket.status === 'closed' && (
                 <Button variant="outline" onClick={() => handleChangeTicketStatus(selectedTicket.id, 'pending_admin_reply')} className="w-full">
                    Re-open Ticket
                </Button>
             )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

    