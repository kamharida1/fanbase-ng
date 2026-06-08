export function buildWatermarkLabel(input: {
  username: string | null;
  userId: string;
}): string {
  const handle = input.username ? `@${input.username}` : "viewer";
  const fingerprint = input.userId.replace(/-/g, "").slice(0, 8);
  return `${handle} · ${fingerprint}`;
}
