import React, { ChangeEvent, RefObject, SetStateAction, Dispatch, useMemo } from 'react';
import { User } from 'firebase/auth';
import { Download, FolderOpen, Save, Trash2, Upload, UserCheck, Users } from 'lucide-react';

import { SavedWorkspace } from '@/types';
import { PersistenceStatusBadge } from '@/components/PersistenceStatusBadge';
import { PersistenceStatusModel } from '@/hooks/useAppPersistence';
import { AuthDialog } from '@/components/AuthDialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ProjectWorkspaceControlsProps {
  user: User | null;
  authDialogOpen: boolean;
  onAuthDialogOpenChange: Dispatch<SetStateAction<boolean>>;
  onSignOut: () => Promise<void>;
  persistenceStatus: PersistenceStatusModel;
  importFileInputRef: RefObject<HTMLInputElement | null>;
  onImportProjectBackup: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  onExportProjectBackup: () => void;
  onOpenProjectImport: () => void;
  onOpenSaveWorkspaceDialog: () => void;
  onOpenLoadWorkspaceDialog: () => void;
  isSaveWorkspaceDialogOpen: boolean;
  onSaveWorkspaceDialogOpenChange: Dispatch<SetStateAction<boolean>>;
  isLoadWorkspaceDialogOpen: boolean;
  onLoadWorkspaceDialogOpenChange: Dispatch<SetStateAction<boolean>>;
  workspaceName: string;
  workspaceDescription: string;
  currentWorkspaceId: string | null;
  setCurrentWorkspaceInfo: (id: string | null, name: string, description: string) => void;
  isSavingWorkspace: boolean;
  onSaveWorkspace: () => Promise<void>;
  workspaceSearchTerm: string;
  onWorkspaceSearchTermChange: Dispatch<SetStateAction<string>>;
  isFetchingWorkspaces: boolean;
  savedWorkspaces: SavedWorkspace[];
  loadingWorkspaceId: string | null;
  onLoadWorkspace: (id: string) => Promise<void>;
  onDeleteWorkspaceAction: (id: string, event: React.MouseEvent) => Promise<void>;
}

