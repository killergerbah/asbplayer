export const isMobile = (navigator as any).userAgentData?.mobile ?? navigator.userAgent.includes('Android') ?? false;
