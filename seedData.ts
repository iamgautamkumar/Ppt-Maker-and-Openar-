import { AI_PARSER_SAMPLES, createUid, parseMarkdownToSlides } from "./slideParser";
import { Slide } from "./types";

export function buildDemoSeedBundle(userId: string) {
  const folderScienceId = "folder_demo_science";
  const folderCodingId = "folder_demo_coding";
  const folderCivicsId = "folder_demo_civics";

  const folders = [
    {
      id: folderScienceId,
      userId,
      name: "Class 10–12 Science (द्विभाषी)",
      color: "#0D9488",
      description: "Physics, Chemistry & Biology live class decks in Hindi + English",
    },
    {
      id: folderCodingId,
      userId,
      name: "Python & DSA Live Bootcamp",
      color: "#4F46E5",
      description: "Interactive coding slides with editable code blocks & Big-O tables",
    },
    {
      id: folderCivicsId,
      userId,
      name: "Competitive Exam & Humanities",
      color: "#D97706",
      description: "History, Polity, Economics & Mathematics revision masterclasses",
    },
  ];

  // Deck 1: Bilingual Physics (Hindi + English) enriched with an interactive Chart slide!
  const physicsParsed = parseMarkdownToSlides(
    AI_PARSER_SAMPLES[0].markdown,
    { themeId: "bharat-peacock-teal" }
  ).slides;

  const refractiveChartSlide: Slide = {
    id: createUid("slide_chart"),
    title: "माध्यमों का अपवर्तनांक तुलना (Refractive Index Chart)",
    notes: "Ask students why diamond sparkles intensely due to Total Internal Reflection (critical angle 24.4°).",
    elements: [
      {
        id: createUid("title"),
        type: "title",
        name: "Slide Title",
        x: 52,
        y: 34,
        width: 856,
        height: 56,
        rotation: 0,
        zIndex: 1,
        animation: "fade-up",
        content: "माध्यमों का अपवर्तनांक (Refractive Index n = c/v)",
        style: {
          fontFamily: "'Playfair Display', 'Noto Sans Devanagari', Georgia, serif",
          fontSize: 31,
          fontWeight: 700,
          color: "#F0FDFA",
          textAlign: "left",
          autoScaleFont: true,
        },
      },
      {
        id: createUid("sub"),
        type: "subtitle",
        name: "Subtitle",
        x: 52,
        y: 94,
        width: 856,
        height: 36,
        rotation: 0,
        zIndex: 2,
        animation: "fade-up",
        content: "अधिक अपवर्तनांक ⇒ प्रकाश की चाल कम (Higher n means slower speed of light)",
        style: {
          fontFamily: "'Plus Jakarta Sans', 'Noto Sans Devanagari', sans-serif",
          fontSize: 18,
          fontWeight: 600,
          color: "#FCD34D",
          textAlign: "left",
          autoScaleFont: true,
        },
      },
      {
        id: createUid("chart"),
        type: "chart",
        name: "Refractive Index Bar Chart",
        x: 52,
        y: 148,
        width: 520,
        height: 330,
        rotation: 0,
        zIndex: 3,
        animation: "pop-in",
        chartKind: "bar",
        chartTitle: "Optical Refractive Index (n)",
        showValues: true,
        chartData: [
          { label: "वायु (Air)", value: 1.0, color: "#38BDF8" },
          { label: "जल (Water)", value: 1.33, color: "#2DD4BF" },
          { label: "काँच (Glass)", value: 1.52, color: "#A78BFA" },
          { label: "माणिक्य (Ruby)", value: 1.77, color: "#F472B6" },
          { label: "हीरा (Diamond)", value: 2.42, color: "#FBBF24" },
        ],
        style: {
          backgroundColor: "rgba(255,255,255,0.07)",
          color: "#F0FDFA",
          borderRadius: 12,
        },
      },
      {
        id: createUid("cal"),
        type: "callout",
        name: "Diamond Insight",
        x: 596,
        y: 152,
        width: 312,
        height: 155,
        rotation: 0,
        zIndex: 4,
        animation: "fade-up",
        calloutIcon: "💎",
        content:
          "हीरे का अपवर्तनांक 2.42 सबसे अधिक होता है! इसमें प्रकाश की चाल घटकर केवल 1.24 × 10⁸ m/s रह जाती है।",
        style: {
          fontFamily: "'Plus Jakarta Sans', 'Noto Sans Devanagari', sans-serif",
          fontSize: 15.5,
          backgroundColor: "rgba(255,255,255,0.08)",
          borderColor: "#FBBF24",
          color: "#CCFBF1",
          borderRadius: 12,
          padding: 14,
          autoScaleFont: true,
        },
      },
      {
        id: createUid("shape_formula"),
        type: "shape",
        name: "Snell Law Badge",
        x: 596,
        y: 328,
        width: 312,
        height: 148,
        rotation: 0,
        zIndex: 5,
        animation: "pop-in",
        shapeKind: "rounded",
        fillColor: "#115E59",
        strokeColor: "#2DD4BF",
        strokeWidth: 2,
        content: "स्नेल का नियम (Snell's Law)\nsin i / sin r = n₂₁ = v₁ / v₂",
        style: {
          fontFamily: "'Plus Jakarta Sans', 'Noto Sans Devanagari', sans-serif",
          fontSize: 17,
          fontWeight: 700,
          color: "#FEF9C3",
          textAlign: "center",
          autoScaleFont: true,
        },
      },
    ],
  };

  const physicsSlides = [...physicsParsed, refractiveChartSlide];

  // Deck 2: Python DSA Bootcamp
  const pythonSlides = parseMarkdownToSlides(AI_PARSER_SAMPLES[1].markdown, {
    themeId: "tech-tokyo-night",
  }).slides;

  // Deck 3: Photosynthesis & Cellular Biology
  const bioSlides = parseMarkdownToSlides(AI_PARSER_SAMPLES[2].markdown, {
    themeId: "science-bio-helix",
  }).slides;

  // Deck 4: Indian Constitution & Polity (Bilingual + Chart)
  const polityMarkdown = `# भारतीय संविधान की प्रस्तावना (Preamble of the Indian Constitution) 🇮🇳
## UPSC & Civics Foundation — Live Lecture 01
### मुख्य आदर्श (Core Ideals of the Republic)
संविधान सभा द्वारा 26 नवंबर 1949 को अंगीकृत प्रस्तावना भारत के लोकतांत्रिक ढांचे की आत्मा है।
- न्याय (Justice): सामाजिक, आर्थिक और राजनीतिक न्याय
- स्वतंत्रता (Liberty): विचार, अभिव्यक्ति, विश्वास, धर्म और उपासना
- समता (Equality): प्रतिष्ठा और अवसर की समानता
- बंधुता (Fraternity): राष्ट्र की एकता और अखंडता सुनिश्चित करने वाली बंधुता
> 📜 ऐतिहासिक तथ्य: 42वें संविधान संशोधन (1976) द्वारा 'समाजवादी', 'पंथनिरपेक्ष' और 'अखंडता' शब्द जोड़े गए।

# मौलिक अधिकार (Fundamental Rights: Part III, Art. 12–35)
## नागरिकों के संवैधानिक सुरक्षा कवच
| अनुच्छेद समूह (Articles) | मौलिक अधिकार (Right) | मुख्य प्रावधान (Key Scope) |
| --- | --- | --- |
| अनुच्छेद 14–18 | समता का अधिकार | विधि के समक्ष समता, अस्पृश्यता का अंत |
| अनुच्छेद 19–22 | स्वतंत्रता का अधिकार | वाक् स्वातंत्र्य, प्राण एवं दैहिक स्वतंत्रता (Art. 21) |
| अनुच्छेद 23–24 | शोषण के विरुद्ध अधिकार | मानव दुर्व्यापार एवं बाल श्रम निषेध |
| अनुच्छेद 25–28 | धार्मिक स्वतंत्रता | अंतःकरण और धर्म के अबाध रूप से मानने का अधिकार |
| अनुच्छेद 32 | संवैधानिक उपचार | डॉ. अंबेडकर द्वारा 'संविधान की आत्मा' (5 Writs) |`;

  const politySlides = parseMarkdownToSlides(polityMarkdown, {
    themeId: "exec-upsc-sovereign",
  }).slides;

  const presentations = [
    {
      id: "deck_demo_physics_hindi",
      userId,
      folderId: folderScienceId,
      title: "प्रकाश का परावर्तन और अपवर्तन (Light: Class 10 Physics)",
      description:
        "Bilingual Hindi + English interactive physics lesson with mirror comparison table, numerical steps, and refractive index chart.",
      subject: "Physics (विज्ञान)",
      gradeLevel: "Class 10 Board",
      themeId: "bharat-peacock-teal",
      transition: "fade",
      autoFontScale: true,
      rawMarkdown: AI_PARSER_SAMPLES[0].markdown,
      slides: physicsSlides,
      slideCount: physicsSlides.length,
      isFavorite: true,
      isArchived: false,
    },
    {
      id: "deck_demo_python_dsa",
      userId,
      folderId: folderCodingId,
      title: "Mastering Binary Search & Two Pointers (CS-201)",
      description:
        "Live coding lecture featuring editable Python syntax blocks, overflow safety callouts, and Big-O complexity tables.",
      subject: "Computer Science",
      gradeLevel: "Bootcamp / B.Tech",
      themeId: "tech-tokyo-night",
      transition: "slide",
      autoFontScale: true,
      rawMarkdown: AI_PARSER_SAMPLES[1].markdown,
      slides: pythonSlides,
      slideCount: pythonSlides.length,
      isFavorite: true,
      isArchived: false,
    },
    {
      id: "deck_demo_biology_visual",
      userId,
      folderId: folderScienceId,
      title: "Photosynthesis & Cellular Bioenergetics",
      description:
        "Visual biology deck demonstrating inline SVG chloroplast diagram parsing, reaction equations, and callouts.",
      subject: "Biology",
      gradeLevel: "Grade 11",
      themeId: "science-bio-helix",
      transition: "zoom",
      autoFontScale: true,
      rawMarkdown: AI_PARSER_SAMPLES[2].markdown,
      slides: bioSlides,
      slideCount: bioSlides.length,
      isFavorite: false,
      isArchived: false,
    },
    {
      id: "deck_demo_indian_polity",
      userId,
      folderId: folderCivicsId,
      title: "भारतीय संविधान एवं मौलिक अधिकार (Indian Polity)",
      description:
        "Comprehensive bilingual civics & competitive exam deck covering the Preamble and Fundamental Rights table.",
      subject: "Polity & Civics",
      gradeLevel: "UPSC / Class 11",
      themeId: "exec-upsc-sovereign",
      transition: "fade",
      autoFontScale: true,
      rawMarkdown: polityMarkdown,
      slides: politySlides,
      slideCount: politySlides.length,
      isFavorite: false,
      isArchived: false,
    },
  ];

  const templates = [
    {
      id: "tpl_bilingual_lesson",
      userId: null,
      title: "द्विभाषी विज्ञान पाठ योजना (Bilingual STEM Lesson)",
      category: "STEM & Science",
      description:
        "Structured 4-slide starter with Learning Objectives, Comparison Table, Formula Callout, and Numerical Steps.",
      themeId: "bharat-peacock-teal",
      markdownSample: AI_PARSER_SAMPLES[0].markdown,
      slides: physicsSlides,
      isSystem: true,
    },
    {
      id: "tpl_coding_lecture",
      userId: null,
      title: "Live Coding & Algorithm Walkthrough",
      category: "Coding Bootcamp",
      description:
        "Ideal for teaching Python, JavaScript, C++, or SQL with dark terminal code boxes and Big-O tables.",
      themeId: "tech-tokyo-night",
      markdownSample: AI_PARSER_SAMPLES[1].markdown,
      slides: pythonSlides,
      isSystem: true,
    },
    {
      id: "tpl_exam_revision",
      userId: null,
      title: "Quick Revision & MCQ Capsule",
      category: "Exam Prep",
      description:
        "High-retention revision deck for JEE, NEET, UPSC, CUET, and board exam marathon sessions.",
      themeId: "chalk-emerald-board",
      markdownSample: polityMarkdown,
      slides: politySlides,
      isSystem: true,
    },
  ];

  return { folders, presentations, templates };
}
