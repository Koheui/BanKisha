/**
 * Generates an SEO-friendly slug from a string.
 * Handles Japanese text by preserving it where possible or falling back to a unique string.
 */
export function generateSlug(text: string): string {
    if (!text) return Math.random().toString(36).substring(2, 9);

    // Initial cleanup: trim and lowercase
    let slug = text.trim().toLowerCase();

    // Basic transliteration for common Japanese characters (optional, but good for SEO)
    // For simplicity, we'll keep Japanese characters as is for now as modern browsers and Google handle them well in URLs.
    // We just remove special characters that are definitely not URL-friendly.

    slug = slug
        .replace(/[￥＄％＆’（）＊＋，－．／：；＜＝＞？＠［＼］＾＿｀｛｜｝～]/g, '-') // Full-width symbols
        .replace(/[\s\W_]+/g, '-') // Replace spaces and non-word characters with -
        .replace(/^-+|-+$/g, ''); // Remove leading/trailing dashes

    // Fallback if the slug is empty after cleanup
    if (!slug) {
        return Math.random().toString(36).substring(2, 9);
    }

    return slug;
}

/**
 * Ensures a slug is unique by appending a short ID if necessary.
 * In a real app, you would check the database here.
 */
export function ensureUniqueSlug(slug: string, id: string): string {
    // Simple heuristic: just append a portion of the ID to be safe
    const shortId = id.substring(0, 5);
    return `${slug}-${shortId}`;
}
