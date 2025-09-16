# Firebase Integration Manual Testing Guide

## Overview
This guide provides step-by-step instructions to manually verify that Firebase is properly configured and persisting data for execSkillRating, team rosters, and teams.

## Prerequisites
1. Application is running (`pnpm dev`)
2. User is signed in (anonymous or authenticated)
3. Browser Developer Console is open (F12)

## Test Suite 1: execSkillRating Persistence

### Test 1.1: Basic Save and Load
1. **Navigate to Roster tab**
2. **Add or edit a player:**
   - Name: "Test Player"
   - Gender: M
   - Skill Rating: 7
   - Exec Skill Rating: 8.5
3. **Save the player**
4. **Refresh the page** (F5)
5. **Verify:** Player's Exec Skill Rating should still be 8.5

✅ **Expected:** Exec rating persists after refresh
❌ **Issue if:** Exec rating is lost or shows as N/A

### Test 1.2: N/A Value Handling
1. **Edit a player**
2. **Set Exec Skill Rating to "N/A"**
3. **Save the player**
4. **Refresh the page**
5. **Verify:** Exec rating still shows as "N/A"

✅ **Expected:** N/A value is preserved
❌ **Issue if:** N/A becomes 0 or another value

### Test 1.3: CSV Import Preservation
1. **Create a CSV with players that already exist in your roster**
   ```csv
   Name,Gender,Skill Rating
   Test Player,M,6
   ```
2. **Import the CSV**
3. **Verify:** "Test Player" keeps their Exec Skill Rating of 8.5

✅ **Expected:** Existing exec ratings are preserved
❌ **Issue if:** Exec ratings are cleared or reset

### Test 1.4: Browser Console Verification
Run in console:
```javascript
// Check Firestore directly
const auth = window.firebase?.auth;
const db = window.firebase?.firestore;
if (auth?.currentUser) {
  const userDoc = await db.collection('users')
    .doc(auth.currentUser.uid)
    .collection('data')
    .doc('appState')
    .get();

  const data = userDoc.data();
  console.log('Players with execSkillRating:',
    data?.players?.map(p => ({
      name: p.name,
      execSkill: p.execSkillRating
    }))
  );
}
```

## Test Suite 2: Team Rosters Persistence

### Test 2.1: Complete Roster Save
1. **Upload a CSV with multiple players** (or create manually):
   - At least 10 players
   - Mix of genders
   - Various skill ratings
   - Some with teammate requests
   - Some with avoid requests
2. **Add Exec Skill Ratings to some players**
3. **Create player groups**
4. **Sign out and sign back in**
5. **Verify all data is preserved:**
   - All players present
   - Exec ratings maintained
   - Teammate/avoid requests intact
   - Player groups preserved

✅ **Expected:** Complete roster with all fields intact
❌ **Issue if:** Any player data is missing or corrupted

### Test 2.2: Cross-Device Sync (if using same account)
1. **Open the app in another browser or incognito window**
2. **Sign in with the same account**
3. **Verify:** Same roster appears

✅ **Expected:** Roster syncs across sessions
❌ **Issue if:** Roster doesn't appear or is incomplete

### Test 2.3: Large Roster Test
1. **Import a CSV with 50+ players**
2. **Add exec ratings to at least 20 players**
3. **Refresh the page**
4. **Verify:** All players and ratings preserved

✅ **Expected:** Large rosters handled correctly
❌ **Issue if:** Data truncated or missing

## Test Suite 3: Teams Persistence

### Test 3.1: Save Generated Teams
1. **Generate teams** (Generate Teams tab)
2. **Navigate to Teams tab**
3. **Click "Save Current Teams"**
4. **Enter name:** "Test Teams v1"
5. **Enter description:** "Testing Firebase persistence"
6. **Click Save**
7. **Verify:** Success message appears

✅ **Expected:** Teams saved successfully
❌ **Issue if:** Error message or save fails

### Test 3.2: Load Saved Teams
1. **Click "Load Teams"**
2. **Select "Test Teams v1"**
3. **Click Load**
4. **Verify:**
   - All teams loaded correctly
   - Player assignments preserved
   - Exec ratings maintained
   - Team statistics correct

✅ **Expected:** Teams load with complete data
❌ **Issue if:** Teams incomplete or player data missing

