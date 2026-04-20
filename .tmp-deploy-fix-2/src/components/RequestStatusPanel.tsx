import React from 'react';
import { Player, PlayerGroup, RequestConflict, NearMissGroup } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    AlertTriangle,
    CheckCircle,
    XCircle,
    AlertCircle,
    Users,
    Star,
    Heart,
    Zap
} from 'lucide-react';

interface RequestStatusPanelProps {
    players: Player[];
    playerGroups: PlayerGroup[];
    conflicts: RequestConflict[];
    nearMissGroups: NearMissGroup[];
}

export function RequestStatusPanel({
    players,
    playerGroups,
    conflicts,
    nearMissGroups
}: RequestStatusPanelProps) {
    // Calculate overall statistics
    const playersWithRequests = players.filter(p => p.teammateRequests.length > 0);
    const totalRequests = players.reduce((sum, p) => sum + p.teammateRequests.length, 0);

    // Count must-have (first request) vs nice-to-have (rest)
    let mustHaveHonored = 0;
    let mustHaveBroken = 0;
    let niceToHaveHonored = 0;
    let niceToHaveBroken = 0;

    // Avoid conflicts (request vs avoid)
    const avoidConflicts = conflicts.filter(c => c.conflictType === 'avoid-vs-request');
    const oneWayRequests = conflicts.filter(c => c.conflictType === 'one-way-request');

    // Calculate request fulfillment
    players.forEach(player => {
        player.teammateRequests.forEach((requestedName, index) => {
            const isMustHave = index === 0;
            const requestedPlayer = players.find(
                p => p.name.toLowerCase() === requestedName.toLowerCase()
            );

            if (!requestedPlayer) return;

            // Check if in same group
            const playerGroup = playerGroups.find(g => g.playerIds.includes(player.id));
            const isHonored = playerGroup?.playerIds.includes(requestedPlayer.id) ?? false;

            if (isMustHave) {
                if (isHonored) mustHaveHonored++;
                else mustHaveBroken++;
            } else {
                if (isHonored) niceToHaveHonored++;
                else niceToHaveBroken++;
            }
        });
    });

    const mustHaveTotal = mustHaveHonored + mustHaveBroken;
    const niceToHaveTotal = niceToHaveHonored + niceToHaveBroken;

    return (
        <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
                    <CardContent className="p-4 text-center">
                        <Star className="h-6 w-6 text-amber-600 mx-auto mb-1" />
                        <div className="text-xl font-bold text-amber-700">
                            {mustHaveHonored}/{mustHaveTotal}
                        </div>
                        <div className="text-xs text-amber-600">Must-Have Honored</div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                    <CardContent className="p-4 text-center">
                        <Heart className="h-6 w-6 text-blue-600 mx-auto mb-1" />
                        <div className="text-xl font-bold text-blue-700">
                            {niceToHaveHonored}/{niceToHaveTotal}
                        </div>
                        <div className="text-xs text-blue-600">Nice-to-Have Honored</div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
                    <CardContent className="p-4 text-center">
                        <AlertTriangle className="h-6 w-6 text-red-600 mx-auto mb-1" />
                        <div className="text-xl font-bold text-red-700">
                            {avoidConflicts.length}
                        </div>
                        <div className="text-xs text-red-600">Conflicts Detected</div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                    <CardContent className="p-4 text-center">
                        <Zap className="h-6 w-6 text-orange-600 mx-auto mb-1" />
                        <div className="text-xl font-bold text-orange-700">
                            {nearMissGroups.length}
                        </div>
                        <div className="text-xs text-orange-600">Near-Miss Groups</div>
                    </CardContent>
                </Card>
            </div>

            {/* Conflicts Section */}
            {avoidConflicts.length > 0 && (
                <Card className="border-red-200">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2 text-red-700">
                            <AlertTriangle className="h-4 w-4" />
                            Request Conflicts ({avoidConflicts.length})
                        </CardTitle>
                        <CardDescription>
                            These requests conflict with avoid requests
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {avoidConflicts.map((conflict, idx) => (
                                <Alert key={idx} className="bg-red-50 border-red-200">
                                    <AlertCircle className="h-4 w-4 text-red-600" />
                                    <AlertDescription className="text-sm text-red-800">
                                        {conflict.description}
                                    </AlertDescription>
                                </Alert>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Near-Miss Groups */}
            {nearMissGroups.length > 0 && (
                <Card className="border-orange-200">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2 text-orange-700">
                            <Users className="h-4 w-4" />
                            Near-Miss Groups ({nearMissGroups.length})
                        </CardTitle>
                        <CardDescription>
                            Groups that almost formed but couldn't fit constraints
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {nearMissGroups.map((group, idx) => (
                                <div key={idx} className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Badge variant="outline" className="text-orange-700 border-orange-300">
                                            {group.potentialSize} players
                                        </Badge>
                                        <span className="text-xs text-orange-600">
                                            {group.reason === 'group-too-large' && 'Exceeds max group size (4)'}
                                            {group.reason === 'would-exceed-team-size' && 'Would exceed max team size'}
                                            {group.reason === 'gender-constraints' && 'Gender requirements not met'}
                                            {group.reason === 'avoid-conflict' && 'Avoid conflict between members'}
                                        </span>
                                    </div>
                                    <div className="text-sm text-orange-800">
                                        {group.playerNames.join(', ')}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Detailed Player Request Status */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Player Request Details
                    </CardTitle>
                    <CardDescription>
                        Request status for each player (★ = must-have, ♡ = nice-to-have)
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                        {playersWithRequests.map(player => {
                            const playerGroup = playerGroups.find(g => g.playerIds.includes(player.id));

                            return (
                                <div
                                    key={player.id}
                                    className="p-3 border rounded-lg bg-gray-50"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-medium">{player.name}</span>
                                        {playerGroup && (
                                            <Badge
                                                style={{ backgroundColor: playerGroup.color }}
                                                className="text-white text-xs"
                                            >
                                                Group {playerGroup.label}
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {player.teammateRequests.map((name, idx) => {
                                            const isMustHave = idx === 0;
                                            const requestedPlayer = players.find(
                                                p => p.name.toLowerCase() === name.toLowerCase()
                                            );
                                            const isHonored = requestedPlayer && playerGroup?.playerIds.includes(requestedPlayer.id);
                                            const hasConflict = avoidConflicts.some(
                                                c => c.playerId === player.id && c.requestedName.toLowerCase() === name.toLowerCase()
                                            );

                                            return (
                                                <div
                                                    key={name}
                                                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${hasConflict
                                                            ? 'bg-red-100 text-red-700 border border-red-300'
                                                            : isHonored
                                                                ? 'bg-green-100 text-green-700 border border-green-300'
                                                                : 'bg-gray-100 text-gray-600 border border-gray-300'
                                                        }`}
                                                >
                                                    {isMustHave ? (
                                                        <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                                                    ) : (
                                                        <Heart className="h-3 w-3 text-pink-400" />
                                                    )}
                                                    {name}
                                                    {hasConflict ? (
                                                        <AlertTriangle className="h-3 w-3 text-red-500" />
                                                    ) : isHonored ? (
                                                        <CheckCircle className="h-3 w-3 text-green-500" />
                                                    ) : (
                                                        <XCircle className="h-3 w-3 text-gray-400" />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
