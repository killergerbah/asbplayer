export const isMobile =
    navigator.userAgent.toLowerCase().includes('android') ?? (navigator as any).userAgentData?.mobile ?? false;
