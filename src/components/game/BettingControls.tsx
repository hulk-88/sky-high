
"use client";

import { useState, useEffect, useMemo } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { DollarSign, Play, HandCoins, Zap, RefreshCcw, Settings2, AlertTriangle, Target } from 'lucide-react';
import type { GamePhase, AutoBetSettings } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { getSiteSettings } from '@/lib/site-settings-storage';
import { cn } from '@/lib/utils';

// Helper to convert Arabic/Persian numerals to Western numerals
const arabicToWesternNumerals = (str: string | undefined | null): string => {
  if (str === undefined || str === null || typeof str !== 'string') return '';
  return str
    .replace(/[٠١٢٣٤٥٦٧٨٩]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1632 + 48)) // Arabic
    .replace(/[۰۱۲۳۴۵۶۷۸۹]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1776 + 48)) // Persian
    .replace(/٫/g, '.'); // Arabic decimal separator
};

// Helper function to create a string value for controlled input from RHF value
const fieldDisplayValue = (valueFromRHF: any): string => {
    if (valueFromRHF === undefined || valueFromRHF === null || (typeof valueFromRHF === 'number' && isNaN(valueFromRHF))) {
      return '';
    }
    return String(valueFromRHF);
};

const createManualBetFormSchema = (
  siteMinBet: number,
  isDemo: boolean,
  currentBalance: number
) => {
  const minBetValue = isDemo ? 0.01 : Math.max(1, siteMinBet);
  const maxBetErrorMessage = `لا يمكن أن يتجاوز مبلغ اللعب رصيدك الحالي البالغ ${currentBalance.toFixed(2)} USDT.`;

  return z.object({
    amount: z.coerce.number({
      required_error: "مبلغ اللعب مطلوب.",
      invalid_type_error: "يجب أن يكون مبلغ اللعب رقمًا."
    })
      .positive({ message: "يجب أن يكون مبلغ اللعب موجبًا." })
      .min(minBetValue, { message: `الحد الأدنى للعب هو ${minBetValue.toFixed(2)} USDT.` })
      .superRefine((value, ctx) => {
        if (value > currentBalance) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: maxBetErrorMessage,
          });
        }
      }),
    autoCashOutAt: z.coerce.number({
      invalid_type_error: "يجب أن يكون مضاعف السحب التلقائي رقمًا إذا تم إدخاله."
    })
      .optional()
      .nullable()
      .refine(val => {
        if (val === null || val === undefined || String(val).trim() === '') return true;
        const numVal = Number(val);
        if (isNaN(numVal)) return false; // Ensure it's a number first
        return numVal >= 0.05 && numVal <= 10.00;
      }, {
        message: "يجب أن يكون السحب التلقائي بين 0.05x و 10.00x إذا تم تحديده."
      }),
  });
};

const createAutoBetFormSchema = (
  siteMinBet: number,
  isDemo: boolean,
  currentBalanceForAutoBet: number // Explicitly pass balance for auto bet schema
) => {
  const minBetValueForAuto = isDemo ? 0.01 : Math.max(1, siteMinBet);
  const maxBetErrorMessageForAuto = `لا يمكن أن يتجاوز مبلغ اللعب رصيدك الحالي البالغ ${currentBalanceForAutoBet.toFixed(2)} USDT.`;

  return z.object({
    // betAmount is no longer part of autoBetForm; it's taken from manualBetForm.amount
    numberOfBets: z.coerce.number({
        required_error: "عدد الجولات مطلوب.",
        invalid_type_error: "قيمة عدد الجولات يجب أن تكون رقمية.",
      })
      .int({ message: "يجب أن يكون عدد الجولات رقمًا صحيحًا." })
      .min(1, { message: "الحد الأدنى جولة واحدة." })
      .max(99, { message: "الحد الأقصى لعدد الجولات هو 99." }),
    cashOutAtMultiplier: z.coerce.number({
        required_error: "مضاعف السحب التلقائي مطلوب.",
        invalid_type_error: "يجب أن يكون المضاعف رقمًا."
      })
      .min(0.05, { message: "اقل مضاعف 0.05x" })
      .max(10.00, { message: "يجب أن يكون السحب التلقائي <= 10.00x" }),
    stopOnProfit: z.coerce.number({
        required_error: "حد إيقاف الربح مطلوب.",
        invalid_type_error: "يجب أن يكون إيقاف الربح رقمًا."
      })
      .positive({ message: "يجب أن يكون إيقاف الربح موجبًا." })
      .min(0.01, { message: "الحد الأدنى لإيقاف الربح هو 0.01 USDT."}),
    stopOnLoss: z.coerce.number({
        required_error: "حد إيقاف الخسارة مطلوب.",
        invalid_type_error: "يجب أن يكون إيقاف الخسارة رقمًا."
      })
      .positive({ message: "يجب أن يكون إيقاف الخسارة موجبًا." })
      .min(0.01, { message: "الحد الأدنى لإيقاف الخسارة هو 0.01 USDT."}),
  });
};


