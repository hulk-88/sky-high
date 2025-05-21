
"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare } from "lucide-react";
import { SupportChatDialog } from "./SupportChatDialog";
import type { User } from "@/types";
import { getTicketsWithNewRepliesForUserCount } from "@/lib/support-ticket-storage";

interface SupportChatButtonProps {
  user: User;
}

export function SupportChatButton({ user }: SupportChatButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newRepliesCount, setNewRepliesCount] = useState(0);

  const fetchNewRepliesCount = useCallback(() => {
    if (user && user.id) { // Check for user.id as well
      const count = getTicketsWithNewRepliesForUserCount(user.id);
      setNewRepliesCount(count);
    } else {
      setNewRepliesCount(0);
    }
  }, [user]);

  useEffect(() => {
    fetchNewRepliesCount();
    const intervalId = setInterval(fetchNewRepliesCount, 7000); // Check every 7 seconds

    const handleStorageChange = (event: StorageEvent) => {
        if (event.key === "skyhigh_support_tickets_v1") {
            fetchNewRepliesCount();
        }
    };
    if (typeof window !== 'undefined') { // Ensure window exists
        window.addEventListener('storage', handleStorageChange);
    }

    return () => {
        clearInterval(intervalId);
        if (typeof window !== 'undefined') { // Ensure window exists for cleanup
            window.removeEventListener('storage', handleStorageChange);
        }
    }
  }, [fetchNewRepliesCount]);

  return (
    <>
      <div className="mt-6 flex justify-center">
        <Button 
            variant="outline" 
            onClick={() => setIsDialogOpen(true)} 
            className="text-lg py-6 px-8 shadow-md hover:shadow-lg transition-shadow relative"
        >
          <MessageSquare className="mr-2 h-5 w-5" />
          Support Chat
          {newRepliesCount > 0 && (
            <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 px-1.5 text-xs animate-pulse">
              {newRepliesCount}
            </Badge>
          )}
        </Button>
      </div>
      {isDialogOpen && user && ( // Ensure user is passed and is not null/undefined
        <SupportChatDialog
          isOpen={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          user={user}
        />
      )}
    </>
  );
}
