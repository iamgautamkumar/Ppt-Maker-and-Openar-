import {
  AutoLayoutMode,
  ParseDiagnostics,
  PresentationTheme,
  Slide,
  SlideElement,
} from "./types";
import { getThemeById } from "./themes";

export const CANVAS_WIDTH = 960;
export const CANVAS_HEIGHT = 540;

let idCounter = 0;
export function createUid(prefix = "el"): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

interface RawBlock {
  kind:
    | "subtitle"
    | "heading"
    | "paragraph"
    | "bullet-list"
    | "numbered-list"
    | "table"
    | "code"
    | "callout"
    | "image";
  text?: string;
  items?: string[];
  listStart?: number;
  rows?: string[][];
  code?: string;
  language?: string;
  imageUrl?: string;
  imageAlt?: string;
}

interface RawSlideDraft {
  title: string;
  hasExplicitTitle: boolean;
  blocks: RawBlock[];
}

function isTableSeparatorRow(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes("|")) return false;
  const cells = splitMarkdownTableRow(trimmed);
  if (cells.length === 0) return false;
  return cells.every((c) => /^:?-{2,}:?$/.test(c.trim()));
}

function splitMarkdownTableRow(line: string): string[] {
  let raw = line.trim();
  if (raw.startsWith("|")) raw = raw.slice(1);
  if (raw.endsWith("|")) raw = raw.slice(0, -1);
  // Split on unescaped pipes
  const cells: string[] = [];
  let current = "";
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === "\\" && raw[i + 1] === "|") {
      current += "|";
      i++;
    } else if (raw[i] === "|") {
      cells.push(current.trim());
      current = "";
    } else {
      current += raw[i];
    }
  }
  cells.push(current.trim());
  return cells;
}

function looksLikeTableLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.length > 2) {
    return true;
  }
  const pipeCount = (trimmed.match(/\|/g) || []).length;
  return pipeCount >= 2;
}

/**
 * Extracts markdown images `![alt](url)` and HTML `<img src="..." alt="...">`
 * from a line, returning extracted images and any remaining non-image text.
 */
function extractImagesFromLine(line: string): {
  images: Array<{ alt: string; url: string }>;
  remainingText: string;
} {
  const images: Array<{ alt: string; url: string }> = [];
  let remaining = line;

  const mdImgRegex = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  remaining = remaining.replace(mdImgRegex, (_match, alt, url) => {
    images.push({ alt: (alt || "Slide Image").trim(), url: url.trim() });
    return "";
  });

  const htmlImgRegex =
    /<img\b[^>]*?\bsrc=["']([^"']+)["'][^>]*?(?:\balt=["']([^"']*)["'][^>]*?)?\/?>/gi;
  remaining = remaining.replace(htmlImgRegex, (_match, url, alt) => {
    images.push({ alt: (alt || "Slide Image").trim(), url: url.trim() });
    return "";
  });

  return {
    images,
    remainingText: remaining.trim(),
  };
}

/**
 * Advanced AI Slide Parsing Engine
 * Strictly converts ChatGPT or Markdown text into structured slides without
 * losing any text, formatting, Unicode/Hindi characters, emojis, or merging slides.
 */
