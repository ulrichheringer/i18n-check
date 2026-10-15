# i18n-check

A CLI for comparing JSON translation files. It reports missing and extra keys, mismatched interpolation placeholders, and base-language strings that have no statically referenced key in your source code.

## Build and run

Requires Node.js 20 or later.

```sh
npm install
npm run build
node dist/cli.js --locales ./locales --source ./src --base en
```

Use `--fail-on any`, `--fail-on missing`, or `--fail-on never` to control the exit code. By default, missing keys fail the command, which makes it suitable for CI.

The CLI accepts flat JSON files or one JSON file per locale. Source scanning recognizes literal keys in `t()`, `translate()`, and `i18n.t()` calls; it cannot detect keys built at runtime.

To install it in another project after publishing, run:

```sh
npm install --save-dev github:ulrichheringer/i18n-check
```
