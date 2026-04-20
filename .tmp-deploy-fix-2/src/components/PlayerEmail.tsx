import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Mail, 
  Send, 
  Copy, 
  Eye, 
  CheckCircle, 
  Users, 
  AlertCircle,
  ExternalLink 
} from 'lucide-react';
import { Player, Team } from '@/types';

interface PlayerEmailProps {
  teams: Team[];
  unassignedPlayers: Player[];
}

interface EmailTemplate {
  subject: string;
  message: string;
}

const PlayerEmail: React.FC<PlayerEmailProps> = ({ teams, unassignedPlayers }) => {
  const [eventName, setEventName] = useState('');
  const [emailTemplate, setEmailTemplate] = useState<EmailTemplate>({
    subject: 'Your Team Assignment for {EVENT_NAME}',
    message: `Hi {PLAYER_NAME},

Great news! You've been assigned to {TEAM_NAME} for {EVENT_NAME}.

Your Team Details:
{TEAM_ROSTER}

We're excited to have you participate! Please let us know if you have any questions.

Best regards,
The Event Organizers`
  });
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');
  const [previewEmail, setPreviewEmail] = useState<string>('');
  const [emailsSent, setEmailsSent] = useState<Set<string>>(new Set());

  // Get all players with email addresses
  const allPlayers = [
    ...teams.flatMap(team => team.players),
    ...unassignedPlayers
  ].filter(player => player.email);

  const playersWithoutEmail = [
    ...teams.flatMap(team => team.players),
    ...unassignedPlayers
  ].filter(player => !player.email);

  const getPlayerTeam = (playerId: string): Team | null => {
    return teams.find(team => team.players.some(p => p.id === playerId)) || null;
  };

  const generateEmailContent = (player: Player): { subject: string; body: string } => {
    const team = getPlayerTeam(player.id);
    const teamName = team ? team.name : 'Unassigned';
    
    let teamRoster = '';
    if (team) {
      teamRoster = team.players.map((p, index) => 
        `${index + 1}. ${p.name} (${p.gender}, Skill: ${p.skillRating})`
      ).join('\n');
    } else {
      teamRoster = 'You are currently unassigned. We will update you with your team assignment soon.';
    }

    const subject = emailTemplate.subject
      .replace('{EVENT_NAME}', eventName || 'Our Event')
      .replace('{PLAYER_NAME}', player.name)
      .replace('{TEAM_NAME}', teamName);

    const body = emailTemplate.message
      .replace('{PLAYER_NAME}', player.name)
      .replace('{EVENT_NAME}', eventName || 'Our Event')
      .replace('{TEAM_NAME}', teamName)
      .replace('{TEAM_ROSTER}', teamRoster);

    return { subject, body };
  };

  const handlePreview = (playerId: string) => {
    const player = allPlayers.find(p => p.id === playerId);
    if (!player) return;

    const { subject, body } = generateEmailContent(player);
    setPreviewEmail(`Subject: ${subject}\n\n${body}`);
    setSelectedPlayerId(playerId);
  };

  const handleCopyEmail = (playerId: string) => {
    const player = allPlayers.find(p => p.id === playerId);
    if (!player) return;

    const { subject, body } = generateEmailContent(player);
    const emailContent = `To: ${player.email}\nSubject: ${subject}\n\n${body}`;
    
    navigator.clipboard.writeText(emailContent);
  };

  const handleSendEmail = (playerId: string) => {
    const player = allPlayers.find(p => p.id === playerId);
    if (!player) return;

    const { subject, body } = generateEmailContent(player);
    const gmailUrl = `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(player.email!)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    window.open(gmailUrl, '_blank');
    setEmailsSent(prev => new Set([...prev, playerId]));
  };

  const handleBulkEmailAll = () => {
    const emailContents = allPlayers.map(player => {
      const { subject, body } = generateEmailContent(player);
      return `To: ${player.email}\nSubject: ${subject}\n\n${body}\n\n---\n\n`;
    }).join('');

    navigator.clipboard.writeText(emailContents);
  };

  const getTeamStats = () => {
    const totalPlayers = allPlayers.length;
    const assignedPlayers = teams.flatMap(t => t.players).filter(p => p.email).length;
    const teamsWithEmails = teams.filter(team => 
      team.players.some(p => p.email)
    ).length;

    return { totalPlayers, assignedPlayers, teamsWithEmails };
  };

  const stats = getTeamStats();

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-white/90 backdrop-blur-xl border-green-200 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-800">
            <Mail className="w-5 h-5 text-primary" />
            📧 Individual Player Emails
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="text-center p-3 bg-primary/10 rounded-lg border border-primary/20">
              <div className="text-2xl font-bold text-primary">{stats.totalPlayers}</div>
              <div className="text-sm text-gray-600">Players with Email</div>
            </div>
            <div className="text-center p-3 bg-secondary/10 rounded-lg border border-secondary/20">
              <div className="text-2xl font-bold text-secondary">{stats.assignedPlayers}</div>
              <div className="text-sm text-gray-600">Assigned to Teams</div>
            </div>
            <div className="text-center p-3 bg-accent/10 rounded-lg border border-accent/20">
              <div className="text-2xl font-bold text-accent">{stats.teamsWithEmails}</div>
              <div className="text-sm text-gray-600">Teams with Emails</div>
            </div>
          </div>

          {playersWithoutEmail.length > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {playersWithoutEmail.length} players don't have email addresses: {playersWithoutEmail.map(p => p.name).join(', ')}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="compose" className="space-y-4">
        <TabsList className="bg-white border border-green-200">
          <TabsTrigger value="compose" className="data-[state=active]:bg-primary data-[state=active]:text-white">
            Compose Template
          </TabsTrigger>
          <TabsTrigger value="send" className="data-[state=active]:bg-primary data-[state=active]:text-white">
            Send Emails
          </TabsTrigger>
          <TabsTrigger value="preview" className="data-[state=active]:bg-primary data-[state=active]:text-white">
            Preview
          </TabsTrigger>
        </TabsList>

        {/* Compose Template Tab */}
        <TabsContent value="compose">
          <Card className="bg-white/90 backdrop-blur-xl border-green-200 shadow-lg">
            <CardHeader>
              <CardTitle className="text-gray-800">Email Template</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Event Name
                </label>
                <Input
                  placeholder="e.g., Summer Basketball League 2024"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  className="border-green-200 focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Subject
                </label>
                <Input
                  placeholder="Subject line for emails"
                  value={emailTemplate.subject}
                  onChange={(e) => setEmailTemplate(prev => ({ ...prev, subject: e.target.value }))}
                  className="border-green-200 focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Message
                </label>
                <Textarea
                  placeholder="Email message content..."
                  value={emailTemplate.message}
                  onChange={(e) => setEmailTemplate(prev => ({ ...prev, message: e.target.value }))}
                  rows={8}
                  className="border-green-200 focus:border-primary"
                />
              </div>

              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <h4 className="font-medium text-gray-800 mb-2">Available Placeholders:</h4>
                <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                  <div><code>{'{PLAYER_NAME}'}</code> - Player's name</div>
                  <div><code>{'{EVENT_NAME}'}</code> - Event name</div>
                  <div><code>{'{TEAM_NAME}'}</code> - Team name</div>
                  <div><code>{'{TEAM_ROSTER}'}</code> - Full team roster</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Send Emails Tab */}
        <TabsContent value="send">
          <div className="grid gap-4">
            {/* Bulk Actions */}
            <Card className="bg-white/90 backdrop-blur-xl border-green-200 shadow-lg">
              <CardHeader>
                <CardTitle className="text-gray-800">Bulk Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={handleBulkEmailAll}
                  className="bg-primary hover:bg-primary/90 text-white"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy All Emails to Clipboard
                </Button>
              </CardContent>
            </Card>

            {/* Individual Player Emails */}
            <Card className="bg-white/90 backdrop-blur-xl border-green-200 shadow-lg">
              <CardHeader>
                <CardTitle className="text-gray-800">Individual Player Emails</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {allPlayers.map(player => {
                    const team = getPlayerTeam(player.id);
                    const wasEmailSent = emailsSent.has(player.id);

                    return (
                      <div
                        key={player.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-800">{player.name}</span>
                            <Badge className="bg-secondary text-white text-xs">
                              {player.gender}
                            </Badge>
                            {team && (
                              <Badge className="bg-primary text-white text-xs">
                                {team.name}
                              </Badge>
                            )}
                            {wasEmailSent && (
                              <Badge className="bg-green-500 text-white text-xs">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Sent
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-gray-600">{player.email}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePreview(player.id)}
                            className="border-gray-300 hover:bg-gray-100"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCopyEmail(player.id)}
                            className="border-gray-300 hover:bg-gray-100"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleSendEmail(player.id)}
                            className="bg-primary hover:bg-primary/90 text-white"
                          >
                            <ExternalLink className="w-4 h-4 mr-1" />
                            Gmail
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Preview Tab */}
        <TabsContent value="preview">
          <Card className="bg-white/90 backdrop-blur-xl border-green-200 shadow-lg">
            <CardHeader>
              <CardTitle className="text-gray-800">Email Preview</CardTitle>
            </CardHeader>
            <CardContent>
              {previewEmail ? (
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <pre className="whitespace-pre-wrap text-sm text-gray-800">{previewEmail}</pre>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Click "Preview" on any player to see their email content
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PlayerEmail; 