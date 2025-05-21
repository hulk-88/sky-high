
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Save, Percent, AlertTriangle, Shield, Gift, Users, Activity, MessageSquare, Settings as SettingsIcon } from "lucide-react"; // Added SettingsIcon
import { getSiteSettings, saveSiteSettings, defaultSiteSettings } from "@/lib/site-settings-storage";
import type { AdminSiteSettings, SupportTicketCleanupInterval } from "@/types";


export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<AdminSiteSettings>(defaultSiteSettings);
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    
    setSettings(getSiteSettings());
  }, []);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    const key = name as keyof AdminSiteSettings;

    if (type === "checkbox") {
      setSettings(prev => ({ ...prev, [key]: checked }));
      return;
    }
    
    if (type === "number") {
      let numValue: number;
      const parsedFloat = parseFloat(value);

      if (isNaN(parsedFloat) && value.trim() !== "") { 
        return; 
      }
      
      if (key === "minBet" || key === "maxBet" || key === "newPlayerBonusUSDT" || key === "referralMinDepositForBonus" || key === "referralFixedBonusAmount" || key === "rateLimitRequestsPerMin") {
        numValue = isNaN(parsedFloat) ? 0 : Math.max(0, parsedFloat);
      } else if (key === "gameDifficultyPercent" || key === "platformDepositFeePercent") { // Added platformDepositFeePercent
        const parsedNum = key === "gameDifficultyPercent" ? parseInt(value, 10) : parsedFloat;
        if (isNaN(parsedNum)) {
          numValue = defaultSiteSettings[key as keyof typeof defaultSiteSettings]; 
        } else if (key === "gameDifficultyPercent") {
            if (parsedNum < 10) numValue = 10;
            else if (parsedNum > 90) numValue = 90;
            else numValue = parsedNum;
        } else { // platformDepositFeePercent
            if (parsedNum < 0) numValue = 0;
            else if (parsedNum > 100) numValue = 100;
            else numValue = parsedNum;
        }
      } else if (key === "referralBonusPercent") {
         if (isNaN(parsedFloat)) {
          numValue = defaultSiteSettings.referralBonusPercent; 
        } else if (parsedFloat < 0) {
          numValue = 0;
        } else if (parsedFloat > 100) {
          numValue = 100;
        } else {
          numValue = parsedFloat;
        }
      } else {
        numValue = isNaN(parsedFloat) ? 0 : parsedFloat;
      }
      
      setSettings(prev => ({ 
        ...prev, 
        [key]: value.trim() === "" ? (defaultSiteSettings[key] !== undefined ? defaultSiteSettings[key] : 0) : numValue 
      }));

    } else {
      setSettings(prev => ({ ...prev, [key]: value }));
    }
  };
  
  const handleSwitchChange = (name: keyof AdminSiteSettings, checked: boolean) => {
     setSettings(prev => ({
      ...prev,
      [name]: checked,
    }));
  }

  const handleSelectChange = (name: keyof AdminSiteSettings, value: string) => {
    setSettings(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const settingsToSave = { ...settings };
    
    for (const key in settingsToSave) {
        const typedKey = key as keyof AdminSiteSettings;
        if (typeof settingsToSave[typedKey] === 'string' && typeof defaultSiteSettings[typedKey] === 'number') {
            const num = parseFloat(settingsToSave[typedKey] as string);
            (settingsToSave[typedKey] as any) = isNaN(num) ? defaultSiteSettings[typedKey] : num;
        } else if (typeof settingsToSave[typedKey] === 'number' && isNaN(settingsToSave[typedKey] as number) ){ 
            (settingsToSave[typedKey] as any) = defaultSiteSettings[typedKey];
        }
    }

    saveSiteSettings(settingsToSave);
    setSettings(settingsToSave); 
    toast({
      title: "Settings Saved",
      description: "Site settings have been updated.",
    });
  };

  if (!isClient) {
    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-primary">Site Settings</h1>
            <p className="text-muted-foreground">Loading settings...</p>
        </div>
    );
  }
  
  const getInputValue = (fieldValue: number | string) => {
    if (typeof fieldValue === 'number' && isNaN(fieldValue)) return ''; 
    return fieldValue;
  }


  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-primary">Site Settings</h1>
      <p className="text-muted-foreground">Configure global parameters and operational controls for the Sky High USDT platform.</p>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl flex items-center"><Activity className="mr-2 h-5 w-5 text-indigo-500" />Game Parameters</CardTitle>
            <CardDescription>Adjust betting limits and core game mechanics.</CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="minBet" className="text-base">Minimum Bet (USDT)</Label>
              <Input id="minBet" name="minBet" type="number" value={getInputValue(settings.minBet)} onChange={handleInputChange} step="0.01" min="0" className="h-11 text-base" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxBet" className="text-base">Maximum Bet (USDT)</Label>
              <Input id="maxBet" name="maxBet" type="number" value={getInputValue(settings.maxBet)} onChange={handleInputChange} step="0.01" min="0" className="h-11 text-base" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="gameDifficultyPercent" className="text-base">Game Difficulty (%) for bets &lt; 50 USDT</Label>
              <div className="flex items-center">
                <Input 
                    id="gameDifficultyPercent" 
                    name="gameDifficultyPercent" 
                    type="number" 
                    value={getInputValue(settings.gameDifficultyPercent)} 
                    onChange={handleInputChange} 
                    step="1" 
                    min="10" 
                    max="90" 
                    className="h-11 text-base rounded-r-none" 
                />
                <span className="flex items-center justify-center h-11 px-3 border border-l-0 rounded-r-md bg-muted text-muted-foreground"><Percent className="h-5 w-5"/></span>
              </div>
               <p className="text-xs text-muted-foreground">
                   This sets the default difficulty for bets under 50 USDT. Range: 10-90%. Higher % means the game is more difficult (crashes sooner). Bets of 50 USDT or more automatically use a 85% difficulty.
               </p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl flex items-center"><SettingsIcon className="mr-2 h-5 w-5 text-green-500" />Financial Settings</CardTitle>
            <CardDescription>Configure fees and commissions.</CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="platformDepositFeePercent" className="text-base">Platform Deposit Fee (%)</Label>
              <div className="flex items-center">
                <Input 
                  id="platformDepositFeePercent" 
                  name="platformDepositFeePercent" 
                  type="number" 
                  value={getInputValue(settings.platformDepositFeePercent)} 
                  onChange={handleInputChange} 
                  step="0.1" 
                  min="0" 
                  max="100" 
                  className="h-11 text-base rounded-r-none" 
                />
                <span className="flex items-center justify-center h-11 px-3 border border-l-0 rounded-r-md bg-muted text-muted-foreground"><Percent className="h-5 w-5"/></span>
              </div>
              <p className="text-xs text-muted-foreground">Percentage fee applied to all user deposits. E.g., 2 for 2%.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2"><Users className="h-5 w-5 text-purple-500" />Referral &amp; Player Bonuses</CardTitle>
            <CardDescription>Manage referral rewards and new player incentives.</CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-6">
             <div className="space-y-2">
              <Label htmlFor="newPlayerBonusUSDT" className="text-base">New Player Bonus (USDT)</Label>
              <Input id="newPlayerBonusUSDT" name="newPlayerBonusUSDT" type="number" value={getInputValue(settings.newPlayerBonusUSDT)} onChange={handleInputChange} step="0.01" min="0" className="h-11 text-base" />
              <p className="text-xs text-muted-foreground">Bonus for new users (e.g., upon signup or first deposit meeting criteria).</p>
            </div>
             <div className="space-y-2">
              <Label htmlFor="referralMinDepositForBonus" className="text-base">Referred User Min. Deposit (USDT) for "Successful Referral"</Label>
              <Input id="referralMinDepositForBonus" name="referralMinDepositForBonus" type="number" value={getInputValue(settings.referralMinDepositForBonus)} onChange={handleInputChange} step="1" min="0" className="h-11 text-base" />
              <p className="text-xs text-muted-foreground">Min. deposit by a referred user to count as successful for referrer's withdrawal eligibility &amp; referred user's new player bonus.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="referralBonusPercent" className="text-base">Referrer Commission (%) from Referred User's Deposit</Label>
               <div className="flex items-center">
                <Input id="referralBonusPercent" name="referralBonusPercent" type="number" value={getInputValue(settings.referralBonusPercent)} onChange={handleInputChange} step="0.1" min="0" max="100" className="h-11 text-base rounded-r-none" />
                 <span className="flex items-center justify-center h-11 px-3 border border-l-0 rounded-r-md bg-muted text-muted-foreground"><Percent className="h-5 w-5"/></span>
              </div>
              <p className="text-xs text-muted-foreground">E.g., 1%. Percentage of referred user's deposit credited to the referrer.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="referralFixedBonusAmount" className="text-base">Referrer Fixed Bonus (USDT)</Label>
              <Input id="referralFixedBonusAmount" name="referralFixedBonusAmount" type="number" value={getInputValue(settings.referralFixedBonusAmount)} onChange={handleInputChange} step="0.01" min="0" className="h-11 text-base" />
              <p className="text-xs text-muted-foreground">(Optional) Fixed USDT amount credited to referrer if referred user meets criteria. This can be additional to or instead of the % commission.</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl flex items-center"><MessageSquare className="mr-2 h-5 w-5 text-cyan-500" />Support Ticket Settings</CardTitle>
            <CardDescription>Configure automatic cleanup of old support tickets.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="supportTicketCleanupInterval" className="text-base">Ticket Cleanup Interval</Label>
              <Select
                name="supportTicketCleanupInterval"
                value={settings.supportTicketCleanupInterval}
                onValueChange={(value) => handleSelectChange("supportTicketCleanupInterval", value as SupportTicketCleanupInterval)}
              >
                <SelectTrigger className="h-11 text-base">
                  <SelectValue placeholder="Select cleanup interval" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7_days">7 Days</SelectItem>
                  <SelectItem value="1_month">1 Month</SelectItem>
                  <SelectItem value="5_months">5 Months</SelectItem>
                  <SelectItem value="never">Never (Manual Cleanup)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Automatically remove support tickets older than the selected interval based on their creation date. 'Never' disables automatic cleanup.
              </p>
            </div>
          </CardContent>
        </Card>


        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2"><Shield className="h-5 w-5 text-blue-500"/> Security Settings (Mock)</CardTitle>
            <CardDescription>Configure platform security measures. These are illustrative and require backend implementation.</CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-6">
            <div className="flex items-center space-x-3 p-4 border rounded-md bg-muted/30 col-span-2">
              <Switch 
                id="enableAntiBot" 
                name="enableAntiBot"
                checked={settings.enableAntiBot} 
                onCheckedChange={(checked) => handleSwitchChange("enableAntiBot", checked)}
                aria-label="Toggle Basic Anti-Bot Measures"
              />
              <div>
                <Label htmlFor="enableAntiBot" className="text-base font-semibold">Enable Basic Anti-Bot (Mock)</Label>
                <p className="text-sm text-muted-foreground">
                  Simulates enabling basic anti-bot protections.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="captchaSiteKey" className="text-base">CAPTCHA Site Key (Mock)</Label>
              <Input id="captchaSiteKey" name="captchaSiteKey" type="text" placeholder="Enter CAPTCHA site key" value={settings.captchaSiteKey} onChange={handleInputChange} className="h-11 text-base" />
              <p className="text-xs text-muted-foreground">Enter API key for a CAPTCHA service (e.g., reCAPTCHA).</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rateLimitRequestsPerMin" className="text-base">Rate Limit (Requests/Min - Mock)</Label>
              <Input id="rateLimitRequestsPerMin" name="rateLimitRequestsPerMin" type="number" value={getInputValue(settings.rateLimitRequestsPerMin)} onChange={handleInputChange} step="1" min="0" className="h-11 text-base" />
              <p className="text-xs text-muted-foreground">Max requests per minute per IP for sensitive actions.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-destructive/50">
          <CardHeader>
            <CardTitle className="text-xl text-destructive flex items-center gap-2"><AlertTriangle /> Site Operations</CardTitle>
            <CardDescription>Control critical site-wide functionalities like maintenance mode.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-3 p-4 border rounded-md bg-destructive/5">
              <Switch 
                id="maintenanceMode" 
                name="maintenanceMode"
                checked={settings.maintenanceMode} 
                onCheckedChange={(checked) => handleSwitchChange("maintenanceMode", checked)}
                aria-label="Toggle Maintenance Mode"
              />
              <div>
                <Label htmlFor="maintenanceMode" className="text-base font-semibold">Maintenance Mode</Label>
                <p className="text-sm text-muted-foreground">
                  When enabled, non-admin users will see a maintenance page. Admins can still access the site.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" size="lg" className="h-12 text-lg">
            <Save className="mr-2 h-5 w-5" /> Save Settings
          </Button>
        </div>
      </form>
    </div>
  );
}

