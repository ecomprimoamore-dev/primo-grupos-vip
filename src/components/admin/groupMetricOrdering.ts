import type { GroupMetricItem, StoreMetricItem } from '../../types';

const preferredStoreSlugs = ['barigui', 'quadrata', 'patio'];
const preferredStoreOrder = new Map(preferredStoreSlugs.map((slug, index) => [slug, index]));

export function orderGroupMetricsForDisplay(
  groups: GroupMetricItem[],
  stores: StoreMetricItem[],
): GroupMetricItem[] {
  const storeSlugById = new Map(stores.map((store) => [store.storeId, store.storeSlug.toLowerCase()]));

  const statusOrder = (group: GroupMetricItem) => {
    if (group.isCurrentRoutingTarget) return 0;
    if (group.isActive && group.currentClicks < group.clickLimit) return 1;
    return 2;
  };

  const storeOrder = (group: GroupMetricItem) =>
    preferredStoreOrder.get(storeSlugById.get(group.storeId) || '') ?? preferredStoreSlugs.length;

  return [...groups].sort((left, right) => {
    const statusDifference = statusOrder(left) - statusOrder(right);
    if (statusDifference) return statusDifference;

    const storeDifference = storeOrder(left) - storeOrder(right);
    if (storeDifference) return storeDifference;

    if (storeOrder(left) === preferredStoreSlugs.length) {
      const nameDifference = left.storeName.localeCompare(right.storeName, 'pt-BR');
      if (nameDifference) return nameDifference;
    }

    return left.displayOrder - right.displayOrder || left.groupId.localeCompare(right.groupId);
  });
}
