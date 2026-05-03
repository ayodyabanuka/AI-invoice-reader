import {
  ApiError,
  GoogleGenAI,
  Type,
  type GenerateContentResponse,
  type Schema,
} from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';

/** Stable default; override with GEMINI_MODEL. See https://ai.google.dev/gemini-api/docs/models/gemini */
const MODEL_FALLBACKS = [
  'gemini-2.5-flash',
  'gemini-3-flash-preview',
  'gemini-2.5-flash-lite',
] as const;

function modelCandidates(): string[] {
  const fromEnv = process.env.GEMINI_MODEL?.trim();
  if (fromEnv) return [fromEnv];
  return [...MODEL_FALLBACKS];
}

const invoiceSchema: Schema = {
  type: Type.OBJECT,
  required: ['shopName', 'date', 'total', 'data'],
  properties: {
    shopName: {
      type: Type.STRING,
      description:
        'Business or store name printed on the bill (best guess if partially visible).',
    },
    date: {
      type: Type.STRING,
      description:
        'Transaction or invoice date. Prefer ISO 8601 (YYYY-MM-DD) when possible.',
    },
    total: {
      type: Type.STRING,
      description:
        'Grand total payable (include currency symbol or code exactly as printed, or approximate).',
    },
    data: {
      type: Type.STRING,
      description:
        'Short summary of key line items, tax, discounts, payment method — one concise paragraph.',
    },
  },
};

function stripBase64Payload(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/^data:image\/[\w+.+-]+;base64,(.+)$/i);
  return match?.[1] ?? trimmed.replace(/\s/g, '');
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Set GEMINI_API_KEY in .env.local' },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Expected JSON body' }, { status: 400 });
  }

  const { imageBase64, mimeType } = body as {
    imageBase64?: string;
    mimeType?: string;
  };

  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return NextResponse.json(
      { error: 'Field imageBase64 (base64 image) is required' },
      { status: 400 },
    );
  }

  let mime =
    typeof mimeType === 'string' && mimeType.startsWith('image/')
      ? mimeType
      : 'image/jpeg';
  const fromDataUrl = imageBase64.match(/^data:(image\/[\w+.+-]+);base64,/i);
  if (fromDataUrl) {
    mime = fromDataUrl[1].toLowerCase();
  }

  const b64 = stripBase64Payload(imageBase64);
  if (!b64) {
    return NextResponse.json({ error: 'Empty image data' }, { status: 400 });
  }

  const ai = new GoogleGenAI({ apiKey });

  const contents = [
    {
      role: 'user' as const,
      parts: [
        {
          text: `You extract structured billing data from this image. If the image is unreadable or not a bill, still return JSON with sensible empty-string placeholders where unknown and briefly note that in "data".`,
        },
        { inlineData: { mimeType: mime, data: b64 } },
      ],
    },
  ];

  const config = {
    responseMimeType: 'application/json',
    responseSchema: invoiceSchema,
  };

  try {
    let response: GenerateContentResponse | undefined;
    const models = modelCandidates();
    let lastError: unknown;

    for (let i = 0; i < models.length; i++) {
      const model = models[i];
      try {
        response = await ai.models.generateContent({
          model,
          contents,
          config,
        });
        break;
      } catch (e) {
        lastError = e;
        const is404 = e instanceof ApiError && e.status === 404;
        if (is404 && i < models.length - 1) {
          console.warn(`[read-invoice] Model "${model}" unavailable, retrying…`);
          continue;
        }
        throw e;
      }
    }

    if (!response) throw lastError;

    const text = response.text;
    if (!text?.trim()) {
      return NextResponse.json(
        { error: 'The model returned no text' },
        { status: 502 },
      );
    }

    const parsed = JSON.parse(text) as {
      shopName?: string;
      date?: string;
      total?: string;
      data?: string;
    };

    return NextResponse.json({
      shopName: String(parsed.shopName ?? ''),
      date: String(parsed.date ?? ''),
      total: String(parsed.total ?? ''),
      data: String(parsed.data ?? ''),
    });
  } catch (e: unknown) {
    const message =
      e instanceof ApiError
        ? e.message
        : e instanceof Error
          ? e.message
          : 'Gemini request failed';
    console.error('[read-invoice]', e);

    let status = 502;
    if (e instanceof ApiError) {
      if (e.status === 429) status = 429;
      else if (e.status === 400) status = 400;
      else if (e.status === 403) status = 403;
    }

    const errorText =
      status === 429
        ? `Rate limit / quota (${message}). Retry shortly or verify your API plan.`
        : message;

    return NextResponse.json({ error: errorText }, { status });
  }
}
