# Prompt 6a-stacked-fix — Polish + bug fixes + typography upgrades for stacked editor

This is the follow-up to Prompt 6a-stacked. End-to-end UI testing surfaced 7 frontend bugs and 5 feature additions, all bundled here. No backend work — every backend issue surfaced this session was already fixed in Supabase migrations before this prompt was written.

---

## Branding lock (unchanged from 6a-stacked, recap for reference)

- `bg-muted` for selected-block highlight; `border-l-4 border-[#F5741A]` for selection left-edge
- `bg-muted/30` for hover
- Navy `#021F36` + `font-display` (Poppins) for h1 + editor pane heading
- `shadow-cta` ONLY on Save buttons
- Orange `#F5741A` reserved for: links, focus rings, active toolbar buttons (subtle tint `bg-[#F5741A]/15`), selection left-border, inline + Add hover, primary CTAs
- Callout variant colors stay locked: info=teal `#006D77`, warning=amber `#FFB703`, success=forest `#2D6A4F`, important=orange `#F5741A`
- All color choosers added in this prompt use a fixed brand swatch — no hex input, no system color picker, no off-palette colors

---

## New file 1: `src/components/super-admin/lesson-blocks/BrandColorSwatch.tsx`

Reusable brand-only color picker. Used by DividerBlockForm in this prompt, and reused by future 6a-style prompt for block background colors. Lock the palette here once, reference everywhere.

```tsx
import { cn } from "@/lib/utils";

export interface BrandSwatchColor {
  /** Brand token name shown in tooltip */
  label: string;
  /** Hex value used as the canonical value passed to onChange */
  hex: string;
}

export const BRAND_SWATCH_COLORS: BrandSwatchColor[] = [
  { label: "Navy", hex: "#021F36" },
  { label: "Orange", hex: "#F5741A" },
  { label: "Teal", hex: "#006D77" },
  { label: "Forest", hex: "#2D6A4F" },
  { label: "Slate", hex: "#6D6875" },
];

interface BrandColorSwatchProps {
  /** Currently selected hex value, or null/undefined for "default" */
  value: string | null | undefined;
  onChange: (hex: string) => void;
  /** Optional: show only a subset (e.g. ["#021F36", "#F5741A"]) */
  allowedHexes?: string[];
  /** Optional: show a "default" / "none" option that calls onChange with null */
  allowDefault?: boolean;
  /** Default label, defaults to "Default" */
  defaultLabel?: string;
  onDefaultSelected?: () => void;
}

export function BrandColorSwatch({
  value,
  onChange,
  allowedHexes,
  allowDefault = false,
  defaultLabel = "Default",
  onDefaultSelected,
}: BrandColorSwatchProps) {
  const swatches = allowedHexes
    ? BRAND_SWATCH_COLORS.filter((c) => allowedHexes.includes(c.hex))
    : BRAND_SWATCH_COLORS;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {allowDefault && (
        <button
          type="button"
          onClick={() => {
            if (onDefaultSelected) onDefaultSelected();
            onChange(null as any); // hack: caller decides what null means
          }}
          className={cn(
            "rounded-md border px-2.5 py-1 text-xs transition-colors",
            !value
              ? "border-foreground bg-muted font-medium"
              : "border-border hover:bg-muted/50",
          )}
        >
          {defaultLabel}
        </button>
      )}
      {swatches.map((c) => {
        const selected = value === c.hex;
        return (
          <button
            key={c.hex}
            type="button"
            onClick={() => onChange(c.hex)}
            title={c.label}
            aria-label={c.label}
            className={cn(
              "h-7 w-7 rounded-full border-2 transition-all",
              selected
                ? "border-foreground ring-2 ring-offset-1 ring-foreground/20 scale-110"
                : "border-border hover:scale-105",
            )}
            style={{ background: c.hex }}
          />
        );
      })}
    </div>
  );
}
```

---

## Fix 1: Draft-resume column name (`user_id` → `author_id`)

**File: `src/pages/super-admin/LessonBlocksEditor.tsx`**

The lesson_block_drafts table has column `author_id`, not `user_id`. Current code queries `user_id` and never finds the draft row, so the draft-resume banner never appears.

REPLACE this block:
```tsx
const { data: { user } } = await supabase.auth.getUser();
let draft: any | null = null;
if (user) {
  const { data: d } = await supabase
    .from("lesson_block_drafts" as any)
    .select("*")
    .eq("content_item_id", contentItemId)
    .eq("user_id", user.id)
    .maybeSingle();
  draft = d ?? null;
}
```

