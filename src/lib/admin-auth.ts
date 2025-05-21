
// src/lib/admin-auth.ts
"use client"; // This file will be used by client components or in client-side logic

const ADMIN_COOKIE_NAME = "skyhigh_admin_loggedIn";

// Mock admin credentials
const ADMIN_USERNAME = "admin@gmail.com"; // Updated username
const ADMIN_PASSWORD = "free2010"; // Updated password

export function checkAdminCredentials(username?: string | null, password?: string | null): boolean {
  return username === ADMIN_USERNAME && password === ADMIN_PASSWORD;
}

export function isAdminLoggedIn(): boolean {
  if (typeof document === "undefined") {
    return false; // Cannot access cookies on the server during initial render in this simple setup
  }
  const cookieValue = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${ADMIN_COOKIE_NAME}=`));
  return !!cookieValue && cookieValue.split("=")[1] === "true";
}

export function setAdminLoggedInCookie(isLoggedIn: boolean): void {
  if (typeof document === "undefined") {
    return;
  }
  if (isLoggedIn) {
    // Expires in 1 day, path is '/' to be accessible across the app for checks
    document.cookie = `${ADMIN_COOKIE_NAME}=true; path=/; max-age=86400; SameSite=Lax`;
  } else {
    // Clears the cookie by setting max-age to 0 and path to '/'
    document.cookie = `${ADMIN_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
  }
}

