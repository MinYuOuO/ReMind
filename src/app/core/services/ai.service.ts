import { Injectable } from '@angular/core';
import { SqliteDbService } from './db.service';
import { InsightRepo, InsightType } from '../repos/insight.repo';

// Shared Models

export interface InteractionInput {
  interaction_id: string;
  contact_id: string;
  user_id: string;
  context?: 'work' | 'lunch' | 'meeting' | 'social' | string;
  user_summary?: string;
  raw_notes?: string;
}

export interface InteractionFacts {
  summary: string;           // 1 short sentence
  facts: string[];           // bullets: what happened/was said
  contact_notes?: string[];  // traits/hobbies/preferences about the person
  categories?: Array<{
    category: 'work_style' | 'values' | 'communication' | 'behavior';
    essence: string;
    confidence?: number;     // 1..5
  }>;
}

export interface AiInsightPayload {
  summary?: string;
  suggestion?: string;
  reminder?: string;
  // Optionally pass through the raw model text/JSON for debugging
  _rawText?: string;
  _rawJson?: any;
}

export interface RouletteResult {
  suggestions: string[];
  rawText?: string;
}

// Provider interface & helpers

/** Provider contract for LLMs used by this service. */
export interface AiProvider {
  name: string;
  generateJsonForFacts(prompt: string): Promise<InteractionFacts>;
  generateInsightText(prompt: string): Promise<AiInsightPayload>;
  generateSuggestions(n: number): Promise<string[]>;
}

function tryExtractJson(text: string): any | null {
  if (!text) return null;
  try { return JSON.parse(text); } catch {}
  const s = text.indexOf('{'); const e = text.lastIndexOf('}');
  if (s >= 0 && e > s) {
    try { return JSON.parse(text.slice(s, e + 1)); } catch {}
  }
  return null;
}

/** Minimal OpenAI Chat Completions provider */
class OpenAIProvider implements AiProvider {
  public readonly name = 'openai';
  constructor(
    private apiKey: string,
    private model = 'gpt-4o-mini',
    private baseUrl = 'https://api.openai.com/v1/chat/completions'
  ) {}

  private async chat(messages: any[], temperature = 0.2): Promise<string> {
    const res = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, messages, temperature })
    });
    const data = await res.json().catch(() => ({}));
    return data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? '';
  }

  async generateJsonForFacts(prompt: string): Promise<InteractionFacts> {
    const sys = { role: 'system', content: 'You extract structured JSON facts about social interactions. Be concise.' };
    const usr = { role: 'user', content:
      `Return STRICT JSON only, no markdown. Shape:\n` +
      `{\n  "summary": "<1 sentence>",\n  "facts": ["..."],\n  "contact_notes": ["personality/hobby/preference"],\n` +
      `  "categories": [{"category":"values|work_style|communication|behavior","essence":"...", "confidence":3}]\n}\n\n` +
      prompt
    };
    const text = await this.chat([sys, usr], 0.2);
    const json = tryExtractJson(text) || {};
    return {
      summary: String(json.summary ?? '').trim(),
      facts: Array.isArray(json.facts) ? json.facts.map(String) : [],
      contact_notes: Array.isArray(json.contact_notes) ? json.contact_notes.map(String) : [],
      categories: Array.isArray(json.categories) ? json.categories : []
    };
  }

  async generateInsightText(prompt: string): Promise<AiInsightPayload> {
    const sys = { role: 'system', content: 'You are an empathetic assistant. Respond concisely in JSON when asked; otherwise short text.' };
    const usr = { role: 'user', content:
      `Return JSON with keys "summary" and "suggestion" (plain text, <140 chars each). No markdown.\n\n${prompt}`
    };
    const text = await this.chat([sys, usr], 0.2);
    const json = tryExtractJson(text);
    const payload: AiInsightPayload = {
      summary: json?.summary ? String(json.summary).trim() : undefined,
      suggestion: json?.suggestion ? String(json.suggestion).trim() : (json?.reminder ? String(json.reminder).trim() : undefined),
      _rawText: text,
      _rawJson: json
    };
    return payload;
  }

  async generateSuggestions(n: number): Promise<string[]> {
    const sys = { role: 'system', content: 'Return a JSON array of short suggestions only.' };
    const usr = { role: 'user', content: `Generate ${n} friendly suggestions (<=12 words) to strengthen friendships. Return JSON array.` };
    const text = await this.chat([sys, usr], 0.7);
    const json = tryExtractJson(text);
    if (Array.isArray(json)) return json.map(String).slice(0, n);
    if (Array.isArray(json?.suggestions)) return json.suggestions.map(String).slice(0, n);
    // fallback: parse lines
    return text.split('\n').map(s => s.replace(/^[\s*-•\d.]+/, '').trim()).filter(Boolean).slice(0, n);
  }
}

// ---------- DeepSeek provider (OpenAI-compatible API shape) ------------------