WITH:
```tsx
const { data: { user } } = await supabase.auth.getUser();
let draft: any | null = null;
if (user) {
  const { data: d } = await supabase
    .from("lesson_block_drafts" as any)
    .select("*")
    .eq("content_item_id", contentItemId)
    .eq("author_id", user.id)
    .maybeSingle();
  draft = d ?? null;
}
```

That's the only column-name reference; everything else uses RPCs (`save_lesson_block_draft`, `discard_lesson_block_draft`) which already use the correct column on the backend side.

---

## Fix 2: Slide-in pane must constrain to main, not viewport

**File: `src/components/super-admin/lesson-blocks/EditorSlidePane.tsx`**

Currently uses `fixed left-0 top-0 z-30 h-screen` which covers the global AppLayout sidebar. Must constrain to main content area so the global app sidebar (Cole Bastian / Navigation / Assessment / etc.) stays visible during editing.

REPLACE the `<aside>` element entirely:

```tsx
<aside
  className={`editor-slide-pane fixed left-0 top-0 z-30 flex h-screen w-full flex-col border-r bg-background transition-transform duration-300 ease-out md:w-[480px] ${
    open ? "translate-x-0" : "-translate-x-full"
  }`}
  aria-hidden={!open}
>
```

WITH:

```tsx
<aside
  className={`editor-slide-pane absolute left-0 top-0 z-20 flex h-full w-full flex-col border-r bg-background shadow-md transition-transform duration-300 ease-out md:w-[480px] ${
    open ? "translate-x-0" : "-translate-x-full pointer-events-none"
  }`}
  aria-hidden={!open}
>
```

Key changes:
- `fixed` → `absolute`: pane is positioned relative to nearest positioned ancestor (the `relative` wrapper in LessonBlocksEditor.tsx body), not the viewport
- `h-screen` → `h-full`: takes height of containing element, not viewport
- `z-30` → `z-20`: lower than viewport-level chrome (Toaster, etc.)
- Added `pointer-events-none` when closed so the hidden pane doesn't intercept clicks
- Added `shadow-md` directly (was on the CSS class — leaving the CSS rule as backup is fine)

The parent wrapper in `LessonBlocksEditor.tsx` line ~445 is already `<div className="relative">` so absolute positioning will work correctly.

---

## Fix 9 + 14: Save button in pane + "Save and leave" third option

**Fix 9 — File: `src/components/super-admin/lesson-blocks/EditorSlidePane.tsx`**

Add a Save button pinned to the pane footer. Must be visually consistent with the page-header Save (orange `shadow-cta`), wired to the same save flow.

Extend the props interface:
```tsx
interface Props {
  open: boolean;
  block: EditorBlock | null;
  contentItemId: string;
  onChange: (next: EditorBlock) => void;
  onClose: () => void;
  // New props for in-pane Save
  isDirty: boolean;
  saving: boolean;
  onRequestSave: () => void;  // opens the existing save reason dialog in the parent
}
```

After the scrollable body `<div className="flex-1 overflow-y-auto">...</div>`, ADD a footer:

```tsx
<div className="border-t bg-background p-3">
  <Button
    type="button"
    className="w-full shadow-cta"
    disabled={!isDirty || saving}
    onClick={onRequestSave}
  >
    {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
    <Save className="mr-1 h-4 w-4" />
    Save lesson
  </Button>
</div>
```

Add the lucide-react `Save` and `Loader2` imports at the top of the file alongside `X`.

**Fix 14 — File: `src/pages/super-admin/LessonBlocksEditor.tsx`**

Pass the new props to `EditorSlidePane`:

REPLACE:
```tsx
<EditorSlidePane
  open={paneOpen && !!selectedBlock}
  block={selectedBlock}
  contentItemId={contentItemId!}
  onChange={updateBlock}
  onClose={() => {
    setPaneOpen(false);
    setSelectedClientId(null);
  }}
/>
```

WITH:
```tsx
<EditorSlidePane
  open={paneOpen && !!selectedBlock}
  block={selectedBlock}
  contentItemId={contentItemId!}
  onChange={updateBlock}
  onClose={() => {
    setPaneOpen(false);
    setSelectedClientId(null);
  }}
  isDirty={isDirty}
  saving={saving}
  onRequestSave={() => setSaveDialogOpen(true)}
/>
```

Now the "Save and leave" third option on the leave dialog.

