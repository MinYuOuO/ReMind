import { Injectable } from '@angular/core';
import { AiService } from './ai.service';
import { ContactRepo } from '../repos/contact.repo';
import { SqliteDbService } from './db.service';

export interface PersonalizedSuggestion {
  suggestion: string;
  personalization: string;
  confidence: number;
  category: 'communication' | 'activity' | 'gesture' | 'follow_up';
}

interface ContactContext {
  name: string;
  relationship?: string;
  recentInteractions: string[];
  interests: string[];
  communicationStyle: string[];
  cognitiveUnits: Array<{
    category: string;
    essence: string;
    confidence: number;
  }>;
}

@Injectable({ providedIn: 'root' })
export class RouletteService {
  constructor(
    private aiService: AiService,
    private contactRepo: ContactRepo,
    private db: SqliteDbService
  ) {}

  /**
   * Generate personalized suggestions for a specific contact using AI
   */
  async getPersonalizedSuggestions(
    contactId: string,
    count = 8,
    userQuestion?: string
  ): Promise<PersonalizedSuggestion[]> {
    try {
      // Step 1: Get contact context
      const context = await this.getContactContext(contactId);

      // Step 2: Use AiService's new method to generate personalized suggestions
      // Pass the user's question so AI can answer it!
      const result = await this.aiService.generatePersonalizedRouletteSuggestions(
        context,
        count,
        userQuestion
      );

      // Return the suggestions directly from AI service
      return result.suggestions;
    } catch (error) {
      console.error('Failed to generate personalized suggestions:', error);
      // Fallback to generic suggestions
      return this.getGenericSuggestions(count);
    }
  }

  /**
   * Get comprehensive context about a contact for AI personalization
   */
  private async getContactContext(contactId: string): Promise<ContactContext> {
    // Get contact info using ContactRepo
    const contact = await this.contactRepo.getById(contactId);
    
    // Get recent interactions
    const interactions = await this.db.query<{ user_summary: string }>(
      `SELECT user_summary 
       FROM interaction 
       WHERE contact_id = ? 
       ORDER BY interaction_date DESC 
       LIMIT 5`,
      [contactId]
    );

    // Get cognitive units (learned patterns about this person)
    const cognitiveUnits = await this.db.query<{
      category: string;
      essence: string;
      confidence_score: number;
    }>(
      `SELECT category, essence, confidence_score 
       FROM cognitive_unit 
       WHERE contact_id = ? AND status = 'active'
       ORDER BY confidence_score DESC 
       LIMIT 10`,
      [contactId]
    );

    // Extract interests and communication style from cognitive units
    const interests = cognitiveUnits
      .filter(cu => cu.category === 'values' || cu.essence.toLowerCase().includes('interest'))
      .map(cu => cu.essence);

    const communicationStyle = cognitiveUnits
      .filter(cu => cu.category === 'communication')
      .map(cu => cu.essence);

    return {
      name: contact?.name || 'Contact',
      relationship: contact?.relationship,
      recentInteractions: interactions.map(i => i.user_summary).filter(Boolean),
      interests,
      communicationStyle,
      cognitiveUnits: cognitiveUnits.map(cu => ({
        category: cu.category,
        essence: cu.essence,
        confidence: cu.confidence_score
      }))
    };
  }

  /**
   * Generate generic AI suggestions without contact context
   * This is for when user doesn't select a contact but wants AI suggestions
   */
  async getGenericAISuggestions(count = 8): Promise<string[]> {
    try {
      const result = await this.aiService.generateRouletteSuggestions(count);
      return result.suggestions;
    } catch (error) {
      console.error('Failed to generate generic AI suggestions:', error);
      // Fallback to defaults
      return this.getGenericSuggestions(count).map(s => s.suggestion);
    }
  }

  /**
   * Fallback: Get generic suggestions when AI fails or is not available
   */
  private getGenericSuggestions(count: number): PersonalizedSuggestion[] {
    const defaults = [
      {
        suggestion: 'Send a thoughtful check-in message',
        personalization: 'General relationship maintenance',
        confidence: 0.5,
        category: 'communication' as const
      },
      {
        suggestion: 'Schedule a casual coffee catch-up',
        personalization: 'Great for staying connected',
        confidence: 0.5,
        category: 'activity' as const
      },
      {
        suggestion: 'Share an interesting article or link',
        personalization: 'Shows you think of them',
        confidence: 0.5,
        category: 'gesture' as const
      },
      {
        suggestion: 'Ask about recent projects or interests',
        personalization: 'Shows genuine interest',
        confidence: 0.5,
        category: 'communication' as const
      },
      {
        suggestion: 'Plan a relaxing walk together',
        personalization: 'Low-pressure quality time',
        confidence: 0.5,
        category: 'activity' as const
      },
      {
        suggestion: 'Send an encouraging voice note',
        personalization: 'Personal touch in communication',
        confidence: 0.5,
        category: 'communication' as const
      },
      {
        suggestion: 'Recommend a book or movie',
        personalization: 'Thoughtful gesture based on shared interests',
        confidence: 0.5,
        category: 'gesture' as const
      },
      {
        suggestion: 'Celebrate their recent achievements',
        personalization: 'Shows you pay attention',
        confidence: 0.5,
        category: 'follow_up' as const
      }
    ];

    return defaults.slice(0, count);
  }
}