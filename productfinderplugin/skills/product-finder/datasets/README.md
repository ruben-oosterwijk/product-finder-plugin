# Datasets

A dataset is one catalogue. It is four JSON files in a directory named after the
catalogue — no code, so adding a new client is a data exercise.

```
datasets/
  <name>/
    skus.json       one row per orderable article
    facets.json     the questions, and the order to ask them
    families.json   what each product family is FOR
    aliases.json    customer vocabulary -> facet values
```

## skus.json

An array. Every object needs an identifier and a `type_code`; every other key is
a facet you can filter and ask on. Keys are yours to choose — the resolver reads
whatever `facets.json` declares.

```json
[
  { "art_no": "38526509", "type_code": "H11", "name": "HEAVY DUTY DOUBLE NUT SHACKLE",
    "category": "shackles", "wll_t": 34, "finish": "galvanized",
    "material": "alloy-steel", "price_excl_vat": 403 }
]
```

Use `null` where a value genuinely does not exist. Do not invent one: a facet
that is null for an article is simply never offered for it, which is correct.
Inventing values is how a questionnaire starts asking meaningless questions.

## facets.json

**This file is the questionnaire.** Adding a question is a row here, not a code
change.

```json
[
  { "key": "category", "layer": "application", "label": "Product family",
    "type": "enum", "ask_priority": 1, "question": "What kind of fitting?",
    "values": ["shackles", "hooks"] },
  { "key": "wll_t", "layer": "product", "label": "Working load",
    "type": "number", "unit": "t", "ask_priority": 3,
    "question": "What working load do you need?" }
]
```

- `layer` — `application` questions (what kind of thing) are always asked before
  `product` ones (which exact one). A customer can answer "what are you
  connecting?" long before "what wall thickness?".
- `ask_priority` — sequences the funnel within a layer. Entropy decides between
  facets of equal rank; raw entropy alone would open with whichever facet has the
  most distinct values, which is rarely the question a customer can answer first.
- `type: "number"` — treated as a minimum, so larger sizes stay in play.

Write `question` and `label` in the language that catalogue's customers use. The
resolver never translates them.

## families.json

Per product family: its specs and, most importantly, an `application` array
describing what it is *for*. This is what lets the assistant work out which
family a described situation calls for, which is usually the hard part.

```json
[
  { "type_code": "H11", "category": "shackles", "name": "HEAVY DUTY DOUBLE NUT SHACKLE",
    "sku_count": 7, "specs": { "Material": "Alloy steel" },
    "application": ["Used on one-leg and multi-leg systems."] }
]
```

If a family cannot be selected from data — dimensions given as a formula, made to
order — say so here. Better an honest hand-off than a confident wrong answer.

## aliases.json

Terms bind to **facet values, not to products**: `"30 ton"`, `"30t"` and
`"trinta toneladas"` all mean `wll_t = 30`, which then applies to every article
with that value, including ones added next year. Bound to products, the whole
dictionary would need re-tagging on every catalogue update.

```json
{
  "aliases": [
    { "term": "sluiting", "lang": "nl", "facet": "category", "value": "shackles", "confidence": 1.0 }
  ],
  "non_discriminating": {
    "colour": { "terms": ["green", "groen"],
                "note": "The catalogue distinguishes finish, not colour. Carry as an order note." }
  }
}
```

`non_discriminating` earns its place: these are words customers use constantly
that narrow nothing. Listing them stops the assistant asking a pointless question
and makes visible what actually needs a person.

## Checking a new dataset

```bash
node ../resolve.mjs --dataset <name> '{}'
node ../resolve.mjs --dataset <name> --facets
node ../resolve.mjs --dataset <name> --families
```

Two things worth checking by hand: that a plausible request narrows to one
article, and that an impossible one returns `exhausted` instead of a nearest
guess.