REPLACE the entire leave-dialog `AlertDialogFooter` block:
```tsx
<AlertDialogFooter>
  <AlertDialogCancel
    onClick={() => {
      setShowLeaveDialog(false);
      setPendingNavigation(null);
    }}
  >
    Stay
  </AlertDialogCancel>
  <AlertDialogAction
    onClick={async () => {
      if (contentItemId) {
        try {
          await supabase.rpc("discard_lesson_block_draft" as any, {
            p_content_item_id: contentItemId,
          });
        } catch {
          // non-fatal
        }
      }
      const target = pendingNavigation;
      setShowLeaveDialog(false);
      setPendingNavigation(null);
      if (target && target !== "__browser_back__") {
        navigate(target);
      } else if (target === "__browser_back__") {
        window.history.back();
      }
    }}
  >
    Discard and leave
  </AlertDialogAction>
</AlertDialogFooter>
```

WITH:
```tsx
<AlertDialogFooter>
  <AlertDialogCancel
    onClick={() => {
      setShowLeaveDialog(false);
      setPendingNavigation(null);
    }}
  >
    Stay
  </AlertDialogCancel>
  <Button
    type="button"
    variant="outline"
    onClick={async () => {
      if (contentItemId) {
        try {
          await supabase.rpc("discard_lesson_block_draft" as any, {
            p_content_item_id: contentItemId,
          });
        } catch {
          // non-fatal
        }
      }
      const target = pendingNavigation;
      setShowLeaveDialog(false);
      setPendingNavigation(null);
      if (target && target !== "__browser_back__") {
        navigate(target);
      } else if (target === "__browser_back__") {
        window.history.back();
      }
    }}
  >
    Discard and leave
  </Button>
  <AlertDialogAction
    className="shadow-cta"
    onClick={(e) => {
      e.preventDefault();
      // Remember the destination, close the leave dialog, open the save reason dialog.
      // After successful save, navigate via the remembered destination.
      setShowLeaveDialog(false);
      setSaveAndNavigateTo(pendingNavigation);
      setPendingNavigation(null);
      setSaveDialogOpen(true);
    }}
  >
    Save and leave
  </AlertDialogAction>
</AlertDialogFooter>
```

Note: "Discard and leave" is now a plain `<Button variant="outline">` (no longer using `AlertDialogAction`) because the third Save-and-leave button is now the primary `AlertDialogAction` with `shadow-cta` styling, indicating it's the recommended path. The Discard path stays as a less-emphasized outline button.

Add new state at the top of the component near other useState calls:
```tsx
const [saveAndNavigateTo, setSaveAndNavigateTo] = useState<string | null>(null);
```

Modify `handleSave` to navigate after a successful save IF `saveAndNavigateTo` is set:

REPLACE the existing `handleSave`:
```tsx
const handleSave = async () => {
  if (!contentItemId) return;
  if (saveReason.trim().length < 10) return;
  setSaving(true);
  draftStatus.pause();
  try {
    const { error } = await supabase.rpc("replace_lesson_blocks" as any, {
      p_content_item_id: contentItemId,
      p_blocks: stripIdsForRpc(blocks),
      p_reason: saveReason.trim(),
    });
    if (error) throw error;
    toast({ title: "Lesson blocks saved." });
    setSaveDialogOpen(false);
    setSaveReason("");
    await reload();
    draftStatus.resume();
  } catch (e: any) {
    toast({ title: "Save failed", description: e.message ?? String(e), variant: "destructive" });
    draftStatus.resume();
  } finally {
    setSaving(false);
  }
};
```

WITH:
```tsx
const handleSave = async () => {
  if (!contentItemId) return;
  if (saveReason.trim().length < 10) return;
  setSaving(true);
  draftStatus.pause();
  try {
    const { error } = await supabase.rpc("replace_lesson_blocks" as any, {
      p_content_item_id: contentItemId,
      p_blocks: stripIdsForRpc(blocks),
      p_reason: saveReason.trim(),
    });
    if (error) throw error;
    toast({ title: "Lesson blocks saved." });
    setSaveDialogOpen(false);
    setSaveReason("");
    await reload();
    draftStatus.resume();
    // If this save was triggered from the leave dialog, navigate now
    if (saveAndNavigateTo) {
      const target = saveAndNavigateTo;
      setSaveAndNavigateTo(null);
      if (target === "__browser_back__") {
        window.history.back();
      } else {
        navigate(target);
      }
    }
  } catch (e: any) {
    toast({ title: "Save failed", description: e.message ?? String(e), variant: "destructive" });
    draftStatus.resume();
    // If save failed during a save-and-leave flow, clear the pending nav and let the user stay
    setSaveAndNavigateTo(null);
  } finally {
    setSaving(false);
  }
};
```

