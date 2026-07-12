const DNA_ALPHABET = new Set('ACGTUNRYSWKMBDHV.-'.split(''));
const PROTEIN_ALPHABET = new Set('ABCDEFGHIKLMNPQRSTVWXYZJUO*-'.split(''));

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function n50(lengths) {
  if (!lengths.length) return 0;
  const sorted = [...lengths].sort((a, b) => b - a);
  const half = sorted.reduce((sum, value) => sum + value, 0) / 2;
  let cumulative = 0;
  for (const length of sorted) {
    cumulative += length;
    if (cumulative >= half) return length;
  }
  return 0;
}

export function summariseFasta(input) {
  if (typeof input !== 'string' || !input.trim()) {
    throw validationError('Paste a FASTA sequence or upload a FASTA text file.');
  }

  const lines = input.replace(/\r/g, '').split('\n');
  const records = [];
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith(';')) continue;
    if (line.startsWith('>')) {
      if (current) records.push(current);
      const header = line.slice(1).trim();
      current = { id: header.split(/\s+/)[0] || `sequence_${records.length + 1}`, description: header, sequence: '' };
      continue;
    }
    if (!current) {
      current = { id: 'sequence_1', description: 'Unlabelled sequence', sequence: '' };
    }
    current.sequence += line.replace(/\s+/g, '').toUpperCase();
  }
  if (current) records.push(current);

  const nonEmpty = records.filter((record) => record.sequence.length > 0);
  if (!nonEmpty.length) throw validationError('No sequence characters were found.');

  const combined = nonEmpty.map((record) => record.sequence).join('');
  const dnaMatches = [...combined].filter((character) => DNA_ALPHABET.has(character)).length;
  const proteinMatches = [...combined].filter((character) => PROTEIN_ALPHABET.has(character)).length;
  const moleculeType = dnaMatches / combined.length >= 0.9 ? 'nucleotide' : proteinMatches / combined.length >= 0.9 ? 'protein' : 'mixed_or_unknown';
  const validAlphabet = moleculeType === 'nucleotide' ? DNA_ALPHABET : PROTEIN_ALPHABET;
  const invalidCharacters = [...new Set([...combined].filter((character) => !validAlphabet.has(character)))];
  const lengths = nonEmpty.map((record) => record.sequence.length);
  const totalLength = lengths.reduce((sum, value) => sum + value, 0);

  let gcPercent = null;
  let ambiguousPercent = null;
  if (moleculeType === 'nucleotide') {
    const canonical = [...combined].filter((character) => 'ACGT'.includes(character));
    const gc = canonical.filter((character) => character === 'G' || character === 'C').length;
    gcPercent = canonical.length ? round((gc / canonical.length) * 100) : 0;
    const ambiguous = [...combined].filter((character) => !'ACGT.-'.includes(character)).length;
    ambiguousPercent = round((ambiguous / combined.length) * 100);
  }

  return {
    format: 'FASTA',
    sequenceCount: nonEmpty.length,
    moleculeType,
    totalLength,
    minimumLength: Math.min(...lengths),
    maximumLength: Math.max(...lengths),
    meanLength: round(totalLength / lengths.length),
    n50: n50(lengths),
    gcPercent,
    ambiguousPercent,
    invalidCharacters,
    records: nonEmpty.slice(0, 20).map((record) => ({
      id: record.id,
      description: record.description,
      length: record.sequence.length
    })),
    warnings: [
      ...(invalidCharacters.length ? [`Unexpected characters: ${invalidCharacters.join(', ')}`] : []),
      ...(records.length > 20 ? ['Only the first 20 record summaries are shown.'] : [])
    ]
  };
}

const TRANSITIONS = new Set(['A>G', 'G>A', 'C>T', 'T>C']);

