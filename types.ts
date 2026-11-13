export type ElementType =
  | "title"
  | "subtitle"
  | "heading"
  | "paragraph"
  | "bullet-list"
  | "numbered-list"
  | "table"
  | "code"
  | "callout"
  | "image"
  | "shape"
  | "icon"
  | "chart";

export type ShapeKind =
  | "rectangle"
  | "rounded"
  | "circle"
  | "triangle"
  | "diamond"
  | "arrow-right"
  | "star"
  | "pill"
  | "line";

export type ChartKind = "bar" | "line" | "pie" | "horizontal-bar";

export type TransitionType =
  | "none"
  | "fade"
  | "slide"
  | "zoom"
  | "flip"
  | "curtain";

export type AnimationType =
  | "none"
  | "fade-up"
  | "pop-in"
  | "slide-left"
  | "typewriter";

export type AutoLayoutMode =
  | "stack"
  | "two-column"
  | "grid"
  | "hero"
  | "visual-focus";

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface ElementStyle {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number | string;
  fontStyle?: "normal" | "italic";
  textDecoration?: "none" | "underline" | "line-through";
  textAlign?: "left" | "center" | "right" | "justify";
  textTransform?: "none" | "uppercase" | "capitalize";
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  lineHeight?: number;
  letterSpacing?: number;
  opacity?: number;
  padding?: number;
  autoScaleFont?: boolean;
}

export interface SlideElement {
  id: string;
  type: ElementType;
  name?: string;
  // Logical 16:9 canvas coordinates (960 x 540)
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  locked?: boolean;
  hidden?: boolean;
  animation?: AnimationType;
  style: ElementStyle;

  // Content fields depending on type:
  content?: string; // title, subtitle, heading, paragraph, callout, shape inner text
  items?: string[]; // bullet-list, numbered-list
  listStart?: number; // numbered-list starting number
  rows?: string[][]; // table rows & cells
  hasHeader?: boolean; // table header styling
  striped?: boolean; // table zebra striping
  code?: string; // code block content
  language?: string; // code block language
  calloutIcon?: string; // emoji or icon label for callout
  imageUrl?: string; // image src or data URL
  imageAlt?: string; // image alt / caption
  objectFit?: "cover" | "contain";
  shapeKind?: ShapeKind;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  iconName?: string;
  chartKind?: ChartKind;
  chartTitle?: string;
  chartData?: ChartDataPoint[];
  showValues?: boolean;
}

export interface Slide {
  id: string;
  title: string;
  elements: SlideElement[];
  backgroundOverride?: string;
  transitionOverride?: TransitionType;
  layoutMode?: AutoLayoutMode;
  notes?: string;
}

export interface PresentationTheme {
  id: string;
  name: string;
  category:
    | "Chalkboard & Classroom"
    | "Modern Minimal"
    | "Dark Tech & Coding"
    | "Vibrant Creative"
    | "Academic & Science"
    | "Indian Heritage & Bilingual"
    | "Executive & Prep";
  isDark: boolean;
  background: string; // CSS color or gradient
  pptxBgHex: string; // Solid 6-char hex fallback for PPTX export
  surface: string;
  titleColor: string;
  subtitleColor: string;
  textColor: string;
  accentColor: string;
  secondaryAccent: string;
  calloutBg: string;
  calloutBorder: string;
  codeBg: string;
  codeText: string;
  tableHeaderBg: string;
  tableHeaderText: string;
  tableRowAltBg: string;
  tableBorder: string;
  headingFont: string;
  bodyFont: string;
  cardRadius: number;
}

export interface ParseDiagnostics {
  slideCount: number;
  elementCount: number;
  titles: number;
  subtitles: number;
  headings: number;
  paragraphs: number;
  bulletLists: number;
  numberedLists: number;
  tables: number;
  codeBlocks: number;
  callouts: number;
  images: number;
  hasUnicodeOrHindi: boolean;
  sourceCharacters: number;
  preservedCharacters: number;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  institution: string;
  subjectSpecialty: string;
  avatarColor: string;
  preferredMode: "light" | "dark";
}

export interface FolderRecord {
  id: string;
  userId: string;
  name: string;
  color: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface PresentationRecord {
  id: string;
  userId: string;
  folderId: string | null;
  title: string;
  description: string;
  subject: string;
  gradeLevel: string;
  themeId: string;
  transition: TransitionType;
  autoFontScale: boolean;
  rawMarkdown: string;
  slides: Slide[];
  slideCount: number;
  isFavorite: boolean;
  isArchived: boolean;
  lastOpenedAt: string;
  createdAt: string;
  updatedAt: string;
  unsynced?: boolean;
}

export interface TemplateRecord {
  id: string;
  userId: string | null;
  title: string;
  category: string;
  description: string;
  themeId: string;
  markdownSample: string;
  slides: Slide[];
  isSystem: boolean;
  createdAt: string;
}
