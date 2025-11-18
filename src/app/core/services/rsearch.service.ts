import { Injectable } from '@angular/core';
import { SqliteDbService } from './db.service';

export interface SearchResult {
  contact_id: string;
  contact_name: string;
  relationship?: string;
  score: number;
  matched_patterns: string[];
  recent_interaction?: string;
  total_interactions: number;
  confidence_avg: number;
}

export interface AdvancedSearchFilters {
  personality_traits?: string[];
  interests?: string[];
  communication_style?: string[];
  min_confidence?: number;
  relationship_types?: string[];
}

@Injectable({ providedIn: 'root' })
export class RSearchService {
  constructor(private db: SqliteDbService) {}

  /**
   * Search contacts by cognitive patterns
   * Searches through cognitive_unit table for patterns matching the search term
   */
  async searchByCognitivePatterns(searchTerm: string): Promise<SearchResult[]> {
    if (!searchTerm || searchTerm.trim().length === 0) {
      return [];
    }

    const term = searchTerm.trim().toLowerCase();
    const searchPattern = `%${term}%`;

    try {
      const query = `
        SELECT 
          c.contact_id,
          c.name AS contact_name,
          c.relationship,
          
          -- Calculate match score based on cognitive units and interactions
          (
            (SELECT COUNT(*) * 15 
             FROM cognitive_unit cu 
             WHERE cu.contact_id = c.contact_id 
               AND cu.status = 'active'
               AND (LOWER(cu.essence) LIKE ? OR LOWER(cu.category) LIKE ?))
            +
            (SELECT COUNT(*) * 5
             FROM interaction i
             WHERE i.contact_id = c.contact_id
               AND (LOWER(i.user_summary) LIKE ? OR LOWER(i.raw_notes) LIKE ?))
          ) AS score,
          
          -- Get matched cognitive patterns
          (
            SELECT GROUP_CONCAT(cu.essence, '||')
            FROM cognitive_unit cu
            WHERE cu.contact_id = c.contact_id
              AND cu.status = 'active'
              AND (LOWER(cu.essence) LIKE ? OR LOWER(cu.category) LIKE ?)
            ORDER BY cu.confidence_score DESC
            LIMIT 5
          ) AS matched_patterns,
          
          -- Get most recent interaction
          (
            SELECT i.user_summary
            FROM interaction i
            WHERE i.contact_id = c.contact_id
            ORDER BY i.interaction_date DESC
            LIMIT 1
          ) AS recent_interaction,
          
          -- Count total interactions
          (
            SELECT COUNT(*)
            FROM interaction i
            WHERE i.contact_id = c.contact_id
          ) AS total_interactions,
          
          -- Average confidence score
          (
            SELECT AVG(cu.confidence_score)
            FROM cognitive_unit cu
            WHERE cu.contact_id = c.contact_id
              AND cu.status = 'active'
          ) AS confidence_avg
          
        FROM contact c
        WHERE c.contact_id IN (
          SELECT DISTINCT cu.contact_id
          FROM cognitive_unit cu
          WHERE cu.status = 'active'
            AND (LOWER(cu.essence) LIKE ? OR LOWER(cu.category) LIKE ?)
          UNION
          SELECT DISTINCT i.contact_id
          FROM interaction i
          WHERE LOWER(i.user_summary) LIKE ? OR LOWER(i.raw_notes) LIKE ?
        )
        HAVING score > 0
        ORDER BY score DESC, confidence_avg DESC
        LIMIT 20
      `;

      const params = [
        // For score calculation (cognitive units)
        searchPattern, searchPattern,
        // For score calculation (interactions)
        searchPattern, searchPattern,
        // For matched_patterns
        searchPattern, searchPattern,
        // For WHERE clause (cognitive units)
        searchPattern, searchPattern,
        // For WHERE clause (interactions)
        searchPattern, searchPattern
      ];

      const results = await this.db.query<{
        contact_id: string;
        contact_name: string;
        relationship: string | null;
        score: number;
        matched_patterns: string | null;
        recent_interaction: string | null;
        total_interactions: number;
        confidence_avg: number | null;
      }>(query, params);

      return results.map(row => ({
        contact_id: row.contact_id,
        contact_name: row.contact_name,
        relationship: row.relationship || undefined,
        score: row.score,
        matched_patterns: row.matched_patterns 
          ? row.matched_patterns.split('||').filter(Boolean).slice(0, 5)
          : [],
        recent_interaction: row.recent_interaction || undefined,
        total_interactions: row.total_interactions,
        confidence_avg: row.confidence_avg || 0
      }));
    } catch (error) {
      console.error('Search by cognitive patterns failed:', error);
      return [];
    }
  }

