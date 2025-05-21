
// src/lib/user-auth.ts
"use client";

import type { User, AdminTransaction, ReferredUserDetail } from "@/types";
import { getSiteSettings } from "./site-settings-storage";
import { format } from "date-fns";
import { addTransaction } from "./transaction-storage"; // Ensure addTransaction is imported

const USERS_DB_KEY = "skyhigh_users_db";
const LOGGED_IN_USER_KEY = "skyhigh_logged_in_user_email"; // Store email of logged-in user

// Helper to get all users from localStorage
export function getUsers(): User[] {
  if (typeof window === "undefined") return [];
  const storedUsers = localStorage.getItem(USERS_DB_KEY);
  return storedUsers ? JSON.parse(storedUsers) : [];
}

// Helper to save all users to localStorage
function saveUsers(users: User[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(USERS_DB_KEY, JSON.stringify(users));
}

// Generate a simple mock referral code
function generateReferralCode(username: string): string {
  const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${username.toUpperCase().substring(0,4)}${randomSuffix}`;
}

export function registerUser(userData: Pick<User, "username" | "email" | "passwordHash"> & { referredByCode?: string }): { success: boolean; message: string; user?: User } {
  if (typeof window === "undefined") return { success: false, message: "Operation not supported." };

  let users = getUsers();
  const emailExists = users.some(u => u.email === userData.email);
  if (emailExists) {
    return { success: false, message: "Email already registered." };
  }
  const usernameExists = users.some(u => u.username === userData.username);
  if (usernameExists) {
    return { success: false, message: "Username already taken." };
  }

  let referrer: User | undefined = undefined;
  const trimmedReferredByCode = userData.referredByCode?.trim();

  if (trimmedReferredByCode && trimmedReferredByCode.length > 0) {
    referrer = users.find(u => u.referralCode === trimmedReferredByCode);
    if (!referrer) {
      return { success: false, message: "Invalid referral code." };
    }
  }

  const newUser: User = {
    id: crypto.randomUUID(),
    username: userData.username,
    email: userData.email,
    passwordHash: userData.passwordHash,
    balance: 0,
    isBlocked: false,
    joinedDate: new Date().toISOString(),
    referralCode: generateReferralCode(userData.username),
    referredByCode: trimmedReferredByCode && trimmedReferredByCode.length > 0 ? trimmedReferredByCode : undefined,
    referredUsers: [],
    successfulReferralsCount: 0,
    lastWithdrawalDate: undefined,
    amountWithdrawnToday: 0,
    referralCodeLinkClicks: 0,
  };

  users.push(newUser);

  if (referrer) {
    const referrerIndex = users.findIndex(u => u.id === referrer!.id);
    if (referrerIndex !== -1) {
       if (!users[referrerIndex].referredUsers) {
        users[referrerIndex].referredUsers = [];
      }
      const alreadyReferred = users[referrerIndex].referredUsers.some(ru => ru.email === newUser.email);
      if (!alreadyReferred) {
          users[referrerIndex].referredUsers.push({
            userId: newUser.id,
            email: newUser.email,
            username: newUser.username,
            totalDepositedApproved: 0, // Initial deposit for the new user is 0
            metMinimumDepositThreshold: false,
            joinedDate: newUser.joinedDate,
            receivedSignupBonus: false,
          });
      }
    }
  }

  saveUsers(users);
  return { success: true, message: "Registration successful!", user: newUser };
}

export function loginUser(email: string, passwordAttempt: string): { success: boolean; message: string; user?: User } {
  if (typeof window === "undefined") return { success: false, message: "Operation not supported." };

  const users = getUsers();
  const user = users.find(u => u.email === email);

  if (!user) {
    return { success: false, message: "Email or password error." };
  }

  if (user.isBlocked) {
    return { success: false, message: "This account has been blocked." };
  }

  if (user.passwordHash !== passwordAttempt) {
    return { success: false, message: "Email or password error." };
  }

  localStorage.setItem(LOGGED_IN_USER_KEY, user.email);
  return { success: true, message: "Login successful!", user };
}

export function logoutUser(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LOGGED_IN_USER_KEY);
}

export function getLoggedInUser(): User | null {
  if (typeof window === "undefined") return null;
  const loggedInUserEmail = localStorage.getItem(LOGGED_IN_USER_KEY);
  if (!loggedInUserEmail) return null;

  const users = getUsers();
  return users.find(u => u.email === loggedInUserEmail) || null;
}

export function isUserAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem(LOGGED_IN_USER_KEY);
}

export function getAllUsersForAdmin(): User[] {
  return getUsers();
}

export function updateUserBlockStatus(email: string, isBlocked: boolean): boolean {
    if (typeof window === "undefined") return false;
    const users = getUsers();
    const userIndex = users.findIndex(u => u.email === email);
    if (userIndex === -1) return false;

    users[userIndex].isBlocked = isBlocked;
    saveUsers(users);
    return true;
}

export function updateUserBalance(email: string, newBalance: number): boolean {
    if (typeof window === "undefined") return false;
    const users = getUsers();
    const userIndex = users.findIndex(u => u.email === email);
    if (userIndex === -1) return false;

    users[userIndex].balance = parseFloat(newBalance.toFixed(2));
    saveUsers(users);
    return true;
}

export function adminAddFundsToUser(userEmail: string, amount: number): { success: boolean; message: string } {
  if (typeof window === "undefined") return { success: false, message: "Operation not supported." };
  if (amount <= 0) return { success: false, message: "Amount must be positive."};

  const users = getUsers();
  const userIndex = users.findIndex(u => u.email === userEmail);
  if (userIndex === -1) {
    return { success: false, message: "User not found." };
  }

  users[userIndex].balance += parseFloat(amount.toFixed(2));
  saveUsers(users);

  // Add a transaction record for admin credit
  addTransaction({
    userId: users[userIndex].id,
    userEmail: users[userIndex].email,
    type: 'admin_credit',
    amount: parseFloat(amount.toFixed(2)),
    notes: `Admin credited ${amount.toFixed(2)} USDT.`,
  });

  return { success: true, message: `${amount.toFixed(2)} USDT added to ${userEmail}. This amount contributes to their playable balance.` };
}


export function processApprovedDepositForReferral(
  depositingUserEmail: string,
  grossDepositAmount: number // This should be the original deposit amount BEFORE platform commission
): {
  bonusCreditedToReferrer: boolean;
  referrerEmail?: string;
  bonusAmountToReferrer?: number;
  newPlayerBonusCreditedToDepositor: boolean;
  newPlayerBonusAmount?: number;
  depositingUserUsername?: string;
  referralBonusPercentageApplied?: number;
  message?: string;
} {
  if (typeof window === "undefined") {
    return { bonusCreditedToReferrer: false, newPlayerBonusCreditedToDepositor: false, message: "Not in browser" };
  }

  let users = getUsers(); // Get a mutable copy
  const siteSettings = getSiteSettings();

  const depositingUserIndex = users.findIndex(u => u.email === depositingUserEmail);
  if (depositingUserIndex === -1) {
    return { bonusCreditedToReferrer: false, newPlayerBonusCreditedToDepositor: false, message: "Depositing user not found." };
  }
  const depositingUser = users[depositingUserIndex];

  let referrerBonusApplied = false;
  let referrerEmailForNotification: string | undefined = undefined;
  let bonusToReferrerAmountForNotification: number | undefined = undefined;
  let newPlayerBonusAwarded = false;
  let newPlayerBonusAmountForDepositor: number | undefined = undefined;
  let appliedReferralBonusPercentage: number | undefined = undefined;


  // Process referral bonus for the referrer
  if (depositingUser.referredByCode) {
    const referrerIndex = users.findIndex(u => u.referralCode === depositingUser.referredByCode);
    if (referrerIndex !== -1) {
      const referrer = users[referrerIndex];
      referrerEmailForNotification = referrer.email;

      if (!users[referrerIndex].referredUsers) {
        users[referrerIndex].referredUsers = [];
      }
      let referredUserEntryIndex = users[referrerIndex].referredUsers.findIndex(ru => ru.email === depositingUserEmail);

      let referredEntry: ReferredUserDetail;
      if (referredUserEntryIndex !== -1) {
        referredEntry = users[referrerIndex].referredUsers[referredUserEntryIndex];
      } else {
        const newEntry: ReferredUserDetail = {
            userId: depositingUser.id,
            email: depositingUser.email,
            username: depositingUser.username,
            totalDepositedApproved: 0,
            metMinimumDepositThreshold: false,
            joinedDate: depositingUser.joinedDate,
            receivedSignupBonus: false,
        };
        users[referrerIndex].referredUsers.push(newEntry);
        referredUserEntryIndex = users[referrerIndex].referredUsers.length -1;
        referredEntry = users[referrerIndex].referredUsers[referredUserEntryIndex];
      }

      const previouslyMetMinDepositThreshold = referredEntry.metMinimumDepositThreshold;
      // Update the total deposit amount for this referred user based on the GROSS deposit
      referredEntry.totalDepositedApproved += grossDepositAmount;

      if (siteSettings.referralBonusPercent > 0) {
        // Calculate commission based on GROSS deposit amount
        const commission = parseFloat((grossDepositAmount * (siteSettings.referralBonusPercent / 100)).toFixed(2));
        if (commission > 0) {
          users[referrerIndex].balance += commission; // Add commission to referrer's balance
          bonusToReferrerAmountForNotification = commission;
          referrerBonusApplied = true;
          appliedReferralBonusPercentage = siteSettings.referralBonusPercent;

          // Add transaction record for referral bonus
          addTransaction({
            userId: referrer.id,
            userEmail: referrer.email,
            type: 'referral_bonus',
            amount: commission,
            notes: `Referral bonus from ${depositingUser.username}'s deposit of ${grossDepositAmount.toFixed(2)} USDT.`,
          });

          const maskedDepositingUsername = depositingUser.username.substring(0, 2) + '...';
          localStorage.setItem(
            `skyhigh_show_referral_bonus_${referrer.email}`,
            JSON.stringify({
              amount: commission,
              fromUser: maskedDepositingUsername,
              timestamp: Date.now()
            })
          );
        }
      }

      // Check if the referred user met the minimum deposit threshold for "Successful Referral" status
      // and for their own new player bonus
      if (!previouslyMetMinDepositThreshold && referredEntry.totalDepositedApproved >= siteSettings.referralMinDepositForBonus) {
        referredEntry.metMinimumDepositThreshold = true;
        users[referrerIndex].successfulReferralsCount = (users[referrerIndex].successfulReferralsCount || 0) + 1;

        // Award new player bonus to the depositing user if they haven't received it
        if (!referredEntry.receivedSignupBonus && siteSettings.newPlayerBonusUSDT > 0) {
          users[depositingUserIndex].balance += siteSettings.newPlayerBonusUSDT; // Add bonus to depositor's balance
          referredEntry.receivedSignupBonus = true; // Mark that bonus has been received
          newPlayerBonusAwarded = true;
          newPlayerBonusAmountForDepositor = siteSettings.newPlayerBonusUSDT;

          // Add transaction record for new player bonus
          addTransaction({
            userId: depositingUser.id,
            userEmail: depositingUser.email,
            type: 'new_player_bonus',
            amount: siteSettings.newPlayerBonusUSDT,
            notes: `New player bonus after first qualifying deposit (referred by ${referrer.username}).`,
          });

           localStorage.setItem(
            `skyhigh_show_new_player_bonus_${depositingUser.email}`,
            JSON.stringify({
              amount: siteSettings.newPlayerBonusUSDT,
              timestamp: Date.now()
            })
          );
        }
      }
    }
  }

  saveUsers(users); // Save all changes to users array

  let messageParts: string[] = [];
  if (referrerBonusApplied && referrerEmailForNotification && bonusToReferrerAmountForNotification) {
    messageParts.push(`Referrer ${referrerEmailForNotification} earned ${bonusToReferrerAmountForNotification.toFixed(2)} USDT commission.`);
  }
  if (newPlayerBonusAwarded && newPlayerBonusAmountForDepositor) {
    messageParts.push(`Depositing user ${depositingUserEmail} received ${newPlayerBonusAmountForDepositor.toFixed(2)} USDT new player bonus.`);
  }

  return {
    bonusCreditedToReferrer: referrerBonusApplied,
    referrerEmail: referrerEmailForNotification,
    bonusAmountToReferrer: bonusToReferrerAmountForNotification,
    newPlayerBonusCreditedToDepositor: newPlayerBonusAwarded,
    newPlayerBonusAmount: newPlayerBonusAmountForDepositor,
    depositingUserUsername: depositingUser.username,
    referralBonusPercentageApplied: appliedReferralBonusPercentage,
    message: messageParts.length > 0 ? messageParts.join(' ') : "Deposit processed.",
  };
}


