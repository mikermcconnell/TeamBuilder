/**
 * Fuzzy Name Matching Utility
 * Handles nickname variations, typos, and similar name matching
 */

export interface FuzzyMatchResult {
  match: string;
  score: number; // 0-1, where 1 is exact match
  confidence: 'exact' | 'high' | 'medium' | 'low';
  reason: string; // Why this match was found
}

export interface NameVariant {
  formal: string[];
  nicknames: string[];
  diminutives: string[];
}

// Comprehensive nickname database
const NICKNAME_DATABASE: Record<string, NameVariant> = {
  "alexander": {
    formal: ["Alexander"],
    nicknames: ["Alex", "Alec", "Xander", "Lex", "Al"],
    diminutives: ["Sandy", "Sasha"]
  },
  "alexandra": {
    formal: ["Alexandra"],
    nicknames: ["Alex", "Alexa", "Lexi", "Lexie", "Sandra", "Allie"],
    diminutives: ["Sandy", "Sasha"]
  },
  "michael": {
    formal: ["Michael"],
    nicknames: ["Mike", "Mick", "Mickey", "Mikey"],
    diminutives: ["Mitch"]
  },
  "robert": {
    formal: ["Robert"],
    nicknames: ["Rob", "Bob", "Bobby", "Robbie", "Bert"],
    diminutives: ["Robby"]
  },
  "william": {
    formal: ["William"],
    nicknames: ["Will", "Bill", "Billy", "Willie", "Liam"],
    diminutives: ["Willy"]
  },
  "elizabeth": {
    formal: ["Elizabeth"],
    nicknames: ["Liz", "Beth", "Betsy", "Eliza", "Libby", "Betty"],
    diminutives: ["Lizzie", "Liza"]
  },
  "christopher": {
    formal: ["Christopher"],
    nicknames: ["Chris", "Kit", "Topher"],
    diminutives: ["Christie"]
  },
  "nicholas": {
    formal: ["Nicholas"],
    nicknames: ["Nick", "Nicky", "Cole"],
    diminutives: ["Nico"]
  },
  "anthony": {
    formal: ["Anthony"],
    nicknames: ["Tony", "Ant"],
    diminutives: ["Anton"]
  },
  "matthew": {
    formal: ["Matthew"],
    nicknames: ["Matt", "Matty"],
    diminutives: ["Mat"]
  },
  "daniel": {
    formal: ["Daniel"],
    nicknames: ["Dan", "Danny"],
    diminutives: ["Dani"]
  },
  "david": {
    formal: ["David"],
    nicknames: ["Dave", "Davey"],
    diminutives: ["Davy"]
  },
  "james": {
    formal: ["James"],
    nicknames: ["Jim", "Jimmy", "Jamie"],
    diminutives: ["Jimbo"]
  },
  "thomas": {
    formal: ["Thomas"],
    nicknames: ["Tom", "Tommy"],
    diminutives: ["Thom"]
  },
  "richard": {
    formal: ["Richard"],
    nicknames: ["Rick", "Dick", "Rich", "Richie"],
    diminutives: ["Ricky"]
  },
  "benjamin": {
    formal: ["Benjamin"],
    nicknames: ["Ben", "Benny"],
    diminutives: ["Benji"]
  },
  "jonathan": {
    formal: ["Jonathan"],
    nicknames: ["Jon", "Johnny", "Nathan"],
    diminutives: ["Jonny"]
  },
  "joseph": {
    formal: ["Joseph"],
    nicknames: ["Joe", "Joey"],
    diminutives: ["Jo"]
  },
  "patricia": {
    formal: ["Patricia"],
    nicknames: ["Pat", "Patty", "Patsy", "Tricia"],
    diminutives: ["Patti"]
  },
  "jennifer": {
    formal: ["Jennifer"],
    nicknames: ["Jen", "Jenny", "Jenni"],
    diminutives: ["Jenna"]
  },
  "kimberly": {
    formal: ["Kimberly"],
    nicknames: ["Kim", "Kimmy"],
    diminutives: ["Kimber"]
  },
  "catherine": {
    formal: ["Catherine", "Katherine"],
    nicknames: ["Cat", "Cathy", "Kate", "Katie", "Kitty"],
    diminutives: ["Cate"]
  },
  "deborah": {
    formal: ["Deborah"],
    nicknames: ["Deb", "Debbie", "Debby"],
    diminutives: ["Debs"]
  },
  "jessica": {
    formal: ["Jessica"],
    nicknames: ["Jess", "Jessie"],
    diminutives: ["Jessi"]
  },
  "brianna": {
    formal: ["Brianna"],
    nicknames: ["Bri", "Bree"],
    diminutives: ["Anna"]
  },
  "bridget": {
    formal: ["Bridget"],
    nicknames: ["Bri", "Bridge"],
    diminutives: ["Birdie"]
  }
};

