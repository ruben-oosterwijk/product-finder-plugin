---
name: product-finder
description: Identify one exact product from a large catalogue when the customer's request is vague or incomplete, by running a data-driven questionnaire that only asks what actually narrows the options. Use when someone pastes a customer enquiry or describes what they need without naming a specific article, and a catalogue dataset is available.
---

# Product Finder

Turns *"I need something for 30 tonnes, galvanised, offshore"* into a specific
article number — or into the one question that still has to be asked.

## The rule that matters

**You never choose the article yourself.** You read text and propose *facet
values*; `resolve.mjs` filters the catalogue and picks the article. You may not
name an article the resolver did not return, and you may not skip the resolver
because the answer seems obvious.

This is not ceremony. The whole reason this approach is defensible is that the
result is traceable to a filter rather than to a language model's judgement. In
catalogues where a wrong value has real consequences — load ratings, pressure
ratings, certifications — that difference is the product.

## Datasets

A dataset is a catalogue. Find out what is installed:

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/product-finder/resolve.mjs --datasets
```

If more than one exists, pass `--dataset <name>` on every call, or set
`PRODUCT_FINDER_DATASET`. With one dataset it is used automatically.

To work with a catalogue that is not installed yet, read
`datasets/README.md` — it is four JSON files, no code.

## Running a session

### 1. Read the request and map the words

Extract everything you can. Use the dataset's `aliases.json` to translate the
customer's vocabulary into facet values — the same product arrives under many
names, and often in another language. Say which term you matched to what, so the
operator can correct you.

Watch for terms in `non_discriminating`. Those are words customers use
constantly that do *not* narrow this catalogue. Recognising them is as valuable
as recognising a facet: it stops you asking a pointless question and shows what
actually needs a human.

### 2. Establish what kind of thing before which exact one

The expensive part is rarely the size — it is working out which family the
customer is even describing. They describe an application, not a product. Read
the family knowledge before filtering:

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/product-finder/resolve.mjs --families
node ${CLAUDE_PLUGIN_ROOT}/skills/product-finder/resolve.mjs --family <TYPE>
```

### 3. Call the resolver

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/product-finder/resolve.mjs '{"category":"shackles","wll_t":30}'
```

You get back `remaining`, a `trace` of what each filter eliminated,
`candidates`, and `nextQuestion` — the facet that best splits what is left,
chosen by information gain over the *current* candidate set rather than by a
fixed script.

To park a question the user cannot answer, pass a second argument:

```bash
node .../resolve.mjs '{"category":"shackles"}' '["finish"]'
```

A parked facet is never asked again and never filters, so the candidate count
stays honest.

### 4. Ask one question at a time

Ask exactly the question the resolver returned, in the user's own language.
Show the narrowing as you go — it is the most convincing part of the session:

> 821 → 252 → 27 → 13 → 1

Offer the resolver's `options` with their counts. Never invent an option that is
not in the returned set. If `nextQuestion` is `null` while several candidates
remain, they are genuinely equivalent on the facets held — say so and present
them side by side rather than guessing.

A numeric answer is treated as a **minimum**, not an equality, so larger sizes
stay in play. Once the user picks a concrete size, pin it with `{"eq": 34}`.

### 5. Land it

When `done` is true, report the article number, its full specification, and a
**why-trace**: each answer and how many candidates it removed. Carry anything the
catalogue cannot express — a colour, a quantity, a delivery date — as a note
rather than dropping it.

If `exhausted` is true, nothing matches. Say which constraint is impossible and
offer to relax it; never silently drop one.

## Behaviour

- **One question per turn.** The point is asking as few as possible, not batching them.
- **Answer from the text first.** Only ask what the request genuinely does not say, and report how many you filled in yourself.
- **Say when you are unsure.** A low-confidence alias match is a question, not a fact.
- **Reply in the language the customer wrote in.**
- Questions, labels and options all come from the dataset, so they are already in the right language for that catalogue. Do not translate them into your own words.
