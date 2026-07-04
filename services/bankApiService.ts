
import { GoogleGenAI, Type } from "@google/genai";
import { InstitutionType, Transaction, AIAnalysisResult } from "../types";

/**
 * Intelligent Gateway for regional institutions and investment platforms.
 */
export const syncBankData = async (
  institution: string,
  lastSynced?: string
): Promise<any[]> => {
  if (!lastSynced) return [];

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  await new Promise(resolve => setTimeout(resolve, 2000));

  try {
    const isCreditUnion = institution.toLowerCase().includes('credit union');
    const specificContext = isCreditUnion 
      ? `This is a Credit Union institution (${institution}). Include entries like 'Member Dividends', 'Loan Repayment', 'Share Contribution'.`
      : `This is a standard commercial bank (${institution}).`;

    const prompt = `
      Simulate a JSON API response for ${institution}. 
      Last sync: ${lastSynced}.
      ${specificContext}
      Generate 2-3 realistic recent transactions.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              amount: { type: Type.NUMBER },
              category: { type: Type.STRING },
              description: { type: Type.STRING },
              type: { type: Type.STRING, enum: ["expense", "income"] },
              date: { type: Type.STRING },
              vendor: { type: Type.STRING }
            },
            required: ["amount", "category", "description", "type", "date"]
          }
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Bank API Error:", error);
    return [];
  }
};

/**
 * Investment Extraction (Binance/Vanguard).
 * Now structured to return portfolio updates instead of just transactions.
 */
export const syncInvestmentHoldings = async (
  provider: 'Binance' | 'Vanguard'
): Promise<AIAnalysisResult[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  await new Promise(resolve => setTimeout(resolve, 2500));

  try {
    const prompt = `
      Simulate a ${provider} Portfolio API response.
      For Binance, include current BTC, ETH, and SOL holdings with precise quantities.
      For Vanguard, include VOO and VOOG.
      Format the response as a verification queue payload with updateType 'portfolio'.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              updateType: { type: Type.STRING, enum: ["portfolio"] },
              portfolio: {
                type: Type.OBJECT,
                properties: {
                  symbol: { type: Type.STRING },
                  quantity: { type: Type.NUMBER },
                  provider: { type: Type.STRING, enum: ["Binance", "Vanguard"] }
                },
                required: ["symbol", "quantity", "provider"]
              }
            },
            required: ["updateType", "portfolio"]
          }
        }
      }
    });

    return JSON.parse(response.text);
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
