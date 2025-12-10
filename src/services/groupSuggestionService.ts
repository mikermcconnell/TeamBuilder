import { GoogleGenerativeAI } from '@google/generative-ai';
import { Player, PlayerGroup, getEffectiveSkillRating } from '@/types';
import { GEMINI_MODEL } from '@/config/constants';

// Initialize the API client
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(API_KEY);

export interface SuggestedGroup {
    id: string;
    playerIds: string[];
    playerNames: string[];
    avgSkill: number;
    reasoning: string;
    confidence: 'high' | 'medium' | 'low';
}

export interface GroupSuggestionResult {
    suggestions: SuggestedGroup[];
    error?: string;
}

/**
 * Analyzes player teammate requests and suggests optimal groupings using AI.
 * Considers both reciprocal and non-reciprocal requests.
 */
export async function generateGroupSuggestions(
    players: Player[],
    existingGroups: PlayerGroup[]
): Promise<GroupSuggestionResult> {
    if (!API_KEY) {
        return {
            suggestions: [],
            error: 'Missing Gemini API Key. Please configure VITE_GEMINI_API_KEY.'
        };
    }

    // Filter to players NOT already in a group
    const existingGroupPlayerIds = new Set(existingGroups.flatMap(g => g.playerIds));
    const ungroupedPlayers = players.filter(p => !existingGroupPlayerIds.has(p.id));

    // Find players with teammate requests
    const playersWithRequests = ungroupedPlayers.filter(p =>
        p.teammateRequests && p.teammateRequests.length > 0
    );

    if (playersWithRequests.length === 0) {
        return {
            suggestions: [],
            error: undefined
        };
    }

    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    // Build context for AI
    const context = {
        ungroupedPlayers: ungroupedPlayers.map(p => ({
            id: p.id,
            name: p.name,
            skill: getEffectiveSkillRating(p),
            gender: p.gender,
            isHandler: p.isHandler,
            teammateRequests: p.teammateRequests || [],
            avoidRequests: p.avoidRequests || []
        })),
        existingGroupCount: existingGroups.length
    };

    const systemPrompt = `
You are an AI assistant helping create player groups for a recreational sports league.

Analyze the teammate requests and suggest optimal groupings. Look for:
1. **Reciprocal requests**: Player A requested B AND B requested A (highest priority)
2. **Chain requests**: A requested B, B requested C → suggest grouping A, B, C
3. **One-way requests**: A requested B but B didn't request A (lower priority, but consider if skill levels are compatible)

RULES:
- Maximum group size should be 4 players (to fit on teams)
- Avoid grouping players who have "avoidRequests" conflicts
- Consider skill balance - don't group very high and very low skill players unless they requested each other
- Only suggest groups for ungrouped players
- Provide clear reasoning for each suggestion

RETURN ONLY A JSON ARRAY:
[
  {
    "playerIds": ["id1", "id2"],
    "playerNames": ["Alice", "Bob"],
    "reasoning": "Why this group makes sense",
    "confidence": "high" | "medium" | "low"
  }
]

Use "high" confidence for mutual/reciprocal requests.
Use "medium" for chains or strong one-way requests.
Use "low" for suggestions based on skill compatibility without direct requests.

IMPORTANT: Return ONLY valid JSON. No markdown formatting.
`;

    try {
        const result = await model.generateContent([
            systemPrompt,
            JSON.stringify(context)
        ]);

        const response = result.response;
        const text = response.text();

        // Clean up potential markdown code blocks
        const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();

        const parsed = JSON.parse(cleanJson) as Array<{
            playerIds: string[];
            playerNames: string[];
            reasoning: string;
            confidence: 'high' | 'medium' | 'low';
        }>;

        // Enrich with avgSkill calculation
        const suggestions: SuggestedGroup[] = parsed.map((s, index) => {
            const groupPlayers = players.filter(p => s.playerIds.includes(p.id));
            const avgSkill = groupPlayers.length > 0
                ? groupPlayers.reduce((sum, p) => sum + getEffectiveSkillRating(p), 0) / groupPlayers.length
                : 0;

            return {
                id: `suggestion-${Date.now()}-${index}`,
                playerIds: s.playerIds,
                playerNames: s.playerNames,
                avgSkill,
                reasoning: s.reasoning,
                confidence: s.confidence
            };
        });

        return { suggestions };
    } catch (error) {
        console.error('Gemini Group Suggestion Error:', error);
        return {
            suggestions: [],
            error: 'Failed to generate suggestions. Please try again.'
        };
    }
}
