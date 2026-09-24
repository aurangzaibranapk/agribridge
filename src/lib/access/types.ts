/**
 * Ijazat ke teen hisse.
 *
 * Pehle sirf ek sawal tha: safha khulta hai ya nahi. Us se ye kehna
 * mumkin hi nahi tha ke "Milk Manager cash book DEKH sakta hai magar
 * entry nahi kar sakta, aur sirf doodh wali entries dekh sakta hai".
 * Nateeja ye nikalta tha ke ya to poori ijazat di jati thi ya bilkul
 * nahi -- aur amal mein hamesha poori di jati hai.
 */

/** Us feature par banda kya kar sakta hai. */
export const ACTIONS = ["view", "create", "edit", "verify", "approve", "reject", "export", "assign"] as const;
export type Action = (typeof ACTIONS)[number];

export const ACTION_LABEL: Record<Action, string> = {
  view: "Dekhna",
  create: "Banana",
  edit: "Badalna",
  verify: "Tasdeeq",
  approve: "Approve",
  reject: "Reject",
  export: "Export",
  assign: "Kisi ko dena",
};

/** Kis ka data dikhega. */
export const DATA_SCOPES = ["all", "own_branch", "own_shop", "own_records"] as const;
export type DataScope = (typeof DATA_SCOPES)[number];

export const SCOPE_LABEL: Record<DataScope, string> = {
  all: "Sab kuch",
  own_branch: "Sirf apni branch",
  own_shop: "Sirf apni shop",
  own_records: "Sirf apna banaya hua",
};

/**
 * Do scope mein se jo tang hai wohi chalta hai.
 *
 * Ye hamesha is tarteeb mein sochna chahiye: ijazat jama nahi hoti,
 * ghatti hai. Department Head ko "apni branch" mila hai to wo apne
 * banday ko "sab kuch" nahi de sakta, chahe form mein wo option nazar
 * aaye.
 */
const SCOPE_RANK: Record<DataScope, number> = {
  all: 4,
  own_branch: 3,
  own_shop: 2,
  own_records: 1,
};

export function narrowerScope(a: DataScope, b: DataScope): DataScope {
  return SCOPE_RANK[a] <= SCOPE_RANK[b] ? a : b;
}

export function scopeAllows(have: DataScope, want: DataScope): boolean {
  return SCOPE_RANK[have] >= SCOPE_RANK[want];
}

export function isAction(value: string): value is Action {
  return (ACTIONS as readonly string[]).includes(value);
}

export function isDataScope(value: string): value is DataScope {
  return (DATA_SCOPES as readonly string[]).includes(value);
}