export function ProjectWorkspaceControls({
  user,
  authDialogOpen,
  onAuthDialogOpenChange,
  onSignOut,
  persistenceStatus,
  importFileInputRef,
  onImportProjectBackup,
  onExportProjectBackup,
  onOpenProjectImport,
  onOpenSaveWorkspaceDialog,
  onOpenLoadWorkspaceDialog,
  isSaveWorkspaceDialogOpen,
  onSaveWorkspaceDialogOpenChange,
  isLoadWorkspaceDialogOpen,
  onLoadWorkspaceDialogOpenChange,
  workspaceName,
  workspaceDescription,
  currentWorkspaceId,
  setCurrentWorkspaceInfo,
  isSavingWorkspace,
  onSaveWorkspace,
  workspaceSearchTerm,
  onWorkspaceSearchTermChange,
  isFetchingWorkspaces,
  savedWorkspaces,
  loadingWorkspaceId,
  onLoadWorkspace,
  onDeleteWorkspaceAction,
}: ProjectWorkspaceControlsProps) {
  const filteredWorkspaces = useMemo(
    () => savedWorkspaces.filter(ws => ws.name.toLowerCase().includes(workspaceSearchTerm.toLowerCase())),
    [savedWorkspaces, workspaceSearchTerm]
  );

  return (
    <>
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4 group">
          <img src="/logo-new.jpg" alt="TeamBuilder" className="h-16 w-16 object-cover rounded-full shadow-sm hover:scale-110 transition-transform duration-300" />
          <div>
            <h1 className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-900 to-indigo-600 drop-shadow-sm">
              TeamBuilder
            </h1>
            <p className="text-slate-500 font-medium text-sm">Create balanced teams in seconds</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input
            ref={importFileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={onImportProjectBackup}
          />

          <div className="flex items-center gap-2">
            <Button
              onClick={onExportProjectBackup}
              variant="ghost"
              className="h-10 px-3 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
            >
              <Download className="h-4 w-4 mr-2" /> Backup
            </Button>
            <Button
              onClick={onOpenProjectImport}
              variant="ghost"
              className="h-10 px-3 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
            >
              <Upload className="h-4 w-4 mr-2" /> Restore
            </Button>
          </div>

          {!user ? (
            <div className="flex items-center gap-3">
              <PersistenceStatusBadge status={persistenceStatus} />
              <Button
                onClick={() => onAuthDialogOpenChange(true)}
                className="bg-white hover:bg-slate-50 text-slate-700 border-b-4 border-slate-200 active:border-b-0 rounded-xl font-bold px-6 h-12 transition-all active:translate-y-1"
              >
                Sign In
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 mr-2">
                <Button
                  onClick={onOpenLoadWorkspaceDialog}
                  variant="ghost"
                  className="h-10 px-3 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  <FolderOpen className="h-4 w-4 mr-2" /> Load Project
                </Button>
                <Button
                  onClick={onOpenSaveWorkspaceDialog}
                  variant="ghost"
                  className="h-10 px-3 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  <div className="flex items-center gap-2">
                    <Save className="h-4 w-4 mr-2" />
                    <span className="hidden xl:inline">Save Project</span>
                    <span className="xl:hidden">Save</span>
                  </div>
                </Button>
              </div>

              <PersistenceStatusBadge status={persistenceStatus} />

              <div className="bg-white px-4 h-12 flex items-center gap-3 rounded-xl border border-slate-200 shadow-sm hidden md:flex">
                <div className="h-8 w-8 bg-primary/10 rounded-full flex items-center justify-center">
                  <UserCheck className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">Logged in as</div>
                  <div className="text-sm font-bold text-slate-800 leading-none">{user.displayName || user.email}</div>
                </div>
              </div>

              <Button
                onClick={onSignOut}
                variant="ghost"
                className="h-12 w-12 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <Users className="h-5 w-5" />
              </Button>
            </div>
          )}
        </div>
      </header>

      <AuthDialog open={authDialogOpen} onOpenChange={onAuthDialogOpenChange} />

      <Dialog open={isSaveWorkspaceDialogOpen} onOpenChange={onSaveWorkspaceDialogOpenChange}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-extrabold text-slate-800">Save Project</DialogTitle>
            <DialogDescription>Save your entire workspace (players, teams, and settings) to the cloud.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="ws-name" className="font-bold text-slate-700">Project Name</Label>
              <Input
                id="ws-name"
                value={workspaceName}
                onChange={(e) => setCurrentWorkspaceInfo(currentWorkspaceId, e.target.value, workspaceDescription)}
                placeholder="e.g., Summer Tournament 2024"
                className="rounded-xl border-2 border-slate-200 focus-visible:ring-primary"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ws-desc" className="font-bold text-slate-700">Description (Optional)</Label>
              <Input
                id="ws-desc"
                value={workspaceDescription}
                onChange={(e) => setCurrentWorkspaceInfo(currentWorkspaceId, workspaceName, e.target.value)}
                placeholder="Notes about this session..."
                className="rounded-xl border-2 border-slate-200 focus-visible:ring-primary"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => onSaveWorkspaceDialogOpenChange(false)} className="rounded-xl font-bold">Cancel</Button>
            <Button
              onClick={onSaveWorkspace}
              disabled={isSavingWorkspace}
              className="bg-primary hover:bg-primary/90 text-white rounded-xl font-bold"
            >
              {isSavingWorkspace ? 'Saving...' : 'Save Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isLoadWorkspaceDialogOpen} onOpenChange={onLoadWorkspaceDialogOpenChange}>
        <DialogContent className="sm:max-w-[600px] rounded-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-2xl font-extrabold text-slate-800">Load Project</DialogTitle>
            <DialogDescription>Select a previously saved workspace to restore.</DialogDescription>
            <div className="relative mt-2">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FolderOpen className="h-4 w-4 text-slate-400" />
              </div>
              <Input
                placeholder="Search projects..."
                className="pl-10 rounded-xl bg-slate-50 border-slate-200"
                value={workspaceSearchTerm}
                onChange={(e) => onWorkspaceSearchTermChange(e.target.value)}
              />
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-[300px] py-2 space-y-2">
            {isFetchingWorkspaces ? (
              <div className="flex items-center justify-center h-40">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
              </div>
            ) : savedWorkspaces.length === 0 ? (
              <div className="text-center py-10 text-slate-500">
                No saved projects found.
              </div>
            ) : (
              filteredWorkspaces.map(ws => (
                <button
                  key={ws.id}
                  onClick={() => void onLoadWorkspace(ws.id)}
                  disabled={loadingWorkspaceId === ws.id}
                  className="w-full flex items-center p-4 bg-white border border-slate-100 hover:border-primary/30 hover:bg-slate-50 rounded-xl transition-all group text-left relative"
                >
                  <div className="h-12 w-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-500 group-hover:bg-primary group-hover:text-white transition-colors">
                    <FolderOpen className="h-6 w-6" />
                  </div>
                  <div className="ml-4 flex-1">
                    <div className="font-bold text-slate-800 flex items-center gap-2">
                      {ws.name}
                    </div>
                    <div className="text-sm text-slate-500 line-clamp-1">{ws.description}</div>
                    <div className="text-xs text-slate-400 mt-1 flex gap-3">
                      <span>{new Date(ws.updatedAt).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>{ws.players?.length || 0} players</span>
                      <span>•</span>
                      <span>{ws.teams?.length || 0} teams</span>
                    </div>
                  </div>

                  <div className="absolute right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-300 hover:text-red-500 hover:bg-red-50"
                      onClick={(e) => void onDeleteWorkspaceAction(ws.id, e)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
