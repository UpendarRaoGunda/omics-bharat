import test from 'node:test';
import assert from 'node:assert/strict';
import { profileDelimited, summariseFasta, summariseVcf, validateMetadata } from '../src/parsers.js';

test('summariseFasta reports sequence lengths and GC', () => {
  const result = summariseFasta('>a\nACGTGCNN\n>b\nAAAA');
  assert.equal(result.sequenceCount, 2);
  assert.equal(result.totalLength, 12);
  assert.equal(result.n50, 8);
  assert.equal(result.moleculeType, 'nucleotide');
  assert.equal(result.gcPercent, 40);
});

test('summariseVcf counts variant classes and samples', () => {
  const input = [
    '##fileformat=VCFv4.2',
    '#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tS1',
    '1\t100\t.\tA\tG\t50\tPASS\t.\tGT\t0/1',
    '1\t101\t.\tA\tAT\t50\tPASS\t.\tGT\t./.',
    '2\t200\t.\tTC\tT\t50\tq10\t.\tGT\t1/1'
  ].join('\n');
  const result = summariseVcf(input);
  assert.equal(result.records, 3);
  assert.equal(result.sampleCount, 1);
  assert.equal(result.variantTypes.snv, 1);
  assert.equal(result.variantTypes.insertion, 1);
  assert.equal(result.variantTypes.deletion, 1);
  assert.equal(result.genotypeCallRatePercent, 66.67);
});

test('profileDelimited detects missing values and delimiter', () => {
  const result = profileDelimited('sample_id,age,state\nS1,34,Telangana\nS2,,Kerala');
  assert.equal(result.rowCount, 2);
  assert.equal(result.columnCount, 3);
  assert.equal(result.delimiter, ',');
  assert.equal(result.columns.find((column) => column.name === 'age').missingPercent, 50);
});

test('validateMetadata identifies missing required fields and privacy warning', () => {
  const result = validateMetadata({
    title: 'Demo',
    description: 'Participant phone 9876543210 from village X',
    organism: 'Homo sapiens',
    assay: 'RNA sequencing',
    sampleCount: 10,
    geography: 'Village X',
    consent: 'research use',
    dataAccess: 'controlled',
    contact: 'team@example.org'
  });
  assert.equal(result.score, 100);
  assert.ok(result.warnings.length >= 2);
});
