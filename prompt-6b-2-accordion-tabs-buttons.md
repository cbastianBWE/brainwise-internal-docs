# Prompt 6b.2 — Three remaining lesson block form components: accordion + tabs + button_stack

## Context

This is the second of two Lovable prompts (6b.1 + 6b.2). Prompt 6b.1 already shipped: `blockTypeMeta.ts` has all 5 new types in the union and meta, `BlockEditorPane.tsx` accepts `siblingBlocks` and dispatches stat_callout + statement_a_b forms, `BlockRenderer.tsx` has all 5 render components and switch cases, `lesson-blocks.css` has CSS for all 5 types, `EditorSlidePane.tsx` and `LessonBlocksEditor.tsx` pass `siblingBlocks` through.

After 6b.1, accordion / tabs / button_stack can be added via Add Block popover and render correctly, but selecting them in the editor shows only the universal Style section (no type-specific form). **This prompt (6b.2) creates the three missing BlockForm components and wires them into BlockEditorPane's dispatch.**

## Standing rules (must hold)

1. **Universal Style section is inherited, not re-implemented**: `BlockStyleSection` already mounts in `BlockEditorPane` after the form dispatch. The 3 new BlockForm components MUST NOT render their own Style section.

2. **`@dnd-kit` reorder pattern is locked to ListBlockForm's structure**: each draggable item uses `useSortable` keyed on `client_id` (uuid). `PointerSensor` with `activationConstraint: { distance: 4 }`. Drag handle uses `GripVertical` icon from lucide-react.

3. **No new dependencies**: shadcn `Tabs`, `Accordion`, `RadioGroup`, `Tooltip` primitives already in `src/components/ui/`.

4. **Brand-only color enforcement**: not relevant in these three forms — no color pickers here. The button colors (primary orange, secondary navy outline) are hardcoded in the render components shipped in 6b.1.

## Files to MODIFY

### 1. `src/components/super-admin/lesson-blocks/BlockEditorPane.tsx`

Two changes:

**A. Add three new imports** at the top alongside existing block-form imports:

```tsx
import { AccordionBlockForm } from "./block-forms/AccordionBlockForm";
import { TabsBlockForm } from "./block-forms/TabsBlockForm";
import { ButtonStackBlockForm } from "./block-forms/ButtonStackBlockForm";
```

**B. Add three new dispatch cases** in the same dispatch block, BEFORE the `<BlockStyleSection ... />` line, alongside the existing stat_callout and statement_a_b cases shipped in 6b.1:

```tsx
{block.block_type === "accordion" && <AccordionBlockForm value={cfg} onConfigChange={handleConfig} />}
{block.block_type === "tabs" && <TabsBlockForm value={cfg} onConfigChange={handleConfig} />}
{block.block_type === "button_stack" && (
  <ButtonStackBlockForm
    value={cfg}
    onConfigChange={handleConfig}
    siblingBlocks={siblingBlocks.filter((b) => b.client_id !== block.client_id)}
  />
)}
```

No other changes to BlockEditorPane.tsx.

## Files to CREATE

### 2. `src/components/super-admin/lesson-blocks/block-forms/AccordionBlockForm.tsx`

Pattern: copies ListBlockForm's @dnd-kit reorder structure. Each item has a title + body. Min 1 item, max 6. Keyboard shortcut: pressing Enter at end of a title with text adds a new section.

