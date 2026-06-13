export function normalizeWorkspaceBrowserUrl(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return "about:blank";
  if (trimmed === "about:blank") return trimmed;
  if (/^[a-z][a-z\d+.-]*:/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function browserTitleFromUrl(url: string) {
  const trimmedUrl = url.trim();

  if (!trimmedUrl || trimmedUrl === "about:blank") {
    return "Blank";
  }

  try {
    const parsedUrl = new URL(trimmedUrl);
    return parsedUrl.host || parsedUrl.href;
  } catch {
    return trimmedUrl;
  }
}
