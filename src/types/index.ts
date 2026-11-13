export type DistributionMode = 'automatic' | 'manual';

export interface Store {
  id: string;
  name: string;
  slug: string;
  description: string;
  logoUrl?: string;
  isActive: boolean;
  distributionMode: DistributionMode;
  manualActiveGroupId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VipGroup {
  id: string;
  storeId: string;
  name: string;
  inviteUrl: string;
  clickLimit: number;
  currentClicks: number;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AccessEvent {
  id: string;
  storeId: string;
  visitorHash: string;
  userAgent?: string;
  referrer?: string;
  createdAt: string;
}

export interface ClickEvent {
  id: string;
  storeId: string;
  groupId: string;
  visitorHash: string;
  idempotencyKey?: string;
  createdAt: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'superadmin' | 'admin';
}

export interface StoreMetricItem {
  storeId: string;
  storeName: string;
  storeSlug: string;
  isActive: boolean;
  totalAccesses: number;
  totalClicks: number;
  conversionRate: number; // percentage
  activeGroupName: string | null;
  totalGroups: number;
  fullGroups: number;
}

export interface GroupMetricItem {
  groupId: string;
  storeId: string;
  storeName: string;
  groupName: string;
  inviteUrl: string;
  clickLimit: number;
  currentClicks: number;
  displayOrder: number;
  isActive: boolean;
  isCurrentRoutingTarget: boolean;
  percentFull: number;
}

export interface RecentEventItem {
  id: string;
  storeName: string;
  groupName: string;
  createdAt: string;
  visitorHash: string;
}

export interface DashboardMetrics {
  totalAccesses: number;
  totalClicks: number;
  conversionRate: number;
  totalStores: number;
  activeStores: number;
  storeMetrics: StoreMetricItem[];
  groupMetrics: GroupMetricItem[];
  recentEvents: RecentEventItem[];
}