export function summariseVcf(input) {
  if (typeof input !== 'string' || !input.trim()) {
    throw validationError('Paste VCF content or upload a VCF text file.');
  }

  const lines = input.replace(/\r/g, '').split('\n');
  const meta = [];
  let header = null;
  const chromosomes = new Map();
  const filters = new Map();
  const variantTypes = { snv: 0, insertion: 0, deletion: 0, mnv: 0, symbolic: 0, other: 0 };
  let records = 0;
  let multiallelic = 0;
  let transitions = 0;
  let transversions = 0;
  let calledGenotypes = 0;
  let missingGenotypes = 0;
  const problems = [];

  for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
    const line = lines[lineNumber].trim();
    if (!line) continue;
    if (line.startsWith('##')) {
      meta.push(line);
      continue;
    }
    if (line.startsWith('#CHROM')) {
      header = line.split('\t');
      continue;
    }
    if (line.startsWith('#')) continue;

    const columns = line.split('\t');
    if (columns.length < 8) {
      if (problems.length < 10) problems.push(`Line ${lineNumber + 1}: expected at least 8 tab-separated columns.`);
      continue;
    }

    records += 1;
    const [chrom, , , ref, altText, , filter] = columns;
    chromosomes.set(chrom, (chromosomes.get(chrom) || 0) + 1);
    filters.set(filter || '.', (filters.get(filter || '.') || 0) + 1);
    const alternatives = altText.split(',');
    if (alternatives.length > 1) multiallelic += 1;

    for (const alt of alternatives) {
      if (alt.startsWith('<') || alt.includes('[') || alt.includes(']') || alt === '*') {
        variantTypes.symbolic += 1;
      } else if (ref.length === 1 && alt.length === 1) {
        variantTypes.snv += 1;
        const change = `${ref.toUpperCase()}>${alt.toUpperCase()}`;
        if (TRANSITIONS.has(change)) transitions += 1;
        else if ('ACGT'.includes(ref.toUpperCase()) && 'ACGT'.includes(alt.toUpperCase())) transversions += 1;
      } else if (ref.length < alt.length && alt.startsWith(ref)) {
        variantTypes.insertion += 1;
      } else if (ref.length > alt.length && ref.startsWith(alt)) {
        variantTypes.deletion += 1;
      } else if (ref.length === alt.length) {
        variantTypes.mnv += 1;
      } else {
        variantTypes.other += 1;
      }
    }

    if (columns.length > 9) {
      const format = columns[8].split(':');
      const gtIndex = format.indexOf('GT');
      if (gtIndex >= 0) {
        for (const sample of columns.slice(9)) {
          const gt = sample.split(':')[gtIndex] || '.';
          if (gt === '.' || gt === './.' || gt === '.|.') missingGenotypes += 1;
          else calledGenotypes += 1;
        }
      }
    }
  }

  if (!header) problems.unshift('The #CHROM header line was not found.');
  if (!records) throw validationError('No valid VCF records were found.');

  const genotypeTotal = calledGenotypes + missingGenotypes;
  return {
    format: 'VCF',
    version: meta.find((line) => line.startsWith('##fileformat='))?.split('=')[1] || 'unknown',
    records,
    sampleCount: header ? Math.max(0, header.length - 9) : 0,
    contigCount: meta.filter((line) => line.startsWith('##contig=')).length,
    chromosomeCounts: Object.fromEntries([...chromosomes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30)),
    filterCounts: Object.fromEntries([...filters.entries()].sort((a, b) => b[1] - a[1])),
    variantTypes,
    multiallelicRecords: multiallelic,
    transitionTransversionRatio: transversions ? round(transitions / transversions, 3) : null,
    genotypeCallRatePercent: genotypeTotal ? round((calledGenotypes / genotypeTotal) * 100) : null,
    problems,
    notes: [
      'This is a structural QC summary, not clinical variant interpretation.',
      'Large files should be validated with established command-line tools such as bcftools.'
    ]
  };
}

function detectDelimiter(firstLine) {
  const candidates = [',', '\t', ';', '|'];
  return candidates
    .map((delimiter) => ({ delimiter, count: firstLine.split(delimiter).length - 1 }))
    .sort((a, b) => b.count - a.count)[0]?.delimiter || ',';
}

function parseDelimitedLine(line, delimiter) {
  const cells = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      cells.push(current);
      current = '';
    } else {
      current += character;
    }
  }
  cells.push(current);
  return cells;
}

function inferType(values) {
  const nonEmpty = values.filter((value) => String(value).trim() !== '');
  if (!nonEmpty.length) return 'empty';
  const booleans = new Set(['true', 'false', 'yes', 'no', '0', '1']);
  if (nonEmpty.every((value) => booleans.has(String(value).trim().toLowerCase()))) return 'boolean';
  if (nonEmpty.every((value) => Number.isFinite(Number(String(value).trim())))) return 'number';
  if (nonEmpty.every((value) => !Number.isNaN(Date.parse(String(value).trim())))) return 'date';
  const uniqueRatio = new Set(nonEmpty).size / nonEmpty.length;
  if (uniqueRatio <= 0.2 && nonEmpty.length >= 5) return 'category';
  return 'text';
}

