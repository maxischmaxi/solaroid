import { GameShell } from "@/components/game/GameShell";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Solitär",
  alternateName: ["Solitaire", "Klondike Solitaire", "Patience"],
  description:
    "Kostenloses Klondike Solitär im Browser spielen – Draw 1 oder Draw 3. Ohne Download, ohne Anmeldung.",
  url: "https://solaroid.de",
  applicationCategory: "GameApplication",
  applicationSubCategory: "CardGame",
  operatingSystem: "Any",
  browserRequirements: "Requires JavaScript, HTML5 Canvas",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "EUR",
  },
  inLanguage: "de",
  author: {
    "@type": "Person",
    name: "Max Jeschek",
  },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Was ist Klondike Solitär?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Klondike Solitär ist die bekannteste Variante des Kartenspiels Patience. Ziel ist es, alle 52 Karten sortiert nach Farbe und aufsteigend vom Ass bis zum König auf vier Ablagestapeln (Foundations) abzulegen.",
      },
    },
    {
      "@type": "Question",
      name: "Was ist der Unterschied zwischen Draw 1 und Draw 3?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Bei Draw 1 wird jeweils eine Karte vom Talon aufgedeckt, was das Spiel einfacher macht. Bei Draw 3 werden drei Karten gleichzeitig aufgedeckt, wobei nur die oberste spielbar ist – das erfordert mehr strategisches Denken.",
      },
    },
    {
      "@type": "Question",
      name: "Ist Solitär kostenlos?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Ja, dieses Solitär ist vollständig kostenlos, ohne Werbung und ohne Anmeldung spielbar. Es wird kein Download benötigt – das Spiel läuft direkt im Browser.",
      },
    },
    {
      "@type": "Question",
      name: "Wie funktioniert die Punktezählung?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Die Punkte werden nach dem klassischen Windows-Solitaire-System berechnet: Karte zum Ablagestapel = +10 Punkte, Karte vom Talon zum Tableau = +5 Punkte, Karte aufdecken = +5 Punkte. Karten vom Ablagestapel zurück zum Tableau kosten -15 Punkte.",
      },
    },
  ],
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <GameShell />

      {/* Visuell versteckter, semantischer Inhalt für Suchmaschinen und Screenreader.
          Canvas-basierte Apps liefern keinen crawlbaren Text – dieser Abschnitt
          stellt sicher, dass Crawler und assistive Technologien den Seiteninhalt
          verstehen können. */}
      <div className="sr-only" role="document" aria-label="Spielbeschreibung">
        <header>
          <h1>Solitär – Kostenloses Klondike Solitaire Online Spielen</h1>
          <p>
            Spiele das klassische Klondike Solitär direkt in deinem Browser.
            Wähle zwischen Draw 1 und Draw 3, nutze Undo, Tipps und
            Auto-Vervollständigung. Kostenlos, ohne Download und ohne
            Anmeldung.
          </p>
        </header>

        <main>
          <section aria-labelledby="about-heading">
            <h2 id="about-heading">Über Klondike Solitär</h2>
            <p>
              Klondike ist die weltweit beliebteste Variante von Solitaire,
              auch bekannt als Patience. Das Ziel ist es, alle 52 Karten eines
              Standarddecks sortiert nach den vier Farben (Kreuz, Pik, Herz,
              Karo) aufsteigend vom Ass bis zum König auf die Ablagestapel zu
              legen.
            </p>
            <p>
              Das Spielfeld besteht aus sieben Tableau-Spalten, vier
              Foundation-Plätzen, einem Talon (Nachziehstapel) und einem
              Abwurfstapel. Karten im Tableau werden absteigend und in
              abwechselnden Farben (rot und schwarz) gestapelt.
            </p>
          </section>

          <section aria-labelledby="features-heading">
            <h2 id="features-heading">Funktionen</h2>
            <ul>
              <li>
                <strong>Draw 1 und Draw 3</strong> – Zwei Spielmodi: Ziehe eine
                oder drei Karten vom Talon. Draw 1 ist ideal für Einsteiger,
                Draw 3 für erfahrene Spieler.
              </li>
              <li>
                <strong>Unbegrenztes Undo</strong> – Jeden Zug rückgängig
                machen, um verschiedene Strategien auszuprobieren.
              </li>
              <li>
                <strong>Intelligente Tipps</strong> – Das Hinweissystem zeigt
                den besten verfügbaren Zug an, wenn du nicht weiterkommst.
              </li>
              <li>
                <strong>Auto-Vervollständigung</strong> – Sobald alle Karten
                aufgedeckt sind, kann das Spiel automatisch alle verbleibenden
                Karten auf die Ablagestapel bewegen.
              </li>
              <li>
                <strong>Statistiken</strong> – Verfolge deine Spiele, Siege,
                Bestzeiten, Highscores und Gewinnserien.
              </li>
              <li>
                <strong>Spielstand speichern</strong> – Dein Fortschritt wird
                automatisch im Browser gespeichert. Du kannst jederzeit
                weiterspielen.
              </li>
              <li>
                <strong>Responsives Design</strong> – Funktioniert auf Desktop,
                Tablet und Smartphone. Touch-Steuerung und Mausbedienung
                werden gleichermaßen unterstützt.
              </li>
              <li>
                <strong>Barrierefreiheit</strong> – Unterstützt
                Screenreader und respektiert die Systemeinstellung für
                reduzierte Animationen.
              </li>
            </ul>
          </section>

          <section aria-labelledby="rules-heading">
            <h2 id="rules-heading">Spielregeln</h2>
            <h3>Spielaufbau</h3>
            <p>
              Zu Beginn werden 28 Karten auf sieben Spalten verteilt: Die erste
              Spalte enthält eine Karte, die zweite zwei, die dritte drei und so
              weiter bis zur siebten Spalte mit sieben Karten. Nur die jeweils
              oberste Karte jeder Spalte ist aufgedeckt. Die restlichen 24
              Karten bilden den Talon.
            </p>

            <h3>Spielziel</h3>
            <p>
              Sortiere alle Karten auf die vier Ablagestapel (Foundations).
              Jeder Stapel beginnt mit einem Ass und wird aufsteigend nach
              Farbe bis zum König aufgebaut: A, 2, 3, 4, 5, 6, 7, 8, 9, 10,
              Bube, Dame, König.
            </p>

            <h3>Karten bewegen</h3>
            <p>
              Im Tableau werden Karten absteigend und in wechselnden Farben
              (schwarz auf rot, rot auf schwarz) abgelegt. Es können einzelne
              Karten oder geordnete Kartenfolgen zwischen den Spalten verschoben
              werden. Auf leere Spalten darf nur ein König gelegt werden.
            </p>

            <h3>Talon und Abwurfstapel</h3>
            <p>
              Klicke auf den Talon, um neue Karten aufzudecken. Im Modus
              Draw 1 wird eine Karte aufgedeckt, im Modus Draw 3 werden drei
              Karten aufgedeckt. Die oberste Karte des Abwurfstapels kann ins
              Tableau oder auf die Foundations gelegt werden.
            </p>
          </section>

          <section aria-labelledby="scoring-heading">
            <h2 id="scoring-heading">Punktesystem</h2>
            <dl>
              <dt>Talon zum Tableau</dt>
              <dd>+5 Punkte</dd>
              <dt>Karte zur Foundation</dt>
              <dd>+10 Punkte</dd>
              <dt>Karte im Tableau aufdecken</dt>
              <dd>+5 Punkte</dd>
              <dt>Foundation zurück zum Tableau</dt>
              <dd>−15 Punkte</dd>
              <dt>Talon recyceln (Draw 1)</dt>
              <dd>−100 Punkte</dd>
              <dt>Talon recyceln (Draw 3)</dt>
              <dd>−20 Punkte</dd>
            </dl>
          </section>

          <section aria-labelledby="tips-heading">
            <h2 id="tips-heading">Strategietipps</h2>
            <ol>
              <li>
                Decke verdeckte Karten so früh wie möglich auf – sie eröffnen
                neue Spielmöglichkeiten.
              </li>
              <li>
                Bevorzuge Züge, die verdeckte Karten freilegen, vor Zügen zum
                Ablagestapel.
              </li>
              <li>
                Lege Asse und Zweien sofort auf die Foundations – sie blockieren
                im Tableau nur.
              </li>
              <li>
                Halte leere Spalten für Könige frei, besonders für Könige, unter
                denen viele verdeckte Karten liegen.
              </li>
              <li>
                Nutze den Undo-Button, um alternative Strategien zu
                testen, ohne das Spiel neu starten zu müssen.
              </li>
            </ol>
          </section>

          <section aria-labelledby="faq-heading">
            <h2 id="faq-heading">Häufige Fragen</h2>

            <h3>Was ist Klondike Solitär?</h3>
            <p>
              Klondike Solitär ist die bekannteste Variante des Kartenspiels
              Patience. Ziel ist es, alle 52 Karten sortiert nach Farbe und
              aufsteigend vom Ass bis zum König auf vier Ablagestapeln abzulegen.
            </p>

            <h3>Was ist der Unterschied zwischen Draw 1 und Draw 3?</h3>
            <p>
              Bei Draw 1 wird jeweils eine Karte vom Talon aufgedeckt, was das
              Spiel einfacher macht. Bei Draw 3 werden drei Karten gleichzeitig
              aufgedeckt, wobei nur die oberste spielbar ist – das erfordert
              mehr strategisches Denken.
            </p>

            <h3>Ist Solitär kostenlos?</h3>
            <p>
              Ja, dieses Solitär ist vollständig kostenlos, ohne Werbung und
              ohne Anmeldung spielbar. Es wird kein Download benötigt – das
              Spiel läuft direkt im Browser.
            </p>

            <h3>Wie funktioniert die Punktezählung?</h3>
            <p>
              Die Punkte werden nach dem klassischen Windows-Solitaire-System
              berechnet: Karte zum Ablagestapel bringt 10 Punkte, Karte vom
              Talon zum Tableau bringt 5 Punkte. Das Zurücklegen einer Karte
              von der Foundation kostet 15 Punkte.
            </p>

            <h3>Kann ich auf dem Handy spielen?</h3>
            <p>
              Ja, das Spiel ist vollständig responsiv und unterstützt
              Touch-Steuerung. Es funktioniert auf jedem modernen Smartphone
              und Tablet – egal ob iOS oder Android.
            </p>

            <h3>Wird mein Spielstand gespeichert?</h3>
            <p>
              Ja, dein aktuelles Spiel, deine Einstellungen und Statistiken
              werden automatisch im Browser gespeichert (localStorage). Du
              kannst den Tab schließen und später weiterspielen.
            </p>
          </section>
        </main>
      </div>

      <noscript>
        <div style={{ padding: "2rem", textAlign: "center", color: "#f5f5f5" }}>
          <h1>Solitär – Klondike Solitaire</h1>
          <p>
            Dieses Spiel benötigt JavaScript. Bitte aktiviere JavaScript in
            deinem Browser, um Klondike Solitär spielen zu können.
          </p>
        </div>
      </noscript>
    </>
  );
}
