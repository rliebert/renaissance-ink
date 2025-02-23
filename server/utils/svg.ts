import { JSDOM } from 'jsdom';

export function extractSelectedElements(svgContent: string, elementIds: string[]): string {
  try {
    const dom = new JSDOM(svgContent);
    const document = dom.window.document;

    // Extract viewBox and other necessary attributes from original SVG
    const originalSvg = document.querySelector('svg');
    if (!originalSvg) {
      throw new Error("Invalid SVG: no svg element found");
    }

    // Create a new minimal SVG with only selected elements
    const minimalSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    minimalSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

    // Copy all attributes from original SVG
    Array.from(originalSvg.attributes).forEach(attr => {
      minimalSvg.setAttribute(attr.name, attr.value);
    });

    // Copy selected elements
    for (const id of elementIds) {
      const element = document.getElementById(id);
      if (element) {
        const clone = element.cloneNode(true) as Element;

        // Ensure all child elements have proper SVG namespace
        if (clone.children.length > 0) {
          const setNamespace = (el: Element) => {
            if (!el.namespaceURI) {
              const newEl = document.createElementNS('http://www.w3.org/2000/svg', el.tagName.toLowerCase());
              Array.from(el.attributes).forEach(attr => {
                newEl.setAttribute(attr.name, attr.value);
              });
              el.parentNode?.replaceChild(newEl, el);
            }
            Array.from(el.children).forEach(setNamespace);
          };
          setNamespace(clone);
        }

        minimalSvg.appendChild(clone);
      }
    }

    return minimalSvg.outerHTML;
  } catch (error) {
    console.error('Error extracting selected elements:', error);
    return '<svg xmlns="http://www.w3.org/2000/svg"></svg>'; // Return empty SVG on error
  }
}