export function getReferralStatsForUser(userEmail: string): {
  successfulReferrals: number;
  totalReferredUsersDepositAmount: number;
  detailedReferredUsers: ReferredUserDetail[];
} {
  const users = getUsers();
  const user = users.find(u => u.email === userEmail);

  if (!user || !Array.isArray(user.referredUsers)) {
    return { successfulReferrals: 0, totalReferredUsersDepositAmount: 0, detailedReferredUsers: [] };
  }

  let totalReferredUsersDepositAmount = 0;
  const detailedReferredUsers = user.referredUsers.map(refUser => {
    const fullReferredUser = users.find(u => u.id === refUser.userId);
    // totalDepositedApproved for an individual referred user is already stored in refUser.totalDepositedApproved
    // So we sum this up for the 'totalReferredUsersDepositAmount' for the referrer
    totalReferredUsersDepositAmount += refUser.totalDepositedApproved;
    return {
        ...refUser,
        username: fullReferredUser?.username || refUser.email.split('@')[0]
    };
  });

  return {
    successfulReferrals: user.successfulReferralsCount || 0,
    totalReferredUsersDepositAmount, // This is the sum of deposits from all referred users
    detailedReferredUsers: detailedReferredUsers || [],
  };
}


export function canUserWithdrawBasedOnReferrals(user: User): boolean {
  if (!user) return false;
  return (user.successfulReferralsCount || 0) >= 5;
}

