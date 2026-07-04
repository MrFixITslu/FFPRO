
export type TransactionType = 'expense' | 'income' | 'savings' | 'withdrawal' | 'transfer';
export type InstitutionType = 'bank' | 'credit_union' | 'investment';

export interface User {
  id: string;
  name: string;
  role: 'admin' | 'collaborator';
  avatar?: string;
  online: boolean;
}

export interface StoredUser {
  username: string;
  password?: string; // Only stored locally for this demo
  role: 'admin' | 'collaborator';
  createdAt: string;
}

export interface LineItem {
  name: string;
  price: number;
  quantity?: number;
}

export interface BankConnection {
  institution: string;
  institutionType: InstitutionType;
  status: 'linked' | 'unlinked' | 'syncing';
  lastSynced?: string;
  accountLastFour?: string;
  openingBalance: number;
}

export interface Holding {
  symbol: string;
  quantity: number;
  purchasePrice: number;
}

export interface InvestmentAccount {
  id: string;
  provider: 'Binance' | 'Vanguard';
  name: string;
  holdings: Holding[];
}

export interface MarketPrice {
  symbol: string;
  price: number;
  change24h: number;
}

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  category: string;
  description: string;
  type: TransactionType;
  notes?: string;
  vendor?: string;
  lineItems?: LineItem[];
  recurringId?: string;
  savingGoalId?: string;
  institution?: string;
  destinationInstitution?: string; 
}

export interface PortfolioUpdate {
  symbol: string;
  quantity: number;
  provider: 'Binance' | 'Vanguard';
}

export interface AIAnalysisResult {
  updateType: 'transaction' | 'portfolio';
  transaction?: {
    amount: number;
    category: string;
    description: string;
    type: TransactionType;
    notes?: string;
    date?: string;
    vendor?: string;
    lineItems?: LineItem[];
  };
  portfolio?: PortfolioUpdate;
}

export interface SavingGoal {
  id: string;
  name: string;
  institution: string;
  institutionType: 'bank' | 'credit_union';
  targetAmount: number;
  currentAmount: number;
  openingBalance: number;
  category: string;
}

export interface InvestmentGoal {
  id: string;
  name: string;
  targetAmount: number;
  provider: string;
}

export interface RecurringExpense {
  id: string;
  amount: number;
  category: string;
  description: string;
  dayOfMonth: number;
  nextDueDate: string; 
  accumulatedOverdue: number; 
  lastBilledDate?: string;
  externalPortalUrl?: string; 
  externalSyncEnabled?: boolean;
  isSubscription?: boolean;
}

export interface RecurringIncome {
  id: string;
  amount: number;
  category: string;
  description: string;
  dayOfMonth: number;
  nextConfirmationDate: string; 
  lastConfirmedDate?: string;
  accumulatedReceived?: number; 
}

export interface Contact {
  id: string;
  name: string;
  number: string;
  email: string;
  address?: string;
}

export interface ProjectNote {
  id: string;
  text: string;
  timestamp: string;
  authorId: string;
  version: number;
}

export interface ProjectTask {
  id: string;
  text: string;
  completed: boolean;
  dueDate?: string;
  completionDate?: string;
  assignedToId?: string;
  subTasks?: ProjectTask[]; 
}

export interface ProjectFile {
  id: string;
  name: string;
  type: string;
  size: number;
  timestamp: string;
  storageRef: string;
  storageType: 'indexeddb' | 'filesystem' | 'url';
  version: number;
  lastModifiedBy: string;
}

export interface IOU {
  id: string;
  contactId: string;
  amount: number;
  description: string;
  type: 'debt' | 'claim';
  settled: boolean;
}

export interface EventLog {
  id: string;
  action: string;
  timestamp: string;
  username: string;
  type: 'system' | 'transaction' | 'task' | 'file' | 'team' | 'contact';
}

export interface BudgetEvent {
  id: string;
  name: string;
  date: string;
  items: EventItem[];
  notes: ProjectNote[];
  tasks: ProjectTask[];
  files: ProjectFile[];
  contactIds: string[];
  memberUsernames: string[]; 
  ious: IOU[];
  logs?: EventLog[];
  status: 'planned' | 'active' | 'completed';
  outcome?: 'success' | 'failed';
  lessonsLearnt?: string;
  projectedBudget?: number;
  lastUpdated: string;
  activeCollaborators?: string[];
}

export interface CalendarItem {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  type: 'meeting' | 'reminder' | 'event';
  startTime?: string;
  description?: string;
  recurring: 'none' | 'daily' | 'weekly' | 'monthly';
  completed?: boolean;
}

export interface EventItem {
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  notes?: string;
  date: string;
  splitWithContactIds?: string[];
}

export interface NetWorthSnapshot {
  date: string;
  value: number;
}

export const CATEGORIES = [
  'Food', 'Transport', 'Housing', 'Entertainment', 'Utilities', 
  'Health', 'Shopping', 'Education', 'Personal', 'Income', 'Savings', 'Other', 'Investments', 'Transfer'
];

export const EVENT_ITEM_CATEGORIES = [
  'Venue', 'Catering', 'Decor', 'Entertainment', 'Staff', 'Marketing', 'Tickets', 'Donation', 'Other'
];

export type EventItemCategory = typeof EVENT_ITEM_CATEGORIES[number];

export const STORAGE_KEYS = {
  TRANSACTIONS: 'budget_transactions',
  RECURRING_EXPENSES: 'budget_recurring',
  RECURRING_INCOMES: 'budget_recurring_incomes',
  SAVINGS_GOALS: 'budget_savings_goals',
  INVESTMENT_GOALS: 'budget_investment_goals',
  SALARY: 'budget_salary',
  CASH_OPENING: 'budget_cash_opening',
  CATEGORY_LIMITS: 'budget_category_limits',
  BANK_CONNECTIONS: 'budget_bank_conns',
  INVESTMENTS: 'budget_investments',
  EVENTS: 'budget_events',
  CALENDAR_ITEMS: 'budget_calendar_items',
  CONTACTS: 'ff_contacts',
  NETWORTH_HISTORY: 'ff_networth_history',
  AUTH: 'ff_auth',
  AUTH_USER: 'ff_auth_username',
  USERS_LIST: 'ff_users_list',
  REMINDERS: 'ff_reminders_enabled',
  PASSWORD: 'ff_custom_password'
};
