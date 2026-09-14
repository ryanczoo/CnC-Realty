// @types/pdf-parse only declares the package root ("pdf-parse"), not the internal
// "pdf-parse/lib/pdf-parse.js" module tests import to bypass a debug-mode bug in the
// package's own index.js. Mirrors @types/pdf-parse's shape for that same default export.
declare module "pdf-parse/lib/pdf-parse.js" {
  import PdfParse = require("pdf-parse");
  export = PdfParse;
}
