
"use client";

import { useState, useEffect, useCallback } from "react";
import type { AdminTransaction, TransactionStatus, User, AdminSiteSettings } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Hourglass, Search, ArrowDownToLine, ArrowUpFromLine, Loader2, Eye, Image as ImageIcon, AlertTriangle, Gift, PartyPopper, Info } from "lucide-react";
import { format } from 'date-fns';
import { cn } from "@/lib/utils";
import { updateUserBalance, getUsers, processApprovedDepositForReferral, recordUserWithdrawal } from "@/lib/user-auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
// import { ScrollArea } from "@/components/ui/scroll-area"; // Temporarily commented out
import { getSiteSettings, defaultSiteSettings } from "@/lib/site-settings-storage";
import { getAllTransactions, updateTransactionInStorage } from "@/lib/transaction-storage";

const statusIcons: Record<TransactionStatus, React.ElementType> = {
  pending: Hourglass,
  approved: CheckCircle,
  rejected: XCircle,
};

const statusColors: Record<TransactionStatus, string> = {
  pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-700/30 dark:text-yellow-300 border-yellow-300 dark:border-yellow-600",
  approved: "bg-green-100 text-green-700 dark:bg-green-700/30 dark:text-green-300 border-green-300 dark:border-green-600",
  rejected: "bg-red-100 text-red-700 dark:bg-red-700/30 dark:text-red-300 border-red-300 dark:border-red-600",
};

const typeIcons: Record<AdminTransaction['type'], React.ElementType | null> = {
    deposit: ArrowDownToLine,
    withdrawal: ArrowUpFromLine,
    bet: Info,
    win: CheckCircle,
    bet_lost: XCircle,
    referral_bonus: Gift,
    new_player_bonus: PartyPopper,
    admin_credit: CheckCircle,
    spin_win: Gift,
};

const typeColors: Record<AdminTransaction['type'], string> = {
    deposit: "text-green-500",
    withdrawal: "text-red-500",
    bet: "text-blue-500",
    win: "text-accent",
    bet_lost: "text-destructive",
    referral_bonus: "text-yellow-500",
    new_player_bonus: "text-pink-500",
    admin_credit: "text-purple-500",
    spin_win: "text-orange-500",
};