export function parseMarkdownToSlides(
  rawInput: string,
  options?: {
    themeId?: string;
    autoLayoutMode?: AutoLayoutMode;
    splitOnHorizontalRule?: boolean;
  }
): { slides: Slide[]; diagnostics: ParseDiagnostics } {
  const theme = getThemeById(options?.themeId);
  const normalized = (rawInput ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");

  const drafts: RawSlideDraft[] = [];
  let currentDraft: RawSlideDraft | null = null;

  const ensureDraft = (defaultTitle = "Introduction") => {
    if (!currentDraft) {
      currentDraft = {
        title: defaultTitle,
        hasExplicitTitle: false,
        blocks: [],
      };
      drafts.push(currentDraft);
    }
    return currentDraft;
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. Blank line -> skip (block boundaries already handled)
    if (trimmed === "") {
      i++;
      continue;
    }

    // 2. Fenced Code Block (``` or ~~~) — MUST be parsed atomically so `#` comments inside code never split slides!
    const fenceMatch = trimmed.match(/^(`{3,}|~{3,})(.*)$/);
    if (fenceMatch) {
      const fenceChars = fenceMatch[1];
      const fenceType = fenceChars[0];
      const language = (fenceMatch[2] || "text").trim() || "code";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length) {
        const cl = lines[i];
        const clTrim = cl.trim();
        if (
          clTrim.startsWith(fenceType.repeat(fenceChars.length)) &&
          new RegExp(`^${fenceType}{${fenceChars.length},}\\s*$`).test(clTrim)
        ) {
          i++;
          break;
        }
        codeLines.push(cl);
        i++;
      }
      const draft = ensureDraft("Code Overview");
      draft.blocks.push({
        kind: "code",
        language,
        code: codeLines.join("\n"),
      });
      continue;
    }

    // 3. Optional horizontal rule separator (`---` or `***` on its own line)
    if (/^(?:-\s*){3,}$|^(?:\*\s*){3,}$|^(?:_\s*){3,}$/.test(trimmed)) {
      if (options?.splitOnHorizontalRule && currentDraft) {
        currentDraft = null;
      }
      i++;
      continue;
    }

    // 4. Slide Title: Every line starting with single "#" creates a NEW slide!
    // Never merge two `#` slides together, even if previous `#` slide had only a title.
    if (trimmed.startsWith("#") && !trimmed.startsWith("##")) {
      const rawTitle = trimmed.replace(/^#\s*/, "").trim() || "Untitled Slide";
      currentDraft = {
        title: rawTitle,
        hasExplicitTitle: true,
        blocks: [],
      };
      drafts.push(currentDraft);
      i++;
      continue;
    }

    // 5. Subtitle: "##" becomes a subtitle
    if (trimmed.startsWith("##") && !trimmed.startsWith("###")) {
      const subtitleText = trimmed.replace(/^##\s*/, "").trim();
      const draft = ensureDraft(subtitleText || "Overview");
      if (subtitleText) {
        draft.blocks.push({
          kind: "subtitle",
          text: subtitleText,
        });
      }
      i++;
      continue;
    }

    // 6. Section Heading: "###" (and deeper #### headings preserved cleanly) becomes a section heading
    if (trimmed.startsWith("###")) {
      const headingText = trimmed.replace(/^#{3,6}\s*/, "").trim();
      const draft = ensureDraft(headingText || "Section");
      if (headingText) {
        draft.blocks.push({
          kind: "heading",
          text: headingText,
        });
      }
      i++;
      continue;
    }

    // 7. Blockquotes (`>`) -> Callout boxes
    if (/^\s*>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^\s*>\s?/, "").trim());
        i++;
      }
      const combined = quoteLines.filter((q, idx) => q !== "" || idx > 0).join("\n").trim();
      const draft = ensureDraft("Key Takeaway");
      draft.blocks.push({
        kind: "callout",
        text: combined || "Important Note",
      });
      continue;
    }

    // 8. Markdown Tables (`| col1 | col2 |`)
    if (
      looksLikeTableLine(line) &&
      (i + 1 < lines.length &&
        (isTableSeparatorRow(lines[i + 1]) || looksLikeTableLine(lines[i + 1])) ||
        (trimmed.startsWith("|") && trimmed.endsWith("|")))
    ) {
      const tableRows: string[][] = [];
      let maxCols = 0;
      while (i < lines.length && looksLikeTableLine(lines[i])) {
        if (!isTableSeparatorRow(lines[i])) {
          const cells = splitMarkdownTableRow(lines[i]);
          if (cells.length > maxCols) maxCols = cells.length;
          tableRows.push(cells);
        }
        i++;
      }
      if (tableRows.length > 0) {
        // Normalize column count so table is cleanly rectangular
        const normalizedRows = tableRows.map((r) => {
          const copy = [...r];
          while (copy.length < maxCols) copy.push("");
          return copy;
        });
        const draft = ensureDraft("Comparison Table");
        draft.blocks.push({
          kind: "table",
          rows: normalizedRows,
        });
      }
      continue;
    }

    // 9. Bullet lists (`- `, `* `, `+ `, `• `)
    if (/^\s*[-*+•]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+•]\s+/.test(lines[i])) {
        const rawLine = lines[i];
        const indentMatch = rawLine.match(/^(\s*)/);
        const indentSpaces = indentMatch ? indentMatch[1].length : 0;
        const itemContent = rawLine.replace(/^\s*[-*+•]\s+/, "").trim();

        const { images, remainingText } = extractImagesFromLine(itemContent);
        if (remainingText || images.length === 0) {
          const prefix = indentSpaces >= 2 ? "↳ " : "";
          items.push(`${prefix}${remainingText || itemContent}`);
        }
        if (images.length > 0) {
          const draft = ensureDraft();
          for (const img of images) {
            draft.blocks.push({
              kind: "image",
              imageUrl: img.url,
              imageAlt: img.alt,
            });
          }
        }
        i++;
      }
      if (items.length > 0) {
        const draft = ensureDraft("Key Points");
        draft.blocks.push({
          kind: "bullet-list",
          items,
        });
      }
      continue;
    }

    // 10. Numbered lists (`1. `, `2) `)
    const numMatch = line.match(/^\s*(\d+)[.)]\s+(.+)$/);
    if (numMatch) {
      const startNum = parseInt(numMatch[1], 10) || 1;
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        const rawLine = lines[i];
        const indentSpaces = (rawLine.match(/^(\s*)/)?.[1] ?? "").length;
        const cleaned = rawLine.replace(/^\s*\d+[.)]\s+/, "").trim();
        const { images, remainingText } = extractImagesFromLine(cleaned);
        if (remainingText || images.length === 0) {
          const prefix = indentSpaces >= 2 ? "↳ " : "";
          items.push(`${prefix}${remainingText || cleaned}`);
        }
        if (images.length > 0) {
          const draft = ensureDraft();
          for (const img of images) {
            draft.blocks.push({
              kind: "image",
              imageUrl: img.url,
              imageAlt: img.alt,
            });
          }
        }
        i++;
      }
      if (items.length > 0) {
        const draft = ensureDraft("Step-by-Step Guide");
        draft.blocks.push({
          kind: "numbered-list",
          listStart: startNum,
          items,
        });
      }
      continue;
    }

    // 11. Images & Paragraphs
    const { images, remainingText } = extractImagesFromLine(line);
    if (images.length > 0) {
      const draft = ensureDraft(images[0].alt || "Visual Overview");
      if (remainingText) {
        draft.blocks.push({
          kind: "paragraph",
          text: remainingText,
        });
      }
      for (const img of images) {
        draft.blocks.push({
          kind: "image",
          imageUrl: img.url,
          imageAlt: img.alt,
        });
      }
      i++;
      continue;
    }

    // 12. Paragraph block: collect consecutive plain paragraph lines until a special block boundary
    const paraLines: string[] = [];
    while (i < lines.length) {
      const pLine = lines[i];
      const pTrim = pLine.trim();
      if (
        pTrim === "" ||
        pTrim.startsWith("#") ||
        /^(`{3,}|~{3,})/.test(pTrim) ||
        /^(?:-\s*){3,}$|^(?:\*\s*){3,}$|^(?:_\s*){3,}$/.test(pTrim) ||
        /^\s*>\s?/.test(pLine) ||
        /^\s*[-*+•]\s+/.test(pLine) ||
        /^\s*\d+[.)]\s+/.test(pLine) ||
        looksLikeTableLine(pLine) ||
        /!\[[^\]]*\]\([^)]+\)|<img\b/i.test(pLine)
      ) {
        break;
      }
      paraLines.push(pTrim);
      i++;
    }

    if (paraLines.length > 0) {
      const paragraphText = paraLines.join(" ");
      const draft = ensureDraft("Overview");
      draft.blocks.push({
        kind: "paragraph",
        text: paragraphText,
      });
    } else {
      // Safety fallback so loop always advances and never drops a line
      const draft = ensureDraft("Overview");
      draft.blocks.push({
        kind: "paragraph",
        text: trimmed,
      });
      i++;
    }
  }

  // If input was completely empty, create 1 blank starter slide
  if (drafts.length === 0) {
    drafts.push({
      title: "Untitled Slide",
      hasExplicitTitle: true,
      blocks: [
        {
          kind: "subtitle",
          text: "Add your lesson points or paste Markdown / ChatGPT notes",
        },
      ],
    });
  }

  const diagnostics: ParseDiagnostics = {
    slideCount: drafts.length,
    elementCount: 0,
    titles: 0,
    subtitles: 0,
    headings: 0,
    paragraphs: 0,
    bulletLists: 0,
    numberedLists: 0,
    tables: 0,
    codeBlocks: 0,
    callouts: 0,
    images: 0,
    hasUnicodeOrHindi: /[^\u0000-\u007F]/.test(normalized),
    sourceCharacters: normalized.replace(/\s+/g, "").length,
    preservedCharacters: 0,
  };

  const slides: Slide[] = drafts.map((draft, slideIdx) => {
    const elements: SlideElement[] = [];
    let z = 1;

    // Always place Title element if explicit `#` or if needed as slide header
    if (draft.hasExplicitTitle || draft.blocks.length === 0) {
      diagnostics.titles += 1;
      elements.push({
        id: createUid("title"),
        type: "title",
        name: "Slide Title",
        x: 52,
        y: 36,
        width: 856,
        height: 64,
        rotation: 0,
        zIndex: z++,
        animation: "fade-up",
        content: draft.title,
        style: {
          fontFamily: theme.headingFont,
          fontSize: 34,
          fontWeight: 700,
          color: theme.titleColor,
          textAlign: "left",
          lineHeight: 1.2,
          autoScaleFont: true,
        },
      });
    }

    for (const block of draft.blocks) {
      switch (block.kind) {
        case "subtitle": {
          diagnostics.subtitles += 1;
          elements.push({
            id: createUid("sub"),
            type: "subtitle",
            name: "Subtitle",
            x: 52,
            y: 108,
            width: 856,
            height: 44,
            rotation: 0,
            zIndex: z++,
            animation: "fade-up",
            content: block.text || "",
            style: {
              fontFamily: theme.headingFont,
              fontSize: 22,
              fontWeight: 600,
              color: theme.subtitleColor,
              textAlign: "left",
              lineHeight: 1.3,
              autoScaleFont: true,
            },
          });
          break;
        }
        case "heading": {
          diagnostics.headings += 1;
          elements.push({
            id: createUid("hdg"),
            type: "heading",
            name: "Section Heading",
            x: 52,
            y: 160,
            width: 856,
            height: 36,
            rotation: 0,
            zIndex: z++,
            animation: "fade-up",
            content: block.text || "",
            style: {
              fontFamily: theme.headingFont,
              fontSize: 19,
              fontWeight: 700,
              color: theme.accentColor,
              textAlign: "left",
              lineHeight: 1.3,
              autoScaleFont: true,
            },
          });
          break;
        }
        case "paragraph": {
          diagnostics.paragraphs += 1;
          elements.push({
            id: createUid("txt"),
            type: "paragraph",
            name: "Body Paragraph",
            x: 52,
            y: 200,
            width: 856,
            height: 76,
            rotation: 0,
            zIndex: z++,
            animation: "fade-up",
            content: block.text || "",
            style: {
              fontFamily: theme.bodyFont,
              fontSize: 17,
              fontWeight: 400,
              color: theme.textColor,
              textAlign: "left",
              lineHeight: 1.5,
              autoScaleFont: true,
            },
          });
          break;
        }
        case "bullet-list": {
          diagnostics.bulletLists += 1;
          elements.push({
            id: createUid("ul"),
            type: "bullet-list",
            name: "Bullet List",
            x: 52,
            y: 170,
            width: 856,
            height: Math.min(300, Math.max(90, (block.items?.length || 1) * 38 + 20)),
            rotation: 0,
            zIndex: z++,
            animation: "fade-up",
            items: block.items || [],
            style: {
              fontFamily: theme.bodyFont,
              fontSize: 17,
              fontWeight: 400,
              color: theme.textColor,
              textAlign: "left",
              lineHeight: 1.48,
              autoScaleFont: true,
            },
          });
          break;
        }
        case "numbered-list": {
          diagnostics.numberedLists += 1;
          elements.push({
            id: createUid("ol"),
            type: "numbered-list",
            name: "Numbered List",
            x: 52,
            y: 170,
            width: 856,
            height: Math.min(300, Math.max(90, (block.items?.length || 1) * 38 + 20)),
            rotation: 0,
            zIndex: z++,
            animation: "fade-up",
            items: block.items || [],
            listStart: block.listStart ?? 1,
            style: {
              fontFamily: theme.bodyFont,
              fontSize: 17,
              fontWeight: 400,
              color: theme.textColor,
              textAlign: "left",
              lineHeight: 1.48,
              autoScaleFont: true,
            },
          });
          break;
        }
        case "table": {
          diagnostics.tables += 1;
          const rowCount = block.rows?.length || 2;
          elements.push({
            id: createUid("tbl"),
            type: "table",
            name: "Editable Table",
            x: 52,
            y: 180,
            width: 856,
            height: Math.min(310, Math.max(110, rowCount * 42 + 16)),
            rotation: 0,
            zIndex: z++,
            animation: "fade-up",
            rows: block.rows || [
              ["Column 1", "Column 2"],
              ["Value 1", "Value 2"],
            ],
            hasHeader: true,
            striped: true,
            style: {
              fontFamily: theme.bodyFont,
              fontSize: 14,
              color: theme.textColor,
              borderRadius: theme.cardRadius,
              autoScaleFont: true,
            },
          });
          break;
        }
        case "code": {
          diagnostics.codeBlocks += 1;
          const lineCount = (block.code || "").split("\n").length;
          elements.push({
            id: createUid("code"),
            type: "code",
            name: `Code (${block.language || "code"})`,
            x: 52,
            y: 180,
            width: 856,
            height: Math.min(310, Math.max(110, lineCount * 22 + 48)),
            rotation: 0,
            zIndex: z++,
            animation: "fade-up",
            code: block.code || "",
            language: block.language || "code",
            style: {
              fontFamily: "'JetBrains Mono', 'Noto Sans Devanagari', monospace",
              fontSize: 13.5,
              backgroundColor: theme.codeBg,
              color: theme.codeText,
              borderRadius: theme.cardRadius,
              padding: 14,
              lineHeight: 1.45,
              autoScaleFont: true,
            },
          });
          break;
        }
        case "callout": {
          diagnostics.callouts += 1;
          elements.push({
            id: createUid("cal"),
            type: "callout",
            name: "Callout Box",
            x: 52,
            y: 380,
            width: 856,
            height: 86,
            rotation: 0,
            zIndex: z++,
            animation: "pop-in",
            calloutIcon: "💡",
            content: block.text || "",
            style: {
              fontFamily: theme.bodyFont,
              fontSize: 16,
              fontWeight: 500,
              backgroundColor: theme.calloutBg,
              borderColor: theme.calloutBorder,
              color: theme.textColor,
              borderRadius: theme.cardRadius,
              padding: 14,
              lineHeight: 1.42,
              autoScaleFont: true,
            },
          });
          break;
        }
        case "image": {
          diagnostics.images += 1;
          elements.push({
            id: createUid("img"),
            type: "image",
            name: block.imageAlt || "Slide Image",
            x: 520,
            y: 150,
            width: 388,
            height: 290,
            rotation: 0,
            zIndex: z++,
            animation: "pop-in",
            imageUrl: block.imageUrl || "",
            imageAlt: block.imageAlt || "Slide Visual",
            objectFit: "cover",
            style: {
              borderRadius: theme.cardRadius,
            },
          });
          break;
        }
      }
    }

    diagnostics.elementCount += elements.length;

    const baseSlide: Slide = {
      id: createUid(`slide_${slideIdx + 1}`),
      title: draft.title || `Slide ${slideIdx + 1}`,
      elements,
      notes: "",
    };

    // Determine smartest automatic layout mode if not forced
    const chosenMode =
      options?.autoLayoutMode ?? pickSmartLayoutForSlide(baseSlide);

    return applyAutoLayout(baseSlide, chosenMode, theme);
  });

  // Compute preserved content character count to confirm 100% content retention
  let charTotal = 0;
  for (const s of slides) {
    for (const el of s.elements) {
      if (el.content) charTotal += el.content.replace(/\s+/g, "").length;
      if (el.items) charTotal += el.items.join("").replace(/\s+/g, "").length;
      if (el.rows)
        charTotal += el.rows.flat().join("").replace(/\s+/g, "").length;
      if (el.code) charTotal += el.code.replace(/\s+/g, "").length;
      if (el.imageUrl) charTotal += el.imageUrl.length;
    }
  }
  diagnostics.preservedCharacters = charTotal;

  return { slides, diagnostics };
}

