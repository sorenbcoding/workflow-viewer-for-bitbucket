import { XMLParser } from 'fast-xml-parser';

/** Minimal ordered XML element tree. */
export interface XElement {
  /** Qualified name as written, e.g. `ui:LogMessage`, `If.Then`. */
  name: string;
  attrs: Record<string, string>;
  children: XElement[];
  /** Concatenated direct text content, trimmed. */
  text: string;
}

const parser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: '',
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  processEntities: true,
  // Decodes numeric references such as `&#xA;` in the same single pass as `&amp;`, so `&amp;lt;` stays `&lt;`.
  htmlEntities: true,
  ignoreDeclaration: true,
  ignorePiTags: true,
  commentPropName: false,
});

type RawNode = Record<string, unknown>;

function convert(raw: RawNode): XElement | string | undefined {
  if ('#text' in raw) return String(raw['#text']);
  const name = Object.keys(raw).find((k) => k !== ':@');
  if (!name) return undefined;
  const attrs: Record<string, string> = {};
  const rawAttrs = raw[':@'] as Record<string, unknown> | undefined;
  if (rawAttrs) for (const [k, v] of Object.entries(rawAttrs)) attrs[k] = String(v);
  const children: XElement[] = [];
  let text = '';
  for (const child of (raw[name] as RawNode[]) ?? []) {
    const c = convert(child);
    if (typeof c === 'string') text += (text ? ' ' : '') + c;
    else if (c) children.push(c);
  }
  return { name, attrs, children, text };
}

/** Largest file the viewer parses, in characters (about bytes for XAML). Studio workflows are far smaller. */
export const MAX_XAML_LENGTH = 5 * 1024 * 1024;

/**
 * Parses an XML string into a tree. Throws with a readable message when the XML is malformed, too large,
 * or declares a DOCTYPE. Studio never writes a DOCTYPE; refusing it means no custom entities can be defined.
 */
export function parseXml(source: string): XElement {
  if (source.length > MAX_XAML_LENGTH) {
    const mb = (source.length / 1024 / 1024).toFixed(1);
    throw new Error(`Could not read the XAML — the file is ${mb} MB, above the viewer's 5 MB limit. Open it in Studio instead.`);
  }
  if (/<!DOCTYPE/i.test(source)) {
    throw new Error('Could not read the XAML — the file declares a DOCTYPE, which Studio workflows never contain. Check that it is a UiPath workflow file.');
  }
  const cleaned = source.replace(/^﻿/, '');
  let raw: RawNode[];
  try {
    raw = parser.parse(cleaned, true) as RawNode[];
  } catch (e) {
    throw new Error(`Could not read the XAML — the file is not well-formed XML (${(e as Error).message}). Open it in Studio to repair it.`);
  }
  for (const node of raw) {
    const el = convert(node);
    if (el && typeof el !== 'string') return el;
  }
  throw new Error('Could not read the XAML — the file has no root element. Check that it is a UiPath workflow file.');
}

export const prefixOf = (name: string): string => (name.includes(':') ? name.slice(0, name.indexOf(':')) : '');
export const localOf = (name: string): string => (name.includes(':') ? name.slice(name.indexOf(':') + 1) : name);

/** All text in an element and its descendants, e.g. the body of a `CSharpValue`. */
export function deepText(el: XElement): string {
  return [el.text, ...el.children.map(deepText)].filter(Boolean).join(' ').trim();
}
