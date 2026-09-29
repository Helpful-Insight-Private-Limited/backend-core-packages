export interface RoleDefinition {
  name: string;
  permissions: string[];
  description?: string;
  inherits?: string[];
}

export interface RbacUser {
  id: string;
  roles?: string[];
  permissions?: string[];
  [key: string]: any;
}

export type AbacRuleFn = (context: {
  user: RbacUser;
  req: any;
  resource?: any;
}) => boolean | Promise<boolean>;

export interface IRbacStore {
  getUserRoles(userId: string): Promise<string[]>;
  getUserPermissions(userId: string): Promise<string[]>;
  assignRole(userId: string, roleName: string): Promise<void>;
  revokeRole(userId: string, roleName: string): Promise<void>;
}
