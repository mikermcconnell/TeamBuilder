# Firebase Save/Load Test Checklist

## Test Setup
1. ✅ Firebase configuration added to `/src/config/firebase.ts`
2. ✅ Roster service with save functions at `/src/services/rosterService.ts`
3. ✅ Teams service with save functions at `/src/services/teamsService.ts`
4. ✅ SavedTeamsManager component created at `/src/components/SavedTeamsManager.tsx`
5. ✅ SavedTeamsManager integrated into main Teams tab
6. ✅ SavedTeamsManager integrated into FullScreenTeamBuilder

## Manual Testing Steps

### 1. Test Roster Saving
- [ ] Sign in (anonymous auth)
- [ ] Upload a CSV file with players
- [ ] Check that roster is automatically saved to Firebase
- [ ] Verify in Firebase Console under `rosters` collection

### 2. Test Teams Generation and Saving
- [ ] Generate balanced teams
- [ ] Click "Save Current Teams" button
- [ ] Enter a name (e.g., "Spring 2025 Teams")
- [ ] Add optional description
- [ ] Click Save
- [ ] Verify save confirmation toast appears

### 3. Test Teams Loading
- [ ] Click "Load Teams" button
- [ ] Select a previously saved team configuration
- [ ] Click Load
- [ ] Verify teams are loaded correctly
- [ ] Verify unassigned players are restored
- [ ] Verify configuration settings are restored

### 4. Test Export/Import
- [ ] From saved teams list, click export icon
- [ ] Verify JSON file downloads
- [ ] Check JSON structure includes:
  - Teams array
  - Unassigned players
  - Configuration
  - Export timestamp

### 5. Test Full Screen Mode
- [ ] Enter manual teams mode
- [ ] Click "Full Screen Team Builder"
- [ ] Verify SavedTeamsManager appears in header
- [ ] Test save/load functionality from full screen mode

### 6. Test Persistence
- [ ] Save a team configuration
- [ ] Refresh the page
- [ ] Sign in again
- [ ] Verify saved teams persist and can be loaded

## Firebase Collections Structure

### `rosters` Collection
```json
{
  "userId": "string",
  "name": "string",
  "players": [...],
  "playerGroups": [...],
  "teams": [...],
  "unassignedPlayers": [...],
  "teamsConfig": {...},
  "metadata": {
    "totalPlayers": "number",
    "avgSkillRating": "number",
    "hasTeams": "boolean",
    "teamsCount": "number"
  }
}
```

### `teams` Collection
```json
{
  "userId": "string",
  "rosterId": "string",
  "name": "string",
  "description": "string",
  "teams": [...],
  "unassignedPlayers": [...],
  "config": {...},
  "generationMethod": "string",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

## Expected Features
1. **Save Teams** - Save current team configuration with custom name
2. **Load Teams** - Load previously saved team configurations
3. **Delete Teams** - Remove saved team configurations
4. **Export Teams** - Export teams to JSON file
5. **Auto-save Rosters** - Rosters save automatically when created/modified
6. **Cloud Sync** - Data syncs when user is signed in

## Notes
- Anonymous authentication is used for simplicity
- Data persists across sessions when signed in
- Local storage fallback when not signed in
- Teams are linked to rosters via `rosterId` field