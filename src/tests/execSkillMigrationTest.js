// Critical test for exec skill rating data migration edge case
// This tests what happens when existing users load data without execSkillRating properties

console.log('🧪 Starting Exec Skill Rating Migration Test...');

// Test function to simulate the team generation algorithm's skill calculation
function getEffectiveSkill(player) {
    return player.execSkillRating !== null ? player.execSkillRating : player.skillRating;
}

// Test cases
const testCases = [
    {
        name: 'Legacy Player (undefined execSkillRating)',
        player: {
            id: '1',
            name: 'Alice Legacy',
            skillRating: 8,
            // execSkillRating is missing (undefined)
            gender: 'F',
            teammateRequests: [],
            avoidRequests: []
        }
    },
    {
        name: 'New Player (null execSkillRating)',
        player: {
            id: '2',
            name: 'Bob New',
            skillRating: 7,
            execSkillRating: null,
            gender: 'M',
            teammateRequests: [],
            avoidRequests: []
        }
    },
    {
        name: 'Exec Player (has execSkillRating)',
        player: {
            id: '3',
            name: 'Carol Exec',
            skillRating: 6,
            execSkillRating: 9,
            gender: 'F',
            teammateRequests: [],
            avoidRequests: []
        }
    }
];

// Run tests
console.log('\n📊 Test Results:');
console.log('='.repeat(80));

const results = testCases.map(testCase => {
    const player = testCase.player;
    const effectiveSkill = getEffectiveSkill(player);

    const result = {
        testName: testCase.name,
        playerName: player.name,
        skillRating: player.skillRating,
        execSkillRating: player.execSkillRating,
        effectiveSkill: effectiveSkill,
        isUndefined: player.execSkillRating === undefined,
        isNull: player.execSkillRating === null,
        notNullCheck: player.execSkillRating !== null,
        isValidSkill: typeof effectiveSkill === 'number' && !isNaN(effectiveSkill),
        hasIssue: effectiveSkill === undefined || isNaN(effectiveSkill)
    };

    console.log(`\n${testCase.name}:`);
    console.log(`  Player: ${result.playerName}`);
    console.log(`  skillRating: ${result.skillRating}`);
    console.log(`  execSkillRating: ${result.execSkillRating}`);
    console.log(`  execSkillRating === undefined: ${result.isUndefined}`);
    console.log(`  execSkillRating === null: ${result.isNull}`);
    console.log(`  execSkillRating !== null: ${result.notNullCheck}`);
    console.log(`  effectiveSkill: ${result.effectiveSkill}`);
    console.log(`  isValidSkill: ${result.isValidSkill}`);
    console.log(`  ❌ hasIssue: ${result.hasIssue}`);

    return result;
});

// Critical analysis
const legacyResult = results[0];
const criticalBug = legacyResult.notNullCheck === true && legacyResult.effectiveSkill === undefined;

console.log('\n🔍 Critical Analysis:');
console.log('='.repeat(80));
console.log(`Legacy player execSkillRating !== null: ${legacyResult.notNullCheck}`);
console.log(`Legacy player effective skill: ${legacyResult.effectiveSkill}`);
console.log(`Would algorithm use undefined skill?: ${criticalBug}`);

if (criticalBug) {
    console.log('\n🚨 CRITICAL BUG DETECTED!');
    console.log('The algorithm checks "!== null" but undefined !== null is true!');
    console.log('This means legacy data without execSkillRating would use undefined as skill rating!');
} else {
    console.log('\n✅ NO CRITICAL BUG DETECTED');
    console.log('The algorithm correctly handles legacy data.');
}

// Team generation simulation test
console.log('\n🏆 Team Generation Simulation:');
console.log('='.repeat(80));

const mixedPlayers = [
    // Legacy player
    { id: '1', name: 'Alice', skillRating: 8, gender: 'F', teammateRequests: [], avoidRequests: [] },
    // New player
    { id: '2', name: 'Bob', skillRating: 7, execSkillRating: null, gender: 'M', teammateRequests: [], avoidRequests: [] },
    // Exec player
    { id: '3', name: 'Carol', skillRating: 6, execSkillRating: 9, gender: 'F', teammateRequests: [], avoidRequests: [] },
    { id: '4', name: 'Dave', skillRating: 5, execSkillRating: 8, gender: 'M', teammateRequests: [], avoidRequests: [] }
];

console.log('Simulating team average calculation...');
mixedPlayers.forEach(player => {
    const effectiveSkill = player.execSkillRating !== null ? player.execSkillRating : player.skillRating;
    console.log(`${player.name}: skillRating=${player.skillRating}, execSkillRating=${player.execSkillRating}, effective=${effectiveSkill}`);
});

const totalSkill = mixedPlayers.reduce((sum, p) => {
    const skill = p.execSkillRating !== null ? p.execSkillRating : p.skillRating;
    return sum + skill;
}, 0);

const averageSkill = totalSkill / mixedPlayers.length;
console.log(`Total skill: ${totalSkill}, Average: ${averageSkill}`);
console.log(`Average calculation successful: ${!isNaN(averageSkill) && typeof averageSkill === 'number'}`);

// Final verdict
console.log('\n🎯 FINAL VERDICT:');
console.log('='.repeat(80));
if (criticalBug) {
    console.log('❌ EXEC SKILL RATING HAS CRITICAL DATA MIGRATION BUG');
    console.log('Recommendation: Add proper undefined checks or data migration');
} else {
    console.log('✅ EXEC SKILL RATING HANDLES DATA MIGRATION CORRECTLY');
    console.log('The fallback logic properly handles legacy data');
}

// Export results for further analysis
window.execSkillTestResults = {
    criticalBug,
    results,
    mixedPlayersTest: { totalSkill, averageSkill, isValid: !isNaN(averageSkill) }
};

console.log('\n📝 Test results stored in window.execSkillTestResults');
console.log('🧪 Exec Skill Rating Migration Test Complete!');