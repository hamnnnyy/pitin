"use client";

/** Native share sheet where there is one (with the image, if it can take files), else the clipboard. */
export async function share(
  data: { title: string; text: string; url: string },
  file?: File,
): Promise<"shared" | "copied" | "cancelled" | "failed"> {
  if (navigator.share)
    try {
      await navigator.share(file && navigator.canShare?.({ files: [file] }) ? { ...data, files: [file] } : data);
      return "shared";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "cancelled";
    }
  try {
    await navigator.clipboard.writeText(`${data.text}\n${data.url}`);
    return "copied";
  } catch {
    return "failed";
  }
}