  /**
   * Advanced search with specific filters
   */
  async advancedSearch(filters: AdvancedSearchFilters): Promise<SearchResult[]> {
    try {
      const conditions: string[] = [];
      const params: any[] = [];

      // Build WHERE conditions based on filters
      if (filters.personality_traits && filters.personality_traits.length > 0) {
        const placeholders = filters.personality_traits.map(() => 'LOWER(cu.essence) LIKE ?').join(' OR ');
        conditions.push(`(${placeholders})`);
        params.push(...filters.personality_traits.map(t => `%${t.toLowerCase()}%`));
      }

      if (filters.interests && filters.interests.length > 0) {
        const placeholders = filters.interests.map(() => 'LOWER(cu.essence) LIKE ?').join(' OR ');
        conditions.push(`(${placeholders})`);
        params.push(...filters.interests.map(i => `%${i.toLowerCase()}%`));
      }

      if (filters.communication_style && filters.communication_style.length > 0) {
        const placeholders = filters.communication_style.map(() => 
          "(cu.category = 'communication' AND LOWER(cu.essence) LIKE ?)"
        ).join(' OR ');
        conditions.push(`(${placeholders})`);
        params.push(...filters.communication_style.map(s => `%${s.toLowerCase()}%`));
      }

      if (filters.min_confidence) {
        conditions.push('cu.confidence_score >= ?');
        params.push(filters.min_confidence);
      }

      const whereClause = conditions.length > 0 
        ? `AND (${conditions.join(' OR ')})` 
        : '';

      let relationshipFilter = '';
      if (filters.relationship_types && filters.relationship_types.length > 0) {
        const placeholders = filters.relationship_types.map(() => '?').join(',');
        relationshipFilter = `AND c.relationship IN (${placeholders})`;
        params.push(...filters.relationship_types);
      }

      const query = `
        SELECT 
          c.contact_id,
          c.name AS contact_name,
          c.relationship,
          COUNT(DISTINCT cu.unit_id) * 10 AS score,
          GROUP_CONCAT(DISTINCT cu.essence, '||') AS matched_patterns,
          (
            SELECT i.user_summary
            FROM interaction i
            WHERE i.contact_id = c.contact_id
            ORDER BY i.interaction_date DESC
            LIMIT 1
          ) AS recent_interaction,
          (
            SELECT COUNT(*)
            FROM interaction i
            WHERE i.contact_id = c.contact_id
          ) AS total_interactions,
          AVG(cu.confidence_score) AS confidence_avg
        FROM contact c
        INNER JOIN cognitive_unit cu ON cu.contact_id = c.contact_id
        WHERE cu.status = 'active'
          ${whereClause}
          ${relationshipFilter}
        GROUP BY c.contact_id, c.name, c.relationship
        HAVING score > 0
        ORDER BY score DESC, confidence_avg DESC
        LIMIT 20
      `;

      const results = await this.db.query<{
        contact_id: string;
        contact_name: string;
        relationship: string | null;
        score: number;
        matched_patterns: string | null;
        recent_interaction: string | null;
        total_interactions: number;
        confidence_avg: number | null;
      }>(query, params);

      return results.map(row => ({
        contact_id: row.contact_id,
        contact_name: row.contact_name,
        relationship: row.relationship || undefined,
        score: row.score,
        matched_patterns: row.matched_patterns 
          ? row.matched_patterns.split('||').filter(Boolean).slice(0, 5)
          : [],
        recent_interaction: row.recent_interaction || undefined,
        total_interactions: row.total_interactions,
        confidence_avg: row.confidence_avg || 0
      }));
    } catch (error) {
      console.error('Advanced search failed:', error);
      return [];
    }
  }

