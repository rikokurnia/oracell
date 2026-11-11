import Link from "next/link";
import Image from "next/image";
export function Brand({ build = false }: { build?: boolean }) {
  return (
    <Link href="/" className="brand" aria-label="Oracell home">
      <Image src="/oracell-logo.png" alt="" width={64} height={64} />
      <span>Oracell{build && <small>Build</small>}</span>
    </Link>
  );
}
