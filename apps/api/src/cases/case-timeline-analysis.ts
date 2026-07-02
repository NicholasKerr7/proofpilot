interface TimelineEvidenceDocument {
  id: string;
  originalName: string;
  extractedText: string | null;
  entities: {
    type: string;
    value: string;
  }[];
}

export interface TimelineAnalysisEvent {
  documentId: string;
  occurredAt: Date;
  title: string;
  description: string;
  confidence: number;
}

interface DateCandidate {
  value: string;
  index: number;
}

const datePattern =
  /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4})\b/gi;

export function analyzeTimelineEvidence(documents: TimelineEvidenceDocument[]) {
  const events = new Map<string, TimelineAnalysisEvent>();

  for (const document of documents) {
    const text = document.extractedText ?? "";
    const candidates = collectDateCandidates(document, text);

    for (const candidate of candidates) {
      const occurredAt = parseEvidenceDate(candidate.value);

      if (!occurredAt) {
        continue;
      }

      const context = extractContext(text, candidate.index);
      const classification = classifyTimelineContext(context);
      const event: TimelineAnalysisEvent = {
        documentId: document.id,
        occurredAt,
        title: classification.title,
        description: createDescription(document.originalName, candidate.value, context),
        confidence: classification.confidence
      };
      const key = `${document.id}:${toDateKey(occurredAt)}:${event.title}`;

      if (!events.has(key)) {
        events.set(key, event);
      }
    }
  }

  return [...events.values()]
    .sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime())
    .slice(0, 30);
}

function collectDateCandidates(document: TimelineEvidenceDocument, text: string) {
  const candidates = new Map<string, DateCandidate>();

  for (const entity of document.entities) {
    if (entity.type === "DATE") {
      candidates.set(entity.value.toLowerCase(), {
        value: entity.value,
        index: findDateIndex(text, entity.value)
      });
    }
  }

  for (const match of text.matchAll(datePattern)) {
    candidates.set(match[0].toLowerCase(), {
      value: match[0],
      index: match.index ?? 0
    });
  }

  return [...candidates.values()];
}

function findDateIndex(text: string, value: string) {
  const index = text.toLowerCase().indexOf(value.toLowerCase());
  return index >= 0 ? index : 0;
}

function parseEvidenceDate(value: string) {
  const normalized = value.trim();
  let parsed: Date | null = null;

  const isoMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    parsed = new Date(Date.UTC(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]), 12));
  }

  const slashMatch = normalized.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!parsed && slashMatch) {
    const year = normalizeYear(Number(slashMatch[3]));
    parsed = new Date(Date.UTC(year, Number(slashMatch[1]) - 1, Number(slashMatch[2]), 12));
  }

  if (!parsed) {
    const date = new Date(normalized);

    if (!Number.isNaN(date.getTime())) {
      parsed = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12));
    }
  }

  if (!parsed || Number.isNaN(parsed.getTime())) {
    return null;
  }

  const year = parsed.getUTCFullYear();

  if (year < 2000 || year > 2035) {
    return null;
  }

  return parsed;
}

function normalizeYear(year: number) {
  if (year < 100) {
    return year >= 70 ? 1900 + year : 2000 + year;
  }

  return year;
}

function extractContext(text: string, index: number) {
  if (!text.trim()) {
    return "";
  }

  const sentenceStart = findPreviousSentenceBoundary(text, index);
  const sentenceEnd = findNextSentenceBoundary(text, index);
  const start = Math.max(0, sentenceStart);
  const end = Math.min(text.length, sentenceEnd);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

function findPreviousSentenceBoundary(text: string, index: number) {
  for (let cursor = Math.max(0, index - 1); cursor >= 0; cursor -= 1) {
    if (text[cursor] === "\n" || text[cursor] === "." || text[cursor] === "!" || text[cursor] === "?") {
      return cursor + 1;
    }
  }

  return 0;
}

function findNextSentenceBoundary(text: string, index: number) {
  for (let cursor = index; cursor < text.length; cursor += 1) {
    if (text[cursor] === "\n" || text[cursor] === "." || text[cursor] === "!" || text[cursor] === "?") {
      return cursor + 1;
    }
  }

  return text.length;
}

function classifyTimelineContext(context: string) {
  const lowerContext = context.toLowerCase();

  if (includesAny(lowerContext, ["deadline", "due", "by this date", "must respond"])) {
    return {
      title: "Appeal deadline identified",
      confidence: 0.84
    };
  }

  if (includesAny(lowerContext, ["replied", "response", "responded", "denied", "approved", "decision"])) {
    return {
      title: "Platform response received",
      confidence: 0.82
    };
  }

  if (includesAny(lowerContext, ["support", "ticket", "appeal", "emailed", "contacted", "submitted"])) {
    return {
      title: "Support contact or appeal submitted",
      confidence: 0.82
    };
  }

  if (includesAny(lowerContext, ["transaction", "payment", "receipt", "order", "invoice", "purchase"])) {
    return {
      title: "Transaction or account activity occurred",
      confidence: 0.78
    };
  }

  if (includesAny(lowerContext, ["closed", "closure", "limited", "restricted", "suspended", "disabled", "notice"])) {
    return {
      title: "Account action notice received",
      confidence: 0.82
    };
  }

  return {
    title: "Evidence date identified",
    confidence: 0.62
  };
}

function createDescription(originalName: string, dateValue: string, context: string) {
  const trimmedContext = context.length > 220 ? `${context.slice(0, 220).trim()}...` : context;

  if (!trimmedContext) {
    return `Detected ${dateValue} in ${originalName}.`;
  }

  return `Detected ${dateValue} in ${originalName}: ${trimmedContext}`;
}

function includesAny(value: string, candidates: string[]) {
  return candidates.some((candidate) => value.includes(candidate));
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}