```tsx
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "../RichTextEditor";
import type { TipTapDocJSON } from "../blockTypeMeta";

type Item = { client_id: string; title: string; body: TipTapDocJSON };

interface Props {
  value: { items: Item[] };
  onConfigChange: (next: { items: Item[] }) => void;
}

const emptyDoc = (): TipTapDocJSON => ({
  type: "doc",
  content: [{ type: "paragraph" }],
});

function SortableItem({
  item,
  onChange,
  onDelete,
  onEnterAtEnd,
  canDelete,
}: {
  item: Item;
  onChange: (next: Item) => void;
  onDelete: () => void;
  onEnterAtEnd: () => void;
  canDelete: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.client_id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="rounded-md border bg-background p-2">
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-2 cursor-grab text-muted-foreground hover:text-foreground"
          {...attributes}
          {...listeners}
          aria-label="Drag section"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex-1 space-y-2">
          <Input
            value={item.title}
            onChange={(e) => onChange({ ...item, title: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter" && item.title.trim().length > 0) {
                e.preventDefault();
                onEnterAtEnd();
              }
            }}
            placeholder="Section title"
            className="font-medium"
          />
          <RichTextEditor
            value={item.body}
            onChange={(next) => onChange({ ...item, body: next })}
            placeholder="Section body — revealed when this section is opened"
            compact
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="mt-1 h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
          onClick={onDelete}
          aria-label="Remove section"
          disabled={!canDelete}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function AccordionBlockForm({ value, onConfigChange }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const items = value.items ?? [];

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.client_id === active.id);
    const to = items.findIndex((i) => i.client_id === over.id);
    if (from < 0 || to < 0) return;
    onConfigChange({ items: arrayMove(items, from, to) });
  };

  const handleItemChange = (next: Item) => {
    onConfigChange({
      items: items.map((i) => (i.client_id === next.client_id ? next : i)),
    });
  };

  const handleDelete = (clientId: string) => {
    if (items.length <= 1) {
      onConfigChange({ items: [{ client_id: crypto.randomUUID(), title: "", body: emptyDoc() }] });
      return;
    }
    onConfigChange({ items: items.filter((i) => i.client_id !== clientId) });
  };

  const handleAdd = () => {
    if (items.length >= 6) return;
    onConfigChange({
      items: [...items, { client_id: crypto.randomUUID(), title: "", body: emptyDoc() }],
    });
  };

  return (
    <div className="space-y-3">
      <Label>Sections</Label>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((i) => i.client_id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {items.map((item) => (
              <SortableItem
                key={item.client_id}
                item={item}
                onChange={handleItemChange}
                onDelete={() => handleDelete(item.client_id)}
                onEnterAtEnd={handleAdd}
                canDelete={items.length > 1}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <Button type="button" size="sm" variant="outline" onClick={handleAdd} disabled={items.length >= 6}>
        <Plus className="mr-1 h-3.5 w-3.5" />
        Add section
      </Button>
      {items.length >= 6 && (
        <p className="text-xs text-muted-foreground">Max 6 sections — split into multiple blocks if needed.</p>
      )}
    </div>
  );
}
```

### 3. `src/components/super-admin/lesson-blocks/block-forms/TabsBlockForm.tsx`

Pattern: like AccordionBlockForm but adds default_tab selector + underline/pills style choice. 2-6 tabs. Reorder-aware: dragging a tab adjusts `default_tab` index correctly.

