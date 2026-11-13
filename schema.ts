import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  institution: text("institution").default("Online Academy"),
  subjectSpecialty: text("subject_specialty").default("Multidisciplinary Educator"),
  avatarColor: text("avatar_color").default("#4F46E5"),
  preferredMode: text("preferred_mode").default("light").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const folders = pgTable("folders", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").default("#4F46E5").notNull(),
  description: text("description").default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const presentations = pgTable("presentations", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  folderId: text("folder_id").references(() => folders.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  description: text("description").default(""),
  subject: text("subject").default("General"),
  gradeLevel: text("grade_level").default("All Levels"),
  themeId: text("theme_id").default("chalk-oxford-navy").notNull(),
  transition: text("transition").default("fade").notNull(),
  autoFontScale: boolean("auto_font_scale").default(true).notNull(),
  rawMarkdown: text("raw_markdown").default(""),
  slides: jsonb("slides").notNull(),
  slideCount: integer("slide_count").default(1).notNull(),
  isFavorite: boolean("is_favorite").default(false).notNull(),
  isArchived: boolean("is_archived").default(false).notNull(),
  lastOpenedAt: timestamp("last_opened_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const templates = pgTable("templates", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  category: text("category").default("Lesson Plan").notNull(),
  description: text("description").default(""),
  themeId: text("theme_id").default("minimal-crisp-paper").notNull(),
  markdownSample: text("markdown_sample").default(""),
  slides: jsonb("slides").notNull(),
  isSystem: boolean("is_system").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
