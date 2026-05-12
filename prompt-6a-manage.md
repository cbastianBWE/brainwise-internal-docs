# Prompt 6a-manage — Multi-select + Manage Blocks sidebar + bulk operations

Add a Manage mode to the stacked lesson editor. In Manage mode, authors can multi-select blocks via checkboxes (or by clicking anywhere on a block), then run bulk operations: delete, duplicate, move up/down, and apply style (background color + padding). A right-side sidebar surfaces all the bulk controls.

This is a frontend-only change. The `replace_lesson_blocks` RPC already handles "N blocks come in, N blocks go out" — bulk operations are pure working-state mutations followed by the regular Save flow.

**No backend changes. No schema migrations. No new dependencies.**

---

## Locked decisions (do not deviate)

1. **Two modes:** `"edit"` (current behavior, single-select, slide-in edit pane on left) and `"manage"` (multi-select, bulk actions, sidebar on right). Mode toggle is a segmented control in the page header, on the **left** side of the action cluster (between page title and Save button).

2. **Selection state preserves across mode toggle.** If the author has 5 blocks selected in Manage mode and flips to Edit, the selection is remembered. Flipping back returns to Manage with those 5 blocks still selected. Selection only clears on Save (block IDs change, so selection becomes meaningless).

3. **In Manage mode, clicking anywhere on a block toggles its selection.** Checkboxes are visual indicators only — the entire block surface is the click target. The slide-in edit pane never opens in Manage mode.

4. **In Edit mode, clicking a block opens the edit pane and resets selection to just that block.** If the user had a multi-selection from Manage mode, clicking a single block in Edit mode collapses it down to just that one.

5. **Drag-and-drop is always enabled, regardless of mode.** Drag moves exactly the dragged block, never affects the multi-selection. Authors who want to bulk-move use the "Move selected up/down" buttons in the sidebar.

6. **Bulk move up/down semantics:** each selected block moves up (or down) by 1 position, processed in index order. Move-up disabled when the topmost selected block is already at index 0. Move-down disabled when bottommost selected block is already at the end.

7. **Bulk delete:** undo-toast pattern with text "X blocks deleted" and a 12-second timeout (vs 6-second for single delete). No confirmation dialog. Undo restores all deleted blocks to their original positions.

8. **Bulk duplicate:** each selected block duplicates immediately after itself (matches single-block duplicate). Selecting blocks at positions [2, 5, 7] and duplicating produces blocks at positions [2, 3, 5+1=6, 7+1+1=9] after the inserts cascade.

9. **Bulk style apply:** inline picker in the sidebar (NOT a modal). Uses `BrandColorSwatch` with `palette="tints"` + `allowDefault` for background color, and the same padding dropdown (`none` / `small` / `medium` / `large`) from `BlockStyleSection`. Two "Apply" buttons — one for background, one for padding — that write the chosen value to all selected blocks. The picker controls don't immediately apply (they pick the value); the Apply button commits to selection.

10. **Sidebar opens automatically when mode = "manage", closes when mode = "edit".** Sidebar is `position: fixed`, 320px wide, top:56, right:0, bottom:0. Animate `right` between `right: -320px` (closed) and `right: 0` (open) per standing rule 20.

11. **Sidebar with no selection: show all action buttons disabled with helper text "Select blocks to enable bulk actions."** (Discoverability over minimalism — author can see the tools before figuring out what to select.)

12. **InlineAddButton ("+ Add block" between every pair of blocks) is hidden in Manage mode.** Adding new blocks during a multi-select workflow is awkward UX. Toggle to Edit to add.

13. **BlockHoverToolbar is hidden in Manage mode.** Per-block actions (drag handle, edit, move up/down, duplicate, delete) are replaced by the bulk actions in the sidebar. (Drag-and-drop still works via @dnd-kit's listeners attached to the block container — the visible drag handle in the hover toolbar isn't the only way to grab.)

14. **Keyboard shortcuts (Manage mode only):**
   - **Shift+click** a block: select the range from the last-clicked block to the clicked block, inclusive
   - **Cmd/Ctrl+A**: select all blocks
   - **Esc**: clear all selection
   - **Plain click**: toggle single block selection (locked above)

    These shortcuts are ONLY active when `mode === "manage"`. In Edit mode, Cmd/Ctrl+A continues to do the browser-default text selection.

15. **Cross-mode interaction with slide-in pane:** toggling from Edit (pane open) to Manage closes the pane unconditionally. Toggling from Manage back to Edit does NOT auto-reopen the pane — author clicks a block to open it.

---

## File changes (6 files total)

### 1. New file: `src/components/super-admin/lesson-blocks/ManageBlocksSidebar.tsx`

Right-side sidebar with selection count header, bulk action buttons, and bulk style apply controls. Always-rendered (not conditionally mounted) — slides in/out via `right` property animation.