export class FuzzyNameMatcher {
  private cache: Map<string, FuzzyMatchResult[]> = new Map();
  private nicknameMap: Map<string, string[]> = new Map();

  constructor() {
    this.buildNicknameMap();
  }

  /**
   * Build reverse lookup map for efficient nickname matching
   */
  private buildNicknameMap(): void {
    for (const [baseName, variants] of Object.entries(NICKNAME_DATABASE)) {
      const allVariants = [
        ...variants.formal,
        ...variants.nicknames,
        ...variants.diminutives
      ];

      for (const variant of allVariants) {
        const lowerVariant = variant.toLowerCase();
        if (!this.nicknameMap.has(lowerVariant)) {
          this.nicknameMap.set(lowerVariant, []);
        }
        this.nicknameMap.get(lowerVariant)!.push(baseName);

        // Also add all other variants as potential matches
        for (const otherVariant of allVariants) {
          if (otherVariant !== variant) {
            this.nicknameMap.get(lowerVariant)!.push(otherVariant);
          }
        }
      }
    }
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() =>
      Array(str1.length + 1).fill(null)
    );

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Calculate similarity score based on Levenshtein distance
   */
  private levenshteinSimilarity(str1: string, str2: string): number {
    const distance = this.levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
    const maxLength = Math.max(str1.length, str2.length);
    return 1 - (distance / maxLength);
  }

  /**
   * Simple soundex implementation for phonetic matching
   */
  private soundex(name: string): string {
    const a = name.toLowerCase().split('');
    const f = a.shift()!;

    const r = a
      .map(v => 'bfpv'.includes(v) ? '1' :
                'cgjkqsxz'.includes(v) ? '2' :
                'dt'.includes(v) ? '3' :
                'l'.includes(v) ? '4' :
                'mn'.includes(v) ? '5' :
                'r'.includes(v) ? '6' : '0')
      .filter((v, i, arr) => i === 0 || v !== arr[i - 1])
      .filter(v => v !== '0')
      .slice(0, 3);

    return (f + r.join('') + '000').slice(0, 4);
  }

  /**
   * Check if input might be a concatenated version of candidate
   */
  private checkConcatenatedMatch(input: string, candidate: string): FuzzyMatchResult | null {
    const inputLower = input.toLowerCase().trim();
    const candidateLower = candidate.toLowerCase().trim();

    // Remove all spaces from candidate and see if it matches input
    const candidateNoSpaces = candidateLower.replace(/\s+/g, '');

    if (inputLower === candidateNoSpaces) {
      return {
        match: candidate,
        score: 0.85,
        confidence: 'high',
        reason: `Concatenated name match: "${input}" → "${candidate}"`
      };
    }

    // Check if input could be firstname+lastname without space
    const words = candidateLower.split(/\s+/);
    if (words.length === 2) {
      const [firstName, lastName] = words;

      // Get nickname variants for the first name
      const firstNameVariants = this.nicknameMap.get(firstName) || [firstName];

      // Check various concatenation patterns including nickname variants
      const patterns = [
        firstName + lastName,           // "chrisssmith"
        firstName + lastName.charAt(0), // "chriss" (first + last initial)
        firstName.charAt(0) + lastName, // "csmith" (first initial + last)
      ];

      // Add nickname variant patterns
      for (const variant of firstNameVariants) {
        patterns.push(variant.toLowerCase() + lastName);           // "mikessmith" for "michael smith"
        patterns.push(variant.toLowerCase() + lastName.charAt(0)); // "mikes" for "michael smith"
      }

      for (const pattern of patterns) {
        if (inputLower === pattern) {
          return {
            match: candidate,
            score: 0.82,
            confidence: 'high',
            reason: `Name concatenation match: "${input}" → "${candidate}"`
          };
        }
      }

      // Fuzzy match against concatenated version
      const similarity = this.levenshteinSimilarity(inputLower, candidateNoSpaces);
      if (similarity >= 0.8) {
        return {
          match: candidate,
          score: similarity * 0.85, // Slightly lower than exact concatenation
          confidence: 'high',
          reason: `Fuzzy concatenation match: "${input}" → "${candidate}" (${Math.round(similarity * 100)}%)`
        };
      }
    }

    return null;
  }

