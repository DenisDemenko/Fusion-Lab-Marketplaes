// Accepts the shapes a seller would actually paste — watch?v=, youtu.be/,
// an already-embed URL, a bare 11-char video id, or a playlist link
// (`?list=...&index=N`, the shape the seed data actually uses) — and
// returns a youtube-nocookie embed URL, or null if none of those match.
// nocookie only sets its tracking cookie once the visitor actually
// presses play, not on page load.
export function youtubeEmbedUrl(input: string): string | null {
  const trimmed = input.trim();

  const videoPatterns = [
    /(?:youtube\.com\/watch\?v=|youtube-nocookie\.com\/embed\/|youtu\.be\/)([A-Za-z0-9_-]{11})/,
    /^([A-Za-z0-9_-]{11})$/,
  ];

  for (const pattern of videoPatterns) {
    const match = pattern.exec(trimmed);
    if (match) {
      return `https://www.youtube-nocookie.com/embed/${match[1]}`;
    }
  }

  const listMatch = /[?&]list=([A-Za-z0-9_-]+)/.exec(trimmed);
  if (listMatch) {
    const indexMatch = /[?&]index=(\d+)/.exec(trimmed);
    const index = indexMatch ? `&index=${indexMatch[1]}` : "";
    return `https://www.youtube-nocookie.com/embed/videoseries?list=${listMatch[1]}${index}`;
  }

  return null;
}
