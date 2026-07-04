
import { GoogleGenAI, Type } from "@google/genai";
import { AIAnalysisResult, CATEGORIES } from "../types";

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    updateType: { type: Type.STRING, enum: ['transaction', 'portfolio'], description: "Determine if this is a spending/earning event or a statement of current holdings (e.g., 'I have 0.5 BTC')." },
    transaction: {
      type: Type.OBJECT,
      properties: {
        amount: { type: Type.NUMBER, description: "Total amount including tax." },
        category: { type: Type.STRING, description: "One of the provided financial categories." },
        description: { type: Type.STRING, description: "A friendly summary of the purchase." },
        type: { type: Type.STRING, enum: ['expense', 'income', 'savings', 'withdrawal'], description: "The nature of the transaction." },
        date: { type: Type.STRING, description: "ISO date format (YYYY-MM-DD)." },
        vendor: { type: Type.STRING, description: "The merchant or business name extracted from the header." },
        lineItems: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "Name of the individual product or service." },
              price: { type: Type.NUMBER, description: "Unit price or total for this item row." },
              quantity: { type: Type.NUMBER, description: "Number of units purchased." }
            }
          },
          description: "A detailed list of every item listed on the receipt."
        }
      }
    },
    portfolio: {
      type: Type.OBJECT,
      properties: {
        symbol: { type: Type.STRING, description: "Ticker symbol like BTC, ETH, or VOO." },
        quantity: { type: Type.NUMBER, description: "The total amount held." },
        provider: { type: Type.STRING, enum: ['Binance', 'Vanguard'], description: "The institution where the asset is held." }
      }
    }
  },
  required: ["updateType"]
};

export const parseInputToTransaction = async (
  input: string | { data: string; mimeType: string },
  isMedia: boolean = false
): Promise<AIAnalysisResult | null> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const contents = isMedia 
      ? { 
          parts: [
            { inlineData: input as { data: string; mimeType: string } }, 
            { text: "CRITICAL: Perform deep OCR on this receipt. 1. Identify the Merchant/Vendor name. 2. Extract every single line item, its quantity, and price. 3. Determine the total amount. 4. If it's a balance statement (e.g. 'Binance shows 1 BTC'), use portfolio update. Otherwise, use transaction." }
          ] 
        }
      : { parts: [{ text: `Analyze this financial intent: "${input}". Extract merchant, items, and total amount.` }] };

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: SCHEMA,
        systemInstruction: `You are an elite Receipt & Financial Parsing Engine. 
        Your goal is 100% accuracy in merchant detection and line-item extraction. 
        Categories available: ${CATEGORIES.join(", ")}. 
        Always return structured JSON. 
        For receipts, always populate the 'vendor' and 'lineItems' fields with high detail.`
      }
    });

    const text = response.text;
    return text ? JSON.parse(text) : null;
  } catch (error) {
    console.error("Gemini Error:", error);
    return null;
  }
};

export const parseStatementToTransactions = async (
  fileData: { data: string; mimeType: string }
): Promise<AIAnalysisResult[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { 
        parts: [
          { inlineData: fileData }, 
          { text: "Extract every individual transaction from this bank statement. For each row, identify the merchant and the total value." }
        ] 
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: SCHEMA
        }
      }
    });

    const text = response.text;
    return text ? JSON.parse(text) : [];
  } catch (error) {
    console.error("Statement Parsing Error:", error);
    return [];
  }
};
