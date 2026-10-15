"use client";

import { useFormState as useReactFormState } from "react-dom";

/**
 * react-dom ka useFormState, magar state kabhi undefined nahi hoti.
 *
 * Naye deploy ke baad purana khula tab purane Server Action ID se
 * request bhejta hai, ya beech mein proxy/WAF HTML error page lauta deta
 * hai. Us waqt action ka jawab undefined aata hai aur har jagah
 * `state.success` padhte hi poora safha "Cannot read properties of
 * undefined (reading 'success')" se gir jata tha (error_log 13-15 Oct:
 * /admin/suppliers, supplier statement, login). Ab undefined ki jagah
 * initial state wapas milti hai, aur safha chalta rehta hai.
 */
export function useFormState<State, Payload>(
  action: (state: Awaited<State>, payload: Payload) => State | Promise<State>,
  initialState: Awaited<State>,
  permalink?: string
): [state: Awaited<State>, dispatch: (payload: Payload) => void] {
  const [state, dispatch] = useReactFormState(action, initialState, permalink);
  return [(state ?? initialState) as Awaited<State>, dispatch];
}
