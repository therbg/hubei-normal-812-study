import { copyFileSync } from "node:fs";
import { resolve } from "node:path";

const docsDirectory = resolve(import.meta.dirname, "..", "docs");
copyFileSync(
  resolve(docsDirectory, "index.html"),
  resolve(docsDirectory, "mirror.html"),
);
