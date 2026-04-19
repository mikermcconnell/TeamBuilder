import { describe, expect, it } from 'vitest';

import {
  createGeneratedWorkspaceFromCsvTexts,
  toFirestoreValue,
} from '../../scripts/publish-generated-workspace.mjs';
import { parseProjectBackup } from '@/utils/projectRecovery';

describe('publish-generated-workspace', () => {
  it('builds an importable workspace snapshot with mutual request groups', () => {
    const rosterCsv = [
      'status,first_name,last_name,gender,age,Player_Request_#1:,Do_Not_Play,Athletic ability,Throwing,"If_applicable,_what",knowledge/leadership,Handling,Quality player,Other_Notes',
      'accepted,Alice,Smith,female,29,Bob Jones,,4,4,,4,4,4,rookie',
      'accepted,Bob,Jones,male,31,Alice Smith,,3,3,,3,3,3,returning',
      'accepted,Carla,Ng,female,27,,,5,5,,5,5,5,',
    ].join('\n');

    const teamsCsv = [
      'Team,Name,Gender,Skill',
      'Team 1,Alice Smith,F,8.0',
      'Team 1,Bob Jones,M,6.0',
      'Team 2,Carla Ng,F,10.0',
    ].join('\n');

    const result = createGeneratedWorkspaceFromCsvTexts({
      rosterCsvText: rosterCsv,
      teamCsvText: teamsCsv,
      projectName: 'Spring Draft',
      userId: 'user-123',
      workspaceId: 'workspace-123',
    });

    expect(result.players).toHaveLength(3);
    expect(result.teams).toHaveLength(2);
    expect(result.playerGroups).toHaveLength(1);
    expect(result.playerGroups[0]?.playerIds).toHaveLength(2);
    expect(result.stats.mustHaveRequestsHonored).toBe(2);
    expect(result.stats.unassignedPlayers).toBe(0);
    expect(result.workspace.userId).toBe('user-123');
    expect(result.workspace.playerGroups).toHaveLength(1);
    expect(result.workspace.teamIterations?.[0]?.name).toBe('AI Draft 1');
    expect(result.backup.format).toBe('team-builder-project-backup');
    expect(result.backup.data.playerGroups).toHaveLength(1);

    const parsedBackup = parseProjectBackup(JSON.stringify(result.backup));
    expect(parsedBackup.data.players).toHaveLength(3);
    expect(parsedBackup.data.teamIterations?.[0]?.name).toBe('AI Draft 1');
  });

  it('serializes nested workspace data into Firestore REST field values', () => {
    expect(toFirestoreValue({
      title: 'Draft',
      version: 1,
      score: 7.5,
      published: true,
      notes: null,
      tags: ['spring', 'outdoor'],
      nested: {
        playerCount: 3,
      },
    })).toEqual({
      mapValue: {
        fields: {
          title: { stringValue: 'Draft' },
          version: { integerValue: '1' },
          score: { doubleValue: 7.5 },
          published: { booleanValue: true },
          notes: { nullValue: null },
          tags: {
            arrayValue: {
              values: [
                { stringValue: 'spring' },
                { stringValue: 'outdoor' },
              ],
            },
          },
          nested: {
            mapValue: {
              fields: {
                playerCount: { integerValue: '3' },
              },
            },
          },
        },
      },
    });
  });
});
