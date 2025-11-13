import { Injectable } from '@angular/core';
import { SqliteDbService } from './db.service';
import { AiService, InteractionFacts } from './ai.service';

export interface CognitiveSummary {
  personality_traits: string[]; // 性格特点
  communication_style: string[]; // 沟通风格
  values_interests: string[]; // 价值观和兴趣
  relationship_patterns: string[]; // 关系模式
  important_notes: string[]; // 重要注意事项
  last_updated: string;
}

@Injectable({ providedIn: 'root' })
export class CognitiveService {
  constructor(private db: SqliteDbService, private aiService: AiService) {}

  // 主要工作流：处理交互并更新认知总结
  async processInteractionAndUpdateSummary(interactionData: {
    interaction_id: string;
    contact_id: string;
    user_id: string;
    context?: string;
    user_summary: string;
    raw_notes?: string;
  }): Promise<{ success: boolean; summary?: string }> {
    try {
      // 1. AI分析交互
      const result = await this.aiService.processInteraction(interactionData);

      if (!result.success || !result.facts) {
        throw new Error('AI processing failed');
      }

      // 2. 获取现有认知总结
      const currentSummary = await this.getCognitiveSummary(
        interactionData.contact_id
      );

      // 3. 基于新事实更新认知总结
      const updatedSummary = await this.updateCognitiveSummary(
        interactionData.contact_id,
        currentSummary,
        result.facts
      );

      // 4. 更新contact表的notes字段
      await this.updateContactNotes(
        interactionData.contact_id,
        this.formatSummaryForNotes(updatedSummary)
      );

      return {
        success: true,
        summary: this.formatSummaryForDisplay(updatedSummary),
      };
    } catch (error) {
      console.error('Cognitive update process failed:', error);
      return { success: false };
    }
  }

  // 获取当前认知总结
  async getCognitiveSummary(contactId: string): Promise<CognitiveSummary> {
    // 从cognitive_unit表构建认知总结
    const cognitiveUnits = await this.db.query<{
      category: string;
      essence: string;
      confidence_score: number;
      updated_at: string;
    }>(
      `SELECT category, essence, confidence_score, updated_at 
       FROM cognitive_unit 
       WHERE contact_id = ? AND status = 'active'
       ORDER BY confidence_score DESC, updated_at DESC`,
      [contactId]
    );

    const defaultSummary: CognitiveSummary = {
      personality_traits: [],
      communication_style: [],
      values_interests: [],
      relationship_patterns: [],
      important_notes: [],
      last_updated: new Date().toISOString(),
    };

    if (cognitiveUnits.length === 0) {
      return defaultSummary;
    }

    // 按类别组织认知单元
    return cognitiveUnits.reduce((summary, unit) => {
      const essenceWithConfidence = `${unit.essence} (Credibility: ${unit.confidence_score}/5)`;

      switch (unit.category) {
        case 'behavior':
          summary.personality_traits.push(essenceWithConfidence);
          break;
        case 'communication':
          summary.communication_style.push(essenceWithConfidence);
          break;
        case 'values':
          summary.values_interests.push(essenceWithConfidence);
          break;
        case 'work_style':
          summary.relationship_patterns.push(essenceWithConfidence);
          break;
      }

      summary.last_updated = unit.updated_at;
      return summary;
    }, defaultSummary);
  }