```tsx
import { useState } from "react";
import {
  ChevronUp,
  ChevronDown,
  Copy,
  Trash2,
  Paintbrush,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BrandColorSwatch } from "./BrandColorSwatch";
import { cn } from "@/lib/utils";

export type BlockPadding = "none" | "small" | "medium" | "large";

interface Props {
  open: boolean;
  selectedCount: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onBulkDelete: () => void;
  onBulkDuplicate: () => void;
  onBulkMoveUp: () => void;
  onBulkMoveDown: () => void;
  onBulkSelectAll: () => void;
  onBulkClearSelection: () => void;
  onApplyBackground: (hex: string | null) => void;
  onApplyPadding: (padding: BlockPadding) => void;
}

const PADDING_OPTIONS: { value: BlockPadding; label: string }[] = [
  { value: "none",   label: "None" },
  { value: "small",  label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large",  label: "Large" },
];

export function ManageBlocksSidebar({
  open,
  selectedCount,
  canMoveUp,
  canMoveDown,
  onBulkDelete,
  onBulkDuplicate,
  onBulkMoveUp,
  onBulkMoveDown,
  onBulkSelectAll,
  onBulkClearSelection,
  onApplyBackground,
  onApplyPadding,
}: Props) {
  const [pendingBg, setPendingBg] = useState<string | null>(null);
  const [pendingPadding, setPendingPadding] = useState<BlockPadding>("none");
  const hasSelection = selectedCount > 0;

  return (
    <aside
      className={cn(
        "manage-blocks-sidebar fixed z-20 flex flex-col border-l bg-background shadow-md transition-[right] duration-300 ease-out",
        !open && "pointer-events-none",
      )}
      style={{
        top: 56,
        right: open ? 0 : -320,
        bottom: 0,
        width: 320,
      }}
      aria-hidden={!open}
    >
      <div className="border-b px-4 py-3">
        <div
          className="font-display text-base font-semibold tracking-tight"
          style={{ color: "#021F36" }}
        >
          Manage blocks
        </div>
        <div className="mt-1 text-sm text-muted-foreground">
          {hasSelection
            ? `${selectedCount} block${selectedCount === 1 ? "" : "s"} selected`
            : "No blocks selected"}
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        {!hasSelection && (
          <p className="text-xs text-muted-foreground">
            Select blocks to enable bulk actions.
          </p>
        )}

        {/* Selection controls */}
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Selection
          </Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={onBulkSelectAll}
            >
              Select all
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={onBulkClearSelection}
              disabled={!hasSelection}
            >
              Clear
            </Button>
          </div>
        </div>

        {/* Move / Duplicate / Delete row */}
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Actions
          </Label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onBulkMoveUp}
              disabled={!hasSelection || !canMoveUp}
            >
              <ChevronUp className="mr-1 h-3.5 w-3.5" />
              Move up
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onBulkMoveDown}
              disabled={!hasSelection || !canMoveDown}
            >
              <ChevronDown className="mr-1 h-3.5 w-3.5" />
              Move down
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onBulkDuplicate}
              disabled={!hasSelection}
            >
              <Copy className="mr-1 h-3.5 w-3.5" />
              Duplicate
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onBulkDelete}
              disabled={!hasSelection}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        </div>

        {/* Apply style */}
        <div className="space-y-3 border-t pt-4">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Apply style
          </Label>

          <div className="space-y-2">
            <Label className="text-sm">Background color</Label>
            <BrandColorSwatch
              value={pendingBg}
              palette="tints"
              allowDefault
              defaultLabel="Default"
              onChange={(hex) => setPendingBg(hex)}
              onDefaultSelected={() => setPendingBg(null)}
            />
            <Button
              type="button"
              size="sm"
              className="w-full"
              disabled={!hasSelection}
              onClick={() => onApplyBackground(pendingBg)}
            >
              <Paintbrush className="mr-1 h-3.5 w-3.5" />
              Apply background to {selectedCount || 0}
            </Button>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Padding</Label>
            <Select
              value={pendingPadding}
              onValueChange={(v) => setPendingPadding(v as BlockPadding)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PADDING_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              className="w-full"
              disabled={!hasSelection}
              onClick={() => onApplyPadding(pendingPadding)}
            >
              Apply padding to {selectedCount || 0}
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
}
```

### 2. `src/components/super-admin/lesson-blocks/StackedLessonEditor.tsx` — add mode + selection + checkbox UI

Extend the props interface with `mode`, `selectedClientIds`, and the new selection handlers. Add the checkbox visual on the left side of each block in Manage mode. Suppress the hover toolbar in Manage mode. Hide the InlineAddButton in Manage mode. Block click in Manage mode invokes the selection toggle instead of the edit-pane open.

Full replacement file:

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
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { BlockRenderer } from "./BlockRenderer";
import { BlockHoverToolbar } from "./BlockHoverToolbar";
import { InlineAddButton } from "./InlineAddButton";
import type { BlockType, EditorBlock } from "./blockTypeMeta";

export type EditorMode = "edit" | "manage";

interface Props {
  blocks: EditorBlock[];
  selectedClientId: string | null;
  selectedClientIds: Set<string>;
  mode: EditorMode;
  assetUrlMap: Map<string, string>;
  onSelectBlock: (clientId: string) => void;
  onToggleSelect: (clientId: string, e: React.MouseEvent) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onDelete: (clientId: string) => void;
  onDuplicate: (clientId: string) => void;
  onInsert: (atIndex: number, blockType: BlockType) => void;
  onMoveUp: (clientId: string) => void;
  onMoveDown: (clientId: string) => void;
}

