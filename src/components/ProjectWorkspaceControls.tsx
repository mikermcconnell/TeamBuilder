import React, { ChangeEvent, RefObject, SetStateAction, Dispatch, useMemo } from 'react';
import { User } from 'firebase/auth';
import { Copy, Download, FolderOpen, Save, SquarePen, Trash2, Upload, UserCheck, Users } from 'lucide-react';

import { SavedWorkspace } from '@/types';
import { PersistenceStatusBadge } from '@/components/PersistenceStatusBadge';
import { PersistenceStatusModel } from '@/hooks/useAppPersistence';
import type { WorkspaceSaveResult } from '@/services/persistence/saveTypes';
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
  workspaceConflict: WorkspaceSaveResult | null;
  onReloadWorkspaceAfterConflict: () => Promise<void>;
  onMergeWorkspaceAfterConflict: () => Promise<void>;
  onSaveWorkspaceAsCopy: () => Promise<void>;
  onDismissWorkspaceConflict: () => void;
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
  workspaceConflict,
  onReloadWorkspaceAfterConflict,
  onMergeWorkspaceAfterConflict,
  onSaveWorkspaceAsCopy,
  onDismissWorkspaceConflict,
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
  const effectiveWorkspaceName = workspaceName.trim() || 'Untitled Draft';
  const trimmedWorkspaceDescription = workspaceDescription.trim();

  return (
    <>
      <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4 shrink-0 group">
          <img
            src="/logo-new.jpg"
            alt="TeamBuilder"
            className="h-16 w-16 object-cover rounded-full shadow-sm transition-transform duration-300 hover:scale-110"
          />
          <div className="min-w-0">
            <h1 className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-900 to-indigo-600 drop-shadow-sm">
              TeamBuilder
            </h1>
            <p className="text-sm font-medium text-slate-500">
              Create balanced teams in seconds
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${currentWorkspaceId ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-600'}`}>
                {currentWorkspaceId ? 'Current project' : 'Current draft'}
              </span>
              <span className="max-w-[320px] truncate font-bold text-slate-800">
                {effectiveWorkspaceName}
              </span>
              {trimmedWorkspaceDescription && (
                <span className="max-w-[320px] truncate text-slate-500">
                  — {trimmedWorkspaceDescription}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end lg:flex-1">
          <input
            ref={importFileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={onImportProjectBackup}
          />

          <div className="flex w-full flex-wrap items-center justify-end gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-2 shadow-sm lg:w-auto lg:flex-nowrap">
            <div className="flex min-w-0 items-center gap-2">
              <PersistenceStatusBadge status={persistenceStatus} />

              {workspaceConflict?.type === 'conflict' && (
                <Button
                  onClick={onOpenSaveWorkspaceDialog}
                  variant="outline"
                  className="h-10 rounded-xl border-amber-200 bg-amber-50 px-3 text-sm font-bold text-amber-900 hover:bg-amber-100"
                >
                  Resolve Conflict
                </Button>
              )}

              {!user ? (
                <Button
                  onClick={() => onAuthDialogOpenChange(true)}
                  className="h-10 rounded-xl border-b-4 border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition-all active:border-b-0 active:translate-y-1 hover:bg-slate-50"
                >
                  Sign In
                </Button>
              ) : (
                <>
                  <div className="hidden lg:flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                      <UserCheck className="h-4 w-4 text-primary" />
                    </div>
                    <div className="leading-tight">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Logged in as
                      </div>
                      <div className="max-w-[190px] truncate text-sm font-bold text-slate-800">
                        {user.displayName || user.email}
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={onSignOut}
                    variant="ghost"
                    className="h-10 w-10 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    aria-label="Sign out"
                  >
                    <Users className="h-5 w-5" />
                  </Button>
                </>
              )}
            </div>

            <div className="hidden h-6 w-px bg-slate-200 lg:block" aria-hidden="true" />

            <div className="flex flex-wrap items-center justify-end gap-2 lg:flex-nowrap">
              <Button
                onClick={onOpenSaveWorkspaceDialog}
                variant="ghost"
                className="h-10 rounded-xl px-3 text-sm font-bold text-slate-600 hover:bg-white hover:text-slate-800"
              >
                <SquarePen className="h-4 w-4" />
                <span>Rename</span>
              </Button>
              <Button
                onClick={() => void onSaveWorkspaceAsCopy()}
                variant="ghost"
                className="h-10 rounded-xl px-3 text-sm font-bold text-slate-600 hover:bg-white hover:text-slate-800"
                disabled={!user}
              >
                <Copy className="h-4 w-4" />
                <span>Duplicate</span>
              </Button>
              <Button
                onClick={onExportProjectBackup}
                variant="ghost"
                className="h-10 rounded-xl px-3 text-sm font-bold text-slate-600 hover:bg-white hover:text-slate-800"
              >
                <Download className="h-4 w-4" />
                <span>Backup</span>
              </Button>
              <Button
                onClick={onOpenProjectImport}
                variant="ghost"
                className="h-10 rounded-xl px-3 text-sm font-bold text-slate-600 hover:bg-white hover:text-slate-800"
              >
                <Upload className="h-4 w-4" />
                <span>Restore</span>
              </Button>
              <Button
                onClick={onOpenLoadWorkspaceDialog}
                variant="outline"
                className="h-10 rounded-xl border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                <FolderOpen className="h-4 w-4" />
                <span>Load Project</span>
              </Button>
              <Button
                onClick={onOpenSaveWorkspaceDialog}
                className="h-10 rounded-xl border-b-4 border-primary-shadow bg-primary px-3 text-sm font-bold text-white transition-all active:border-b-0 active:translate-y-1 hover:bg-primary/90"
              >
                <Save className="h-4 w-4" />
                <span>Save Project</span>
              </Button>
            </div>
          </div>
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
            {workspaceConflict?.type === 'conflict' && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                <div className="font-bold">This project changed somewhere else.</div>
                <div className="mt-1 text-xs text-amber-900/80">
                  Current saved revision: {workspaceConflict.conflict?.actualRevision ?? 'unknown'}.
                  Your editor tried to save revision {workspaceConflict.conflict?.expectedRevision ?? 'unknown'}.
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
                    onClick={() => void onReloadWorkspaceAfterConflict()}
                  >
                    Reload Latest
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
                    onClick={() => void onMergeWorkspaceAfterConflict()}
                  >
                    Merge + Save
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
                    onClick={() => void onSaveWorkspaceAsCopy()}
                  >
                    Save as Copy
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-amber-900 hover:bg-amber-100"
                    onClick={onDismissWorkspaceConflict}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            )}
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
