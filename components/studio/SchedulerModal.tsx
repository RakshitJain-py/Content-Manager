import { useState } from "react";
import { Modal } from "@/components/common/Modal";
import { LabeledInput } from "@/components/common/LabeledInput";

/** Props for the scheduling modal. */
export interface SchedulerModalProps {
  /** Close the modal. */
  onClose: () => void;
}

/** Date/time picker plus a placeholder queue list. */
export function SchedulerModal({ onClose }: SchedulerModalProps) {
  /** Local, unsubmitted schedule slot. */
  const [slot, setSlot] = useState<{ date: string; time: string }>({ date: "", time: "" });

  return (
    <Modal title="Scheduler" onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <LabeledInput label="Date" type="date" value={slot.date} onChange={(date) => setSlot({ ...slot, date })} />
          <LabeledInput label="Time" type="time" value={slot.time} onChange={(time) => setSlot({ ...slot, time })} />
        </div>
        <div className="rounded-lg border border-neutral-800 p-3 text-xs text-neutral-500">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em]">Queue</p>
          <p>No scheduled batches yet — placeholder.</p>
        </div>
        <button className="ig-gradient w-full rounded-lg py-3 text-xs font-bold uppercase tracking-[0.15em]">
          Schedule batch
        </button>
      </div>
    </Modal>
  );
}
