import { AppNav } from "@/components/AppNav";
import { RequireProfile } from "@/components/RequireProfile";

/** Tabbed screens: bottom bar on phones, sidebar from md up. */
export default function TabsLayout({ children }: LayoutProps<"/">) {
  return (
    <RequireProfile>
      <div className="md:flex md:min-h-dvh">
        <AppNav />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-28 md:px-10 md:pt-10 md:pb-10">{children}</main>
      </div>
    </RequireProfile>
  );
}
