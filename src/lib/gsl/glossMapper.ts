export const mapTextToGloss = (input: string): string[] => {
  const lower = input.toLowerCase();
  const cleaned = lower.replace(/[^a-z0-9\s]/g, ' ');
  const rawTokens = cleaned.split(/\s+/).filter(Boolean);
  
  const fillers = new Set(['uh', 'um', 'erm', 'mm', 'mmm', 'ah', 'eh', 'please', 'like']);
  const auxiliaries = new Set(['can', 'could', 'would', 'should', 'shall', 'will', 'do', 'does', 'did', 'is', 'are', 'am', 'was', 'were']);
  
  const filtered = rawTokens.filter(word => !fillers.has(word) && !auxiliaries.has(word));
  return filtered.map(t => t.toUpperCase());
};
