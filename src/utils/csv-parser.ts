export function parseCSV(file: File): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());

        if (lines.length === 0) {
          resolve([]);
          return;
        }

        // Improved CSV parsing that handles various formats
        const parseCSVLine = (line: string): string[] => {
          const result: string[] = [];
          let current = '';
          let inQuotes = false;
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          
          result.push(current.trim());
          return result.map(field => field.replace(/^"|"$/g, ''));
        };

        const headers = parseCSVLine(lines[0]);
        console.log(`Parsed ${headers.length} headers:`, headers);
        
        const data: Record<string, string>[] = [];

        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          
          const values = parseCSVLine(lines[i]);
          const row: Record<string, string> = {};

          headers.forEach((header, index) => {
            // Clean header name but preserve original for mapping
            const cleanHeader = header.trim();
            row[cleanHeader] = values[index]?.trim() || '';
          });

          data.push(row);
        }

        console.log(`Parsed ${data.length} rows from ${file.name}`);
        if (data.length > 0) {
          console.log('First row sample:', data[0]);
        }
        resolve(data);
      } catch (error) {
        console.error('CSV parsing error:', error);
        reject(error);
      }
    };

    reader.onerror = () => {
      console.error('FileReader error:', reader.error);
      reject(reader.error);
    };
    reader.readAsText(file);
  });
}