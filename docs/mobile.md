# Mobile app (Expo)

The **Fanbase NG mobile client is not in this repository.** This repo is the Next.js web app only.

If you run a separate Expo app (e.g. `expo-router` with `app/(app)/`, `components/ui/Button.tsx`), fix it in that project’s root.

## Common Expo Go errors (SDK mismatch)

When `npx expo start` warns about wrong package versions:

```bash
npx expo install --fix
```

Align these to your SDK (example for SDK 54):

| Package | Typical range |
|---------|----------------|
| `expo-clipboard` | `~8.0.8` |
| `expo-keep-awake` | `~15.0.8` |
| `react-native-worklets` | `0.5.1` (not 0.9.x with older Reanimated) |
| `@types/react` | `~19.1.10` |
| `jest-expo` | `~54.0.17` |

Then clear cache:

```bash
rm -rf node_modules .expo
npm install
npx expo start -c
```

## Reanimated `Exception in HostFunction`

Usually **Reanimated + worklets version skew** or running in **Expo Go** without a compatible native build.

1. Run `npx expo install react-native-reanimated react-native-worklets`
2. Ensure `babel.config.js` includes `react-native-reanimated/plugin` (last plugin).
3. For Reanimated 4 / worklets, prefer a **development build** (`npx expo run:ios`) instead of Expo Go if errors persist.

## Missing default export warnings

Often a **cascade** from `Button.tsx` failing to load (Reanimated). Fix Reanimated first; routes should export `default function Screen()`.

## `Cannot find native module 'ExpoClipboard'`

Install the SDK-matched package:

```bash
npx expo install expo-clipboard
```

## Admin layout: navigate before root mount

Defer navigation until the root layout has mounted, e.g. in `app/(admin)/_layout.tsx`:

```tsx
import { useRootNavigationState, router } from "expo-router";

const rootState = useRootNavigationState();
useEffect(() => {
  if (!rootState?.key) return;
  if (!userId) router.replace("/(auth)/login");
}, [rootState?.key, userId]);
```

## API base URL

Point the mobile app at the same Supabase project and your deployed Next.js API (`NEXT_PUBLIC_APP_URL` / env in the Expo app).
