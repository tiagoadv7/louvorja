// Converte os JSON de https://github.com/mrk214/bible-data-es-spa (pasta data/)
// para os arquivos locais que o app lê: es_bible_version.json, es_bible_book.json
// e bible_<id>_<livro>_<capitulo>.json. IDs de versão começam em 1001 pra não
// colidir com as versões do banco principal (1..9).
// Uso: node scripts/import-bible-es.js <pasta data/ do repo> <pasta db/ de destino>

const fs = require('fs');
const path = require('path');

const CANON = [
  'GEN', 'EXO', 'LEV', 'NUM', 'DEU', 'JOS', 'JDG', 'RUT', '1SA', '2SA', '1KI', '2KI',
  '1CH', '2CH', 'EZR', 'NEH', 'EST', 'JOB', 'PSA', 'PRO', 'ECC', 'SNG', 'ISA', 'JER',
  'LAM', 'EZK', 'DAN', 'HOS', 'JOL', 'AMO', 'OBA', 'JON', 'MIC', 'NAM', 'HAB', 'ZEP',
  'HAG', 'ZEC', 'MAL', 'MAT', 'MRK', 'LUK', 'JHN', 'ACT', 'ROM', '1CO', '2CO', 'GAL',
  'EPH', 'PHP', 'COL', '1TH', '2TH', '1TI', '2TI', 'TIT', 'PHM', 'HEB', 'JAS', '1PE',
  '2PE', '1JN', '2JN', '3JN', 'JUD', 'REV',
];
// Mesmas cores por livro usadas nos cards da Bíblia em português (bible_book.color).
const BOOK_COLORS = ["#01a2d9","#01a2d9","#01a2d9","#01a2d9","#01a2d9","#85b000","#85b000","#85b000","#85b000","#85b000","#85b000","#85b000","#85b000","#85b000","#85b000","#85b000","#85b000","#e18dff","#e18dff","#e18dff","#e18dff","#e18dff","#ff403f","#ff403f","#ff403f","#ff403f","#ff403f","#b18500","#b18500","#b18500","#b18500","#b18500","#b18500","#b18500","#b18500","#b18500","#b18500","#b18500","#b18500","#008c8d","#008c8d","#008c8d","#008c8d","#b265ff","#ff6766","#ff6766","#ff6766","#ff6766","#ff6766","#ff6766","#ff6766","#ff6766","#ff6766","#ff6766","#ff6766","#ff6766","#ff6766","#7497ff","#7497ff","#7497ff","#7497ff","#7497ff","#7497ff","#7497ff","#7497ff","#ffd140"];
const FIRST_VERSION_ID = 1001;

const [, , dataDir, outDir] = process.argv;
if (!dataDir || !outDir) {
  console.error('Uso: node scripts/import-bible-es.js <pasta data/ do repo> <pasta db/ de destino>');
  process.exit(1);
}

function listJsonFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listJsonFiles(full));
    else if (entry.name.endsWith('.json')) out.push(full);
  }
  return out.sort();
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function chapterNumber(usfm) {
  return Number(String(usfm).split('.').pop());
}

function versionAbbreviation(json, used) {
  const base = json.local_abbreviation || json.version_id;
  if (!used.has(base)) return base;
  return `${base}-${json.language?.iso_639_1?.toUpperCase() || 'X'}`;
}

fs.mkdirSync(outDir, { recursive: true });

const versions = [];
const bookNames = {};
const used = new Set();
const files = listJsonFiles(dataDir);

files.forEach((file, index) => {
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  const id = FIRST_VERSION_ID + index;
  const abbreviation = versionAbbreviation(json, used);
  used.add(abbreviation);
  versions.push({ id_bible_version: id, abbreviation, name: json.local_title || abbreviation, language: 'es' });

  let count = 0;
  for (const book of json.books) {
    const bookNumber = CANON.indexOf(book.usfm) + 1;
    if (bookNumber === 0) continue;
    if (!bookNames[bookNumber]) {
      bookNames[bookNumber] = {
        id_bible_book: bookNumber,
        name: book.human,
        abbreviation: book.usfm,
        color: BOOK_COLORS[bookNumber - 1],
        chapters: 0,
      };
    }
    bookNames[bookNumber].chapters = Math.max(bookNames[bookNumber].chapters, book.chapters.length);

    for (const chapter of book.chapters) {
      const chapterNo = chapterNumber(chapter.usfm);
      const verses = {};
      for (const item of chapter.items) {
        if (item.type !== 'verse' || !item.verse_numbers?.length) continue;
        const text = escapeHtml(item.lines.join(' '));
        verses[item.verse_numbers[0]] = text;
      }
      fs.writeFileSync(
        path.join(outDir, `bible_${id}_${bookNumber}_${chapterNo}.json`),
        JSON.stringify(verses),
        'utf8',
      );
      count++;
    }
  }
  console.log(`[${index + 1}/${files.length}] ${abbreviation} — ${count} capítulos`);
});

const books = Object.values(bookNames).sort((a, b) => a.id_bible_book - b.id_bible_book);
fs.writeFileSync(path.join(outDir, 'es_bible_version.json'), JSON.stringify(versions), 'utf8');
fs.writeFileSync(path.join(outDir, 'es_bible_book.json'), JSON.stringify(books), 'utf8');
console.log(`Pronto: ${versions.length} versões, ${books.length} livros em ${outDir}`);
