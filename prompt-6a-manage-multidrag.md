# Prompt 6a-manage-multidrag — Multi-block drag-and-drop in Manage mode

Patch to 6a-manage: when an author drags a selected block in Manage mode, the entire selection moves together (preserving relative order). Drag a non-selected block → single-block drag as today. The drag preview shows a compact pill: "Moving N blocks" with a small thumbnail/icon of the topmost selected block.

This is a focused frontend-only patch. **No backend changes. No new files. No new dependencies.** Two files modified: `StackedLessonEditor.tsx` (drag dispatching + DragOverlay) and `LessonBlocksEditor.tsx` (group reorder math).

---

## Locked decisions (do not deviate)

1. **Trigger condition for group drag:** the dragged block is part of `selectedClientIds` AND `selectedClientIds.size >= 2`. A 1-block selection drags as single-block (no overlay, current behavior).

2. **Drag a non-selected block** in Manage mode: single-block drag, unchanged behavior. Selection set is untouched during and after the drag.

3. **Group drag preview** uses @dnd-kit's `<DragOverlay>` primitive. Renders a fixed-width pill (~240px) at the cursor showing:
   - The text "Moving N blocks" in Navy `#021F36`, font-display
   - A small icon (16×16) on the left showing the block-type icon of the topmost (lowest display_order) selected block, in Orange `#F5741A`
   - A subtle shadow + sand background + orange left border, matching the platform's accent treatment

   The DragOverlay sits above all other UI and is fully opaque. The actual blocks in the stack that are part of the group fade to `opacity: 0.4` during drag (using the existing `isDragging` pattern, extended to recognize group membership).

4. **Drop target semantics:** the entire selected group moves as a contiguous block to land at the `overId`'s position, preserving the selected blocks' internal relative order. If multiple selected blocks have gaps between them in the original order, those gaps close (selected blocks become contiguous after drop).