type ManualBetFormValues = z.infer<ReturnType<typeof createManualBetFormSchema>>;
type AutoBetFormValues = z.infer<ReturnType<typeof createAutoBetFormSchema>>;

interface BettingControlsProps {
  gamePhase: GamePhase;
  multiplier: number;
  betAmount: number | null; // This is the active bet amount for the current game round
  onPlaceBet: (amount: number, options?: { isAutoRound?: boolean; autoCashOutAt?: number }) => void;
  onCashOut: () => void;
  userBalance: number;
  isCountdownActive: boolean;
  isAutoBetting: boolean; // True when an auto-bet sequence is actively running (after initial delay)
  autoBetStarting: boolean; // True when auto-bet has been initiated but not yet started its first bet
  startAutoBet: (settings: AutoBetSettings) => void;
  stopAutoBet: (reason?: 'manual' | 'error' | 'rounds_completed' | 'profit_target' | 'loss_limit') => void;
  autoBetRoundsRemaining: number;
  autoBetSessionProfit: number;
  activeAutoBetSettings: AutoBetSettings | null; // Settings of the currently RUNNING auto-bet session
  isDemoMode: boolean;
}

const PRESET_MANUAL_BET_AMOUNTS = [1, 5, 25, 50, 100, 200];
const PRESET_AUTO_CASHOUT_MULTIPLIERS = [0.10, 0.50, 1.00, 1.50, 2.00, 2.50, 3.00, 3.50, 4.00, 4.50, 5.00, 5.50];
const PRESET_NUMBER_OF_BETS = [5, 10, 15, 20, 25, 30, 35];


