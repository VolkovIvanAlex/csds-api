export interface User {
  id: string;
  role: string;
  name: string;
  email: string;
  submissionQuatity: number;
  organizationId: string;
  photo?: string | null;
  jobTitle?: string | null;
}

export interface Organization {
  id: string;
  name: string;
  founderId?: string | null;
  wallet?: string | null;
}

export interface Report {
  id: string;
  title: string;
  description: string;
  attachments: string[];
  typeOfThreat: string;
  status: string;
  severity: string;
  submittedAt: Date | null;
  stix?: Object | null;
  blockchainHash?: string | null;
  riskScore?: number | null;
  emailsToShare: string[];
  author: {
    id: string;
    name: string;
    email: string;
  };
  organization: {
    id: string;
    name: string;
  };
  sharedWith: { sourceOrgId: string; targetOrgId: string; acceptedShare: boolean }[];
}

export interface SharedReportsWithOrganizations {
  sourceOrgId: string;
  targetOrgId: string;
  reportId: string;
  sharedAt: string;
  acceptedShare: boolean;
}

export interface Notification {
  id: string;
  title: string;
  description: string;
  status: string;
  severity: string;
  emails: string[];
}

export interface UserNotification {
  userId: string;
  notificationId: string;
}

export interface OrganizationNotification {
  organizationId: string;
  notificationId: string;
}

export interface NotificationReport {
  notificationId: string;
  reportId: string;
}