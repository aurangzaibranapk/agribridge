import type { ComponentType } from "react";
import * as admin from "./admin";
import * as dealer from "./dealer";
import * as farmer from "./farmer";
import * as later from "./later";
import * as mca from "./mca";
import * as mco from "./mco";
import * as staff from "./staff";
import * as vet from "./vet";

export interface RoleModule {
  RoleScreen: ComponentType<any>;
}

const modules: Record<string, RoleModule> = {
  farmer,
  customer: farmer,
  staff,
  admin,
  mca,
  mco,
  vet,
  dealer,
};

/** Static imports. Web par async chunk "unknown module" par crash karta tha. */
export function loadRoleModule(role: string): Promise<RoleModule> {
  return Promise.resolve(modules[role] ?? later);
}