Also handle cancel: if the user opens the save reason dialog via "Save and leave" but then clicks Cancel inside, we should clear `saveAndNavigateTo`.

Find the save dialog's `AlertDialogCancel` and REPLACE:
```tsx
<AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
```

WITH:
```tsx
<AlertDialogCancel
  disabled={saving}
  onClick={() => setSaveAndNavigateTo(null)}
>
  Cancel
</AlertDialogCancel>
```

---

## Fix 3: Heading sizes match spec

**File: `src/components/super-admin/lesson-blocks/BlockRenderer.tsx`**

REPLACE the `HeadingRender` function:
```tsx
function HeadingRender({ text, level }: { text: string; level: number }) {
  const safeLevel = level === 2 || level === 3 || level === 4 ? level : 2;
  const sizeClass =
    safeLevel === 2 ? "text-2xl" : safeLevel === 3 ? "text-xl" : "text-lg";
  const Tag = `h${safeLevel}` as "h2" | "h3" | "h4";
  return (
    <Tag
      className={`font-display font-bold tracking-tight ${sizeClass}`}
      style={{ color: "#021F36" }}
    >
      {text || (
        <span className="font-sans text-sm font-normal italic text-muted-foreground">
          Untitled heading
        </span>
      )}
    </Tag>
  );
}
```

WITH:
```tsx
function HeadingRender({ text, level }: { text: string; level: number }) {
  const safeLevel = level === 2 || level === 3 || level === 4 ? level : 2;
  const sizeClass =
    safeLevel === 2
      ? "text-3xl mt-8 mb-4"
      : safeLevel === 3
      ? "text-2xl mt-6 mb-3"
      : "text-xl mt-4 mb-2";
  const weightClass = safeLevel === 2 ? "font-bold" : "font-semibold";
  const Tag = `h${safeLevel}` as "h2" | "h3" | "h4";
  return (
    <Tag
      className={`font-display tracking-tight ${weightClass} ${sizeClass}`}
      style={{ color: "#021F36" }}
    >
      {text || (
        <span className="font-sans text-sm font-normal italic text-muted-foreground">
          Untitled heading
        </span>
      )}
    </Tag>
  );
}
```

H2: `text-3xl` (was `text-2xl`); H3: `text-2xl` (was `text-xl`); H4: `text-xl` (was `text-lg`). Adds vertical breathing room via mt/mb classes for hierarchy. H2 is bold; H3/H4 are semibold for visual subordination.

---

## Fix 4: Spurious draft autosave on block select

**File: `src/components/super-admin/lesson-blocks/useLessonBlockDraft.ts`**

Currently the hook detects "dirty" via `JSON.stringify(blocks) !== prev`. Problem: TipTap normalizes JSON on first render (e.g., adds `marks: []` to empty text nodes, etc.), so when the readonly renderer instantiates a TipTap editor for the same block, the JSON gets normalized DIFFERENTLY than the editable form's output, and the resulting serialized state differs from `initialBlocks`. This dirty-detects the page even though the user made no real edit.

Fix: deep-normalize the JSON before comparison. Walk the TipTap doc and strip any keys that are empty arrays or undefined.

REPLACE the entire useEffect at lines 24-57 of the file:

```tsx
useEffect(() => {
  if (!enabled) return;
  if (pausedRef.current) return;
  const serialized = JSON.stringify(blocks);
  if (prevSerialized.current === null) {
    prevSerialized.current = serialized;
    return;
  }
  if (serialized === prevSerialized.current) return;
  prevSerialized.current = serialized;

  if (timer.current) clearTimeout(timer.current);
  timer.current = setTimeout(async () => {
    if (pausedRef.current) return;
    setStatus("saving");
    try {
      const { error } = await supabase.rpc("save_lesson_block_draft" as any, {
        p_content_item_id: contentItemId,
        p_draft_json: { blocks },
      });
      if (error) throw error;
      setStatus("saved");
      setLastSavedAt(new Date());
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("save_lesson_block_draft failed", e);
      setStatus("error");
    }
  }, 3000);

  return () => {
    if (timer.current) clearTimeout(timer.current);
  };
}, [blocks, enabled, contentItemId]);
```

WITH:

