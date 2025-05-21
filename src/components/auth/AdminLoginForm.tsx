
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, LogIn } from "lucide-react";
import { checkAdminCredentials, setAdminLoggedInCookie } from "@/lib/admin-auth";
import { useRouter } from "next/navigation";

const adminLoginFormSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(1, { message: "Password is required." }), // Admin password can be simple
});

type AdminLoginFormValues = z.infer<typeof adminLoginFormSchema>;

interface AdminLoginFormProps {
  onLoginSuccess: () => void;
}

export function AdminLoginForm({ onLoginSuccess }: AdminLoginFormProps) {
  const { toast } = useToast();
  const router = useRouter();
  const form = useForm<AdminLoginFormValues>({
    resolver: zodResolver(adminLoginFormSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: AdminLoginFormValues) => {
    const isAdmin = checkAdminCredentials(data.email, data.password);

    if (isAdmin) {
      setAdminLoggedInCookie(true);
      toast({
        title: "Admin Login Successful!",
        description: "Redirecting to admin panel...",
      });
      onLoginSuccess(); // This will typically be a redirect to /admin
    } else {
      toast({
        title: "Admin Login Failed",
        description: "Invalid admin credentials.",
        variant: "destructive",
      });
      form.setError("email", { type: "manual", message: " " }); // Clear previous specific error
      form.setError("password", { type: "manual", message: "Invalid admin credentials." });
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
              <FormLabel className="text-base">Admin Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="admin@example.com" {...field} className="h-12 text-base"/>
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
              <FormLabel className="text-base">Admin Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="••••••••" {...field} className="h-12 text-base"/>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full h-12 text-lg bg-primary hover:bg-primary/90" disabled={form.formState.isSubmitting}>
          <ShieldCheck className="mr-2 h-5 w-5" />
          {form.formState.isSubmitting ? "Logging in..." : "Login as Admin"}
        </Button>
      </form>
    </Form>
  );
}