```tsx
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RichTextEditor } from "../RichTextEditor";
import type { TipTapDocJSON } from "../blockTypeMeta";

type Tab = { client_id: string; label: string; body: TipTapDocJSON };
type TabStyle = "underline" | "pills";

interface Props {
  value: {
    tabs: Tab[];
    default_tab: number;
    style: TabStyle;
  };
  onConfigChange: (next: Props["value"]) => void;
}

const emptyDoc = (): TipTapDocJSON => ({
  type: "doc",
  content: [{ type: "paragraph" }],
});

function SortableTab({
  tab,
  onChange,
  onDelete,
  canDelete,
}: {
  tab: Tab;
  onChange: (next: Tab) => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: tab.client_id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="rounded-md border bg-background p-2">
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-2 cursor-grab text-muted-foreground hover:text-foreground"
          {...attributes}
          {...listeners}
          aria-label="Drag tab"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex-1 space-y-2">
          <Input
            value={tab.label}
            onChange={(e) => onChange({ ...tab, label: e.target.value })}
            placeholder="Tab label"
            className="font-medium"
            maxLength={32}
          />
          <RichTextEditor
            value={tab.body}
            onChange={(next) => onChange({ ...tab, body: next })}
            placeholder="Tab content"
            compact
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="mt-1 h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
          onClick={onDelete}
          aria-label="Remove tab"
          disabled={!canDelete}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function TabsBlockForm({ value, onConfigChange }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const tabs = value.tabs ?? [];
  const defaultTab = Number.isInteger(value.default_tab) ? value.default_tab : 0;
  const tabStyle: TabStyle = value.style === "pills" ? "pills" : "underline";

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = tabs.findIndex((t) => t.client_id === active.id);
    const to = tabs.findIndex((t) => t.client_id === over.id);
    if (from < 0 || to < 0) return;
    const reordered = arrayMove(tabs, from, to);
    // Adjust default_tab if movement shifted the default's index
    let newDefault = defaultTab;
    if (defaultTab === from) newDefault = to;
    else if (defaultTab > from && defaultTab <= to) newDefault = defaultTab - 1;
    else if (defaultTab < from && defaultTab >= to) newDefault = defaultTab + 1;
    onConfigChange({ ...value, tabs: reordered, default_tab: newDefault });
  };

  const handleTabChange = (next: Tab) => {
    onConfigChange({
      ...value,
      tabs: tabs.map((t) => (t.client_id === next.client_id ? next : t)),
    });
  };

  const handleDelete = (clientId: string) => {
    if (tabs.length <= 2) return; // min 2 tabs
    const idx = tabs.findIndex((t) => t.client_id === clientId);
    const next = tabs.filter((t) => t.client_id !== clientId);
    let newDefault = defaultTab;
    if (defaultTab === idx) newDefault = 0;
    else if (defaultTab > idx) newDefault = defaultTab - 1;
    onConfigChange({ ...value, tabs: next, default_tab: newDefault });
  };

  const handleAdd = () => {
    if (tabs.length >= 6) return;
    onConfigChange({
      ...value,
      tabs: [
        ...tabs,
        { client_id: crypto.randomUUID(), label: `Tab ${tabs.length + 1}`, body: emptyDoc() },
      ],
    });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Tab style</Label>
        <RadioGroup
          value={tabStyle}
          onValueChange={(v) => onConfigChange({ ...value, style: v as TabStyle })}
          className="grid grid-cols-2 gap-2"
        >
          <Label className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm font-normal has-[:checked]:border-foreground has-[:checked]:bg-muted/30">
            <RadioGroupItem value="underline" />
            <span>Underline (default)</span>
          </Label>
          <Label className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm font-normal has-[:checked]:border-foreground has-[:checked]:bg-muted/30">
            <RadioGroupItem value="pills" />
            <span>Pills</span>
          </Label>
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <Label>Default open tab</Label>
        <Select
          value={String(defaultTab)}
          onValueChange={(v) => onConfigChange({ ...value, default_tab: Number(v) })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {tabs.map((t, idx) => (
              <SelectItem key={t.client_id} value={String(idx)}>
                {t.label || `Tab ${idx + 1}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Tabs</Label>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={tabs.map((t) => t.client_id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {tabs.map((t) => (
                <SortableTab
                  key={t.client_id}
                  tab={t}
                  onChange={handleTabChange}
                  onDelete={() => handleDelete(t.client_id)}
                  canDelete={tabs.length > 2}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <Button type="button" size="sm" variant="outline" onClick={handleAdd} disabled={tabs.length >= 6}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add tab
        </Button>
        {tabs.length >= 6 && (
          <p className="text-xs text-muted-foreground">Max 6 tabs — split into multiple blocks if needed.</p>
        )}
      </div>
    </div>
  );
}
```

### 4. `src/components/super-admin/lesson-blocks/block-forms/ButtonStackBlockForm.tsx`

Pattern: each button has label + action_type (link/jump_to_block) + conditional url-input or jump-target-Select + variant (primary/secondary). Jump-target Select shows friendly per-block-type labels for sibling blocks. Layout toggle (stacked/inline). 1-4 buttons.

```tsx
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X, Plus, Link2, ArrowDownToLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BLOCK_TYPE_META, extractTextFromTipTap, type EditorBlock } from "../blockTypeMeta";

type ActionType = "link" | "jump_to_block";
type ButtonVariant = "primary" | "secondary";
type Layout = "stacked" | "inline";

type ButtonEntry = {
  client_id: string;
  label: string;
  action_type: ActionType;
  url: string | null;
  target_block_client_id: string | null;
  variant: ButtonVariant;
};

interface Props {
  value: {
    buttons: ButtonEntry[];
    layout: Layout;
  };
  onConfigChange: (next: Props["value"]) => void;
  siblingBlocks: EditorBlock[];
}

function friendlyBlockLabel(block: EditorBlock): string {
  const meta = BLOCK_TYPE_META[block.block_type];
  const typeLabel = meta?.label ?? block.block_type;
  const cfg: any = block.config ?? {};
  switch (block.block_type) {
    case "heading":
      return `${typeLabel}: ${cfg.text || "(empty)"}`.slice(0, 80);
    case "text":
    case "quote":
    case "callout": {
      const snippet = extractTextFromTipTap(cfg.body).slice(0, 60);
      return `${typeLabel}: ${snippet || "(empty)"}`;
    }
    case "stat_callout":
      return `${typeLabel}: ${cfg.stat || "(empty)"} — ${cfg.label || ""}`.slice(0, 80);
    case "statement_a_b":
      return `${typeLabel}: ${cfg.a_label || "A"} vs ${cfg.b_label || "B"}`;
    case "accordion":
      return `${typeLabel} (${(cfg.items ?? []).length} sections)`;
    case "tabs":
      return `${typeLabel} (${(cfg.tabs ?? []).length} tabs)`;
    case "list":
      return `${typeLabel} (${(cfg.items ?? []).length} items)`;
    case "image":
      return `${typeLabel}: ${cfg.alt || "(no alt)"}`;
    case "video_embed":
      return `${typeLabel}: ${cfg.title || "(untitled)"}`;
    case "embed_audio":
      return `${typeLabel}${cfg.transcript ? " (with transcript)" : ""}`;
    case "divider":
      return typeLabel;
    case "button_stack":
      return `${typeLabel} (${(cfg.buttons ?? []).length} buttons)`;
    default:
      return typeLabel;
  }
}

function SortableButton({
  btn,
  siblingBlocks,
  onChange,
  onDelete,
  canDelete,
}: {
  btn: ButtonEntry;
  siblingBlocks: EditorBlock[];
  onChange: (next: ButtonEntry) => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: btn.client_id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="rounded-md border bg-background p-3 space-y-2">
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-2 cursor-grab text-muted-foreground hover:text-foreground"
          {...attributes}
          {...listeners}
          aria-label="Drag button"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex-1 space-y-2">
          <Input
            value={btn.label}
            onChange={(e) => onChange({ ...btn, label: e.target.value })}
            placeholder="Button label"
            className="font-medium"
            maxLength={40}
          />

          <RadioGroup
            value={btn.action_type}
            onValueChange={(v) =>
              onChange({
                ...btn,
                action_type: v as ActionType,
                url: v === "link" ? (btn.url ?? "") : null,
                target_block_client_id: v === "jump_to_block" ? btn.target_block_client_id : null,
              })
            }
            className="grid grid-cols-2 gap-2"
          >
            <Label className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-xs font-normal has-[:checked]:border-foreground has-[:checked]:bg-muted/30">
              <RadioGroupItem value="link" />
              <Link2 className="h-3.5 w-3.5" />
              <span>Link out</span>
            </Label>
            <Label className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-xs font-normal has-[:checked]:border-foreground has-[:checked]:bg-muted/30">
              <RadioGroupItem value="jump_to_block" />
              <ArrowDownToLine className="h-3.5 w-3.5" />
              <span>Jump to block</span>
            </Label>
          </RadioGroup>

          {btn.action_type === "link" ? (
            <Input
              value={btn.url ?? ""}
              onChange={(e) => onChange({ ...btn, url: e.target.value })}
              placeholder="https://… or /internal/path"
              type="url"
            />
          ) : (
            <Select
              value={btn.target_block_client_id ?? ""}
              onValueChange={(v) =>
                onChange({ ...btn, target_block_client_id: v || null })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={siblingBlocks.length === 0 ? "(no other blocks yet)" : "Choose target block"} />
              </SelectTrigger>
              <SelectContent>
                {siblingBlocks.map((b) => (
                  <SelectItem key={b.client_id} value={b.client_id}>
                    {friendlyBlockLabel(b)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="space-y-1">
            <Label className="text-xs">Style</Label>
            <RadioGroup
              value={btn.variant}
              onValueChange={(v) => onChange({ ...btn, variant: v as ButtonVariant })}
              className="grid grid-cols-2 gap-2"
            >
              <Label className="flex cursor-pointer items-center gap-2 rounded-md border p-1.5 text-xs font-normal has-[:checked]:border-foreground has-[:checked]:bg-muted/30">
                <RadioGroupItem value="primary" />
                <span>Primary</span>
              </Label>
              <Label className="flex cursor-pointer items-center gap-2 rounded-md border p-1.5 text-xs font-normal has-[:checked]:border-foreground has-[:checked]:bg-muted/30">
                <RadioGroupItem value="secondary" />
                <span>Secondary</span>
              </Label>
            </RadioGroup>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="mt-1 h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
          onClick={onDelete}
          aria-label="Remove button"
          disabled={!canDelete}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function ButtonStackBlockForm({ value, onConfigChange, siblingBlocks }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const buttons = value.buttons ?? [];
  const layout: Layout = value.layout === "inline" ? "inline" : "stacked";

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = buttons.findIndex((b) => b.client_id === active.id);
    const to = buttons.findIndex((b) => b.client_id === over.id);
    if (from < 0 || to < 0) return;
    onConfigChange({ ...value, buttons: arrayMove(buttons, from, to) });
  };

  const handleChange = (next: ButtonEntry) => {
    onConfigChange({
      ...value,
      buttons: buttons.map((b) => (b.client_id === next.client_id ? next : b)),
    });
  };

  const handleDelete = (clientId: string) => {
    if (buttons.length <= 1) return;
    onConfigChange({
      ...value,
      buttons: buttons.filter((b) => b.client_id !== clientId),
    });
  };

  const handleAdd = () => {
    if (buttons.length >= 4) return;
    onConfigChange({
      ...value,
      buttons: [
        ...buttons,
        {
          client_id: crypto.randomUUID(),
          label: "",
          action_type: "link",
          url: "",
          target_block_client_id: null,
          variant: "primary",
        },
      ],
    });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Layout</Label>
        <RadioGroup
          value={layout}
          onValueChange={(v) => onConfigChange({ ...value, layout: v as Layout })}
          className="grid grid-cols-2 gap-2"
        >
          <Label className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm font-normal has-[:checked]:border-foreground has-[:checked]:bg-muted/30">
            <RadioGroupItem value="stacked" />
            <span>Stacked (full-width)</span>
          </Label>
          <Label className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm font-normal has-[:checked]:border-foreground has-[:checked]:bg-muted/30">
            <RadioGroupItem value="inline" />
            <span>Inline (wrap row)</span>
          </Label>
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <Label>Buttons</Label>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={buttons.map((b) => b.client_id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {buttons.map((b) => (
                <SortableButton
                  key={b.client_id}
                  btn={b}
                  siblingBlocks={siblingBlocks}
                  onChange={handleChange}
                  onDelete={() => handleDelete(b.client_id)}
                  canDelete={buttons.length > 1}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <Button type="button" size="sm" variant="outline" onClick={handleAdd} disabled={buttons.length >= 4}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add button
        </Button>
        {buttons.length >= 4 && (
          <p className="text-xs text-muted-foreground">Max 4 buttons — split into multiple blocks if more are needed.</p>
        )}
      </div>
    </div>
  );
}
```

## Acceptance criteria for 6b.2

1. **No TypeScript errors** in any file modified or created.

2. **accordion**: pressing Enter at the end of a section title with text adds a new section. Drag-handles reorder sections. Min 1 section enforced (delete disabled at 1). Max 6 sections enforced (Add disabled). Canvas renders as multi-open accordion (clicking multiple section titles keeps them all open — `type="multiple"`). Empty titles fall back to "(untitled section)".

3. **tabs**: 2-tab minimum enforced (delete disabled at 2). 6-tab maximum enforced (Add disabled at 6). Style toggle (underline / pills) live-updates the canvas render. Default-tab selector populated with current tab labels. Reordering tabs correctly adjusts `default_tab` index. Canvas renders shadcn Tabs with selected style; default tab opens on first render.

4. **button_stack**: 1-4 button limit (Add disabled at 4, delete disabled at 1). Switching action_type between "link" and "jump_to_block" swaps the URL Input for a target-block Select populated with sibling blocks' friendly labels. Selecting a jump target: on canvas, clicking the button smooth-scrolls to the target block (which has `data-block-client-id` attribute set in 6b.1). Primary buttons render orange (`#F5741A` bg, white text). Secondary buttons render as Navy outline.

5. **siblingBlocks data flow**: when a button_stack block is selected, the jump-to-block Select shows all OTHER blocks (current block filtered out). Friendly labels use the block's most-meaningful content. Select shows "(no other blocks yet)" placeholder when sibling list is empty.

6. **Universal Style section** still appears at the bottom of all three new forms.

7. **No console errors** during any of the above flows.

8. **No regressions** on stat_callout, statement_a_b (shipped in 6b.1) or any of the existing 9 block types.

## What this prompt explicitly does NOT do

- Does NOT modify any infrastructure files outside of BlockEditorPane.tsx — blockTypeMeta.ts, EditorSlidePane.tsx, LessonBlocksEditor.tsx, BlockRenderer.tsx, lesson-blocks.css are all already wired by 6b.1.
- Does NOT add flashcards, scenario, or knowledge_check — those are Prompt 6c.
- Does NOT touch any AI authoring infrastructure.

## File checklist for 6b.2

Modified:
- `src/components/super-admin/lesson-blocks/BlockEditorPane.tsx` (3 imports + 3 dispatch cases)

Created:
- `src/components/super-admin/lesson-blocks/block-forms/AccordionBlockForm.tsx`
- `src/components/super-admin/lesson-blocks/block-forms/TabsBlockForm.tsx`
- `src/components/super-admin/lesson-blocks/block-forms/ButtonStackBlockForm.tsx`

1 modification + 3 creations = 4 file changes.
