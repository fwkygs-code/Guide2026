export const PLAN_DEFINITIONS = [
  {
    id: 'free',
    nameKey: 'upgrade.planNames.free',
    priceKey: 'upgrade.freePrice',
    periodKey: 'upgrade.forever',
    features: [
      { key: 'upgrade.planFeatures.workspace', count: 1 },
      { key: 'upgrade.planFeatures.categories', count: 3 },
      { key: 'upgrade.planFeatures.walkthroughs', count: 5 },
      { key: 'upgrade.planFeatures.storage', sizeKey: 'upgrade.planValues.storage.free' },
      { key: 'upgrade.planFeatures.maxFileSize', sizeKey: 'upgrade.planValues.maxFileSize.free' },
      { key: 'upgrade.planFeatures.basicSupport' }
    ],
    mediaCapacity: [
      { labelKey: 'upgrade.mediaCapacity.maxImageFileSize', valueKey: 'upgrade.mediaCapacityValues.free.maxImageFileSize' },
      { labelKey: 'upgrade.mediaCapacity.maxVideoFileSize', valueKey: 'upgrade.mediaCapacityValues.free.maxVideoFileSize' },
      { labelKey: 'upgrade.mediaCapacity.maxRawFileSize', valueKey: 'upgrade.mediaCapacityValues.free.maxRawFileSize' },
      { labelKey: 'upgrade.mediaCapacity.maxImageTransformSize', valueKey: 'upgrade.mediaCapacityValues.free.maxImageTransformSize' },
      { labelKey: 'upgrade.mediaCapacity.maxVideoTransformSize', valueKey: 'upgrade.mediaCapacityValues.free.maxVideoTransformSize' },
      { labelKey: 'upgrade.mediaCapacity.maxImageMegapixel', valueKey: 'upgrade.mediaCapacityValues.free.maxImageMegapixel' },
      { labelKey: 'upgrade.mediaCapacity.maxMegapixelAllFrames', valueKey: 'upgrade.mediaCapacityValues.free.maxMegapixelAllFrames' }
    ],
    popular: false,
    recommended: false
  },
  {
    id: 'pro',
    nameKey: 'upgrade.planNames.pro',
    priceKey: 'upgrade.proPrice',
    periodKey: 'upgrade.proPeriod',
    priceAfterKey: 'upgrade.proPeriod',
    features: [
      { key: 'upgrade.planFeatures.workspaces', count: 3 },
      { key: 'upgrade.planFeatures.unlimitedCategories' },
      { key: 'upgrade.planFeatures.unlimitedWalkthroughs' },
      { key: 'upgrade.planFeatures.storage', sizeKey: 'upgrade.planValues.storage.pro' },
      { key: 'upgrade.planFeatures.maxFileSize', sizeKey: 'upgrade.planValues.maxFileSize.pro' },
      { key: 'upgrade.planFeatures.extraStorageAvailable' },
      { key: 'upgrade.planFeatures.prioritySupport' },
      { key: 'upgrade.planFeatures.advancedFeatures' }
    ],
    mediaCapacity: [
      { labelKey: 'upgrade.mediaCapacity.maxImageFileSize', valueKey: 'upgrade.mediaCapacityValues.pro.maxImageFileSize' },
      { labelKey: 'upgrade.mediaCapacity.maxVideoFileSize', valueKey: 'upgrade.mediaCapacityValues.pro.maxVideoFileSize' },
      { labelKey: 'upgrade.mediaCapacity.maxRawFileSize', valueKey: 'upgrade.mediaCapacityValues.pro.maxRawFileSize' },
      { labelKey: 'upgrade.mediaCapacity.maxImageTransformSize', valueKey: 'upgrade.mediaCapacityValues.pro.maxImageTransformSize' },
      { labelKey: 'upgrade.mediaCapacity.maxVideoTransformSize', valueKey: 'upgrade.mediaCapacityValues.pro.maxVideoTransformSize' },
      { labelKey: 'upgrade.mediaCapacity.maxImageMegapixel', valueKey: 'upgrade.mediaCapacityValues.pro.maxImageMegapixel' },
      { labelKey: 'upgrade.mediaCapacity.maxMegapixelAllFrames', valueKey: 'upgrade.mediaCapacityValues.pro.maxMegapixelAllFrames' }
    ],
    popular: true,
    recommended: true
  },
  {
    id: 'enterprise',
    nameKey: 'upgrade.planNames.enterprise',
    priceKey: 'upgrade.customPrice',
    periodKey: 'upgrade.customPricing',
    features: [
      { key: 'upgrade.planFeatures.unlimitedWorkspaces' },
      { key: 'upgrade.planFeatures.unlimitedCategories' },
      { key: 'upgrade.planFeatures.unlimitedWalkthroughs' },
      { key: 'upgrade.planFeatures.storage', sizeKey: 'upgrade.planValues.storage.enterprise' },
      { key: 'upgrade.planFeatures.maxFileSize', sizeKey: 'upgrade.planValues.maxFileSize.enterprise' },
      { key: 'upgrade.planFeatures.customFileSizeLimits' },
      { key: 'upgrade.planFeatures.prioritySupport' },
      { key: 'upgrade.planFeatures.dedicatedAccountManager' },
      { key: 'upgrade.planFeatures.customIntegrations' }
    ],
    mediaCapacity: null,
    popular: false,
    recommended: false
  }
];
