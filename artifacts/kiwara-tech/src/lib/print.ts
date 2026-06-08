/**
 * print.ts — shared print utility (DRY: replaces 7+ inline window.print() blocks)
 */

const BASE_STYLES = `
  body { font-family: Arial, sans-serif; margin: 0; padding: 16px; font-size: 13px; color: #1e293b; }
  @media print {
    body { margin: 0; padding: 8px; }
    @page { margin: 1cm; }
  }
`;

/**
 * Open a new window with the given HTML and trigger window.print().
 * @param html     Inner HTML content (goes into <body>)
 * @param title    Window/document title
 * @param extraCss Additional CSS to inject alongside the base styles
 */
export function printHtml(html: string, title = "Kiwara Tech", extraCss = ""): void {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8"/>
  <title>${title}</title>
  <style>${BASE_STYLES}${extraCss}</style>
</head>
<body>
${html}
<script>window.onload = function() { window.print(); }<\/script>
</body>
</html>`);
  w.document.close();
}

/**
 * Convenience: print a full A4-styled document with a header logo/title.
 */
export function printDocument(opts: {
  title: string;
  subtitle?: string;
  content: string;
  extraCss?: string;
}): void {
  const header = `
    <div style="text-align:center;margin-bottom:24px;border-bottom:2px solid #1e40af;padding-bottom:12px">
      <h1 style="margin:0;color:#1e40af;font-size:20px">${opts.title}</h1>
      ${opts.subtitle ? `<p style="margin:4px 0 0;color:#64748b;font-size:12px">${opts.subtitle}</p>` : ""}
    </div>
  `;
  printHtml(header + opts.content, opts.title, opts.extraCss ?? "");
}
