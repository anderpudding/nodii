import { readFileSync } from 'node:fs';
import { stdout } from 'node:process';
import { URL } from 'node:url';

const source = new URL('../docs/16-v3-moderation/', import.meta.url);

function readRows(filename, header) {
  const [actualHeader, ...lines] = readFileSync(new URL(filename, source), 'utf8')
    .trimEnd()
    .split(/\r?\n/);
  if (actualHeader !== header.join(',')) throw new Error(`Unexpected header in ${filename}`);

  return lines.map((line, index) => {
    const fields = Array.from(line.matchAll(/(?:^|,)(?:"((?:[^"]|"")*)"|([^",]*))(?=,|$)/g));
    if (fields.length !== header.length || fields.map(([part]) => part).join('') !== line)
      throw new Error(`Invalid CSV row in ${filename}:${index + 2}`);
    return fields.map(([, quoted, unquoted]) => quoted?.replaceAll('""', '"') ?? unquoted);
  });
}

function insert(table, columns, rows) {
  const values = rows.map(
    (row) => `  (${row.map((value) => `'${value.replaceAll("'", "''")}'`).join(', ')})`,
  );
  return `insert into public.${table} (${columns.join(', ')}) values\n${values.join(',\n')};`;
}

const reservedColumns = ['word'];
const bannedColumns = ['word', 'match', 'lang'];
const reserved = readRows('reserved-words.csv', reservedColumns);
const banned = readRows('banned-words.csv', bannedColumns);

stdout.write(
  [
    '-- scripts/moderation-to-sql.mjs로 생성. 원본은 docs/16-v3-moderation/의 CSV.',
    insert('reserved_words', reservedColumns, reserved),
    insert('banned_words', bannedColumns, banned),
    '',
  ].join('\n\n'),
);