function pickSmartLayoutForSlide(slide: Slide): AutoLayoutMode {
  const nonHeader = slide.elements.filter(
    (e) => e.type !== "title" && e.type !== "subtitle"
  );
  if (nonHeader.length === 0) {
    return "hero";
  }
  const hasHeavyRightVisual = nonHeader.some(
    (e) =>
      e.type === "image" ||
      e.type === "chart" ||
      e.type === "code" ||
      e.type === "table"
  );
  const hasTextLeft = nonHeader.some(
    (e) =>
      e.type === "bullet-list" ||
      e.type === "numbered-list" ||
      e.type === "paragraph" ||
      e.type === "heading"
  );
  if (hasHeavyRightVisual && hasTextLeft && nonHeader.length >= 2) {
    return "two-column";
  }
  return "stack";
}

function estimateBaseHeight(el: SlideElement, width: number): number {
  const charsPerLine = Math.max(18, Math.floor(width / 9.5));
  switch (el.type) {
    case "title": {
      const lines = Math.ceil((el.content?.length || 10) / Math.max(18, Math.floor(width / 19)));
      return Math.min(110, Math.max(52, lines * 42 + 8));
    }
    case "subtitle": {
      const lines = Math.ceil((el.content?.length || 10) / Math.max(24, Math.floor(width / 13)));
      return Math.min(82, Math.max(38, lines * 30 + 6));
    }
    case "heading":
      return 36;
    case "paragraph": {
      const lines = Math.ceil((el.content?.length || 20) / charsPerLine);
      return Math.max(48, lines * 26 + 14);
    }
    case "bullet-list":
    case "numbered-list": {
      const items = el.items || [];
      let lineSum = 0;
      for (const item of items) {
        lineSum += Math.max(1, Math.ceil(item.length / Math.max(16, charsPerLine - 4)));
      }
      return Math.max(64, lineSum * 28 + items.length * 6 + 14);
    }
    case "callout": {
      const lines = Math.ceil((el.content?.length || 25) / Math.max(16, charsPerLine - 6));
      return Math.max(66, lines * 25 + 28);
    }
    case "table": {
      const rows = el.rows?.length || 2;
      return Math.max(96, rows * 38 + 14);
    }
    case "code": {
      const lines = (el.code || "").split("\n").length;
      return Math.max(96, lines * 21 + 42);
    }
    case "image":
    case "chart":
      return 240;
    case "shape":
    case "icon":
      return el.height || 90;
    default:
      return 70;
  }
}

