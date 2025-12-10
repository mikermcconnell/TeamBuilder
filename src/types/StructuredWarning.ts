/**
 * Structured warning types for CSV import validation
 */

export type WarningCategory =
    | 'info'           // Format detection, column parsing info
    | 'match-exact'    // Exact or high-confidence matches (auto-accepted)
    | 'match-review'   // Medium-confidence matches (needs review)
    | 'not-found';     // Player not found in roster

export type WarningStatus = 'pending' | 'accepted' | 'rejected';

export interface StructuredWarning {
    id: string;
    category: WarningCategory;
    message: string;
    playerName?: string;        // The player making the request
    requestedName?: string;     // The name they requested
    matchedName?: string;       // The suggested match (if any)
    confidence?: 'exact' | 'high' | 'medium' | 'low';
    matchReason?: string;       // e.g., "Phonetic similarity", "High similarity (82%)"
    status: WarningStatus;
}

/**
 * Helper to generate a unique warning ID
 */
export function generateWarningId(): string {
    return `warn-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
}

/**
 * Parse a warning message string into a StructuredWarning
 */
export function parseWarningMessage(message: string): StructuredWarning {
    const id = generateWarningId();

    // Pattern: Player "X": Teammate request "Y" matched to "Z" (Reason)
    const matchPattern = /Player "([^"]+)": (?:Teammate|Avoid) request "([^"]+)" matched to "([^"]+)" \(([^)]+)\)/;
    const matchResult = message.match(matchPattern);

    if (matchResult) {
        const [, playerName, requestedName, matchedName, reason] = matchResult;
        const needsVerify = message.includes('please verify');
        const isExact = reason?.toLowerCase().includes('exact') ?? false;

        let confidence: 'exact' | 'high' | 'medium' | 'low' = 'medium';
        if (isExact) confidence = 'exact';
        else if (reason?.toLowerCase().includes('high similarity')) confidence = 'high';
        else if (reason?.toLowerCase().includes('phonetic')) confidence = 'medium';

        return {
            id,
            category: needsVerify ? 'match-review' : 'match-exact',
            message,
            playerName,
            requestedName,
            matchedName,
            confidence,
            matchReason: reason ?? '',
            status: 'pending'
        };
    }

    // Pattern: Player "X": Teammate request "Y" not found in roster
    const notFoundPattern = /Player "([^"]+)": (?:Teammate|Avoid) request "([^"]+)" not found/;
    const notFoundResult = message.match(notFoundPattern);

    if (notFoundResult) {
        const [, playerName, requestedName] = notFoundResult;

        // Check for "Did you mean" suggestion
        const didYouMeanPattern = /Did you mean "([^"]+)"\?/;
        const didYouMeanResult = message.match(didYouMeanPattern);

        return {
            id,
            category: 'not-found',
            message,
            playerName,
            requestedName,
            matchedName: didYouMeanResult?.[1],
            confidence: didYouMeanResult ? 'low' : undefined,
            status: 'pending'
        };
    }

    // Default: informational warning
    return {
        id,
        category: 'info',
        message,
        status: 'pending'
    };
}

/**
 * Parse an array of warning strings into structured warnings
 */
export function parseWarnings(warnings: string[]): StructuredWarning[] {
    return warnings.map(parseWarningMessage);
}
