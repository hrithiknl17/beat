import Link from "next/link";
import { ArrowRight, BadgePercent, Clock3, Languages, PackageX, Phone, ReceiptText, WalletCards } from "lucide-react";
import { currentDistributor } from "@/lib/auth";

export const dynamic = "force-dynamic";

const FEATURES = [
  { icon: ReceiptText, title: "Takes the order", text: "Reads back last week's order, takes this week's, prices it against your catalog and books it while the call is still on." },
  { icon: BadgePercent, title: "Applies your schemes", text: "Mentions the right offer at the right moment, and works the discount into the total." },
  { icon: PackageX, title: "Handles out-of-stock", text: "When something is short this week, it offers the substitute you picked instead of losing the line." },
  { icon: WalletCards, title: "Follows up on credit", text: "Asks overdue shops for a payment date, politely, and logs the promise for you to track." },
  { icon: Clock3, title: "Calls back when asked", text: "Busy shopkeeper? Beat books a time and rings back then." },
  { icon: Languages, title: "Speaks their language", text: "Everyday Kannada, the way Bengaluru shopkeepers actually talk, and English when they switch." },
];

export default async function Landing() {
  const me = await currentDistributor();
  const number = process.env.PUBLIC_BEAT_NUMBER;

  return (
    <div className="landing">
      <header className="landing-nav">
        <Link href="/" className="auth-brand"><div className="brand-mark"><span>•••</span><span>•••</span></div><strong>Beat</strong></Link>
        <nav>
          {me ? <Link className="button primary" href="/app">Open dashboard <ArrowRight /></Link> : (
            <><Link className="nav-text" href="/login">Log in</Link><Link className="button primary" href="/signup">Get started <ArrowRight /></Link></>
          )}
        </nav>
      </header>

      <section className="hero">
        <div>
          <div className="eyebrow"><span className="eyebrow-dot" /> VOICE ORDER DESK FOR FMCG DISTRIBUTORS</div>
          <h1>Your salesman&apos;s weekly beat, done by phone.</h1>
          <p>Beat calls every kirana shop on your route in their own language, takes the restock order, applies your schemes, swaps out-of-stock lines and asks for overdue payments. Every order prints on your dashboard while the call is still going.</p>
          <div className="hero-actions">
            <Link className="button primary big" href={me ? "/app" : "/signup"}>{me ? "Open dashboard" : "Create your account"} <ArrowRight /></Link>
            {number && <a className="button secondary big" href={`tel:+91${number}`}><Phone /> Call Beat: {number}</a>}
          </div>
          {number && <small className="muted">Ring the number as if you run a kirana shop. Beat will take your order.</small>}
        </div>
        <div className="hero-slip" aria-hidden="true">
          <div className="order-slip">
            <div className="slip-top"><div><span className="slip-live"><span /> NEW ORDER</span><h3>Sri Lakshmi Stores</h3><p>Basavanagudi · 10:42 AM · Kannada</p></div></div>
            <div className="receipt-line" />
            <div className="receipt-item"><b>12</b><span>Parle-G 100g<small>box of 48</small></span><strong>₹5,400</strong></div>
            <div className="receipt-item"><b>3</b><span>Maggi Masala 70g<small>case of 96 − ₹40 scheme</small></span><strong>₹3,630</strong></div>
            <div className="receipt-item"><b>2</b><span>Fortune Sunflower Oil 1L<small>instead of Gold Winner</small></span><strong>₹2,900</strong></div>
            <div className="receipt-total"><span>TOTAL</span><strong>₹11,930</strong></div>
            <div className="delivery-note"><span className="truck-dot" /> Deliver tomorrow <b>before 11 AM</b></div>
            <div className="slip-tail" />
          </div>
          <div className="hero-bubble">ನಮಸ್ಕಾರ ರಮೇಶ್ ಅವರೇ, ಈ ವಾರ ಅದೇ ಆರ್ಡರ್ ಕೊಡ್ಲಾ?</div>
        </div>
      </section>

      <section className="how">
        <h2>How it works</h2>
        <ol>
          <li><b>Add your shops and catalog</b><span>Prices, packs, schemes and stock. Or start from a 25-product kirana catalog.</span></li>
          <li><b>Press Start beat</b><span>Beat rings each shop in its language. Shops can also ring your Beat number any time.</span></li>
          <li><b>Pack and deliver</b><span>Orders, payment promises and callbacks land on your dashboard, ready for the warehouse.</span></li>
        </ol>
      </section>

      <section className="features">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <div key={title} className="feature"><div className="stat-icon orange"><Icon /></div><b>{title}</b><p>{text}</p></div>
        ))}
      </section>

      <section className="cta">
        <h2>Cover your whole route before lunch.</h2>
        <p>A salesman reaches a few dozen shops a day. Beat rings every shop on the list with one button.</p>
        <Link className="button primary big" href={me ? "/app" : "/signup"}>{me ? "Open dashboard" : "Get started free"} <ArrowRight /></Link>
      </section>

      <footer className="landing-foot"><span>Beat · built on Bolna voice AI</span><span>Made in Bengaluru</span></footer>
    </div>
  );
}