class DeepSeekProvider implements AiProvider {
  public readonly name = 'deepseek';
  constructor(
    private apiKey: string,
    private model = 'deepseek-chat',
    private baseUrl = 'https://api.deepseek.com/chat/completions'
  ) {}

  private async chat(messages: any[], temperature = 0.2): Promise<string> {
    const res = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, messages, temperature })
    });
    const data = await res.json().catch(() => ({}));
    return data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? '';
  }

  async generateJsonForFacts(prompt: string): Promise<InteractionFacts> {
    const sys = { role: 'system', content: 'You extract structured JSON facts about social interactions. Be concise.' };
    const usr = { role: 'user', content:
      `Return STRICT JSON only, no markdown. Shape:\n` +
      `{\n  "summary": "<1 sentence>",\n  "facts": ["..."],\n  "contact_notes": ["personality/hobby/preference"],\n` +
      `  "categories": [{"category":"values|work_style|communication|behavior","essence":"...", "confidence":3}]\n}\n\n` +
      prompt
    };
    const text = await this.chat([sys, usr], 0.2);
    const json = tryExtractJson(text) || {};
    return {
      summary: String(json.summary ?? '').trim(),
      facts: Array.isArray(json.facts) ? json.facts.map(String) : [],
      contact_notes: Array.isArray(json.contact_notes) ? json.contact_notes.map(String) : [],
      categories: Array.isArray(json.categories) ? json.categories : []
    };
  }

  async generateInsightText(prompt: string): Promise<AiInsightPayload> {
    const sys = { role: 'system', content: 'You are an empathetic assistant. Respond concisely in JSON when asked; otherwise short text.' };
    const usr = { role: 'user', content:
      `Return JSON with keys "summary" and "suggestion" (plain text, <140 chars each). No markdown.\n\n${prompt}`
    };
    const text = await this.chat([sys, usr], 0.2);
    const json = tryExtractJson(text);
    const payload: AiInsightPayload = {
      summary: json?.summary ? String(json.summary).trim() : undefined,
      suggestion: json?.suggestion ? String(json.suggestion).trim() : (json?.reminder ? String(json.reminder).trim() : undefined),
      _rawText: text,
      _rawJson: json
    };
    return payload;
  }

  async generateSuggestions(n: number): Promise<string[]> {
    const sys = { role: 'system', content: 'Return a JSON array of short suggestions only.' };
    const usr = { role: 'user', content: `Generate ${n} friendly suggestions (<=12 words) to strengthen friendships. Return JSON array.` };
    const text = await this.chat([sys, usr], 0.7);
    const json = tryExtractJson(text);
    if (Array.isArray(json)) return json.map(String).slice(0, n);
    if (Array.isArray(json?.suggestions)) return json.suggestions.map(String).slice(0, n);
    return text.split('\n').map(s => s.replace(/^[\s*-•\d.]+/, '').trim()).filter(Boolean).slice(0, n);
  }
}


// Service implementation

@Injectable({ providedIn: 'root' })
export class AiService {
  private provider: AiProvider | null = null;

  constructor(
    private db: SqliteDbService,
    private insightRepo: InsightRepo
  ) {}

  // Provider wiring
  useProvider(p: AiProvider) { this.provider = p; }
  useOpenAI(apiKey: string, model = 'gpt-4o-mini') { this.provider = new OpenAIProvider(apiKey, model); }
  useDeepSeek(apiKey: string, model = 'deepseek-chat') { this.provider = new DeepSeekProvider(apiKey, model); }

  // 1) Interaction-centric: extract facts → ai_processing_log (+ cognitive_unit)

  async summarizeInteractionToFacts(input: InteractionInput): Promise<void> {
    const prompt = this.buildFactsPrompt(input);

    if (!this.provider) {
      await this.logProcessing(input, 'pending', prompt, null, 0, 'No provider configured');
      return;
    }

    try {
      const facts = await this.provider.generateJsonForFacts(prompt);

      // Normalize
      const merged: InteractionFacts = {
        summary: (facts.summary ?? '').trim(),
        facts: Array.isArray(facts.facts) ? facts.facts.map(x => String(x).trim()).filter(Boolean) : [],
        contact_notes: Array.isArray(facts.contact_notes) ? facts.contact_notes.map(x => String(x).trim()).filter(Boolean) : [],
        categories: Array.isArray(facts.categories) ? facts.categories : []
      };

      // Log the full structured JSON to ai_processing_log
      await this.logProcessing(input, 'success', prompt, JSON.stringify(merged), 0, null, null);

      // Optionally materialize categories → cognitive_unit
      if (merged.categories?.length) {
        for (const c of merged.categories) {
          const essence = (c.essence || '').trim();
          if (!essence) continue;
          await this.db.run(
            `INSERT INTO cognitive_unit(
               unit_id, contact_id, category, essence,
               confidence_score, last_confirmed, status, created_at, updated_at
             ) VALUES(?,?,?,?,?,?,?,datetime('now'),datetime('now'))`,
            [
              (crypto as any)?.randomUUID ? (crypto as any).randomUUID() : 'cu-' + Date.now() + '-' + Math.random().toString(36).slice(2),
              input.contact_id,
              c.category,
              essence,
              Math.min(Math.max(Number(c.confidence ?? 3), 1), 5),
              null,
              'active'
            ]
          );
        }
      }
    } catch (err: any) {
      await this.logProcessing(input, 'error', prompt, null, 0, String(err?.message ?? err));
    }
  }