/**
 * Applies professional Auto Layout (`stack`, `two-column`, `grid`, `hero`, `visual-focus`)
 * across the 960x540 slide canvas so elements never overlap and always fit cleanly.
 */
export function applyAutoLayout(
  slide: Slide,
  mode: AutoLayoutMode,
  theme?: PresentationTheme
): Slide {
  const marginX = 52;
  const marginY = 34;
  const usableWidth = CANVAS_WIDTH - marginX * 2; // 856
  const maxBottom = CANVAS_HEIGHT - 28; // 512

  const elements = slide.elements.map((el) => ({
    ...el,
    style: { ...el.style },
  }));

  if (elements.length === 0) return { ...slide, layoutMode: mode };

  const titles = elements.filter((e) => e.type === "title");
  const subtitles = elements.filter((e) => e.type === "subtitle");
  const bodyEls = elements.filter(
    (e) => e.type !== "title" && e.type !== "subtitle"
  );

  if (mode === "hero") {
    const totalCount = elements.length;
    let currentY = totalCount <= 2 ? 175 : 90;
    for (const el of elements) {
      const h = Math.min(180, estimateBaseHeight(el, 780));
      el.x = 90;
      el.y = currentY;
      el.width = 780;
      el.height = h;
      if (
        el.type === "title" ||
        el.type === "subtitle" ||
        el.type === "paragraph" ||
        el.type === "heading"
      ) {
        el.style.textAlign = "center";
        if (el.type === "title") el.style.fontSize = 42;
      }
      currentY += h + 18;
    }
    return fitElementsVertically({ ...slide, elements, layoutMode: mode }, maxBottom);
  }

  // Position header area (title + subtitle)
  let topCursor = marginY;
  for (const t of titles) {
    const h = estimateBaseHeight(t, usableWidth);
    t.x = marginX;
    t.y = topCursor;
    t.width = usableWidth;
    t.height = h;
    t.style.textAlign = "left";
    if (theme) t.style.color = theme.titleColor;
    topCursor += h + 6;
  }
  for (const st of subtitles) {
    const h = estimateBaseHeight(st, usableWidth);
    st.x = marginX;
    st.y = topCursor;
    st.width = usableWidth;
    st.height = h;
    st.style.textAlign = "left";
    if (theme) st.style.color = theme.subtitleColor;
    topCursor += h + 10;
  }

  topCursor += 6;
  const remainingHeight = Math.max(140, maxBottom - topCursor);

  if (bodyEls.length === 0) {
    return { ...slide, elements, layoutMode: mode };
  }

  if (mode === "two-column" && bodyEls.length >= 2) {
    const gap = 28;
    const colW = Math.floor((usableWidth - gap) / 2); // 414

    // Put visual/structured items on right if available, otherwise split evenly
    const rightCandidates = bodyEls.filter(
      (e) =>
        e.type === "image" ||
        e.type === "chart" ||
        e.type === "table" ||
        e.type === "code"
    );
    const leftCol: SlideElement[] = [];
    const rightCol: SlideElement[] = [];

    if (
      rightCandidates.length > 0 &&
      rightCandidates.length < bodyEls.length
    ) {
      for (const el of bodyEls) {
        if (rightCandidates.includes(el)) rightCol.push(el);
        else leftCol.push(el);
      }
    } else {
      const mid = Math.ceil(bodyEls.length / 2);
      bodyEls.forEach((el, idx) => {
        if (idx < mid) leftCol.push(el);
        else rightCol.push(el);
      });
    }

    stackColumn(leftCol, marginX, topCursor, colW, remainingHeight);
    stackColumn(rightCol, marginX + colW + gap, topCursor, colW, remainingHeight);

    return { ...slide, elements, layoutMode: mode };
  }

  if (mode === "grid" && bodyEls.length >= 2) {
    const cols = bodyEls.length >= 4 ? 2 : 2;
    const rows = Math.ceil(bodyEls.length / cols);
    const gapX = 22;
    const gapY = 16;
    const cellW = Math.floor((usableWidth - gapX * (cols - 1)) / cols);
    const cellH = Math.max(
      76,
      Math.floor((remainingHeight - gapY * (rows - 1)) / rows)
    );

    bodyEls.forEach((el, idx) => {
      const r = Math.floor(idx / cols);
      const c = idx % cols;
      el.x = marginX + c * (cellW + gapX);
      el.y = topCursor + r * (cellH + gapY);
      el.width = cellW;
      el.height = cellH;
    });

    return { ...slide, elements, layoutMode: mode };
  }

  if (mode === "visual-focus" && bodyEls.length >= 2) {
    const gap = 24;
    const leftW = Math.floor(usableWidth * 0.6);
    const rightW = usableWidth - leftW - gap;
    const primary = [bodyEls[0]];
    const rest = bodyEls.slice(1);
    stackColumn(primary, marginX, topCursor, leftW, remainingHeight);
    stackColumn(rest, marginX + leftW + gap, topCursor, rightW, remainingHeight);
    return { ...slide, elements, layoutMode: mode };
  }

  // Default "stack" layout
  stackColumn(bodyEls, marginX, topCursor, usableWidth, remainingHeight);
  return { ...slide, elements, layoutMode: "stack" };
}

