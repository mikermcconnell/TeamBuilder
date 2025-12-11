import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Users,
  FileSpreadsheet,
  Settings,
  Zap,
  BarChart3,
  Download,
  Play,
  Pause,
  ChevronRight,
  CheckCircle,
  ArrowRight,
  Target,
  Brain,
  Shield,
  RotateCcw,
  Mail
} from 'lucide-react';


interface TutorialLandingProps {
  onStartApp: () => void;
}

// Mock data for demonstrations
const mockPlayers = [
  { id: '1', name: 'Alex Johnson', gender: 'M', skillRating: 8.5 },
  { id: '2', name: 'Sarah Chen', gender: 'F', skillRating: 9.2 },
  { id: '3', name: 'Mike Rodriguez', gender: 'M', skillRating: 7.8 },
  { id: '4', name: 'Emma Wilson', gender: 'F', skillRating: 8.9 },
  { id: '5', name: 'David Kim', gender: 'M', skillRating: 7.5 },
  { id: '6', name: 'Lisa Park', gender: 'F', skillRating: 8.7 }
];

const mockTeams = [
  {
    id: '1',
    name: 'Team Alpha',
    players: mockPlayers.slice(0, 3),
    averageSkill: 8.5,
    genderBreakdown: { M: 2, F: 1, Other: 0 }
  },
  {
    id: '2',
    name: 'Team Beta',
    players: mockPlayers.slice(3, 6),
    averageSkill: 8.4,
    genderBreakdown: { M: 1, F: 2, Other: 0 }
  }
];

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  duration: number;
}

