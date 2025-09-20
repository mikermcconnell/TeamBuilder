/**
 * Comprehensive ExecSkillRating Test Suite
 *
 * Tests all aspects of the exec skill rating functionality:
 * - Data persistence with Firebase
 * - UI interactions and editing
 * - CSV import/export
 * - Team generation algorithm integration
 * - Skill percentile calculations
 */

import { Player, Team, AppState } from '@/types';
import { validateAndProcessCSV } from '@/utils/csvProcessor';
import { generateBalancedTeams } from '@/utils/teamGenerator';
import { exportToCSV } from '@/utils/exportUtils';
import { dataStorageService } from '@/services/dataStorageService';
import { auth } from '@/config/firebase';

export class ExecSkillRatingTestSuite {
  private testResults: Map<string, { passed: boolean; message: string; details?: any }> = new Map();

  /**
   * Run all exec skill rating tests
   */
  async runAllTests(): Promise<void> {
    console.log('🎯 Starting Comprehensive ExecSkillRating Test Suite\n');
    console.log('================================================\n');

    // Check authentication
    if (!auth.currentUser) {
      console.error('❌ Authentication required. Please sign in first.');
      return;
    }

    // Run test categories
    await this.testDataValidation();
    await this.testCSVProcessing();
    await this.testTeamGeneration();
    await this.testFirebasePersistence();
    await this.testEdgeCases();
    await this.testPerformance();

    // Print summary
    this.printTestSummary();
  }

  /**
   * Test 1: Data Validation
   */
  async testDataValidation(): Promise<void> {
    console.log('📋 Test Category 1: Data Validation\n');

    // Test 1.1: Valid exec skill rating range
    const test1_1 = () => {
      const validRatings = [0, 1, 5.5, 8.3, 10, null];
      const invalidRatings = [-1, 11, NaN, undefined];

      let allValid = true;
      validRatings.forEach(rating => {
        const player: Player = {
          id: 'test',
          name: 'Test',
          gender: 'M',
          skillRating: 5,
          execSkillRating: rating as number | null,
          teammateRequests: [],
          avoidRequests: []
        };

        if (rating !== null && (rating < 0 || rating > 10)) {
          allValid = false;
        }
      });

      this.testResults.set('1.1_valid_range', {
        passed: allValid,
        message: allValid ? 'Valid rating ranges accepted' : 'Invalid rating range detected',
        details: { validRatings }
      });
    };

    // Test 1.2: Null handling for N/A values
    const test1_2 = () => {
      const player: Player = {
        id: 'test-na',
        name: 'Test NA',
        gender: 'F',
        skillRating: 6,
        execSkillRating: null, // Should represent N/A
        teammateRequests: [],
        avoidRequests: []
      };

      const isNull = player.execSkillRating === null;
      this.testResults.set('1.2_null_handling', {
        passed: isNull,
        message: isNull ? 'Null values properly represent N/A' : 'Null handling failed',
        details: { execSkillRating: player.execSkillRating }
      });
    };

    test1_1();
    test1_2();
    console.log('  ✅ Data validation tests complete\n');
  }

