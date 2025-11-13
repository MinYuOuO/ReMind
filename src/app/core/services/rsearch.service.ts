import { Injectable } from '@angular/core';
import { SqliteDbService } from './db.service';
import { CognitiveService } from './cognitive.service';

export interface SearchResult {
  contact_id: string;
  name: string;
  relationship: string;
  match_score: number;
  match_reason: string;
  cognitive_snippet: string;
}

@Injectable({ providedIn: 'root' })
export class RSearchService {

  constructor(
    private db: SqliteDbService,
    private cognitiveService: CognitiveService
  ) {}

  async searchByCognitivePatterns(searchTerm: string): Promise<SearchResult[]> {
    const contacts = await this.db.query<{
      contact_id: string;
      name: string;
      relationship: string;
      notes: string;
    }>(
      `SELECT contact_id, name, relationship, notes FROM contact WHERE notes IS NOT NULL`
    );

    const results: SearchResult[] = [];

    for (const contact of contacts) {
      if (!contact.notes) continue;

      const searchableText = contact.notes.toLowerCase();
      const searchTerms = searchTerm.toLowerCase().split(' ').filter(term => term.length > 1);
      
      let matchScore = 0;
      const matchedTerms: string[] = [];

      searchTerms.forEach(term => {
        if (searchableText.includes(term)) {
          matchScore += 10; // 基础匹配分
          matchedTerms.push(term);
          
          // 在特定部分匹配的额外加分
          if (searchableText.includes(`traits:`) && searchableText.includes(term)) {
            matchScore += 5;
          }
          if (searchableText.includes(`interest:`) && searchableText.includes(term)) {
            matchScore += 3;
          }
        }
      });

      if (matchScore > 0) {
        // 生成匹配摘要
        const snippet = this.generateSnippet(contact.notes, searchTerms);
        
        results.push({
          contact_id: contact.contact_id,
          name: contact.name,
          relationship: contact.relationship,
          match_score: matchScore,
          match_reason: matchedTerms.join(', '),
          cognitive_snippet: snippet
        });
      }
    }

    // 按匹配分数排序
    return results.sort((a, b) => b.match_score - a.match_score);
  }

  // 生成匹配摘要
  private generateSnippet(notes: string, matchedTerms: string[]): string {
    const lines = notes.split('\n');
    
    for (const line of lines) {
      for (const term of matchedTerms) {
        if (line.toLowerCase().includes(term)) {
          // 返回包含匹配项的整行，最多50字符
          return line.length > 50 ? line.substring(0, 47) + '...' : line;
        }
      }
    }
    
    // 如果没有找到具体匹配行，返回前两行
    return lines.slice(0, 2).join(' ').substring(0, 100) + '...';
  }

  // 高级搜索：基于多个维度
  async advancedSearch(filters: {
    personality_traits?: string[];
    interests?: string[];
    communication_style?: string[];
    min_confidence?: number;
  }): Promise<SearchResult[]> {
    
    const contacts = await this.db.query<{
      contact_id: string;
      name: string;
      relationship: string;
      notes: string;
    }>(`SELECT contact_id, name, relationship, notes FROM contact`);

    const results: SearchResult[] = [];

    for (const contact of contacts) {
      if (!contact.notes) continue;

      let matchScore = 0;
      const matchedAspects: string[] = [];

      // 检查性格特点匹配
      if (filters.personality_traits) {
        const traitsMatch = this.checkFiltersInSection(contact.notes, 'trails', filters.personality_traits);
        matchScore += traitsMatch.score;
        if (traitsMatch.matched.length > 0) {
          matchedAspects.push(`character: ${traitsMatch.matched.join(', ')}`);
        }
      }

      // 检查兴趣匹配
      if (filters.interests) {
        const interestsMatch = this.checkFiltersInSection(contact.notes, 'values ​​interests', filters.interests);
        matchScore += interestsMatch.score;
        if (interestsMatch.matched.length > 0) {
          matchedAspects.push(`interest: ${interestsMatch.matched.join(', ')}`);
        }
      }

      // 检查沟通风格匹配
      if (filters.communication_style) {
        const commMatch = this.checkFiltersInSection(contact.notes, 'communication style', filters.communication_style);
        matchScore += commMatch.score;
        if (commMatch.matched.length > 0) {
          matchedAspects.push(`communication: ${commMatch.matched.join(', ')}`);
        }
      }

      if (matchScore > 0) {
        results.push({
          contact_id: contact.contact_id,
          name: contact.name,
          relationship: contact.relationship,
          match_score: matchScore,
          match_reason: matchedAspects.join('; '),
          cognitive_snippet: this.extractRelevantSections(contact.notes, matchedAspects)
        });
      }
    }

    return results.sort((a, b) => b.match_score - a.match_score);
  }

  private checkFiltersInSection(notes: string, section: string, filters: string[]): {
    score: number;
    matched: string[];
  } {
    const sectionMatch = notes.match(new RegExp(`${section}: ([^\\n]+)`));
    if (!sectionMatch) return { score: 0, matched: [] };

    const sectionContent = sectionMatch[1].toLowerCase();
    const matched: string[] = [];
    let score = 0;

    filters.forEach(filter => {
      if (sectionContent.includes(filter.toLowerCase())) {
        matched.push(filter);
        score += 8; 
      }
    });

    return { score, matched };
  }

  private extractRelevantSections(notes: string, matchedAspects: string[]): string {
    const lines = notes.split('\n');
    const relevantLines = lines.filter(line => 
      matchedAspects.some(aspect => line.includes(aspect.split(':')[0]))
    );
    
    return relevantLines.slice(0, 3).join(' | ');
  }
}