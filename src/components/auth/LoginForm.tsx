"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { LogIn, AlertTriangle, Gift, PartyPopper } from "lucide-react"; 
import { loginUser } from "@/lib/user-auth"; 
import { isUserBlocked } from "@/lib/user-status"; 
import { getSiteSettings } from "@/lib/site-settings-storage"; 

const loginFormSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string()
    .min(8, { message: "Password must be at least 8 characters." })
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

interface LoginFormProps {
  onLoginSuccess: () => void;
}

export function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const { toast } = useToast();
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    const result = loginUser(data.email, data.password);

    if (result.success && result.user) {
        if(result.user.isBlocked) { 
            toast({
                title: "Login Failed",
                description: "This account has been blocked.",
                variant: "destructive",
                icon: <AlertTriangle className="h-5 w-5" />,
            });
            form.setError("email", { type: "manual", message: "Account blocked." });
            return;
        }
      toast({
        title: "Login Successful!",
        description: result.message,
      });
      
      const siteSettings = getSiteSettings(); 
      // Initial referral reminder on login
      toast({
        title: "Refer & Earn!",
        description: `Invite friends to Sky High USDT and get ${siteSettings.referralBonusPercent}% commission from their deposits! Your friend also gets ${siteSettings.newPlayerBonusUSDT.toFixed(2)} USDT bonus.`,
        variant: "default",
        icon: <Gift className="h-5 w-5 text-primary" />,
        duration: 10000, // Show for 10 seconds
      });

      onLoginSuccess();
    } else {
      toast({
        title: "Login Failed",
        description: result.message, 
        variant: "destructive",
      });
      form.setError("email", { type: "manual", message: " " }); 
      form.setError("password", { type: "manual", message: result.message });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-base">Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="you@example.com" {...field} className="h-12 text-base"/>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-base">Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="••••••••" {...field} className="h-12 text-base"/>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full h-12 text-lg" disabled={form.formState.isSubmitting}>
          <LogIn className="mr-2 h-5 w-5" />
          {form.formState.isSubmitting ? "Logging in..." : "Login"}
        </Button>
      </form>
    </Form>
  );
}
