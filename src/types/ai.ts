export type SuggestionType = 'move' | 'swap';

export interface SuggestionAction {
    playerId: string;
    sourceTeamId: string | 'unassigned';
    targetTeamId: string | 'unassigned';
}

export interface TeamSuggestion {
    id: string;
    type: SuggestionType;
    title: string;
    reasoning: string;
    actions: SuggestionAction[];
}