export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<TransactionStatus | "all">("all");
  const [selectedTransactionForConfirmation, setSelectedTransactionForConfirmation] = useState<AdminTransaction | null>(null);
  const [confirmationAction, setConfirmationAction] = useState<'approve' | 'reject' | null>(null);
  const { toast } = useToast();
  const [siteSettings, setSiteSettings] = useState<AdminSiteSettings>(defaultSiteSettings);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const fetchTransactionsAndSettings = useCallback(async () => {
    setIsLoadingData(true);
    setTransactions(getAllTransactions());
    setSiteSettings(getSiteSettings());
    setIsLoadingData(false);
  }, []);

  useEffect(() => {
    if (isClient) {
      fetchTransactionsAndSettings();
      const intervalId = setInterval(fetchTransactionsAndSettings, 3000);
      return () => clearInterval(intervalId);
    }
  }, [isClient, fetchTransactionsAndSettings]);

  useEffect(() => {
    if (isClient) {
      const handleStorageChange = (event: StorageEvent) => {
        if (event.key === "skyhigh_site_settings_v2" || event.key === "skyhigh_admin_transactions_v1") {
          fetchTransactionsAndSettings();
        }
      };
      window.addEventListener('storage', handleStorageChange);
      return () => window.removeEventListener('storage', handleStorageChange);
    }
  }, [isClient, fetchTransactionsAndSettings]);


  const openConfirmationDialog = (txn: AdminTransaction, action: 'approve' | 'reject') => {
    setSelectedTransactionForConfirmation(txn);
    setConfirmationAction(action);
  };

  const closeConfirmationDialog = () => {
    setSelectedTransactionForConfirmation(null);
    setConfirmationAction(null);
  };

  const confirmUpdateStatus = () => {
    if (!selectedTransactionForConfirmation || !confirmationAction) return;
    handleUpdateStatus(selectedTransactionForConfirmation, confirmationAction === 'approve' ? 'approved' : 'rejected');
    closeConfirmationDialog();
  };

  const handleUpdateStatus = (txnToUpdate: AdminTransaction, newStatus: TransactionStatus) => {
    const updatedTxn = { ...txnToUpdate };
    updatedTxn.status = newStatus;
    updatedTxn.processedBy = "CurrentAdmin"; 
    updatedTxn.processedAt = Date.now();

    let platformCommissionAmount = 0;
    let amountToCreditUser = updatedTxn.amount; 

    if (newStatus === 'approved' && updatedTxn.userEmail) {
      const users = getUsers();
      const userIndex = users.findIndex(u => u.email === updatedTxn.userEmail);

      if (userIndex !== -1) {
        const userToUpdate = users[userIndex];
        let newBalance = userToUpdate.balance;

        if (updatedTxn.type === 'deposit') {
          const PLATFORM_DEPOSIT_COMMISSION_RATE = siteSettings.platformDepositFeePercent / 100;
          platformCommissionAmount = parseFloat((updatedTxn.amount * PLATFORM_DEPOSIT_COMMISSION_RATE).toFixed(2));
          amountToCreditUser = parseFloat((updatedTxn.amount - platformCommissionAmount).toFixed(2));
          
          newBalance += amountToCreditUser;
          updatedTxn.commissionApplied = platformCommissionAmount;
          updatedTxn.amountCredited = amountToCreditUser;

          let toastMessages: { title: string; description: string; variant?: "default" | "destructive" | "success"; icon?: React.ReactNode, duration?: number }[] = [];

          const referralResult = processApprovedDepositForReferral(
            updatedTxn.userEmail,
            updatedTxn.amount 
          );

          toastMessages.push({
            title: `Deposit Approved & Balance Updated`,
            description: `${userToUpdate.email}'s balance increased by ${amountToCreditUser.toFixed(2)} USDT (after ${platformCommissionAmount.toFixed(2)} USDT platform commission). New balance: ${newBalance.toFixed(2)} USDT.`,
            variant: "success",
          });

          if (referralResult.bonusCreditedToReferrer && referralResult.referrerEmail && referralResult.bonusAmountToReferrer && referralResult.depositingUserUsername) {
            updatedTxn.referredUserBonusAppliedTo = referralResult.referrerEmail;
            updatedTxn.referralBonusToReferrerAmount = referralResult.bonusAmountToReferrer;
            const maskedDepositorUsername = referralResult.depositingUserUsername.substring(0, 2) + '...';
            const percentageText = referralResult.referralBonusPercentageApplied ? ` (${referralResult.referralBonusPercentageApplied}%)` : '';
            toastMessages.push({
              title: "Referrer Bonus Processed!",
              description: `Referrer ${referralResult.referrerEmail} received ${referralResult.bonusAmountToReferrer.toFixed(2)} USDT${percentageText} commission from a deposit by ${maskedDepositorUsername}. (Bonus calculated on gross deposit of ${updatedTxn.amount.toFixed(2)} USDT).`,
              icon: <Gift className="h-5 w-5 text-accent-foreground" />,
              variant: "success",
              duration: 8000,
            });
          }
          if (referralResult.newPlayerBonusCreditedToDepositor && referralResult.newPlayerBonusAmount) {
            updatedTxn.newPlayerBonusToDepositingUserAmount = referralResult.newPlayerBonusAmount;
            const potentiallyUpdatedDepositor = getUsers().find(u => u.email === updatedTxn.userEmail);
            const finalBalanceForToast = potentiallyUpdatedDepositor ? potentiallyUpdatedDepositor.balance : newBalance;

            toastMessages.push({
              title: "New Player Bonus!",
              description: `User ${updatedTxn.userEmail} received a ${referralResult.newPlayerBonusAmount.toFixed(2)} USDT new player bonus! Their balance is now ${finalBalanceForToast.toFixed(2)} USDT.`,
              icon: <PartyPopper className="h-5 w-5 text-accent-foreground" />,
              variant: "success",
              duration: 8000,
            });
          }

          const balanceUpdated = updateUserBalance(userToUpdate.email, newBalance); 
          if (!balanceUpdated) {
            toastMessages.push({ title: "Balance Update Failed", description: "Could not update user balance for deposit.", variant: "destructive" });
          }
          toastMessages.forEach(msg => toast(msg));

        } else if (updatedTxn.type === 'withdrawal') {
          newBalance -= updatedTxn.amount;
          if (newBalance < 0) {
            toast({ title: "Error", description: "Withdrawal exceeds balance. Transaction auto-rejected.", variant: "destructive" });
            updatedTxn.status = 'rejected'; 
            updateTransactionInStorage(updatedTxn);
            fetchTransactionsAndSettings();
            return;
          }
          recordUserWithdrawal(userToUpdate.email, updatedTxn.amount); 
          const balanceUpdated = updateUserBalance(userToUpdate.email, newBalance);
          if (balanceUpdated) {
            toast({
              title: `Withdrawal Approved & Balance Updated`,
              description: `${userToUpdate.email}'s balance is now ${newBalance.toFixed(2)} USDT.`,
              variant: "success",
              duration: 7000,
            });
          } else {
            toast({ title: "Balance Update Failed", description: "Could not update user balance for withdrawal.", variant: "destructive" });
          }
        }
      } else {
        toast({ title: "User Not Found", description: `User ${updatedTxn.userEmail} not found. Cannot update balance.`, variant: "destructive" });
      }
    } else if (newStatus === 'rejected') {
      toast({
        title: `Transaction Rejected`,
        description: `Transaction ID ${updatedTxn.id.substring(0, 12)}... has been rejected.`,
        variant: "default",
      });
    }

    updateTransactionInStorage(updatedTxn);
    fetchTransactionsAndSettings();
  };

  const filteredTransactions = transactions.filter(txn => {
    const searchTermLower = searchTerm.toLowerCase();
    const matchesSearch = (txn.userEmail?.toLowerCase() || '').includes(searchTermLower) ||
      txn.id.toLowerCase().includes(searchTermLower) ||
      (txn.address?.toLowerCase() || '').includes(searchTermLower);
    const matchesStatus = filterStatus === "all" || txn.status === filterStatus;
    return matchesSearch && matchesStatus;
  });


  if (!isClient) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-muted-foreground">Initializing page...</p>
      </div>
    );
  }

  if (isLoadingData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-muted-foreground">Loading transactions...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-primary">Transaction Management</h1>

      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <CardTitle className="text-xl">All Transactions</CardTitle>
            <div className="flex gap-2 items-center w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search Email, Txn ID, Address..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as TransactionStatus | "all")}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* <ScrollArea className="h-[calc(100vh-20rem)]"> */}
            <div className="h-[calc(100vh-20rem)] overflow-auto"> {/* Replace ScrollArea with a simple div with overflow-auto */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID / Type</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead className="text-right">Amount (USDT)</TableHead>
                  <TableHead>Details / Notes</TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.length > 0 ? filteredTransactions.map((txn) => {
                  const StatusIcon = statusIcons[txn.status];
                  const TypeIcon = typeIcons[txn.type];
                  return (
                    <TableRow key={txn.id} className={cn(txn.status === 'pending' && (txn.type === 'deposit' || txn.type === 'withdrawal') && 'bg-yellow-500/10 dark:bg-yellow-700/10')}>
                      <TableCell>
                        <div className="font-medium">{txn.id.substring(0, 12)}...</div>
                        <div className={cn("text-xs text-muted-foreground flex items-center", typeColors[txn.type])}>
                          {TypeIcon && <TypeIcon className="h-3 w-3 mr-1" />}
                          {txn.type.charAt(0).toUpperCase() + txn.type.slice(1).replace(/_/g, ' ')}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{txn.userEmail || txn.userId}</TableCell>
                      <TableCell className="text-right font-mono">
                        <div>{txn.amount.toFixed(2)}</div>
                        {txn.type === 'deposit' && txn.status === 'approved' && txn.commissionApplied !== undefined && (
                          <div className="text-xs text-orange-500" title="Platform Commission">Comm: {txn.commissionApplied.toFixed(2)}</div>
                        )}
                        {txn.type === 'deposit' && txn.status === 'approved' && txn.amountCredited !== undefined && (
                          <div className="text-xs text-green-600 dark:text-green-400" title="Net Amount Credited to User">Net: {txn.amountCredited.toFixed(2)}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                        <div className="flex flex-col gap-0.5">
                          {txn.type === 'withdrawal' ? (
                            <span title={txn.address}>{txn.address}</span>
                          ) : txn.transferProofImage && txn.type === 'deposit' ? (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="link" size="sm" className="p-0 h-auto text-xs self-start">
                                  <ImageIcon className="h-4 w-4 mr-1" /> View Proof
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-md">
                                <DialogHeader>
                                  <DialogTitle>Transfer Proof for Txn: {txn.id.substring(0, 12)}...</DialogTitle>
                                  <DialogDescription>User: {txn.userEmail}, Amount: {txn.amount.toFixed(2)} USDT</DialogDescription>
                                </DialogHeader>
                                <div className="mt-4 max-h-[70vh] overflow-auto rounded-md border">
                                  <img src={txn.transferProofImage} alt="Transfer Proof" className="rounded-md w-full h-auto object-contain" data-ai-hint="payment receipt" />
                                </div>
                              </DialogContent>
                            </Dialog>
                          ) : txn.notes ? (
                             <span className="text-foreground italic" title={txn.notes}>{txn.notes}</span>
                          ) : txn.outcomeMultiplier ? (
                             <span className="text-foreground">Multiplier: {txn.outcomeMultiplier.toFixed(2)}x</span>
                          ) : <span className="self-start">-</span>}

                          {txn.referredUserBonusAppliedTo && txn.referralBonusToReferrerAmount != null && (
                            <div className="text-xs text-green-600 dark:text-green-400 flex items-center" title={`Referrer ${txn.referredUserBonusAppliedTo} earned ${txn.referralBonusToReferrerAmount.toFixed(2)} USDT`}>
                              <Gift className="h-3 w-3 mr-1" /> Referrer: +{txn.referralBonusToReferrerAmount.toFixed(2)} to {txn.referredUserBonusAppliedTo.substring(0, txn.referredUserBonusAppliedTo.indexOf('@'))}
                            </div>
                          )}
                          {txn.newPlayerBonusToDepositingUserAmount != null && (
                            <div className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center" title={`Depositor ${txn.userEmail} earned ${txn.newPlayerBonusToDepositingUserAmount.toFixed(2)} USDT new player bonus`}>
                              <PartyPopper className="h-3 w-3 mr-1" /> New Player Bonus: +{txn.newPlayerBonusToDepositingUserAmount.toFixed(2)}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div>{format(new Date(txn.timestamp), "MMM d, yyyy HH:mm")}</div>
                        {txn.processedAt && <div className="text-muted-foreground">Processed: {format(new Date(txn.processedAt), "HH:mm")} by {txn.processedBy}</div>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-xs capitalize font-normal min-w-[90px] justify-center", statusColors[txn.status])}>
                          <StatusIcon className="h-3 w-3 mr-1.5" />
                          {txn.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {txn.status === "pending" && (txn.type === 'deposit' || txn.type === 'withdrawal') && (
                          <div className="flex gap-1 justify-center">
                            <Button variant="ghost" size="sm" className="text-green-600 hover:text-green-700 hover:bg-green-100 dark:hover:bg-green-900/30 h-8 px-2" onClick={() => openConfirmationDialog(txn, "approve")} title="Approve Transaction">
                              <CheckCircle className="h-4 w-4 mr-1" /> Approve
                            </Button>
                            <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/30 h-8 px-2" onClick={() => openConfirmationDialog(txn, "reject")} title="Reject Transaction">
                              <XCircle className="h-4 w-4 mr-1" /> Reject
                            </Button>
                          </div>
                        )}
                        {txn.status !== "pending" && (txn.type === 'deposit' || txn.type === 'withdrawal') && <span className="text-xs text-muted-foreground italic">Processed</span>}
                        {(txn.type !== 'deposit' && txn.type !== 'withdrawal') && <span className="text-xs text-muted-foreground italic">-</span>}
                      </TableCell>
                    </TableRow>
                  );
                }) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No transactions found matching your criteria.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </div>
          {/* </ScrollArea> */}
        </CardContent>
      </Card>

      {selectedTransactionForConfirmation && confirmationAction && (
        <Dialog open={!!selectedTransactionForConfirmation} onOpenChange={closeConfirmationDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-xl flex items-center">
                <AlertTriangle className={`mr-2 h-6 w-6 ${confirmationAction === 'approve' ? 'text-green-500' : 'text-red-500'}`} />
                Confirm {confirmationAction === 'approve' ? 'Approval' : 'Rejection'}
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to {confirmationAction} this transaction?
                <br />
                ID: {selectedTransactionForConfirmation.id.substring(0, 12)}... <br />
                User: {selectedTransactionForConfirmation.userEmail} <br />
                Amount: {selectedTransactionForConfirmation.amount.toFixed(2)} USDT <br />
                Type: {selectedTransactionForConfirmation.type.charAt(0).toUpperCase() + selectedTransactionForConfirmation.type.slice(1)}
              </DialogDescription>
              {confirmationAction === 'approve' && selectedTransactionForConfirmation.type === 'deposit' && (
                <div className="mt-2 space-y-1 text-sm p-3 border rounded-md bg-muted/50">
                  <div className="text-foreground">
                    A {(siteSettings.platformDepositFeePercent).toFixed(siteSettings.platformDepositFeePercent % 1 === 0 ? 0 : 1)}% platform commission 
                    ({ (selectedTransactionForConfirmation.amount * (siteSettings.platformDepositFeePercent / 100)).toFixed(2) } USDT) will be applied.
                  </div>
                  <div className="font-semibold">
                    User will receive: { (selectedTransactionForConfirmation.amount * (1 - (siteSettings.platformDepositFeePercent / 100))).toFixed(2) } USDT.
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Referral bonuses (to referrer and new player, if applicable based on total deposit value of {selectedTransactionForConfirmation.amount.toFixed(2)} USDT and settings) will also be processed.
                  </div>
                </div>
              )}
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0 mt-4">
              <Button variant="outline" onClick={closeConfirmationDialog}>Cancel</Button>
              <Button
                variant={confirmationAction === 'reject' ? 'destructive' : 'default'}
                onClick={confirmUpdateStatus}
                className={cn(confirmationAction === 'approve' && 'bg-green-600 hover:bg-green-700 text-white')}
              >
                {confirmationAction === 'approve' ? <CheckCircle className="mr-2 h-4 w-4" /> : <XCircle className="mr-2 h-4 w-4" />}
                Confirm {confirmationAction.charAt(0).toUpperCase() + confirmationAction.slice(1)}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
