/**
 * Check if an array of granted permissions satisfies a required permission, supporting wildcards.
 *
 * Examples:
 * - '*' satisfies 'users:read'
 * - 'users:*' satisfies 'users:read', 'users:write'
 * - 'users:read' satisfies 'users:read', but NOT 'users:write'
 * - 'reports:2026:*' satisfies 'reports:2026:download'
 */
export function matchPermission(granted: string, required: string): boolean {
  if (granted === '*' || granted === required) {
    return true;
  }

  const grantedParts = granted.split(':');
  const requiredParts = required.split(':');

  for (let i = 0; i < grantedParts.length; i++) {
    const gPart = grantedParts[i];

    if (gPart === '*') {
      return true; // Wildcard matches all subsequent segments
    }

    if (gPart !== requiredParts[i]) {
      return false;
    }
  }

  // If granted is longer than required, it doesn't match
  return grantedParts.length === requiredParts.length;
}

export function hasPermission(grantedList: string[], required: string): boolean {
  return grantedList.some((granted) => matchPermission(granted, required));
}

export function hasAllPermissions(grantedList: string[], requiredList: string[]): boolean {
  return requiredList.every((required) => hasPermission(grantedList, required));
}

export function hasAnyPermission(grantedList: string[], requiredList: string[]): boolean {
  return requiredList.some((required) => hasPermission(grantedList, required));
}
