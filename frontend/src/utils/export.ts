import type { StuckShipment } from '../types';

export function exportToCSV(data: StuckShipment[], filename: string): void {
  if (data.length === 0) return;

  // Define the exact columns matching backend output
  const backendColumns = [
    'Warehouse', 'Pickticket', 'Order', 'Drop Date', 'Ship Date', 'Ship To',
    'Ship State', 'Zip Code', 'Customer PO', 'Ship Via', 'Load ID', 'Weight',
    'SKU', 'Units', 'Price', 'Brand', 'Size Type', 'Size', 'Product Type',
    'Received in EDI?', 'EDI Processing Status', 'EDI Message', 'Found in AX?',
    'SalesHeaderStatus', 'SalesHeaderDocStatus', 'PickModeOfDelivery', 
    'PickCreatedDate', 'DeliveryDate'
  ];

  // Create CSV with proper encoding and only required columns
  const headers = backendColumns.join(',');
  const csvContent = [
    headers,
    ...data.map(row =>
      backendColumns.map(header => {
        const value = row[header as keyof StuckShipment];
        let stringValue = value?.toString() || '';
        
        // Clean up any extra whitespace
        stringValue = stringValue.trim();
        
        // Proper CSV escaping
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(',')
    )
  ].join('\n');

  // Use proper encoding with BOM to avoid � character
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}