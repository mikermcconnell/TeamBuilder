import { GoogleGenerativeAI } from '@google/generative-ai';
import { Player, Team, LeagueConfig, PlayerGroup, TeamGenerationStats } from '@/types';
import { TeamSuggestion } from '@/types/ai';
import { GEMINI_MODEL } from '@/config/constants';
import { buildGenerationResult, generateBalancedTeams } from '@/utils/teamGenerator';
import { fuzzyMatcher } from '@/utils/fuzzyNameMatcher';

// Initialize the API client
// SECURITY WARNING: In production, this API key should be proxied through a backend service
// (Firebase Functions, Vercel Serverless, etc.) to protect from extraction via DevTools.
// See: https://cloud.google.com/docs/authentication/api-keys#securing_an_api_key
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(API_KEY);

// Default timeout for API requests (30 seconds)
const API_TIMEOUT_MS = 30000;

export interface AITeamDraftPayload {
    summary?: string;
    teams: Array<{
        slot: number;
        playerIds: string[];
    }>;
    unassignedPlayerIds?: string[];
}

interface AITeamDraftValidationResult {
    valid: boolean;
    errors: string[];
}

export interface AIFullTeamResult {
    teams: Team[];
    unassignedPlayers: Player[];
    stats: TeamGenerationStats;
    source: 'ai' | 'fallback';
    summary?: string;
}

function calculateAverageSkillByGender(players: Player[]) {
    const groups: Record<'M' | 'F' | 'Other', number[]> = {
        M: [],
        F: [],
        Other: [],
    };

    players.forEach(player => {
        groups[player.gender].push(player.execSkillRating ?? player.skillRating);
    });

    return {
        M: groups.M.length > 0 ? Number((groups.M.reduce((sum, value) => sum + value, 0) / groups.M.length).toFixed(2)) : null,
        F: groups.F.length > 0 ? Number((groups.F.reduce((sum, value) => sum + value, 0) / groups.F.length).toFixed(2)) : null,
        Other: groups.Other.length > 0 ? Number((groups.Other.reduce((sum, value) => sum + value, 0) / groups.Other.length).toFixed(2)) : null,
    };
}

function cleanJsonResponse(text: string): string {
    return text.replace(/```json/g, '').replace(/```/g, '').trim();
}

function calculateTeamStats(team: Team): Team {
    const totalSkill = team.players.reduce((sum, player) => sum + (player.execSkillRating ?? player.skillRating), 0);
    const genderBreakdown = { M: 0, F: 0, Other: 0 };
    let handlerCount = 0;

    team.players.forEach(player => {
        genderBreakdown[player.gender]++;
        if (player.isHandler) {
            handlerCount += 1;
        }
    });

    return {
        ...team,
        averageSkill: team.players.length > 0 ? totalSkill / team.players.length : 0,
        genderBreakdown,
        handlerCount,
    };
}

