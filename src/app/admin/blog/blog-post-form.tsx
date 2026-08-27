"use client";

import { useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { saveBlogPost, generateBlogDraftAction, type ActionState, type AIDraftState } from "@/actions/cms";
import { Button, Input, Label, Select, Textarea } from "@/components/ui/form";
import { VoiceDictationButton } from "@/components/admin/voice-dictation-button";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { Sparkles } from "lucide-react";

const initialState: ActionState = {};
const initialAIState: AIDraftState = {};

export function BlogPostForm({ post }: { post?: any }) {
  const [state, formAction] = useFormState(saveBlogPost, initialState);
  const [aiState, aiAction] = useFormState(generateBlogDraftAction, initialAIState);

  const titleRef = useRef<HTMLInputElement>(null);
  const excerptRef = useRef<HTMLTextAreaElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  if (aiState.data) {
    if (aiState.data.title && titleRef.current && !titleRef.current.value) titleRef.current.value = aiState.data.title;
    if (aiState.data.excerpt && excerptRef.current && !excerptRef.current.value) excerptRef.current.value = aiState.data.excerpt;
    if (aiState.data.content && contentRef.current && !contentRef.current.value) contentRef.current.value = aiState.data.content;
  }

  return (
    <form action={formAction} className="max-w-2xl space-y-4 rounded-card border border-surface-200 bg-white p-6 shadow-card dark:border-surface-800 dark:bg-surface-900">
      {post?.id && <input type="hidden" name="id" value={post.id} />}
      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>}

      <div className="rounded-card border border-surface-200 bg-surface-50 p-4 dark:border-surface-800 dark:bg-surface-800/50">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-surface-400 dark:text-surface-500">3 Ways to Write This Post</p>
        <p className="mb-1 text-sm text-surface-600 dark:text-surface-300">1. Manual - type into the fields below</p>
        <p className="mb-1 text-sm text-surface-600 dark:text-surface-300">2. Voice - tap the mic next to Title, Excerpt, or Content and speak</p>
        <p className="mb-2 text-sm text-surface-600 dark:text-surface-300">3. AI Draft - type a topic, let AI draft a starting point:</p>
        <AIDraftButton action={aiAction} />
        {aiState.notConfigured && (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
            AI drafting isn&apos;t connected yet - needs the Gemini API key configured (GEMINI_API_KEY). Manual and Voice both work right now.
          </p>
        )}
        {aiState.data && <p className="mt-2 text-xs text-brand-600 dark:text-brand-400">Draft filled in below - please review and edit before publishing.</p>}
      </div>

      <div>
        <Label htmlFor="title">Title *</Label>
        <div className="flex gap-2">
          <Input ref={titleRef} id="title" name="title" required defaultValue={post?.title} className="flex-1" />
          <VoiceDictationButton onResult={(text) => { if (titleRef.current) titleRef.current.value = text; }} />
        </div>
      </div>

      <div>
        <Label htmlFor="category">Category</Label>
        <Select id="category" name="category" defaultValue={post?.category ?? "Farming Tips"}>
          <option value="Farming Tips">Farming Tips</option>
          <option value="Product Guides">Product Guides</option>
          <option value="Company News">Company News</option>
          <option value="Success Stories">Success Stories</option>
        </Select>
      </div>

      <ImageUploadField bucket="website-media" fieldName="featured_image_url" label="Featured Image" defaultUrl={post?.featured_image_url} />

      <div>
        <Label htmlFor="excerpt">Excerpt</Label>
        <div className="flex gap-2">
          <Textarea ref={excerptRef} id="excerpt" name="excerpt" rows={2} defaultValue={post?.excerpt} className="flex-1" />
          <VoiceDictationButton onResult={(text) => { if (excerptRef.current) excerptRef.current.value = text; }} />
        </div>
      </div>

      <div>
        <Label htmlFor="content">Content *</Label>
        <div className="flex gap-2">
          <Textarea ref={contentRef} id="content" name="content" rows={10} required defaultValue={post?.content} className="flex-1" />
          <VoiceDictationButton onResult={(text) => { if (contentRef.current) contentRef.current.value = (contentRef.current.value ? contentRef.current.value + " " : "") + text; }} />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-surface-700 dark:text-surface-300">
        <input type="checkbox" name="is_published" defaultChecked={post?.is_published} /> Published
      </label>
      <SubmitButton />
    </form>
  );
}

function AIDraftButton({ action }: { action: any }) {
  const { pending } = useFormStatus();
  return (
    <form action={action} className="flex gap-2">
      <Input name="topic" placeholder="e.g. Wheat sowing tips for Punjab" className="flex-1" />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-brand-200 bg-white px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50 dark:border-brand-800 dark:bg-surface-900 dark:text-brand-400"
      >
        <Sparkles className="h-3.5 w-3.5" /> {pending ? "Drafting..." : "AI Draft"}
      </button>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? "Saving..." : "Save Post"}</Button>;
}