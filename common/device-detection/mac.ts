// @ts-ignore
export const isMacOs = (navigator.userAgentData?.platform ?? navigator.platform)?.toUpperCase()?.indexOf('MAC') > -1;
