"use client";

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { submitContactMessage, type FormState } from "@/actions/public-forms";
import { Button, Input, Label, Textarea } from "@/components/ui/form";

const initialState: FormState = {};

export function ContactForm() {
  const [state, formAction] = useFormState(submitContactMessage, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4 rounded-card border border-surface-200 bg-white p-6 shadow-card dark:border-surface-800 dark:bg-surface-900">
      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>}
      {state.success && <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">Message sent — we&apos;ll get back to you soon.</p>}
      <div>
        <Label htmlFor="name">Full Name *</Label>
        <Input id="name" name="name" placeholder="Your name" required minLength={2} />
      </div>
      <div>
        <Label htmlFor="phone">Phone / WhatsApp</Label>
        <Input id="phone" name="phone" placeholder="03xx-xxxxxxx" />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" placeholder="you@example.com" />
      </div>
      <div>
        <Label htmlFor="message">Message *</Label>
        <Textarea id="message" name="message" rows={4} placeholder="How can we help?" required minLength={5} />
      </div>
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className="w-full">{pending ? "Sending..." : "Send Message"}</Button>;
}
