import React, { useState } from 'react';
import { LeagueConfig } from '@/types';
import { loadSavedConfigs, saveConfig, deleteConfig, validateConfig } from '@/utils/configManager';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Settings, 
  Save, 
  Trash2, 
  Plus, 
  AlertCircle, 
  Users, 
  Target,
  Calculator
} from 'lucide-react';
import { toast } from 'sonner';

interface ConfigurationPanelProps {
  config: LeagueConfig;
  onConfigChange: (config: LeagueConfig) => void;
  playerCount: number;
}

export function ConfigurationPanel({ config, onConfigChange, playerCount }: ConfigurationPanelProps) {
  const [savedConfigs, setSavedConfigs] = useState(() => loadSavedConfigs());
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newConfigName, setNewConfigName] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const updateConfig = (updates: Partial<LeagueConfig>) => {
    const updatedConfig = { ...config, ...updates };
    const errors = validateConfig(updatedConfig);
    setValidationErrors(errors);
    onConfigChange(updatedConfig);
  };

  const loadPreset = (configId: string) => {
    const preset = savedConfigs.find(c => c.id === configId);
    if (preset) {
      onConfigChange(preset);
      toast.success(`Loaded preset: ${preset.name}`);
    }
  };

  const saveCurrentConfig = () => {
    if (!newConfigName.trim()) {
      toast.error('Please enter a configuration name');
      return;
    }

    const errors = validateConfig(config);
    if (errors.length > 0) {
      toast.error('Please fix configuration errors before saving');
      return;
    }

    const newConfig: LeagueConfig = {
      ...config,
      id: `custom-${Date.now()}`,
      name: newConfigName.trim()
    };

    saveConfig(newConfig);
    setSavedConfigs(loadSavedConfigs());
    toast.success(`Configuration saved: ${newConfig.name}`);
    setShowSaveDialog(false);
    setNewConfigName('');
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
    return Math.ceil(playerCount / config.maxTeamSize);
  };

  const calculatePlayersPerTeam = () => {
    if (playerCount === 0) return { min: 0, max: 0, avg: 0 };
    
    const estimatedTeams = calculateEstimatedTeams();
    const avg = playerCount / estimatedTeams;
    const min = Math.floor(avg);
    const max = Math.ceil(avg);
    
    return { min, max, avg: Math.round(avg * 10) / 10 };
  };

  const stats = calculatePlayersPerTeam();

  return (
    <div className="space-y-6">
      {/* Saved Configurations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Saved Configurations
            </div>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
              onClick={() => setShowSaveDialog(true)}
            >
              <Save className="h-4 w-4" />
              Save Current
            </Button>
          </CardTitle>
          <CardDescription>
            Load or manage your saved configurations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {savedConfigs.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {savedConfigs.map((preset) => (
                <Card key={preset.id} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">{preset.name}</h4>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div>Max team size: {preset.maxTeamSize}</div>
                        <div>Min females: {preset.minFemales}</div>
                        <div>Min males: {preset.minMales}</div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="flex-1"
                          onClick={() => loadPreset(preset.id)}
                        >
                          Load
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => deletePreset(preset.id)}
                        >
                          <Trash2 className="h-3 w-3" />
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
              <h4 className="font-medium mb-2">Save Current Configuration</h4>
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
                    Save Configuration
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowSaveDialog(false);
                      setNewConfigName('');
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
