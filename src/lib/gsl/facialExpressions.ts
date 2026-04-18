export const applyFacialExpression = (gloss: string): { mouth: string, eyebrows: string } => {
  const defaults = { mouth: 'neutral', eyebrows: 'neutral' };
  
  const map: Record<string, { mouth: string, eyebrows: string }> = {
    'HELLO': { mouth: 'smile', eyebrows: 'raised' },
    'THANK_YOU': { mouth: 'smile', eyebrows: 'neutral' },
    'QUESTION': { mouth: 'neutral', eyebrows: 'raised' },
    'WHO': { mouth: 'neutral', eyebrows: 'raised' },
    'WHAT': { mouth: 'neutral', eyebrows: 'raised' },
    'WHERE': { mouth: 'neutral', eyebrows: 'raised' },
    'WHEN': { mouth: 'neutral', eyebrows: 'raised' },
    'WHY': { mouth: 'neutral', eyebrows: 'raised' },
    'HOW': { mouth: 'neutral', eyebrows: 'raised' }
  };

  return map[gloss] || defaults;
};
