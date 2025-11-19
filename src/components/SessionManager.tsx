import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import {
  Save,
  FolderOpen,
  Cloud,
  LogIn,
  LogOut,
  Trash2,
  Clock,
  Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

import {
  signOutUser,
  getCurrentUser,
  subscribeToAuthChanges
} from '@/services/authService';
import {
  saveSession,
  getUserSessions,
  deleteSession,
  SessionData,
  updateSession
} from '@/services/firestoreService';
import { AppState } from '@/types';
import { AuthDialog } from '@/components/AuthDialog';

interface SessionManagerProps {
  appState: AppState;
  onLoadSession: (sessionData: SessionData) => void;
}

export function SessionManager({ appState, onLoadSession }: SessionManagerProps) {
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [showSessionsDialog, setShowSessionsDialog] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Subscribe to auth changes
  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((user) => {
      setUser(user);
      if (user) {
        loadUserSessions(user.uid);
      }
    });

    // Check for existing user on mount
    getCurrentUser().then(setUser);

    return unsubscribe;
  }, []);

  const loadUserSessions = async (userId: string) => {
    try {
      const userSessions = await getUserSessions(userId);
      setSessions(userSessions);
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  };

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      await signOutUser();
      setUser(null);
      setSessions([]);
      setCurrentSessionId(null);
      toast.success('Signed out successfully');
    } catch (error) {
      toast.error('Failed to sign out');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSession = async () => {
    if (!user) {
      setShowAuthDialog(true);
      return;
    }

    if (!sessionName.trim()) {
      toast.error('Please enter a session name');
      return;
    }

    setIsLoading(true);
    try {
      const sessionData: Omit<SessionData, 'id' | 'createdAt' | 'updatedAt'> = {
        userId: user.uid,
        name: sessionName,
        players: appState.players,
        teams: appState.teams,
        unassignedPlayers: appState.unassignedPlayers,
        playerGroups: appState.playerGroups,
        config: appState.config
      };

      if (currentSessionId) {
        // Update existing session
        await updateSession(currentSessionId, sessionData);
        toast.success('Session updated successfully');
      } else {
        // Save new session
        const sessionId = await saveSession(sessionData);
        setCurrentSessionId(sessionId);
        toast.success('Session saved successfully');
      }
      
      await loadUserSessions(user.uid);
      setSessionName('');
    } catch (error) {
      toast.error('Failed to save session');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadSession = async (session: SessionData) => {
    setIsLoading(true);
    try {
      onLoadSession(session);
      setCurrentSessionId(session.id || null);
      setSessionName(session.name);
      setShowSessionsDialog(false);
      toast.success(`Loaded session: ${session.name}`);
    } catch (error) {
      toast.error('Failed to load session');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this session?')) {
      return;
    }

    setIsLoading(true);
    try {
      await deleteSession(sessionId);
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
        setSessionName('');
      }
      await loadUserSessions(user!.uid);
      toast.success('Session deleted');
    } catch (error) {
      toast.error('Failed to delete session');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (date: Date | undefined) => {
    if (!date) return 'Unknown';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric'
    }).format(date);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud className="h-5 w-5" />
          Cloud Storage
        </CardTitle>
        <CardDescription>
          Save and load your team building sessions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* User Status */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          {user ? (
            <>
              <div className="flex items-center gap-2">
                <Badge variant="default">
                  Cloud sync active
                </Badge>
                <span className="text-sm text-gray-600">
                  {user.email || 'Signed in'}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                disabled={isLoading}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </>
          ) : (
            <>
              <span className="text-sm text-gray-600">Not signed in</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAuthDialog(true)}
                disabled={isLoading}
              >
                <LogIn className="h-4 w-4 mr-2" />
                Sign In
              </Button>
            </>
          )}
        </div>

        {/* Current Session Info */}
        {currentSessionId && (
          <Alert>
            <AlertDescription>
              Working on: <strong>{sessionName}</strong>
            </AlertDescription>
          </Alert>
        )}

        {/* Save Session */}
        <div className="space-y-2">
          <Label htmlFor="session-name">Session Name</Label>
          <div className="flex gap-2">
            <Input
              id="session-name"
              placeholder="Enter session name..."
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
            />
            <Button
              onClick={handleSaveSession}
              disabled={isLoading || !sessionName.trim()}
            >
              <Save className="h-4 w-4 mr-2" />
              {currentSessionId ? 'Update' : 'Save'}
            </Button>
          </div>
        </div>

        {/* Load Sessions */}
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setShowSessionsDialog(true)}
          disabled={!user || isLoading}
        >
          <FolderOpen className="h-4 w-4 mr-2" />
          Load Session ({sessions.length})
        </Button>

        <AuthDialog open={showAuthDialog} onOpenChange={setShowAuthDialog} />

        {/* Sessions Dialog */}
        <Dialog open={showSessionsDialog} onOpenChange={setShowSessionsDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Your Saved Sessions</DialogTitle>
              <DialogDescription>
                Select a session to load
              </DialogDescription>
            </DialogHeader>
            
            <ScrollArea className="h-96">
              {sessions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No saved sessions yet
                </div>
              ) : (
                <div className="space-y-2">
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex-1">
                        <div className="font-medium">{session.name}</div>
                        <div className="text-sm text-gray-500 space-x-4">
                          <span>{session.players.length} players</span>
                          <span>{session.teams.length} teams</span>
                          <span className="flex items-center gap-1 inline-flex">
                            <Clock className="h-3 w-3" />
                            {formatDate(session.updatedAt)}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleLoadSession(session)}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Load
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteSession(session.id!)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