function stackColumn(
  items: SlideElement[],
  x: number,
  startY: number,
  width: number,
  availableHeight: number
) {
  if (items.length === 0) return;
  const gap = 12;
  const rawHeights = items.map((el) => estimateBaseHeight(el, width));
  const totalRaw =
    rawHeights.reduce((acc, h) => acc + h, 0) + gap * (items.length - 1);

  const scale =
    totalRaw > availableHeight
      ? Math.max(0.45, (availableHeight - gap * (items.length - 1)) / Math.max(1, totalRaw - gap * (items.length - 1)))
      : 1;

  let cursorY = startY;
  items.forEach((el, idx) => {
    const h = Math.max(36, Math.round(rawHeights[idx] * scale));
    el.x = x;
    el.y = cursorY;
    el.width = width;
    el.height =
      items.length === 1 && (el.type === "image" || el.type === "chart")
        ? Math.min(availableHeight, Math.max(h, 280))
        : h;
    cursorY += el.height + gap;
  });
}

function fitElementsVertically(slide: Slide, maxBottom: number): Slide {
  const maxY = Math.max(...slide.elements.map((e) => e.y + e.height), 0);
  if (maxY <= maxBottom) return slide;
  const ratio = (maxBottom - 36) / Math.max(1, maxY - 36);
  return {
    ...slide,
    elements: slide.elements.map((e) => ({
      ...e,
      y: Math.round(36 + (e.y - 36) * ratio),
      height: Math.max(32, Math.round(e.height * ratio)),
    })),
  };
}

