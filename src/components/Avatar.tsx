import { avatarSrc, type User } from "@/lib/auth";

/** Round profile picture, or the first letter of the name when there is none. */
export function Avatar({ user, size = 28 }: { user: Pick<User, "id" | "avatarFile" | "avatarUrl" | "name" | "email">; size?: number }) {
  const src = avatarSrc(user);
  const style = { width: size, height: size };
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" style={style} className="shrink-0 rounded-full object-cover" referrerPolicy="no-referrer" />;
  }
  return (
    <span style={{ ...style, fontSize: size * 0.42 }} className="flex shrink-0 items-center justify-center rounded-full bg-surface-2 font-semibold uppercase">
      {(user.name ?? user.email).slice(0, 1)}
    </span>
  );
}
