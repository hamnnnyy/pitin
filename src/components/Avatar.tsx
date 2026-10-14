/** Profile picture, or the first letter of the name on a tinted disc. */
export function Avatar({ profile, size = 40 }: { profile: { name: string; avatar_url: string | null }; size?: number }) {
  const style = { width: size, height: size };
  if (profile.avatar_url)
    // eslint-disable-next-line @next/next/no-img-element -- user uploads on Supabase Storage, already small
    return <img src={profile.avatar_url} alt="" style={style} className="shrink-0 rounded-full object-cover" />;
  return (
    <span
      style={{ ...style, fontSize: size * 0.45 }}
      className="grid shrink-0 place-items-center rounded-full bg-[#3a3a3a] font-semibold text-muted uppercase"
      aria-hidden
    >
      {profile.name.slice(0, 1)}
    </span>
  );
}
