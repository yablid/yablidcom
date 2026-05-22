---
title: "Lossy Compression -> Lossy Projection"
summary: "Structured output is lossy compression — the design question is how to pass the right semantic context through the system."
type: "post"
createdAt: 2026-03-22
---

Semantic context is something I didn't think much about in software systems until we started building agent pipelines. When I cram non-deterministic agents into deterministic systems, I typically want some strict harnesses - for example `tool_use` and Pydantic validation. In the shapes, I'm trying to reduce a lot of information to something I know exactly what looks like.

The risk with semantic context is lossy compression. If I reduce a product spec to a set of fields, something as simple as `What use was this designed for`, which was easy to answer in the original context, might be hard to answer with the reduced product attributes.

I've run into what must be this common problem of using inference to reduce information to something I can easily work with, and then inadvertently somewhere down the pipeline using inference to reconstruct a guess that I probably had better answers to in the original context - lossy projection.

The data I'm often working on is real-world data - documents written by someone, emails - and I have had to start thinking about ontology again. Looking up related information and analysing or synthesizing is one thing. But what's really interesting is trying to figure out what the question that actually needs to be answered is, and then what structures actually exist in that data that LLMs can work with to get to a given goal.

---

On an unrelated note, I was having trouble injecting data into a .docx via Structured Document Tags. Claude and I could not find out which field was crashing. After a few attempts, it simply resorted to binary search.
Inject the first half of the document, then separately the second, and see what crashed. Narrowed it right down to the fourth field, which had some invalid Open Office XML. Good fun.
