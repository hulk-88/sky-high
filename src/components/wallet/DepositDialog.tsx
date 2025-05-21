
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Copy, UploadCloud } from "lucide-react";
import { useState, useEffect, useRef } from "react";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_FILE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

const depositFormSchema = z.object({
  amount: z.coerce.number().positive({ message: "Amount must be positive." }),
  transferProof: z
    .custom<FileList | null>((val) => val instanceof FileList || val === null, "Please upload an image file.")
    .refine((files) => files && files.length > 0, { message: "Transfer proof image is required." })
    .refine((files) => files && files[0]?.size <= MAX_FILE_SIZE, { message: `Max file size is 5MB.`})
    .refine((files) => files && ALLOWED_FILE_TYPES.includes(files[0]?.type), { message: "Only .jpg, .jpeg, .png, .gif and .webp formats are supported."})
    .nullable(),
});

type DepositFormValues = z.infer<typeof depositFormSchema>;

interface DepositDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onDeposit: (amount: number, transferProofImage: string | null) => Promise<boolean>;
}

const MOCK_DEPOSIT_ADDRESS = "TDKeWZ7NZaEkQEVvvSKrdrMhC5V8P8b9cW";

export function DepositDialog({ isOpen, onOpenChange, onDeposit }: DepositDialogProps) {
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);
  
  const form = useForm<DepositFormValues>({
    resolver: zodResolver(depositFormSchema),
    defaultValues: {
      amount: 100,
      transferProof: null,
    },
  });

  const onSubmit = async (data: DepositFormValues) => {
    if (!data.transferProof || data.transferProof.length === 0) {
      toast({ title: "Missing Image", description: "Please upload a transfer proof image.", variant: "destructive" });
      return;
    }

    const file = data.transferProof[0];
    const reader = new FileReader();
    reader.onloadend = async () => {
      const imageDataUri = reader.result as string;
      const success = await onDeposit(data.amount, imageDataUri);
      if (success) {
        form.reset();
        setPreviewImage(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = ""; // Reset file input
        }
      }
    };
    reader.onerror = () => {
        toast({ title: "File Read Error", description: "Could not read the image file.", variant: "destructive" });
    }
    reader.readAsDataURL(file);
  };

  const handleCopyAddress = () => {
    if (!isClient) return;
    navigator.clipboard.writeText(MOCK_DEPOSIT_ADDRESS)
      .then(() => {
        toast({ title: "Address Copied!", description: "Deposit address copied to clipboard." });
      })
      .catch(err => {
        toast({ title: "Copy Failed", description: "Could not copy address.", variant: "destructive" });
        console.error('Failed to copy: ', err);
      });
  };
  
  if (!isClient) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) {
            form.reset();
            setPreviewImage(null);
            if (fileInputRef.current) {
              fileInputRef.current.value = "";
            }
        }
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl">Deposit USDT (TRC20)</DialogTitle>
          <DialogDescription>
            Send USDT to the address below. Then enter the amount sent and upload proof of transfer.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="deposit-address" className="text-sm font-medium">Your Unique Deposit Address:</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input id="deposit-address" value={MOCK_DEPOSIT_ADDRESS} readOnly className="bg-muted"/>
              <Button variant="outline" size="icon" onClick={handleCopyAddress} title="Copy Address">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Only send USDT (TRC20 network) to this address.</p>
            <p className="text-xs text-red-500 mt-1">Note: A 2% fee is applied to all deposits by the platform.</p>
          </div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">Amount Deposited</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="Enter amount" {...field} className="h-12 text-base"/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="transferProof"
                render={({ field: { onChange, value, ...rest } }) => (
                  <FormItem>
                    <FormLabel className="text-base">Transfer Proof Image</FormLabel>
                    <FormControl>
                       <div className="flex flex-col items-center justify-center w-full">
                        <label
                            htmlFor="dropzone-file"
                            className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg cursor-pointer bg-muted hover:bg-muted/80 dark:bg-card dark:hover:bg-border"
                        >
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <UploadCloud className="w-8 h-8 mb-2 text-muted-foreground" />
                                {previewImage ? (
                                    <img src={previewImage} alt="Preview" className="max-h-20 rounded-md object-contain" data-ai-hint="image preview" />
                                ) : (
                                    <>
                                    <p className="mb-1 text-sm text-muted-foreground">
                                        <span className="font-semibold">Click to upload</span> or drag and drop
                                    </p>
                                    <p className="text-xs text-muted-foreground">PNG, JPG, GIF, WEBP (MAX. 5MB)</p>
                                    </>
                                )}
                            </div>
                            <Input 
                                {...rest}
                                id="dropzone-file" 
                                type="file" 
                                className="hidden" 
                                accept={ALLOWED_FILE_TYPES.join(",")}
                                ref={fileInputRef}
                                onChange={(event) => {
                                    const files = event.target.files;
                                    if (files && files.length > 0) {
                                        const file = files[0];
                                        if (ALLOWED_FILE_TYPES.includes(file.type) && file.size <= MAX_FILE_SIZE) {
                                            const reader = new FileReader();
                                            reader.onloadend = () => {
                                                setPreviewImage(reader.result as string);
                                            };
                                            reader.readAsDataURL(file);
                                        } else {
                                            setPreviewImage(null); // Clear preview if invalid
                                        }
                                        onChange(files); // Pass to RHF
                                    } else {
                                        setPreviewImage(null);
                                        onChange(null);
                                    }
                                }}
                            />
                        </label>
                        </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="sm:justify-between">
                <Button type="button" variant="outline" onClick={() => {
                    onOpenChange(false);
                    form.reset();
                    setPreviewImage(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
                }}>Cancel</Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? "Processing..." : "Confirm Deposit"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

