import { GoogleGenerativeAI } from '@google/generative-ai';
import { Player, Team, LeagueConfig } from '@/types';
import { TeamSuggestion } from '@/types/ai';

// Initialize the API client
// Note: In a production app, this should be proxied through a backend to protect the key
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(API_KEY);

export async function generateTeamSuggestions(
    prompt: string,
    players: Player[],
    teams: Team[],
    config: LeagueConfig
): Promise<TeamSuggestion[]> {
    if (!API_KEY) {
        throw new Error('Missing Gemini API Key');
    }

    const model = genAI.getGenerativeModel({ model: "gemini-3-pro-preview" });

    // Filter out players who are already on a team
    const assignedPlayerIds = new Set(teams.flatMap(t => t.players.map(p => p.id)));
    const unassignedPlayers = players.filter(p => !assignedPlayerIds.has(p.id));

    // Prepare context data
    const context = {
        request: prompt,
        constraints: {
            maxTeamSize: config.maxTeamSize,
            gender: { minM: config.minMales, minF: config.minFemales },
            handlers: "Try to balance handlers evenly (target 3 per team)"
        },
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
                isHandler: p.isHandler
            }))
        })),
        unassignedPool: unassignedPlayers.map(p => ({
            id: p.id,
            name: p.name,
            skill: p.execSkillRating ?? p.skillRating,
            gender: p.gender,
            isHandler: p.isHandler
        })),
        unassignedCount: unassignedPlayers.length
    };

    // DEBUG: Log context to ensure IDs are correct
    console.log("Gemini Context:", JSON.stringify(context, null, 2));

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

        return JSON.parse(cleanJson) as TeamSuggestion[];
    } catch (error) {
        console.error('Gemini API Error:', error);
        throw new Error('Failed to generate suggestions');
    }
}
