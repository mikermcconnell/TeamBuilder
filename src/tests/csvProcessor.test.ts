import { describe, expect, it } from 'vitest';

import { parseCSV, validateAndProcessCSV } from '@/utils/csvProcessor';

describe('parseCSV', () => {
  it('preserves escaped quotes inside quoted cells', () => {
    const rows = parseCSV('Name,Note\n"Alice","He said ""hi"""');

    expect(rows).toEqual([
      {
        name: 'Alice',
        note: 'He said "hi"',
      },
    ]);
  });

  it('preserves multiline quoted cells', () => {
    const rows = parseCSV('Name,Notes\n"Alice","Line 1\nLine 2"');

    expect(rows[0]?.notes).toBe('Line 1\nLine 2');
  });

  it('keeps the new registration columns available in the parsed row data', () => {
    const rows = parseCSV([
      'first_name,last_name,age,"If_applicable,_what",Public_Disclosure_Pictures',
      'Kristy,Robinson,53,"played with dinosaurs",yes',
    ].join('\n'));

    expect(rows[0]).toMatchObject({
      first_name: 'Kristy',
      last_name: 'Robinson',
      age: '53',
      'if_applicable,_what': 'played with dinosaurs',
      public_disclosure_pictures: 'yes',
    });
  });
});

describe('validateAndProcessCSV registration imports', () => {
  it('accepts the updated Spring Outdoor registration shape with age and the extra free-text column', () => {
    const csv = [
      'first_name,last_name,gender,age,"Player_Request_#1:",Do_Not_Play,"Athletic ability",Throwing,"If_applicable,_what","knowledge/leadership",Handling,"Quality player",Public_Disclosure_Pictures,Captain,Other_Notes,Product Spring Outdoor 2026 Individual Registration',
      '"Kristy",Robinson,female,53,"Andy Beecroft",No,3,3,"played with dinosaurs",3,3,3,yes,"I do not mind. If a team is in need, I would be happy to help.","New player note",1',
      '"Andy",Beecroft,male,54,"Kristy Robinson",No,3,3,"same crew",3,3,3,yes,"I do not mind. If a team is in need, I would be happy to help.","Team note",1',
    ].join('\n');

    const result = validateAndProcessCSV(csv);

    expect(result.errors).toEqual([]);
    expect(result.isValid).toBe(true);
    expect(result.players).toHaveLength(2);
    expect(result.players[0]).toMatchObject({
      name: 'Kristy Robinson',
      age: 53,
      gender: 'F',
      skillRating: 6,
      teammateRequests: ['Andy Beecroft'],
      avoidRequests: [],
      registrationInfo: 'played with dinosaurs\n\nNew player note',
    });
    expect((result.players[0] as any).public_disclosure_pictures).toBeUndefined();
  });

  it('still parses older registration-style CSVs without the new columns', () => {
    const csv = [
      'first_name,last_name,gender,"Player_Request_#1:",Do_Not_Play,"Athletic ability",Throwing,"knowledge/leadership",Handling,"Quality player",Public_Disclosure_Pictures,Captain,Other_Notes,Product 2026 Winter Indoor League Individual Registration',
      'Jesse,Robertson,male,,No,3,3,3,3,3,yes,"I do not mind. If a team is in need, I would be happy to help.",,1',
    ].join('\n');

    const result = validateAndProcessCSV(csv);

    expect(result.errors).toEqual([]);
    expect(result.isValid).toBe(true);
    expect(result.players).toHaveLength(1);
    expect(result.players[0]).toMatchObject({
      name: 'Jesse Robertson',
      gender: 'M',
      skillRating: 6,
      teammateRequests: [],
      avoidRequests: [],
    });
  });
});
