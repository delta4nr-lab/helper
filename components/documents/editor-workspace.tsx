"use client"

import * as React from "react"
import { EditorContent } from "@tiptap/react"
import type { Editor } from "@tiptap/react"
import { BadgeCheck, BriefcaseBusiness, Contact, Signature } from "lucide-react"

import { PersonPicker } from "@/components/documents/person-picker"
import type { PickerTarget } from "@/components/documents/types"

type Props = {
  editor: Editor
  pageWidth: number
  contentWrapRef: React.RefObject<HTMLDivElement | null>
  triggerWrapRef: React.RefObject<HTMLDivElement | null>
  mouseDownRef: React.RefObject<boolean>
  fieldRectRef: React.RefObject<{ left: number; top: number; right: number; bottom: number } | null>
  menuOpen: boolean
  setMenuOpen: (open: boolean) => void
  pickerTarget: PickerTarget | null
  setPickerTarget: React.Dispatch<React.SetStateAction<PickerTarget | null>>
  menuLabel: string
  pickablePersons: { id: string; name: string; position: string; rank: string }[]
  triggerText: string
  onSelectPerson: (personId: string, target: PickerTarget) => void
  onClearGroup: (target: PickerTarget) => void
  onClearSignature: (target: PickerTarget) => void
  findPickerTarget: (event: React.MouseEvent) => PickerTarget | null
}

function fieldIconFor(type: string) {
  if (type === "position") return <BriefcaseBusiness className="size-4 shrink-0" />
  if (type === "rank") return <BadgeCheck className="size-4 shrink-0" />
  if (type === "signature") return <Signature className="size-4 shrink-0" />
  return <Contact className="size-4 shrink-0" />
}

// Робоча область редактора: сторінки (PaginationPlus), hover-тригер PersonPicker.
export function EditorWorkspace({
  editor,
  pageWidth,
  contentWrapRef,
  triggerWrapRef,
  mouseDownRef,
  fieldRectRef,
  menuOpen,
  setMenuOpen,
  pickerTarget,
  setPickerTarget,
  menuLabel,
  pickablePersons,
  triggerText,
  onSelectPerson,
  onClearGroup,
  onClearSignature,
  findPickerTarget,
}: Props) {
  return (
    <div className="doc-workspace">
      <div
        ref={contentWrapRef}
        className="relative mx-auto"
        style={{ width: pageWidth }}
        onMouseDown={() => {
          mouseDownRef.current = true
        }}
        onMouseMove={(event) => {
          if (menuOpen) return
          const target = findPickerTarget(event)
          if (target) {
            setPickerTarget((prev) => {
              if (
                prev &&
                prev.pos === target.pos &&
                prev.x === target.x &&
                prev.y === target.y &&
                prev.hasSignature === target.hasSignature &&
                prev.groupPersonId === target.groupPersonId
              ) {
                return prev
              }
              return target
            })
          } else {
            const onTrigger = triggerWrapRef.current?.contains(event.target as Node)
            const rect = fieldRectRef.current
            const inZone = rect
              ? event.clientX >= rect.left - 28 &&
                event.clientX <= rect.right + 28 &&
                event.clientY >= rect.top - 120 &&
                event.clientY <= rect.bottom + 28
              : false
            if (!onTrigger && !inZone) setPickerTarget((prev) => (prev ? null : prev))
          }
        }}
      >
        <EditorContent editor={editor} />

        {pickerTarget && (
          <div ref={triggerWrapRef} className="absolute z-50 -translate-y-[125%] translate-x-2" style={{ left: pickerTarget.x, top: pickerTarget.y }}>
            <PersonPicker
              open={menuOpen}
              onOpenChange={setMenuOpen}
              title={menuLabel}
              icon={fieldIconFor(pickerTarget.type)}
              triggerLabel={triggerText}
              items={pickablePersons}
              selectedId={pickerTarget.groupPersonId}
              onSelect={(personId) => onSelectPerson(personId, pickerTarget)}
              onClear={() => onClearGroup(pickerTarget)}
              onClearSignature={() => onClearSignature(pickerTarget)}
              showClearSignature={pickerTarget.hasSignature}
            />
          </div>
        )}
      </div>
    </div>
  )
}