import Image from "next/image";

// Signed storage links expire within the hour, so they skip Next's image cache.
export function JobPhoto({ url, alt, className }: { url: string; alt: string; className?: string }) {
  return (
    <a href={url} target="_blank" rel="noreferrer" className={className}>
      <span className="relative block aspect-[4/3] overflow-hidden rounded-xl bg-muted">
        <Image src={url} alt={alt} fill unoptimized sizes="(min-width: 640px) 560px, 100vw" className="object-cover" />
      </span>
    </a>
  );
}
