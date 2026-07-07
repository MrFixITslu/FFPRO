
import { InstitutionType, Transaction, AIAnalysisResult } from "../types";

/**
 * Intelligent Gateway for regional institutions and investment platforms.
 * FIX: Now uses backend endpoint instead of direct API calls
 */
export const syncBankData = async (
  institution: string,
  lastSynced?: string
): Promise<any[]> => {
  if (!lastSynced) return [];

  try {
    const response = await fetch('/api/ai/bank-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ institution, lastSynced })
    });

    if (!response.ok) {
      console.error('Bank sync error:', response.statusText);
      return [];
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Bank API Error:", error);
    return [];
  }
};

/**
 * Investment Extraction (Binance/Vanguard).
 * FIX: Now uses backend endpoint instead of direct API calls
 */
export const syncInvestmentHoldings = async (
  provider: 'Binance' | 'Vanguard'
): Promise<AIAnalysisResult[]> => {
  try {
    const response = await fetch('/api/ai/investment-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ provider })
    });

    if (!response.ok) {
      console.error('Investment sync error:', response.statusText);
      return [];
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Investment Sync Error:", error);
    return [];
  }
};

export const syncLucelecPortal = async (): Promise<{ balance: number; dueDate: string } | null> => {
  console.log("Navigating to LUCELEC portal...");
  await new Promise(r => setTimeout(r, 1000));
  const mockBalance = Math.floor(Math.random() * 150) + 85.50;
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  nextMonth.setDate(25);
  
  return {
    balance: mockBalance,
    dueDate: nextMonth.toISOString().split('T')[0]
  };
};

export const verifyApiConnection = async (credentials: any, institution: string): Promise<boolean> => {
  return new Promise((resolve) => {
    setTimeout(() => resolve(true), 1500);
  });
};