5. **Selection preserved across drag.** After drop, the same blocks are still selected (by client_id, which doesn't change during reorder). Sidebar count stays the same.

6. **Edit mode is unchanged.** Group drag is Manage-mode exclusive. In Edit mode, only one block can be the focus anyway — no group concept exists.

7. **DragOverlay only renders during group drag.** Single-block drag uses the default @dnd-kit transform on the block itself (current behavior). No overlay for single-block.

---

## File changes (2 files)

### 1. `src/components/super-admin/lesson-blocks/StackedLessonEditor.tsx` — group drag dispatching + DragOverlay

Several changes:

(a) Import `DragOverlay` from `@dnd-kit/core` and `BLOCK_TYPE_META` from `blockTypeMeta`.

(b) Add `activeId` state inside `StackedLessonEditor` (the function component, not the inner SortableStackBlock) to track which block is currently being dragged. Wire `onDragStart` + `onDragEnd` to set/clear it.

(c) Change the `onReorder` contract. Add a new `onGroupReorder` prop alongside the existing `onReorder`. Dispatch in `handleDragEnd` based on whether the active block is part of a multi-block selection.

(d) Render `<DragOverlay>` with the "Moving N blocks" pill when group drag is active.

(e) Fade group members to 0.4 opacity during group drag. Use a new `isGroupMember` prop on `SortableStackBlock` to detect "this block is part of the active group drag" — we can't rely solely on @dnd-kit's `isDragging` because that only flags the actively-grabbed block, not the rest of the group.

Full replacement of the file:

```tsx
import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
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
import { BLOCK_TYPE_META, type BlockType, type EditorBlock } from "./blockTypeMeta";

export type EditorMode = "edit" | "manage";

interface Props {
  blocks: EditorBlock[];
  selectedClientId: string | null;
  selectedClientIds: Set<string>;
  mode: EditorMode;
  assetUrlMap: Map<string, string>;
  onSelectBlock: (clientId: string) => void;
  onToggleSelect: (clientId: string, e: React.MouseEvent) => void;
  /** Single-block reorder: drag a single block (not part of a multi-selection) */
  onReorder: (fromIndex: number, toIndex: number) => void;
  /** Group reorder: drag a block that IS part of a multi-selection (size >= 2) */
  onGroupReorder: (activeClientId: string, overClientId: string) => void;
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
  isGroupMember,
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
  isGroupMember: boolean;
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

  // Block fades to 0.4 when it's the active dragging block OR when it's part of the
  // active group drag (group members other than the grabbed block).
  const fadeOpacity = isDragging || isGroupMember ? 0.4 : 1;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: fadeOpacity,
  };

  const isManage = mode === "manage";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "stacked-block group relative -mx-4 cursor-pointer rounded-md px-4 py-4",
        !isManage && selected && "is-selected",
        isManage && manageSelected && "is-manage-selected",
      )}
      onClick={(e) => {
        if (isManage) {
          onToggleSelect(e);
        } else {
          onSelect();
        }
      }}
      {...(isManage ? attributes : {})}
      {...(isManage ? listeners : {})}
    >
      {isManage && (
        <div className="absolute left-1 top-4 z-10">
          <div
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded-sm border-2 transition-colors",
              manageSelected
                ? "border-[#F5741A] bg-[#F5741A] text-white"
                : "border-muted-foreground/40 bg-background",
            )}
          >
            {manageSelected && <Check className="h-3.5 w-3.5" />}
          </div>
        </div>
      )}

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

      <BlockRenderer block={block} assetUrlMap={assetUrlMap} mode="editor" />
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
  onGroupReorder,
  onDelete,
  onDuplicate,
  onInsert,
  onMoveUp,
  onMoveDown,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const [activeId, setActiveId] = useState<string | null>(null);

  // Group drag is active when the grabbed block is part of a multi-selection.
  const isGroupDragActive =
    activeId !== null &&
    selectedClientIds.size >= 2 &&
    selectedClientIds.has(activeId);

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const activeStr = String(active.id);
    const overStr = String(over.id);

    // Group drag path: the grabbed block is part of a multi-selection.
    if (selectedClientIds.size >= 2 && selectedClientIds.has(activeStr)) {
      onGroupReorder(activeStr, overStr);
      return;
    }

    // Single-block drag path: original behavior.
    const from = blocks.findIndex((b) => b.client_id === activeStr);
    const to = blocks.findIndex((b) => b.client_id === overStr);
    if (from < 0 || to < 0) return;
    onReorder(from, to);
  };

  const isManage = mode === "manage";

  // Compute the topmost-selected block (lowest display_order in the selected set)
  // for the DragOverlay preview. Only used when isGroupDragActive is true.
  const topmostSelectedBlock = (() => {
    if (!isGroupDragActive) return null;
    for (const b of blocks) {
      if (selectedClientIds.has(b.client_id)) return b;
    }
    return null;
  })();

  const TopmostIcon =
    topmostSelectedBlock != null
      ? BLOCK_TYPE_META[topmostSelectedBlock.block_type].icon
      : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={blocks.map((b) => b.client_id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-1">
          {!isManage && <InlineAddButton atIndex={0} onInsert={onInsert} />}
          {blocks.map((b, i) => {
            // A block is a "group member" (and should fade) when:
            // - group drag is active
            // - this block is in the selection set
            // - this block is NOT the actively-grabbed block (that one already fades via isDragging)
            const isGroupMember =
              isGroupDragActive &&
              selectedClientIds.has(b.client_id) &&
              b.client_id !== activeId;
            return (
              <div key={b.client_id} className="space-y-1">
                <SortableStackBlock
                  block={b}
                  index={i}
                  total={blocks.length}
                  selected={selectedClientId === b.client_id}
                  manageSelected={selectedClientIds.has(b.client_id)}
                  isGroupMember={isGroupMember}
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
            );
          })}
        </div>
      </SortableContext>

      <DragOverlay>
        {isGroupDragActive && TopmostIcon && (
          <div
            className="flex items-center gap-2 rounded-md border bg-background shadow-md"
            style={{
              width: 240,
              padding: "10px 14px",
              borderLeft: "4px solid #F5741A",
              background: "#F9F7F1",
            }}
          >
            <TopmostIcon className="h-4 w-4" style={{ color: "#F5741A" }} />
            <div
              className="font-display text-sm font-semibold tracking-tight"
              style={{ color: "#021F36" }}
            >
              Moving {selectedClientIds.size} blocks
            </div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
```

### 2. `src/pages/super-admin/LessonBlocksEditor.tsx` — add `handleGroupReorder` + wire into prop

Add a new handler that moves the entire selection as a contiguous block to the drop target's position. The algorithm:

1. Extract the selected blocks from `blocks` in their current order, preserving relative order. Call this `selectedSequence`.
2. Build `remaining` = `blocks` with all selected blocks removed.
3. Find the index in `remaining` of the drop target (`overClientId`). Call it `dropIdx`.
   - If `overClientId` is itself part of the selection, that's impossible by construction of step 2; this case is already handled by @dnd-kit returning the overId as one of the non-selected blocks, but just in case, find the nearest non-selected block to the drop.
4. Determine whether to insert BEFORE or AFTER the drop target. Use the position of the active block relative to the drop target in the original array — if dragging downward, insert AFTER the drop target; if dragging upward, insert BEFORE.
5. Splice `selectedSequence` into `remaining` at the calculated position.

Add the handler in `LessonBlocksEditor.tsx` near `handleReorder`:

```tsx
const handleGroupReorder = (activeClientId: string, overClientId: string) => {
  setBlocks((prev) => {
    const activeIdx = prev.findIndex((b) => b.client_id === activeClientId);
    const overIdx = prev.findIndex((b) => b.client_id === overClientId);
    if (activeIdx < 0 || overIdx < 0) return prev;

    // Build the selected sequence (preserving original relative order)
    // and the remaining blocks (non-selected).
    const selectedSeq: EditorBlock[] = [];
    const remaining: EditorBlock[] = [];
    for (const b of prev) {
      if (selectedClientIds.has(b.client_id)) {
        selectedSeq.push(b);
      } else {
        remaining.push(b);
      }
    }

    // Find the drop target's index inside `remaining`.
    // If the overClientId itself is selected (edge case — shouldn't happen with
    // @dnd-kit's collision detection in normal use, but be safe), fall back to
    // the activeClientId's original neighbors.
    let dropIdxInRemaining = remaining.findIndex(
      (b) => b.client_id === overClientId,
    );
    if (dropIdxInRemaining < 0) {
      // Fallback: find the index in remaining that corresponds to the
      // overIdx's position in the original array (walking forward until we
      // hit a non-selected block).
      let i = overIdx;
      while (i < prev.length && selectedClientIds.has(prev[i].client_id)) i++;
      if (i >= prev.length) {
        // All trailing blocks are selected — drop at end.
        dropIdxInRemaining = remaining.length;
      } else {
        dropIdxInRemaining = remaining.findIndex(
          (b) => b.client_id === prev[i].client_id,
        );
        if (dropIdxInRemaining < 0) dropIdxInRemaining = remaining.length;
      }
    }

    // If the active block's original position was BELOW the drop target,
    // we're dragging upward — insert BEFORE the drop target.
    // If the active block's original position was ABOVE the drop target,
    // we're dragging downward — insert AFTER the drop target.
    const draggingDown = activeIdx < overIdx;
    const insertAt = draggingDown ? dropIdxInRemaining + 1 : dropIdxInRemaining;

    const next = [...remaining];
    next.splice(insertAt, 0, ...selectedSeq);
    return next;
  });
};
```

Pass the new handler to `StackedLessonEditor` in the JSX:

```tsx
<StackedLessonEditor
  blocks={blocks}
  selectedClientId={selectedClientId}
  selectedClientIds={selectedClientIds}
  mode={mode}
  assetUrlMap={assetUrlMap}
  onSelectBlock={handleSelectBlock}
  onToggleSelect={handleToggleSelect}
  onReorder={handleReorder}
  onGroupReorder={handleGroupReorder}
  onDelete={handleDelete}
  onDuplicate={handleDuplicate}
  onInsert={handleInsert}
  onMoveUp={handleMoveUp}
  onMoveDown={handleMoveDown}
/>
```

---

## What NOT to change

- Do NOT change `handleReorder` (single-block path). Existing single-block drag must remain identical.
- Do NOT modify CSS. The fade behavior uses inline `opacity` from React state, no new CSS classes.
- Do NOT touch `BlockHoverToolbar`, `InlineAddButton`, `EditorSlidePane`, `ManageBlocksSidebar`, `UndoDeleteToast`, `BlockRenderer`, or any block-form files.
- Do NOT change the `BlockType` icon mapping in `blockTypeMeta.ts`. The DragOverlay reads `BLOCK_TYPE_META[block_type].icon` directly — those icons are already defined.
- Do NOT add multi-block drag preview that stacks all N selected blocks visually at the cursor. The compact pill is the locked design.
- Do NOT change the bulk move-up/down buttons in the sidebar — those remain as alternative interactions.
- Do NOT add drag support in Edit mode beyond what's already there (single-block drag).

---

## Acceptance criteria (8)

1. **Single-block drag in Manage mode unchanged.** With 0 or 1 blocks selected, dragging any block reorders it like before. No DragOverlay pill appears. Selection set unchanged after drop.

2. **Group drag triggers with 2+ selected.** With 2+ blocks selected, grabbing any of those selected blocks and dragging shows the "Moving N blocks" pill at the cursor. The dragged block AND all other selected blocks fade to 0.4 opacity in their original positions during the drag.

3. **Group drag drops correctly going down.** With blocks 2, 4, 6 selected (in a 10-block stack), grab block 2 and drag down past block 7. On drop, the selected blocks (2, 4, 6) move together to land after block 7 in their relative order: result is [0, 1, 3, 5, 7, **2, 4, 6**, 8, 9] (the un-selected blocks 0,1,3,5,7,8,9 stay in order; the selected group becomes contiguous and lands after where the active block was dropped).

4. **Group drag drops correctly going up.** With blocks 4, 6, 8 selected, grab block 6 and drag up to block 1. On drop, result is [0, **4, 6, 8**, 1, 2, 3, 5, 7, 9].

5. **Group drag preserves internal order.** If blocks at positions [3, 7, 5] are selected (note: 5 is between 3 and 7 in the array), the group's internal order in the result is [3-content, 5-content, 7-content] — sorted by original display_order. (Selection set is order-independent; the drag math sorts by original array order.)

6. **Non-selected block dragged in Manage mode** behaves as single-block drag. With blocks 2, 4, 6 selected, grab block 5 (not selected) and drag. Only block 5 moves. The selected set 2, 4, 6 stays untouched. No DragOverlay pill.

7. **Drop on a selected block is well-handled.** If the user drags the selected group and the drop target happens to be one of the selected blocks (visually difficult since selected blocks fade, but @dnd-kit's collision detection can still return one as `overId`), the fallback math finds the nearest non-selected position and inserts the group there.

8. **Selection persists after drop.** After any group drag, the same blocks are still selected (their client_ids didn't change). Sidebar count is unchanged.

---

## Test plan

Use the test fixture content_item with 10+ blocks. If the fixture currently has fewer than 10 blocks because of prior test deletions, add blocks back via "+ Add block" in Edit mode first.

1. **Test 1 — Single-block drag unchanged.** Edit mode: drag a block down 2 positions. Confirm normal single-block reorder. Toggle to Manage. Clear selection. Drag a block. Confirm same single-block reorder, no overlay.

2. **Test 2 — Group drag visual.** Manage mode. Select 3 blocks (e.g., blocks 2, 4, 6). Click and hold on block 4, move the cursor down ~50px. Confirm:
   - The "Moving 3 blocks" pill appears at the cursor with an icon and Navy text
   - Blocks 2, 4, 6 in the stack all fade to ~40% opacity
   - Non-selected blocks stay full opacity
   Release without dropping over a valid target (drop outside stack or press Esc if @dnd-kit supports it). Confirm pill disappears, blocks return to full opacity, no reorder happens.

3. **Test 3 — Group drag down.** Manage mode. Select blocks 2, 4, 6 in a 10-block stack. Note the content of each. Grab block 2 (or any of the 3 selected) and drag downward, dropping it over block 7. After drop, confirm:
   - The 3 selected blocks now sit contiguously after block 7 (their previous content visible there)
   - Their relative order (2-content, 4-content, 6-content) is preserved
   - Blocks 0, 1, 3, 5, 7 (the non-selected) keep their relative order at the top
   - Selection set still contains the same 3 blocks (checkboxes still filled)
   - Sidebar count still "3 blocks selected"

4. **Test 4 — Group drag up.** From the previous state, select 3 different blocks toward the bottom of the stack. Drag one of them upward to a position near the top. Confirm the group moves together to the new position. Relative order preserved.

5. **Test 5 — Group drag with non-contiguous selection covers wide range.** Select blocks at positions 1 and 9 (skip everything in between). Grab block 1 and drag to block 5. After drop, confirm both blocks 1 and 9 land together near block 5's old position, in order (1-content, 9-content), and the non-selected blocks fill in around them.

6. **Test 6 — Non-selected drag in Manage mode unchanged.** Select blocks 2, 4, 6. Grab block 5 (not selected) and drag down 2 positions. Confirm only block 5 moves. Blocks 2, 4, 6 stay in their original positions and stay selected.

7. **Test 7 — Save round-trip.** After any group drag, save the lesson with reason "group drag test". Query Supabase:

```sql
SELECT display_order, block_type
FROM lesson_blocks
WHERE content_item_id = '32e0e966-4cb8-4e8b-abf8-5617de346f59'
  AND archived_at IS NULL
ORDER BY display_order;
```

Confirm the order matches the post-drag visual state.

8. **Test 8 — Edge: drag a 1-block "selection" doesn't trigger group mode.** Select exactly 1 block. Drag it. Confirm no DragOverlay pill appears (because `selectedClientIds.size >= 2` is false). Single-block drag executes normally.

9. **Test 9 — Edge: drag a non-selected block when many are selected.** Select 5 blocks. Drag a 6th block (not in the selection). Confirm single-block drag, no overlay, the 5 selected stay in place.

10. **Test 10 — Toggle mode mid-test.** Select 3 blocks in Manage. Group drag them to a new position. Confirm selection persists. Toggle to Edit. Toggle back to Manage. Confirm the same 3 blocks still selected and at their new positions.

---

## Standing-rule confirmations

- Rule 10 (brand-only color enforcement): satisfied. DragOverlay uses Orange `#F5741A` (left border + icon color) and Navy `#021F36` (text) — both in palette.
- Rule 12 (typography baseline): unaffected.
- Rule 19 (position:fixed for viewport-tracking): satisfied. DragOverlay's positioning is managed by @dnd-kit using a fixed portal layer.
- Rule 20 (animate `left`/`right` not transform when avoiding sidebar overlap): not applicable — DragOverlay uses @dnd-kit's internal cursor-tracking which is portal-based, doesn't interact with the global sidebar.

No backend rules apply — zero backend changes.

---

End of 6a-manage-multidrag prompt.
