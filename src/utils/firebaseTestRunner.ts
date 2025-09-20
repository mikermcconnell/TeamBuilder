/**
 * Firebase Test Runner Utility
 *
 * Simple utility to run Firebase integration tests directly in the app
 * This can be called from the browser console or integrated into the UI
 */

import { auth, db } from '@/config/firebase';
import { dataStorageService } from '@/services/dataStorageService';
import { doc, getDoc } from 'firebase/firestore';
import { Player, AppState } from '@/types';

export interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: any;
}

export class FirebaseTestRunner {
  private results: TestResult[] = [];

  /**
   * Run a quick test to verify Firebase is working
   */
  async runQuickTest(): Promise<{ success: boolean; message: string }> {
    try {
      // Check if user is authenticated
      if (!auth.currentUser) {
        return {
          success: false,
          message: 'Not authenticated. Please sign in first.'
        };
      }

      // Test 1: Save a test player with execSkillRating
      const testPlayer: Player = {
        id: `test-${Date.now()}`,
        name: `Test Player ${Date.now()}`,
        gender: 'M',
        skillRating: 7,
        execSkillRating: 8.5,  // This is what we're testing
        teammateRequests: [],
        avoidRequests: []
      };

      const testState: AppState = {
        players: [testPlayer],
        teams: [],
        unassignedPlayers: [],
        playerGroups: [],
        config: {
          id: 'test',
          name: 'Test Config',
          maxTeamSize: 12,
          minFemales: 3,
          minMales: 3,
          allowMixedGender: true
        },
        execRatingHistory: {},
        savedConfigs: []
      };

      // Save to Firebase
      await dataStorageService.save(testState);

      // Load back from Firebase
      const loadedState = await dataStorageService.load();

      if (!loadedState) {
        return {
          success: false,
          message: 'Failed to load data back from Firebase'
        };
      }

      // Check if execSkillRating was preserved
      const loadedPlayer = loadedState.players.find(p => p.id === testPlayer.id);

      if (!loadedPlayer) {
        return {
          success: false,
          message: 'Test player not found after save/load'
        };
      }

      if (loadedPlayer.execSkillRating !== 8.5) {
        return {
          success: false,
          message: `execSkillRating mismatch: expected 8.5, got ${loadedPlayer.execSkillRating}`
        };
      }

      // Test 2: Verify data is in Firestore
      const userDoc = doc(db, 'users', auth.currentUser.uid, 'data', 'appState');
      const docSnap = await getDoc(userDoc);

      if (!docSnap.exists()) {
        return {
          success: false,
          message: 'Data not found in Firestore'
        };
      }

      const firestoreData = docSnap.data();
      const firestorePlayer = firestoreData.players?.[0];

      if (firestorePlayer?.execSkillRating !== 8.5) {
        return {
          success: false,
          message: `Firestore execSkillRating mismatch: expected 8.5, got ${firestorePlayer?.execSkillRating}`
        };
      }

      return {
        success: true,
        message: '✅ Firebase integration working correctly! execSkillRating is being saved and loaded properly.'
      };

    } catch (error) {
      return {
        success: false,
        message: `Error during test: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Run comprehensive tests
   */
  async runAllTests(): Promise<TestResult[]> {
    this.results = [];

    // Test authentication
    await this.testAuthentication();

    // Test execSkillRating persistence
    await this.testExecSkillRating();

    // Test null value handling
    await this.testNullValueHandling();

    // Test roster persistence
    await this.testRosterPersistence();

    // Test data structure integrity
    await this.testDataStructure();

    return this.results;
  }

  private async testAuthentication(): Promise<void> {
    try {
      const user = auth.currentUser;
      this.results.push({
        name: 'Authentication',
        passed: !!user,
        message: user ? `Authenticated as ${user.uid}` : 'Not authenticated',
        details: { userId: user?.uid }
      });
    } catch (error) {
      this.results.push({
        name: 'Authentication',
        passed: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown'}`
      });
    }
  }

  private async testExecSkillRating(): Promise<void> {
    if (!auth.currentUser) {
      this.results.push({
        name: 'ExecSkillRating Persistence',
        passed: false,
        message: 'Skipped - not authenticated'
      });
      return;
    }

    try {
      const testPlayer: Player = {
        id: 'exec-test-1',
        name: 'Exec Test Player',
        gender: 'F',
        skillRating: 6,
        execSkillRating: 7.5,
        teammateRequests: [],
        avoidRequests: []
      };

      const state: AppState = {
        players: [testPlayer],
        teams: [],
        unassignedPlayers: [],
        playerGroups: [],
        config: {
          id: 'test',
          name: 'Test',
          maxTeamSize: 10,
          minFemales: 2,
          minMales: 2,
          allowMixedGender: true
        },
        execRatingHistory: {},
        savedConfigs: []
      };

      await dataStorageService.save(state);
      const loaded = await dataStorageService.load();
      const loadedPlayer = loaded?.players.find(p => p.id === 'exec-test-1');

      this.results.push({
        name: 'ExecSkillRating Persistence',
        passed: loadedPlayer?.execSkillRating === 7.5,
        message: loadedPlayer?.execSkillRating === 7.5
          ? 'ExecSkillRating persisted correctly'
          : `Failed: expected 7.5, got ${loadedPlayer?.execSkillRating}`,
        details: { saved: 7.5, loaded: loadedPlayer?.execSkillRating }
      });
    } catch (error) {
      this.results.push({
        name: 'ExecSkillRating Persistence',
        passed: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown'}`
      });
    }
  }

  private async testNullValueHandling(): Promise<void> {
    if (!auth.currentUser) {
      this.results.push({
        name: 'Null Value Handling',
        passed: false,
        message: 'Skipped - not authenticated'
      });
      return;
    }

    try {
      const testPlayer: Player = {
        id: 'null-test-1',
        name: 'Null Test Player',
        gender: 'Other',
        skillRating: 5,
        execSkillRating: null,  // Testing null value
        teammateRequests: [],
        avoidRequests: []
      };

      const state: AppState = {
        players: [testPlayer],
        teams: [],
        unassignedPlayers: [],
        playerGroups: [],
        config: {
          id: 'test',
          name: 'Test',
          maxTeamSize: 10,
          minFemales: 2,
          minMales: 2,
          allowMixedGender: true
        },
        execRatingHistory: {},
        savedConfigs: []
      };

      await dataStorageService.save(state);
      const loaded = await dataStorageService.load();
      const loadedPlayer = loaded?.players.find(p => p.id === 'null-test-1');

      this.results.push({
        name: 'Null Value Handling',
        passed: loadedPlayer?.execSkillRating === null,
        message: loadedPlayer?.execSkillRating === null
          ? 'Null values handled correctly'
          : `Failed: expected null, got ${loadedPlayer?.execSkillRating}`,
        details: { saved: null, loaded: loadedPlayer?.execSkillRating }
      });
    } catch (error) {
      this.results.push({
        name: 'Null Value Handling',
        passed: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown'}`
      });
    }
  }

  private async testRosterPersistence(): Promise<void> {
    if (!auth.currentUser) {
      this.results.push({
        name: 'Roster Persistence',
        passed: false,
        message: 'Skipped - not authenticated'
      });
      return;
    }

    try {
      const testRoster: Player[] = [
        {
          id: 'roster-1',
          name: 'Alice',
          gender: 'F',
          skillRating: 8,
          execSkillRating: 7,
          teammateRequests: ['Bob'],
          avoidRequests: [],
          email: 'alice@test.com'
        },
        {
          id: 'roster-2',
          name: 'Bob',
          gender: 'M',
          skillRating: 6,
          execSkillRating: null,
          teammateRequests: ['Alice'],
          avoidRequests: ['Charlie']
        },
        {
          id: 'roster-3',
          name: 'Charlie',
          gender: 'Other',
          skillRating: 7,
          execSkillRating: 9,
          teammateRequests: [],
          avoidRequests: ['Bob']
        }
      ];

      const state: AppState = {
        players: testRoster,
        teams: [],
        unassignedPlayers: [],
        playerGroups: [],
        config: {
          id: 'test',
          name: 'Test',
          maxTeamSize: 10,
          minFemales: 2,
          minMales: 2,
          allowMixedGender: true
        },
        execRatingHistory: {},
        savedConfigs: []
      };

      await dataStorageService.save(state);
      const loaded = await dataStorageService.load();

      const allFieldsPreserved =
        loaded?.players.length === 3 &&
        loaded.players[0].execSkillRating === 7 &&
        loaded.players[1].execSkillRating === null &&
        loaded.players[2].execSkillRating === 9 &&
        loaded.players[0].email === 'alice@test.com' &&
        loaded.players[1].avoidRequests.includes('Charlie');

      this.results.push({
        name: 'Roster Persistence',
        passed: allFieldsPreserved,
        message: allFieldsPreserved
          ? 'Full roster with all fields persisted correctly'
          : 'Some roster fields were not preserved',
        details: {
          savedCount: 3,
          loadedCount: loaded?.players.length,
          execRatingsPreserved: loaded?.players.map(p => p.execSkillRating)
        }
      });
    } catch (error) {
      this.results.push({
        name: 'Roster Persistence',
        passed: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown'}`
      });
    }
  }

  private async testDataStructure(): Promise<void> {
    if (!auth.currentUser) {
      this.results.push({
        name: 'Data Structure Integrity',
        passed: false,
        message: 'Skipped - not authenticated'
      });
      return;
    }

    try {
      const userDoc = doc(db, 'users', auth.currentUser.uid, 'data', 'appState');
      const docSnap = await getDoc(userDoc);

      if (!docSnap.exists()) {
        this.results.push({
          name: 'Data Structure Integrity',
          passed: false,
          message: 'No data found in Firestore'
        });
        return;
      }

      const data = docSnap.data();
      const hasRequiredFields =
        Array.isArray(data.players) &&
        Array.isArray(data.teams) &&
        Array.isArray(data.unassignedPlayers) &&
        Array.isArray(data.playerGroups) &&
        data.config &&
        Array.isArray(data.savedConfigs);

      this.results.push({
        name: 'Data Structure Integrity',
        passed: hasRequiredFields,
        message: hasRequiredFields
          ? 'Firestore data structure is correct'
          : 'Missing required fields in Firestore',
        details: {
          hasPlayers: Array.isArray(data.players),
          hasTeams: Array.isArray(data.teams),
          hasConfig: !!data.config,
          lastUpdated: data.lastUpdated
        }
      });
    } catch (error) {
      this.results.push({
        name: 'Data Structure Integrity',
        passed: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown'}`
      });
    }
  }

  /**
   * Format results for console output
   */
  formatResults(results: TestResult[]): string {
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    const percentage = total > 0 ? Math.round((passed / total) * 100) : 0;

    let output = '\n🧪 Firebase Integration Test Results\n';
    output += '=====================================\n\n';

    results.forEach(result => {
      const icon = result.passed ? '✅' : '❌';
      output += `${icon} ${result.name}\n`;
      output += `   ${result.message}\n`;
      if (result.details) {
        output += `   Details: ${JSON.stringify(result.details, null, 2).replace(/\n/g, '\n   ')}\n`;
      }
      output += '\n';
    });

    output += '=====================================\n';
    output += `Summary: ${passed}/${total} tests passed (${percentage}%)\n`;

    if (percentage === 100) {
      output += '🎉 All tests passed! Firebase integration is working correctly.\n';
    } else if (percentage >= 80) {
      output += '⚠️  Most tests passed, but some issues need attention.\n';
    } else {
      output += '❌ Multiple test failures detected. Please review Firebase configuration.\n';
    }

    return output;
  }
}

// Make available globally for console access
if (typeof window !== 'undefined') {
  (window as any).FirebaseTestRunner = FirebaseTestRunner;
  (window as any).testFirebase = async () => {
    const runner = new FirebaseTestRunner();
    const result = await runner.runQuickTest();
    console.log(result.message);
    return result;
  };
  (window as any).testFirebaseAll = async () => {
    const runner = new FirebaseTestRunner();
    const results = await runner.runAllTests();
    console.log(runner.formatResults(results));
    return results;
  };

  console.log('🧪 Firebase Test Runner loaded!');
  console.log('   Quick test: window.testFirebase()');
  console.log('   Full tests: window.testFirebaseAll()');
}

export default FirebaseTestRunner;
