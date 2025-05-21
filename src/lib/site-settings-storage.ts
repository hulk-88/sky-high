// src/lib/site-settings-storage.ts
"use client";
import type { AdminSiteSettings } from "@/types";

const SITE_SETTINGS_KEY = "skyhigh_site_settings_v2"; 

// Define default settings
export const defaultSiteSettings: AdminSiteSettings = {
  minBet: 1,
  maxBet: 100,
  gameDifficultyPercent: 70, 
  maintenanceMode: false,
  referralBonusPercent: 1, 
  newPlayerBonusUSDT: 5, 
  enableAntiBot: false,
  captchaSiteKey: "",
  rateLimitRequestsPerMin: 100,
  referralMinDepositForBonus: 50, 
  referralFixedBonusAmount: 0,    
  supportTicketCleanupInterval: '7_days', 
  platformDepositFeePercent: 2, // Default 2% platform fee on deposits
};

export function getSiteSettings(): AdminSiteSettings {
  if (typeof window === "undefined") return { ...defaultSiteSettings };
  const storedSettings = localStorage.getItem(SITE_SETTINGS_KEY);
  if (storedSettings) {
    try {
      const parsedSettings = JSON.parse(storedSettings);
      const validatedSettings: AdminSiteSettings = { ...defaultSiteSettings };

      for (const key in defaultSiteSettings) {
        if (Object.prototype.hasOwnProperty.call(defaultSiteSettings, key)) {
          const typedKey = key as keyof AdminSiteSettings;
          if (parsedSettings.hasOwnProperty(typedKey)) { 
            if (typeof defaultSiteSettings[typedKey] === 'number') {
              const parsedValue = parseFloat(parsedSettings[typedKey]);
              (validatedSettings[typedKey] as number) = !isNaN(parsedValue)
                ? parsedValue
                : defaultSiteSettings[typedKey];
            } else {
              (validatedSettings[typedKey] as any) = parsedSettings[typedKey];
            }
          } else {
             
            (validatedSettings[typedKey] as any) = defaultSiteSettings[typedKey];
          }
        }
      }
      return validatedSettings;
    } catch (e) {
      console.error("Failed to parse site settings from localStorage", e);
      
      return { ...defaultSiteSettings };
    }
  }
  
  return { ...defaultSiteSettings };
}

export function saveSiteSettings(settings: Partial<AdminSiteSettings>): AdminSiteSettings {
  if (typeof window === "undefined") return { ...defaultSiteSettings, ...settings };
  const currentSettings = getSiteSettings();
  const newSettings = { ...currentSettings, ...settings };
  localStorage.setItem(SITE_SETTINGS_KEY, JSON.stringify(newSettings));
  return newSettings;
}



export function getMaintenanceMode(): boolean {
  return getSiteSettings().maintenanceMode;
}


export function setMaintenanceMode(isEnabled: boolean): void {
  saveSiteSettings({ maintenanceMode: isEnabled });
}

