export type BusinessType =
  | 'technical_services'
  | 'sales_services'
  | 'projects_construction'
  | 'other';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  onboardingCompleted: boolean;
}

export interface BusinessProfile {
  id: string;
  businessName: string;
  businessType: BusinessType;
  ownerName: string;
  phone: string;
  email: string;
  address: string;
  vatNumber: string;
  taxOffice: string;
  logoDataUrl: string;
  defaultVatRate: number;
  defaultOfferTerms: string;
  defaultAcceptanceText: string;
  createdAt: string;
  updatedAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  mode: 'mock_local';
}

export interface YorgosMvpState {
  userProfile?: UserProfile;
  businessProfile?: BusinessProfile;
  workspace?: Workspace;
}
