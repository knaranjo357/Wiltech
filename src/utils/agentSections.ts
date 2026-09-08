/** Split Markdown headings while preserving headings inside fenced examples. */
export function splitAgentSections(text: string): string[] {
  const sections: string[] = [];
  let lines: string[] = [];
  let fence: { marker: string; length: number } | null = null;
  const flush = () => {
    const content = lines.join('\n').trim();
    if (content) sections.push(content);
    lines = [];
  };
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    const match = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (!fence && /^ {0,3}#{1,6}\s+/.test(line)) flush();
    lines.push(line);
    if (match) {
      if (!fence) fence = { marker: match[1][0], length: match[1].length };
      else if (match[1][0] === fence.marker && match[1].length >= fence.length && !match[2].trim()) fence = null;
    }
  }
  flush();
  return sections;
}
