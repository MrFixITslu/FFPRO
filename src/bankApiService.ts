
/**
 * Gateway for regional institutions and investment platforms.
 *
 * `syncBankData` and `syncInvestmentHoldings` used to ask Gemini to
 * *fabricate* plausible-looking transactions/holdings as a stand-in for a
 * real bank/brokerage API integration. Neither is currently called anywhere
 * in the app (grep confirms it), so they were removed rather than ported to
 * a non-AI stub — inventing fake financial data was never something to
 * replace with an equivalent, just something to not do. If real bank/broker
 * API integration is wanted later, this is the file to build it in.
 */

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
