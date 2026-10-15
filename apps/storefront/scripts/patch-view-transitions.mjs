import fs from "node:fs/promises"

const packageUrl = new URL(
  "../node_modules/next-view-transitions/package.json",
  import.meta.url,
)
const entryUrl = new URL(
  "../node_modules/next-view-transitions/dist/index.js",
  import.meta.url,
)
const metadata = JSON.parse(await fs.readFile(packageUrl, "utf8"))
if (metadata.name !== "next-view-transitions" || metadata.version !== "0.3.5")
  throw new Error(
    "Патч URL-переходов рассчитан только на next-view-transitions 0.3.5.",
  )

// Browser URL changes can precede Next commits; wait for both before finishing.
const snapshotBefore = `function getHashSnapshot() {
    return window.location.hash;
}
function getServerHashSnapshot() {
    return '';
}
function subscribeHash(onStoreChange) {
    window.addEventListener('hashchange', onStoreChange);
    return ()=>window.removeEventListener('hashchange', onStoreChange);
}`
const snapshotAfter = `function getHashSnapshot() {
    return window.location.pathname + window.location.search + window.location.hash;
}
function getServerHashSnapshot() {
    return '';
}
function subscribeHash(onStoreChange) {
    window.addEventListener('hashchange', onStoreChange);
    window.addEventListener('popstate', onStoreChange);
    return ()=>{
        window.removeEventListener('hashchange', onStoreChange);
        window.removeEventListener('popstate', onStoreChange);
    };
}`

const finishBefore = `    const hash = useHash();
    useEffect(()=>{
        // When the new route component is actually mounted, we finish the view
        // transition.
        currentPathname.current = pathname;
        if (transitionRef.current) {
            transitionRef.current[1]();
            transitionRef.current = null;
        }
    }, [
        hash,
        pathname
    ]);`
const finishAfter = `    const hash = useHash();
    useEffect(()=>{
        const normalizePathname = (value)=>value.replace(/\\/+$/, '') || '/';
        const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\\/+$/, '');
        const renderedPathname = normalizePathname(basePath + pathname);
        const browserPathname = normalizePathname(window.location.pathname);
        const renderedSearch = new URLSearchParams(search).toString();
        const browserSearch = new URLSearchParams(window.location.search).toString();
        if (renderedPathname !== browserPathname || renderedSearch !== browserSearch) {
            return;
        }
        // Finish only after Next has committed the browser's current URL.
        currentPathname.current = pathname;
        if (transitionRef.current) {
            transitionRef.current[1]();
            transitionRef.current = null;
        }
    }, [
        hash,
        pathname,
        search,
        currentViewTransition
    ]);`
const hunks = [
  { name: "URL snapshot", before: snapshotBefore, after: snapshotAfter },
  {
    name: "Next navigation import",
    before: "import { usePathname, useRouter } from 'next/navigation';",
    after:
      "import { usePathname, useRouter, useSearchParams } from 'next/navigation';",
  },
  {
    name: "Next committed search",
    before: `function useBrowserNativeTransitions() {
    const pathname = usePathname();
    const currentPathname = useRef(pathname);`,
    after: `function useBrowserNativeTransitions() {
    const pathname = usePathname();
    const search = useSearchParams().toString();
    const currentPathname = useRef(pathname);`,
  },
  { name: "Next commit guard", before: finishBefore, after: finishAfter },
]

const source = await fs.readFile(entryUrl, "utf8")
const normalized = source.replace(/\r\n/g, "\n")
const states = hunks.map(({ name, before, after }) => {
  const originalCount = normalized.split(before).length - 1
  const patchedCount = normalized.split(after).length - 1
  if (originalCount === 1 && patchedCount === 0) return "original"
  if (originalCount === 0 && patchedCount === 1) return "patched"
  throw new Error(
    `Исходник next-view-transitions изменился (${name}): патч не применён.`,
  )
})
const profile = states.join(",")
if (
  ![
    "original,original,original,original",
    "patched,original,original,original",
    "patched,patched,patched,patched",
  ].includes(profile)
)
  throw new Error(
    "Неизвестная частичная версия URL-патча: исходник не изменён.",
  )

if (states.every((state) => state === "patched")) {
  console.log("next-view-transitions 0.3.5: URL/Next commit патч уже применён.")
} else {
  const patched = hunks.reduce(
    (text, { before, after }, index) =>
      states[index] === "original" ? text.replace(before, after) : text,
    normalized,
  )
  await fs.writeFile(
    entryUrl,
    source.includes("\r\n") ? patched.replace(/\n/g, "\r\n") : patched,
  )
  console.log(
    "next-view-transitions 0.3.5: переход Back/Forward ожидает полный URL и Next commit.",
  )
}
