import { OfflineBanner } from "@/components/Status";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <OfflineBanner />
      {children}
    </div>
  );
}
