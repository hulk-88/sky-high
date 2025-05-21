
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { UserPlus } from "lucide-react";
import { registerUser } from "@/lib/user-auth"; // Import new auth function
import { useEffect } from "react";

const signupFormSchema = z.object({
  username: z.string()
    .min(3, { message: "Username must be at least 3 characters." })
    .regex(/^[a-zA-Z0-9]+$/, { message: "Username can only contain letters and numbers (no spaces)." })
    .refine(value => /[a-zA-Z]/.test(value) && /[0-9]/.test(value), {message: "Username must include both letters and numbers."}),
  email: z.string()
    .email({ message: "Invalid email address." })
    .endsWith("@gmail.com", { message: "Email must be a @gmail.com address." }),
  password: z.string()
    .min(8, { message: "Password must be at least 8 characters." })
    .refine(value => /[a-zA-Z]/.test(value) && /[0-9]/.test(value), {
      message: "Password must contain at least one letter and one number.",
    }),
  confirmPassword: z.string(),
  referralCode: z.string().optional(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match.",
  path: ["confirmPassword"], // path to show error under confirmPassword field
});

type SignupFormValues = z.infer<typeof signupFormSchema>;

interface SignupFormProps {
  onSignupSuccess: () => void;
  initialReferralCode?: string | null;
}

export function SignupForm({ onSignupSuccess, initialReferralCode }: SignupFormProps) {
  const { toast } = useToast();
  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupFormSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      referralCode: initialReferralCode || "",
    },
  });

  useEffect(() => {
    if (initialReferralCode) {
      form.setValue("referralCode", initialReferralCode);
    }
  }, [initialReferralCode, form]);

  const onSubmit = async (data: SignupFormValues) => {
    form.clearErrors(); 
    const registrationData = {
      username: data.username,
      email: data.email,
      passwordHash: data.password, // Storing plain text for mock
      referredByCode: data.referralCode || undefined,
    };

    const result = registerUser(registrationData);

    if (result.success) {
      toast({
        title: "Signup Successful!",
        description: result.message,
      });
      onSignupSuccess();
    } else {
      toast({
        title: "Signup Failed",
        description: result.message,
        variant: "destructive",
      });
      if (result.message.toLowerCase().includes("email")) {
        form.setError("email", { type: "manual", message: result.message });
      } else if (result.message.toLowerCase().includes("username")) {
         form.setError("username", { type: "manual", message: result.message });
      } else if (result.message.toLowerCase().includes("referral code")) {
        form.setError("referralCode", {type: "manual", message: result.message });
      }
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-base">Username</FormLabel>
              <FormControl>
                <Input placeholder="e.g. player123" {...field} className="h-12 text-base"/>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-base">Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="you@gmail.com" {...field} className="h-12 text-base"/>
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
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-base">Confirm Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="••••••••" {...field} className="h-12 text-base"/>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="referralCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-base">Referral Code (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="Enter referral code" {...field} className="h-12 text-base"/>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full h-12 text-lg" disabled={form.formState.isSubmitting}>
          <UserPlus className="mr-2 h-5 w-5" />
          {form.formState.isSubmitting ? "Signing up..." : "Sign Up"}
        </Button>
      </form>
    </Form>
  );
}