const DAILY_WITHDRAWAL_PERCENTAGE = 0.15;

export function calculateUserDailyWithdrawalLimit(user: User): number {
  if (!user || user.isBlocked) return 0;

  if (!canUserWithdrawBasedOnReferrals(user)) {
    return 0;
  }

  const maxDailyAmount = user.balance * DAILY_WITHDRAWAL_PERCENTAGE;

  const todayStr = format(new Date(), "yyyy-MM-dd");
  let alreadyWithdrawn = 0;
  if (user.lastWithdrawalDate === todayStr && user.amountWithdrawnToday) {
    alreadyWithdrawn = user.amountWithdrawnToday;
  }

  const remainingAllowance = Math.max(0, maxDailyAmount - alreadyWithdrawn);
  return parseFloat(remainingAllowance.toFixed(2));
}

export function recordUserWithdrawal(userEmail: string, amount: number): boolean {
  if (typeof window === "undefined") return false;
  const users = getUsers();
  const userIndex = users.findIndex(u => u.email === userEmail);
  if (userIndex === -1) return false;

  const todayStr = format(new Date(), "yyyy-MM-dd");
  if (users[userIndex].lastWithdrawalDate === todayStr) {
    users[userIndex].amountWithdrawnToday = (users[userIndex].amountWithdrawnToday || 0) + amount;
  } else {
    users[userIndex].lastWithdrawalDate = todayStr;
    users[userIndex].amountWithdrawnToday = amount;
  }
  saveUsers(users);
  return true;
}


export function hasUserMadeAnyApprovedDeposits(userEmail: string, transactions: AdminTransaction[]): boolean {
  return transactions.some(
    (txn) => txn.userEmail === userEmail && txn.type === "deposit" && txn.status === "approved"
  );
}

    
