import { GoogleGenerativeAI } from '@google/generative-ai';
import { Player, Team, LeagueConfig, PlayerGroup } from '@/types';
import { TeamSuggestion } from '@/types/ai';
import { GEMINI_MODEL } from '@/config/constants';

// Initialize the API client
// SECURITY WARNING: In production, this API key should be proxied through a backend service
// (Firebase Functions, Vercel Serverless, etc.) to protect from extraction via DevTools.
// See: https://cloud.google.com/docs/authentication/api-keys#securing_an_api_key
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(API_KEY);

// Default timeout for API requests (30 seconds)
const API_TIMEOUT_MS = 30000;

export async function generateTeamSuggestions(
    prompt: string,
    players: Player[],
    teams: Team[],
    config: LeagueConfig,
    playerGroups: PlayerGroup[] = []
): Promise<TeamSuggestion[]> {
    if (!API_KEY) {
        throw new Error('Missing Gemini API Key');
    }

    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    // Filter out players who are already on a team
    const assignedPlayerIds = new Set(teams.flatMap(t => t.players.map(p => p.id)));
    const unassignedPlayers = players.filter(p => !assignedPlayerIds.has(p.id));

    // Build a map of player ID to group info
    const playerGroupMap: Record<string, { groupId: string; groupLabel: string }> = {};
    playerGroups.forEach(group => {
        group.playerIds.forEach(playerId => {
            playerGroupMap[playerId] = { groupId: group.id, groupLabel: group.label };
        });
    });

    // Prepare context data
    const context = {
        request: prompt,
        constraints: {
            maxTeamSize: config.maxTeamSize,
            gender: { minM: config.minMales, minF: config.minFemales },
            handlers: "Try to balance handlers evenly (target 3 per team)"
        },
        // Include player groups so AI knows who must move together
        playerGroups: playerGroups.map(g => ({
            id: g.id,
            label: g.label,
            playerIds: g.playerIds,
            playerNames: g.players.map(p => p.name)
        })),
        teams: teams.map(t => ({
            id: t.id,
            name: t.name,
            stats: {
                avgSkill: t.averageSkill,
                males: t.genderBreakdown.M,
                females: t.genderBreakdown.F,
                handlers: t.handlerCount || 0
            },
            players: t.players.map(p => ({
                id: p.id,
                name: p.name,
                skill: p.execSkillRating ?? p.skillRating,
                gender: p.gender,
                isHandler: p.isHandler,
                groupId: playerGroupMap[p.id]?.groupId || null,
                groupLabel: playerGroupMap[p.id]?.groupLabel || null
            }))
        })),
        unassignedPool: unassignedPlayers.map(p => ({
            id: p.id,
            name: p.name,
            skill: p.execSkillRating ?? p.skillRating,
            gender: p.gender,
            isHandler: p.isHandler,
            groupId: playerGroupMap[p.id]?.groupId || null,
            groupLabel: playerGroupMap[p.id]?.groupLabel || null
        })),
        unassignedCount: unassignedPlayers.length
    };

    // Only log in development mode to protect player PII
    if (import.meta.env.DEV) {
        console.log("[DEV] Gemini Context:", JSON.stringify(context, null, 2));
    }

    const systemPrompt = `
    You are an AI Team Builder Assistant.
    Analyze the provided team data and the user's request.
    Suggest specific MOVES or SWAPS to improve the teams based on the goal.
    
    Current request: "${prompt}"

    Please provide exactly THREE (3) distinct options/suggestions.
    Rank them from 1st (best) to 3rd.

    RETURN ONLY A JSON ARRAY based on this schema:
    [
      {
        "id": "must-be-unique-uuid",
        "type": "move" | "swap",
        "title": "Short descriptive title",
        "reasoning": "Explanation of why this helps",
        "actions": [
           { "playerId": "EXACT_UUID_FROM_CONTEXT", "sourceTeamId": "EXACT_UUID", "targetTeamId": "EXACT_UUID" }
        ]
      }
    ]

    CRITICAL RULES:
    1. USE ONLY REAL IDs from the provided context (teams or unassignedPool).
    2. DO NOT hallucinate IDs like "player-1" or "Team A". 
    3. If a valid ID is "1234-5678", you MUST use "1234-5678".
    4. "unassigned" is a valid teamId for the pool.
    5. **PLAYER GROUPS ARE CRITICAL**: If a player has a "groupId", ALL players in that group MUST be moved together.
       - Check the "playerGroups" array to see which players belong to the same group.
       - When suggesting a move for a grouped player, include actions for ALL members of that group.
       - NEVER suggest moving only some members of a group - this would split them up!
    
    IMPORTANT: Return ONLY valid JSON. No markdown formatting.
  `;

    // Create timeout controller
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    try {
        const result = await model.generateContent([
            systemPrompt,
            JSON.stringify(context)
        ]);

        clearTimeout(timeoutId);

        const response = result.response;
        const text = response.text();

        // Clean up potential markdown code blocks
        const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();

        // Safe JSON parsing with validation
        try {
            const parsed = JSON.parse(cleanJson);
            if (!Array.isArray(parsed)) {
                console.error('Gemini response is not an array');
                return [];
            }
            return parsed as TeamSuggestion[];
        } catch (parseError) {
            console.error('Failed to parse Gemini response as JSON:', parseError);
            return [];
        }
    } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
            console.error('Gemini API request timed out');
            throw new Error('Request timed out. Please try again.');
        }
        console.error('Gemini API Error:', error);
        throw new Error('Failed to generate suggestions');
    }
}

