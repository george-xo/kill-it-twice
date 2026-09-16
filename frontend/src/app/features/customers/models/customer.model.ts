export type CustomerStatus = 'active' | 'inactive';

export interface Customer {
  id: string;
  name: string;
  email: string;
  status: CustomerStatus;
  attributes: Record<string, unknown>;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerListResponse {
  items: Customer[];
  total: number;
  nextCursor: string | null;
}

export interface CustomerSearchParams {
  query?: string;
  status?: CustomerStatus;
  cursor?: string;
  limit?: number;
}
