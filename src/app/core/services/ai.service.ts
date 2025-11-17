// ai.service.ts
import { Injectable } from '@angular/core';
import { SqliteDbService } from './db.service';
import { InsightRepo, InsightType } from '../repos/insight.repo';

export interface InteractionInput {
  interaction_id: string;
  contact_id: string;
  user_id: string;
  context?: 'work' | 'lunch' | 'meeting' | 'social' | string;
  user_summary?: string;
  raw_notes?: string;
}

export interface InteractionFacts {
  summary: string;
  facts: string[];
  contact_notes?: string[];
  categories?: Array<{
    category: 'work_style' | 'values' | 'communication' | 'behavior';
    essence: string;
    confidence?: number;
  }>;
}

export interface AiInsightPayload {
  summary?: string;
  suggestion?: string;
  reminder?: string;
  _rawText?: string;
  _rawJson?: any;
}

export interface RouletteResult {
  suggestions: string[];
  rawText?: string;
}

export interface AiProvider {
  name: string;
  generateJsonForFacts(prompt: string): Promise<InteractionFacts>;
  generateInsightText(prompt: string): Promise<AiInsightPayload>;
  generateSuggestions(n: number): Promise<string[]>;
  generateText(prompt: string): Promise<string>;
}

// JSON extraction helper
function tryExtractJson(text: string): any | null {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {}

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {}
  }

  return null;
}

