import type { ComponentType } from "react";

export interface RoleModule {
  RoleScreen: ComponentType<any>;
}

/** Har role alag bundle. App sirf current role import karta hai. */
export function loadRoleModule(role: string): Promise<RoleModule> {
  switch (role) {
    case "farmer":
      return import("./farmer");
    case "customer":
      return import("./customer");
    case "staff":
      return import("./staff");
    case "admin":
      return import("./admin");
    case "mca":
      return import("./mca");
    case "mco":
      return import("./mco");
    case "vet":
      return import("./vet");
    default:
      return import("./later");
  }
}
