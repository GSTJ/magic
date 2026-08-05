/**
 * The mechanical half of the GSTJ README standard. Six structural rules a
 * machine can judge honestly: hero placement, tagline, badges, an install
 * heading, dashes, and image srcs. Prose quality is deliberately out of scope;
 * a checker that grades writing rejects good writing.
 */

/** Fence markers toggle; the marker lines themselves count as fenced. */
const FENCE = /^\s{0,3}(?:```|~~~)/;
const HEADING = /^#{1,6}\s/m;
const CENTERED = /<p align="center">(?<body>[\s\S]*?)<\/p>/g;
const HTML_IMG = /<img(?<attrs>[^>]*)>/g;
const IMG_SRC = /\ssrc="(?<src>[^"]*)"/;
const MD_IMAGE = /!\[[^\]]*\]\(\s*<?(?<src>[^)\s>]+)/g;
const SHIELDCN = /<img[^>]*\ssrc="https:\/\/shieldcn\.dev\//;
const DASH = /[–—]/;
const ABSOLUTE = /^https?:\/\//;
const TAG = /<[^>]+>/g;

/**
 * One boolean per line: is this line inside (or part of) a fenced code block?
 *
 * @param {string[]} lines
 * @returns {boolean[]}
 */
const fencedMask = (lines) => {
  let open = false;
  return lines.map((text) => {
    if (FENCE.test(text)) {
      open = !open;
      return true;
    }
    return open;
  });
};

/**
 * 1-indexed line number of a character offset.
 *
 * @param {string} text @param {number} index
 */
const lineAt = (text, index) => text.slice(0, index).split("\n").length;

/**
 * `src` attributes of every `<img>` in a chunk of markdown, with offsets.
 *
 * @param {string} text
 * @returns {{ src: string, index: number }[]}
 */
const imageSrcs = (text) => {
  const html = [...text.matchAll(HTML_IMG)].flatMap((match) => {
    const src = IMG_SRC.exec(match.groups.attrs);
    return src ? [{ src: src.groups.src, index: match.index }] : [];
  });
  const markdown = [...text.matchAll(MD_IMAGE)].map((match) => ({
    src: match.groups.src,
    index: match.index,
  }));
  return [...html, ...markdown];
};

/**
 * Rules 1 and 2: the hero `<p align="center">` with an absolute https image,
 * and a centered text-only tagline, both before the first heading.
 *
 * @param {string} prose Markdown with fenced lines blanked out.
 * @returns {string[]}
 */
const heroProblems = (prose) => {
  const heading = HEADING.exec(prose);
  const prelude = heading ? prose.slice(0, heading.index) : prose;
  const blocks = [...prelude.matchAll(CENTERED)].map(
    (match) => match.groups.body,
  );

  // Badge rows are centered https images too; they don't count as the hero.
  const problems = [];
  const hero = blocks.some((body) =>
    imageSrcs(body).some(
      ({ src }) =>
        src.startsWith("https://") && !src.startsWith("https://shieldcn.dev/"),
    ),
  );
  if (!hero) {
    problems.push(
      'no hero: a <p align="center"> block whose <img> src is absolute https must come before the first heading.',
    );
  }

  const tagline = blocks.some(
    (body) => imageSrcs(body).length === 0 && body.replace(TAG, "").trim(),
  );
  if (!tagline) {
    problems.push(
      'no tagline: a <p align="center"> block with plain text and no image must come before the first heading.',
    );
  }

  return problems;
};

/**
 * Rule 5: em and en dashes outside fenced code blocks.
 *
 * @param {string[]} lines @param {boolean[]} fenced
 * @returns {string[]}
 */
const dashProblems = (lines, fenced) =>
  lines.flatMap((text, index) => {
    if (fenced[index] || !DASH.test(text)) return [];
    return [
      `line ${index + 1}: em/en dash outside a fenced code block; use a comma, period, or parentheses.`,
    ];
  });

/**
 * Rule 6: every image src, anywhere in the file, must be an absolute URL.
 * npm renders READMEs away from the repo, so a relative path 404s there.
 *
 * @param {string} markdown
 * @returns {string[]}
 */
const relativeSrcProblems = (markdown) =>
  imageSrcs(markdown).flatMap(({ src, index }) => {
    if (ABSOLUTE.test(src)) return [];
    return [
      `line ${lineAt(markdown, index)}: image src "${src}" is relative; use an absolute https URL so it renders on npm.`,
    ];
  });

/**
 * Check one README against the mechanical rules of the GSTJ standard.
 *
 * @param {string} markdown The README's full text.
 * @param {{ name?: string }} [options] The package name, for messages.
 * @returns {string[]} Problem sentences; empty when the file passes.
 */
export const validateReadme = (markdown, { name = "this package" } = {}) => {
  const lines = markdown.split("\n");
  const fenced = fencedMask(lines);
  const prose = lines
    .map((text, index) => (fenced[index] ? "" : text))
    .join("\n");

  const problems = [...heroProblems(prose)];

  if (!SHIELDCN.test(prose)) {
    problems.push(
      `no shieldcn.dev badge; the standard's hero links at least one for ${name}.`,
    );
  }
  if (!/^## Install\s*$/m.test(prose)) {
    problems.push("no `## Install` heading.");
  }

  return [
    ...problems,
    ...dashProblems(lines, fenced),
    ...relativeSrcProblems(markdown),
  ];
};
