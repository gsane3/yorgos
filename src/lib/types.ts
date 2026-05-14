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

export type CustomerStatus =
  | 'new_lead'
  | 'contacted'
  | 'follow_up_needed'
  | 'offer_drafted'
  | 'offer_sent'
  | 'won'
  | 'lost';

export type CustomerSource =
  | 'facebook_ads'
  | 'google_ads'
  | 'website_form'
  | 'referral'
  | 'inbound_call'
  | 'missed_call'
  | 'manual_entry'
  | 'other';

export type PreferredContactMethod = 'viber' | 'email' | 'phone';

export interface Customer {
  id: string;
  name: string;
  companyName: string;
  phone: string;
  email: string;
  address: string;
  source: CustomerSource;
  opportunityValue?: number;
  status: CustomerStatus;
  preferredContactMethod: PreferredContactMethod;
  needsSummary: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  lastContactAt?: string;
  nextTaskId?: string;
  isDemo?: boolean;
}

export interface YorgosMvpState {
  userProfile?: UserProfile;
  businessProfile?: BusinessProfile;
  workspace?: Workspace;
  // undefined = never initialized (seed demo); [] = user cleared all customers intentionally
  customers?: Customer[];
}
