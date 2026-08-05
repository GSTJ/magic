/**
 * The mechanical half of the GSTJ README standard. Seven structural rules a
 * machine can judge honestly: hero placement, tagline, the npm badge, an
 * install heading, dashes, image srcs, and pinned versions in code blocks.
 * Prose quality is deliberately out of scope; a checker that grades writing
 * rejects good writing.
 */

/** Fence markers toggle; the marker lines themselves count as fenced. */
const FENCE = /^\s{0,3}(?:```|~~~)/;
const HEADING = /^#{1,6}\s/m;
const CENTERED = /<p align="center">(?<body>[\s\S]*?)<\/p>/g;
const HTML_IMG = /<img(?<attrs>[^>]*)>/g;
const IMG_SRC = /\ssrc="(?<src>[^"]*)"/;
const MD_IMAGE = /!\[[^\]]*\]\(\s*<?(?<src>[^)\s>]+)/g;
const SHIELDCN_NPM = "https://shieldcn.dev/npm/";
const DASH = /[–—]/;
/** `magic-theme@1.2.3`, `@scope/pkg@1.2.3`: a package-ish token pinned to x.y.z. */
const PINNED = /[a-z0-9@][\w.@/-]*@\d+\.\d+\.\d+[\w.+-]*/gi;
const ABSOLUTE = /^https?:\/\//;

/**
 * Whether an HTML fragment has a non-whitespace character outside its tags.
 * Track nested angle brackets so malformed markup cannot turn tag names into
 * text as a side effect of stripping an inner tag first.
 *
 * @param {string} html
 */
const hasText = (html) => {
  let depth = 0;
  let quote = null;

  for (const character of html) {
    if (depth === 0) {
      if (character === "<") depth = 1;
      else if (character.trim() !== "") return true;
    } else if (quote !== null) {
      if (character === quote) quote = null;
    } else if (character === '"' || character === "'") quote = character;
    else if (character === "<") depth += 1;
    else if (character === ">") depth -= 1;
  }

  return false;
};

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
    (body) => imageSrcs(body).length === 0 && hasText(body),
  );
  if (!tagline) {
    problems.push(
      'no tagline: a <p align="center"> block with plain text and no image must come before the first heading.',
    );
  }

  return problems;
};

/**
 * Rule 3: a published package links its own npm version badge. Badges are
 * marketing, so the standard asks for the one that answers "is this alive?"
 * and never for stars or a license. The root README has no npm page to point
 * at and is exempt: callers pass no `name` for it.
 *
 * @param {string} prose @param {string | null} name
 * @returns {string[]}
 */
const badgeProblems = (prose, name) => {
  if (!name) return [];
  const badge = `${SHIELDCN_NPM}${name}.svg`;
  const linked = imageSrcs(prose).some(({ src }) => src.startsWith(badge));
  return linked
    ? []
    : [
        `no npm version badge for ${name}; the hero needs an <img> src of ${badge}.`,
      ];
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
 * Rule 7: an exact version inside a code block. Install snippets get copied,
 * and `npm i magic-theme@1.2.3` is wrong the day after the next release. A
 * moving tag (`@v1`, `@2`) has no digits after the major and stays legal.
 *
 * @param {string[]} lines @param {boolean[]} fenced
 * @returns {string[]}
 */
const pinProblems = (lines, fenced) =>
  lines.flatMap((text, index) => {
    if (!fenced[index]) return [];
    return [...text.matchAll(PINNED)].map(
      (match) =>
        `line ${index + 1}: "${match[0]}" pins an exact version; drop it or use a moving tag like @v1.`,
    );
  });

/**
 * Check one README against the mechanical rules of the GSTJ standard.
 *
 * @param {string} markdown The README's full text.
 * @param {{ name?: string | null }} [options] The npm package name this README
 *   ships with. Omit it for the root README or any file with no npm page; the
 *   badge rule is skipped without one.
 * @returns {string[]} Problem sentences; empty when the file passes.
 */
export const validateReadme = (markdown, { name = null } = {}) => {
  const lines = markdown.split("\n");
  const fenced = fencedMask(lines);
  const prose = lines
    .map((text, index) => (fenced[index] ? "" : text))
    .join("\n");

  const problems = [...heroProblems(prose), ...badgeProblems(prose, name)];

  if (!/^## Install\s*$/m.test(prose)) {
    problems.push("no `## Install` heading.");
  }

  return [
    ...problems,
    ...dashProblems(lines, fenced),
    ...relativeSrcProblems(markdown),
    ...pinProblems(lines, fenced),
  ];
};
