"use client";

import { useActionState, useRef, useTransition } from "react";
import { Camera } from "lucide-react";
import { uploadJobPhoto, type JobFormState } from "@/app/(app)/account/actions";
import { cn } from "@/lib/utils";

const MAX_SIDE = 1600;

// Phone cameras make 5–10 MB photos; a 1600px JPEG is plenty for a worker and uploads fast on slow data.
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("photo"))), "image/jpeg", 0.82));
}

export function PhotoUpload({ jobRef, hasPhoto }: { jobRef: string; hasPhoto: boolean }) {
  const [state, action] = useActionState(uploadJobPhoto.bind(null, jobRef), { error: null, done: null } as JobFormState);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  const send = (file: File) =>
    startTransition(async () => {
      const form = new FormData();
      // A format the browser can't draw (some phones' HEIC) goes as it is; the backend says if it can't use it.
      form.set("photo", await shrink(file).catch(() => file));
      action(form);
    });

  return (
    <div className="grid gap-2">
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) send(file);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={pending}
        onClick={() => input.current?.click()}
        className={cn("inline-flex h-12 items-center justify-center gap-2 rounded-xl border bg-white px-4 text-base font-medium hover:bg-muted", pending && "opacity-60")}
      >
        <Camera className="size-4 text-primary" aria-hidden="true" />
        {pending ? "Uploading…" : hasPhoto ? "Change photo" : "Add a photo"}
      </button>
      <p role="status" className={cn("text-sm", state.error ? "text-destructive" : "text-primary")}>{state.error ?? state.done ?? ""}</p>
    </div>
  );
}
