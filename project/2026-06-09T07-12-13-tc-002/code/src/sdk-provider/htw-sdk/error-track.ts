const isNotMatch = (objectA: any, arrayB: string[]): string | undefined => {
  for (const element of arrayB) {
    if (!objectA[element]) return element;
  }
  return undefined;
};

export const trackForParamsError = (name: string, missValue: string, subParams: any) => {
  const actualParams = JSON.stringify(subParams || {});
  try {
    if (typeof window !== 'undefined' && (window as any).Omega?.trackEvent) {
      (window as any).Omega.trackEvent('tech_px_htwsdk_params_error', '', {
        method_name: name,
        miss_value: missValue,
        actual_params: actualParams,
      });
    }
  } catch {
    // silently ignore tracking errors
  }
};

export const diffParamsForTrack = (name: string, params: any, requiredParams: string[]) => {
  try {
    const subParams = JSON.parse(JSON.stringify(params || {}));
    const result = isNotMatch(params, requiredParams);
    if (!result) return;
    trackForParamsError(name, result, subParams);
  } catch {
    // silently ignore
  }
};
