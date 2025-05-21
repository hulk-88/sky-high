
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DepositDialog } from "./DepositDialog";
import { WithdrawDialog } from "./WithdrawDialog";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";

interface WalletActionsProps {
  onDeposit: (amount: number, transferProofImage: string | null) => Promise<boolean>;
  onWithdraw: (amount: number, address: string) => Promise<boolean>;
}

export function WalletActions({ onDeposit, onWithdraw }: WalletActionsProps) {
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);

  return (
    <>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setIsDepositOpen(true)} title="Deposit USDT">
          <ArrowDownToLine className="mr-2 h-4 w-4" /> Deposit
        </Button>
        <Button variant="outline" onClick={() => setIsWithdrawOpen(true)} title="Withdraw USDT">
          <ArrowUpFromLine className="mr-2 h-4 w-4" /> Withdraw
        </Button>
      </div>

      <DepositDialog
        isOpen={isDepositOpen}
        onOpenChange={setIsDepositOpen}
        onDeposit={async (amount, transferProofImage) => {
          const success = await onDeposit(amount, transferProofImage);
          if (success) setIsDepositOpen(false);
          return success;
        }}
      />
      <WithdrawDialog
        isOpen={isWithdrawOpen}
        onOpenChange={setIsWithdrawOpen}
        onWithdraw={async (amount, address) => {
           const success = await onWithdraw(amount, address);
           if (success) setIsWithdrawOpen(false);
           return success;
        }}
      />
    </>
  );
}
