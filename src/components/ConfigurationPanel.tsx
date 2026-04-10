import React, { useState, useMemo } from 'react';
import { LeagueConfig, Player } from '@/types';
import { loadSavedConfigs, saveConfig, deleteConfig, validateConfig, loadLeaguePresets, updateConfig as updateSavedConfig, duplicateConfig, getConfiguredTeamCount } from '@/utils/configManager';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Settings,
  Save,
  Trash2,
  Pencil,
  Copy,
  AlertCircle,
  Users,
  Target,
  Calculator,
  UserCheck,
  Check,
  Info
} from 'lucide-react';
import { toast } from 'sonner';

interface ConfigurationPanelProps {
  config: LeagueConfig;
  onConfigChange: (config: LeagueConfig) => void;
  playerCount: number;
  players?: Player[];
}

export function ConfigurationPanel({ config, onConfigChange, playerCount, players = [] }: ConfigurationPanelProps) {
  const [savedConfigs, setSavedConfigs] = useState(() => loadSavedConfigs());
  const builtInPresets = useMemo(() => loadLeaguePresets(), []);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newConfigName, setNewConfigName] = useState('');
  const [saveMode, setSaveMode] = useState<'create' | 'rename' | 'duplicate'>('create');
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const activeSavedPreset = useMemo(
    () => savedConfigs.find(savedConfig => savedConfig.id === config.id) || null,
    [config.id, savedConfigs]
  );
  const validationErrors = useMemo(
    () => validateConfig(config, playerCount),
    [config, playerCount]
  );

  // Calculate gender breakdown
  const genderStats = useMemo(() => {
    const stats = { M: 0, F: 0, Other: 0 };
    players.forEach(player => {
      stats[player.gender]++;
    });
    return stats;
  }, [players]);

  const updateConfig = (updates: Partial<LeagueConfig>) => {
    const updatedConfig = { ...config, ...updates };
    onConfigChange(updatedConfig);
  };

  const loadPreset = (configId: string) => {
    const customPreset = savedConfigs.find(c => c.id === configId);
    const builtInPreset = builtInPresets.find(c => c.id === configId);
    const selectedPreset = customPreset || builtInPreset;

    if (selectedPreset) {
      onConfigChange(selectedPreset);
      toast.success(`Loaded preset: ${selectedPreset.name}`);
    }
  };

  const closeSaveDialog = () => {
    setShowSaveDialog(false);
    setNewConfigName('');
    setSaveMode('create');
    setSelectedPresetId(null);
  };

  const openSaveDialog = (mode: 'create' | 'rename' | 'duplicate', preset?: LeagueConfig) => {
    setSaveMode(mode);
    setSelectedPresetId(preset?.id || null);
    setNewConfigName(
      mode === 'duplicate'
        ? `${preset?.name || config.name} Copy`
        : preset?.name || config.name || ''
    );
    setShowSaveDialog(true);
  };

  const hasDuplicateName = (name: string, excludeId?: string | null) => {
    const normalizedName = name.trim().toLowerCase();
    return savedConfigs.some(savedConfig => (
      savedConfig.id !== excludeId &&
      savedConfig.name.trim().toLowerCase() === normalizedName
    ));
  };

  const saveCurrentConfig = () => {
    if (!newConfigName.trim()) {
      toast.error('Please enter a configuration name');
      return;
    }

    if (hasDuplicateName(newConfigName, saveMode === 'rename' ? selectedPresetId : null)) {
      toast.error('A saved preset with that name already exists');
      return;
    }

    const errors = validateConfig(config, playerCount);
    if (errors.length > 0) {
      toast.error('Please fix configuration errors before saving');
      return;
    }

    if (saveMode === 'rename' && selectedPresetId) {
      const renamedPreset = updateSavedConfig(selectedPresetId, { name: newConfigName.trim() });

      if (!renamedPreset) {
        toast.error('Could not rename that preset');
        return;
      }

      setSavedConfigs(loadSavedConfigs());
      if (config.id === renamedPreset.id) {
        onConfigChange(renamedPreset);
      }
      toast.success(`Renamed preset to ${renamedPreset.name}`);
      closeSaveDialog();
      return;
    }

    if (saveMode === 'duplicate' && selectedPresetId) {
      const sourcePreset = savedConfigs.find(savedConfig => savedConfig.id === selectedPresetId);
      if (!sourcePreset) {
        toast.error('Could not duplicate that preset');
        return;
      }

      const duplicatedPreset = duplicateConfig(sourcePreset, newConfigName.trim());
      setSavedConfigs(loadSavedConfigs());
      toast.success(`Created preset copy: ${duplicatedPreset.name}`);
      closeSaveDialog();
      return;
    }

    const customConfig: LeagueConfig = {
      ...config,
      id: `custom-${Date.now()}`,
      name: newConfigName.trim()
    };

    saveConfig(customConfig);
    setSavedConfigs(loadSavedConfigs());
    toast.success(`Configuration saved: ${customConfig.name}`);
    closeSaveDialog();
  };

  const updateSavedPresetFromCurrent = (configId: string) => {
    const presetToUpdate = savedConfigs.find(savedConfig => savedConfig.id === configId);
    if (!presetToUpdate) {
      toast.error('Could not find that saved preset');
      return;
    }

    const updatedPreset: LeagueConfig = {
      ...config,
      id: presetToUpdate.id,
      name: presetToUpdate.name,
    };

    saveConfig(updatedPreset);
    setSavedConfigs(loadSavedConfigs());

    if (config.id === presetToUpdate.id) {
      onConfigChange(updatedPreset);
    }

    toast.success(`Updated preset: ${presetToUpdate.name}`);
  };

  const deletePreset = (configId: string) => {
    const configToDelete = savedConfigs.find(c => c.id === configId);
    if (configToDelete) {
      if (window.confirm(`Are you sure you want to delete "${configToDelete.name}"? This cannot be undone.`)) {
        deleteConfig(configId);
        setSavedConfigs(loadSavedConfigs());
        toast.success(`Deleted configuration: ${configToDelete.name}`);
      }
    }
  };

  const calculateEstimatedTeams = () => {
    if (playerCount === 0) return 0;
    return getConfiguredTeamCount(playerCount, config);
  };

  const calculatePlayersPerTeam = () => {
    if (playerCount === 0) return { min: 0, max: 0, avg: 0 };

    const estimatedTeams = calculateEstimatedTeams();
    const avg = playerCount / estimatedTeams;
    const min = Math.floor(avg);
    const max = Math.ceil(avg);

    return { min, max, avg: Math.round(avg * 10) / 10 };
  };

  const calculateGenderRequirements = () => {
    const numTeams = calculateEstimatedTeams();
    if (numTeams === 0) return { femalesNeeded: 0, malesNeeded: 0, femalesDiff: 0, malesDiff: 0 };

    const femalesNeeded = config.minFemales * numTeams;
    const malesNeeded = config.minMales * numTeams;

    const femalesDiff = genderStats.F - femalesNeeded;
    const malesDiff = genderStats.M - malesNeeded;

    return { femalesNeeded, malesNeeded, femalesDiff, malesDiff };
  };

  const stats = calculatePlayersPerTeam();
  const genderReqs = calculateGenderRequirements();

  return (
    <div className="space-y-6">
      {/* League Presets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            League Presets
          </CardTitle>
          <CardDescription>
            Start quickly with common league formats
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {builtInPresets.map((preset) => (
              <Card key={preset.id} className="border-2 border-slate-100 shadow-sm">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-semibold text-slate-800">{preset.name}</h4>
                    <Badge variant="secondary">Preset</Badge>
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>Max team size: {preset.maxTeamSize}</div>
                    <div>Min females: {preset.minFemales}</div>
                    <div>Min males: {preset.minMales}</div>
                  </div>
                  <Button size="sm" className="w-full" variant="outline" onClick={() => loadPreset(preset.id)}>
                    Load Preset
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Saved Configurations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Saved Configurations
            </div>
            <div className="flex items-center gap-2">
              {activeSavedPreset && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                  onClick={() => updateSavedPresetFromCurrent(activeSavedPreset.id)}
                >
                  <Check className="h-4 w-4" />
                  Update Current
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
                onClick={() => openSaveDialog('create')}
              >
                <Save className="h-4 w-4" />
                Save Current
              </Button>
            </div>
          </CardTitle>
          <CardDescription>
            Load or manage your saved configurations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {savedConfigs.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {savedConfigs.map((preset) => (
                <Card key={preset.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{preset.name}</h4>
                          {config.id === preset.id && <Badge variant="secondary">Current</Badge>}
                        </div>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div>Max team size: {preset.maxTeamSize}</div>
                        <div>Min females: {preset.minFemales}</div>
                        <div>Min males: {preset.minMales}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => loadPreset(preset.id)}
                        >
                          Load
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateSavedPresetFromCurrent(preset.id)}
                        >
                          Update
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openSaveDialog('rename', preset)}
                        >
                          <Pencil className="h-3 w-3 mr-1" />
                          Rename
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => openSaveDialog('duplicate', preset)}
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copy
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => deletePreset(preset.id)}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No saved configurations yet</p>
              <p className="text-sm">Save your current settings to create a preset</p>
            </div>
          )}

          {/* Save Configuration Dialog */}
          {showSaveDialog && (
            <div className="border rounded-lg p-4 mt-4 bg-gray-50">
              <h4 className="font-medium mb-2">
                {saveMode === 'rename'
                  ? 'Rename Saved Preset'
                  : saveMode === 'duplicate'
                    ? 'Duplicate Saved Preset'
                    : 'Save Current Configuration'}
              </h4>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="configName">Configuration Name</Label>
                  <Input
                    id="configName"
                    value={newConfigName}
                    onChange={(e) => setNewConfigName(e.target.value)}
                    placeholder="Enter a name for this configuration"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={saveCurrentConfig} className="flex-1">
                    {saveMode === 'rename'
                      ? 'Save New Name'
                      : saveMode === 'duplicate'
                        ? 'Create Copy'
                        : 'Save Configuration'}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      closeSaveDialog();
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Team Size Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Size Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="maxTeamSize">Maximum Team Size</Label>
              <Input
                id="maxTeamSize"
                type="number"
                min="1"
                max="50"
                value={config.maxTeamSize}
                onChange={(e) => updateConfig({ maxTeamSize: parseInt(e.target.value) || 1 })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="targetTeams">Target Number of Teams (Optional)</Label>
              <Input
                id="targetTeams"
                type="number"
                min="1"
                placeholder="Auto-calculate"
                value={config.targetTeams || ''}
                onChange={(e) => updateConfig({ 
                  targetTeams: e.target.value ? parseInt(e.target.value) || undefined : undefined 
                })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gender Requirements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Gender Requirements
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="minFemales">Minimum Females per Team</Label>
              <Input
                id="minFemales"
                type="number"
                min="0"
                max={config.maxTeamSize}
                value={config.minFemales}
                onChange={(e) => updateConfig({ minFemales: parseInt(e.target.value) || 0 })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="minMales">Minimum Males per Team</Label>
              <Input
                id="minMales"
                type="number"
                min="0"
                max={config.maxTeamSize}
                value={config.minMales}
                onChange={(e) => updateConfig({ minMales: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="allowMixedGender"
              checked={config.allowMixedGender}
              onCheckedChange={(checked) => updateConfig({ allowMixedGender: checked })}
            />
            <Label htmlFor="allowMixedGender">Allow mixed gender teams</Label>
          </div>

          {/* Gender Ratio Notifications */}
          {playerCount > 0 && (
            <div className="space-y-3">
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Info className="h-4 w-4 text-blue-600" />
                  Gender Distribution Analysis
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Female Analysis */}
                  <div className={`p-3 rounded-lg border ${
                    genderReqs.femalesDiff < 0
                      ? 'bg-red-50 border-red-200'
                      : genderReqs.femalesDiff > config.minFemales * 2
                      ? 'bg-yellow-50 border-yellow-200'
                      : 'bg-green-50 border-green-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-4 w-4 text-pink-600" />
                        <span className="font-medium text-sm">Females</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {genderStats.F} available
                      </Badge>
                    </div>
                    <div className="mt-2 text-sm">
                      <div>Required: {genderReqs.femalesNeeded} ({config.minFemales} × {calculateEstimatedTeams()} teams)</div>
                      <div className={`font-medium mt-1 ${
                        genderReqs.femalesDiff < 0 ? 'text-red-600' : genderReqs.femalesDiff > 0 ? 'text-green-600' : 'text-gray-600'
                      }`}>
                        {genderReqs.femalesDiff === 0 ? (
                          'Exactly meets requirements'
                        ) : genderReqs.femalesDiff > 0 ? (
                          `${genderReqs.femalesDiff} extra female${genderReqs.femalesDiff !== 1 ? 's' : ''}`
                        ) : (
                          `${Math.abs(genderReqs.femalesDiff)} female${Math.abs(genderReqs.femalesDiff) !== 1 ? 's' : ''} short`
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Male Analysis */}
                  <div className={`p-3 rounded-lg border ${
                    genderReqs.malesDiff < 0
                      ? 'bg-red-50 border-red-200'
                      : genderReqs.malesDiff > config.minMales * 2
                      ? 'bg-yellow-50 border-yellow-200'
                      : 'bg-green-50 border-green-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-4 w-4 text-blue-600" />
                        <span className="font-medium text-sm">Males</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {genderStats.M} available
                      </Badge>
                    </div>
                    <div className="mt-2 text-sm">
                      <div>Required: {genderReqs.malesNeeded} ({config.minMales} × {calculateEstimatedTeams()} teams)</div>
                      <div className={`font-medium mt-1 ${
                        genderReqs.malesDiff < 0 ? 'text-red-600' : genderReqs.malesDiff > 0 ? 'text-green-600' : 'text-gray-600'
                      }`}>
                        {genderReqs.malesDiff === 0 ? (
                          'Exactly meets requirements'
                        ) : genderReqs.malesDiff > 0 ? (
                          `${genderReqs.malesDiff} extra male${genderReqs.malesDiff !== 1 ? 's' : ''}`
                        ) : (
                          `${Math.abs(genderReqs.malesDiff)} male${Math.abs(genderReqs.malesDiff) !== 1 ? 's' : ''} short`
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Warning if requirements can't be met */}
                {(genderReqs.femalesDiff < 0 || genderReqs.malesDiff < 0) && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Gender requirements cannot be met with the current player roster.
                      {genderReqs.femalesDiff < 0 && genderReqs.malesDiff < 0 ? (
                        ` Need ${Math.abs(genderReqs.femalesDiff)} more female${Math.abs(genderReqs.femalesDiff) !== 1 ? 's' : ''} and ${Math.abs(genderReqs.malesDiff)} more male${Math.abs(genderReqs.malesDiff) !== 1 ? 's' : ''}.`
                      ) : genderReqs.femalesDiff < 0 ? (
                        ` Need ${Math.abs(genderReqs.femalesDiff)} more female${Math.abs(genderReqs.femalesDiff) !== 1 ? 's' : ''}.`
                      ) : (
                        ` Need ${Math.abs(genderReqs.malesDiff)} more male${Math.abs(genderReqs.malesDiff) !== 1 ? 's' : ''}.`
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Team Calculations */}
      {playerCount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Team Calculations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="space-y-1">
                <div className="text-2xl font-bold text-blue-600">{playerCount}</div>
                <div className="text-sm text-gray-600">Total Players</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-green-600">{calculateEstimatedTeams()}</div>
                <div className="text-sm text-gray-600">Estimated Teams</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-orange-600">{stats.avg}</div>
                <div className="text-sm text-gray-600">Avg Players/Team</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-purple-600">{stats.min}-{stats.max}</div>
                <div className="text-sm text-gray-600">Player Range</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="font-medium mb-2">Configuration Issues:</div>
            <ul className="list-disc list-inside space-y-1">
              {validationErrors.map((error, index) => (
                <li key={index} className="text-sm">{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