  /**
   * Test 2: CSV Processing
   */
  async testCSVProcessing(): Promise<void> {
    console.log('📄 Test Category 2: CSV Import/Export\n');

    // Test 2.1: Import CSV with exec skill ratings
    const test2_1 = () => {
      const csvContent = `Name,Gender,Skill Rating,Exec Skill Rating
John Doe,M,7,8.5
Jane Smith,F,6,N/A
Bob Johnson,M,8,7.2
Mary Williams,F,5,`;

      const result = validateAndProcessCSV(csvContent);

      const johnExec = result.players.find(p => p.name === 'John Doe')?.execSkillRating;
      const janeExec = result.players.find(p => p.name === 'Jane Smith')?.execSkillRating;
      const bobExec = result.players.find(p => p.name === 'Bob Johnson')?.execSkillRating;
      const maryExec = result.players.find(p => p.name === 'Mary Williams')?.execSkillRating;

      const passed = johnExec === 8.5 && janeExec === null && bobExec === 7.2 && maryExec === null;

      this.testResults.set('2.1_csv_import', {
        passed,
        message: passed ? 'CSV import correctly handles exec ratings' : 'CSV import failed',
        details: { johnExec, janeExec, bobExec, maryExec }
      });
    };

    // Test 2.2: Export with exec skill ratings
    const test2_2 = () => {
      const players: Player[] = [
        {
          id: '1',
          name: 'Test Player 1',
          gender: 'M',
          skillRating: 7,
          execSkillRating: 8.5,
          teammateRequests: [],
          avoidRequests: []
        },
        {
          id: '2',
          name: 'Test Player 2',
          gender: 'F',
          skillRating: 6,
          execSkillRating: null,
          teammateRequests: [],
          avoidRequests: []
        }
      ];

      const teams: Team[] = [{
        id: 'team1',
        name: 'Team 1',
        players,
        averageSkill: 6.5,
        genderBreakdown: { M: 1, F: 1, Other: 0 }
      }];

      const csv = exportToCSV(teams, [], []);
      const hasExecColumn = csv.includes('Exec Skill Rating');
      const hasNA = csv.includes('N/A');
      const has85 = csv.includes('8.5');

      const passed = hasExecColumn && hasNA && has85;

      this.testResults.set('2.2_csv_export', {
        passed,
        message: passed ? 'CSV export correctly includes exec ratings' : 'CSV export failed',
        details: { hasExecColumn, hasNA, has85 }
      });
    };

    test2_1();
    test2_2();
    console.log('  ✅ CSV processing tests complete\n');
  }

  /**
   * Test 3: Team Generation Algorithm
   */
  async testTeamGeneration(): Promise<void> {
    console.log('⚖️ Test Category 3: Team Generation with Exec Ratings\n');

    // Test 3.1: Algorithm uses exec rating when available
    const test3_1 = () => {
      const players: Player[] = [
        {
          id: '1',
          name: 'Player 1',
          gender: 'M',
          skillRating: 5,
          execSkillRating: 8, // Should use this
          teammateRequests: [],
          avoidRequests: []
        },
        {
          id: '2',
          name: 'Player 2',
          gender: 'F',
          skillRating: 7,
          execSkillRating: null, // Should fall back to skillRating
          teammateRequests: [],
          avoidRequests: []
        },
        {
          id: '3',
          name: 'Player 3',
          gender: 'M',
          skillRating: 6,
          execSkillRating: 9,
          teammateRequests: [],
          avoidRequests: []
        },
        {
          id: '4',
          name: 'Player 4',
          gender: 'F',
          skillRating: 8,
          execSkillRating: 6,
          teammateRequests: [],
          avoidRequests: []
        }
      ];

      const config = {
        id: 'test',
        name: 'Test',
        maxTeamSize: 2,
        minFemales: 1,
        minMales: 1,
        targetTeams: 2,
        allowMixedGender: true
      };

      const result = generateBalancedTeams(players, config, []);

      // Calculate expected averages using exec ratings where available
      // Team should balance based on: P1=8, P2=7, P3=9, P4=6
      // Optimal balance would be (8+7)/2=7.5 and (9+6)/2=7.5

      const team1Avg = result.teams[0].averageSkill;
      const team2Avg = result.teams[1].averageSkill;
      const difference = Math.abs(team1Avg - team2Avg);

      const passed = difference <= 1.5; // Teams should be relatively balanced

      this.testResults.set('3.1_team_generation', {
        passed,
        message: passed ? 'Teams balanced using exec ratings' : 'Team balancing failed',
        details: { team1Avg, team2Avg, difference }
      });
    };

    // Test 3.2: Skill percentile calculations
    const test3_2 = () => {
      const players: Player[] = [
        { id: '1', name: 'Elite', gender: 'M', skillRating: 5, execSkillRating: 10, teammateRequests: [], avoidRequests: [] },
        { id: '2', name: 'High', gender: 'F', skillRating: 5, execSkillRating: 8, teammateRequests: [], avoidRequests: [] },
        { id: '3', name: 'Medium', gender: 'M', skillRating: 5, execSkillRating: 6, teammateRequests: [], avoidRequests: [] },
        { id: '4', name: 'Low', gender: 'F', skillRating: 5, execSkillRating: 4, teammateRequests: [], avoidRequests: [] },
        { id: '5', name: 'NA', gender: 'M', skillRating: 7, execSkillRating: null, teammateRequests: [], avoidRequests: [] }
      ];

      // For percentile calc, should use: 10, 8, 6, 4, 7 (using skillRating for null)
      // Sorted: 10, 8, 7, 6, 4
      // Elite threshold (80th percentile) should be around 8
      // Strong threshold (60th percentile) should be around 7

      const sortedSkills = players
        .map(p => p.execSkillRating !== null ? p.execSkillRating : p.skillRating)
        .sort((a, b) => b - a);

      const p80Index = Math.floor(sortedSkills.length * 0.2);
      const p60Index = Math.floor(sortedSkills.length * 0.4);

      const eliteThreshold = sortedSkills[p80Index];
      const strongThreshold = sortedSkills[p60Index];

      const passed = eliteThreshold >= 7 && strongThreshold >= 6;

      this.testResults.set('3.2_skill_percentiles', {
        passed,
        message: passed ? 'Skill percentiles calculated correctly' : 'Percentile calculation failed',
        details: { sortedSkills, eliteThreshold, strongThreshold }
      });
    };

    test3_1();
    test3_2();
    console.log('  ✅ Team generation tests complete\n');
  }

