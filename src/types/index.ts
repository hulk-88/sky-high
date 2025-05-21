
export type GamePhase = 'idle' | 'betting' | 'playing' | 'crashed' | 'cashedOut';


export interface GameHistoryEntry {
  id: string;
  betAmount: number;
  outcome: 'crashed' | 'cashedOut';
  outcomeMultiplier: number;
  profit: number;
  timestamp: number; 
}

export interface ReferredUserDetail {
  userId: string;
  email: string;
  username?: string; 
  totalDepositedApproved: number; 
  metMinimumDepositThreshold: boolean; 
  joinedDate: string;
  receivedSignupBonus?: boolean; 
}

export interface Obstacle {
  id: string;
  x: number; 
  y: number; 
  type: 'missile'; 
  width: number;
  height: number;
  speedX?: number; 
  spawnTime: number; 
  lifetimeLeft: number; 
}

export interface AutoBetSettings {
  numberOfBets: number;
  betAmount: number;
  cashOutAtMultiplier: number;
  stopOnProfit: number;
  stopOnLoss: number; 
}

export interface GameState {
  gamePhase: GamePhase;
  multiplier: number;
  betAmount: number | null;
  startTime: number | null;
  currentProfit: number | null;
  userBalance: number; // This will represent the currently active balance (real or demo)
  lastMultiplier: number | null; 
  loggedInUser?: User | null; 
  gameHistory: GameHistoryEntry[];
  planePosition: { x: number, y: number, width: number, height: number }; 
  obstacles: Obstacle[]; 
  countdownSeconds: number | null; 
  
  isAutoBetting: boolean;
  autoBetStarting: boolean; 
  autoBetSettings: AutoBetSettings | null;
  autoBetRoundsRemaining: number;
  autoBetSessionProfit: number;

  isDemoMode: boolean; 
  demoBalance: number; 

  currentBetWasAuto: boolean; // True if the active bet was initiated by an auto-bet sequence
  currentBetAutoCashOutTarget: number | null; // The specific cash-out multiplier for the current auto-bet round
}


export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string; 
  balance: number;
  isBlocked: boolean;
  joinedDate: string; 
  referralCode: string;
  referredByCode?: string; 
  
  referredUsers: ReferredUserDetail[]; 
  successfulReferralsCount: number; 

  lastWithdrawalDate?: string; 
  amountWithdrawnToday?: number; 

  referralCodeLinkClicks?: number; 
}

export type TransactionStatus = 'pending' | 'approved' | 'rejected';
export type TransactionType = 
  | 'deposit' 
  | 'withdrawal' 
  | 'bet' 
  | 'win' 
  | 'referral_bonus' 
  | 'new_player_bonus' 
  | 'admin_credit' 
  | 'bet_lost'
  | 'spin_win'; // Added spin_win


export interface AdminTransaction {
  id: string;
  userId: string; 
  userEmail?: string; 
  type: TransactionType;
  amount: number; 
  address?: string; 
  transferProofImage?: string; 
  status: TransactionStatus;
  timestamp: number;
  processedBy?: string; 
  processedAt?: number;
  commissionApplied?: number; 
  amountCredited?: number; 
  outcomeMultiplier?: number; // For game-related transactions (win/loss)
  
  // Fields to track referral bonus applied to the referrer
  referredUserBonusAppliedTo?: string; // Email of the referrer who got the bonus
  referralBonusToReferrerAmount?: number; // Amount of bonus given to the referrer

  // Field to track new player bonus applied to the depositing user
  newPlayerBonusToDepositingUserAmount?: number;
  notes?: string; // Optional notes for admin, e.g., for admin_credit or spin_win
}

export type SupportTicketCleanupInterval = '7_days' | '1_month' | '5_months' | 'never';

export interface AdminSiteSettings {
  minBet: number;
  maxBet: number;
  gameDifficultyPercent: number; 
  maintenanceMode: boolean;
  referralBonusPercent: number; 
  newPlayerBonusUSDT: number; 
  enableAntiBot: boolean;
  captchaSiteKey: string;
  rateLimitRequestsPerMin: number;
  referralMinDepositForBonus: number; 
  referralFixedBonusAmount: number; 
  supportTicketCleanupInterval: SupportTicketCleanupInterval;
  platformDepositFeePercent: number; 
}


export const SOUND_FILES = {
  WIN: '/sounds/win.mp3',
  LOSE: '/sounds/lose.mp3',
  EXPLOSION: '/sounds/explosion.mp3',
  PLANE_FLYING: '/sounds/plane_flying.mp3',
  MISSILE_SPAWN: '/sounds/missile_spawn.mp3',
  BET_PLACED: '/sounds/bet_placed.mp3', 
  AUTO_BET_START: '/sounds/auto_bet_start.mp3', 
  SPIN_CLICK: '/sounds/spin_click.mp3', // Sound for spin click
  SPIN_LAND: '/sounds/spin_land.mp3', // Sound for when spin lands on prize
};

export interface SupportMessageAttachment {
  name: string;
  type: string; 
  dataUrl: string;
}

export interface SupportTicketMessage {
  id: string;
  sender: 'user' | 'admin' | 'system';
  text: string;
  attachments?: SupportMessageAttachment[]; 
  timestamp: number;
}
export interface SupportTicket {
  id: string;
  userId: string;
  userEmail: string;
  subject?: string; 
  messages: SupportTicketMessage[]; 
  status: 'open' | 'pending_user_reply' | 'pending_admin_reply' | 'closed';
  createdAt: number;
  updatedAt: number;
}

export interface TopReferrerStat {
  rank: number;
  userId: string;
  username: string;
  email: string;
  successfulReferrals: number;
  totalCommissionEarned: number;
  totalReferredUsersCount: number; 
}
    
export interface SpinPrize {
  value: number;
  label: string;
  color: string; // Tailwind background color class e.g., 'bg-blue-500'
  weight: number;
}
