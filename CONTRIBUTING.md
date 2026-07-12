# Contributing

Contributions that improve accessibility, Indian-language support, public-resource coverage, data standards, teaching material and parser correctness are welcome.

## Local development

```bash
npm start
# open http://localhost:3000
```

Run checks before opening a pull request:

```bash
npm run check
npm test
```

## Catalog entries

Catalog entries live in `data/resources.json`. Every entry should:

1. Link to the original institutional or project source over HTTPS.
2. Avoid unsupported claims of partnership, funding, certification or national coverage.
3. State access accurately: open, controlled, mixed or information-only.
4. Include a review date.
5. Avoid copying copyrighted descriptions verbatim.

## Safety

Do not add clinical diagnosis, treatment recommendations, identifiable example data, ancestry essentialism or unvalidated claims about Indian population groups.
