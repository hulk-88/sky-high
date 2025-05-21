
"use client";

import type { GameHistoryEntry } from "@/types";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from 'date-fns';
import { TrendingUp, TrendingDown, MinusCircle } from "lucide-react";

interface GameHistoryTableProps {
  history: GameHistoryEntry[];
}

export function GameHistoryTable({ history }: GameHistoryTableProps) {
  if (!history || history.length === 0) {
    return (
      <Card className="mt-6 shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl">Recent Plays</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No game history yet. Place a bet to start!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-6 shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl">Recent Plays</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead className="text-right">Bet (USDT)</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead className="text-right">Multiplier</TableHead>
                <TableHead className="text-right">Profit (USDT)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(new Date(entry.timestamp), "HH:mm:ss")}
                  </TableCell>
                  <TableCell className="text-right font-medium">{entry.betAmount.toFixed(2)}</TableCell>
                  <TableCell>
                    <span className={`capitalize px-2 py-1 text-xs rounded-full ${
                      entry.outcome === 'cashedOut' ? 'bg-accent/20 text-accent' : 'bg-destructive/20 text-destructive'
                    }`}>
                      {entry.outcome}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{entry.outcomeMultiplier.toFixed(2)}x</TableCell>
                  <TableCell className={`text-right font-semibold flex items-center justify-end ${
                    entry.profit > 0 ? 'text-accent' : entry.profit < 0 ? 'text-destructive' : 'text-muted-foreground'
                  }`}>
                    {entry.profit > 0 ? <TrendingUp className="mr-1 h-4 w-4" /> : entry.profit < 0 ? <TrendingDown className="mr-1 h-4 w-4" /> : <MinusCircle className="mr-1 h-4 w-4" />}
                    {entry.profit.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
