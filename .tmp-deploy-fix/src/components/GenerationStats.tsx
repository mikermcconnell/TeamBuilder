import React from 'react';
import { TeamGenerationStats } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  BarChart3, 
  Clock, 
  Users, 
  UserCheck, 
  UserX, 
  AlertTriangle,
  CheckCircle,
  TrendingUp
} from 'lucide-react';

interface GenerationStatsProps {
  stats: TeamGenerationStats;
  totalTeams?: number;
}

export function GenerationStats({ stats, totalTeams = 0 }: GenerationStatsProps) {
  const assignmentRate = stats.totalPlayers > 0 
    ? (stats.assignedPlayers / stats.totalPlayers) * 100 
    : 0;

  const mutualRequestsTotal = stats.mutualRequestsHonored + stats.mutualRequestsBroken;
  const mutualRequestsRate = mutualRequestsTotal > 0 
    ? (stats.mutualRequestsHonored / mutualRequestsTotal) * 100 
    : 100;

  const getPerformanceColor = (percentage: number): string => {
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 75) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getPerformanceBadge = (percentage: number): { variant: 'default' | 'secondary' | 'destructive'; label: string } => {
    if (percentage === 100) return { variant: 'default', label: 'Excellent' };
    if (percentage >= 75) return { variant: 'secondary', label: 'Good' };
    return { variant: 'destructive', label: 'Needs Improvement' };
  };

  return (
    <Card className="bg-white/90 backdrop-blur-xl border-green-200 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-gray-800">
          <BarChart3 className="h-5 w-5 text-primary" />
          📊 Team Generation Statistics
        </CardTitle>
        <CardDescription className="text-gray-600">
          Analysis of team balancing, custom group placement, and constraint satisfaction
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Overall Performance */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-white border-green-200 shadow-sm">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">
                {totalTeams}
              </div>
              <div className="text-sm text-gray-600 mb-2 font-medium">Teams Created</div>
              <Badge variant="default">
                Success
              </Badge>
            </CardContent>
          </Card>
          
          <Card className="bg-white border-green-200 shadow-sm">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary">
                {assignmentRate.toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600 mb-2 font-medium">Player Assignment Rate</div>
              <Badge {...getPerformanceBadge(assignmentRate)}>
                {getPerformanceBadge(assignmentRate).label}
              </Badge>
            </CardContent>
          </Card>
          
          <Card className="bg-white border-green-200 shadow-sm">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-secondary">
                {mutualRequestsRate.toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600 mb-2 font-medium">Requests Honored</div>
              <Badge {...getPerformanceBadge(mutualRequestsRate)}>
                {getPerformanceBadge(mutualRequestsRate).label}
              </Badge>
            </CardContent>
          </Card>
          
          <Card className="bg-white border-green-200 shadow-sm">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-accent">
                {stats.generationTime}ms
              </div>
              <div className="text-sm text-gray-600 mb-2 font-medium">Processing Time</div>
              <Badge variant="secondary">
                {stats.generationTime < 1000 ? 'Fast' : 'Normal'}
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Player Assignment */}
          <div className="space-y-4">
            <h4 className="font-semibold flex items-center gap-2 text-gray-800">
              <Users className="h-4 w-4 text-primary" />
              ⚽ Player Assignment
            </h4>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  <span className="text-sm text-gray-700 font-medium">Assigned Players</span>
                </div>
                <Badge variant="default">{stats.assignedPlayers}</Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-accent" />
                  <span className="text-sm text-gray-700 font-medium">Unassigned Players</span>
                </div>
                <Badge variant="secondary">{stats.unassignedPlayers}</Badge>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm text-gray-700 font-medium">
                  <span>Assignment Progress</span>
                  <span>{assignmentRate.toFixed(1)}%</span>
                </div>
                <Progress value={assignmentRate} className="h-2 w-full" />
              </div>
            </div>
          </div>

          {/* Constraint Satisfaction */}
          <div className="space-y-4">
            <h4 className="font-semibold flex items-center gap-2 text-gray-800">
              <TrendingUp className="h-4 w-4 text-secondary" />
              📈 Constraint Satisfaction
            </h4>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-primary" />
                  <span className="text-sm text-gray-700 font-medium">Group Requests Honored</span>
                </div>
                <Badge variant="default">{stats.mutualRequestsHonored}</Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserX className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-gray-700 font-medium">Group Requests Broken</span>
                </div>
                <Badge variant="destructive">{stats.mutualRequestsBroken}</Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-accent" />
                  <span className="text-sm text-gray-700 font-medium">Avoid Violations</span>
                </div>
                <Badge variant={stats.avoidRequestsViolated > 0 ? 'destructive' : 'default'}>
                  {stats.avoidRequestsViolated}
                </Badge>
              </div>
              
              {mutualRequestsTotal > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm text-gray-700 font-medium">
                    <span>Group Success Rate</span>
                    <span>{mutualRequestsRate.toFixed(1)}%</span>
                  </div>
                  <Progress value={mutualRequestsRate} className="h-2 w-full" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Summary Insights */}
        <div className="border-t pt-4">
          <h4 className="font-semibold mb-3 text-gray-800">🏆 Generation Summary</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div className="text-center p-4 bg-white border border-blue-200 rounded-lg shadow-sm">
              <div className="text-2xl font-bold text-gray-800">{stats.totalPlayers}</div>
              <div className="text-gray-600 font-medium">Total Players</div>
            </div>
            
            <div className="text-center p-4 bg-white border border-green-200 rounded-lg shadow-sm">
              <div className="text-2xl font-bold text-primary">{stats.assignedPlayers}</div>
              <div className="text-gray-600 font-medium">Successfully Assigned</div>
            </div>
            
            <div className="text-center p-4 bg-white border border-orange-200 rounded-lg shadow-sm">
              <div className="text-2xl font-bold text-accent">{stats.unassignedPlayers}</div>
              <div className="text-gray-600 font-medium">Need Manual Assignment</div>
            </div>
            
            <div className="text-center p-4 bg-white border border-purple-200 rounded-lg shadow-sm">
              <div className="text-2xl font-bold text-secondary flex items-center justify-center gap-1">
                <Clock className="h-4 w-4" />
                {stats.generationTime}ms
              </div>
              <div className="text-gray-600 font-medium">Processing Time</div>
            </div>
          </div>
        </div>

        {/* Recommendations */}
        {(stats.unassignedPlayers > 0 || stats.avoidRequestsViolated > 0 || mutualRequestsRate < 80) && (
          <div className="border-t pt-4">
            <h4 className="font-semibold mb-3 flex items-center gap-2 text-gray-800">
              <AlertTriangle className="h-4 w-4 text-accent" />
              💡 Recommendations
            </h4>
            <div className="space-y-2 text-sm">
              {stats.unassignedPlayers > 0 && (
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <strong>Unassigned Players:</strong> Consider adjusting team size limits or gender requirements to accommodate all players.
                </div>
              )}
              
              {stats.avoidRequestsViolated > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <strong>Avoid Violations:</strong> Some players are on teams with people they wanted to avoid. Review team assignments manually.
                </div>
              )}
              
              {mutualRequestsRate < 80 && mutualRequestsTotal > 0 && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <strong>Low Request Success:</strong> Many teammate requests couldn't be honored. Consider relaxing other constraints or manually adjusting teams.
                </div>
              )}
              
              {assignmentRate === 100 && mutualRequestsRate >= 90 && stats.avoidRequestsViolated === 0 && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <strong>Excellent Results:</strong> All players assigned with high constraint satisfaction. Teams are ready to use!
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