  /**
   * Search contacts by name
   */
  async searchByName(name: string, userId: string): Promise<SearchResult[]> {
    if (!name || name.trim().length === 0) {
      return [];
    }

    const searchPattern = `%${name.trim().toLowerCase()}%`;

    try {
      const query = `
        SELECT 
          c.contact_id,
          c.name AS contact_name,
          c.relationship,
          100 AS score,
          (
            SELECT GROUP_CONCAT(cu.essence, '||')
            FROM cognitive_unit cu
            WHERE cu.contact_id = c.contact_id
              AND cu.status = 'active'
            ORDER BY cu.confidence_score DESC
            LIMIT 5
          ) AS matched_patterns,
          (
            SELECT i.user_summary
            FROM interaction i
            WHERE i.contact_id = c.contact_id
            ORDER BY i.interaction_date DESC
            LIMIT 1
          ) AS recent_interaction,
          (
            SELECT COUNT(*)
            FROM interaction i
            WHERE i.contact_id = c.contact_id
          ) AS total_interactions,
          (
            SELECT AVG(cu.confidence_score)
            FROM cognitive_unit cu
            WHERE cu.contact_id = c.contact_id
              AND cu.status = 'active'
          ) AS confidence_avg
        FROM contact c
        WHERE c.user_id = ?
          AND LOWER(c.name) LIKE ?
        ORDER BY c.name
        LIMIT 10
      `;

      const results = await this.db.query<{
        contact_id: string;
        contact_name: string;
        relationship: string | null;
        score: number;
        matched_patterns: string | null;
        recent_interaction: string | null;
        total_interactions: number;
        confidence_avg: number | null;
      }>(query, [userId, searchPattern]);

      return results.map(row => ({
        contact_id: row.contact_id,
        contact_name: row.contact_name,
        relationship: row.relationship || undefined,
        score: row.score,
        matched_patterns: row.matched_patterns 
          ? row.matched_patterns.split('||').filter(Boolean)
          : [],
        recent_interaction: row.recent_interaction || undefined,
        total_interactions: row.total_interactions,
        confidence_avg: row.confidence_avg || 0
      }));
    } catch (error) {
      console.error('Search by name failed:', error);
      return [];
    }
  }

  /**
   * Get detailed information about a contact
   */
  async getContactDetails(contactId: string): Promise<{
    contact: any;
    cognitiveUnits: any[];
    recentInteractions: any[];
    insights: any[];
  } | null> {
    try {
      // Get contact basic info
      const contacts = await this.db.query<any>(
        `SELECT * FROM contact WHERE contact_id = ? LIMIT 1`,
        [contactId]
      );

      if (contacts.length === 0) {
        return null;
      }

      const contact = contacts[0];

      // Get cognitive units
      const cognitiveUnits = await this.db.query<any>(
        `SELECT 
          unit_id, category, essence, confidence_score, 
          created_at, updated_at, status
         FROM cognitive_unit 
         WHERE contact_id = ? AND status = 'active'
         ORDER BY confidence_score DESC, updated_at DESC
         LIMIT 20`,
        [contactId]
      );

      // Get recent interactions
      const recentInteractions = await this.db.query<any>(
        `SELECT 
          interaction_id, user_summary, interaction_date, 
          context, raw_notes
         FROM interaction 
         WHERE contact_id = ?
         ORDER BY interaction_date DESC
         LIMIT 10`,
        [contactId]
      );

      // Get insights
      const insights = await this.db.query<any>(
        `SELECT 
          insight_id, insight_type, content, 
          generated_at, relevant_until, is_actionable
         FROM insight 
         WHERE contact_id = ?
         ORDER BY generated_at DESC
         LIMIT 10`,
        [contactId]
      );

      return {
        contact,
        cognitiveUnits,
        recentInteractions,
        insights
      };
    } catch (error) {
      console.error('Get contact details failed:', error);
      return null;
    }
  }

  /**
   * Get cognitive summary for a contact
   */
  async getCognitiveSummary(contactId: string): Promise<{
    traits: string[];
    interests: string[];
    communication: string[];
    behavior: string[];
  }> {
    try {
      const cognitiveUnits = await this.db.query<{
        category: string;
        essence: string;
        confidence_score: number;
      }>(
        `SELECT category, essence, confidence_score
         FROM cognitive_unit
         WHERE contact_id = ? AND status = 'active'
         ORDER BY confidence_score DESC`,
        [contactId]
      );

      const summary = {
        traits: [] as string[],
        interests: [] as string[],
        communication: [] as string[],
        behavior: [] as string[]
      };

      cognitiveUnits.forEach(unit => {
        const essence = unit.essence;
        switch (unit.category) {
          case 'work_style':
          case 'values':
            summary.traits.push(essence);
            break;
          case 'communication':
            summary.communication.push(essence);
            break;
          case 'behavior':
            summary.behavior.push(essence);
            break;
          default:
            // If it looks like an interest, add to interests
            if (essence.toLowerCase().includes('interest') || 
                essence.toLowerCase().includes('like') ||
                essence.toLowerCase().includes('enjoy')) {
              summary.interests.push(essence);
            } else {
              summary.behavior.push(essence);
            }
        }
      });

      return summary;
    } catch (error) {
      console.error('Get cognitive summary failed:', error);
      return {
        traits: [],
        interests: [],
        communication: [],
        behavior: []
      };
    }
  }
}