export function validateAiTeamDraft(
    payload: AITeamDraftPayload,
    players: Player[],
    config: LeagueConfig,
    playerGroups: PlayerGroup[]
): AITeamDraftValidationResult {
    const errors: string[] = [];
    const expectedTeamCount = config.targetTeams || Math.ceil(players.length / config.maxTeamSize);
    const playerIds = new Set(players.map(player => player.id));
    const assignedIds = new Set<string>();
    const destinationByPlayer = new Map<string, string>();

    if (!Array.isArray(payload.teams) || payload.teams.length !== expectedTeamCount) {
        errors.push(`Expected exactly ${expectedTeamCount} teams in the AI response.`);
        return { valid: false, errors };
    }

    const normalizedUnassigned = new Set(payload.unassignedPlayerIds ?? []);

    payload.teams.forEach((team, index) => {
        if (team.slot !== index + 1) {
            errors.push('AI team slots must be sequential and start at 1.');
        }

        if (!Array.isArray(team.playerIds)) {
            errors.push(`Team slot ${index + 1} is missing a playerIds array.`);
            return;
        }

        if (team.playerIds.length > config.maxTeamSize) {
            errors.push(`Team slot ${index + 1} exceeds the max team size.`);
        }

        team.playerIds.forEach(playerId => {
            if (!playerIds.has(playerId)) {
                errors.push(`Unknown player id "${playerId}" returned by AI.`);
                return;
            }

            if (assignedIds.has(playerId) || normalizedUnassigned.has(playerId)) {
                errors.push(`Player "${playerId}" was assigned more than once.`);
                return;
            }

            assignedIds.add(playerId);
            destinationByPlayer.set(playerId, `team-${team.slot}`);
        });
    });

    normalizedUnassigned.forEach(playerId => {
        if (!playerIds.has(playerId)) {
            errors.push(`Unknown unassigned player id "${playerId}" returned by AI.`);
            return;
        }

        if (assignedIds.has(playerId)) {
            errors.push(`Player "${playerId}" appears in both a team and the unassigned list.`);
            return;
        }

        assignedIds.add(playerId);
        destinationByPlayer.set(playerId, 'unassigned');
    });

    if (assignedIds.size !== players.length) {
        errors.push('AI response did not account for every player exactly once.');
    }

    playerGroups.forEach(group => {
        const destinations = new Set(
            group.playerIds
                .map(playerId => destinationByPlayer.get(playerId))
                .filter((destination): destination is string => Boolean(destination))
        );

        if (destinations.size > 1) {
            errors.push(`Group ${group.label} was split across multiple destinations.`);
        }
    });

    payload.teams.forEach(team => {
        const teamPlayers = team.playerIds
            .map(playerId => players.find(player => player.id === playerId))
            .filter((player): player is Player => Boolean(player));

        const femaleCount = teamPlayers.filter(player => player.gender === 'F').length;
        const maleCount = teamPlayers.filter(player => player.gender === 'M').length;

        if (femaleCount < config.minFemales) {
            errors.push(`Team slot ${team.slot} does not meet the minimum female requirement.`);
        }

        if (maleCount < config.minMales) {
            errors.push(`Team slot ${team.slot} does not meet the minimum male requirement.`);
        }

        for (const player of teamPlayers) {
            const hasAvoidConflict = teamPlayers.some(otherPlayer => (
                otherPlayer.id !== player.id
                && (
                    player.avoidRequests.some(name => fuzzyMatcher.isLikelyMatch(name, otherPlayer.name, 0.8))
                    || otherPlayer.avoidRequests.some(name => fuzzyMatcher.isLikelyMatch(name, player.name, 0.8))
                )
            ));

            if (hasAvoidConflict) {
                errors.push(`Team slot ${team.slot} contains at least one avoid conflict.`);
                break;
            }
        }
    });

    return {
        valid: errors.length === 0,
        errors,
    };
}

