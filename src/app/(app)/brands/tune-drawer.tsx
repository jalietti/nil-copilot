'use client'

import { useRef } from 'react'
import { Button } from '@/components/ui'
import { CloseIcon, SlidersIcon } from '@/components/icons'
import { SearchPreferences } from './search-preferences'
import { FocusedSearch } from './focused-search'

interface Props {
  values: string[]
  industries: string[]
  fromInterview: boolean
  whatMatters: string
  focusDisabled: boolean
}

// Right-side slide-over built on the native <dialog> element: showModal()
// gives us a focus trap and Escape-to-close for free.
export function TuneDrawer({ values, industries, fromInterview, whatMatters, focusDisabled }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  function open() {
    dialogRef.current?.showModal()
  }

  function close() {
    dialogRef.current?.close()
  }

  // A click lands on the <dialog> element itself only when it's on the
  // backdrop (content clicks land on a descendant), so this is a reliable
  // "close on backdrop click".
  function handleDialogClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) close()
  }

  return (
    <>
      <Button variant="secondary" onClick={open}>
        <SlidersIcon size={18} />
        Tune search
      </Button>
      <dialog
        ref={dialogRef}
        aria-labelledby="tune-search-title"
        onClick={handleDialogClick}
        className="m-0 h-dvh max-h-dvh w-[min(440px,100%)] max-w-none border-0 bg-surface p-0 fixed inset-y-0 right-0 left-auto [&::backdrop]:bg-ink/45"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-line-soft px-6 py-5">
            <h2 id="tune-search-title" className="display text-[28px]">
              Tune your search
            </h2>
            <button
              type="button"
              aria-label="Close"
              onClick={close}
              className="grid size-11 shrink-0 place-items-center rounded-[10px] text-muted hover:bg-surface-2 hover:text-ink"
            >
              <CloseIcon size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex flex-col gap-7">
              <SearchPreferences
                values={values}
                industries={industries}
                fromInterview={fromInterview}
                whatMatters={whatMatters}
              />
              <FocusedSearch disabled={focusDisabled} />
            </div>
          </div>
        </div>
      </dialog>
    </>
  )
}