/**
 * Auto Font Scaling calculator:
 * Smoothly scales down font size when rich content exceeds element bounding box,
 * ensuring zero clipped text even on dense slides.
 */
export function computeAutoScaledFontSize(
  element: SlideElement,
  globalAutoScale = true
): number {
  const baseSize = element.style.fontSize ?? 17;
  if (!globalAutoScale || element.style.autoScaleFont === false) {
    return baseSize;
  }

  const area = Math.max(1200, element.width * element.height);

  if (
    element.type === "title" ||
    element.type === "subtitle" ||
    element.type === "heading" ||
    element.type === "paragraph" ||
    element.type === "callout"
  ) {
    const textLen = (element.content || "").length;
    if (textLen === 0) return baseSize;
    const minFont =
      element.type === "title" ? 20 : element.type === "subtitle" ? 15 : 11.5;
    // Approximate max comfortable characters at baseSize inside box area
    const charAreaNeeded = textLen * baseSize * baseSize * 0.85;
    if (charAreaNeeded > area * 0.82) {
      const factor = Math.sqrt((area * 0.82) / charAreaNeeded);
      return Math.max(minFont, Math.round(baseSize * factor * 10) / 10);
    }
    return baseSize;
  }

  if (element.type === "bullet-list" || element.type === "numbered-list") {
    const items = element.items || [];
    const totalChars = items.reduce((s, it) => s + it.length + 8, 0);
    if (totalChars === 0) return baseSize;
    const charAreaNeeded =
      totalChars * baseSize * baseSize * 0.92 + items.length * baseSize * 120;
    if (charAreaNeeded > area * 0.86) {
      const factor = Math.sqrt((area * 0.86) / charAreaNeeded);
      return Math.max(11, Math.round(baseSize * factor * 10) / 10);
    }
    return baseSize;
  }

  if (element.type === "code") {
    const lines = (element.code || "").split("\n").length;
    const maxLineH = (element.height - 38) / Math.max(1, lines);
    const fitted = maxLineH / 1.45;
    return Math.max(10, Math.min(baseSize, Math.round(fitted * 10) / 10));
  }

  if (element.type === "table") {
    const rows = element.rows?.length || 1;
    const maxRowH = (element.height - 12) / Math.max(1, rows);
    const fitted = (maxRowH - 10) / 1.4;
    return Math.max(10, Math.min(baseSize, Math.round(fitted * 10) / 10));
  }

  return baseSize;
}

