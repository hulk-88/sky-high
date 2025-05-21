// src/lib/user-status.ts
"use client";

const BLOCKED_USERS_STORAGE_KEY = "skyhigh_blocked_users";

export function getBlockedUsers(): string[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(BLOCKED_USERS_STORAGE_KEY);
  try {
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error("Failed to parse blocked users from localStorage", e);
    return [];
  }
}

export function addBlockedUser(email: string): void {
  if (typeof window === "undefined") return;
  const blockedUsers = getBlockedUsers();
  if (!blockedUsers.includes(email)) {
    localStorage.setItem(BLOCKED_USERS_STORAGE_KEY, JSON.stringify([...blockedUsers, email]));
  }
}

export function removeBlockedUser(email: string): void {
  if (typeof window === "undefined") return;
  let blockedUsers = getBlockedUsers();
  blockedUsers = blockedUsers.filter(u => u !== email);
  localStorage.setItem(BLOCKED_USERS_STORAGE_KEY, JSON.stringify(blockedUsers));
}

export function isUserBlocked(email: string): boolean {
  if (typeof window === "undefined") return false;
  const blockedUsers = getBlockedUsers();
  return blockedUsers.includes(email);
}
