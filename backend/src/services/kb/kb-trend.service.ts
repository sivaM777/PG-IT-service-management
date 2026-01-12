import { pool } from "../../config/db.js";

export interface KbTrend {
  pattern: string;
  frequency: number;
  suggestedArticleTitle: string;
  suggestedArticleBody: string;
  relatedTickets: string[];
}

/**
 * Analyze ticket patterns to suggest KB articles
 */
export async function analyzeTicketTrends(limit: number = 10): Promise<KbTrend[]> {
  // Get recent tickets with descriptions
  const ticketsResult = await pool.query<{
    id: string;
    title: string;
    description: string;
    category: string | null;
    status: string;
  }>(
    `SELECT id, title, description, category, status 
     FROM tickets 
     WHERE description IS NOT NULL AND description != ''
     ORDER BY created_at DESC 
     LIMIT 1000`
  );

  const tickets = ticketsResult.rows;

  // Simple pattern extraction (in production, use NLP/ML)
  const patterns = new Map<string, {
    frequency: number;
    tickets: string[];
    titles: string[];
    descriptions: string[];
  }>();

  for (const ticket of tickets) {
    // Extract keywords/phrases (simplified)
    const words = ticket.description.toLowerCase().split(/\s+/);
    const phrases: string[] = [];

    // Extract 2-3 word phrases
    for (let i = 0; i < words.length - 1; i++) {
      phrases.push(`${words[i]} ${words[i + 1]}`);
      if (i < words.length - 2) {
        phrases.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
      }
    }

    // Count phrase frequencies
    for (const phrase of phrases) {
      if (phrase.length > 10 && phrase.length < 50) {
        // Filter out very short or very long phrases
        const existing = patterns.get(phrase) || {
          frequency: 0,
          tickets: [],
          titles: [],
          descriptions: [],
        };

        existing.frequency++;
        existing.tickets.push(ticket.id);
        existing.titles.push(ticket.title);
        existing.descriptions.push(ticket.description);

        patterns.set(phrase, existing);
      }
    }
  }

  // Convert to trends and filter
  const trends: KbTrend[] = [];

  for (const [pattern, data] of patterns.entries()) {
    if (data.frequency >= 3) {
      // Only suggest if pattern appears 3+ times
      const mostCommonTitle = findMostCommon(data.titles);
      const mostCommonDescription = findMostCommon(data.descriptions);

      trends.push({
        pattern,
        frequency: data.frequency,
        suggestedArticleTitle: `How to resolve: ${mostCommonTitle}`,
        suggestedArticleBody: `This article addresses a common issue: ${pattern}\n\n${mostCommonDescription.substring(0, 500)}`,
        relatedTickets: data.tickets.slice(0, 10), // Limit to 10 related tickets
      });
    }
  }

  // Sort by frequency and return top N
  return trends
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, limit);
}

/**
 * Get KB article suggestions for a ticket
 */
export async function getKbSuggestionsForTicket(
  ticketId: string
): Promise<Array<{ id: string; title: string; relevance: number }>> {
  // Get ticket details
  const ticketResult = await pool.query<{
    title: string;
    description: string;
    category: string | null;
  }>("SELECT title, description, category FROM tickets WHERE id = $1", [ticketId]);

  if (ticketResult.rows.length === 0) {
    return [];
  }

  const ticket = ticketResult.rows[0];
  const searchText = `${ticket.title} ${ticket.description}`;

  // Search KB articles using full-text search
  const kbResult = await pool.query<{ id: string; title: string; relevance: number }>(
    `SELECT 
       id, title,
       ts_rank(
         to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(body, '')),
         plainto_tsquery('english', $1)
       ) as relevance
     FROM kb_articles
     WHERE 
       to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(body, '')) 
       @@ plainto_tsquery('english', $1)
     ORDER BY relevance DESC
     LIMIT 5`,
    [searchText]
  );

  return kbResult.rows.map((row) => ({
    id: row.id,
    title: row.title,
    relevance: typeof row.relevance === 'string' ? parseFloat(row.relevance) || 0 : (row.relevance as number) || 0,
  }));
}

/**
 * Find most common string in array
 */
function findMostCommon(strings: string[]): string {
  const counts = new Map<string, number>();
  for (const str of strings) {
    counts.set(str, (counts.get(str) || 0) + 1);
  }

  let maxCount = 0;
  let mostCommon = strings[0] || "";

  for (const [str, count] of counts.entries()) {
    if (count > maxCount) {
      maxCount = count;
      mostCommon = str;
    }
  }

  return mostCommon;
}
