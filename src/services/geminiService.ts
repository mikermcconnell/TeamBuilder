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
        unassignedCount: players.length - teams.reduce((sum, t) => sum + t.players.length, 0)
    };

    const systemPrompt = `
    You are an AI Team Builder Assistant.
    Analyze the provided team data and the user's request.
    Suggest specific MOVES or SWAPS to improve the teams based on the goal.
    
    Current request: "${prompt}"

    Please provide exactly THREE (3) distinct options/suggestions to address this request.
    Rank them from most recommended (1st) to least recommended (3rd).
    Each option should be a separate item in the returned array.

    Return a JSON array of suggestions. Each suggestion must have:
    - id: unique string
    - type: "move" or "swap"
    - title: specific title (e.g. "Option 1: Swap Alice & Bob")
    - reasoning: brief explanation of WHY this option works (e.g. "Swapping Alice (Skill 9) with Bob (Skill 5) reduces Team 1's average to match the league mean, while maintaining gender balance.")
    - actions: array of objects with { playerId, sourceTeamId, targetTeamId }

    For a SWAP, return TWO actions (one for each player).
    For a MOVE, return ONE action.
    Use 'unassigned' as teamId if moving to/from unassigned pool.
    
    IMPORTANT: Return ONLY the JSON array. Do not include markdown formatting.
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
