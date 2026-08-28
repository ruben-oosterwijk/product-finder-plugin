# Example dataset — Grofsmederij Nieuwkoop

A worked example, so the plugin does something the moment it is installed.

**821 articles, 69 product types, 8 families** of forged rope fittings for marine
and offshore lifting and mooring — shackles, thimbles, hooks, swivels, sockets,
links, mooring components. Built from the manufacturer's public product pages and
datasheet PDFs (gnweb.com).

Worth knowing before reading too much into it:

- **Prices are fictional.** The catalogue publishes none. They are modelled on
  mass — a fixed handling charge plus weight × EUR/kg for the alloy — because that
  is how forged steel is actually sold, so the figures are at least plausible.
  They are not this manufacturer's prices.
- **11 of 69 types carry no articles.** Three are parametric: their dimensions are
  given as a formula of chain diameter, so no size table exists at all. Eight have
  datasheet layouts the extraction did not handle. All 11 are present in
  `families.json` and flagged, so the assistant says so rather than substituting
  something that happens to be in the data.
- **Three different rating systems.** 549 articles are rated by working load in
  tonnes, 102 by proof or breaking load in kN per steel grade, and 170 carry no
  load rating at all — thimbles are sized to the rope. This is exactly why a facet
  that cannot discriminate must be skipped rather than asked: "what working load?"
  is a meaningless question for a third of this catalogue.

The questions in `facets.json` are in Dutch, because that is the language this
example was built for. Questions live in the dataset precisely so another
catalogue can ask in another language without touching the resolver.
