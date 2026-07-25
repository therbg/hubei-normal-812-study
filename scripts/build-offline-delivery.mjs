import fs from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const docsDir = path.join(projectRoot, "docs");
const indexPath = path.join(docsDir, "index.html");
const indexHtml = fs.readFileSync(indexPath, "utf8");

const scriptMatch = indexHtml.match(/<script[^>]+src="([^"]+\.js)"[^>]*><\/script>/);
const styleMatch = indexHtml.match(/<link[^>]+href="([^"]+\.css)"[^>]*>/);

if (!scriptMatch || !styleMatch) {
  throw new Error("Cannot find the built JavaScript or stylesheet in docs/index.html");
}

const resolveAsset = (assetUrl) => {
  const assetName = path.basename(assetUrl);
  return path.join(docsDir, "assets", assetName);
};

const script = fs
  .readFileSync(resolveAsset(scriptMatch[1]), "utf8")
  .replaceAll("</script", "<\\/script");
const style = fs
  .readFileSync(resolveAsset(styleMatch[1]), "utf8")
  .replaceAll("</style", "<\\/style");

const title =
  indexHtml.match(/<title>(.*?)<\/title>/s)?.[1] ?? "湖师812｜文学综合学习台";
const description =
  indexHtml.match(/<meta\s+name="description"\s+content="([^"]*)"/s)?.[1] ??
  "湖北师范大学812文学综合学习台";

const offlineHtml = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#f2eee6" />
    <meta name="description" content="${description}" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <title>${title}（离线版）</title>
    <style>${style}</style>
  </head>
  <body>
    <div id="root"></div>
    <script>${script}</script>
  </body>
</html>
`;

const outputDir = path.join(projectRoot, "deliverables");
fs.mkdirSync(outputDir, { recursive: true });
const outputPath = path.join(outputDir, "湖师812文学综合学习台-离线版.html");
fs.writeFileSync(outputPath, offlineHtml, "utf8");

console.log(
  JSON.stringify(
    {
      outputPath,
      sizeBytes: fs.statSync(outputPath).size,
      embeddedScript: path.basename(resolveAsset(scriptMatch[1])),
      embeddedStyle: path.basename(resolveAsset(styleMatch[1])),
    },
    null,
    2,
  ),
);
