export interface DHLShipment {
  Pickticket: string;
  Warehouse: string;
  Order: string;
  'Drop Date': string;
  'Ship Date': string;
  'Ship To': string;
  'Ship State': string;
  'Zip Code': string;
  'Customer PO': string;
  'Ship Via': string;
  'Load ID': string;
  Weight: string;
  SKU: string;
  Units: string;
  Price: string;
  Brand: string;
  'Size Type': string;
  Size: string;
  'Product Type': string;
}

export interface B2BiRecord {
  AXReferenceID?: string;
  Pickticket?: string;
  InvoiceNumber?: string;
  StatusSummary?: string;
  ERRORDESCRIPTION?: string;
  ERROR_DESCRIPTION?: string;
  Message?: string;
  [key: string]: any; // Allow flexible field names
}

export interface AXRecord {
  PickRoute?: string;
  Pickticket?: string;
  SalesHeaderStatus?: string;
  SalesHeaderDocStatus?: string;
  PickModeOfDelivery?: string;
  PickCreatedDate?: string;
  DeliveryDate?: string;
  [key: string]: any; // Allow flexible field names
}

export interface MergedRecord {
  // Core DHL fields
  Pickticket: string;
  Warehouse: string;
  Order: string;
  'Drop Date': string;
  'Ship Date': string;
  'Ship To': string;
  'Ship State': string;
  'Zip Code': string;
  'Customer PO': string;
  'Ship Via': string;
  'Load ID': string;
  Weight: string;
  SKU: string;
  Units: string;
  Price: string;
  Brand: string;
  'Size Type': string;
  Size: string;
  'Product Type': string;
  
  // B2Bi fields
  'Received in EDI?': string;
  'EDI Processing Status': string;
  'EDI Message': string;
  
  // AX fields
  'Found in AX?': string;
  SalesHeaderStatus: string;
  SalesHeaderDocStatus: string;
  PickModeOfDelivery: string;
  PickCreatedDate: string;
  DeliveryDate: string;
}

export interface StuckShipment extends MergedRecord {
  // UI-only fields (not exported to CSV)
  'Issue Summary'?: string;
  'Age Hours'?: number;
  'Age Label'?: string;
  'Age Badge Class'?: string;
  Severity?: 'low' | 'medium' | 'high' | 'unknown';
  OrderValue?: number;
}

export interface ReconciliationSummary {
  totalShipments: number;
  totalFailures: number;
  totalStuck: number;
}

export interface ReconciliationInsights {
  topWarehouse: string;
  topReason: string;
  oldestStuck: string;
}

export interface ReconciliationResult {
  summary: ReconciliationSummary;
  insights: ReconciliationInsights;
  stuckShipments: StuckShipment[];
  fullData: MergedRecord[];
}

export interface Snapshot {
  snapshotDate: string;
  summary: ReconciliationSummary;
  insights: ReconciliationInsights;
  byWarehouse: Array<{
    warehouse: string;
    stuckCount: number;
    avgAgeHrs: number;
    failureRatePct: number;
  }>;
}