import Groq from 'groq-sdk';
import Product from '../models/Product.js';

const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!GROQ_API_KEY) {
  console.warn('[chat] GROQ_API_KEY not set — chatbot will not work');
}

const groq = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;

const MODEL = 'openai/gpt-oss-120b';

// ---------- System prompt ----------

const SYSTEM_PROMPT = `You are RoboBot, a helpful AI assistant for RoboExpert — an Indian multi-vendor e-commerce marketplace.

ABOUT ROBOEXPERT:
- Multi-vendor marketplace where sellers open their own storefronts
- Buyers can browse products from different sellers in one place
- Payments are processed via Razorpay directly to sellers
- 7-day return policy
- Order tracking available via /track-order
- Sellers can sign up at /seller-signup

YOUR JOB:
- Help buyers find products, answer questions about RoboExpert, guide them through checkout/returns/tracking
- Be friendly, concise, and helpful
- If you don't know something, say so honestly
- When relevant products are provided in the context, mention them with their prices
- Keep responses short (2-4 sentences usually)

RULES:
- Never invent products, prices, or policies
- If asked about a specific order, tell them to use /track-order with their order number and email
- If asked about selling, mention /seller-signup
- Prices are in Indian Rupees (₹)
- Be warm and conversational`;

// ---------- Detect if user is asking about products ----------

const PRODUCT_KEYWORDS = [
  'show', 'find', 'search', 'looking for', 'want', 'need', 'buy',
  'under', 'below', 'above', 'cheap', 'best', 'recommend', 'suggest',
  'price', 'cost', 'hoodie', 'shirt', 'shoes', 'product', 'item',
];

function looksLikeProductQuery(message: string): boolean {
  const lower = message.toLowerCase();
  return PRODUCT_KEYWORDS.some((kw) => lower.includes(kw));
}

// ---------- Extract price limit from message ----------

function extractPriceLimit(message: string): { max?: number; min?: number } {
  const lower = message.toLowerCase();

  const maxMatch = lower.match(
    /(?:under|below|less than|upto|up to|within)\s*(?:rs\.?|₹)?\s*(\d+)/
  );
  if (maxMatch) return { max: Number(maxMatch[1]) };

  const minMatch = lower.match(
    /(?:above|over|more than|from)\s*(?:rs\.?|₹)?\s*(\d+)/
  );
  if (minMatch) return { min: Number(minMatch[1]) };

  return {};
}

// ---------- Search products matching the message ----------

async function searchRelevantProducts(message: string, limit = 5) {
  try {
    const lower = message.toLowerCase();
    const { max, min } = extractPriceLimit(message);

    const stopWords = new Set([
      'i', 'a', 'an', 'the', 'me', 'show', 'find', 'want', 'need', 'looking',
      'for', 'under', 'below', 'above', 'cheap', 'best', 'some', 'any',
      'please', 'can', 'you', 'is', 'are', 'do', 'have', 'give', 'get',
      'buy', 'product', 'products', 'item', 'items', 'rs', 'inr', 'rupees',
      'than', 'less', 'more', 'over', 'upto', 'within',
    ]);

    const words = lower
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w) && !/^\d+$/.test(w));

    const filter: Record<string, any> = { isActive: true };

    if (words.length > 0) {
      filter.$or = words.map((w) => ({
        name: { $regex: w, $options: 'i' },
      }));
    }

    if (max !== undefined || min !== undefined) {
      filter.basePrice = {};
      if (max !== undefined) filter.basePrice.$lte = max;
      if (min !== undefined) filter.basePrice.$gte = min;
    }

    let products = await Product.find(filter).limit(limit).lean();

    if (products.length === 0 && (max !== undefined || min !== undefined)) {
      const priceFilter: Record<string, any> = {
        isActive: true,
        basePrice: {},
      };
      if (max !== undefined) priceFilter.basePrice.$lte = max;
      if (min !== undefined) priceFilter.basePrice.$gte = min;
      products = await Product.find(priceFilter).limit(limit).lean();
    }

    return products;
  } catch (error) {
    console.error('[chat] Product search failed:', error);
    return [];
  }
}

// ---------- Build context ----------

function buildProductContext(products: any[]): string {
  if (products.length === 0) return '';

  const lines = products.map((p, idx) => {
    const price = p.basePrice?.toLocaleString('en-IN') ?? '—';
    return `${idx + 1}. ${p.name} — ₹${price}${
      p.description ? ` (${p.description})` : ''
    }`;
  });

  return `\n\nRELEVANT PRODUCTS FROM OUR DATABASE:\n${lines.join(
    '\n'
  )}\n\nMention the most relevant 2-3 products with their prices in your response.`;
}

// ---------- Main chat function ----------

export type ChatResponse = {
  reply: string;
  products: Array<{
    _id: string;
    name: string;
    basePrice: number;
    image?: string;
  }>;
};

export async function chatWithBot(
  message: string,
  history: { role: 'user' | 'model'; parts: string }[] = []
): Promise<ChatResponse> {
  if (!groq) {
    return {
      reply:
        "I'm not configured yet. Please ask the admin to add the Groq API key.",
      products: [],
    };
  }

  try {
    const products = looksLikeProductQuery(message)
      ? await searchRelevantProducts(message)
      : [];

    const productContext = buildProductContext(products);

    // Build messages array for Groq (OpenAI-style)
    const groqMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: SYSTEM_PROMPT },
    ];

    // Add history (convert 'model' → 'assistant')
    for (const h of history) {
      if (!h.parts?.trim()) continue;
      groqMessages.push({
        role: h.role === 'model' ? 'assistant' : 'user',
        content: h.parts,
      });
    }

    // Add current message with product context
    groqMessages.push({
      role: 'user',
      content: message + productContext,
    });

    const completion = await groq.chat.completions.create({
      model: MODEL,
      messages: groqMessages,
      temperature: 0.7,
      max_tokens: 500,
    });

    const reply = completion.choices[0]?.message?.content?.trim() ?? '';

    return {
      reply,
      products: products.map((p) => ({
        _id: p._id.toString(),
        name: p.name,
        basePrice: p.basePrice,
        image: p.images?.[0],
      })),
    };
  } catch (error) {
    console.error('[chat] Groq error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return {
      reply: `Sorry, I ran into an issue: ${msg}. Please try again in a moment.`,
      products: [],
    };
  }
}