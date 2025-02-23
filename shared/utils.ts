import { JSDOM } from 'jsdom';

export function extractSelectedElements(svgContent: string, elementIds: string[]): string {
  try {
    console.log('Extracting selected elements:', {
      numElements: elementIds.length,
      elementIds,
      contentLength: svgContent.length
    });

    // Use DOMParser in browser environment, JSDOM in Node
    let document: Document;
    if (typeof window === 'undefined') {
      console.log('Server environment: using JSDOM');
      const dom = new JSDOM(svgContent);
      document = dom.window.document;
    } else {
      console.log('Browser environment: using DOMParser');
      const parser = new DOMParser();
      document = parser.parseFromString(svgContent, 'image/svg+xml');
    }

    // Extract viewBox and other necessary attributes from original SVG
    const originalSvg = document.querySelector('svg');
    if (!originalSvg) {
      console.error('No SVG element found in content');
      throw new Error("Invalid SVG: no svg element found");
    }

    console.log('Original SVG attributes:', {
      viewBox: originalSvg.getAttribute('viewBox'),
      width: originalSvg.getAttribute('width'),
      height: originalSvg.getAttribute('height')
    });

    // Create a new minimal SVG with only selected elements
    const minimalSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    minimalSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

    // Copy all attributes from original SVG
    Array.from(originalSvg.attributes).forEach(attr => {
      minimalSvg.setAttribute(attr.name, attr.value);
    });

    // Copy selected elements
    let elementsFound = 0;
    for (const id of elementIds) {
      const element = document.getElementById(id);
      if (element) {
        elementsFound++;
        console.log(`Copying element #${id}:`, {
          tagName: element.tagName,
          attributes: Array.from(element.attributes).map(a => `${a.name}="${a.value}"`).join(' ')
        });

        // Deep clone the element
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
      } else {
        console.warn(`Element #${id} not found`);
      }
    }

    console.log('Preview generation complete:', {
      elementsFound,
      totalElements: elementIds.length
    });

    const result = minimalSvg.outerHTML;
    console.log('Generated preview SVG length:', result.length);
    return result;
  } catch (error) {
    console.error('Error extracting selected elements:', error);
    return '<svg xmlns="http://www.w3.org/2000/svg"></svg>'; // Return empty SVG on error
  }
}