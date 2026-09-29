const DEFAULT_SENSITIVE_KEYS = new Set([
  'password',
  'passwordconfirmation',
  'currentpassword',
  'newpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'secret',
  'clientsecret',
  'apikey',
  'creditcard',
  'cardnumber',
  'cvv',
  'cvc',
  'ssn'
]);

export function maskSensitiveData(data: any, customKeys?: string[]): any {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;

  const sensitiveSet = customKeys
    ? new Set([...DEFAULT_SENSITIVE_KEYS, ...customKeys.map((k) => k.toLowerCase())])
    : DEFAULT_SENSITIVE_KEYS;

  if (Array.isArray(data)) {
    return data.map((item) => maskSensitiveData(item, customKeys));
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase().replace(/[-_]/g, '');
    if (sensitiveSet.has(lowerKey)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = maskSensitiveData(value, customKeys);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}