### Test 3.3: Multiple Team Configurations
1. **Generate different teams**
2. **Save as "Test Teams v2"**
3. **Generate again**
4. **Save as "Test Teams v3"**
5. **Load Teams and verify all 3 configurations appear**
6. **Load each one and verify they're different**

✅ **Expected:** Multiple configurations saved independently
❌ **Issue if:** Configurations overwrite each other

### Test 3.4: Delete Teams
1. **Open Load Teams dialog**
2. **Click trash icon on "Test Teams v3"**
3. **Confirm deletion**
4. **Verify:** Team configuration removed from list

✅ **Expected:** Team deleted successfully
❌ **Issue if:** Team persists or error occurs

### Test 3.5: Export/Import Teams
1. **Load a saved team configuration**
2. **Click export icon (download)**
3. **Save JSON file**
4. **Verify JSON contains:**
   - Team compositions
   - Player data with execSkillRating
   - Configuration settings

✅ **Expected:** Complete data in export
❌ **Issue if:** Missing fields in JSON

## Test Suite 4: Edge Cases

### Test 4.1: Session Timeout
1. **Leave app open for 2+ hours**
2. **Try to save data**
3. **Verify:** Re-authentication happens automatically

✅ **Expected:** Seamless re-auth
❌ **Issue if:** Save fails permanently

### Test 4.2: Offline Mode
1. **Disconnect internet**
2. **Make changes to roster**
3. **Reconnect internet**
4. **Verify:** Changes sync when online

✅ **Expected:** Offline changes sync
❌ **Issue if:** Changes lost

### Test 4.3: Data Validation
Run in console:
```javascript
// Verify data structure
window.runFirebaseTests && window.runFirebaseTests();
```

## Quick Console Commands

```javascript
// Check current auth status
console.log('Authenticated:', !!window.firebase?.auth?.currentUser);

// Get current user ID
console.log('User ID:', window.firebase?.auth?.currentUser?.uid);

// Check localStorage fallback
console.log('LocalStorage data:',
  JSON.parse(localStorage.getItem('teamBuilderState') || '{}')
);

// Force save current state
const saveButton = document.querySelector('[data-testid="save-state"]');
saveButton?.click();

// Check sync status
const syncIndicator = document.querySelector('[data-testid="sync-status"]');
console.log('Sync status:', syncIndicator?.textContent);
```

## Troubleshooting

### Issue: Data not saving
1. Check browser console for errors
2. Verify Firebase configuration in `.env`
3. Check Firestore rules allow write access
4. Verify authentication status

### Issue: execSkillRating shows as undefined
1. Check data structure in Firestore console
2. Verify field name is exactly "execSkillRating"
3. Check for type coercion issues (null vs undefined)

### Issue: Teams not loading
1. Check Firestore indexes are created
2. Verify user has permission to read teams collection
3. Check for query limits in Firestore rules

### Issue: Cross-session sync not working
1. Verify same user ID in both sessions
2. Check Firestore real-time listeners
3. Verify network connectivity

## Expected Firestore Structure

```
users/
  └── {userId}/
      └── data/
          └── appState (document)
              ├── players: Array<Player>
              │   └── [{
              │       id, name, gender, skillRating,
              │       execSkillRating, teammateRequests,
              │       avoidRequests, email?, groupId?, teamId?
              │   }]
              ├── teams: Array<Team>
              ├── unassignedPlayers: Array<Player>
              ├── playerGroups: Array<PlayerGroup>
              ├── config: LeagueConfig
              ├── savedConfigs: Array<LeagueConfig>
              └── lastUpdated: string (ISO date)

teams/
  └── {teamId} (documents)
      ├── userId: string
      ├── rosterId?: string
      ├── name: string
      ├── description?: string
      ├── teams: Array<Team>
      ├── unassignedPlayers: Array<Player>
      ├── config: LeagueConfig
      ├── generationMethod: string
      ├── createdAt: Timestamp
      └── updatedAt: Timestamp
```

## Success Criteria

✅ All tests pass = Firebase integration working correctly
⚠️  80%+ tests pass = Minor issues, core functionality works
❌ <80% tests pass = Significant issues need addressing

## Automated Testing

For automated testing, run in the browser console:
```javascript
window.runFirebaseTests();
```

This will run all tests automatically and provide a summary report.