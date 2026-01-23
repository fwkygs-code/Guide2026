import { api } from '../lib/api';

export const fetchOnboardingStatus = async () => {
  const response = await api.getOnboardingStatus();
  return response.data;
};

export const completeOnboarding = async () => {
  await api.completeOnboarding();
};

export const dismissOnboarding = async () => {
  await api.dismissOnboarding();
};
