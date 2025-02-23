import { JSDOM } from 'jsdom';

export function extractSelectedElements(svgContent: string, elementIds: string[]): string {
  try {
    // Use DOMParser in browser environment, JSDOM in Node
    let document: Document;
    if (typeof window === 'undefined') {
      // Server-side: use JSDOM
      const dom = new JSDOM(svgContent);
      document = dom.window.document;
    } else {
      // Browser: use DOMParser
      const parser = new DOMParser();
      document = parser.parseFromString(svgContent, 'image/svg+xml');
    }

    // Extract viewBox and other necessary attributes from original SVG
    const originalSvg = document.querySelector('svg');
    if (!originalSvg) throw new Error("Invalid SVG: no svg element found");

    const viewBox = originalSvg.getAttribute('viewBox');
    const width = originalSvg.getAttribute('width');
    const height = originalSvg.getAttribute('height');

    // Create a new minimal SVG with only selected elements
    const minimalSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    minimalSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    if (viewBox) minimalSvg.setAttribute('viewBox', viewBox);
    if (width) minimalSvg.setAttribute('width', width);
    if (height) minimalSvg.setAttribute('height', height);

    // Copy selected elements
    for (const id of elementIds) {
      const element = document.getElementById(id);
      if (element) {
        const clone = element.cloneNode(true) as Node;
        minimalSvg.appendChild(clone);
      }
    }

    return minimalSvg.outerHTML;
  } catch (error) {
    console.error('Error extracting selected elements:', error);
    return '<svg xmlns="http://www.w3.org/2000/svg"></svg>'; // Return empty SVG on error
  }
}