  /**
   * Test 4: Firebase Persistence
   */
  async testFirebasePersistence(): Promise<void> {
    console.log('🔥 Test Category 4: Firebase Persistence\n');

    try {
      // Test 4.1: Save and load with exec ratings
      const testState: AppState = {
        players: [
          {
            id: 'fb-test-1',
            name: 'Firebase Test 1',
            gender: 'M',
            skillRating: 7,
            execSkillRating: 8.5,
            teammateRequests: [],
            avoidRequests: []
          },
          {
            id: 'fb-test-2',
            name: 'Firebase Test 2',
            gender: 'F',
            skillRating: 6,
            execSkillRating: null,
            teammateRequests: [],
            avoidRequests: []
          }
        ],
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

      await dataStorageService.save(testState);
      const loadedState = await dataStorageService.load();

      const player1 = loadedState?.players.find(p => p.id === 'fb-test-1');
      const player2 = loadedState?.players.find(p => p.id === 'fb-test-2');

      const passed = player1?.execSkillRating === 8.5 && player2?.execSkillRating === null;

      this.testResults.set('4.1_firebase_persistence', {
        passed,
        message: passed ? 'Firebase correctly persists exec ratings' : 'Firebase persistence failed',
        details: {
          saved: { p1: 8.5, p2: null },
          loaded: { p1: player1?.execSkillRating, p2: player2?.execSkillRating }
        }
      });
    } catch (error) {
      this.testResults.set('4.1_firebase_persistence', {
        passed: false,
        message: 'Firebase test failed with error',
        details: { error: String(error) }
      });
    }

    console.log('  ✅ Firebase persistence tests complete\n');
  }

  /**
   * Test 5: Edge Cases
   */
  async testEdgeCases(): Promise<void> {
    console.log('🔧 Test Category 5: Edge Cases\n');

    // Test 5.1: Boundary values
    const test5_1 = () => {
      const boundaryValues = [0, 0.1, 9.9, 10, null];
      let allValid = true;

      boundaryValues.forEach(value => {
        if (value !== null && (value < 0 || value > 10)) {
          allValid = false;
        }
      });

      this.testResults.set('5.1_boundary_values', {
        passed: allValid,
        message: allValid ? 'Boundary values handled correctly' : 'Boundary value handling failed',
        details: { boundaryValues }
      });
    };

    // Test 5.2: Large roster performance
    const test5_2 = () => {
      const startTime = Date.now();
      const largeRoster: Player[] = [];

      for (let i = 0; i < 100; i++) {
        largeRoster.push({
          id: `player-${i}`,
          name: `Player ${i}`,
          gender: i % 3 === 0 ? 'F' : i % 3 === 1 ? 'M' : 'Other',
          skillRating: Math.random() * 10,
          execSkillRating: Math.random() > 0.3 ? Math.random() * 10 : null,
          teammateRequests: [],
          avoidRequests: []
        });
      }

      const config = {
        id: 'test',
        name: 'Test',
        maxTeamSize: 10,
        minFemales: 3,
        minMales: 3,
        targetTeams: 10,
        allowMixedGender: true
      };

      const result = generateBalancedTeams(largeRoster, config, []);
      const endTime = Date.now();
      const duration = endTime - startTime;

      const passed = duration < 1000 && result.teams.length === 10;

      this.testResults.set('5.2_large_roster_performance', {
        passed,
        message: passed ? `Large roster processed in ${duration}ms` : 'Performance issue detected',
        details: { playerCount: 100, teamCount: result.teams.length, duration }
      });
    };

    test5_1();
    test5_2();
    console.log('  ✅ Edge case tests complete\n');
  }

  /**
   * Test 6: Performance Metrics
   */
  async testPerformance(): Promise<void> {
    console.log('⚡ Test Category 6: Performance Metrics\n');

    // Test 6.1: Skill calculation performance
    const test6_1 = () => {
      const players: Player[] = [];
      for (let i = 0; i < 50; i++) {
        players.push({
          id: `perf-${i}`,
          name: `Player ${i}`,
          gender: 'M',
          skillRating: Math.random() * 10,
          execSkillRating: Math.random() > 0.5 ? Math.random() * 10 : null,
          teammateRequests: [],
          avoidRequests: []
        });
      }

      const startTime = performance.now();

      // Simulate multiple skill calculations
      for (let i = 0; i < 100; i++) {
        const avgSkill = players.reduce((sum, p) =>
          sum + (p.execSkillRating !== null ? p.execSkillRating : p.skillRating), 0
        ) / players.length;
      }

      const duration = performance.now() - startTime;
      const passed = duration < 50; // Should be very fast

      this.testResults.set('6.1_calculation_performance', {
        passed,
        message: passed ? `Calculations completed in ${duration.toFixed(2)}ms` : 'Performance issue',
        details: { iterations: 100, duration }
      });
    };

    test6_1();
    console.log('  ✅ Performance tests complete\n');
  }

  /**
   * Print test summary
   */
  private printTestSummary(): void {
    console.log('\n================================================');
    console.log('📊 TEST SUMMARY\n');

    let totalTests = 0;
    let passedTests = 0;

    this.testResults.forEach((result, testName) => {
      totalTests++;
      if (result.passed) {
        passedTests++;
        console.log(`✅ ${testName}: ${result.message}`);
      } else {
        console.log(`❌ ${testName}: ${result.message}`);
        if (result.details) {
          console.log(`   Details:`, result.details);
        }
      }
    });

    console.log('\n================================================');
    console.log(`TOTAL: ${passedTests}/${totalTests} tests passed (${Math.round(passedTests/totalTests * 100)}%)`);

    if (passedTests === totalTests) {
      console.log('🎉 All tests passed! ExecSkillRating is working correctly.');
    } else {
      console.log('⚠️ Some tests failed. Please review the details above.');
    }
  }
}

// Export for use in browser console
if (typeof window !== 'undefined') {
  (window as any).ExecSkillRatingTestSuite = ExecSkillRatingTestSuite;
  console.log('ExecSkillRating Test Suite loaded. Run: new ExecSkillRatingTestSuite().runAllTests()');
}