export interface AIMatchResult {
    requested: string;
    matched: string | null; // The exact name from the roster, or null if no match
    confidence: number; // 0.0 to 1.0
    reasoning: string;
}

export async function findPlayerMatches(
    unmatchedNames: string[],
    rosterNames: string[]
): Promise<AIMatchResult[]> {
    if (!API_KEY) {
        console.warn('Missing Gemini API Key, skipping AI matching');
        return [];
    }

    // Deduplicate requests to save tokens
    const uniqueRequests = Array.from(new Set(unmatchedNames));

    if (uniqueRequests.length === 0 || rosterNames.length === 0) {
        return [];
    }

    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    const prompt = `
    You are an intelligent fuzzy name matcher for a sports league.
    Your goal is to match "requested names" (which may have typos, nicknames, or partial names) to the correct "roster name".

    Roster Names (Valid Players):
    ${JSON.stringify(rosterNames)}

    Requested Names to Match:
    ${JSON.stringify(uniqueRequests)}

    For each requested name, find the BEST match from the Roster Names.
    
    Rules:
    1. Look for nicknames (e.g. "Jacs" -> "Jacqueline", "Andy" -> "Andrew").
    2. Look for phonetic matches and typos.
    3. If no likely match is found, set "matched" to null.
    4. Provide a confidence score (0.0 to 1.0) and a short reasoning.
    
    RETURN JSON ARRAY ONLY:
    [
        { "requested": "Jacs Fulham", "matched": "Jacqueline Fulham", "confidence": 0.95, "reasoning": "Nickname match confirmed" },
        { "requested": "Unknown Person", "matched": null, "confidence": 0.0, "reasoning": "No similar name found" }
    ]
    `;

    // Create timeout controller
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    try {
        const result = await model.generateContent([prompt]);
        clearTimeout(timeoutId);

        const response = result.response;
        const text = response.text();
        const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();

        // Safe JSON parsing with validation
        try {
            const parsed = JSON.parse(cleanJson);
            if (!Array.isArray(parsed)) {
                console.error('AI match response is not an array');
                return [];
            }
            return parsed as AIMatchResult[];
        } catch (parseError) {
            console.error('Failed to parse AI match response:', parseError);
            return [];
        }
    } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
            console.error('AI matching request timed out');
        } else {
            console.error('Gemini AI Matching Error:', error);
        }
        return [];
    }
}
