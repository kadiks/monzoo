import { describe, expect, it } from 'vitest';

import { extractRoutesInNeed } from '../index.js';
import fs from 'fs';
import path from 'path';

describe('extractRoutesInNeed', () => {
  it('should extract routes from all fixture files', () => {
    const fixturesDir = './fixtures';
    
    // Get all enclosgestion1 HTML files in fixtures directory
    const files = fs.readdirSync(fixturesDir)
      .filter(file => file.startsWith('enclosgestion1') && file.endsWith('.html'));

    expect(files.length).toBeGreaterThan(0);

    files.forEach(file => {
      const filePath = path.join(fixturesDir, file);
      const html = fs.readFileSync(filePath, 'utf-8');
      
      // Should not throw
      const routes = extractRoutesInNeed(html);
      
      // Routes should be an array
      expect(Array.isArray(routes)).toBe(true);
      
      // Each route should be a string
      routes.forEach(route => {
        expect(typeof route).toBe('string');
      });

      console.log(`${file}: found ${routes.length} route(s)`);
    });
  });

  it('should handle empty results without errors', () => {
    const emptyHtml = '<html><body><select id="jumpMenu"></select></body></html>';
    const routes = extractRoutesInNeed(emptyHtml);
    
    expect(routes).toEqual([]);
  });

  it('should only extract options with red color style', () => {
    const html = `
      <html>
        <body>
          <select id="jumpMenu">
            <option style="color:#FF0000" value="https://monzoo.net/route1">Route 1</option>
            <option style="color:#000000" value="https://monzoo.net/route2">Route 2</option>
            <option style="color:#FF0000" value="https://monzoo.net/route3">Route 3</option>
          </select>
        </body>
      </html>
    `;
    
    const routes = extractRoutesInNeed(html);
    
    expect(routes).toHaveLength(2);
    expect(routes).toEqual(['/route1', '/route3']);
  });
});
