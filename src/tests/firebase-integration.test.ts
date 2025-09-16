/**
 * Firebase Integration Tests
 *
 * Comprehensive tests to verify proper Firebase setup and data persistence
 * for execSkillRating, team rosters, and teams.
 *
 * Run these tests manually in the browser console or integrate with a testing framework.
 */

import { User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/config/firebase';
import { dataStorageService } from '@/services/dataStorageService';
import { saveTeams, getUserTeams, updateTeams, deleteTeams, TeamsData } from '@/services/teamsService';
import { AppState, Player, Team, LeagueConfig } from '@/types';

// Test utilities
class FirebaseTestSuite {
  private testUserId: string | null = null;
  private testResults: { [key: string]: boolean } = {};

  constructor() {
    console.log('🧪 Firebase Integration Test Suite initialized');
  }

  /**
   * Run all tests in sequence
   */
  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Firebase Integration Tests...\n');

    // Check authentication first
    if (!auth.currentUser) {
      console.error('❌ No authenticated user. Please sign in first.');
      return;
    }

    this.testUserId = auth.currentUser.uid;
    console.log(`✅ Using authenticated user: ${this.testUserId}\n`);

    // Run test suites
    await this.testExecSkillRatingPersistence();
    await this.testTeamRostersPersistence();
    await this.testTeamsPersistence();

    // Print summary
    this.printTestSummary();
  }

  /**
   * Test Suite 1: ExecSkillRating Persistence
   */
  async testExecSkillRatingPersistence(): Promise<void> {
    console.log('📊 Testing execSkillRating Persistence...');

    try {
      // Test 1.1: Save player with execSkillRating
      console.log('  1.1 Testing save with execSkillRating...');
      const testPlayer: Player = {
        id: 'test-player-1',
        name: 'Test Player',
        gender: 'M',
        skillRating: 7,
        execSkillRating: 8.5,  // Valid exec rating
        teammateRequests: [],
        avoidRequests: [],
        email: 'test@example.com'
      };

      const testState: AppState = {
        players: [testPlayer],
        teams: [],
        unassignedPlayers: [],
        playerGroups: [],
        config: {
          id: 'test-config',
          name: 'Test Config',
          maxTeamSize: 12,
          minFemales: 3,
          minMales: 3,
          allowMixedGender: true
        },
        savedConfigs: []
      };

      await dataStorageService.save(testState);
      console.log('    ✅ Saved player with execSkillRating');

      // Test 1.2: Verify execSkillRating is saved in Firestore
      console.log('  1.2 Verifying Firestore storage...');
      const userDoc = doc(db, 'users', this.testUserId!, 'data', 'appState');
      const docSnap = await getDoc(userDoc);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const savedPlayer = data.players?.[0];

        if (savedPlayer?.execSkillRating === 8.5) {
          console.log('    ✅ execSkillRating correctly saved to Firestore');
          this.testResults['execSkillRating_save'] = true;
        } else {
          console.error('    ❌ execSkillRating not found or incorrect in Firestore');
          console.log('    Saved value:', savedPlayer?.execSkillRating);
          this.testResults['execSkillRating_save'] = false;
        }
      } else {
        console.error('    ❌ Document not found in Firestore');
        this.testResults['execSkillRating_save'] = false;
      }

      // Test 1.3: Test null value (N/A) handling
      console.log('  1.3 Testing null value (N/A) handling...');
      const testPlayerNA: Player = {
        ...testPlayer,
        id: 'test-player-2',
        name: 'Test Player NA',
        execSkillRating: null  // N/A value
      };

      testState.players.push(testPlayerNA);
      await dataStorageService.save(testState);

      const loadedState = await dataStorageService.load();
      const naPlayer = loadedState?.players.find(p => p.id === 'test-player-2');

      if (naPlayer && naPlayer.execSkillRating === null) {
        console.log('    ✅ Null values (N/A) handled correctly');
        this.testResults['execSkillRating_null'] = true;
      } else {
        console.error('    ❌ Null value handling failed');
        console.log('    Loaded value:', naPlayer?.execSkillRating);
        this.testResults['execSkillRating_null'] = false;
      }

      // Test 1.4: Persistence across page reloads
      console.log('  1.4 Testing persistence across reloads...');
      const reloadedState = await dataStorageService.load();
      const reloadedPlayer = reloadedState?.players.find(p => p.id === 'test-player-1');

      if (reloadedPlayer?.execSkillRating === 8.5) {
        console.log('    ✅ execSkillRating persists across reloads');
        this.testResults['execSkillRating_reload'] = true;
      } else {
        console.error('    ❌ execSkillRating lost after reload');
        this.testResults['execSkillRating_reload'] = false;
      }

      // Test 1.5: CSV import with matching names
      console.log('  1.5 Testing CSV import preservation...');
      console.log('    ⚠️  Manual test required: Import CSV with matching player names');
      console.log('    Expected: execSkillRating values should be preserved for existing players');

    } catch (error) {
      console.error('  ❌ Error in execSkillRating tests:', error);
      this.testResults['execSkillRating_suite'] = false;
    }

    console.log('');
  }

  /**
   * Test Suite 2: Team Rosters Persistence
   */
  async testTeamRostersPersistence(): Promise<void> {
    console.log('👥 Testing Team Rosters Persistence...');

    try {
      // Test 2.1: Save complete roster with all fields
      console.log('  2.1 Testing complete roster save...');
      const testRoster: Player[] = [
        {
          id: 'roster-player-1',
          name: 'Alice Johnson',
          gender: 'F',
          skillRating: 8,
          execSkillRating: 7.5,
          teammateRequests: ['Bob Smith'],
          avoidRequests: [],
          email: 'alice@example.com',
          groupId: 'group-a'
        },
        {
          id: 'roster-player-2',
          name: 'Bob Smith',
          gender: 'M',
          skillRating: 6,
          execSkillRating: null,  // N/A
          teammateRequests: ['Alice Johnson'],
          avoidRequests: [],
          email: 'bob@example.com'
        },
        {
          id: 'roster-player-3',
          name: 'Charlie Davis',
          gender: 'Other',
          skillRating: 7,
          execSkillRating: 8,
          teammateRequests: [],
          avoidRequests: ['Bob Smith'],
          teamId: 'team-1'
        }
      ];

      const rosterState: AppState = {
        players: testRoster,
        teams: [],
        unassignedPlayers: [],
        playerGroups: [
          {
            id: 'group-a',
            label: 'A',
            color: '#ff0000',
            playerIds: ['roster-player-1'],
            players: [testRoster[0]]
          }
        ],
        config: {
          id: 'roster-config',
          name: 'Roster Test Config',
          maxTeamSize: 10,
          minFemales: 2,
          minMales: 2,
          allowMixedGender: true
        },
        savedConfigs: []
      };

      await dataStorageService.save(rosterState);
      console.log('    ✅ Saved complete roster with all fields');

      // Test 2.2: Verify all player fields are saved
      console.log('  2.2 Verifying all player fields in Firestore...');
      const userDoc = doc(db, 'users', this.testUserId!, 'data', 'appState');
      const docSnap = await getDoc(userDoc);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const savedPlayers = data.players || [];

        let allFieldsPresent = true;
        const requiredFields = ['id', 'name', 'gender', 'skillRating', 'execSkillRating', 'teammateRequests', 'avoidRequests'];

        for (const player of savedPlayers) {
          for (const field of requiredFields) {
            if (!(field in player)) {
              console.error(`    ❌ Missing field "${field}" for player ${player.name}`);
              allFieldsPresent = false;
            }
          }
        }

        if (allFieldsPresent) {
          console.log('    ✅ All player fields correctly saved');
          this.testResults['roster_fields'] = true;
        } else {
          this.testResults['roster_fields'] = false;
        }

        // Test optional fields
        const playerWithEmail = savedPlayers.find((p: any) => p.email);
        const playerWithGroup = savedPlayers.find((p: any) => p.groupId);
        const playerWithTeam = savedPlayers.find((p: any) => p.teamId);

        if (playerWithEmail?.email && playerWithGroup?.groupId && playerWithTeam?.teamId) {
          console.log('    ✅ Optional fields (email, groupId, teamId) preserved');
          this.testResults['roster_optional_fields'] = true;
        } else {
          console.log('    ⚠️  Some optional fields missing');
          this.testResults['roster_optional_fields'] = false;
        }
      }

      // Test 2.3: Verify roster survives page refresh
      console.log('  2.3 Testing roster persistence across page refresh...');
      const reloadedState = await dataStorageService.load();

      if (reloadedState?.players.length === testRoster.length) {
        const alice = reloadedState.players.find(p => p.name === 'Alice Johnson');
        const bob = reloadedState.players.find(p => p.name === 'Bob Smith');

        if (alice?.execSkillRating === 7.5 && bob?.execSkillRating === null) {
          console.log('    ✅ Roster data survives page refresh');
          this.testResults['roster_refresh'] = true;
        } else {
          console.error('    ❌ Roster data corrupted after refresh');
          this.testResults['roster_refresh'] = false;
        }
      } else {
        console.error('    ❌ Roster size changed after refresh');
        this.testResults['roster_refresh'] = false;
      }

      // Test 2.4: Verify AppState integrity
      console.log('  2.4 Testing full AppState integrity...');
      if (reloadedState) {
        const hasAllComponents =
          Array.isArray(reloadedState.players) &&
          Array.isArray(reloadedState.teams) &&
          Array.isArray(reloadedState.unassignedPlayers) &&
          Array.isArray(reloadedState.playerGroups) &&
          reloadedState.config &&
          Array.isArray(reloadedState.savedConfigs);

        if (hasAllComponents) {
          console.log('    ✅ Full AppState structure maintained');
          this.testResults['roster_appstate'] = true;
        } else {
          console.error('    ❌ AppState structure incomplete');
          this.testResults['roster_appstate'] = false;
        }
      }

    } catch (error) {
      console.error('  ❌ Error in roster tests:', error);
      this.testResults['roster_suite'] = false;
    }

    console.log('');
  }

  /**
   * Test Suite 3: Teams Persistence
   */
  async testTeamsPersistence(): Promise<void> {
    console.log('🏆 Testing Teams Persistence...');

    try {
      // Test 3.1: Save generated teams
      console.log('  3.1 Testing team save functionality...');

      const testPlayers: Player[] = [
        {
          id: 'team-test-1',
          name: 'Player One',
          gender: 'M',
          skillRating: 8,
          execSkillRating: 7,
          teammateRequests: [],
          avoidRequests: []
        },
        {
          id: 'team-test-2',
          name: 'Player Two',
          gender: 'F',
          skillRating: 6,
          execSkillRating: null,
          teammateRequests: [],
          avoidRequests: []
        }
      ];

      const testTeams: Team[] = [
        {
          id: 'team-alpha',
          name: 'Team Alpha',
          players: [testPlayers[0]],
          averageSkill: 8,
          genderBreakdown: { M: 1, F: 0, Other: 0 }
        },
        {
          id: 'team-beta',
          name: 'Team Beta',
          players: [testPlayers[1]],
          averageSkill: 6,
          genderBreakdown: { M: 0, F: 1, Other: 0 }
        }
      ];

      const testConfig: LeagueConfig = {
        id: 'test-league',
        name: 'Test League',
        maxTeamSize: 5,
        minFemales: 1,
        minMales: 1,
        allowMixedGender: true
      };

      const teamsData: Omit<TeamsData, 'id' | 'createdAt' | 'updatedAt'> = {
        userId: this.testUserId!,
        rosterId: 'test-roster-1',
        name: 'Test Teams Configuration',
        description: 'Testing teams persistence',
        teams: testTeams,
        unassignedPlayers: [],
        config: testConfig,
        generationMethod: 'balanced'
      };

      const savedTeamId = await saveTeams(teamsData);

      if (savedTeamId) {
        console.log(`    ✅ Teams saved successfully with ID: ${savedTeamId}`);
        this.testResults['teams_save'] = true;
      } else {
        console.error('    ❌ Failed to save teams');
        this.testResults['teams_save'] = false;
      }

      // Test 3.2: Verify team compositions are preserved
      console.log('  3.2 Verifying team compositions...');
      const loadedTeams = await getUserTeams(this.testUserId!, 'test-roster-1');

      if (loadedTeams.length > 0) {
        const latestTeam = loadedTeams[0];

        // Check team structure
        const hasCorrectTeams =
          latestTeam.teams.length === 2 &&
          latestTeam.teams[0].name === 'Team Alpha' &&
          latestTeam.teams[1].name === 'Team Beta';

        // Check player preservation including execSkillRating
        const player1 = latestTeam.teams[0].players[0];
        const player2 = latestTeam.teams[1].players[0];

        const playersPreserved =
          player1?.execSkillRating === 7 &&
          player2?.execSkillRating === null;

        if (hasCorrectTeams && playersPreserved) {
          console.log('    ✅ Team compositions and player data preserved');
          this.testResults['teams_composition'] = true;
        } else {
          console.error('    ❌ Team composition corrupted');
          console.log('    Team 1 player execSkill:', player1?.execSkillRating);
          console.log('    Team 2 player execSkill:', player2?.execSkillRating);
          this.testResults['teams_composition'] = false;
        }
      } else {
        console.error('    ❌ No teams found after save');
        this.testResults['teams_composition'] = false;
      }

      // Test 3.3: Test team statistics preservation
      console.log('  3.3 Testing team statistics preservation...');
      if (loadedTeams.length > 0) {
        const team = loadedTeams[0].teams[0];

        if (team.averageSkill === 8 &&
            team.genderBreakdown.M === 1 &&
            team.genderBreakdown.F === 0) {
          console.log('    ✅ Team statistics correctly preserved');
          this.testResults['teams_stats'] = true;
        } else {
          console.error('    ❌ Team statistics corrupted');
          this.testResults['teams_stats'] = false;
        }
      }

      // Test 3.4: Test SavedTeamsManager functionality
      console.log('  3.4 Testing SavedTeamsManager operations...');

      // Test update
      const updatedTeamsData = {
        name: 'Updated Test Teams',
        description: 'Updated description'
      };

      if (savedTeamId) {
        await updateTeams(savedTeamId, updatedTeamsData);
        const updatedList = await getUserTeams(this.testUserId!);
        const updated = updatedList.find(t => t.id === savedTeamId);

        if (updated?.name === 'Updated Test Teams') {
          console.log('    ✅ Team update functionality works');
          this.testResults['teams_update'] = true;
        } else {
          console.error('    ❌ Team update failed');
          this.testResults['teams_update'] = false;
        }

        // Test delete
        await deleteTeams(savedTeamId);
        const afterDelete = await getUserTeams(this.testUserId!);
        const deleted = afterDelete.find(t => t.id === savedTeamId);

        if (!deleted) {
          console.log('    ✅ Team delete functionality works');
          this.testResults['teams_delete'] = true;
        } else {
          console.error('    ❌ Team delete failed');
          this.testResults['teams_delete'] = false;
        }
      }

      // Test 3.5: Test team persistence across sessions
      console.log('  3.5 Testing cross-session persistence...');
      console.log('    ⚠️  Manual test required: Sign out and sign back in');
      console.log('    Expected: Previously saved teams should be available');

    } catch (error) {
      console.error('  ❌ Error in teams tests:', error);
      this.testResults['teams_suite'] = false;
    }

    console.log('');
  }

  /**
   * Print test summary
   */
  private printTestSummary(): void {
    console.log('=' .repeat(50));
    console.log('📋 TEST SUMMARY');
    console.log('=' .repeat(50));

    const passed = Object.values(this.testResults).filter(r => r).length;
    const total = Object.keys(this.testResults).length;
    const percentage = total > 0 ? Math.round((passed / total) * 100) : 0;

    console.log(`\nTests Passed: ${passed}/${total} (${percentage}%)\n`);

    // Group results by category
    const categories = {
      'execSkillRating': ['execSkillRating_save', 'execSkillRating_null', 'execSkillRating_reload'],
      'Team Rosters': ['roster_fields', 'roster_optional_fields', 'roster_refresh', 'roster_appstate'],
      'Teams': ['teams_save', 'teams_composition', 'teams_stats', 'teams_update', 'teams_delete']
    };

    for (const [category, tests] of Object.entries(categories)) {
      console.log(`\n${category}:`);
      for (const test of tests) {
        const result = this.testResults[test];
        const icon = result === true ? '✅' : result === false ? '❌' : '⏭️';
        console.log(`  ${icon} ${test}`);
      }
    }

    console.log('\n' + '=' .repeat(50));

    if (percentage === 100) {
      console.log('🎉 All tests passed! Firebase integration is working correctly.');
    } else if (percentage >= 80) {
      console.log('⚠️  Most tests passed, but some issues need attention.');
    } else {
      console.log('❌ Multiple test failures detected. Please review Firebase configuration.');
    }
  }
}

// Export test suite for browser console usage
declare global {
  interface Window {
    FirebaseTestSuite: typeof FirebaseTestSuite;
    runFirebaseTests: () => Promise<void>;
  }
}

// Make available in browser console
if (typeof window !== 'undefined') {
  window.FirebaseTestSuite = FirebaseTestSuite;
  window.runFirebaseTests = async () => {
    const suite = new FirebaseTestSuite();
    await suite.runAllTests();
  };

  console.log('🧪 Firebase Test Suite loaded!');
  console.log('   Run tests with: window.runFirebaseTests()');
}

export default FirebaseTestSuite;