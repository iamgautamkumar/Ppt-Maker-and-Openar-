import { CANVAS_HEIGHT, CANVAS_WIDTH } from "./slideParser";
import { getThemeById } from "./themes";
import { PresentationRecord, SlideElement } from "./types";

function cleanHex(color: string | undefined, fallback = "1E293B"): string {
  if (!color) return fallback;
  const trimmed = color.trim();
  if (trimmed.startsWith("#")) {
    const hex = trimmed.slice(1);
    if (hex.length === 3) {
      return hex
        .split("")
        .map((c) => c + c)
        .join("")
        .toUpperCase();
    }
    if (hex.length >= 6) {
      return hex.slice(0, 6).toUpperCase();
    }
  }
  return fallback;
}

function sanitizeFilename(title: string): string {
  const safe = title
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .trim()
    .slice(0, 80);
  return safe || "Presentation";
}

function triggerDataUrlDownload(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * One-click native PowerPoint (.pptx) export using PptxGenJS.
 * Preserves Unicode, Hindi/Devanagari, emojis, lists, editable tables, code boxes, callouts, shapes & charts!
 */
export async function exportPresentationToPptx(
  deck: PresentationRecord
): Promise<void> {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9"; // 10 x 5.625 inches
  pptx.title = deck.title;
  pptx.subject = deck.subject || "Online Lesson";
  pptx.author = "ShikshaSlide Studio";

  const theme = getThemeById(deck.themeId);
  const scaleX = (px: number) => Number(((px / CANVAS_WIDTH) * 10).toFixed(3));
  const scaleY = (px: number) =>
    Number(((px / CANVAS_HEIGHT) * 5.625).toFixed(3));

  for (const slideData of deck.slides) {
    const pSlide = pptx.addSlide();
    pSlide.background = {
      color: slideData.backgroundOverride
        ? cleanHex(slideData.backgroundOverride, theme.pptxBgHex)
        : theme.pptxBgHex,
    };

    if (slideData.notes) {
      pSlide.addNotes(slideData.notes);
    }

    const sortedElements = [...slideData.elements]
      .filter((el) => !el.hidden)
      .sort((a, b) => a.zIndex - b.zIndex);

    for (const el of sortedElements) {
      addElementToPptxSlide(pptx, pSlide, el, theme, scaleX, scaleY);
    }
  }

  await pptx.writeFile({
    fileName: `${sanitizeFilename(deck.title)}.pptx`,
  });
}

function addElementToPptxSlide(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pptx: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pSlide: any,
  el: SlideElement,
  theme: ReturnType<typeof getThemeById>,
  scaleX: (n: number) => number,
  scaleY: (n: number) => number
) {
  const x = scaleX(el.x);
  const y = scaleY(el.y);
  const w = Math.max(0.4, scaleX(el.width));
  const h = Math.max(0.3, scaleY(el.height));
  const fontPt = Math.max(
    8,
    Math.round((el.style.fontSize || 16) * 0.72)
  );
  const align =
    el.style.textAlign === "center" ||
    el.style.textAlign === "right" ||
    el.style.textAlign === "justify"
      ? el.style.textAlign
      : "left";

  if (
    el.type === "title" ||
    el.type === "subtitle" ||
    el.type === "heading" ||
    el.type === "paragraph"
  ) {
    pSlide.addText(el.content || "", {
      x,
      y,
      w,
      h,
      fontSize: fontPt,
      bold:
        el.type === "title" ||
        el.type === "heading" ||
        Number(el.style.fontWeight) >= 600,
      italic: el.style.fontStyle === "italic",
      color: cleanHex(el.style.color, cleanHex(theme.textColor)),
      align,
      valign: "top",
      rotate: el.rotation || 0,
      fontFace: "Arial",
    });
    return;
  }

  if (el.type === "bullet-list" || el.type === "numbered-list") {
    const items = el.items || [];
    const textRuns = items.map((item, idx) => ({
      text: item.replace(/^↳\s*/, "   "),
      options: {
        bullet:
          el.type === "numbered-list"
            ? { type: "number", numberStartAt: (el.listStart || 1) + idx }
            : true,
        breakLine: true,
      },
    }));
    pSlide.addText(textRuns, {
      x,
      y,
      w,
      h,
      fontSize: fontPt,
      color: cleanHex(el.style.color, cleanHex(theme.textColor)),
      valign: "top",
      paraSpaceAfter: 5,
      fontFace: "Arial",
    });
    return;
  }

  if (el.type === "callout") {
    const label = `${el.calloutIcon || "💡"} ${el.content || ""}`.trim();
    pSlide.addText(label, {
      x,
      y,
      w,
      h,
      fontSize: fontPt,
      color: cleanHex(el.style.color, cleanHex(theme.textColor)),
      fill: { color: theme.isDark ? "1E293B" : "F1F5F9" },
      line: {
        color: cleanHex(el.style.borderColor, cleanHex(theme.accentColor)),
        width: 2,
      },
      margin: 8,
      valign: "middle",
      fontFace: "Arial",
    });
    return;
  }

  if (el.type === "code") {
    const header = el.language ? `[${el.language.toUpperCase()}]\n` : "";
    pSlide.addText(`${header}${el.code || ""}`, {
      x,
      y,
      w,
      h,
      fontSize: Math.max(8, fontPt - 1),
      color: "E2E8F0",
      fill: { color: "0F172A" },
      line: { color: "334155", width: 1 },
      margin: 8,
      valign: "top",
      fontFace: "Courier New",
    });
    return;
  }

  if (el.type === "table" && el.rows && el.rows.length > 0) {
    const pptRows = el.rows.map((row, rIdx) =>
      row.map((cell) => ({
        text: cell,
        options: {
          bold: el.hasHeader !== false && rIdx === 0,
          color:
            el.hasHeader !== false && rIdx === 0
              ? cleanHex(theme.tableHeaderText, "FFFFFF")
              : cleanHex(theme.textColor, "1E293B"),
          fill:
            el.hasHeader !== false && rIdx === 0
              ? cleanHex(theme.tableHeaderBg, "4F46E5")
              : rIdx % 2 === 1
                ? theme.isDark
                  ? "1E293B"
                  : "F8FAFC"
                : theme.pptxBgHex,
          fontSize: Math.max(9, fontPt),
          fontFace: "Arial",
        },
      }))
    );
    pSlide.addTable(pptRows, {
      x,
      y,
      w,
      border: { pt: 1, color: cleanHex(theme.tableBorder, "CBD5E1") },
    });
    return;
  }

  if (el.type === "shape") {
    const shapeType =
      el.shapeKind === "circle"
        ? pptx.ShapeType.ellipse
        : el.shapeKind === "triangle"
          ? pptx.ShapeType.triangle
          : el.shapeKind === "diamond"
            ? pptx.ShapeType.diamond
            : el.shapeKind === "rounded" || el.shapeKind === "pill"
              ? pptx.ShapeType.roundRect
              : pptx.ShapeType.rect;

    pSlide.addText(el.content || "", {
      shape: shapeType,
      x,
      y,
      w,
      h,
      fill: { color: cleanHex(el.fillColor, cleanHex(theme.accentColor)) },
      line: {
        color: cleanHex(el.strokeColor, cleanHex(theme.accentColor)),
        width: el.strokeWidth ?? 1,
      },
      color: cleanHex(el.style.color, "FFFFFF"),
      align: "center",
      valign: "middle",
      fontSize: fontPt,
      bold: true,
      rotate: el.rotation || 0,
      fontFace: "Arial",
    });
    return;
  }

  if (el.type === "chart" && el.chartData && el.chartData.length > 0) {
    // Render clean data table representation in PPTX for maximum compatibility across PowerPoint/Keynote/Google Slides
    const header = [
      {
        text: el.chartTitle || "Metric",
        options: {
          bold: true,
          fill: cleanHex(theme.accentColor),
          color: "FFFFFF",
        },
      },
      {
        text: "Value",
        options: {
          bold: true,
          fill: cleanHex(theme.accentColor),
          color: "FFFFFF",
        },
      },
    ];
    const dataRows = el.chartData.map((d) => [
      { text: d.label, options: { color: cleanHex(theme.textColor) } },
      { text: String(d.value), options: { color: cleanHex(theme.textColor) } },
    ]);
    pSlide.addTable([header, ...dataRows], {
      x,
      y,
      w,
      border: { pt: 1, color: "CBD5E1" },
    });
    return;
  }

  if (el.type === "image" && el.imageUrl) {
    try {
      if (el.imageUrl.startsWith("data:image/png") || el.imageUrl.startsWith("data:image/jpeg")) {
        pSlide.addImage({ data: el.imageUrl, x, y, w, h });
      } else if (el.imageUrl.startsWith("http")) {
        pSlide.addImage({ path: el.imageUrl, x, y, w, h });
      } else {
        pSlide.addText(`[Image: ${el.imageAlt || "Visual Diagram"}]`, {
          x,
          y,
          w,
          h,
          align: "center",
          valign: "middle",
          color: cleanHex(theme.textColor),
          fill: { color: theme.isDark ? "1E293B" : "F1F5F9" },
        });
      }
    } catch {
      // Fallback label if remote CORS blocks fetch
      pSlide.addText(`[Image: ${el.imageAlt || "Visual"}]`, {
        x,
        y,
        w,
        h,
        align: "center",
        valign: "middle",
        color: cleanHex(theme.textColor),
      });
    }
  }
}

/**
 * One-click PNG export of a slide DOM node at 2x retina quality.
 */
export async function exportSlideNodeToPng(
  node: HTMLElement,
  title: string,
  slideIndex: number
): Promise<void> {
  const { toPng } = await import("html-to-image");
  const dataUrl = await toPng(node, {
    pixelRatio: 2,
    cacheBust: true,
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    style: {
      transform: "scale(1)",
      transformOrigin: "top left",
    },
  });
  triggerDataUrlDownload(
    dataUrl,
    `${sanitizeFilename(title)}_Slide_${slideIndex + 1}.png`
  );
}

/**
 * One-click JPEG export of a slide DOM node at 2x retina quality.
 */
export async function exportSlideNodeToJpeg(
  node: HTMLElement,
  title: string,
  slideIndex: number
): Promise<void> {
  const { toJpeg } = await import("html-to-image");
  const dataUrl = await toJpeg(node, {
    quality: 0.95,
    pixelRatio: 2,
    cacheBust: true,
    backgroundColor: "#FFFFFF",
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    style: {
      transform: "scale(1)",
      transformOrigin: "top left",
    },
  });
  triggerDataUrlDownload(
    dataUrl,
    `${sanitizeFilename(title)}_Slide_${slideIndex + 1}.jpg`
  );
}

/**
 * One-click multi-slide landscape 16:9 PDF export using html-to-image + jsPDF.
 */
export async function exportDeckNodesToPdf(
  captureSlideAtIndex: (idx: number) => Promise<HTMLElement | null>,
  totalSlides: number,
  title: string,
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  const [{ toJpeg }, { jsPDF }] = await Promise.all([
    import("html-to-image"),
    import("jspdf"),
  ]);

  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "px",
    format: [CANVAS_WIDTH, CANVAS_HEIGHT],
    compress: true,
  });

  for (let i = 0; i < totalSlides; i++) {
    onProgress?.(i + 1, totalSlides);
    const el = await captureSlideAtIndex(i);
    if (!el) continue;

    const imgData = await toJpeg(el, {
      quality: 0.92,
      pixelRatio: 2,
      cacheBust: true,
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      style: {
        transform: "scale(1)",
        transformOrigin: "top left",
      },
    });

    if (i > 0) {
      pdf.addPage([CANVAS_WIDTH, CANVAS_HEIGHT], "landscape");
    }
    pdf.addImage(imgData, "JPEG", 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  pdf.save(`${sanitizeFilename(title)}.pdf`);
}
