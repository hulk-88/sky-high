
// src/lib/transaction-storage.ts
"use client";

import type { AdminTransaction, TransactionType } from "@/types";

const TRANSACTIONS_KEY = "skyhigh_admin_transactions_v1";

// No automatic cleanup for transactions as per request "dont remove nothing"

export function loadTransactionsFromStorage(): AdminTransaction[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(TRANSACTIONS_KEY);
  try {
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Error loading transactions from storage:", error);
    return [];
  }
}

export function saveTransactionsToStorage(transactions: AdminTransaction[]): void {
  if (typeof window === "undefined") return;
  // No filtering, save all transactions
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
}

export function addTransaction(
  transactionData: {
    userId: string;
    userEmail?: string;
    type: TransactionType;
    amount: number;
    address?: string;
    transferProofImage?: string;
    outcomeMultiplier?: number;
    notes?: string; // Added notes for more context
  }
): AdminTransaction {
  const newTxn: AdminTransaction = {
    id: `txn_${Date.now()}${Math.random().toString(16).slice(2)}`,
    timestamp: Date.now(),
    status: (transactionData.type === 'bet' || transactionData.type === 'win' || transactionData.type === 'bet_lost' || transactionData.type === 'referral_bonus' || transactionData.type === 'new_player_bonus' || transactionData.type === 'admin_credit' || transactionData.type === 'spin_win') ? 'approved' : 'pending',
    userId: transactionData.userId,
    userEmail: transactionData.userEmail,
    type: transactionData.type,
    amount: transactionData.amount,
    address: transactionData.address,
    transferProofImage: transactionData.transferProofImage,
    outcomeMultiplier: transactionData.outcomeMultiplier,
    notes: transactionData.notes, // Store notes
  };
  
  if (transactionData.type === 'spin_win') {
    newTxn.notes = newTxn.notes || `Spin & Win prize: ${transactionData.amount.toFixed(2)} USDT`;
  }

  const transactions = loadTransactionsFromStorage();
  transactions.unshift(newTxn); // Add to the beginning of the array
  saveTransactionsToStorage(transactions);
  return newTxn;
}

export function updateTransactionInStorage(updatedTxn: AdminTransaction): AdminTransaction | null {
    const transactions = loadTransactionsFromStorage();
    const txnIndex = transactions.findIndex(txn => txn.id === updatedTxn.id);
    if (txnIndex === -1) {
      console.warn(`Transaction with ID ${updatedTxn.id} not found for update.`);
      return null;
    }

    transactions[txnIndex] = updatedTxn;
    saveTransactionsToStorage(transactions);
    return updatedTxn;
}

export function getAllTransactions(): AdminTransaction[] {
    // Returns transactions sorted by timestamp, newest first
    return loadTransactionsFromStorage().sort((a, b) => b.timestamp - a.timestamp);
}

export function getPendingTransactionsCount(): number {
  if (typeof window === "undefined") return 0;
  const transactions = loadTransactionsFromStorage();
  return transactions.filter(txn => txn.status === 'pending' && (txn.type === 'deposit' || txn.type === 'withdrawal')).length;
}

