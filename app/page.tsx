import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Github } from "lucide-react";
import { Brand } from "@/components/brand";
export default function Home() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <Brand />
        <nav aria-label="Main navigation">
          <Link href="/markets">Market Data</Link>
          <Link href="/docs">Build</Link>
          <a
            className="github-nav"
            href="https://github.com/rikokurnia/oracell"
            aria-label="Oracell source on GitHub"
          >
            <Github size={34} />
          </a>
          <Link className="primary small" href="/markets">
            Launch Explorer
          </Link>
        </nav>
      </header>
      <main id="main" className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Oracle infrastructure for CKB</p>
          <h1>
            Fresh data.
            <br />
            Clear conviction.
          </h1>
          <p className="hero-description">
            Bring verifiable market prices to CKB applications with signed data
            <br className="desktop-break" /> and witness-based verification.
          </p>
          <div className="hero-actions">
            <Link className="primary" href="/markets">
              Explore Market Data
            </Link>
            <Link href="/docs">
              Start Building <ArrowUpRight size={28} />
            </Link>
          </div>
        </div>
        <Image
          className="hero-art"
          src="/oracell-landing-hero.png"
          width={1315}
          height={1197}
          alt="Translucent jade sculpture surrounding a chartreuse core"
          priority
        />
      </main>
      <footer className="landing-footer">
        <span>Signed price payloads</span>
        <span>CKB-native verification</span>
        <span>Built for developers</span>
      </footer>
    </div>
  );
}