export function parseAiTeamDraftResponse(text: string): AITeamDraftPayload | null {
    const cleanJson = cleanJsonResponse(text);

    try {
        const parsed = JSON.parse(cleanJson) as AITeamDraftPayload;
        if (!parsed || !Array.isArray(parsed.teams)) {
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}

function buildTeamsFromDraft(
    payload: AITeamDraftPayload,
    players: Player[],
    seedTeams: Team[]
): { teams: Team[]; unassignedPlayers: Player[] } {
    const playerMap = new Map(players.map(player => [player.id, player]));
    const teams = payload.teams.map((teamDraft, index) => {
        const seedTeam = seedTeams[index];
        const teamPlayers = teamDraft.playerIds
            .map(playerId => playerMap.get(playerId))
            .filter((player): player is Player => Boolean(player))
            .map(player => ({ ...player, teamId: seedTeam?.id }));

        return calculateTeamStats({
            id: seedTeam?.id || `team-${index + 1}`,
            name: seedTeam?.name || `Team ${index + 1}`,
            color: seedTeam?.color,
            colorName: seedTeam?.colorName,
            players: teamPlayers,
            averageSkill: 0,
            genderBreakdown: { M: 0, F: 0, Other: 0 },
            handlerCount: 0,
            isNameEditable: true,
        });
    });

    const assignedIds = new Set(teams.flatMap(team => team.players.map(player => player.id)));
    const unassignedIds = payload.unassignedPlayerIds ?? [];
    const unassignedPlayers = unassignedIds
        .map(playerId => playerMap.get(playerId))
        .filter((player): player is Player => Boolean(player))
        .map(player => ({ ...player, teamId: undefined }));

    players.forEach(player => {
        if (!assignedIds.has(player.id) && !unassignedIds.includes(player.id)) {
            unassignedPlayers.push({ ...player, teamId: undefined });
        }
    });

    return {
        teams,
        unassignedPlayers,
    };
}

export async function generateFullAiTeams(
    players: Player[],
    config: LeagueConfig,
    playerGroups: PlayerGroup[] = [],
    variant: 'primary' | 'alternate' = 'primary'
): Promise<AIFullTeamResult> {
    const fallbackResult = generateBalancedTeams(players, config, playerGroups, variant === 'alternate', false);

    if (!API_KEY) {
        return {
            ...fallbackResult,
            source: 'fallback',
            summary: 'AI key missing, so the standard team builder was used.',
        };
    }

    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    const teamCount = config.targetTeams || Math.ceil(players.length / config.maxTeamSize);

    const context = {
        variant,
        strategy: variant === 'alternate'
            ? 'Create a meaningfully different but still balanced option. Prioritize skill spread and different pairings where possible.'
            : 'Create the strongest all-around option. Prioritize hard constraints, avoid requests, teammate requests, and balanced skill.',
        teamCount,
        constraints: {
            maxTeamSize: config.maxTeamSize,
            minFemales: config.minFemales,
            minMales: config.minMales,
        },
        targetAverageSkillByGender: calculateAverageSkillByGender(players),
        playerGroups: playerGroups.map(group => ({
            label: group.label,
            playerIds: group.playerIds,
            playerNames: group.players.map(player => player.name),
        })),
        seedTeams: fallbackResult.teams.map((team, index) => ({
            slot: index + 1,
            teamId: team.id,
            playerIds: team.players.map(player => player.id),
            playerNames: team.players.map(player => player.name),
        })),
        players: players.map(player => ({
            id: player.id,
            name: player.name,
            gender: player.gender,
            skill: player.execSkillRating ?? player.skillRating,
            isHandler: Boolean(player.isHandler),
            teammateRequests: player.teammateRequests,
            avoidRequests: player.avoidRequests,
            groupId: player.groupId || null,
        })),
    };

    const prompt = `
You are generating a full sports team draft.

Create exactly ${teamCount} team assignments.
Use the provided player IDs exactly as given.

Priorities, in order:
1. Respect avoid requests and keep grouped players together.
2. Meet min male and min female counts on each team.
3. Honor teammate requests where possible.
4. Keep overall team skill balanced.
5. Keep male average skill and female average skill as balanced as possible across teams.
6. Keep handlers balanced.
7. For the "${variant}" variant, ${variant === 'alternate'
            ? 'make this option meaningfully different from the seed while staying reasonable.'
            : 'make this the strongest overall option.'}

Return ONLY valid JSON with this exact shape:
{
  "summary": "one sentence summary",
  "teams": [
    { "slot": 1, "playerIds": ["player-id-1", "player-id-2"] }
  ],
  "unassignedPlayerIds": []
}

Rules:
- Include all ${players.length} players exactly once across teams or unassignedPlayerIds.
- Do not invent player IDs.
- Do not split a player group across teams.
- Do not exceed max team size.
- Team slots must run from 1 to ${teamCount}.
- Use the provided targetAverageSkillByGender values as a guide when balancing the male and female skill averages on each team.
`;

    try {
        const result = await model.generateContent([prompt, JSON.stringify(context)]);
        const payload = parseAiTeamDraftResponse(result.response.text());

        if (!payload) {
            return {
                ...fallbackResult,
                source: 'fallback',
                summary: 'AI returned an unreadable response, so the standard team builder was used.',
            };
        }

        const validation = validateAiTeamDraft(payload, players, config, playerGroups);
        if (!validation.valid) {
            console.warn('AI full-team draft failed validation, using fallback:', validation.errors);
            return {
                ...fallbackResult,
                source: 'fallback',
                summary: 'AI produced an invalid draft, so the standard team builder was used.',
            };
        }

        const built = buildTeamsFromDraft(payload, players, fallbackResult.teams);
        const finalResult = buildGenerationResult(
            players,
            built.teams,
            built.unassignedPlayers,
            config,
            playerGroups
        );

        return {
            ...finalResult,
            source: 'ai',
            summary: payload.summary,
        };
    } catch (error) {
        console.error('Full AI team generation failed, using fallback:', error);
        return {
            ...fallbackResult,
            source: 'fallback',
            summary: 'AI request failed, so the standard team builder was used.',
        };
    }
}

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
        targetAverageSkillByGender: calculateAverageSkillByGender(players),
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
    While doing that, try to keep overall team skill balanced, and also keep male average skill and female average skill balanced across teams.
    
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
    6. Use the provided "targetAverageSkillByGender" as guidance. Avoid suggestions that improve one team by making male or female skill balance noticeably worse overall.
    
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
