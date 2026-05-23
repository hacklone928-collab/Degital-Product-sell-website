import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function ensureMarkdownLinks(text: string): string {
  if (!text) return "";
  
  let formatted = text;
  
  // 1. Convert standard https / http absolute paths
  // Pattern matches http/https URL that is NOT preceded by `](` (already a markdown link target), 
  // and NOT preceded by `[` (already a markdown link text label) 
  // and NOT preceded by `=` or `"` or `'`
  formatted = formatted.replace(
    /(?<![\[\]\(\="'])(https?:\/\/[^\s\)\],"'<]+)/gi,
    (match) => {
      return `[${match}](${match})`;
    }
  );

  // 2. Identify key shop routes so user can navigate smoothly 
  // We match standard application paths like /products, /cart, /checkout, /cart-checkout, /success, /contact, /my-products, /profile, /admin etc.
  // with safe boundaries to avoid division marks or slashes.
  const allowedRoutes = [
    "products", "cart", "checkout", "cart-checkout", "success", "contact", 
    "my-products", "profile", "admin", "p\\/[a-zA-Z0-9_-]+", "product\\/[a-zA-Z0-9_-]+", "invoice\\/[a-zA-Z0-9_-]+"
  ];
  const routesRegex = new RegExp(`(?<!\\[\\[|\\(|\\[|\\/)\\b\\/(${allowedRoutes.join("|")})\\b`, "g");
  
  formatted = formatted.replace(routesRegex, (match) => {
    return `[${match}](${match})`;
  });

  return formatted;
}
