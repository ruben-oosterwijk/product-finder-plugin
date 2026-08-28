#!/usr/bin/env node
/**
 * Guided product identification over a faceted catalogue.
 *
 * The language model never picks the product. It reads text and proposes facet
 * VALUES; this filter picks the product and reports which facet best splits
 * whatever is left. That separation is the whole point — it is what makes the
 * answer auditable rather than plausible, which matters as soon as a wrong
 * value has consequences.
 *
 * The mechanism is catalogue-agnostic. A dataset is four JSON files in
 * datasets/<name>/ (see datasets/README.md); nothing about this file knows what
 * it is selecting.
 *
 *   node resolve.mjs '{"category":"shackles","wll_t":30}'
 *   node resolve.mjs --datasets                list available datasets
 *   node resolve.mjs --facets                  the facet registry (the questions)
 *   node resolve.mjs --families                every family with its application text
 *   node resolve.mjs --family H10              one family in detail
 *   node resolve.mjs --dataset gn '{"...":1}'  choose a dataset explicitly
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DATASETS = join(ROOT, 'datasets');

const argv = process.argv.slice(2);
function takeFlag(name) {
  const i = argv.indexOf(name);
  if (i === -1) return null;
  const v = argv[i + 1];
  argv.splice(i, v ? 2 : 1);
  return v ?? true;
}

const listDatasets = () =>
  existsSync(DATASETS)
    ? readdirSync(DATASETS, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name)
    : [];

const wantDatasets = argv.includes('--datasets');
const explicit = takeFlag('--dataset');
const available = listDatasets();

if (wantDatasets) {
  console.log(JSON.stringify({ datasets: available }, null, 2));
  process.exit(0);
}

const dataset = explicit ?? process.env.PRODUCT_FINDER_DATASET ?? available[0];
if (!dataset || !available.includes(dataset)) {
  console.error(
    `Unknown dataset ${dataset ? `"${dataset}"` : '(none given)'}. Available: ${available.join(', ') || 'none — see datasets/README.md'}`
  );
  process.exit(1);
}

const DIR = join(DATASETS, dataset);
const read = f => JSON.parse(readFileSync(join(DIR, f), 'utf8'));
const skus = read('skus.json');
const facets = read('facets.json');
const families = read('families.json');

const NUMERIC = new Set(facets.filter(f => f.type === 'number').map(f => f.key));
const isExact = v => typeof v === 'object' && v !== null && 'eq' in v;
const labelOf = k => facets.find(f => f.key === k)?.label ?? k;

/** Narrow the catalogue to everything still satisfying every answered facet. */
export function filter(answers) {
  const trace = [];
  let set = skus;

  for (const [key, raw] of Object.entries(answers)) {
    if (raw === null || raw === undefined || raw === '') continue;
    const before = set.length;

    if (NUMERIC.has(key)) {
      if (isExact(raw)) {
        set = set.filter(s => s[key] === raw.eq);
        trace.push({ key, label: labelOf(key), value: `= ${raw.eq}`, before, after: set.length });
        continue;
      }
      // A stated capacity is a MINIMUM. Narrowing straight to the nearest single
      // rating would discard a type whose next size up is a better fit.
      const want = Number(raw);
      const exact = set.filter(s => s[key] === want).length;
      set = set.filter(s => typeof s[key] === 'number' && s[key] >= want);
      trace.push({
        key, label: labelOf(key), value: `>= ${want}`, before, after: set.length,
        note: set.length === 0
          ? `nothing meets ${want} — out of range`
          : exact ? `${exact} exact match(es)`
          : `no exact match; smallest adequate is ${Math.min(...set.map(s => s[key]))}`,
      });
      continue;
    }

    const want = String(raw).toLowerCase();
    set = set.filter(s => String(s[key] ?? '').toLowerCase() === want);
    trace.push({ key, label: labelOf(key), value: String(raw), before, after: set.length });
  }
  return { set, trace };
}

/**
 * Which unanswered facet best splits what is left?
 *
 * Application-layer facets come first — settle WHAT KIND before asking for a
 * size. Within a layer, `ask_priority` sequences the funnel and entropy decides
 * between facets of equal rank. A facet that cannot discriminate is skipped, so
 * the questionnaire never asks something pointless.
 */
export function nextQuestion(set, answers, skipped = []) {
  const isSkipped = new Set(skipped);
  const pick = pool => {
    for (const rank of [...new Set(pool.map(f => f.ask_priority))].sort((a, b) => a - b)) {
      const q = bestOf(pool.filter(f => f.ask_priority === rank));
      if (q) return q;
    }
    return null;
  };
  return pick(facets.filter(f => f.layer === 'application'))
      ?? pick(facets.filter(f => f.layer === 'product'));

  function bestOf(pool) {
    let best = null;
    for (const f of pool) {
      if (isSkipped.has(f.key)) continue;
      const answered = f.key in answers;
      const refining = answered && NUMERIC.has(f.key) && !isExact(answers[f.key]);
      if (answered && !refining) continue;

      const counts = new Map();
      for (const s of set) {
        const v = s[f.key];
        if (v === null || v === undefined) continue;
        counts.set(v, (counts.get(v) ?? 0) + 1);
      }
      if (counts.size < 2) continue;

      const n = [...counts.values()].reduce((a, b) => a + b, 0);
      const entropy = -[...counts.values()].reduce((h, c) => h + (c / n) * Math.log2(c / n), 0);
      const score = entropy - f.ask_priority * 0.001;
      if (!best || score > best.score) {
        best = {
          score, key: f.key, label: f.label, layer: f.layer, unit: f.unit ?? null, refining,
          question: refining ? `Which exact size? (${f.label}, at least ${answers[f.key]})` : f.question,
          options: [...counts.entries()]
            .sort((a, b) => (typeof a[0] === 'number' && typeof b[0] === 'number' ? a[0] - b[0] : b[1] - a[1]))
            .map(([value, count]) => ({ value, count })),
        };
      }
    }
    if (!best) return null;
    const { score: _s, ...q } = best;
    return q;
  }
}

export function resolve(answers = {}, skipped = []) {
  const { set, trace } = filter(answers);
  return {
    dataset,
    total: skus.length,
    remaining: set.length,
    done: set.length === 1,
    exhausted: set.length === 0,
    answered: answers,
    trace,
    nextQuestion: set.length > 1 ? nextQuestion(set, answers, skipped) : null,
    candidates: [...set].sort((a, b) => (a.wll_t ?? 0) - (b.wll_t ?? 0)).slice(0, 8),
    typesLeft: [...new Set(set.map(s => s.type_code))].slice(0, 12),
  };
}

// ---- CLI ----
const arg = argv[0];
if (arg === '--facets') {
  console.log(JSON.stringify(facets, null, 2));
} else if (arg === '--families') {
  console.log(JSON.stringify(families.map(f => ({
    type_code: f.type_code, category: f.category, name: f.name,
    sku_count: f.sku_count, application: (f.application ?? []).join(' '),
  })), null, 2));
} else if (arg === '--family') {
  const f = families.find(x => x.type_code === String(argv[1]).toUpperCase());
  console.log(JSON.stringify(f ?? { error: 'unknown type' }, null, 2));
} else if (arg) {
  const answers = JSON.parse(arg);
  const skipped = argv[1] ? JSON.parse(argv[1]) : [];
  console.log(JSON.stringify(resolve(answers, skipped), null, 2));
} else {
  console.log(JSON.stringify(resolve({}), null, 2));
}
