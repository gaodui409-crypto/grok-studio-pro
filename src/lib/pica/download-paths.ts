function safeDirectoryPart(title: string, fallback: string): string {
  const cleaned = Array.from(title.trim(), (char) => {
    const code = char.charCodeAt(0);
    return code < 32 || '<>:"/\\|?*'.includes(char) ? "_" : char;
  })
    .join("")
    .replace(/[. ]+$/g, "");
  const name = cleaned.slice(0, 64).replace(/[. ]+$/g, "") || fallback;
  return /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name) ? `_${name}` : name;
}

export function comicDirectoryName(title: string, id: string): string {
  return `${safeDirectoryPart(title, "comic")}-${id}`;
}

export function chapterDirectoryName(order: number, title: string, id: string): string {
  const prefix = Number.isFinite(order)
    ? String(Math.max(0, Math.trunc(order))).padStart(4, "0")
    : "0000";
  return `${prefix}-${safeDirectoryPart(title, "chapter")}-${id}`;
}
