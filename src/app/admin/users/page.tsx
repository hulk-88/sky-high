
"use client";

import { useState, useEffect } from "react";
import type { User, AdminTransaction, ReferredUserDetail } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { UserCheck, UserX, Search, Loader2, Users, Eye, ArrowDownToLine, PlusCircle } from "lucide-react";
import { format, parseISO } from 'date-fns';
import { getAllUsersForAdmin, updateUserBlockStatus as updateUserBlockStatusInDb, getReferralStatsForUser, calculateUserDailyWithdrawalLimit, adminAddFundsToUser } from "@/lib/user-auth";
import { addBlockedUser, removeBlockedUser } from "@/lib/user-status";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useForm } from "react-hook-form";


interface UserWithReferralStats extends User {
  calculatedSuccessfulReferrals: number;
  totalReferredUsersDepositAmount: number;
  calculatedDailyWithdrawalLimit: number;
  detailedReferredUsers: ReferredUserDetail[];
}

const addFundsFormSchema = z.object({
  amount: z.coerce.number().positive({ message: "Amount must be positive." }).min(0.01, {message: "Minimum amount is 0.01 USDT."}),
});
type AddFundsFormValues = z.infer<typeof addFundsFormSchema>;


export default function AdminUsersPage() {
  const [usersWithStats, setUsersWithStats] = useState<UserWithReferralStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  const [isAddFundsDialogOpen, setIsAddFundsDialogOpen] = useState(false);
  const [selectedUserForAddFunds, setSelectedUserForAddFunds] = useState<User | null>(null);

  const addFundsForm = useForm<AddFundsFormValues>({
    resolver: zodResolver(addFundsFormSchema),
    defaultValues: {
      amount: 10,
    },
  });


  const fetchAndProcessUsers = () => {
    setIsLoading(true);
    const fetchedUsers = getAllUsersForAdmin();

    const processedUsers = fetchedUsers.map(user => {
      const referralStats = getReferralStatsForUser(user.email); 
      const dailyLimit = calculateUserDailyWithdrawalLimit(user); 
      return {
        ...user,
        calculatedSuccessfulReferrals: referralStats.successfulReferrals,
        totalReferredUsersDepositAmount: referralStats.totalReferredUsersDepositAmount,
        calculatedDailyWithdrawalLimit: dailyLimit,
        detailedReferredUsers: referralStats.detailedReferredUsers || [],
      };
    });

    setUsersWithStats(processedUsers);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchAndProcessUsers();
    const intervalId = setInterval(fetchAndProcessUsers, 5000); 
    return () => clearInterval(intervalId);
  }, []);


  const handleToggleBlock = (userId: string, userEmail: string, currentBlockStatus: boolean) => {
    const newBlockStatus = !currentBlockStatus;
    const success = updateUserBlockStatusInDb(userEmail, newBlockStatus);

    if (success) {
      // Legacy update, can be removed if fully deprecated
      if (newBlockStatus) addBlockedUser(userEmail); else removeBlockedUser(userEmail);
      
      fetchAndProcessUsers(); // Refetch to update derived stats like withdrawal limit
      toast({
        title: `User ${newBlockStatus ? "Blocked" : "Unblocked"}`,
        description: `${userEmail} has been ${newBlockStatus ? "blocked" : "unblocked"}.`,
      });
    } else {
       toast({
        title: "Update Failed",
        description: `Could not update block status for ${userEmail}.`,
        variant: "destructive",
      });
    }
  };
  
  const openAddFundsDialog = (user: User) => {
    setSelectedUserForAddFunds(user);
    addFundsForm.reset({ amount: 10 });
    setIsAddFundsDialogOpen(true);
  };

  const handleAddFundsSubmit = (data: AddFundsFormValues) => {
    if (!selectedUserForAddFunds) return;

    const result = adminAddFundsToUser(selectedUserForAddFunds.email, data.amount);
    if (result.success) {
      toast({
        title: "Funds Added",
        description: result.message,
      });
      fetchAndProcessUsers(); // Refresh user list and balances
      setIsAddFundsDialogOpen(false);
      // Consider adding a client-side toast for the user if a notification system exists
    } else {
      toast({
        title: "Failed to Add Funds",
        description: result.message,
        variant: "destructive",
      });
    }
  };


  const filteredUsers = usersWithStats.filter(user =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary">User Management</h1>
          <p className="text-muted-foreground">View, search, manage users, and monitor referral performance.</p>
        </div>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <CardTitle className="text-xl">All Users</CardTitle>
            <div className="flex gap-2 items-center w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search Username or Email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-3 text-lg text-muted-foreground">Loading users...</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User (Username/Email)</TableHead>
                  <TableHead className="text-right">Balance (USDT)</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Referral Code</TableHead>
                  <TableHead className="text-center">Referrals (Met Thresh.)</TableHead>
                  <TableHead className="text-right">Daily Withdrawal Limit (USDT)</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length > 0 ? filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                        <div className="font-medium">{user.username}</div>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                    </TableCell>
                    <TableCell className="text-right">{user.balance.toFixed(2)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(parseISO(user.joinedDate), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{user.referralCode}</TableCell>
                    <TableCell className="text-center">
                      {user.calculatedSuccessfulReferrals}
                       <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="link" size="xs" className="ml-1 p-0 h-auto text-xs" disabled={!user.detailedReferredUsers || user.detailedReferredUsers.length === 0}>
                               <Eye className="h-3 w-3 mr-1" /> View ({user.detailedReferredUsers?.length || 0})
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-lg">
                            <DialogHeader>
                              <DialogTitle>Referred Users by {user.username}</DialogTitle>
                              <DialogDescription>Total referred: {user.detailedReferredUsers?.length || 0}, Successful (met deposit threshold): {user.calculatedSuccessfulReferrals}</DialogDescription>
                            </DialogHeader>
                            {(user.detailedReferredUsers && user.detailedReferredUsers.length > 0) ? (
                              <ScrollArea className="h-[200px] mt-2 border rounded-md p-2">
                                <ul className="space-y-1 text-sm">
                                  {user.detailedReferredUsers.map(refUser => (
                                    <li key={refUser.userId} className={`p-1 rounded ${refUser.metMinimumDepositThreshold ? 'bg-green-100 dark:bg-green-900/30' : 'bg-slate-100 dark:bg-slate-700/30'}`}>
                                      {refUser.email} - Joined: {format(parseISO(refUser.joinedDate), "MMM d, yy")} - Deposited: ${refUser.totalDepositedApproved.toFixed(2)}
                                      {refUser.metMinimumDepositThreshold && <span className="text-green-600 font-semibold ml-1">(Threshold Met)</span>}
                                    </li>
                                  ))}
                                </ul>
                              </ScrollArea>
                            ) : <p className="text-sm text-muted-foreground text-center py-4">No users referred yet.</p>}
                          </DialogContent>
                        </Dialog>
                    </TableCell>
                     <TableCell className="text-right font-mono">
                      {user.isBlocked ? "0.00" : user.calculatedDailyWithdrawalLimit.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        user.isBlocked ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      }`}>
                        {user.isBlocked ? "Blocked" : "Active"}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <Switch
                          id={`block-switch-${user.id}`}
                          checked={user.isBlocked}
                          onCheckedChange={() => handleToggleBlock(user.id, user.email, user.isBlocked)}
                          aria-label={user.isBlocked ? "Unblock user" : "Block user"}
                        />
                        <Label htmlFor={`block-switch-${user.id}`} className="sr-only">
                          {user.isBlocked ? "Unblock" : "Block"} User
                        </Label>
                         <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleBlock(user.id, user.email, user.isBlocked)}
                            title={user.isBlocked ? "Unblock User" : "Block User"}
                          >
                            {user.isBlocked ? <UserCheck className="h-4 w-4 text-green-500" /> : <UserX className="h-4 w-4 text-red-500" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openAddFundsDialog(user)}
                            title="Add Funds to User"
                          >
                            <PlusCircle className="h-4 w-4 text-blue-500" />
                          </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No users found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Funds Dialog */}
      {selectedUserForAddFunds && (
        <Dialog open={isAddFundsDialogOpen} onOpenChange={setIsAddFundsDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Funds to {selectedUserForAddFunds.username}</DialogTitle>
              <DialogDescription>
                Enter the amount of USDT to add to this user's balance. This amount will be playable but not directly withdrawable by the user through automated systems.
              </DialogDescription>
            </DialogHeader>
            <Form {...addFundsForm}>
              <form onSubmit={addFundsForm.handleSubmit(handleAddFundsSubmit)} className="space-y-4 py-4">
                <FormField
                  control={addFundsForm.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount (USDT)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="Enter amount" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsAddFundsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={addFundsForm.formState.isSubmitting}>
                    {addFundsForm.formState.isSubmitting ? "Adding..." : "Add Funds"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
