import { Router } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

// FIX: Move Gemini API to backend to protect API key
// API_KEY is now server-side only and never exposed to frontend

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

const CATEGORIES = ['Food', 'Transport', 'Housing', 'Entertainment', 'Utilities', 'Health', 'Shopping', 'Education', 'Personal', 'Income', 'Savings', 'Other', 'Investments', 'Transfer'];

// Validate MIME type (FIX: Add MIME type validation)
function validateMimeType(mimeType) {
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif'
  ];
  return allowedTypes.includes(mimeType);
}

router.use(requireAuth);

// Parse receipt image or financial text input
router.post('/parse', async (req, res) => {
  const { input, isMedia = false } = req.body || {};
  
  if (!input) {
    return res.status(400).json({ error: 'Input is required.' });
  }

  if (!process.env.API_KEY) {
    console.error('API_KEY not configured');
    return res.status(500).json({ error: 'AI service not configured.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    let contents;
    if (isMedia) {
      // FIX: Validate MIME type before sending to API
      if (!input.mimeType || !validateMimeType(input.mimeType)) {
        return res.status(400).json({ error: 'Invalid image format. Only JPEG, PNG, WebP, GIF, HEIC, HEIF are supported.' });
      }
      if (!input.data || typeof input.data !== 'string') {
        return res.status(400).json({ error: 'Invalid media data.' });
      }
      
      contents = {
        parts: [
          { inlineData: { data: input.data, mimeType: input.mimeType } },
          { text: "CRITICAL: Perform deep OCR on this receipt. 1. Identify the Merchant/Vendor name. 2. Extract every single line item, its quantity, and price. 3. Determine the total amount. 4. If it's a balance statement (e.g. 'Binance shows 1 BTC'), use portfolio update. Otherwise, use transaction." }
        ]
      };
    } else {
      if (typeof input !== 'string' || input.length > 1000) {
        return res.status(400).json({ error: 'Text input must be a string under 1000 characters.' });
      }
      contents = {
        parts: [{ text: `Analyze this financial intent: "${input}". Extract merchant, items, and total amount.` }]
      };
    }

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
    if (!text) {
      return res.status(500).json({ error: 'Failed to parse input.' });
    }

    try {
      const parsed = JSON.parse(text);
      res.json(parsed);
    } catch (parseErr) {
      console.error('JSON parse error from Gemini:', parseErr);
      res.status(500).json({ error: 'Failed to parse AI response.' });
    }
  } catch (error) {
    console.error('Gemini AI Error:', error);
    res.status(500).json({ error: 'Failed to process request with AI service.' });
  }
});

// Get market data via AI with Google Search
router.post('/market-data', async (req, res) => {
  if (!process.env.API_KEY) {
    console.error('API_KEY not configured');
    return res.status(500).json({ error: 'AI service not configured.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: "Provide current market prices and 24h change for BTC, ETH, SOL, VOO, and VOOG.",
      config: { tools: [{ googleSearch: {} }] }
    });

    // Parse response into market data structure
    const text = response.text;
    if (!text) {
      return res.json({ prices: [], quotaExhausted: false });
    }

    try {
      // Attempt to extract prices from response text
      const prices = [];
      const symbols = ['BTC', 'ETH', 'SOL', 'VOO', 'VOOG'];
      
      for (const symbol of symbols) {
        const priceMatch = text.match(new RegExp(`${symbol}[^0-9]*([0-9,]+\\.?[0-9]*)`));
        const changeMatch = text.match(new RegExp(`${symbol}[^-0-9%]*(-?[0-9.]+)%`));
        
        if (priceMatch) {
          prices.push({
            symbol,
            price: parseFloat(priceMatch[1].replace(/,/g, '')),
            change24h: changeMatch ? parseFloat(changeMatch[1]) : 0
          });
        }
      }

      res.json({ prices, quotaExhausted: false });
    } catch (parseErr) {
      console.error('Error parsing market data:', parseErr);
      res.json({ prices: [], quotaExhausted: false });
    }
  } catch (error) {
    console.error('Market data AI Error:', error);
    res.json({ prices: [], quotaExhausted: true });
  }
});

export default router;