function SortableStackBlock({
  block,
  index,
  total,
  selected,
  manageSelected,
  mode,
  assetUrlMap,
  onSelect,
  onToggleSelect,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
}: {
  block: EditorBlock;
  index: number;
  total: number;
  selected: boolean;
  manageSelected: boolean;
  mode: EditorMode;
  assetUrlMap: Map<string, string>;
  onSelect: () => void;
  onToggleSelect: (e: React.MouseEvent) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.client_id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const isManage = mode === "manage";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "stacked-block group relative -mx-4 cursor-pointer rounded-md px-4 py-4",
        selected && !isManage && "is-selected",
        manageSelected && "is-manage-selected",
      )}
      onClick={(e) => {
        if (isManage) {
          onToggleSelect(e);
        } else {
          onSelect();
        }
      }}
    >
      {/* Manage-mode checkbox (left) */}
      {isManage && (
        <div className="absolute left-2 top-3 z-10">
          <div
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded-md border-2 transition-colors",
              manageSelected
                ? "border-[#F5741A] bg-[#F5741A] text-white"
                : "border-muted-foreground/40 bg-background",
            )}
            aria-label={manageSelected ? "Selected" : "Not selected"}
          >
            {manageSelected && <Check className="h-3 w-3" strokeWidth={3} />}
          </div>
        </div>
      )}

      {/* Hover toolbar (right) — only in Edit mode */}
      {!isManage && (
        <div
          className={cn(
            "absolute right-2 top-2 z-10 transition-opacity",
            selected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
        >
          <BlockHoverToolbar
            isFirst={index === 0}
            isLast={index === total - 1}
            dragAttributes={attributes}
            dragListeners={listeners}
            onEdit={onSelect}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
          />
        </div>
      )}

      {/* In Manage mode, attach drag listeners to the whole block via invisible drag wrapper.
          Cole: we keep drag enabled regardless of mode (decision 5). The visible toolbar drag handle
          is gone, but dragging the block itself still works via @dnd-kit's listeners. */}
      <div
        {...(isManage ? attributes : {})}
        {...(isManage ? listeners : {})}
        className={cn(isManage ? "cursor-grab" : "")}
      >
        <BlockRenderer block={block} assetUrlMap={assetUrlMap} mode="editor" />
      </div>
    </div>
  );
}

