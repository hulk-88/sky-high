
// src/lib/support-ticket-storage.ts
"use client";

import type { SupportTicket, SupportMessageAttachment, SupportTicketCleanupInterval, SupportTicketMessage } from "@/types";
import { getSiteSettings } from "./site-settings-storage";

const SUPPORT_TICKETS_KEY = "skyhigh_support_tickets_v1";
const MAX_MESSAGES_PER_SENDER = 6;

export function getAllSupportTickets(): SupportTicket[] {
  if (typeof window === "undefined") return [];
  const storedTickets = localStorage.getItem(SUPPORT_TICKETS_KEY);
  try {
    const allTickets: SupportTicket[] = storedTickets ? JSON.parse(storedTickets) : [];
    // Sort by updatedAt descending (newest first)
    return allTickets.sort((a,b) => b.updatedAt - a.updatedAt);
  } catch (error) {
    console.error("Error loading support tickets from storage:", error);
    return [];
  }
}

function saveSupportTickets(tickets: SupportTicket[]): void {
  if (typeof window === "undefined") return;

  const settings = getSiteSettings();
  const cleanupInterval = settings.supportTicketCleanupInterval;
  let staleThresholdMs: number | null = null;

  switch (cleanupInterval) {
    case '7_days':
      staleThresholdMs = 7 * 24 * 60 * 60 * 1000;
      break;
    case '1_month':
      // Approximation: Using 30 days for a month
      staleThresholdMs = 30 * 24 * 60 * 60 * 1000;
      break;
    case '5_months':
      // Approximation: Using 5 * 30 days for 5 months
      staleThresholdMs = 5 * 30 * 24 * 60 * 60 * 1000;
      break;
    case 'never':
      staleThresholdMs = null; // No cleanup
      break;
    default:
      // Fallback to 7 days if interval is unrecognized
      staleThresholdMs = 7 * 24 * 60 * 60 * 1000;
  }

  let ticketsToSave = tickets;
  if (staleThresholdMs !== null) {
    const cutoffTimestamp = Date.now() - staleThresholdMs;
    // Filter tickets based on their creation date
    ticketsToSave = tickets.filter(ticket => ticket.createdAt >= cutoffTimestamp);
  }
  try {
    localStorage.setItem(SUPPORT_TICKETS_KEY, JSON.stringify(ticketsToSave));
  } catch (error) {
    console.error("Error saving support tickets to storage:", error);
    // Potentially handle quota exceeded or other storage errors here
  }
}

export function getTicketMessageCounts(ticket: SupportTicket): { userMessages: number; adminMessages: number } {
    let userMessages = 0;
    let adminMessages = 0;
    if (ticket && ticket.messages) { // Add null check for ticket and messages
        ticket.messages.forEach(msg => {
            if (msg.sender === 'user') userMessages++;
            else if (msg.sender === 'admin') adminMessages++;
        });
    }
    return { userMessages, adminMessages };
}

export function addSupportTicket(data: {
  userId: string;
  userEmail: string;
  initialMessage: string;
  attachments?: SupportMessageAttachment[];
  subject?: string; // Subject is optional
}): { ticket: SupportTicket | null, error?: string } {
  if (!data.userId || !data.userEmail) {
    return { ticket: null, error: "User ID and Email are required."};
  }
  const now = Date.now();
  
  const newTicket: SupportTicket = {
    id: `ticket_${now}_${Math.random().toString(36).substring(2, 9)}`,
    userId: data.userId,
    userEmail: data.userEmail,
    subject: data.subject || `Support Request - ${new Date(now).toLocaleDateString()}`, // Default subject
    messages: [
      {
        id: `msg_${now}`,
        sender: 'user',
        text: data.initialMessage,
        attachments: data.attachments || [], // Default to empty array
        timestamp: now,
      },
      { // Automatic system reply
        id: `msg_${now + 1}`,
        sender: 'system',
        text: 'سيتم الاجابه علي مشكلتك قريبا شكرا لك', // Updated system message
        timestamp: now + 1,
        attachments: [], // System message has no attachments
      }
    ],
    status: 'pending_admin_reply',
    createdAt: now,
    updatedAt: now,
  };

  const tickets = getAllSupportTickets(); 
  tickets.unshift(newTicket); 
  saveSupportTickets(tickets); 
  return { ticket: newTicket };
}

export function addMessageToTicket(ticketId: string, message: {
    sender: 'user' | 'admin';
    text: string;
    attachments?: SupportMessageAttachment[];
}): { ticket: SupportTicket | null, error?: string } {
    let tickets = getAllSupportTickets();
    const ticketIndex = tickets.findIndex(t => t.id === ticketId);
    if (ticketIndex === -1) return { ticket: null, error: "Ticket not found."};

    const currentTicket = tickets[ticketIndex];
    if (!currentTicket) return { ticket: null, error: "Ticket data is inconsistent."};


    const { userMessages, adminMessages } = getTicketMessageCounts(currentTicket);

    if (message.sender === 'user' && userMessages >= MAX_MESSAGES_PER_SENDER) {
        return { ticket: null, error: `User message limit (${MAX_MESSAGES_PER_SENDER}) reached for this ticket.` };
    }
    if (message.sender === 'admin' && adminMessages >= MAX_MESSAGES_PER_SENDER) {
        return { ticket: null, error: `Admin message limit (${MAX_MESSAGES_PER_SENDER}) reached for this ticket.` };
    }
    
    const now = Date.now();
    currentTicket.messages.push({
        id: `msg_${now}`,
        sender: message.sender,
        text: message.text,
        attachments: message.attachments || [], // Default to empty array
        timestamp: now,
    });
    currentTicket.status = message.sender === 'user' ? 'pending_admin_reply' : 'pending_user_reply';
    currentTicket.updatedAt = now;

    saveSupportTickets(tickets);
    const updatedTickets = getAllSupportTickets(); 
    return { ticket: updatedTickets.find(t => t.id === ticketId) || null };
}

export function updateTicketStatus(ticketId: string, status: SupportTicket['status']): SupportTicket | null {
    let tickets = getAllSupportTickets();
    const ticketIndex = tickets.findIndex(t => t.id === ticketId);
    if (ticketIndex === -1) return null;

    if (!tickets[ticketIndex]) return null; // Should not happen if index is valid

    tickets[ticketIndex].status = status;
    tickets[ticketIndex].updatedAt = Date.now();
    saveSupportTickets(tickets);
    const updatedTickets = getAllSupportTickets();
    return updatedTickets.find(t => t.id === ticketId) || null;
}


export function getTicketsRequiringAdminReplyCount(): number {
  if (typeof window === "undefined") return 0;
  const tickets = getAllSupportTickets();
  return tickets.filter(ticket => ticket.status === 'open' || ticket.status === 'pending_admin_reply').length;
}

export function getTicketsWithNewRepliesForUserCount(userId: string): number {
  if (typeof window === "undefined" || !userId) return 0;
  const tickets = getAllSupportTickets();
  return tickets.filter(ticket => ticket.userId === userId && ticket.status === 'pending_user_reply').length;
}