  // 基于新事实更新认知总结
  private async updateCognitiveSummary(
    contactId: string,
    currentSummary: CognitiveSummary,
    newFacts: InteractionFacts
  ): Promise<CognitiveSummary> {
    const updatedSummary = { ...currentSummary };
    updatedSummary.last_updated = new Date().toISOString();

    // 处理新的分类洞察
    if (newFacts.categories) {
      newFacts.categories.forEach((category) => {
        const essenceWithConfidence = `${category.essence} (Credibility: ${
          category.confidence || 3
        }/5)`;

        switch (category.category) {
          case 'behavior':
            this.addOrUpdateItem(
              updatedSummary.personality_traits,
              essenceWithConfidence
            );
            break;
          case 'communication':
            this.addOrUpdateItem(
              updatedSummary.communication_style,
              essenceWithConfidence
            );
            break;
          case 'values':
            this.addOrUpdateItem(
              updatedSummary.values_interests,
              essenceWithConfidence
            );
            break;
          case 'work_style':
            this.addOrUpdateItem(
              updatedSummary.relationship_patterns,
              essenceWithConfidence
            );
            break;
        }
      });
    }

    // 处理联系人的个人笔记
    if (newFacts.contact_notes && newFacts.contact_notes.length > 0) {
      newFacts.contact_notes.forEach((note) => {
        this.addOrUpdateItem(updatedSummary.important_notes, note);
      });
    }

    return updatedSummary;
  }

  // 添加或更新总结项（避免重复）
  private addOrUpdateItem(items: string[], newItem: string): void {
    const existingIndex = items.findIndex((item) =>
      item.toLowerCase().includes(newItem.toLowerCase().substring(0, 10))
    );

    if (existingIndex >= 0) {
      // 更新现有项
      items[existingIndex] = newItem;
    } else {
      // 添加新项，保持列表长度合理
      if (items.length >= 8) {
        items.shift(); // 移除最旧的一项
      }
      items.push(newItem);
    }
  }

  // 更新contact表的notes字段
  private async updateContactNotes(
    contactId: string,
    notes: string
  ): Promise<void> {
    await this.db.run(
      `UPDATE contact SET notes = ?, updated_at = datetime('now') WHERE contact_id = ?`,
      [notes, contactId]
    );
  }

  // 为notes字段格式化总结
  private formatSummaryForNotes(summary: CognitiveSummary): string {
    const sections = [];

    if (summary.personality_traits.length > 0) {
      sections.push(`behavior: ${summary.personality_traits.join('; ')}`);
    }

    if (summary.communication_style.length > 0) {
      sections.push(`communication: ${summary.communication_style.join('; ')}`);
    }

    if (summary.values_interests.length > 0) {
      sections.push(`values: ${summary.values_interests.join('; ')}`);
    }

    if (summary.relationship_patterns.length > 0) {
      sections.push(`work_style: ${summary.relationship_patterns.join('; ')}`);
    }

    if (summary.important_notes.length > 0) {
      sections.push(`important note: ${summary.important_notes.join('; ')}`);
    }

    sections.push(
      `Last Update: ${new Date(summary.last_updated).toLocaleDateString('zh-CN')}`
    );

    return sections.join('\n');
  }

  // 为显示格式化总结（更友好的格式）
  private formatSummaryForDisplay(summary: CognitiveSummary): string {
    return this.formatSummaryForNotes(summary); // 可以单独实现更友好的显示格式
  }

  // 为RSearch提供搜索友好的总结
  getSearchableSummary(contactId: string): Promise<string> {
    return this.getCognitiveSummary(contactId).then((summary: any) => {
      if (!summary) return '';

      const pieces: string[] = [];

      // Object.values(...) gives (string | string[] | unknown)[]
      for (const value of Object.values(summary)) {
        if (Array.isArray(value)) {
          for (const v of value) {
            if (typeof v === 'string') {
              pieces.push(v);
            }
          }
        } else if (typeof value === 'string') {
          pieces.push(value);
        }
      }

      return pieces.join(' ');
    });
  }

  // 为Roulette提供个性化解锁
  getPersonalizedSuggestionsContext(contactId: string): Promise<{
    interests: string[];
    communication_preferences: string[];
    relationship_dynamics: string[];
  }> {
    return this.getCognitiveSummary(contactId).then((summary) => ({
      interests: summary.values_interests,
      communication_preferences: summary.communication_style,
      relationship_dynamics: summary.relationship_patterns,
    }));
  }
}
