import React, { useState, useRef } from 'react';
import { Player, CSVValidationResult, PlayerGroup } from '@/types';
import { validateAndProcessCSV, generateSampleCSV } from '@/utils/csvProcessor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Upload, Download, AlertCircle, CheckCircle2, FileText, Users } from 'lucide-react';
import { toast } from 'sonner';

interface CSVUploaderProps {
  onPlayersLoaded: (players: Player[], playerGroups?: PlayerGroup[]) => void;
}

export function CSVUploader({ onPlayersLoaded }: CSVUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [validationResult, setValidationResult] = useState<CSVValidationResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }

    setIsProcessing(true);
    
    try {
      const text = await file.text();
      const result = validateAndProcessCSV(text);
      setValidationResult(result);

      if (result.isValid) {
        toast.success('CSV file processed successfully');
      } else {
        toast.error('CSV file contains errors');
      }
    } catch (error) {
      toast.error('Failed to read CSV file');
      console.error('File reading error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmLoad = () => {
    if (validationResult?.isValid && validationResult.players) {
      onPlayersLoaded(validationResult.players, validationResult.playerGroups);
      setValidationResult(null);
    }
  };

  const downloadSampleCSV = () => {
    const csvContent = generateSampleCSV();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'sample_players.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Sample CSV downloaded');
  };

  return (
    <div className="space-y-6">
      {/* Upload Instructions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              CSV Format Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-600">Your CSV file must include these columns:</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline">Required</Badge>
                <span className="text-sm font-medium">Name</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Optional</Badge>
                <span className="text-sm font-medium">Gender (M/F/Other, defaults to Other)</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Optional</Badge>
                <span className="text-sm font-medium">Skill Rating (0-10, defaults to 5)</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Optional</Badge>
                <span className="text-sm font-medium">Teammate Requests</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Optional</Badge>
                <span className="text-sm font-medium">Avoid Requests</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Need Help?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-600">
              Download a sample CSV file to see the expected format
            </p>
            <Button onClick={downloadSampleCSV} variant="outline" className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Download Sample CSV
            </Button>
            <p className="text-xs text-gray-500">
              Sample includes 12 players with various preferences
            </p>
          </CardContent>
        </Card>
      </div>

      {/* File Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Player Roster</CardTitle>
          <CardDescription>
            Drop your CSV file here or click to browse
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`
              relative border-2 border-dashed rounded-lg p-8 text-center transition-colors
              ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
              ${isProcessing ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
            `}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileInput}
              className="hidden"
            />
            
            <div className="space-y-4">
              <Upload className="h-12 w-12 text-gray-400 mx-auto" />
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  {isProcessing ? 'Processing...' : 'Upload CSV File'}
                </h3>
                <p className="text-gray-600 mt-1">
                  {isProcessing ? 'Please wait while we process your file' : 'Drag and drop or click to browse'}
                </p>
              </div>
              <p className="text-sm text-gray-500">
                Supports CSV files up to 10MB
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Validation Results */}
      {validationResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {validationResult.isValid ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600" />
              )}
              Validation Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-4">
                <Users className="h-5 w-5 text-blue-600" />
                <span className="font-medium">
                  {validationResult.players.length} players found
                </span>
                <Badge variant={validationResult.isValid ? 'default' : 'destructive'}>
                  {validationResult.isValid ? 'Valid' : 'Has Errors'}
                </Badge>
              </div>
              {validationResult.isValid && (
                <Button onClick={handleConfirmLoad}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Load {validationResult.players.length} Players
                </Button>
              )}
            </div>

            {/* Errors */}
            {validationResult.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-medium mb-2">Errors found:</div>
                  <ul className="list-disc list-inside space-y-1">
                    {validationResult.errors.map((error, index) => (
                      <li key={index} className="text-sm">{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Warnings */}
            {validationResult.warnings.length > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-medium mb-2">Warnings:</div>
                  <ul className="list-disc list-inside space-y-1">
                    {validationResult.warnings.map((warning, index) => (
                      <li key={index} className="text-sm">{warning}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Player Preview */}
            {validationResult.players.length > 0 && (
              <div>
                <h4 className="font-medium mb-3">Player Preview</h4>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Gender</TableHead>
                        <TableHead>Skill</TableHead>
                        <TableHead>Teammate Requests</TableHead>
                        <TableHead>Avoid Requests</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validationResult.players.slice(0, 5).map((player) => (
                        <TableRow key={player.id}>
                          <TableCell className="font-medium">{player.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{player.gender}</Badge>
                          </TableCell>
                          <TableCell>{player.skillRating}</TableCell>
                          <TableCell className="text-sm">
                            {player.teammateRequests.length > 0 
                              ? player.teammateRequests.join(', ')
                              : '-'
                            }
                          </TableCell>
                          <TableCell className="text-sm">
                            {player.avoidRequests.length > 0 
                              ? player.avoidRequests.join(', ')
                              : '-'
                            }
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {validationResult.players.length > 5 && (
                    <div className="p-3 bg-gray-50 text-center text-sm text-gray-600">
                      And {validationResult.players.length - 5} more players...
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setValidationResult(null)}
                className="flex-1"
              >
                Clear Results
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
