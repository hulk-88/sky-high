
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Info } from "lucide-react";
import { useState, useEffect } from "react";
import { getLoggedInUser, canUserWithdrawBasedOnReferrals, calculateUserDailyWithdrawalLimit } from "@/lib/user-auth";
import { useToast } from "@/hooks/use-toast";

const withdrawFormSchema = z.object({
  amount: z.coerce.number().positive({ message: "Amount must be positive." }),
  address: z.string()
    .min(34, { message: "TRC20 address must be 34 characters."})
    .max(34, { message: "TRC20 address must be 34 characters."})
    .startsWith("T", { message: "TRC20 address must start with 'T'."}),
});

type WithdrawFormValues = z.infer<typeof withdrawFormSchema>;

interface WithdrawDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onWithdraw: (amount: number, address: string) => Promise<boolean>;
}

export function WithdrawDialog({ isOpen, onOpenChange, onWithdraw }: WithdrawDialogProps) {
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<import("@/types").User | null>(null);
  const [canWithdraw, setCanWithdraw] = useState(false);
  const [dailyLimit, setDailyLimit] = useState(0);

  useEffect(() => {
    setIsClient(true);
    if (isOpen) {
      const user = getLoggedInUser();
      setCurrentUser(user);
      if (user) {
        const canProceed = canUserWithdrawBasedOnReferrals(user);
        setCanWithdraw(canProceed);
        if (canProceed) {
          const limit = calculateUserDailyWithdrawalLimit(user);
          setDailyLimit(limit);
        } else {
          setDailyLimit(0);
        }
      } else {
        setCanWithdraw(false);
        setDailyLimit(0);
      }
    }
  }, [isOpen]);

  const form = useForm<WithdrawFormValues>({
    resolver: zodResolver(withdrawFormSchema),
    defaultValues: {
      amount: 10, 
      address: "",
    },
  });

  const onSubmit = async (data: WithdrawFormValues) => {
    if (!currentUser || !canWithdraw) {
      toast({ title: "Withdrawal Error", description: "Withdrawal conditions not met.", variant: "destructive" });
      return;
    }
    if (data.amount > dailyLimit) {
      form.setError("amount", { message: `Amount exceeds your daily limit of ${dailyLimit.toFixed(2)} USDT.` });
      return;
    }
    if (data.amount > currentUser.balance) {
        form.setError("amount", { message: "Withdrawal amount cannot exceed your balance." });
        return;
    }

    const success = await onWithdraw(data.amount, data.address);
    if (success) {
      // Refresh user data and limits after successful request submission
      const updatedUser = getLoggedInUser();
      setCurrentUser(updatedUser);
      if (updatedUser) {
        const canStillWithdraw = canUserWithdrawBasedOnReferrals(updatedUser);
        setCanWithdraw(canStillWithdraw);
        setDailyLimit(canStillWithdraw ? calculateUserDailyWithdrawalLimit(updatedUser) : 0);
      }
      form.reset({ amount: 10, address: '' }); // Reset form, keep default amount or clear
    }
  };
  
  if (!isClient) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) form.reset(); // Reset form on close
    }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-2xl">Withdraw USDT (TRC20)</DialogTitle>
          <DialogDescription>
            Enter the amount and your TRC20 USDT address to withdraw funds. Withdrawal subject to referral conditions and daily limits.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {!currentUser ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>You must be logged in to withdraw.</AlertDescription>
            </Alert>
          ) : !canWithdraw ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Withdrawal Locked</AlertTitle>
              <AlertDescription>
                You need at least 5 successful referrals (each referred user must deposit at least $50) to enable withdrawals.
                You currently have {currentUser.successfulReferralsCount || 0} successful referrals.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <Alert variant="default" className="mb-4 bg-primary/10 border-primary/30">
                <Info className="h-4 w-4 text-primary" />
                <AlertTitle className="text-primary">Withdrawal Information</AlertTitle>
                <AlertDescription>
                  Your current daily withdrawal limit is <strong>${dailyLimit.toFixed(2)} USDT</strong> (15% of your balance, if eligible).
                  Your balance is <strong>${currentUser.balance.toFixed(2)} USDT</strong>.
                </AlertDescription>
              </Alert>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">Amount to Withdraw</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="Enter amount" {...field} className="h-12 text-base"/>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">Your TRC20 USDT Address</FormLabel>
                        <FormControl>
                          <Input type="text" placeholder="Starts with T..." {...field} className="h-12 text-base"/>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => {onOpenChange(false); form.reset();}}>Cancel</Button>
                    <Button type="submit" disabled={form.formState.isSubmitting || dailyLimit <= 0}>
                      {form.formState.isSubmitting ? "Processing..." : "Request Withdrawal"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