export function StackedLessonEditor({
  blocks,
  selectedClientId,
  selectedClientIds,
  mode,
  assetUrlMap,
  onSelectBlock,
  onToggleSelect,
  onReorder,
  onDelete,
  onDuplicate,
  onInsert,
  onMoveUp,
  onMoveDown,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = blocks.findIndex((b) => b.client_id === active.id);
    const to = blocks.findIndex((b) => b.client_id === over.id);
    if (from < 0 || to < 0) return;
    onReorder(from, to);
  };

  const isManage = mode === "manage";

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={blocks.map((b) => b.client_id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-1">
          {!isManage && <InlineAddButton atIndex={0} onInsert={onInsert} />}
          {blocks.map((b, i) => (
            <div key={b.client_id} className="space-y-1">
              <SortableStackBlock
                block={b}
                index={i}
                total={blocks.length}
                selected={selectedClientId === b.client_id}
                manageSelected={selectedClientIds.has(b.client_id)}
                mode={mode}
                assetUrlMap={assetUrlMap}
                onSelect={() => onSelectBlock(b.client_id)}
                onToggleSelect={(e) => onToggleSelect(b.client_id, e)}
                onDelete={() => onDelete(b.client_id)}
                onDuplicate={() => onDuplicate(b.client_id)}
                onMoveUp={() => onMoveUp(b.client_id)}
                onMoveDown={() => onMoveDown(b.client_id)}
              />
              {!isManage && <InlineAddButton atIndex={i + 1} onInsert={onInsert} />}
            </div>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
```

### 3. `src/components/super-admin/lesson-blocks/lesson-blocks.css` — add Manage-selected style

Add a new rule for the Manage-mode selected state. Manage-selected blocks get a subtle orange tint background and the same orange left border. Keep all existing rules intact.

Append after the existing `.stacked-block.is-selected` rule:

```css
/* Manage mode — multi-selected block visual */
.stacked-block.is-manage-selected {
  background-color: #FDEFE3; /* same Orange tint as the brand tint palette */
  border-left: 4px solid #F5741A;
  padding-left: 12px;
}
.stacked-block.is-manage-selected:hover {
  background-color: #FCE4D0; /* slightly deeper Orange tint on hover for affordance */
}
```

Note: when a block has BOTH an author-set background_color AND is manage-selected, the manage-selected background wins because `.is-manage-selected` is set on the outer `.stacked-block` while the author tint is set inline on the inner `.block-style-wrapper`. The outer takes precedence visually for the block's surrounding area, but the inner wrapper remains tinted with the author's color. This is correct — the orange manage-selected outer chrome signals "this is selected for bulk ops" while the inner tinted card stays visible. Selected-state chrome takes priority over decoration chrome.

### 4. `src/components/super-admin/lesson-blocks/EditorSlidePane.tsx` — accept mode prop, close in Manage

Add a `mode` prop. When `mode === "manage"`, force `open` to false regardless of the parent's prop value. Add the prop to the interface, default behavior unchanged when mode is "edit".

Replacement for the `interface Props` block + the component opening:

```tsx
interface Props {
  open: boolean;
  block: EditorBlock | null;
  contentItemId: string;
  mode: "edit" | "manage";
  onChange: (next: EditorBlock) => void;
  onClose: () => void;
  isDirty: boolean;
  saving: boolean;
  onRequestSave: () => void;
}

export function EditorSlidePane({
  open,
  block,
  contentItemId,
  mode,
  onChange,
  onClose,
  isDirty,
  saving,
  onRequestSave,
}: Props) {
  // Force close in Manage mode regardless of caller's open prop.
  const effectiveOpen = mode === "edit" && open;

  useEffect(() => {
    if (!effectiveOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [effectiveOpen, onClose]);

  // ... rest of the component identical to current, but replace every `open` reference in the JSX with `effectiveOpen`
```

Replace both `open` references in the JSX (the `className` `!open` check and the inline `style` `open ? ... : "-480px"` and the `aria-hidden={!open}`) with `effectiveOpen`.

### 5. `src/pages/super-admin/LessonBlocksEditor.tsx` — page-level wiring

This is the biggest change. Add `mode` and `selectedClientIds` state, the mode toggle UI in the header, keyboard shortcuts, all the bulk operation handlers, and pass through to `StackedLessonEditor` + render `ManageBlocksSidebar`.

Add imports near the top:

```tsx
import { Layers, Edit2 } from "lucide-react";
import { ManageBlocksSidebar, type BlockPadding } from "@/components/super-admin/lesson-blocks/ManageBlocksSidebar";
import type { EditorMode } from "@/components/super-admin/lesson-blocks/StackedLessonEditor";
```

Add new state inside the component, near where `selectedClientId` is declared:

```tsx
const [mode, setMode] = useState<EditorMode>("edit");
const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set());
const [lastClickedClientId, setLastClickedClientId] = useState<string | null>(null);
const [bulkDeletedBlocks, setBulkDeletedBlocks] = useState<
  { block: EditorBlock; index: number }[] | null
>(null);
```

Selection clears on Save — augment the existing `handleSave` success path. After `await reload();` and before the `draftStatus.resume()` line, add:

```tsx
setSelectedClientIds(new Set());
setLastClickedClientId(null);
```

Add the selection-toggle handler:

```tsx
const handleToggleSelect = (clientId: string, e: React.MouseEvent) => {
  if (mode !== "manage") return;

  // Shift-click range select
  if (e.shiftKey && lastClickedClientId) {
    const startIdx = blocks.findIndex((b) => b.client_id === lastClickedClientId);
    const endIdx = blocks.findIndex((b) => b.client_id === clientId);
    if (startIdx >= 0 && endIdx >= 0) {
      const [lo, hi] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
      const next = new Set(selectedClientIds);
      for (let i = lo; i <= hi; i++) {
        next.add(blocks[i].client_id);
      }
      setSelectedClientIds(next);
      setLastClickedClientId(clientId);
      return;
    }
  }

  // Plain click — toggle
  const next = new Set(selectedClientIds);
  if (next.has(clientId)) {
    next.delete(clientId);
  } else {
    next.add(clientId);
  }
  setSelectedClientIds(next);
  setLastClickedClientId(clientId);
};

const handleBulkSelectAll = () => {
  setSelectedClientIds(new Set(blocks.map((b) => b.client_id)));
};

const handleBulkClearSelection = () => {
  setSelectedClientIds(new Set());
  setLastClickedClientId(null);
};
```

Update `handleSelectBlock` so it also handles the "Edit mode reset of multi-selection" case:

```tsx
const handleSelectBlock = (clientId: string) => {
  // In Edit mode, clicking a block opens the pane and collapses any lingering
  // multi-selection down to just this block.
  setSelectedClientId(clientId);
  setSelectedClientIds(new Set([clientId]));
  setLastClickedClientId(clientId);
  setPaneOpen(true);
};
```

Add the bulk operation handlers:

```tsx
const handleBulkDelete = () => {
  if (selectedClientIds.size === 0) return;
  const removed: { block: EditorBlock; index: number }[] = [];
  setBlocks((prev) => {
    const next = prev.filter((b, i) => {
      if (selectedClientIds.has(b.client_id)) {
        removed.push({ block: b, index: i });
        return false;
      }
      return true;
    });
    return next;
  });
  // Sort removed by ascending original index so undo restores in order
  removed.sort((a, b) => a.index - b.index);
  setBulkDeletedBlocks(removed);
  setSelectedClientIds(new Set());
  setLastClickedClientId(null);
};

const handleUndoBulkDelete = () => {
  if (!bulkDeletedBlocks) return;
  setBlocks((prev) => {
    const next = [...prev];
    // Re-insert in ascending index order. Each insertion uses its original index,
    // which is correct because we removed them all and now restore in order — each
    // subsequent restore's original index accounts for all prior restores already in place.
    for (const r of bulkDeletedBlocks) {
      next.splice(r.index, 0, r.block);
    }
    return next;
  });
  setBulkDeletedBlocks(null);
};

const handleBulkDuplicate = () => {
  if (selectedClientIds.size === 0) return;
  setBlocks((prev) => {
    // Walk in reverse so inserts don't shift later indices we still need to read.
    const next = [...prev];
    for (let i = next.length - 1; i >= 0; i--) {
      if (selectedClientIds.has(next[i].client_id)) {
        const original = next[i];
        const dup: EditorBlock = {
          ...original,
          client_id: crypto.randomUUID(),
          config: JSON.parse(JSON.stringify(original.config)),
        };
        next.splice(i + 1, 0, dup);
      }
    }
    return next;
  });
};

const handleBulkMoveUp = () => {
  if (selectedClientIds.size === 0) return;
  setBlocks((prev) => {
    const next = [...prev];
    // Walk top-to-bottom; for each selected block, swap with the one above it
    // IF that one above is not also selected (would be a no-op).
    for (let i = 1; i < next.length; i++) {
      if (
        selectedClientIds.has(next[i].client_id) &&
        !selectedClientIds.has(next[i - 1].client_id)
      ) {
        [next[i - 1], next[i]] = [next[i], next[i - 1]];
      }
    }
    return next;
  });
};

const handleBulkMoveDown = () => {
  if (selectedClientIds.size === 0) return;
  setBlocks((prev) => {
    const next = [...prev];
    // Walk bottom-to-top; for each selected block, swap with the one below it
    // IF that one below is not also selected.
    for (let i = next.length - 2; i >= 0; i--) {
      if (
        selectedClientIds.has(next[i].client_id) &&
        !selectedClientIds.has(next[i + 1].client_id)
      ) {
        [next[i], next[i + 1]] = [next[i + 1], next[i]];
      }
    }
    return next;
  });
};

const handleBulkApplyBackground = (hex: string | null) => {
  if (selectedClientIds.size === 0) return;
  setBlocks((prev) =>
    prev.map((b) =>
      selectedClientIds.has(b.client_id)
        ? { ...b, config: { ...b.config, background_color: hex } }
        : b,
    ),
  );
};

const handleBulkApplyPadding = (padding: BlockPadding) => {
  if (selectedClientIds.size === 0) return;
  setBlocks((prev) =>
    prev.map((b) =>
      selectedClientIds.has(b.client_id)
        ? { ...b, config: { ...b.config, padding } }
        : b,
    ),
  );
};
```

Compute can-move-up / can-move-down for the sidebar's button disabled states:

```tsx
const canBulkMoveUp = useMemo(() => {
  // Move-up is disabled when the topmost selected block is at index 0.
  for (let i = 0; i < blocks.length; i++) {
    if (selectedClientIds.has(blocks[i].client_id)) {
      return i > 0;
    }
  }
  return false;
}, [blocks, selectedClientIds]);

const canBulkMoveDown = useMemo(() => {
  // Move-down is disabled when the bottommost selected block is at last index.
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (selectedClientIds.has(blocks[i].client_id)) {
      return i < blocks.length - 1;
    }
  }
  return false;
}, [blocks, selectedClientIds]);
```

Keyboard shortcuts (Manage mode only):

```tsx
useEffect(() => {
  if (mode !== "manage") return;
  const onKey = (e: KeyboardEvent) => {
    const meta = e.metaKey || e.ctrlKey;
    if (meta && e.key.toLowerCase() === "a") {
      e.preventDefault();
      handleBulkSelectAll();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleBulkClearSelection();
    }
  };
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}, [mode, blocks]);
```

Update the header JSX. Replace the existing `<div className="flex items-center gap-2">` (containing Badge + Save) section with one that also includes the mode toggle on the left of the action cluster. The whole top action row becomes:

```tsx
<div className="flex flex-wrap items-start justify-between gap-3">
  <div className="space-y-1">
    <h1 className="font-display text-3xl font-bold tracking-tight" style={{ color: "#021F36" }}>
      {item?.title ?? "Lesson"}
    </h1>
    <p className="text-sm text-muted-foreground">
      Build and arrange the blocks that make up this lesson.
    </p>
  </div>
  <div className="flex items-center gap-3">
    {/* Mode toggle — segmented control */}
    <div
      role="tablist"
      aria-label="Editor mode"
      className="inline-flex items-center rounded-md border bg-muted/40 p-0.5"
    >
      <button
        type="button"
        role="tab"
        aria-selected={mode === "edit"}
        onClick={() => setMode("edit")}
        className={cn(
          "flex items-center gap-1.5 rounded-sm px-3 py-1 text-sm transition-colors",
          mode === "edit"
            ? "bg-background font-medium shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Edit2 className="h-3.5 w-3.5" />
        Edit
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "manage"}
        onClick={() => setMode("manage")}
        className={cn(
          "flex items-center gap-1.5 rounded-sm px-3 py-1 text-sm transition-colors",
          mode === "manage"
            ? "bg-background font-medium shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Layers className="h-3.5 w-3.5" />
        Manage
      </button>
    </div>

    <Badge variant={isDirty ? "secondary" : "outline"}>{statusLabel}</Badge>
    <Button
      disabled={!isDirty || saving}
      onClick={() => setSaveDialogOpen(true)}
      className="shadow-cta"
    >
      <Save className="mr-1 h-4 w-4" />
      Save
    </Button>
  </div>
</div>
```

Update the body section (`<div className="relative">`) to include the new sidebar and to push the stack right when in Manage mode:

```tsx
<div className="relative">
  <EditorSlidePane
    open={paneOpen && !!selectedBlock}
    block={selectedBlock}
    contentItemId={contentItemId!}
    mode={mode}
    onChange={updateBlock}
    onClose={() => {
      setPaneOpen(false);
      setSelectedClientId(null);
    }}
    isDirty={isDirty}
    saving={saving}
    onRequestSave={() => setSaveDialogOpen(true)}
  />

  <ManageBlocksSidebar
    open={mode === "manage"}
    selectedCount={selectedClientIds.size}
    canMoveUp={canBulkMoveUp}
    canMoveDown={canBulkMoveDown}
    onBulkDelete={handleBulkDelete}
    onBulkDuplicate={handleBulkDuplicate}
    onBulkMoveUp={handleBulkMoveUp}
    onBulkMoveDown={handleBulkMoveDown}
    onBulkSelectAll={handleBulkSelectAll}
    onBulkClearSelection={handleBulkClearSelection}
    onApplyBackground={handleBulkApplyBackground}
    onApplyPadding={handleBulkApplyPadding}
  />

  <div
    className={cn(
      "flex-1 transition-all duration-300 ease-out",
      paneOpen && !!selectedBlock && mode === "edit" ? "md:ml-[480px]" : "",
      mode === "manage" ? "md:mr-[320px]" : "",
    )}
  >
    {blocks.length === 0 ? (
      <div className="flex h-[50vh] items-center justify-center">
        <Card className="w-96">
          <CardContent className="flex flex-col items-center gap-3 p-8">
            <div className="text-sm text-muted-foreground">No blocks yet</div>
            <Popover>
              <PopoverTrigger asChild>
                <Button>
                  <Plus className="mr-1 h-4 w-4" />
                  Add your first block
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-2" align="center">
                <AddBlockPopover onSelect={(bt) => handleInsert(0, bt)} />
              </PopoverContent>
            </Popover>
          </CardContent>
        </Card>
      </div>
    ) : (
      <div className="mx-auto max-w-3xl">
        <StackedLessonEditor
          blocks={blocks}
          selectedClientId={selectedClientId}
          selectedClientIds={selectedClientIds}
          mode={mode}
          assetUrlMap={assetUrlMap}
          onSelectBlock={handleSelectBlock}
          onToggleSelect={handleToggleSelect}
          onReorder={handleReorder}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
          onInsert={handleInsert}
          onMoveUp={handleMoveUp}
          onMoveDown={handleMoveDown}
        />
      </div>
    )}
  </div>
</div>
```

Update the `UndoDeleteToast` rendering to handle both single delete and bulk delete with appropriate text and timing:

```tsx
<UndoDeleteToast
  open={!!deletedBlock || !!bulkDeletedBlocks}
  onUndo={() => {
    if (bulkDeletedBlocks) {
      handleUndoBulkDelete();
    } else if (deletedBlock) {
      handleUndoDelete();
    }
  }}
  onDismiss={() => {
    setDeletedBlock(null);
    setBulkDeletedBlocks(null);
  }}
  durationMs={bulkDeletedBlocks ? 12000 : 6000}
  message={
    bulkDeletedBlocks
      ? `${bulkDeletedBlocks.length} block${bulkDeletedBlocks.length === 1 ? "" : "s"} deleted`
      : "Block deleted"
  }
/>
```

### 6. `src/components/super-admin/lesson-blocks/UndoDeleteToast.tsx` — accept custom message

Currently hardcodes "Block deleted". Add a `message` prop that overrides the default text:

```tsx
import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";

interface Props {
  open: boolean;
  onUndo: () => void;
  onDismiss: () => void;
  durationMs?: number;
  message?: string;
}

export function UndoDeleteToast({
  open,
  onUndo,
  onDismiss,
  durationMs = 6000,
  message = "Block deleted",
}: Props) {
  const [progress, setProgress] = useState(100);
  const startRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setProgress(100);
    startRef.current = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startRef.current;
      const pct = Math.max(0, 100 - (elapsed / durationMs) * 100);
      setProgress(pct);
      if (elapsed >= durationMs) {
        onDismiss();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [open, durationMs, onDismiss]);

  if (!open) return null;
  return (
    <div
      role="status"
      className="fixed bottom-6 right-6 z-50 w-72 overflow-hidden rounded-md border border-l-4 bg-background shadow-md"
      style={{ borderLeftColor: "#006D77" }}
    >
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <div className="flex items-center gap-2 text-sm">
          <Trash2 className="h-4 w-4 text-muted-foreground" />
          {message}
        </div>
        <button
          type="button"
          onClick={onUndo}
          className="text-sm font-semibold"
          style={{ color: "#F5741A" }}
        >
          Undo
        </button>
      </div>
      <div className="h-1 w-full bg-muted">
        <div
          className="h-full transition-[width] duration-100 ease-linear"
          style={{ width: `${progress}%`, background: "#006D77" }}
        />
      </div>
    </div>
  );
}
```

---

## What NOT to change

- Do NOT add or modify any backend migrations.
- Do NOT touch `BlockEditorPane.tsx` — the single-block edit experience is unchanged.
- Do NOT touch `BlockStyleSection.tsx` or any of the 9 block-form files — bulk style apply works through the same `config.background_color` and `config.padding` fields that 6a-style established.
- Do NOT touch `BlockRenderer.tsx` — block rendering doesn't care about selection state.
- Do NOT touch `useLessonBlockDraft.ts` — autosave fires on `blocks` state changes regardless of how those changes were caused (single edit, bulk apply, bulk move, bulk delete all look the same to the hook).
- Do NOT touch `replace_lesson_blocks` RPC or any Supabase code.
- Do NOT add a "Copy to another lesson" button. That feature is deferred to a separate sub-prompt (6a-manage-copy) that requires cross-lesson RPC + asset-rebind semantics.
- Do NOT add per-block-type bulk operations (e.g., "delete all callouts"). The bulk operations are uniform across block types — they apply to whatever set the user has selected, regardless of mixed types.
- Do NOT add a confirmation modal for bulk delete. The undo-toast pattern with extended timeout is sufficient.
- Do NOT add drag-and-drop multi-block support (dragging A also moves B and C when both are selected). Single-block drag only, regardless of selection.

---

## Acceptance criteria (18)

1. The page header shows a segmented control with two options: "Edit" (default selected) and "Manage". The control lives between the page title and the Save button.

2. Toggling to Manage mode: the slide-in edit pane closes (if open); the right-side Manage Blocks sidebar slides in from the right (320px wide, animates `right` from `-320px` to `0`).

3. Toggling back to Edit mode: the Manage sidebar slides out; the slide-in edit pane stays closed.

4. In Manage mode, each block shows a checkbox indicator on the left (5×5 px border, orange filled with white check when selected, muted-foreground/40 border when unselected). In Edit mode, no checkbox is visible.

5. In Manage mode, the BlockHoverToolbar (right-side floating toolbar with drag/edit/up/down/duplicate/delete) is NOT rendered on any block. In Edit mode, it appears on hover/selection as before.

6. In Manage mode, the "+ Add block" inline divider buttons between every pair of blocks are NOT visible. In Edit mode, they appear on hover as before.

7. In Manage mode, clicking anywhere on a block toggles its selection (adds to or removes from `selectedClientIds`). Click feedback: the block immediately shows the manage-selected state (orange tint background, orange left border).

8. Shift-click in Manage mode selects the range from the last-clicked block to the new one, inclusive. All blocks in the range become selected.

9. Cmd/Ctrl+A in Manage mode selects all blocks. Pressing Esc in Manage mode clears all selection.

10. The sidebar header shows "Manage blocks" title and a count "X blocks selected" (or "No blocks selected" if zero).

11. With zero blocks selected: all action buttons (Move up, Move down, Duplicate, Delete, Apply background, Apply padding) are disabled. The "Clear" selection button is also disabled. The "Select all" button is enabled.

12. With ≥1 block selected: Move up / Move down enable IF the topmost/bottommost selected block has room to move. Otherwise those specific buttons stay disabled.

13. Bulk Delete: clicking removes all selected blocks from the stack, shows an undo-toast with text "X blocks deleted" and a 12-second timeout. Clicking Undo within 12 seconds restores all deleted blocks to their original positions. Single-block delete from Edit mode still uses the 6-second timeout and "Block deleted" text.

14. Bulk Duplicate: each selected block duplicates immediately after itself. Selection of blocks at indices [2, 5, 7] of a 10-block stack produces a 13-block stack with duplicates inserted after each selected position. Duplicates inherit their original's config (including background_color and padding).

15. Bulk Move Up: each selected block shifts up by 1 position, processed top-to-bottom, swapping with the un-selected block above only if there is one. Multiple adjacent selected blocks move as a coherent group (their relative order preserved, the whole group shifts up by 1 against the un-selected block above the topmost selected).

16. Bulk Move Down: mirror of Move Up — processed bottom-to-top.

17. Bulk Apply Background: pick a tint (or Default) in the sidebar's background swatch, click "Apply background to N". All selected blocks' `config.background_color` updates to the chosen value. Each block's rendered preview in the stack updates immediately.

18. Bulk Apply Padding: pick a padding token in the sidebar's padding dropdown, click "Apply padding to N". All selected blocks' `config.padding` updates to the chosen value. Each block's rendered preview in the stack updates immediately.

### Cross-mode integration ACs (not numbered above but must pass)

- Selection state persists across mode toggle: select 3 blocks in Manage → toggle to Edit → toggle back to Manage → those 3 blocks are still selected.
- Clicking a block in Edit mode after coming from Manage with a multi-selection collapses the selection down to just that block (sets `selectedClientIds = new Set([clientId])`).
- Saving the lesson clears all selection (both `selectedClientId` and `selectedClientIds`).
- Drag-and-drop a single block in Manage mode works (block reorders), does NOT affect the selection set.
- The leave-guard dialog and Save dialog work identically in Manage mode — they don't care about mode state.

---

## Test plan after Lovable build lands

Use the test fixture content_item `32e0e966-4cb8-4e8b-abf8-5617de346f59` (10 blocks).

1. **Mode toggle** — Open the lesson editor. Confirm segmented control shows "Edit" selected. Click "Manage" — sidebar slides in from right, edit pane (if open) closes. Click "Edit" — sidebar slides out.

2. **Checkboxes appear** — In Manage mode, confirm every block shows a small empty checkbox on the left. Toggle back to Edit — checkboxes disappear.

3. **Hover toolbar suppressed** — In Manage mode, hover over a block. Confirm the floating right-side toolbar does NOT appear. Toggle back to Edit, hover — toolbar appears.

4. **Inline + buttons suppressed** — In Manage mode, look for "+ Add block" dividers between blocks. Confirm they're not there. Toggle to Edit — they reappear.

5. **Single-click selection** — In Manage mode, click block 3. Confirm it shows orange tint + orange left border + checkbox filled. Click it again — selection clears.

6. **Shift-click range select** — In Manage mode, click block 2 (selected). Shift+click block 6. Blocks 2 through 6 all become selected. Sidebar count reads "5 blocks selected".

7. **Cmd/Ctrl+A select all** — With some blocks selected, press Cmd+A (Mac) or Ctrl+A (Win). All 10 blocks select. Count reads "10 blocks selected".

8. **Esc clears selection** — With multiple blocks selected, press Esc. All selection clears, count reads "No blocks selected".

9. **Move up/down disabled at boundaries** — Select block 0 (top). Confirm Move up button disabled. Select bottom block. Confirm Move down disabled. Select middle block. Confirm both enabled.

10. **Bulk move up** — Select blocks 3, 5, 7. Click Move up. Confirm blocks now at indices 2, 4, 6.

11. **Bulk move down** — From the previous state, click Move down twice. Confirm blocks return to their original positions and then continue down by 1.

12. **Bulk duplicate** — Select 2 blocks. Click Duplicate. Confirm 2 new blocks appear immediately after each selected. Stack grows by 2.

13. **Bulk delete + undo** — Select 4 blocks. Click Delete. Confirm undo-toast appears with text "4 blocks deleted" and a 12-second progress bar. Click Undo before 12s expires. Confirm all 4 blocks restored to original positions.

14. **Bulk delete timeout** — Select 3 blocks. Click Delete. Wait 13 seconds. Confirm toast auto-dismisses and blocks stay deleted. Save the lesson with reason "bulk delete test" — confirm via SQL that those 3 blocks are gone.

15. **Bulk apply background** — Select 3 blocks. In sidebar, click Forest tint swatch. Click "Apply background to 3". Confirm all 3 blocks render with Forest tint immediately.

16. **Bulk apply padding** — From previous, click padding dropdown, choose "Large". Click "Apply padding to 3". Confirm all 3 blocks gain 48px top + bottom padding visibly.

17. **Selection persists across mode toggle** — Select 5 blocks in Manage. Toggle to Edit (sidebar slides out). Toggle back to Manage (sidebar slides in). Confirm same 5 blocks still highlighted.

18. **Edit-mode click collapses multi-selection** — With 5 blocks selected from Manage, toggle to Edit. Click block 4. Confirm edit pane opens for block 4. Toggle to Manage. Confirm only block 4 is selected (count = 1).

19. **Drag-and-drop single block in Manage mode** — Select 2 blocks (e.g., 2 and 5). Drag block 3 (NOT selected) downward to a new position. Confirm block 3 reorders. Confirm blocks 2 and 5 stay selected. Confirm selection set (by checkbox indicators) is unchanged.

20. **Save clears selection** — Select 4 blocks. Save the lesson with a reason. After save completes, confirm selection state is empty (no checkboxes filled, sidebar shows "No blocks selected"). Block IDs change on Save so this is expected.

21. **Backend round-trip** — After Test 15 + 16 above (Forest tint + Large padding applied to 3 blocks), save the lesson. Then query:

```sql
SELECT
  display_order,
  block_type,
  config->>'background_color' AS bg,
  config->>'padding' AS padding
FROM lesson_blocks
WHERE content_item_id = '32e0e966-4cb8-4e8b-abf8-5617de346f59'
  AND archived_at IS NULL
ORDER BY display_order;
```

Expected: the 3 blocks you selected have `bg='#E5EBE7'` (Forest tint) and `padding='large'`.

---

## Standing-rule confirmations

- Rule 10 (brand-only color enforcement): satisfied. Sidebar background picker uses BrandColorSwatch with `palette="tints"`.
- Rule 12 (typography baseline): unaffected.
- Rule 19 (position:fixed for viewport-tracking UI): satisfied. ManageBlocksSidebar uses `position:fixed` with explicit offsets.
- Rule 20 (animate `left`/`right` not transform when avoiding sidebar overlap): satisfied. Sidebar animates `right` directly.
- Rule 18 (8-color palette locked): satisfied. Sidebar picker uses the same 8-color tinted palette established in 6a-style.

No backend rules apply — zero backend changes.

---

End of 6a-manage prompt.
