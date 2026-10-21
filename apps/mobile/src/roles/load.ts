import type { ComponentType } from "react";

export interface RoleModule {
  RoleScreen: ComponentType<any>;
}

/** Har role alag bundle. App sirf current role import karta hai. */
export function loadRoleModule(role: string): Promise<RoleModule> {
  switch (role) {
    case "farmer":
      return import("./farmer");
    case "mca":
      return import("./mca");
    case "mco":
      return import("./mco");
    default:
      return import("./later");
  }
}
