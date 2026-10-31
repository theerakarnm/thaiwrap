// Fetches the test corpora. Run once: node scripts/fetch-corpus.mjs
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "corpus");
const SHA = "c1d063649abc3a6870b5fd1aae26cd1c64bdde7b";
const BASE = `https://raw.githubusercontent.com/PyThaiNLP/wisesight-sentiment/${SHA}/`;
const UA = "thaiwrap-corpus/0.1 (https://github.com/theerakarnm/thaiwrap)";
const MIN_LEN = 40;

async function get(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res;
}

const HEADING = /^=+ .* =+$/;

const lines = (text) => text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== "");

async function wisesight() {
  const dir = join(root, "wisesight");
  await mkdir(dir, { recursive: true });
  const tokenisedFile = "word-tokenization/wisesight-1000-samples-tokenised.txt";
  const tokenised = lines(await (await get(BASE + tokenisedFile)).text());
  const neu = lines(await (await get(BASE + "neu.txt")).text())
    .filter((l) => l.length >= MIN_LEN)
    .slice(0, 500);
  await writeFile(join(dir, "lines.txt"), [...tokenised, ...neu].join("\n") + "\n");
  await writeFile(join(dir, "LICENSE"), await (await get(BASE + "LICENSE")).text());
  await writeFile(
    join(dir, "SOURCE.md"),
    [
      "# wisesight-sentiment",
      "",
      "Upstream: https://github.com/PyThaiNLP/wisesight-sentiment",
      `Commit: ${SHA}`,
      "License: CC0 1.0 (see LICENSE).",
      `Files: ${tokenisedFile}, neu.txt`,
      "Selection rule: every line of the tokenised file, then the first 500 lines of neu.txt whose UTF-16 length is at least 40.",
      "Each line is trimmed and empty lines are dropped. Nothing else is changed, including malformed input.",
      "",
    ].join("\n"),
  );
  return tokenised.length + neu.length;
}

const TITLES = [
  "ภาษาไทย", "อักษรไทย", "ประเทศไทย", "กรุงเทพมหานคร", "เชียงใหม่", "ภูเก็ต",
  "แม่น้ำเจ้าพระยา", "อาหารไทย", "ต้มยำ", "ข้าว", "มวยไทย", "สงกรานต์",
  "ดนตรีไทย", "ฟุตบอล", "ระบบสุริยะ", "คอมพิวเตอร์", "อินเทอร์เน็ต",
  "ปัญญาประดิษฐ์", "รถไฟฟ้าบีทีเอส", "เศรษฐกิจไทย",
];

async function wikipedia() {
  const dir = join(root, "wikipedia-th");
  await mkdir(dir, { recursive: true });
  const out = [];
  const attribution = [
    "# Attribution",
    "",
    "Excerpts from Thai Wikipedia (https://th.wikipedia.org) by Wikipedia contributors, licensed under CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/).",
    "Changes were made.",
    "Each article is the plain-text extract of the revision listed below, with markup, references, links and tables removed.",
    "From each extract, `lines.txt` keeps the first 10 paragraphs of at least 40 UTF-16 code units, after trimming each line and dropping section heading lines (`== ... ==`).",
    "The other files in this directory (`snapshot.txt`, `derived/`, `parity-known-diffs.json`) are adaptations of this text and are shared under CC BY-SA 4.0 too.",
    "",
  ];
  for (const title of TITLES) {
    const url =
      "https://th.wikipedia.org/w/api.php?action=query&prop=extracts%7Crevisions&explaintext=1&rvprop=ids&redirects=1&format=json&formatversion=2&titles=" +
      encodeURIComponent(title);
    const data = await (await get(url, { headers: { "User-Agent": UA } })).json();
    const page = data.query.pages[0];
    const revid = page.revisions[0].revid;
    const paragraphs = lines(page.extract)
      .filter((l) => !HEADING.test(l) && l.length >= MIN_LEN)
      .slice(0, 10);
    out.push(...paragraphs);
    const history = `https://th.wikipedia.org/w/index.php?title=${encodeURIComponent(page.title.replaceAll(" ", "_"))}&action=history`;
    attribution.push(
      `- ${page.title}: revision ${revid} (https://th.wikipedia.org/w/index.php?oldid=${revid}), authors in ${history}`,
    );
  }
  await writeFile(join(dir, "lines.txt"), out.join("\n") + "\n");
  await writeFile(join(dir, "ATTRIBUTION.md"), attribution.join("\n") + "\n");
  await writeFile(
    join(dir, "LICENSE"),
    [
      "Creative Commons Attribution-ShareAlike 4.0 International",
      "",
      "https://creativecommons.org/licenses/by-sa/4.0/legalcode",
      "",
    ].join("\n"),
  );
  return out.length;
}

console.log("wisesight lines:", await wisesight());
console.log("wikipedia-th lines:", await wikipedia());