```tsx
// Deep-normalize a value for stable comparison. Strips empty arrays/objects
// so TipTap's marks: [] / content: [] noise doesn't trip false dirty detection.
function normalizeForCompare(v: any): any {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v)) {
    const normalized = v.map(normalizeForCompare).filter((x) => x !== undefined);
    return normalized;
  }
  if (typeof v === "object") {
    const out: any = {};
    const keys = Object.keys(v).sort();
    for (const k of keys) {
      const nv = normalizeForCompare(v[k]);
      if (nv === undefined) continue;
      if (Array.isArray(nv) && nv.length === 0) continue;
      if (nv === null || nv === "") continue;
      out[k] = nv;
    }
    return out;
  }
  return v;
}

function stableSerialize(blocks: EditorBlock[]): string {
  return JSON.stringify(normalizeForCompare(blocks));
}

useEffect(() => {
  if (!enabled) return;
  if (pausedRef.current) return;
  const serialized = stableSerialize(blocks);
  if (prevSerialized.current === null) {
    prevSerialized.current = serialized;
    return;
  }
  if (serialized === prevSerialized.current) return;
  prevSerialized.current = serialized;

  if (timer.current) clearTimeout(timer.current);
  timer.current = setTimeout(async () => {
    if (pausedRef.current) return;
    setStatus("saving");
    try {
      const { error } = await supabase.rpc("save_lesson_block_draft" as any, {
        p_content_item_id: contentItemId,
        p_draft_json: { blocks },
      });
      if (error) throw error;
      setStatus("saved");
      setLastSavedAt(new Date());
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("save_lesson_block_draft failed", e);
      setStatus("error");
    }
  }, 3000);

  return () => {
    if (timer.current) clearTimeout(timer.current);
  };
}, [blocks, enabled, contentItemId]);
```

The two helper functions go at the top of the file (after imports, before the `useLessonBlockDraft` export).

Also apply the same normalization to `isDirty` detection in `LessonBlocksEditor.tsx`. Currently at ~line 142:

```tsx
const isDirty = useMemo(
  () => JSON.stringify(blocks) !== JSON.stringify(initialBlocks),
  [blocks, initialBlocks],
);
```

REPLACE with:
```tsx
const isDirty = useMemo(() => {
  // Use the same normalization as useLessonBlockDraft to avoid TipTap JSON
  // shape variations triggering false-dirty.
  const normalize = (v: any): any => {
    if (v === null || v === undefined) return null;
    if (Array.isArray(v)) return v.map(normalize).filter((x) => x !== undefined);
    if (typeof v === "object") {
      const out: any = {};
      for (const k of Object.keys(v).sort()) {
        const nv = normalize(v[k]);
        if (nv === undefined) continue;
        if (Array.isArray(nv) && nv.length === 0) continue;
        if (nv === null || nv === "") continue;
        out[k] = nv;
      }
      return out;
    }
    return v;
  };
  return JSON.stringify(normalize(blocks)) !== JSON.stringify(normalize(initialBlocks));
}, [blocks, initialBlocks]);
```

(Same logic inline rather than importing — these are small enough that duplication is fine and keeps the two functions decoupled.)

---

## Fix 5: Inline + Add visible at rest

**File: `src/components/super-admin/lesson-blocks/InlineAddButton.tsx`**

Currently `style={{ height: 6 }}` + `border-transparent` makes the button effectively invisible. Users can't discover it.

REPLACE the entire `<button>` element inside the PopoverTrigger:
```tsx
<button
  type="button"
  aria-label="Add block"
  className="group relative flex w-full items-center justify-center overflow-hidden rounded-md border border-dashed border-transparent text-xs text-muted-foreground transition-all hover:h-8 hover:border-[#F5741A]/40 hover:bg-[#F5741A]/5 hover:text-[#F5741A]"
  style={{ height: 6 }}
  onMouseEnter={(e) => (e.currentTarget.style.height = "32px")}
  onMouseLeave={(e) => (e.currentTarget.style.height = "6px")}
>
  <span className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
    <Plus className="h-3.5 w-3.5" />
    Add block
  </span>
</button>
```

WITH:
```tsx
<button
  type="button"
  aria-label="Add block"
  className="group relative flex w-full items-center justify-center gap-1 overflow-hidden rounded-md border border-dashed text-xs transition-all hover:h-9 hover:bg-[#F5741A]/5"
  style={{
    height: 12,
    borderColor: "#DCD7C8",
    color: "#8E8995",
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.height = "36px";
    e.currentTarget.style.borderColor = "#F5741A";
    e.currentTarget.style.color = "#F5741A";
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.height = "12px";
    e.currentTarget.style.borderColor = "#DCD7C8";
    e.currentTarget.style.color = "#8E8995";
  }}
>
  <span className="flex items-center gap-1 opacity-50 transition-opacity group-hover:opacity-100">
    <Plus className="h-3 w-3" />
    <span className="hidden group-hover:inline">Add block</span>
  </span>
</button>
```