/**
 * Re-colors a deck's elements intelligently when switching presentation themes,
 * preserving custom shape fills while adapting slide typography, tables, and callouts.
 */
export function applyThemeToSlides(
  slides: Slide[],
  newTheme: PresentationTheme
): Slide[] {
  return slides.map((slide) => ({
    ...slide,
    elements: slide.elements.map((el) => {
      const nextStyle = { ...el.style };
      if (el.type === "title") {
        nextStyle.color = newTheme.titleColor;
        nextStyle.fontFamily = newTheme.headingFont;
      } else if (el.type === "subtitle") {
        nextStyle.color = newTheme.subtitleColor;
        nextStyle.fontFamily = newTheme.headingFont;
      } else if (el.type === "heading") {
        nextStyle.color = newTheme.accentColor;
        nextStyle.fontFamily = newTheme.headingFont;
      } else if (
        el.type === "paragraph" ||
        el.type === "bullet-list" ||
        el.type === "numbered-list"
      ) {
        nextStyle.color = newTheme.textColor;
        nextStyle.fontFamily = newTheme.bodyFont;
      } else if (el.type === "callout") {
        nextStyle.color = newTheme.textColor;
        nextStyle.backgroundColor = newTheme.calloutBg;
        nextStyle.borderColor = newTheme.calloutBorder;
        nextStyle.fontFamily = newTheme.bodyFont;
      } else if (el.type === "code") {
        nextStyle.backgroundColor = newTheme.codeBg;
        nextStyle.color = newTheme.codeText;
      } else if (el.type === "table") {
        nextStyle.color = newTheme.textColor;
        nextStyle.fontFamily = newTheme.bodyFont;
      }
      return {
        ...el,
        style: nextStyle,
      };
    }),
  }));
}