  private buildFactsPrompt(i: InteractionInput): string {
    return [
      `Task: Extract structured facts about this single interaction.`,
      `Return STRICT JSON ONLY (no markdown) with keys:`,
      `- "summary": "<1 short sentence>"`,
      `- "facts": ["..."]`,
      `- "contact_notes": ["personality/hobby/preference"]`,
      `- "categories": [{"category":"values|work_style|communication|behavior","essence":"...", "confidence":3}]`,
      `Constraints: Keep items short, plain text, <= 140 chars each.`,
      ``,
      `Interaction ID: ${i.interaction_id}`,
      `Contact ID: ${i.contact_id}`,
      `User ID: ${i.user_id}`,
      i.context ? `Context: ${i.context}` : ``,
      i.user_summary ? `User Summary: ${i.user_summary}` : ``,
      i.raw_notes ? `Raw Notes: ${i.raw_notes}` : ``,
    ].filter(Boolean).join('\n');
  }

  // 2) Person-centric: user-facing insight → insight

  async generatePersonInsight(args: {
    contact_id: string;
    user_id: string;
    type: InsightType;           // 'pattern' | 'reminder' | 'suggestion'
    question?: string;           // optional focus
    actionable?: 0 | 1;          // default 1
    relevant_until?: string | null;
  }): Promise<string | null> {
    if (!this.provider) return null;

    const prompt = this.buildPersonInsightPrompt(args);

    try {
      const ai = await this.provider.generateInsightText(prompt);
      const content =
        (ai.suggestion ?? ai.summary ?? args.question ?? '').toString().trim() ||
        'No insight available.';
      const rec = await this.insightRepo.create(
        args.contact_id,
        args.user_id,
        args.type,
        content,
        args.actionable ?? 1,
        args.relevant_until ?? null
      );
      return rec.insight_id;
    } catch (e) {
      console.warn('[AiInsightService] generatePersonInsight failed:', e);
      return null;
    }
  }

  private buildPersonInsightPrompt(a: {
    contact_id: string; user_id: string; type: InsightType; question?: string;
  }): string {
    return [
      `Task: Produce a concise ${a.type} about this person for the user to read.`,
      `Constraints: 1–2 short sentences, plain text, no markdown, <= 220 chars.`,
      `Contact ID: ${a.contact_id}`,
      `User ID: ${a.user_id}`,
      a.question ? `Focus: ${a.question}` : `Focus: general relationship maintenance`,
    ].join('\n');
  }

  // 3) Roulette suggestions

  async generateRouletteSuggestions(count = 8): Promise<RouletteResult> {
    const defaults = [
      'Text a friend you miss',
      'Share a photo memory today',
      'Plan a short coffee catch-up',
      'Write one thank-you message',
      'Ask a friend about their week',
      'Send a thoughtful voice note',
      'Invite someone for a walk',
      'Celebrate a small win together',
    ];
    if (!this.provider) return { suggestions: defaults.slice(0, count) };

    try {
      const list = await this.provider.generateSuggestions(count);
      const clean = list.map(s => (s || '').trim()).filter(Boolean).slice(0, count);
      return { suggestions: clean.length ? clean : defaults.slice(0, count) };
    } catch (e: any) {
      return { suggestions: defaults.slice(0, count) };
    }
  }

  // ai_processing_log writer

  private async logProcessing(
    input: InteractionInput,
    status: 'success' | 'error' | 'pending',
    input_text?: string | null,
    output_json?: string | null,
    user_confirmed: 0 | 1 = 0,
    errorMessage?: string | null,
    cognitive_unit_id?: string | null
  ): Promise<void> {
    const log_id =
      (crypto as any)?.randomUUID ? (crypto as any).randomUUID() : 'log-' + Date.now();
    const processed_at = new Date().toISOString();
    const ai_model = this.provider?.name ?? null;
    const finalOutput = output_json ?? (errorMessage ? JSON.stringify({ error: errorMessage }) : null);

    await this.db.run(
      `INSERT INTO ai_processing_log (
         log_id, interaction_id, processed_at, ai_model,
         input_text, output_json, user_confirmed, status, cognitive_unit_id
       ) VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        log_id,
        input.interaction_id,
        processed_at,
        ai_model,
        input_text ?? null,
        finalOutput ?? null,
        user_confirmed,
        status,
        cognitive_unit_id ?? null,
      ]
    );
  }
}