Key changes:
- Resting height: 6px → 12px (visible)
- Resting border: transparent → `#DCD7C8` (cream-400 visible dashed line)
- Resting `+` icon: invisible (opacity-0) → 50% opacity (visible but quiet)
- "Add block" label: appears only on hover (saves vertical space at rest)
- Hover height: 32px → 36px
- Hover orange border + text color via inline style (Tailwind arbitrary class doesn't combine well with the height transition)

---

## Fix 11: Undo toast position to bottom-right

**File: `src/components/super-admin/lesson-blocks/UndoDeleteToast.tsx`**

REPLACE:
```tsx
className="fixed bottom-6 left-6 z-50 w-72 overflow-hidden rounded-md border border-l-4 bg-background shadow-md"
```

WITH:
```tsx
className="fixed bottom-6 right-6 z-50 w-72 overflow-hidden rounded-md border border-l-4 bg-background shadow-md"
```

Single attribute change: `left-6` → `right-6`. Matches platform Toaster convention.

---

## Fix 13: Text-size controls in RichTextEditor toolbar

**File: `src/components/super-admin/lesson-blocks/RichTextEditor.tsx`**

Currently H2 and H3 buttons are gated behind `!compact`. List items use `compact={true}` so they have no heading controls. Quote and callout use non-compact and have H2/H3.

Changes:
1. Add H4 button alongside H2/H3
2. Add a "Lead paragraph" toggle (mark a paragraph as larger/leading body text)
3. Make H2/H3/H4 visible in compact mode too — but the Lead toggle stays non-compact only (it doesn't make sense inside a list item)

REPLACE the compact-gated block (`{!compact && (...)}` starting around line 105 with all 6 inner buttons) with:

```tsx
<Button
  type="button"
  size="sm"
  variant="ghost"
  className={btnClass(editor.isActive("strike"))}
  onClick={() => editor.chain().focus().toggleStrike().run()}
  disabled={disabled}
  aria-label="Strike"
>
  <Strikethrough className="h-3.5 w-3.5" />
</Button>
<Button
  type="button"
  size="sm"
  variant="ghost"
  className={btnClass(editor.isActive("bulletList"))}
  onClick={() => editor.chain().focus().toggleBulletList().run()}
  disabled={disabled}
  aria-label="Bullet list"
>
  <ListIcon className="h-3.5 w-3.5" />
</Button>
<Button
  type="button"
  size="sm"
  variant="ghost"
  className={btnClass(editor.isActive("orderedList"))}
  onClick={() => editor.chain().focus().toggleOrderedList().run()}
  disabled={disabled}
  aria-label="Numbered list"
>
  <ListOrdered className="h-3.5 w-3.5" />
</Button>
<Button
  type="button"
  size="sm"
  variant="ghost"
  className={btnClass(editor.isActive("heading", { level: 2 }))}
  onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
  disabled={disabled}
  aria-label="Heading 2"
>
  <Heading2 className="h-3.5 w-3.5" />
</Button>
<Button
  type="button"
  size="sm"
  variant="ghost"
  className={btnClass(editor.isActive("heading", { level: 3 }))}
  onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
  disabled={disabled}
  aria-label="Heading 3"
>
  <Heading3 className="h-3.5 w-3.5" />
</Button>
<Button
  type="button"
  size="sm"
  variant="ghost"
  className={btnClass(editor.isActive("heading", { level: 4 }))}
  onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
  disabled={disabled}
  aria-label="Heading 4"
>
  <Heading4 className="h-3.5 w-3.5" />
</Button>
{!compact && (
  <Button
    type="button"
    size="sm"
    variant="ghost"
    className={cn(
      "h-7 px-2 text-xs",
      editor.isActive("paragraph", { class: "lead" }) && "bg-[#F5741A]/15 text-[#F5741A] hover:bg-[#F5741A]/20",
    )}
    onClick={() => {
      // Toggle a 'lead' class on the current paragraph via the TextStyle extension
      const isLead = editor.getAttributes("textStyle")?.fontSize === "lead";
      if (isLead) {
        editor.chain().focus().setMark("textStyle", { fontSize: null }).run();
      } else {
        editor.chain().focus().setMark("textStyle", { fontSize: "lead" }).run();
      }
    }}
    disabled={disabled}
    aria-label="Lead paragraph"
    title="Larger paragraph text"
  >
    Lead
  </Button>
)}
```

Remove the `{!compact && (...)}` wrapper that surrounds the original H2/H3 group, since the new structure unconditionally shows Strike/Bullet/Numbered/H2/H3/H4 and only the Lead toggle stays compact-gated.

Add `Heading4` to the lucide-react imports at the top.

Add the CSS styling for the lead class. **File: `src/components/super-admin/lesson-blocks/lesson-blocks.css`**, append:

```css
/* Lead paragraph — slightly larger, used for emphasis/intro text */
.tiptap-prose [data-font-size="lead"],
.tiptap-prose span[style*="lead"] {
  font-size: 1.15rem;
  line-height: 1.6;
  font-weight: 500;
}
```

Note on TipTap implementation: the existing `TextStyle` extension supports the `fontSize` attribute via the mark interface. The above CSS targets either custom data attribute or inline style. If the TextStyle extension as currently configured doesn't pass through `fontSize: "lead"` cleanly, a fallback is to use a custom mark — but try this approach first since it's smaller.

---

## Fix 16: Body font + bigger bullets + filled-circle numbered markers

**File: `src/components/super-admin/lesson-blocks/lesson-blocks.css`**

REPLACE the existing list bullet rules:

```css
/* Branded list bullets in BrainWise orange */
.tiptap-prose ul {
  list-style: none;
  padding-left: 1.5em;
}
.tiptap-prose ul li {
  position: relative;
}
.tiptap-prose ul li::before {
  content: "•";
  color: #F5741A;
  font-weight: bold;
  position: absolute;
  left: -1em;
}

/* Numbered list markers in orange */
.tiptap-prose ol {
  list-style: none;
  counter-reset: item;
  padding-left: 1.5em;
}
.tiptap-prose ol li {
  position: relative;
  counter-increment: item;
}
.tiptap-prose ol li::before {
  content: counter(item) ".";
  color: #F5741A;
  font-weight: bold;
  position: absolute;
  left: -1.5em;
}

/* Links — orange, underlined */
.tiptap-prose a {
  color: #F5741A;
  text-decoration: underline;
}
```

WITH:

```css
/* Base body typography — bumped from 16px to 17px for readability */
.tiptap-prose {
  font-size: 1.0625rem; /* 17px */
  line-height: 1.65;
}

/* Branded list — forest green filled discs */
.tiptap-prose ul {
  list-style: none;
  padding-left: 1.75em;
}
.tiptap-prose ul li {
  position: relative;
  padding-left: 0.25em;
  margin: 0.25em 0;
}
.tiptap-prose ul li::before {
  content: "";
  display: inline-block;
  width: 0.65em;
  height: 0.65em;
  border-radius: 50%;
  background: #2D6A4F;
  position: absolute;
  left: -1.25em;
  top: 0.55em;
}

/* Branded numbered list — orange filled circles with white number */
.tiptap-prose ol {
  list-style: none;
  counter-reset: item;
  padding-left: 2.25em;
}
.tiptap-prose ol li {
  position: relative;
  counter-increment: item;
  padding-left: 0.25em;
  margin: 0.5em 0;
}
.tiptap-prose ol li::before {
  content: counter(item);
  position: absolute;
  left: -1.85em;
  top: 0.1em;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5em;
  height: 1.5em;
  border-radius: 50%;
  background: #F5741A;
  color: #FFFFFF;
  font-size: 0.85em;
  font-weight: 700;
  font-family: var(--font-display, "Poppins", sans-serif);
}

/* Links — orange, underlined */
.tiptap-prose a {
  color: #F5741A;
  text-decoration: underline;
  text-underline-offset: 2px;
}
```

This gives:
- Body text 17px (was 16px) with 1.65 line-height for breathing room
- Bullets: forest green filled disc, 0.65em diameter, positioned to align with first line of text
- Numbered: orange filled circle, 1.5em diameter, white Poppins number inside

The bullet/number colors are hardcoded as defaults. A future enhancement (out of scope for this prompt) could let authors swap them per-block via brand swatch — but as you locked, brand-only and consistent defaults are correct for v1.

---

## Fix 17: Divider more distinct + brand color choice

**File: `src/components/super-admin/lesson-blocks/BlockRenderer.tsx`**

REPLACE the divider case in the `BlockRenderer` switch:
```tsx
case "divider":
  return <hr className="border-t border-border" />;
```

WITH:
```tsx
case "divider": {
  const dividerColor = cfg.color || "#021F36";
  return (
    <hr
      className="my-6 rounded-full border-0"
      style={{
        height: "3px",
        background: dividerColor,
      }}
    />
  );
}
```

Default Navy. 3px thick. Rounded for a designed feel.

**File: `src/components/super-admin/lesson-blocks/block-forms/DividerBlockForm.tsx`**

Currently:
```tsx
export function DividerBlockForm() {
  return (
    <div className="text-sm text-muted-foreground">
      Dividers have no configuration.
    </div>
  );
}
```

REPLACE entire file contents WITH:
```tsx
import { Label } from "@/components/ui/label";
import { BrandColorSwatch } from "../BrandColorSwatch";

interface Props {
  value: { color?: string | null };
  onConfigChange: (next: { color?: string | null }) => void;
}

export function DividerBlockForm({ value, onConfigChange }: Props) {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Divider color</Label>
        <BrandColorSwatch
          value={value?.color ?? "#021F36"}
          onChange={(hex) => onConfigChange({ ...value, color: hex })}
        />
        <p className="text-xs text-muted-foreground">
          Choose a brand color for this divider. Defaults to Navy.
        </p>
      </div>
    </div>
  );
}
```

**File: `src/components/super-admin/lesson-blocks/BlockEditorPane.tsx`**

The divider dispatch needs to pass `value` and `onConfigChange`:

REPLACE:
```tsx
{block.block_type === "divider" && <DividerBlockForm />}
```

WITH:
```tsx
{block.block_type === "divider" && (
  <DividerBlockForm value={cfg} onConfigChange={handleConfig} />
)}
```

**File: `src/components/super-admin/lesson-blocks/blockTypeMeta.ts`**

Update the divider default config:

REPLACE:
```tsx
divider: {
  label: "Divider",
  description: "Horizontal rule",
  icon: Minus,
  defaultConfig: () => ({}),
},
```

WITH:
```tsx
divider: {
  label: "Divider",
  description: "Horizontal rule",
  icon: Minus,
  defaultConfig: () => ({ color: "#021F36" }),
},
```

---

## Acceptance criteria

1. Reloading a page with an unsaved draft (autosaved within 3 seconds) shows the "You have an unsaved draft" banner with Pick up / Start over options
2. The slide-in pane no longer covers the global AppLayout sidebar — the Cole Bastian / Navigation sidebar stays visible while the pane is open
3. H2/H3/H4 in the stack render at text-3xl/text-2xl/text-xl with vertical breathing room (mt/mb)
4. Selecting a block (clicking to open the pane without making edits) does NOT trigger a draft autosave or flip the status badge to "Saved (draft)"
5. Inline `+ Add block` is visible at rest as a dashed line about 12px tall — discoverable without hovering
6. Slide-in pane has a Save button pinned to the footer with `shadow-cta`, full-width, and the same enable/disable logic as the page-header Save
7. Leave-changes dialog has THREE buttons: Stay (outline), Discard and leave (outline), Save and leave (primary with shadow-cta). Save-and-leave opens the reason dialog; on successful save, navigation proceeds to the originally-attempted destination
8. Undo delete toast appears at bottom-RIGHT corner (not bottom-left)
9. RichTextEditor toolbar shows Bold / Italic / Strike / Bullet / Numbered / H2 / H3 / H4 in all uses (text, quote, callout, list items). Lead button appears only in non-compact uses
10. Body text in stack renders at 17px with 1.65 line-height
11. Bullet markers are forest green `#2D6A4F` filled discs, larger than before
12. Numbered markers are orange `#F5741A` filled circles with white Poppins numerals inside
13. Divider block renders as a 3px-thick rounded line, default Navy, with a brand color swatch picker in its form
14. Brand color swatch component (`BrandColorSwatch`) used for divider color, ready to reuse by future 6a-style block-background picker
15. No regressions to existing acceptance criteria from 6a-stacked

---

## Non-goals (deferred to future prompts)

- Block background color + padding (6a-style) — separate prompt. Will reuse the `BrandColorSwatch` component built here.
- Multi-select + Manage Blocks panel (6a-manage)
- AI authoring (6a-AI)
- 7 remaining block types (6b)
- knowledge_check block (6c)
- Per-block override of bullet/number color via brand swatch (consistent defaults are correct for v1)
- Theme-level color customization at the course level

