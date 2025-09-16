# TeamBuilder - Claude Context File

## App Overview
**TeamBuilder** is a React-based web application that automatically generates balanced sports teams from player rosters with smart constraint handling. It's designed for sports league organizers who need to create fair teams quickly.

**Live Demo:** https://5msdtx5yti.space.minimax.io

## Tech Stack
- **Frontend:** React 18 + TypeScript
- **UI Framework:** Tailwind CSS + Radix UI components
- **Build Tool:** Vite
- **State Management:** React Context + Hooks + localStorage
- **Package Manager:** pnpm

## Key Scripts & Commands
```bash
# Development
pnpm dev              # Start development server
pnpm build            # Build for production (includes TypeScript compilation)
pnpm preview          # Preview production build
pnpm lint             # Run ESLint

# Testing
# No specific test framework configured - check README or ask user for testing approach
```

## Project Structure
```
src/
├── components/         # React components
│   ├── ui/            # Radix UI components (extensive collection)
│   ├── CSVUploader.tsx
│   ├── ConfigurationPanel.tsx
│   ├── TeamDisplay.tsx
│   ├── PlayerRoster.tsx
│   ├── ExportPanel.tsx
│   └── ...
├── utils/             # Business logic utilities
│   ├── teamGenerator.ts    # Core team balancing algorithm
│   ├── configManager.ts    # Configuration persistence
│   ├── csvProcessor.ts     # CSV parsing and validation
│   ├── exportUtils.ts      # Export functionality
│   └── playerGrouping.ts   # Player grouping logic
├── types/
│   └── index.ts       # TypeScript interfaces
├── hooks/             # Custom React hooks
└── assets/            # Static assets (logo.svg)
```

## Core Interfaces
```typescript
interface Player {
  id: string;
  name: string;
  gender: 'M' | 'F' | 'Other';
  skillRating: number;
  teammateRequests: string[];
  avoidRequests: string[];
  teamId?: string;
  groupId?: string;
}

interface Team {
  id: string;
  name: string;
  players: Player[];
  averageSkill: number;
  genderBreakdown: { M: number; F: number; Other: number; };
}

interface LeagueConfig {
  id: string;
  name: string;
  maxTeamSize: number;
  minFemales: number;
  minMales: number;
  targetTeams?: number;
  allowMixedGender: boolean;
}
```

## State Management
- **Primary State:** Stored in `AppState` interface in `App.tsx`
- **Persistence:** Automatically saves to localStorage (`teamBuilderState` key)
- **State includes:** players, teams, unassignedPlayers, playerGroups, config, stats, savedConfigs

## Key Features

### CSV Upload & Processing
- Validates required columns: Name, Gender, Skill Rating
- Optional columns: Teammate Requests, Avoid Requests
- Supports player grouping via CSV
- Comprehensive error reporting and warnings

### Team Generation Algorithm
1. **Constraint Priority:**
   - Avoid Requests (highest - hard constraint)
   - Team Size Limits (hard constraint)
   - Gender Requirements (hard constraint)
   - Mutual Teammate Requests (honored when possible)
   - Skill Balance (optimized after other constraints)

2. **Generation Types:**
   - Balanced Teams: Honors constraints and balances skill
   - Random Teams: Ignores preferences, random distribution

### UI Workflow (6-tab interface)
1. **Upload:** CSV file processing
2. **Groups:** Player grouping management
3. **Roster:** Player details and editing
4. **Generate Teams:** Configuration and team generation
5. **Teams:** Team display with drag-and-drop reassignment
6. **Export:** Multiple export formats

### Configuration Presets
- Recreational League: 12 max, 3 min F, 3 min M
- Competitive League: 10 max, 2 min F, 2 min M  
- Youth League: 15 max, no gender requirements
- Small-Sided Games: 7 max, 2 min F, 2 min M

## Important Files to Understand

### Core Logic
- `src/utils/teamGenerator.ts` - Main team generation algorithm
- `src/utils/csvProcessor.ts` - CSV parsing and validation
- `src/App.tsx` - Main application component with state management

### Key Components
- `src/components/CSVUploader.tsx` - File upload and validation
- `src/components/TeamDisplay.tsx` - Team visualization and drag-and-drop
- `src/components/ConfigurationPanel.tsx` - Settings management
- `src/components/ExportPanel.tsx` - Export functionality

### Configuration
- `vite.config.ts` - Vite configuration with base path `/TeamBuilder/`
- `package.json` - Dependencies and scripts
- `tailwind.config.js` - Tailwind CSS configuration

## Development Notes

### Code Patterns
- Uses React hooks extensively (useState, useCallback, useEffect)
- Functional components throughout
- TypeScript interfaces defined in `src/types/index.ts`
- Tailwind CSS for styling with Radix UI components
- Error boundaries implemented for crash protection

### State Updates
- Immutable state updates using spread operators
- localStorage sync on every state change
- Complex state calculations for team statistics

### Performance Considerations
- Team generation typically <1 second for 100+ players
- Real-time constraint validation
- Optimistic UI updates with error handling

## Common Tasks

### Adding New Features
1. Update types in `src/types/index.ts` if needed
2. Add business logic to appropriate utility file
3. Create/update React components
4. Update `AppState` and persistence if needed

### Debugging
- Check browser console for errors
- Inspect localStorage (`teamBuilderState` key) for state
- Use React DevTools for component debugging

### Testing
- No test framework currently configured
- Manual testing workflow covers all user paths
- Ask user about preferred testing approach before adding tests

## Build & Deployment
- Vite builds to `dist/` folder
- Static site deployment ready
- Base path configured for `/TeamBuilder/` deployment
- No backend dependencies - fully client-side

## Environment
- Windows development environment
- Git repository with recent commits focused on UI improvements
- No database - all data client-side only