/**
 * front-template-styles.ts
 *
 * Resolves a FrontBranding (with optional template) into concrete CSS classes
 * and inline styles for the public front renderer.
 */

import type { FrontBranding } from "@/types/front";
import { FRONT_TEMPLATES } from "@/types/front";

export interface TemplateStyles {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;

  // Header
  headerClass: string;
  headerStyle: React.CSSProperties;

  // Cards / widgets
  cardClass: string;

  // Sections
  sectionClass: string;

  // Hero
  heroClass: string;
  heroBtnClass: string;

  // Border radius for buttons
  btnRadius: string;

  // Footer
  footerClass: string;
}

export function resolveTemplateStyles(branding: FrontBranding): TemplateStyles {
  const template = branding.template ? FRONT_TEMPLATES[branding.template] : null;

  const primaryColor = branding.primaryColor ?? template?.primaryColor ?? "#dd7430";
  const secondaryColor = branding.secondaryColor ?? template?.secondaryColor ?? "#1e293b";
  const accentColor = template?.accentColor ?? primaryColor;

  if (!template) {
    // Legacy / no template — minimal styling, backward compatible
    return {
      primaryColor,
      secondaryColor,
      accentColor,
      headerClass: "sticky top-0 z-40 border-b border-white/10",
      headerStyle: { backgroundColor: primaryColor },
      cardClass: "rounded-xl border border-white/10 bg-white/5",
      sectionClass: "py-12 px-4",
      heroClass: "py-16 sm:py-24 text-center px-4",
      heroBtnClass: "px-6 py-3 rounded-lg",
      btnRadius: "rounded-lg",
      footerClass: "border-t border-white/10 py-6 text-center",
    };
  }

  // Resolve header styles
  let headerClass = "sticky top-0 z-40";
  const headerStyle: React.CSSProperties = {};

  switch (template.headerStyle) {
    case "gradient":
      headerClass += " border-b border-white/5";
      headerStyle.background = `linear-gradient(135deg, ${primaryColor}, ${adjustColor(primaryColor, -30)})`;
      break;
    case "blur":
      headerClass += " border-b border-white/10 backdrop-blur-xl";
      headerStyle.backgroundColor = `${secondaryColor}cc`; // semi-transparent
      break;
    case "solid":
    default:
      headerClass += " border-b border-white/10";
      headerStyle.backgroundColor = primaryColor;
      break;
  }

  // Resolve card styles
  let cardClass: string;
  const br = radiusClass(template.borderRadius);

  switch (template.cardStyle) {
    case "glass":
      cardClass = `${br} border border-white/10 bg-white/[0.06] backdrop-blur-sm shadow-lg shadow-black/10`;
      break;
    case "bordered":
      cardClass = `${br} border-2 border-white/15 bg-white/[0.03]`;
      break;
    case "flat":
    default:
      cardClass = `${br} border border-white/10 bg-white/5`;
      break;
  }

  // Resolve section spacing
  let sectionClass: string;
  switch (template.sectionSpacing) {
    case "compact":
      sectionClass = "py-8 px-4";
      break;
    case "spacious":
      sectionClass = "py-16 px-4";
      break;
    case "normal":
    default:
      sectionClass = "py-12 px-4";
      break;
  }

  // Hero
  let heroClass: string;
  switch (template.sectionSpacing) {
    case "compact":
      heroClass = "py-12 sm:py-16 text-center px-4";
      break;
    case "spacious":
      heroClass = "py-20 sm:py-32 text-center px-4";
      break;
    default:
      heroClass = "py-16 sm:py-24 text-center px-4";
      break;
  }

  const btnRadius = radiusClass(template.borderRadius);
  const heroBtnClass = `px-8 py-3.5 ${btnRadius} shadow-lg`;

  const footerClass = `border-t border-white/[0.06] py-8 text-center`;

  return {
    primaryColor,
    secondaryColor,
    accentColor,
    headerClass,
    headerStyle,
    cardClass,
    sectionClass,
    heroClass,
    heroBtnClass,
    btnRadius,
    footerClass,
  };
}

function radiusClass(radius: "sm" | "md" | "lg" | "xl"): string {
  switch (radius) {
    case "sm": return "rounded-md";
    case "md": return "rounded-lg";
    case "lg": return "rounded-xl";
    case "xl": return "rounded-2xl";
  }
}

/** Darken/lighten a hex color by amount (-255 to 255) */
function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
