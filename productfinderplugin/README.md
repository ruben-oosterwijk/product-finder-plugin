# product-finder

Identify one product from a large catalogue by asking only the questions that
actually narrow it down.

Some catalogues are hard to sell from not because they are large, but because
customers describe a *situation* rather than a product. Someone asks for
"something for 30 tonnes, galvanised, offshore" and a salesperson spends ten
minutes working out what they mean before a quote can even start. This turns that
into a short questionnaire that comes out of the catalogue data.

## Install

```
/plugin marketplace add <owner>/<this-repo>
/plugin install product-finder
```

Then describe what you need, or paste a customer enquiry.

## How it works

The language model reads the request and proposes *facet values*. A small
deterministic script filters the catalogue, picks the article, and reports which
question would best split whatever is left — chosen by information gain over the
current candidate set, not from a fixed script. Questions that cannot narrow
anything are never asked.

Keeping the model out of the final choice is the point. The answer is traceable
to a filter rather than to a model's judgement, which is what makes it usable
where a wrong value has consequences — load ratings, pressure ratings,
certifications.

## Bring your own catalogue

The mechanism knows nothing about any particular catalogue. A dataset is four
JSON files — articles, questions, family knowledge, and customer vocabulary — and
adding one requires no code. See
[`skills/product-finder/datasets/README.md`](skills/product-finder/datasets/README.md).

The plugin ships with one worked example so it does something immediately. See
[`datasets/gn/README.md`](skills/product-finder/datasets/gn/README.md) for what
that data is, and what it is not.

## Layout

```
.claude-plugin/
  plugin.json          plugin manifest
  marketplace.json     lets this repo serve as its own marketplace
skills/
  product-finder/
    SKILL.md           how the assistant runs a session
    resolve.mjs        the deterministic resolver (catalogue-agnostic)
    datasets/
      README.md        how to add your own catalogue
      gn/              worked example
```