const TutorialLanding: React.FC<TutorialLandingProps> = ({ onStartApp }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [tutorialStarted, setTutorialStarted] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const tutorialSteps: TutorialStep[] = [
    {
      id: 'upload',
      title: 'Upload Your Team Roster',
      description: 'Start by uploading your player data via CSV or enter players manually',
      icon: <FileSpreadsheet className="w-6 h-6" />,
      duration: 8000
    },
    {
      id: 'configure',
      title: 'Configure Team Rules',
      description: 'Set team size limits, gender requirements, and other constraints',
      icon: <Settings className="w-6 h-6" />,
      duration: 12000
    },
    {
      id: 'generate',
      title: 'Generate Balanced Teams',
      description: 'Our AI algorithm creates perfectly balanced teams based on your criteria',
      icon: <Brain className="w-6 h-6" />,
      duration: 14000
    },
    {
      id: 'analyze',
      title: 'Analyze Team Performance',
      description: 'View detailed statistics and balance metrics for your generated teams',
      icon: <BarChart3 className="w-6 h-6" />,
      duration: 5000
    },
    {
      id: 'export',
      title: 'Export and Share',
      description: 'Export your teams to various formats and share with participants',
      icon: <Download className="w-6 h-6" />,
      duration: 8000
    }
  ];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setProgress(prev => {
          const newProgress = prev + (100 / (tutorialSteps[currentStep].duration / 100));
          if (newProgress >= 100) {
            setCompletedSteps(prev => new Set([...prev, currentStep]));
            if (currentStep < tutorialSteps.length - 1) {
              setCurrentStep(currentStep + 1);
              return 0;
            } else {
              setIsPlaying(false);
              return 100;
            }
          }
          return newProgress;
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying, currentStep, tutorialSteps]);

  const startTutorial = () => {
    setIsPlaying(true);
    setTutorialStarted(true);
    setCurrentStep(0);
    setProgress(0);
    setCompletedSteps(new Set());
  };

  const skipToStep = (stepIndex: number) => {
    setCurrentStep(stepIndex);
    setProgress(0);
    // Don't stop the tutorial, just pause it
    setIsPlaying(false);
  };

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const resetTutorial = () => {
    setIsPlaying(false);
    setTutorialStarted(false);
    setCurrentStep(0);
    setProgress(0);
    setCompletedSteps(new Set());
  };

  const restartCurrentStep = () => {
    setProgress(0);
    setIsPlaying(true);
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return <CSVUploadDemo />;
      case 1:
        return <ConfigurationDemo />;
      case 2:
        return <TeamGenerationDemo />;
      case 3:
        return <AnalyticsDemo />;
      case 4:
        return <ExportDemo />;
      default:
        return <div>Step not found</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-green-50 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-green-200/30 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-200/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-orange-200/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '4s' }} />
      </div>

      <div className="relative z-10">
        {/* Hero Section */}
        <div className="container mx-auto px-4 py-12">
          <div className="text-center max-w-4xl mx-auto mb-16">


            <div className="flex items-center justify-center gap-4 mb-6">
              <img src="/logo-new.jpg" alt="Ulti-Team Logo" className="h-16 w-16 md:h-20 md:w-20 object-cover rounded-full" />
              <h1 className="text-5xl md:text-7xl font-black tracking-tight">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-900 to-indigo-600">Ulti-</span>
                <span className="text-orange-500">Team</span>
              </h1>
            </div>

            <p className="text-xl md:text-2xl text-gray-800 mb-8 leading-relaxed">
              Create perfectly balanced sports teams with our intelligent AI system.
              <br />
              <span className="text-orange-600 font-semibold">Learn in 2 minutes, build amazing teams for life! 🏆</span>
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button
                size="lg"
                className="bg-green-600 hover:bg-green-700 text-white px-8 py-6 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 group"
                onClick={startTutorial}
              >
                <Play className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                ⚡ Start Interactive Tutorial
              </Button>

              <Button
                variant="outline"
                size="lg"
                className="border-2 border-orange-600 bg-orange-600 hover:bg-orange-700 text-white px-8 py-6 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
                onClick={onStartApp}
              >
                Skip to App
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </div>

          {/* Feature highlights */}
          <div className="grid md:grid-cols-3 gap-6 mb-16">
            {[
              { icon: <Target className="w-8 h-8" />, title: "⚽ Perfect Balance", desc: "AI-powered sports team balancing" },
              { icon: <Shield className="w-8 h-8" />, title: "🎯 Smart Constraints", desc: "Respects all your team requirements" },
              { icon: <Zap className="w-8 h-8" />, title: "⚡ Lightning Fast", desc: "Generate balanced teams in seconds" }
            ].map((feature, index) => (
              <div key={index} className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-green-200 to-blue-200 backdrop-blur-sm rounded-2xl mb-4 text-green-700">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold mb-2 text-gray-800">{feature.title}</h3>
                <p className="text-gray-700">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tutorial Section */}
        {tutorialStarted && (
          <div className="container mx-auto px-4 pb-12">
            <Card className="max-w-6xl mx-auto bg-white/95 backdrop-blur-xl border border-green-200 shadow-2xl">
              <CardHeader className="text-center pb-4">
                <div className="flex justify-center mb-4">
                  <div className="inline-flex items-center gap-2 bg-green-100 rounded-full px-4 py-2 border border-green-200">
                    {tutorialSteps[currentStep].icon}
                    <span className="font-medium text-gray-800">Step {currentStep + 1} of {tutorialSteps.length}</span>
                  </div>
                </div>
                <CardTitle className="text-2xl mb-2 text-gray-800">🏆 {tutorialSteps[currentStep].title}</CardTitle>
                <CardDescription className="text-lg text-gray-700">{tutorialSteps[currentStep].description}</CardDescription>

                {/* Tutorial Controls */}
                <div className="flex justify-center gap-3 mt-4 mb-4">
                  <Button
                    onClick={togglePlayPause}
                    size="sm"
                    className={`${isPlaying ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-green-600 hover:bg-green-700'} text-white`}
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="w-4 h-4 mr-1" />
                        Pause
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-1" />
                        Play
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={restartCurrentStep}
                    size="sm"
                    variant="outline"
                    className="border-green-300 text-gray-700 hover:bg-green-50"
                  >
                    <RotateCcw className="w-4 h-4 mr-1" />
                    Restart Step
                  </Button>
                  <Button
                    onClick={onStartApp}
                    size="sm"
                    className="bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    Skip to App
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>

                <Progress value={progress} className="mt-2" />
              </CardHeader>

              <CardContent>
                <div key={currentStep}>
                  {renderStepContent()}
                </div>
              </CardContent>
            </Card>

            {/* Step navigation */}
            <div className="flex justify-center mt-8">
              <div className="bg-white/90 backdrop-blur-sm rounded-full p-4 border border-green-200 shadow-lg">
                <div className="flex gap-6 items-center">
                  {tutorialSteps.map((step, index) => (
                    <div key={index} className="flex flex-col items-center gap-2">
                      <button
                        onClick={() => {
                          setCurrentStep(index);
                          setProgress(0);
                          setIsPlaying(false);
                        }}
                        className={`w-8 h-8 rounded-full transition-all duration-300 hover:scale-110 flex items-center justify-center font-semibold text-sm border-2 ${completedSteps.has(index)
                          ? 'bg-green-500 hover:bg-green-400 border-green-400 text-white shadow-lg shadow-green-500/25'
                          : index === currentStep
                            ? 'bg-green-600 border-green-600 text-white scale-110 shadow-lg shadow-green-600/25'
                            : 'bg-gray-200 hover:bg-gray-300 border-gray-300 text-gray-600'
                          }`}
                        title={`Go to ${step.title}`}
                      >
                        {completedSteps.has(index) ? (
                          <CheckCircle className="w-4 h-4" />
                        ) : (
                          <span>{index + 1}</span>
                        )}
                      </button>
                      <span className={`text-xs font-medium transition-colors ${index === currentStep ? 'text-green-600' : 'text-gray-700'
                        }`}>
                        Step {index + 1}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Call to Action */}
        {!tutorialStarted && (
          <div className="container mx-auto px-4 pb-16">
            <Card className="max-w-2xl mx-auto bg-green-600 text-white border-0 shadow-2xl">
              <CardContent className="text-center p-8">
                <h2 className="text-3xl font-bold mb-4">🏆 Ready to Build Perfect Teams?</h2>
                <p className="text-xl mb-6 text-white/90">
                  Join thousands of coaches, event organizers, and team leaders who trust our sports team builder
                </p>
                <Button
                  size="lg"
                  variant="secondary"
                  className="bg-white text-green-700 hover:bg-white/90 px-8 py-6 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 interactive-button"
                  onClick={onStartApp}
                >
                  ⚡ Launch Team Builder
                  <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

// Demo Components
const CSVUploadDemo: React.FC = () => {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showCallout, setShowCallout] = useState(false);
  const [csvFile, setCsvFile] = useState<{ name: string; visible: boolean }>({ name: '', visible: false });

  useEffect(() => {
    // Show callout first
    const calloutTimer = setTimeout(() => setShowCallout(true), 500);

    // Show CSV file animation
    const csvTimer = setTimeout(() => {
      setCsvFile({ name: 'team_roster.csv', visible: true });
    }, 1500);

    // Start drag animation
    const dragTimer = setTimeout(() => {
      setIsDragging(true);
    }, 2500);

    // Complete upload process
    const uploadTimer = setTimeout(() => {
      setIsDragging(false);
      const interval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 100) {
            setShowPreview(true);
            clearInterval(interval);
            return 100;
          }
          return prev + 10;
        });
      }, 150);
      return () => clearInterval(interval);
    }, 4000);

    return () => {
      clearTimeout(calloutTimer);
      clearTimeout(csvTimer);
      clearTimeout(dragTimer);
      clearTimeout(uploadTimer);
    };
  }, []);

  return (
    <div className="space-y-6 relative">
      {/* Interactive Callout */}
      {showCallout && (
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-20">
          <div className="bg-accent text-black px-3 py-1 rounded-lg text-sm font-medium shadow-lg animate-bounce">
            ↓ Upload player names (gender & skills are optional)
          </div>
        </div>
      )}

      {/* Floating CSV File */}
      {csvFile.visible && (
        <div
          className={`absolute top-8 right-8 z-10 transition-all duration-2000 ${isDragging ? 'transform translate-x-[-400px] translate-y-[150px] rotate-12' : ''
            }`}
        >
          <div className="bg-green-100 border-2 border-green-300 rounded-lg p-3 shadow-lg">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-green-800">{csvFile.name}</span>
            </div>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-semibold mb-4 text-gray-800">Upload Methods</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
              <span className="text-gray-800">CSV File Upload</span>
              <Badge className="bg-accent text-black">Recommended</Badge>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <Users className="w-5 h-5 text-secondary" />
              <span className="text-gray-600">Manual Entry</span>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4 text-gray-800">Upload Zone</h3>
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-all duration-300 ${isDragging
              ? 'border-accent bg-accent/10 scale-105'
              : uploadProgress > 0
                ? 'border-green-500 bg-green-50'
                : 'border-gray-300 bg-gray-50'
              }`}
          >
            {uploadProgress === 0 ? (
              <div className="text-gray-600">
                <FileSpreadsheet className="w-12 h-12 mx-auto mb-2" />
                <p>Drop CSV or Excel file here</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-gray-800">
                  <span className="text-sm">team_roster.csv</span>
                  <span className="text-sm">{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="progress-glow w-full" />
                {uploadProgress === 100 && (
                  <div className="flex items-center justify-center gap-2 text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm">Upload complete!</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showPreview && (
        <div className="relative">
          <div className="absolute -top-2 right-4 z-10">
            <div className="bg-secondary text-white px-2 py-1 rounded text-xs animate-pulse">
              ← Player data automatically parsed
            </div>
          </div>
          <h3 className="text-lg font-semibold mb-4 text-gray-800">Player Preview</h3>
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="grid grid-cols-4 gap-4 text-sm font-medium text-gray-700 mb-2">
              <span>Name</span>
              <span>Gender</span>
              <span>Skill Rating</span>
              <span>Status</span>
            </div>
            {mockPlayers.map((player, index) => (
              <div
                key={player.id}
                className="grid grid-cols-4 gap-4 py-2 border-b border-gray-200 last:border-b-0 animate-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <span className="font-medium text-gray-800">{player.name}</span>
                <span className="text-gray-600">{player.gender}</span>
                <span className="text-accent font-medium">{player.skillRating}</span>
                <Badge className="bg-green-600 text-white text-xs">Active</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const ConfigurationDemo: React.FC = () => {
  const [currentScenario, setCurrentScenario] = useState(0);
  const [showScenario, setShowScenario] = useState(false);
  const [highlightConfig, setHighlightConfig] = useState('');
  const [showResults, setShowResults] = useState(false);

  const scenarios = [
    {
      title: "🏀 Basketball Tournament",
      problem: "32 players need 4-player teams with balanced skill levels",
      config: { maxTeamSize: 4, minFemales: 0, skillBalance: "high", totalPlayers: 32 },
      result: "Perfect for competitive play",
      color: "bg-orange-500/20 border-orange-500"
    },
    {
      title: "🏐 Mixed Volleyball League",
      problem: "48 players need co-ed teams with gender balance",
      config: { maxTeamSize: 6, minFemales: 2, skillBalance: "medium", totalPlayers: 48 },
      result: "Ensures inclusive participation",
      color: "bg-blue-500/20 border-blue-500"
    },
    {
      title: "⚽ Youth Soccer Camp",
      problem: "64 kids need large groups, focus on fun over competition",
      config: { maxTeamSize: 8, minFemales: 0, skillBalance: "low", totalPlayers: 64 },
      result: "Maximum participation and enjoyment",
      color: "bg-green-500/20 border-green-500"
    }
  ];

  useEffect(() => {
    // Show initial scenario
    const scenarioTimer = setTimeout(() => setShowScenario(true), 1000);

    // Progress through scenarios
    const progressTimer = setTimeout(() => {
      const interval = setInterval(() => {
        setCurrentScenario(prev => {
          if (prev >= scenarios.length - 1) {
            clearInterval(interval);
            setTimeout(() => setShowResults(true), 1000);
            return prev;
          }
          return prev + 1;
        });
      }, 3000);

      return () => clearInterval(interval);
    }, 2000);

    return () => {
      clearTimeout(scenarioTimer);
      clearTimeout(progressTimer);
    };
  }, []);

  const currentScenarioData = scenarios[currentScenario];

  return (
    <div className="space-y-6 relative">
      {/* Scenario Introduction */}
      {showScenario && (
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-primary/20 rounded-full px-4 py-2 border border-primary/30 mb-4">
            <Settings className="w-4 h-4 text-primary" />
            <span className="text-gray-800 font-medium">Configuration Scenarios</span>
          </div>
          <p className="text-gray-600">Different events need different team setups. Let's explore how configuration affects outcomes:</p>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Scenario Card */}
        <div className={`p-6 rounded-xl border-2 transition-all duration-500 ${currentScenarioData.color}`}>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="text-2xl text-gray-800">{currentScenario + 1}</div>
              <h3 className="text-xl font-bold text-gray-800">{currentScenarioData.title}</h3>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h4 className="font-semibold text-accent mb-2">Challenge:</h4>
              <p className="text-gray-700">{currentScenarioData.problem}</p>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-gray-800">Optimal Settings:</h4>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                <span className="text-gray-700">Team Size</span>
                <span className="font-bold text-accent text-lg">{currentScenarioData.config.maxTeamSize} players</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                <span className="text-gray-700">Gender Balance</span>
                <span className="font-bold text-secondary text-lg">
                  {currentScenarioData.config.minFemales > 0 ? `${currentScenarioData.config.minFemales}F minimum` : 'No requirement'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Results Preview */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800">Configuration Impact</h3>

          <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl p-6 border border-gray-200">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-gray-800 font-medium">{currentScenarioData.result}</span>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-6">
                <div className="text-center p-3 bg-white rounded-lg border border-gray-200">
                  <div className="text-2xl font-bold text-accent">{Math.ceil(currentScenarioData.config.totalPlayers / currentScenarioData.config.maxTeamSize)}</div>
                  <div className="text-xs text-gray-600">Teams Created</div>
                </div>
                <div className="text-center p-3 bg-white rounded-lg border border-gray-200">
                  <div className="text-2xl font-bold text-secondary">{currentScenarioData.config.maxTeamSize}</div>
                  <div className="text-xs text-gray-600">Players Each</div>
                </div>
                <div className="text-center p-3 bg-white rounded-lg border border-gray-200">
                  <div className="text-2xl font-bold text-primary">{currentScenarioData.config.totalPlayers}</div>
                  <div className="text-xs text-gray-600">Total Players</div>
                </div>
              </div>

              {/* Configuration Reasoning */}
              <div className="mt-4 p-3 bg-white rounded-lg border border-gray-200">
                <h5 className="font-semibold text-gray-800 mb-2">Why this works:</h5>
                <ul className="text-sm text-gray-600 space-y-1">
                  {currentScenario === 0 && (
                    <>
                      <li>• Creates 8 competitive teams from 32 players</li>
                      <li>• 4 players allow proper basketball positions</li>
                      <li>• High skill balance ensures competitive games</li>
                    </>
                  )}
                  {currentScenario === 1 && (
                    <>
                      <li>• Creates 8 diverse teams from 48 players</li>
                      <li>• 6 players standard for volleyball teams</li>
                      <li>• Gender balance promotes inclusivity</li>
                    </>
                  )}
                  {currentScenario === 2 && (
                    <>
                      <li>• Creates 8 fun teams from 64 kids</li>
                      <li>• Larger teams = maximum participation</li>
                      <li>• Low skill balancing reduces pressure</li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          </div>

          {showResults && (
            <div className="text-center p-4 bg-green-500/20 rounded-lg border border-green-500 animate-fade-in">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
              <p className="text-green-700 font-medium">Smart configuration leads to better team experiences!</p>
            </div>
          )}
        </div>
      </div>

      {/* Progress Indicators */}
      <div className="flex justify-center mt-6">
        <div className="flex gap-2">
          {scenarios.map((_, index) => (
            <div
              key={index}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${index <= currentScenario ? 'bg-primary' : 'bg-gray-300'
                }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

const TeamGenerationDemo: React.FC = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showTeams, setShowTeams] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [dragPhase, setDragPhase] = useState('none'); // 'none', 'clicked', 'dragging', 'dropped'
  const [floatingPlayer, setFloatingPlayer] = useState<any>(null);
  const [teams, setTeams] = useState(mockTeams);

  const analysisSteps = [
    "Analyzing player skill levels...",
    "Balancing gender distribution...",
    "Processing teammate requests...",
    "Optimizing team composition...",
    "Finalizing balanced teams..."
  ];

  useEffect(() => {
    // Start loading immediately - 7 seconds (half of 14)
    setIsGenerating(true);

    // Cycle through analysis steps during loading
    const stepInterval = setInterval(() => {
      setAnalysisStep(prev => {
        if (prev >= analysisSteps.length - 1) {
          clearInterval(stepInterval);
          // End loading and show teams after 7 seconds
          setTimeout(() => {
            setIsGenerating(false);
            setShowTeams(true);

            // Start click and drag animation after teams appear (other 7 seconds)
            setTimeout(() => {
              // Phase 1: Click - Alex gets highlighted
              setDragPhase('clicked');
              const alexPlayer = teams[0].players.find(p => p.name === 'Alex Johnson');
              setFloatingPlayer(alexPlayer);

              setTimeout(() => {
                // Phase 2: Drag - Alex moves across screen
                setDragPhase('dragging');

                setTimeout(() => {
                  // Phase 3: Drop - Alex appears in new team
                  setDragPhase('dropped');

                  setTimeout(() => {
                    // Complete the switch
                    const newTeams = [...teams];
                    const alexPlayer = newTeams[0].players.find(p => p.name === 'Alex Johnson');
                    const davidPlayer = newTeams[1].players.find(p => p.name === 'David Kim');

                    if (alexPlayer && davidPlayer) {
                      // Remove players from current teams
                      newTeams[0].players = newTeams[0].players.filter(p => p.name !== 'Alex Johnson');
                      newTeams[1].players = newTeams[1].players.filter(p => p.name !== 'David Kim');

                      // Add players to new teams
                      newTeams[0].players.push(davidPlayer);
                      newTeams[1].players.push(alexPlayer);

                      // Recalculate averages
                      newTeams[0].averageSkill = Number((newTeams[0].players.reduce((sum, p) => sum + (p.execSkillRating !== null ? p.execSkillRating : p.skillRating), 0) / newTeams[0].players.length).toFixed(1));
                      newTeams[1].averageSkill = Number((newTeams[1].players.reduce((sum, p) => sum + (p.execSkillRating !== null ? p.execSkillRating : p.skillRating), 0) / newTeams[1].players.length).toFixed(1));

                      setTeams(newTeams);
                      setDragPhase('none');
                      setFloatingPlayer(null);
                    }
                  }, 1000);
                }, 2000);
              }, 1000);
            }, 1000);
          }, 7000);
          return prev;
        }
        return prev + 1;
      });
    }, 1200);

    return () => clearInterval(stepInterval);
  }, [teams]);

  return (
    <div className="space-y-6 relative">
      {/* Loading Screen - First Half */}
      {isGenerating && (
        <div className="text-center py-8 relative">
          <div className="relative">
            <div className="w-16 h-16 mx-auto mb-4 border-4 border-primary/20 border-t-primary rounded-full animate-spin custom-spinner"></div>
            <Brain className="w-8 h-8 absolute top-4 left-1/2 transform -translate-x-1/2 text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-2 text-gray-800">Generating Balanced Teams...</h3>
          <p className="text-accent font-medium mb-2">{analysisSteps[analysisStep]}</p>
          <div className="flex justify-center">
            <div className="flex space-x-1">
              {analysisSteps.map((_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${index <= analysisStep ? 'bg-primary' : 'bg-gray-300'
                    }`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Teams Display with Click & Drop - Second Half */}
      {showTeams && (
        <div className="space-y-4 relative">
          {/* Floating Player During Drag */}
          {floatingPlayer && dragPhase === 'dragging' && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30 animate-pulse">
              <div className="bg-accent/95 border-2 border-accent rounded-lg p-3 shadow-2xl backdrop-blur-sm animate-bounce">
                <div className="flex items-center gap-2">
                  <span className="text-black font-bold">{floatingPlayer.name}</span>
                  <Badge className="bg-black text-accent text-xs">{floatingPlayer.gender}</Badge>
                  <span className="text-black font-bold">{floatingPlayer.skillRating}</span>
                </div>
                <div className="text-xs text-black mt-1 text-center">🚀 Moving to Team Beta...</div>
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            {teams.map((team, index) => (
              <div
                key={team.id}
                className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg p-4 border border-gray-200 hover-lift card-reveal"
                style={{ animationDelay: `${index * 200}ms` }}
              >
                <h4 className="font-semibold text-lg mb-3 text-gray-800">{team.name}</h4>
                <div className="space-y-2 mb-4">
                  {team.players.map(player => {
                    const isPlayerClicked = dragPhase === 'clicked' && player.name === 'Alex Johnson';
                    const isPlayerDragging = dragPhase === 'dragging' && player.name === 'Alex Johnson';
                    const isPlayerDropped = dragPhase === 'dropped' && player.name === 'Alex Johnson';

                    return (
                      <div
                        key={player.id}
                        className={`flex items-center justify-between text-sm transition-all duration-1000 cursor-pointer ${isPlayerClicked
                          ? 'transform scale-110 bg-accent/30 border-2 border-accent rounded-lg p-2 shadow-xl animate-pulse'
                          : isPlayerDragging
                            ? 'opacity-30 scale-95 p-2 rounded-lg'
                            : isPlayerDropped && team.name === 'Team Beta'
                              ? 'transform scale-110 bg-green-500/30 border-2 border-green-500 rounded-lg p-2 shadow-xl animate-bounce'
                              : 'hover:bg-gray-100 p-2 rounded-lg'
                          }`}
                      >
                        <span className={`${isPlayerClicked ? 'text-accent font-bold' :
                          isPlayerDragging ? 'text-gray-400' :
                            isPlayerDropped && team.name === 'Team Beta' ? 'text-green-600 font-bold' :
                              'text-gray-800'
                          }`}>
                          {player.name}
                          {isPlayerClicked && (
                            <span className="ml-2 text-xs animate-bounce">👆 Clicked!</span>
                          )}
                          {isPlayerDragging && (
                            <span className="ml-2 text-xs">✈️ Dragging...</span>
                          )}
                          {isPlayerDropped && team.name === 'Team Beta' && (
                            <span className="ml-2 text-xs animate-bounce">🎯 Dropped!</span>
                          )}
                        </span>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-secondary text-white text-xs">{player.gender}</Badge>
                          <span className="text-accent font-medium">{player.skillRating}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between text-sm border-t border-gray-200 pt-2">
                  <span className="text-gray-600">Avg Skill</span>
                  <span className="font-semibold text-primary">{team.averageSkill}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const AnalyticsDemo: React.FC = () => {
  const [showStats, setShowStats] = useState(false);
  const [showCallout, setShowCallout] = useState(false);

  // Expanded mock teams for analytics demo
  const expandedMockTeams = [
    {
      id: '1',
      name: 'Team Thunder',
      players: [
        { id: '1', name: 'Alex Johnson', gender: 'M', skillRating: 8.2 },
        { id: '2', name: 'Sarah Davis', gender: 'F', skillRating: 8.8 },
        { id: '3', name: 'Mike Chen', gender: 'M', skillRating: 7.9 },
        { id: '4', name: 'Emma Wilson', gender: 'F', skillRating: 8.9 },
        { id: '5', name: 'Ryan Lee', gender: 'M', skillRating: 8.1 },
        { id: '6', name: 'Lisa Park', gender: 'F', skillRating: 8.7 }
      ],
      averageSkill: 8.4,
      genderBreakdown: { M: 3, F: 3, Other: 0 }
    },
    {
      id: '2',
      name: 'Team Lightning',
      players: [
        { id: '7', name: 'David Kim', gender: 'M', skillRating: 7.5 },
        { id: '8', name: 'Jessica Wong', gender: 'F', skillRating: 8.6 },
        { id: '9', name: 'Tom Brown', gender: 'M', skillRating: 8.0 },
        { id: '10', name: 'Amy Roberts', gender: 'F', skillRating: 8.3 },
        { id: '11', name: 'Chris Miller', gender: 'M', skillRating: 7.8 },
        { id: '12', name: 'Nina Torres', gender: 'F', skillRating: 8.5 }
      ],
      averageSkill: 8.1,
      genderBreakdown: { M: 3, F: 3, Other: 0 }
    },
    {
      id: '3',
      name: 'Team Storm',
      players: [
        { id: '13', name: 'Jake Wilson', gender: 'M', skillRating: 8.4 },
        { id: '14', name: 'Rachel Green', gender: 'F', skillRating: 8.2 },
        { id: '15', name: 'Ben Taylor', gender: 'M', skillRating: 7.9 },
        { id: '16', name: 'Sophie Clark', gender: 'F', skillRating: 8.7 },
        { id: '17', name: 'Alex Morgan', gender: 'M', skillRating: 8.0 },
        { id: '18', name: 'Katie Smith', gender: 'F', skillRating: 8.6 }
      ],
      averageSkill: 8.3,
      genderBreakdown: { M: 3, F: 3, Other: 0 }
    },
    {
      id: '4',
      name: 'Team Blaze',
      players: [
        { id: '19', name: 'Josh Martinez', gender: 'M', skillRating: 7.7 },
        { id: '20', name: 'Megan Lee', gender: 'F', skillRating: 8.5 },
        { id: '21', name: 'Tyler Davis', gender: 'M', skillRating: 8.1 },
        { id: '22', name: 'Anna Johnson', gender: 'F', skillRating: 8.0 },
        { id: '23', name: 'Lucas White', gender: 'M', skillRating: 7.6 },
        { id: '24', name: 'Zoe Anderson', gender: 'F', skillRating: 8.9 }
      ],
      averageSkill: 8.1,
      genderBreakdown: { M: 3, F: 3, Other: 0 }
    }
  ];

  useEffect(() => {
    const calloutTimer = setTimeout(() => setShowCallout(true), 500);
    const statsTimer = setTimeout(() => setShowStats(true), 2000);
    return () => {
      clearTimeout(calloutTimer);
      clearTimeout(statsTimer);
    };
  }, []);

  return (
    <div className="space-y-6 relative">
      {showCallout && (
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-20">
          <div className="bg-accent text-black px-3 py-1 rounded-lg text-sm font-medium shadow-lg animate-bounce">
            ↓ View real-time performance metrics
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <div className="text-center p-4 bg-gradient-to-r from-primary/30 to-primary/20 rounded-lg border border-primary/30 hover-lift">
          <BarChart3 className="w-8 h-8 mx-auto mb-2 text-primary animate-pulse" />
          <div className="text-2xl font-bold text-gray-800">98%</div>
          <div className="text-sm text-gray-600">Balance Score</div>
        </div>
        <div className="text-center p-4 bg-gradient-to-r from-secondary/30 to-secondary/20 rounded-lg border border-secondary/30 hover-lift">
          <Users className="w-8 h-8 mx-auto mb-2 text-secondary animate-pulse" />
          <div className="text-2xl font-bold text-gray-800">24/24</div>
          <div className="text-sm text-gray-600">Players Assigned</div>
        </div>
        <div className="text-center p-4 bg-gradient-to-r from-accent/30 to-accent/20 rounded-lg border border-accent/30 hover-lift">
          <Target className="w-8 h-8 mx-auto mb-2 text-accent animate-pulse" />
          <div className="text-2xl font-bold text-gray-800">100%</div>
          <div className="text-sm text-gray-600">Constraints Met</div>
        </div>
      </div>

      {showStats && (
        <div className="relative">
          <div className="absolute -top-2 right-4 z-10">
            <div className="bg-green-500 text-white px-2 py-1 rounded text-xs animate-pulse">
              ← Perfect team analysis
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h3 className="font-semibold mb-4 text-gray-800">Detailed Team Analysis</h3>
            <div className="space-y-4">
              {expandedMockTeams.map((team, index) => (
                <div
                  key={team.id}
                  className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 animate-fade-in"
                  style={{ animationDelay: `${index * 300}ms` }}
                >
                  <div>
                    <span className="font-medium text-gray-800">{team.name}</span>
                    <div className="text-sm text-gray-600">
                      {team.genderBreakdown.M}M, {team.genderBreakdown.F}F
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-sm font-medium text-accent">Skill: {team.averageSkill}</div>
                      <div className="text-xs text-green-600">Balanced</div>
                    </div>
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ExportDemo: React.FC = () => {
  const [exportFormat, setExportFormat] = useState('email');
  const [isExporting, setIsExporting] = useState(false);
  const [showCallout, setShowCallout] = useState(false);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [emailStep, setEmailStep] = useState(0);

  const handleExport = () => {
    setIsExporting(true);
    setTimeout(() => setIsExporting(false), 2000);
  };

  useEffect(() => {
    const timer = setTimeout(() => setShowCallout(true), 1000);
    const emailDemoTimer = setTimeout(() => {
      setShowEmailPreview(true);
      // Progress through email steps
      const stepInterval = setInterval(() => {
        setEmailStep(prev => {
          if (prev >= 2) {
            clearInterval(stepInterval);
            setTimeout(() => handleExport(), 1000);
            return prev;
          }
          return prev + 1;
        });
      }, 2000);
      return () => clearInterval(stepInterval);
    }, 2000);
    return () => {
      clearTimeout(timer);
      clearTimeout(emailDemoTimer);
    };
  }, []);

  return (
    <div className="space-y-6 relative">
      {showCallout && (
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-20">
          <div className="bg-accent text-black px-3 py-1 rounded-lg text-sm font-medium shadow-lg animate-bounce">
            ↓ Email teams directly to all participants
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-semibold mb-4 text-gray-800">Email Teams Feature</h3>
          <div className="space-y-3">
            <div className="p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">✉️</span>
                <span className="font-semibold text-gray-800">Individual Team Emails</span>
              </div>
              <p className="text-sm text-gray-600">Send each player their specific team assignment</p>
            </div>

            <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">📧</span>
                <span className="font-semibold text-gray-800">All Teams Summary</span>
              </div>
              <p className="text-sm text-gray-600">Complete roster overview for coaches and organizers</p>
            </div>

            <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">🔗</span>
                <span className="font-semibold text-gray-800">Gmail Integration</span>
              </div>
              <p className="text-sm text-gray-600">One-click integration with Gmail for instant sending</p>
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -top-2 right-0 z-10">
            <div className="bg-green-500 text-white px-2 py-1 rounded text-xs animate-pulse">
              ← Live email preview
            </div>
          </div>
          <h3 className="text-lg font-semibold mb-4 text-gray-800">Email Preview</h3>

          {!showEmailPreview ? (
            <div className="bg-gray-50 rounded-lg p-4 mb-4 border border-gray-200">
              <div className="text-sm text-accent mb-2 font-medium">Team Assignment Email</div>
              <div className="text-xs text-gray-600">
                Professional email templates with team details, roster, and next steps
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg p-4 mb-4 border border-gray-200 shadow-lg">
              <div className="border-b border-gray-200 pb-3 mb-3">
                <div className="text-xs text-gray-500 mb-1">Subject:</div>
                <div className="text-sm font-medium text-gray-800">
                  {emailStep >= 0 && "🏀 Your Team Assignment - Basketball Tournament"}
                </div>
              </div>

              <div className="space-y-3 text-sm">
                {emailStep >= 0 && (
                  <div className="animate-fade-in">
                    <div className="font-semibold text-gray-800">Hi Alex Johnson!</div>
                    <p className="text-gray-600">You've been assigned to <strong className="text-primary">Team Thunder</strong></p>
                  </div>
                )}

                {emailStep >= 1 && (
                  <div className="animate-fade-in bg-gray-50 rounded p-3" style={{ animationDelay: '200ms' }}>
                    <div className="font-medium text-gray-800 mb-2">Your Team:</div>
                    <div className="text-xs text-gray-600 space-y-1">
                      <div>• Alex Johnson (M) - You</div>
                      <div>• Sarah Davis (F)</div>
                      <div>• Mike Chen (M)</div>
                      <div>• Emma Wilson (F)</div>
                      <div>• Ryan Lee (M)</div>
                      <div>• Lisa Park (F)</div>
                    </div>
                  </div>
                )}

                {emailStep >= 2 && (
                  <div className="animate-fade-in bg-green-50 rounded p-3 border border-green-200" style={{ animationDelay: '400ms' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="font-medium text-green-700">Ready to send!</span>
                    </div>
                    <div className="text-xs text-green-600">
                      Click "Email Teams" to send via Gmail or copy to your email client
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <Button
            onClick={handleExport}
            disabled={isExporting}
            className="w-full bg-green-600 hover:bg-green-700 interactive-button"
          >
            {isExporting ? (
              <>
                <div className="w-4 h-4 mr-2 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Sending Emails...
              </>
            ) : (
              <>
                <Mail className="w-4 h-4 mr-2" />
                Email Teams
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TutorialLanding; 
