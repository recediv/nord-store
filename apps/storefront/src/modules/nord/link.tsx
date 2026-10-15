"use client"

import NextLink, { type LinkProps } from "next/link"
import { Link as TransitionLink } from "next-view-transitions"
import { usePathname } from "next/navigation"
import type { AnchorHTMLAttributes } from "react"
import { storePath } from "@lib/nord/format"

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> &
  Omit<LinkProps, "href"> & { href: string }

function decodedDocument(path: string) {
  try {
    return decodeURI(path)
  } catch {
    return path
  }
}

export function Link({ href, ...props }: Props) {
  const pathname = usePathname()
  const target = storePath(href)
  const sameDocument =
    decodedDocument(target.split("#")[0]) === decodedDocument(pathname) ||
    target.startsWith("#")
  // Same-document links use Next's own anchor handling without a page transition.
  return sameDocument ? (
    <NextLink
      href={target}
      prefetch={false}
      scroll={target.includes("#")}
      {...props}
    />
  ) : (
    <TransitionLink href={target} prefetch={false} {...props} />
  )
}