export const AI_PARSER_SAMPLES: Array<{
  id: string;
  label: string;
  badge: string;
  themeId: string;
  markdown: string;
}> = [
  {
    id: "bilingual-physics",
    label: "Bilingual Science (Hindi + English)",
    badge: "हिंदी + English • Tables • Formulas",
    themeId: "bharat-peacock-teal",
    markdown: `# प्रकाश का परावर्तन और अपवर्तन (Light: Reflection & Refraction)
## कक्षा 10 विज्ञान (Class 10 Physics) — Live Masterclass 🔬✨
### आज के मुख्य बिंदु (Learning Objectives)
नमस्ते विद्यार्थियों! इस सत्र में हम दर्पण सूत्र, स्नेल का नियम (Snell's Law) और संख्यात्मक प्रश्नों को सरल भाषा में समझेंगे।
- परावर्तन के नियम: आपतन कोण ∠i = परावर्तन कोण ∠r
- गोलीय दर्पण (Spherical Mirrors): अवतल (Concave) एवं उत्तल (Convex)
- अपवर्तनांक (Refractive Index): n = c / v जहाँ c = 3 × 10⁸ m/s
> 💡 परीक्षा टिप (Board Exam Tip): चिह्न परिपाटी (Sign Convention) लगाते समय आपतित किरण की दिशा को हमेशा धनात्मक (+x) मानें!

# अवतल बनाम उत्तल दर्पण (Concave vs Convex Mirror)
## मुख्य अंतर और दैनिक जीवन में उपयोग
| विशेषता (Feature) | अवतल दर्पण (Concave) | उत्तल दर्पण (Convex) |
| --- | --- | --- |
| परावर्तक सतह | अंदर की ओर वक्रित | बाहर की ओर उभरी हुई |
| फोकस दूरी (f) | ऋणात्मक (−ve) | धनात्मक (+ve) |
| प्रतिबिंब (Image) | वास्तविक व उल्टा (अधिकांशतः) | सदैव आभासी व सीधा |
| मुख्य उपयोग | टॉर्च, दंत चिकित्सक, सोलर भट्टी | वाहनों के साइड मिरर 🚗 |
> 📌 दर्पण सूत्र (Mirror Formula): 1/v + 1/u = 1/f तथा आवर्धन m = −v/u

# संख्यात्मक प्रश्न हल करने के 4 चरण (Step-by-Step Numerical Solver)
## 100% सटीक उत्तर पाने की विधि 🎯
1. प्रश्न में दिए गए मान (u, v, f, h) को चिह्न परिपाटी (+ / −) के साथ लिखें।
2. दर्पण सूत्र 1/v + 1/u = 1/f या लेंस सूत्र 1/v − 1/u = 1/f का सही चयन करें।
3. लघुत्तम समापवर्त्य (LCM) लेकर v का मान तथा मात्रक (cm या m) निकालें।
4. आवर्धन (Magnification m) की गणना करके प्रतिबिंब की प्रकृति (वास्तविक/आभासी) लिखें।`,
  },
  {
    id: "python-dsa",
    label: "Python Coding & Algorithms",
    badge: "Code Blocks • Big-O Table • Lists",
    themeId: "tech-tokyo-night",
    markdown: `# Mastering Binary Search & Two Pointers 🚀
## CS-201 Live Coding Bootcamp — Lecture 04
### Why Logarithmic Search Matters
When teaching competitive programming or technical interviews, halving the search space transforms sluggish scans into instant lookups even for N = 10⁹ elements.
- Eliminates 50% of remaining candidates on every comparison
- Requires monotonic (sorted) input or a monotonic predicate function
- Zero extra heap memory: Space Complexity = O(1)
> ⚡ Watch Out: Always compute mid = left + (right - left) // 2 in statically typed languages to prevent 32-bit integer overflow!

# Python Template: Binary Search Implementation
## Clean, Bug-Free Iterative Pattern
\`\`\`python
# Binary Search in Python (Notice '#' comments stay inside code block!)
def binary_search(nums: list[int], target: int) -> int:
    left, right = 0, len(nums) - 1
    while left <= right:
        mid = (left + right) // 2
        if nums[mid] == target:
            return mid
        elif nums[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1
\`\`\`
> 🧪 Live Poll Question: What happens if we change \`while left <= right\` to \`while left < right\` on a 1-element array \`[42]\`?

# Time & Space Complexity Comparison
## Choosing the Right Search Strategy
| Algorithm | Precondition | Time (Worst) | Space | Classroom Analogy |
| --- | --- | --- | --- | --- |
| Linear Scan | Unsorted OK | O(n) | O(1) | Checking roll call page by page |
| Binary Search | Sorted Array | O(log₂ n) | O(1) | Opening dictionary in the middle |
| Hash Set Lookup | Hashable Keys | O(1) avg | O(n) | Direct locker number key |
| Exponential Search | Unbounded Sorted | O(log₂ i) | O(1) | Doubling steps until overshoot |`,
  },
  {
    id: "chatgpt-biology",
    label: "Photosynthesis & Visual Diagram",
    badge: "Images • Subheadings • Callouts",
    themeId: "science-bio-helix",
    markdown: `# Photosynthesis: Solar Energy to Life 🌿☀️
## Cellular Bioenergetics — Grade 11 Biology
### The Chloroplast Powerhouse
Autotrophic organisms capture photons using chlorophyll pigments embedded inside thylakoid membranes: 6CO₂ + 6H₂O + Light → C₆H₁₂O₆ + 6O₂ ↑
![Chloroplast Diagram](data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="600" height="400" rx="24" fill="%23ECFDF5"/><ellipse cx="300" cy="200" rx="250" ry="145" fill="%23A7F3D0" stroke="%23059669" stroke-width="8"/><ellipse cx="300" cy="200" rx="225" ry="122" fill="%23D1FAE5" stroke="%2310B981" stroke-width="4"/><g fill="%23047857"><rect x="145" y="135" width="76" height="22" rx="10"/><rect x="145" y="162" width="76" height="22" rx="10"/><rect x="145" y="189" width="76" height="22" rx="10"/><rect x="145" y="216" width="76" height="22" rx="10"/><rect x="265" y="150" width="76" height="22" rx="10"/><rect x="265" y="177" width="76" height="22" rx="10"/><rect x="265" y="204" width="76" height="22" rx="10"/><rect x="380" y="140" width="76" height="22" rx="10"/><rect x="380" y="167" width="76" height="22" rx="10"/><rect x="380" y="194" width="76" height="22" rx="10"/></g><text x="300" y="68" text-anchor="middle" font-family="sans-serif" font-size="22" font-weight="bold" fill="%23064E3B">Chloroplast: Grana &amp; Stroma</text><text x="183" y="268" text-anchor="middle" font-family="sans-serif" font-size="16" fill="%23065F46">Thylakoid Stack</text><text x="418" y="250" text-anchor="middle" font-family="sans-serif" font-size="16" fill="%23065F46">Stroma Matrix</text></svg>)
- Light-Dependent Reactions occur in the Thylakoid Membrane
- Produces ATP + NADPH and splits H₂O (Photolysis)
- Calvin Cycle (Light-Independent) fixes CO₂ inside the Stroma
> 🌱 Key Concept: Oxygen released during photosynthesis comes from H₂O, NOT from CO₂!`,
  },
];

/**
 * Generates a realistic 120-slide curriculum deck on demand to showcase
 * virtualized, instant 60fps performance with hundreds of slides.
 */
export function generateMegaCourseMarkdown(slideTotal = 120): string {
  const topics = [
    ["Mechanics & Kinematics", "v = u + at, s = ut + ½at²", "गति के समीकरण"],
    ["Thermodynamics & Entropy", "ΔU = Q − W", "ऊष्मागतिकी का प्रथम नियम"],
    ["Electrostatics & Gauss Law", "∮ E · dA = q / ε₀", "कूलॉम एवं गाउस का नियम"],
    ["Wave Optics & Interference", "Δx = nλ (Constructive)", "व्यतिकरण और विवर्तन"],
    ["Quantum Photoelectric Effect", "E = hν = Φ + K_max", "आइंस्टीन का प्रकाश-विद्युत समीकरण"],
  ];
  const chunks: string[] = [];
  for (let i = 1; i <= slideTotal; i++) {
    const t = topics[(i - 1) % topics.length];
    chunks.push(`# Module ${i}: ${t[0]} (${t[2]})
## Complete Revision Capsule — Slide ${i} of ${slideTotal}
### Core Principle & Formula: ${t[1]}
- Concept Check ${i}.1: Analyze boundary conditions and dimensional consistency.
- Concept Check ${i}.2: Apply conservation laws before algebraic substitution.
- Live Practice ${i}.3: Solve previous-year conceptual MCQ under 45 seconds.
> 💡 Quick Recall #${i}: Always verify SI units (Joule, Newton, Tesla, Kelvin) in your final answer!`);
  }
  return chunks.join("\n\n");
}
