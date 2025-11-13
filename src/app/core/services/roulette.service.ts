import { Injectable } from '@angular/core';
import { CognitiveService } from './cognitive.service';
import { AiService } from './ai.service';

export interface PersonalizedSuggestion {
  suggestion: string;
  personalization: string;
  confidence: number;
  category: 'communication' | 'activity' | 'gesture' | 'follow_up';
}

@Injectable({ providedIn: 'root' })
export class RouletteService {

  constructor(
    private cognitiveService: CognitiveService,
    private aiService: AiService
  ) {}

  // 为特定联系人生成个性化建议
  async getPersonalizedSuggestions(contactId: string, count = 6): Promise<PersonalizedSuggestion[]> {
    
    // 获取联系人的认知背景
    const context = await this.cognitiveService.getPersonalizedSuggestionsContext(contactId);
    
    // 使用AI生成个性化建议
    const baseSuggestions = await this.aiService.generateRouletteSuggestions(count + 2); // 多生成几个用于筛选
    
    // 个性化处理建议
    return this.personalizeSuggestions(baseSuggestions.suggestions, context, count);
  }

  private async personalizeSuggestions(
    baseSuggestions: string[], 
    context: { interests: string[]; communication_preferences: string[]; relationship_dynamics: string[] },
    count: number
  ): Promise<PersonalizedSuggestion[]> {
    
    const personalized: PersonalizedSuggestion[] = [];

    for (const suggestion of baseSuggestions) {
      if (personalized.length >= count) break;

      const personalization = this.findPersonalization(suggestion, context);
      const confidence = this.calculateConfidence(suggestion, context);
      
      // 只保留高置信度的个性化建议
      if (confidence >= 0.6) {
        personalized.push({
          suggestion,
          personalization: personalization || 'Based on the characteristics of your relationship',
          confidence,
          category: this.categorizeSuggestion(suggestion)
        });
      }
    }

    // 如果个性化建议不足，补充通用建议
    if (personalized.length < count) {
      const remaining = count - personalized.length;
      const genericSuggestions = await this.aiService.generateRouletteSuggestions(remaining);
      
      genericSuggestions.suggestions.forEach(suggestion => {
        personalized.push({
          suggestion,
          personalization: 'General friendly advice',
          confidence: 0.5,
          category: this.categorizeSuggestion(suggestion)
        });
      });
    }

    return personalized.sort((a, b) => b.confidence - a.confidence);
  }

  private findPersonalization(suggestion: string, context: any): string | null {
    const suggestionLower = suggestion.toLowerCase();

    // 检查兴趣匹配
    for (const interest of context.interests) {
      const interestKey = interest.split('(')[0].toLowerCase().trim();
      if (suggestionLower.includes(interestKey)) {
        return `考虑到TA对${interestKey}的兴趣`;
      }
    }

    // 检查沟通偏好匹配
    for (const commPref of context.communication_preferences) {
      const prefKey = commPref.split('(')[0].toLowerCase().trim();
      if (this.checkCommunicationMatch(suggestionLower, prefKey)) {
        return `符合TA${prefKey}的沟通风格`;
      }
    }

    return null;
  }

  private checkCommunicationMatch(suggestion: string, communicationStyle: string): boolean {
    const style = communicationStyle.toLowerCase();
    
    if (style.includes('direct') && (suggestion.includes('direct') || suggestion.includes('clear'))) {
      return true;
    }
    if (style.includes('tactful') && (suggestion.includes('tactful') || suggestion.includes('mild'))) {
      return true;
    }
    if (style.includes('detailed') && (suggestion.includes('detailed') || suggestion.includes('specific'))) {
      return true;
    }
    
    return false;
  }

  private calculateConfidence(suggestion: string, context: any): number {
    let confidence = 0.5; // 基础置信度

    const suggestionLower = suggestion.toLowerCase();

    // 兴趣匹配加分
    context.interests.forEach((interest: string) => {
      const interestKey = interest.split('(')[0].toLowerCase().trim();
      if (suggestionLower.includes(interestKey)) {
        confidence += 0.3;
      }
    });

    // 沟通风格匹配加分
    context.communication_preferences.forEach((pref: string) => {
      const prefKey = pref.split('(')[0].toLowerCase().trim();
      if (this.checkCommunicationMatch(suggestionLower, prefKey)) {
        confidence += 0.2;
      }
    });

    return Math.min(confidence, 1.0);
  }

  private categorizeSuggestion(suggestion: string): PersonalizedSuggestion['category'] {
    const s = suggestion.toLowerCase();
    
    if (s.includes('information') || s.includes('telephone') || s.includes('voice')) {
      return 'communication';
    } else if (s.includes('coffee') || s.includes('lunch') || s.includes('walk') || s.includes('activity')) {
      return 'activity';
    } else if (s.includes('share') || s.includes('recommend') || s.includes('like')) {
      return 'gesture';
    } else {
      return 'follow_up';
    }
  }
}