export function BettingControls({
  gamePhase,
  multiplier,
  betAmount: activeGameBetAmount, // Renamed to avoid conflict
  onPlaceBet,
  onCashOut,
  userBalance,
  isCountdownActive,
  isAutoBetting,
  autoBetStarting,
  startAutoBet,
  stopAutoBet: stopAutoBetCallback,
  autoBetRoundsRemaining,
  autoBetSessionProfit,
  activeAutoBetSettings,
  isDemoMode,
}: BettingControlsProps) {
  const [isAutoBetMode, setIsAutoBetMode] = useState(false);
  const { toast } = useToast();
  const [siteMinBetSettings, setSiteMinBetSettings] = useState(isDemoMode ? 0.01 : 1);

  useEffect(() => {
    const settings = getSiteSettings();
    setSiteMinBetSettings(isDemoMode ? 0.01 : Math.max(1, settings.minBet));
  }, [isDemoMode]);

  const currentManualBetFormSchema = useMemo(() => createManualBetFormSchema(siteMinBetSettings, isDemoMode, userBalance), [siteMinBetSettings, isDemoMode, userBalance]);
  const currentAutoBetFormSchema = useMemo(() => createAutoBetFormSchema(siteMinBetSettings, isDemoMode, userBalance), [siteMinBetSettings, isDemoMode, userBalance]);

  const manualBetForm = useForm<ManualBetFormValues>({
    resolver: zodResolver(currentManualBetFormSchema),
    defaultValues: {
      amount: isDemoMode ? 0.01 : Math.max(1, siteMinBetSettings),
      autoCashOutAt: 0.05,
    },
    mode: "onChange",
  });

  const autoBetForm = useForm<AutoBetFormValues>({
    resolver: zodResolver(currentAutoBetFormSchema),
    defaultValues: {
      // betAmount is no longer part of autoBetForm
      numberOfBets: 10, // Default 10 rounds
      cashOutAtMultiplier: undefined,
      stopOnProfit: undefined,
      stopOnLoss: undefined,
    },
    mode: "onChange",
  });
  
  const watchedManualBetAmount = manualBetForm.watch('amount');


  useEffect(() => {
    // This effect ensures that the default values for manualBetForm are updated
    // if the mode or settings change, while preserving user input if they've interacted.
    // We don't reset if the form is dirty (user has typed something)
    if (!manualBetForm.formState.isDirty) {
        manualBetForm.reset({
            amount: isDemoMode ? 0.01 : Math.max(1, siteMinBetSettings),
            autoCashOutAt: 0.05,
        });
    }
  }, [isDemoMode, siteMinBetSettings, manualBetForm.reset, manualBetForm.formState.isDirty]);


  const handleManualBetSubmit = (values: ManualBetFormValues) => {
    if (values.amount === undefined || values.amount === null) {
      manualBetForm.setError("amount", { type: "manual", message: "مبلغ اللعب مطلوب." });
      return;
    }
    const autoCashOutTarget = (values.autoCashOutAt !== null && values.autoCashOutAt !== undefined && String(values.autoCashOutAt).trim() !== "")
        ? Number(values.autoCashOutAt)
        : undefined;

    onPlaceBet(values.amount, { autoCashOutAt: autoCashOutTarget });
  };

  const handlePresetManualBetClick = (presetAmount: number) => {
    manualBetForm.setValue("amount", presetAmount, { shouldValidate: true, shouldDirty: true, shouldTouch: true });
  };


  const handleAutoBetSubmit = async (values: AutoBetFormValues) => {
    const isManualBetAmountValid = await manualBetForm.trigger("amount");
    const manualAmount = manualBetForm.getValues().amount;
  
    if (!isManualBetAmountValid || manualAmount === undefined || manualAmount === null || isNaN(manualAmount)) {
      toast({
        title: "خطأ في مبلغ اللعب",
        description: "يرجى التأكد من أن مبلغ اللعب المحدد في قسم 'العب اليدوي' صالح قبل بدء اللعب التلقائي.",
        variant: "destructive",
      });
      // Consider focusing the manual bet amount field if it's not auto-bet mode
      if (!isAutoBetMode) manualBetForm.setFocus("amount"); 
      return;
    }
    
    const isValidAutoBetForm = await autoBetForm.trigger(); // Validate all auto-bet specific fields
    if (!isValidAutoBetForm) {
        toast({
            title: "خطأ في إعدادات اللعب التلقائي",
            description: "يرجى التأكد من أن جميع الحقول في قسم 'العب التلقائي' صحيحة.",
            variant: "destructive",
        });
        return;
    }

    startAutoBet({
      betAmount: manualAmount, // Use validated amount from manual form
      numberOfBets: values.numberOfBets!,
      cashOutAtMultiplier: values.cashOutAtMultiplier!,
      stopOnProfit: values.stopOnProfit!,
      stopOnLoss: values.stopOnLoss!,
    });
  };
  
  const handlePresetAutoCashoutMultiplierClick = (presetMultiplier: number) => {
    autoBetForm.setValue("cashOutAtMultiplier", presetMultiplier, { shouldValidate: true, shouldDirty: true, shouldTouch: true });
  };

  const handlePresetNumberOfBetsClick = (presetValue: number) => {
    autoBetForm.setValue("numberOfBets", presetValue, { shouldValidate: true, shouldDirty: true, shouldTouch: true });
  };


  const handleModeSwitch = (newModeIsAuto: boolean) => {
    if (isAutoBetting || autoBetStarting) {
      toast({ title: "اللعب التلقائي نشط", description: "أوقف جلسة اللعب التلقائي الحالية لتبديل الوضع.", variant: "default" });
      return;
    }
    setIsAutoBetMode(newModeIsAuto);
  };

  const canPlaceManualBet = (gamePhase === 'idle' || gamePhase === 'crashed' || gamePhase === 'cashedOut') && !isAutoBetting && !autoBetStarting && !isCountdownActive;
  const canManuallyCashOut = gamePhase === 'playing' && activeGameBetAmount !== null && !isAutoBetting && !autoBetStarting;
  const isAnyAutoBetProcessActive = isAutoBetting || autoBetStarting;

  const shouldShowAutoBetSessionInfo = !!activeAutoBetSettings;


  const genericNumericInputHandler = (
    field: { onChange: (value: string | undefined) => void; name: string, value: any },
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const rawValue = e.target.value;
    const westernValue = arabicToWesternNumerals(rawValue);

    if (westernValue.trim() === '') {
      field.onChange(undefined); 
    } else {
      field.onChange(westernValue); 
    }
  };
  
  const genericIntInputHandler = (
    field: { onChange: (value: string | undefined) => void; name: string, value: any },
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const rawValue = e.target.value;
    const westernValue = arabicToWesternNumerals(rawValue);
    const numericString = westernValue.replace(/[^0-9]/g, ''); 

    if (numericString.trim() === '') {
      field.onChange(undefined);
    } else {
      field.onChange(numericString);
    }
  };


  return (
    <Card className="w-full shadow-xl bg-card/90 backdrop-blur-sm">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-2xl">{isAutoBetMode ? "العب التلقائي" : "العب اليدوي"}</CardTitle>
          <div className="flex items-center space-x-2">
            <Switch
              id="bet-mode-switch"
              checked={isAutoBetMode}
              onCheckedChange={handleModeSwitch}
              aria-label="Toggle bet mode"
              disabled={isAnyAutoBetProcessActive}
            />
            <Label htmlFor="bet-mode-switch" className="text-sm">{isAutoBetMode ? "تلقائي" : "يدوي"}</Label>
          </div>
        </div>
        <CardDescription>
          الرصيد: <span className="font-semibold text-primary">{userBalance.toFixed(2)} USDT</span> {isDemoMode && <span className="text-xs text-yellow-500">(تجريبي)</span>}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!isAutoBetMode ? (
          <Form {...manualBetForm}>
            <form onSubmit={manualBetForm.handleSubmit(handleManualBetSubmit)} className="space-y-4">
              <FormField
                control={manualBetForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">مبلغ اللعب (USDT)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                          type="text"
                          inputMode="decimal"
                          placeholder={isDemoMode ? "0.01" : String(Math.max(1, siteMinBetSettings))}
                          {...field}
                          value={fieldDisplayValue(field.value)}
                          onChange={(e) => genericNumericInputHandler(field, e)}
                          className="pl-10 h-12 text-base"
                          disabled={!canPlaceManualBet} />
                      </div>
                    </FormControl>
                     <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-2">
                        {PRESET_MANUAL_BET_AMOUNTS.map(amount => (
                        <Button
                            key={`manual-bet-${amount}`}
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handlePresetManualBetClick(amount)}
                            disabled={!canPlaceManualBet || amount > userBalance}
                            className="text-xs sm:text-sm h-9"
                        >
                            {amount}
                        </Button>
                        ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={manualBetForm.control}
                name="autoCashOutAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">سحب تلقائي عند مضاعف (اختياري: 0.05 - 10.00x)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Target className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                          type="text"
                          inputMode="decimal"
                          placeholder="مثال: 0.50 (0.05 - 10.00)"
                          {...field}
                          value={fieldDisplayValue(field.value)}
                          onChange={(e) => genericNumericInputHandler(field, e)}
                          className="pl-10 h-12 text-base"
                          disabled={!canPlaceManualBet} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {canPlaceManualBet && (
                <Button type="submit" size="lg" className="w-full h-14 text-xl" disabled={isCountdownActive || !manualBetForm.formState.isValid}>
                  <Play className="mr-2 h-6 w-6" /> العب
                </Button>
              )}
              {canManuallyCashOut && (
                <Button onClick={onCashOut} size="lg" className="w-full h-14 text-xl bg-accent hover:bg-accent/90">
                  <HandCoins className="mr-2 h-6 w-6" /> سحب عند <span className={cn("tabular-nums", multiplier >= 1 ? "text-green-400" : "text-red-400")}>{multiplier.toFixed(2)}x</span>
                </Button>
              )}
              {(gamePhase === 'playing' && !canManuallyCashOut && activeGameBetAmount === null && !isAnyAutoBetProcessActive) && (
                 <Button size="lg" className="w-full h-14 text-xl bg-muted hover:bg-muted/90" disabled>
                    العب
                </Button>
              )}
               {(gamePhase === 'playing' && activeGameBetAmount !== null && !canManuallyCashOut && !isAnyAutoBetProcessActive) && (
                 <Button onClick={onCashOut} size="lg" className="w-full h-14 text-xl bg-accent hover:bg-accent/90"
                    disabled={isAnyAutoBetProcessActive || (manualBetForm.getValues().autoCashOutAt !== undefined && manualBetForm.getValues().autoCashOutAt !== null && multiplier < (manualBetForm.getValues().autoCashOutAt || Infinity)) }>
                  <HandCoins className="mr-2 h-6 w-6" /> سحب عند <span className={cn("tabular-nums", multiplier >= 1 ? "text-green-400" : "text-red-400")}>{multiplier.toFixed(2)}x</span>
                </Button>
              )}
              {(gamePhase === 'betting' && isCountdownActive && !isAnyAutoBetProcessActive) && (
                <Button size="lg" className="w-full h-14 text-xl bg-yellow-500 hover:bg-yellow-600 text-background" disabled>
                  جارٍ البدء...
                </Button>
              )}
            </form>
          </Form>
        ) : (
          <Form {...autoBetForm}>
            <form onSubmit={autoBetForm.handleSubmit(handleAutoBetSubmit)} className="space-y-3">
               <div className="space-y-1">
                  <Label className="text-sm">مبلغ اللعب المستخدم (من اللعب اليدوي)</Label>
                  <div className="flex items-center justify-between p-3 border rounded-md bg-muted/50">
                    <span className="text-base font-semibold text-primary">
                      {(watchedManualBetAmount !== undefined && !isNaN(watchedManualBetAmount)) ? `${Number(watchedManualBetAmount).toFixed(2)} USDT` : 'الرجاء تحديد مبلغ في اللعب اليدوي'}
                    </span>
                    <Button type="button" variant="outline" size="sm" onClick={() => {setIsAutoBetMode(false); manualBetForm.setFocus("amount");}} disabled={isAnyAutoBetProcessActive}>
                      تغيير
                    </Button>
                  </div>
                  {/* Display error for manual bet amount if auto bet is attempted with invalid manual amount */}
                   {(manualBetForm.formState.errors.amount && (isAutoBetting || autoBetStarting)) && (
                     <p className="text-xs text-destructive mt-1">{manualBetForm.formState.errors.amount.message}</p>
                   )}
                </div>

              <FormField control={autoBetForm.control} name="numberOfBets" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">عدد الجولات (1-99)</FormLabel>
                  <FormControl><Input
                    type="text"
                    inputMode="numeric"
                    placeholder="مثال: 10 (الافتراضي)"
                    {...field}
                    value={fieldDisplayValue(field.value)}
                    onChange={(e) => genericIntInputHandler(field, e)}
                    disabled={isAnyAutoBetProcessActive} className="h-10 text-sm" /></FormControl>
                     <div className="grid grid-cols-3 sm:grid-cols-7 gap-1 mt-1 flex-wrap">
                        {PRESET_NUMBER_OF_BETS.map(num => (
                        <Button
                            key={`auto-num-${num}`}
                            type="button"
                            variant="outline"
                            size="xs"
                            onClick={() => handlePresetNumberOfBetsClick(num)}
                            disabled={isAnyAutoBetProcessActive}
                            className="text-xs h-7"
                        >
                            {num}
                        </Button>
                        ))}
                    </div>
                  <FormMessage className="text-xs" />
                </FormItem>
              )} />
              <FormField control={autoBetForm.control} name="cashOutAtMultiplier" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">سحب عند مضاعف (0.05 - 10.00x)</FormLabel>
                  <FormControl>
                     <div className="relative">
                        <Target className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="text"
                          inputMode="decimal"
                          placeholder="مثال: 1.50 (0.05 - 10.00)"
                          {...field}
                          value={fieldDisplayValue(field.value)}
                          onChange={(e) => genericNumericInputHandler(field, e)}
                          disabled={isAnyAutoBetProcessActive}
                          className="pl-9 h-10 text-sm" />
                      </div>
                  </FormControl>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 mt-1 flex-wrap">
                    {PRESET_AUTO_CASHOUT_MULTIPLIERS.map(multi => (
                      <Button
                        key={`auto-cashout-${multi}`}
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={() => handlePresetAutoCashoutMultiplierClick(multi)}
                        disabled={isAnyAutoBetProcessActive}
                        className="text-xs h-7"
                      >
                        {multi.toFixed(2)}x
                      </Button>
                    ))}
                  </div>
                  <FormMessage className="text-xs" />
                </FormItem>
              )} />
              <FormField control={autoBetForm.control} name="stopOnProfit" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">إيقاف إذا تجاوز ربح الجلسة (USDT)</FormLabel>
                  <FormControl>
                     <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="text"
                          inputMode="decimal"
                          placeholder="مثال: 50"
                          {...field}
                          value={fieldDisplayValue(field.value)}
                          onChange={(e) => genericNumericInputHandler(field, e)}
                          disabled={isAnyAutoBetProcessActive}
                          className="pl-9 h-10 text-sm" />
                      </div>
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )} />
              <FormField control={autoBetForm.control} name="stopOnLoss" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">إيقاف إذا تجاوزت خسارة الجلسة (USDT)</FormLabel>
                  <FormControl>
                    <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="text"
                          inputMode="decimal"
                          placeholder="مثال: 20"
                          {...field}
                          value={fieldDisplayValue(field.value)}
                          onChange={(e) => genericNumericInputHandler(field, e)}
                          disabled={isAnyAutoBetProcessActive}
                          className="pl-9 h-10 text-sm" />
                      </div>
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )} />

              {!isAnyAutoBetProcessActive ? (
                <Button
                  type="submit"
                  size="lg"
                  className="w-full h-12 text-lg mt-4"
                  disabled={!(gamePhase === 'idle' || gamePhase === 'crashed' || gamePhase === 'cashedOut') || !autoBetForm.formState.isValid || autoBetStarting}
                >
                  <Zap className="mr-2 h-5 w-5" /> ابدأ اللعب التلقائي
                </Button>
              ) : (
                <Button onClick={() => stopAutoBetCallback('manual')} variant="destructive" size="lg" className="w-full h-12 text-lg mt-4" type="button">
                  <RefreshCcw className="mr-2 h-5 w-5" /> إيقاف اللعب التلقائي ({autoBetStarting ? "جارٍ التهيئة..." : "قيد التشغيل"})
                </Button>
              )}
            </form>
          </Form>
        )}

       {shouldShowAutoBetSessionInfo && (
          <div className="mt-4 p-3 bg-primary/10 rounded-md text-sm">
            <p className="font-semibold text-primary">
                {isAnyAutoBetProcessActive ? "العب التلقائي نشط" : (activeAutoBetSettings ? "انتهت جلسة اللعب التلقائي" : "إعدادات اللعب التلقائي")}
            </p>
            {(activeAutoBetSettings?.betAmount !== undefined && typeof activeAutoBetSettings.betAmount === 'number' && !isNaN(activeAutoBetSettings.betAmount)) ? (
              <p className="text-xs text-muted-foreground">
                مبلغ اللعب للجلسة: {activeAutoBetSettings.betAmount.toFixed(2)} USDT
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                مبلغ اللعب للجلسة: (من إعدادات اللعب اليدوي)
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              الجولات المتبقية: {autoBetRoundsRemaining}
            </p>
             <p className={cn(
              "text-xs tabular-nums",
              autoBetSessionProfit >= 0 ? "text-green-500" : "text-red-500"
            )}>
              ربح الجلسة الحالي: {(autoBetSessionProfit >= 0 ? "+" : "")}{(autoBetSessionProfit ?? 0).toFixed(2)} USDT
            </p>
            {(activeAutoBetSettings?.cashOutAtMultiplier !== undefined && typeof activeAutoBetSettings.cashOutAtMultiplier === 'number' && !isNaN(activeAutoBetSettings.cashOutAtMultiplier)) && (
              <p className="text-xs text-muted-foreground">سحب تلقائي @ {activeAutoBetSettings.cashOutAtMultiplier.toFixed(2)}x</p>
            )}
            {(activeAutoBetSettings?.stopOnProfit !== undefined && typeof activeAutoBetSettings.stopOnProfit === 'number' && !isNaN(activeAutoBetSettings.stopOnProfit)) && (
              <p className="text-xs text-muted-foreground">إيقاف عند الربح: +{activeAutoBetSettings.stopOnProfit.toFixed(2)}</p>
            )}
            {(activeAutoBetSettings?.stopOnLoss !== undefined && typeof activeAutoBetSettings.stopOnLoss === 'number' && !isNaN(activeAutoBetSettings.stopOnLoss)) && (
              <p className="text-xs text-muted-foreground">إيقاف عند الخسارة: -{activeAutoBetSettings.stopOnLoss.toFixed(2)}</p>
            )}
          </div>
        )}
        {(gamePhase === 'betting' && activeGameBetAmount && !isCountdownActive && !isAnyAutoBetProcessActive) && (
          <p className="text-center text-yellow-500 mt-3 text-sm animate-pulse">انتظر بدء اللعبة...</p>
        )}
      </CardContent>
    </Card>
  );
}