export function profileDelimited(input) {
  if (typeof input !== 'string' || !input.trim()) {
    throw validationError('Paste CSV/TSV content or upload a delimited text file.');
  }
  const lines = input.replace(/\r/g, '').split('\n').filter((line) => line.trim() !== '');
  if (lines.length < 2) throw validationError('The table needs a header row and at least one data row.');
  const delimiter = detectDelimiter(lines[0]);
  const header = parseDelimitedLine(lines[0], delimiter).map((value, index) => value.trim() || `column_${index + 1}`);
  const rows = lines.slice(1).map((line) => parseDelimitedLine(line, delimiter));
  const inconsistentRows = [];
  rows.forEach((row, index) => {
    if (row.length !== header.length && inconsistentRows.length < 20) inconsistentRows.push(index + 2);
  });

  const columns = header.map((name, columnIndex) => {
    const values = rows.map((row) => row[columnIndex] ?? '');
    const missing = values.filter((value) => String(value).trim() === '' || ['na', 'n/a', 'null', '.'].includes(String(value).trim().toLowerCase())).length;
    const nonMissing = values.filter((value) => String(value).trim() !== '');
    return {
      name,
      inferredType: inferType(nonMissing.slice(0, 1000)),
      missing,
      missingPercent: round((missing / rows.length) * 100),
      uniqueValues: new Set(nonMissing).size,
      examples: [...new Set(nonMissing)].slice(0, 3)
    };
  });

  return {
    format: delimiter === '\t' ? 'TSV' : 'CSV/delimited',
    delimiter: delimiter === '\t' ? 'tab' : delimiter,
    rowCount: rows.length,
    columnCount: header.length,
    duplicateHeaderNames: header.filter((name, index) => header.indexOf(name) !== index),
    inconsistentRows,
    columns,
    recommendations: [
      ...(inconsistentRows.length ? ['Fix rows with a different number of fields before analysis.'] : []),
      ...(columns.some((column) => column.missingPercent > 30) ? ['Document columns with more than 30% missing values.'] : []),
      'Use non-identifying sample IDs and keep the re-identification key outside analysis files.'
    ]
  };
}

const REQUIRED_METADATA = [
  ['title', 'A concise study title'],
  ['description', 'A plain-language study description'],
  ['organism', 'Organism or taxon'],
  ['assay', 'Assay or omics technology'],
  ['sampleCount', 'Number of samples'],
  ['geography', 'Geographic scope at an appropriate level'],
  ['consent', 'Consent and permitted data uses'],
  ['dataAccess', 'Open, registered or controlled access'],
  ['contact', 'Responsible contact or help desk']
];

export function validateMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw validationError('Metadata must be a JSON object.');
  }

  const checks = REQUIRED_METADATA.map(([field, label]) => {
    const value = metadata[field];
    const valid = value !== undefined && value !== null && String(value).trim() !== '';
    return { field, label, valid, value: valid ? value : null };
  });

  const warnings = [];
  const geography = String(metadata.geography || '').toLowerCase();
  const description = String(metadata.description || '').toLowerCase();
  const contact = String(metadata.contact || '');
  const sensitivePatterns = [/\b\d{6}\b/, /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i, /\b\d{10}\b/];

  if (sensitivePatterns.some((pattern) => pattern.test(description))) {
    warnings.push('The description may contain direct identifiers. Remove phone numbers, email addresses, postal codes and participant-level details.');
  }
  if (geography.includes('village') || geography.includes('ward') || geography.includes('street')) {
    warnings.push('Fine-grained geography can increase re-identification risk. Use the minimum geographic detail needed for the research purpose.');
  }
  if (contact && !contact.includes('@') && !/^https?:\/\//i.test(contact)) {
    warnings.push('Provide an institutional email address or a stable contact page rather than a personal phone number.');
  }
  if (Number(metadata.sampleCount) <= 0 || !Number.isFinite(Number(metadata.sampleCount))) {
    warnings.push('sampleCount should be a positive number.');
  }
  if (!metadata.referenceGenome && String(metadata.assay || '').toLowerCase().match(/sequenc|wgs|wes|rna/)) {
    warnings.push('Add the reference genome/build or transcriptome version used for sequence-based analysis.');
  }
  if (!metadata.ethicsApproval && String(metadata.organism || '').toLowerCase().includes('human')) {
    warnings.push('Human-participant studies should document ethics review or explain why it is not applicable.');
  }
  if (!metadata.dataUseLimitations && String(metadata.dataAccess || '').toLowerCase().includes('controlled')) {
    warnings.push('Controlled-access data should include clear data-use limitations and an access-request process.');
  }

  const passed = checks.filter((check) => check.valid).length;
  return {
    score: Math.round((passed / checks.length) * 100),
    passed,
    total: checks.length,
    checks,
    warnings,
    suggestedFields: [
      'studyId',
      'funding',
      'ethicsApproval',
      'referenceGenome',
      'sampleCollectionDates',
      'inclusionCriteria',
      'exclusionCriteria',
      'dataUseLimitations',
      'license',
      'relatedPublication',
      'checksum'
    ],
    disclaimer: 'This checklist supports metadata quality; it does not certify ethics, privacy, legal or repository compliance.'
  };
}

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}