// Enhanced OpenAI Provider
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
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      throw new Error(`API request failed: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? '';
  }

  async generateJsonForFacts(prompt: string): Promise<InteractionFacts> {
    const messages = [
      {
        role: 'system',
        content: [
          'You are a professional relationship analyst. Extract concise, evidence-based facts from a SINGLE social interaction.',
          'Return STRICT JSON ONLY (no prose, no markdown).',
          'JSON schema:',
          '{',
          '  "summary": "string (<= 140 chars)",',
          '  "facts": ["string", ...]           // 3-5 short bullets, objective, derived from input',
          '  "contact_notes": ["string", ...],  // 1-3 stable observations about the person (traits, preferences)',
          '  "categories": [                    // 0-4 category items',
          '    { "category": "work_style|values|communication|behavior", "essence": "string (<=150 chars)", "confidence": 1-5 }',
          '  ]',
          '}',
          'Rules:',
          '- Use only information present in the input; do NOT fabricate.',
          '- Keep items short, neutral, and useful; avoid sensitive or private inferences.',
          '- If a field is unknown, output an empty array or empty string for that field.',
          '- Keys must use double quotes; output must be valid JSON.',
        ].join('\n'),
      },
      { role: 'user', content: prompt },
    ];

    const text = await this.chat(messages, 0.1);
    const json = tryExtractJson(text) || {};

    return {
      summary: String(json.summary || '互动已记录')
        .trim()
        .slice(0, 200),
      facts: Array.isArray(json.facts)
        ? json.facts
            .map((v: any) => String(v))
            .filter((f: string) => f.trim())
            .slice(0, 5)
        : [],
      contact_notes: Array.isArray(json.contact_notes)
        ? json.contact_notes
            .map((v: any) => String(v))
            .filter((n: string) => n.trim())
            .slice(0, 3)
        : [],
      categories: Array.isArray(json.categories)
        ? json.categories
            .filter((c: any) => c && typeof c === 'object')
            .map((c: any) => ({
              category: [
                'work_style',
                'values',
                'communication',
                'behavior',
              ].includes(c.category)
                ? c.category
                : 'behavior',
              essence: String(c.essence || '')
                .trim()
                .slice(0, 150),
              confidence: Math.min(Math.max(Number(c.confidence || 3), 1), 5),
            }))
            .filter((c: any) => c.essence && c.essence.length > 0)
            .slice(0, 4)
        : [],
    };
  }

  async generateInsightText(prompt: string): Promise<AiInsightPayload> {
    const messages = [
      {
        role: 'system',
        content: [
          'You are an empathetic relationship coach. Output STRICT JSON ONLY (no prose, no markdown).',
          'JSON schema:',
          '{ "summary": "string (<= 120 chars)", "suggestion": "string (<= 180 chars)" }',
          'Rules:',
          '- Be warm, specific, and actionable.',
          '- Do not repeat the input text.',
          '- If you cannot form a safe, helpful suggestion, set "suggestion" to an empty string.',
        ].join('\n'),
      },
      { role: 'user', content: prompt },
    ];

    const text = await this.chat(messages, 0.3);
    const json = tryExtractJson(text) || {};

    return {
      summary: json.summary
        ? String(json.summary).trim().slice(0, 100)
        : undefined,
      suggestion: json.suggestion
        ? String(json.suggestion).trim().slice(0, 150)
        : undefined,
      _rawText: text,
      _rawJson: json,
    };
  }

  async generateSuggestions(n: number): Promise<string[]> {
    const messages = [
      {
        role: 'system',
        content: [
          'You are a creative social coach.',
          'Return STRICT JSON ONLY: a JSON array of short strings.',
          'Each item: 1–4 words, specific, doable, friendly, varied (text, call, meet, share, celebrate).',
          'Avoid duplicates or generic fluff.',
        ].join('\n'),
      },
      {
        role: 'user',
        content: `Generate ${n} friendship-strengthening suggestions as a JSON array.`,
      },
    ];

    const text = await this.chat(messages, 0.7);
    const json = tryExtractJson(text);

    const defaults = [
      'Send a message to ask what projects youve been busy',
      'Share a link',
      'arrange a short coffee or video call',
      'Inquire about the progress of the challenge mentioned',
      'Send an encouraging voice message',
      'Recommend books and movies that match the other preferences',
      'Plan a relaxing walk or lunch',
      'Celebrate each small achievements',
    ];

    if (Array.isArray(json)) {
      return json
        .map(String)
        .filter((s) => s.length >= 5 && s.length <= 30)
        .slice(0, n);
    }

    return defaults.slice(0, n);
  }

  async generateText(prompt: string): Promise<string> {
    const messages = [
      { role: 'system', content: '你是一个有帮助的助手。' },
      { role: 'user', content: prompt },
    ];

    return await this.chat(messages, 0.5);
  }
}

class DeepSeekProvider implements AiProvider {
  public readonly name = 'deepseek';

  constructor(
    private apiKey: string,
    private model = 'deepseek-chat',
    private baseUrl = 'https://api.deepseek.com/v1'
  ) {}

  private async chat(messages: any[], temperature = 0.2): Promise<string> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature,
        stream: false,
      }),
    });

    if (!res.ok) {
      throw new Error(
        `DeepSeek API request failed: ${res.status} ${res.statusText}`
      );
    }

    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? '';
  }

  async generateJsonForFacts(prompt: string): Promise<InteractionFacts> {
    const messages = [
      {
        role: 'system',
        content:
          'You are a professional interpersonal relations analyst, skilled at extracting structured information from social interactions. Please strictly adhere to the JSON format for output.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ];

    const text = await this.chat(messages, 0.1);
    const json = tryExtractJson(text) || {};

    return {
      summary: String(json.summary || 'Interaction recorded')
        .trim()
        .slice(0, 200),
      facts: Array.isArray(json.facts)
        ? json.facts
            .map((v: any) => String(v))
            .filter((f: string) => f.trim())
            .slice(0, 5)
        : [],
      contact_notes: Array.isArray(json.contact_notes)
        ? json.contact_notes
            .map((v: any) => String(v))
            .filter((n: string) => n.trim())
            .slice(0, 3)
        : [],
      categories: Array.isArray(json.categories)
        ? json.categories
            .filter((c: any) => c && typeof c === 'object')
            .map((c: any) => ({
              category: [
                'work_style',
                'values',
                'communication',
                'behavior',
              ].includes(c.category)
                ? c.category
                : 'behavior',
              essence: String(c.essence || '')
                .trim()
                .slice(0, 150),
              confidence: Math.min(Math.max(Number(c.confidence || 3), 1), 5),
            }))
            .filter((c: any) => c.essence.length > 0)
            .slice(0, 4)
        : [],
    };
  }

  async generateInsightText(prompt: string): Promise<AiInsightPayload> {
    const messages = [
      {
        role: 'system',
        content:
          'You are a caring relationship advisor, offering warm and practical advice. Please reply in JSON format.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ];

    const text = await this.chat(messages, 0.3);
    const json = tryExtractJson(text) || {};

    return {
      summary: json.summary
        ? String(json.summary).trim().slice(0, 100)
        : undefined,
      suggestion: json.suggestion
        ? String(json.suggestion).trim().slice(0, 150)
        : undefined,
      _rawText: text,
      _rawJson: json,
    };
  }

  async generateSuggestions(n: number): Promise<string[]> {
    const messages = [
      {
        role: 'system',
        content:
          'You are a creative social coach, skilled at providing concrete and actionable relationship maintenance advice. Please return a JSON array.',
      },
      {
        role: 'user',
        content: `Generate ${n} specific suggestions for strengthening friendships, each suggestion being 1-4 words long and feasible. Return the results as a JSON array.`,
      },
    ];

    const text = await this.chat(messages, 0.6);
    const json = tryExtractJson(text);

    const defaults = [
      'Send a message to ask what youve been up to lately',
      'Sharing an interesting link',
      'arrange a short coffee break',
      'Inquire about the progress mentioned last time',
      'Send encouraging voice messages',
      'Recommend suitable books and movies',
    ];

    if (Array.isArray(json)) {
      return json
        .map(String)
        .filter((s) => s.length >= 5 && s.length <= 30)
        .slice(0, n);
    }

    return defaults.slice(0, n);
  }

  async generateText(prompt: string): Promise<string> {
    const messages = [
      { role: 'system', content: 'You are a helpful assistant' },
      { role: 'user', content: prompt },
    ];

    return await this.chat(messages, 0.5);
  }
}

@Injectable({ providedIn: 'root' })
export class AiService {
  private provider: AiProvider | null = null;

  constructor(private db: SqliteDbService, private insightRepo: InsightRepo) {}

  // Provider configuration
  useProvider(p: AiProvider) {
    this.provider = p;
  }

  useOpenAI(apiKey: string, model = 'gpt-4o-mini') {
    this.provider = new OpenAIProvider(apiKey, model);
  }

  useDeepSeek(apiKey: string, model = 'deepseek-chat') {
    this.provider = new DeepSeekProvider(apiKey, model);
  }

  isConfigured(): boolean {
    return this.provider !== null;
  }

  // Core AI processing with cognitive summary integration
  async processInteraction(input: InteractionInput): Promise<{
    facts: InteractionFacts | null;
    logId: string | null;
    success: boolean;
  }> {
    if (!this.provider) {
      return { facts: null, logId: null, success: false };
    }

    const prompt = this.buildInteractionAnalysisPrompt(input);
    let logId: string | null = null;

    try {
      // Create processing log entry
      logId = await this.createProcessingLog(input, 'pending', prompt);

      // Generate facts from interaction
      const facts = await this.provider.generateJsonForFacts(prompt);

      // Update cognitive units based on new facts
      await this.updateCognitiveUnits(input.contact_id, facts.categories || []);

      // Update processing log to success
      await this.updateProcessingLog(logId, 'success', JSON.stringify(facts));

      return { facts, logId, success: true };
    } catch (error: any) {
      console.error('AI processing failed:', error);

      if (logId) {
        await this.updateProcessingLog(logId, 'error', null, error.message);
      }

      return {
        facts: null,
        logId,
        success: false,
      };
    }
  }

  private buildInteractionAnalysisPrompt(input: InteractionInput): string {
    return [
      'Task: Extract structured facts from ONE social interaction.',
      'Return STRICT JSON ONLY per the schema given by the system message.',
      'Evidence policy: Use ONLY what is provided below; do not infer private/sensitive data.',
      '',
      '--- Context ---',
      `Contact ID: ${input.contact_id}`,
      `User ID: ${input.user_id}`,
      `Context: ${input.context || 'unspecified'}`,
      '',
      '--- Interaction Content ---',
      input.user_summary
        ? `User Summary: ${input.user_summary}`
        : 'User Summary: (none)',
      input.raw_notes ? `Raw Notes: ${input.raw_notes}` : 'Raw Notes: (none)',
      '',
      'Output requirements:',
      '- "summary": <= 140 chars, 1 sentence, objective.',
      '- "facts": 3–5 bullets, short, neutral, grounded in input.',
      '- "contact_notes": 1–3 stable observations about the person (traits, preferences).',
      '- "categories": 0–4 items; category ∈ {work_style, values, communication, behavior}; confidence ∈ [1..5].',
      '- If insufficient evidence, prefer empty strings/arrays over guessing.',
    ].join('\n');
  }

  // Cognitive unit management (using AI_PROCESSING_LOG as cognitive summary)
  private async updateCognitiveUnits(
    contactId: string,
    categories: Array<{
      category: string;
      essence: string;
      confidence?: number;
    }>
  ): Promise<void> {
    for (const category of categories) {
      // Check if similar cognitive unit already exists
      const existing = await this.db.query<{ unit_id: string }>(
        `SELECT unit_id FROM cognitive_unit 
         WHERE contact_id = ? AND category = ? AND essence LIKE ? 
         LIMIT 1`,
        [contactId, category.category, `%${category.essence.slice(0, 20)}%`]
      );

      if (existing && existing.length > 0) {
        // Update existing unit confidence
        await this.db.run(
          `UPDATE cognitive_unit 
           SET confidence_score = ?, updated_at = datetime('now')
           WHERE unit_id = ?`,
          [Math.min((category.confidence || 3) + 1, 5), existing[0].unit_id]
        );
      } else {
        // Create new cognitive unit
        await this.db.run(
          `INSERT INTO cognitive_unit (
            unit_id, contact_id, category, essence, 
            confidence_score, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
          [
            this.generateId(),
            contactId,
            category.category,
            category.essence,
            category.confidence || 3,
            'active',
          ]
        );
      }
    }
  }

  // Insight generation
  async generateRelationshipInsight(args: {
    contact_id: string;
    user_id: string;
    type: InsightType;
    question?: string;
  }): Promise<string | null> {
    if (!this.provider) return null;

    try {
      // Get recent interactions and cognitive units for context
      const interactions = await this.db.query(
        `SELECT user_summary FROM interaction 
         WHERE contact_id = ? 
         ORDER BY interaction_date DESC LIMIT 5`,
        [args.contact_id]
      );

      const cognitiveUnits = await this.db.query(
        `SELECT category, essence, confidence_score 
         FROM cognitive_unit 
         WHERE contact_id = ? AND status = 'active'
         ORDER BY confidence_score DESC LIMIT 10`,
        [args.contact_id]
      );

      const prompt = this.buildInsightPrompt(
        args,
        interactions,
        cognitiveUnits
      );
      const aiResult = await this.provider.generateInsightText(prompt);

      const content = aiResult.suggestion || aiResult.summary || 'No insights or suggestions available';

      const insight = await this.insightRepo.create(
        args.contact_id,
        args.user_id,
        args.type,
        content,
        1, // actionable
        this.getDefaultRelevantUntil(args.type)
      );

      return insight.insight_id;
    } catch (error) {
      console.error('Insight generation failed:', error);
      return null;
    }
  }

  private buildInsightPrompt(
    args: {
      contact_id: string;
      user_id: string;
      type: InsightType;
      question?: string;
    },
    interactions: any[],
    cognitiveUnits: any[]
  ): string {
    const recentSummaries = interactions
      .map((i) => i.user_summary)
      .filter(Boolean);
    const traitLines = cognitiveUnits.map(
      (cu) =>
        `${cu.category}: ${cu.essence} (confidence ${cu.confidence_score})`
    );

    return [
      `Task: Produce a concise ${args.type} for relationship maintenance.`,
      'Audience: the user (author of the notes).',
      'Return STRICT JSON ONLY per the schema given by the system message.',
      '',
      '--- Person Context (derived from prior data) ---',
      traitLines.length ? traitLines.join('\n') : '(no stable traits found)',
      '',
      '--- Recent Interactions (latest first) ---',
      recentSummaries.length
        ? recentSummaries.join('\n')
        : '(no recent summaries)',
      '',
      args.question
        ? `Focus: ${args.question}`
        : 'Focus: general relationship upkeep.',
      '',
      'Constraints:',
      '- Be warm, specific, and actionable.',
      '- Avoid repeating input verbatim; synthesize.',
      '- "summary" <= 120 chars; "suggestion" <= 180 chars.',
      '- If unsure, output empty string for the field you cannot produce.',
    ].join('\n');
  }

  // Roulette suggestions
  async generateRouletteSuggestions(count = 8): Promise<RouletteResult> {
    const defaults = [
      'Send a message to ask how you are doing',
      'Share interesting pictures or articles',
      'Arrange a short coffee break',
      'Ask about work or interest progress',
      'Send encouraging voice messages',
      'Recommend suitable books and movies',
      'Plan a relaxing walk.',
      'Celebrate small achievements',
    ];

    if (!this.provider) {
      return { suggestions: defaults.slice(0, count) };
    }

    try {
      const suggestions = await this.provider.generateSuggestions(count);
      return {
        suggestions:
          suggestions.length > 0 ? suggestions : defaults.slice(0, count),
      };
    } catch (error) {
      console.error('Roulette suggestions failed:', error);
      return { suggestions: defaults.slice(0, count) };
    }
  }

  // AI Processing Log management
  private async createProcessingLog(
    input: InteractionInput,
    status: 'pending' | 'success' | 'error',
    inputText: string
  ): Promise<string> {
    const logId = this.generateId();

    await this.db.run(
      `INSERT INTO ai_processing_log (
        log_id, interaction_id, processed_at, ai_model,
        input_text, status, user_confirmed
      ) VALUES (?, ?, datetime('now'), ?, ?, ?, 0)`,
      [logId, input.interaction_id, this.provider?.name, inputText, status]
    );

    return logId;
  }

  private async updateProcessingLog(
    logId: string,
    status: 'success' | 'error',
    outputJson?: string | null,
    errorMessage?: string
  ): Promise<void> {
    await this.db.run(
      `UPDATE ai_processing_log 
       SET status = ?, output_json = ?, processed_at = datetime('now')
       ${errorMessage ? ', input_text = input_text || ?' : ''}
       WHERE log_id = ?`,
      errorMessage
        ? [status, outputJson, `\n\nError: ${errorMessage}`, logId]
        : [status, outputJson, logId]
    );
  }

  async generatePersonInsight(args: {
    contact_id: string;
    user_id: string;
    type: 'pattern' | 'reminder' | 'suggestion';
    question?: string;
    actionable?: 0 | 1;
    relevant_until?: string | null;
  }): Promise<string | null> {
    if (!this.provider) {
      console.warn('AI provider not configured');
      return null;
    }

    try {
      // Build insights to generate prompts
      const prompt = this.buildPersonInsightPrompt(args);

      // Using AI to generate insights
      const aiResult = await this.provider.generateInsightText(prompt);

      // Get insights
      const content =
        aiResult.suggestion ||
        aiResult.summary ||
        (args.question ? `about"${args.question}"insight` : 'relationship maintenance suggestions');

      // calling insightRepo to create insight records.
      const insightId = await this.createInsightRecord({
        contact_id: args.contact_id,
        user_id: args.user_id,
        insight_type: args.type,
        content: content,
        is_actionable: args.actionable ?? 1,
        relevant_until: args.relevant_until,
      });

      return insightId;
    } catch (error) {
      console.error('Failure to generate personal insights:', error);
      return null;
    }
  }

  private buildPersonInsightPrompt(args: {
    contact_id: string;
    user_id: string;
    type: 'pattern' | 'reminder' | 'suggestion';
    question?: string;
  }): string {
    const typeGuide: Record<string, string> = {
      pattern:
        'Identify a recurring behavior or trend that is useful to the user.',
      reminder: 'Propose a time-bound reminder with a brief rationale.',
      suggestion:
        'Offer a specific, doable next step to strengthen the relationship.',
    };

    return [
      `Task: Create a ${args.type} for relationship maintenance.`,
      `Guidance: ${typeGuide[args.type]}`,
      'Return STRICT JSON ONLY per the schema given by the system message.',
      '',
      `Contact ID: ${args.contact_id}`,
      `User ID: ${args.user_id}`,
      args.question
        ? `Focus: ${args.question}`
        : 'Focus: general relationship upkeep.',
      '',
      'Constraints:',
      '- Be concise, warm, and practical.',
      '- Do not restate identifiers; produce user-facing text.',
      '- "summary" <= 120 chars; "suggestion" <= 180 chars.',
      '- If unsure, output empty string for the field you cannot produce.',
    ].join('\n');
  }

  private async createInsightRecord(insightData: {
    contact_id: string;
    user_id: string;
    insight_type: string;
    content: string;
    is_actionable: number;
    relevant_until?: string | null;
  }): Promise<string> {
    const insightId = this.generateId();
    const now = new Date().toISOString();

    try {
      await this.db.run(
        `INSERT INTO insight (
          insight_id, contact_id, user_id, insight_type,
          content, generated_at, relevant_until, is_actionable
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          insightId,
          insightData.contact_id,
          insightData.user_id,
          insightData.insight_type,
          insightData.content,
          now,
          insightData.relevant_until || null,
          insightData.is_actionable,
        ]
      );

      return insightId;
    } catch (error) {
      console.error('Insight record creation failed:', error);
      // Even if the database operation fails, it returns an ID and does not block the main process
      return insightId;
    }
  }

  // Utility methods
  private generateId(): string {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  private getDefaultRelevantUntil(type: InsightType): string {
    const now = new Date();
    switch (type) {
      case 'reminder':
        now.setDate(now.getDate() + 7); // 1 week for reminders
        break;
      case 'suggestion':
        now.setDate(now.getDate() + 3); // 3 days for suggestions
        break;
      default:
        now.setDate(now.getDate() + 30); // 1 month for patterns
    }
    return now.toISOString();
  }

  // Get cognitive summary from processing logs
  async getCognitiveSummary(contactId: string): Promise<string> {
    const logs = await this.db.query<{
      input_text: string;
      output_json: string;
    }>(
      `SELECT input_text, output_json FROM ai_processing_log 
       WHERE interaction_id IN (
         SELECT interaction_id FROM interaction WHERE contact_id = ?
       ) AND status = 'success'
       ORDER BY processed_at DESC LIMIT 5`,
      [contactId]
    );

    if (logs.length === 0) {
      return 'No summary of knowledge yet';
    }

    // Simple aggregation of recent insights
    const summaries = logs
      .map((log) => {
        try {
          const data = JSON.parse(log.output_json);
          return data.summary || '';
        } catch {
          return '';
        }
      })
      .filter((s) => s.length > 0);

    return summaries.slice(0, 3).join('；') || 'Cognitive information is being constructed';
  }
}