  /**
   * Match a single input against a candidate
   */
  public matchSingle(input: string, candidate: string): FuzzyMatchResult {
    const inputLower = input.toLowerCase().trim();
    const candidateLower = candidate.toLowerCase().trim();

    // Exact match
    if (inputLower === candidateLower) {
      return {
        match: candidate,
        score: 1.0,
        confidence: 'exact',
        reason: 'Exact match'
      };
    }

    // Case-insensitive exact match
    if (input.toLowerCase() === candidate.toLowerCase()) {
      return {
        match: candidate,
        score: 0.95,
        confidence: 'exact',
        reason: 'Case-insensitive exact match'
      };
    }

    // Check for concatenated name matches first
    const concatenatedMatch = this.checkConcatenatedMatch(input, candidate);
    if (concatenatedMatch) {
      return concatenatedMatch;
    }

    // Nickname database match
    const inputVariants = this.nicknameMap.get(inputLower) || [];
    const candidateVariants = this.nicknameMap.get(candidateLower) || [];

    for (const variant of inputVariants) {
      if (variant.toLowerCase() === candidateLower || candidateVariants.includes(variant)) {
        return {
          match: candidate,
          score: 0.9,
          confidence: 'high',
          reason: `Nickname match: ${input} ↔ ${candidate}`
        };
      }
    }

    // Check if candidate is in input's variants
    if (inputVariants.some(v => v.toLowerCase() === candidateLower)) {
      return {
        match: candidate,
        score: 0.9,
        confidence: 'high',
        reason: `Nickname variant: ${input} → ${candidate}`
      };
    }

    // Phonetic match (Soundex)
    if (this.soundex(inputLower) === this.soundex(candidateLower)) {
      return {
        match: candidate,
        score: 0.8,
        confidence: 'medium',
        reason: 'Phonetic similarity'
      };
    }

    // Levenshtein distance
    const similarity = this.levenshteinSimilarity(inputLower, candidateLower);
    if (similarity >= 0.8) {
      return {
        match: candidate,
        score: similarity,
        confidence: 'high',
        reason: `High similarity (${Math.round(similarity * 100)}%)`
      };
    } else if (similarity >= 0.6) {
      return {
        match: candidate,
        score: similarity,
        confidence: 'medium',
        reason: `Moderate similarity (${Math.round(similarity * 100)}%)`
      };
    }

    // Partial match (substring)
    if (candidateLower.includes(inputLower) || inputLower.includes(candidateLower)) {
      const partialScore = Math.min(inputLower.length, candidateLower.length) /
                          Math.max(inputLower.length, candidateLower.length);
      if (partialScore >= 0.5) {
        return {
          match: candidate,
          score: partialScore * 0.7, // Reduce score for partial matches
          confidence: 'medium',
          reason: 'Partial name match'
        };
      }
    }

    // No match
    return {
      match: candidate,
      score: 0,
      confidence: 'low',
      reason: 'No significant similarity found'
    };
  }

  /**
   * Find matches for input against multiple candidates
   */
  public match(
    input: string,
    candidates: string[],
    threshold: number = 0.6
  ): FuzzyMatchResult[] {
    const cacheKey = `${input}:${candidates.join(',')}:${threshold}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const results = candidates
      .map(candidate => this.matchSingle(input, candidate))
      .filter(result => result.score >= threshold)
      .sort((a, b) => b.score - a.score);

    this.cache.set(cacheKey, results);
    return results;
  }

  /**
   * Quick check if two names are likely the same person
   */
  public isLikelyMatch(name1: string, name2: string, threshold: number = 0.8): boolean {
    const result = this.matchSingle(name1, name2);
    return result.score >= threshold;
  }

  /**
   * Get suggestions for autocomplete
   */
  public getSuggestions(
    partial: string,
    candidates: string[],
    limit: number = 5
  ): FuzzyMatchResult[] {
    return this.match(partial, candidates, 0.3)
      .slice(0, limit);
  }

  /**
   * Clear the internal cache
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Add custom nickname mappings
   */
  public addCustomMapping(baseName: string, variants: string[]): void {
    const lowerBase = baseName.toLowerCase();

    for (const variant of variants) {
      const lowerVariant = variant.toLowerCase();
      if (!this.nicknameMap.has(lowerVariant)) {
        this.nicknameMap.set(lowerVariant, []);
      }
      this.nicknameMap.get(lowerVariant)!.push(lowerBase);

      // Add bidirectional mapping
      if (!this.nicknameMap.has(lowerBase)) {
        this.nicknameMap.set(lowerBase, []);
      }
      this.nicknameMap.get(lowerBase)!.push(variant);
    }
  }
}

// Export singleton instance
export const fuzzyMatcher = new FuzzyNameMatcher();