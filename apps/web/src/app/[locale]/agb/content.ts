import type { LegalDocument } from '@/components/LegalShell';
import type { Locale } from '@/lib/i18n';

/**
 * Nutzungsbedingungen - terms of use.
 *
 * ## Why this document exists at all
 *
 * German law does not require AGB. What creates the need here is that the site
 * has `register` and `login`: the moment someone can open an account, there is a
 * contract about that account, and leaving its terms unwritten means they fall
 * back entirely to the BGB defaults - including ones neither side wants.
 *
 * ## The pre-launch shape
 *
 * Almost every clause below is smaller than its equivalent on a shipping SaaS,
 * and deliberately so. There is no price, so there is no payment clause. There
 * is no SLA, so §5 says there is none rather than inventing a number nobody
 * will hold. Writing "99.9% uptime" into the AGB of a product with no customers
 * is not confidence, it is a liability with a percentage attached.
 *
 * The liability clause follows the standard German construction, which is not
 * stylistic: §309 Nr. 7 BGB voids any attempt to cap liability for injury to
 * life, body or health, or for gross negligence, so a blanket exclusion would
 * strike the whole clause rather than the offending part of it.
 */
export const TERMS_CONTENT: Record<Locale, LegalDocument> = {
  en: [
    {
      id: 'scope',
      heading: '1. Scope',
      paragraphs: [
        'These terms govern your use of the Beff website and, where you hold one, your Beff account. They apply between you and Beff GmbH, Stuttgart.',
        'This service is offered to businesses (Unternehmer, §14 BGB). It is not directed at consumers.',
      ],
    },
    {
      id: 'service',
      heading: '2. What the service is today',
      paragraphs: [
        'Beff is pre-launch. What is available now is a waiting list and an account you can open to preview the product. There is no paid plan and no commercial offering yet.',
        'Nothing on this site is an offer in the sense of §145 BGB. Features shown or described may change or be withdrawn before general availability.',
      ],
    },
    {
      id: 'account',
      heading: '3. Your account',
      paragraphs: [
        'You are responsible for keeping your credentials confidential and for what happens under your account. Tell us promptly if you think someone else has access.',
        'You must give accurate registration details and keep them current. One account is for one person; shared logins are not permitted.',
      ],
    },
    {
      id: 'use',
      heading: '4. Acceptable use',
      paragraphs: [
        'Do not attempt to gain unauthorised access, disrupt the service, scrape it at a scale that degrades it for others, or use it to break the law.',
        'Do not upload data you are not entitled to share - in particular production data belonging to a third party, or personal data you have no basis to process.',
      ],
    },
    {
      id: 'availability',
      heading: '5. Availability',
      paragraphs: [
        'There is no service level agreement. The service is provided as it stands, may be interrupted for maintenance, and may be changed or discontinued while it remains pre-launch.',
        'We will give reasonable notice before discontinuing a service you actively use, and we will make your data available for export first.',
      ],
    },
    {
      id: 'data',
      heading: '6. Your data',
      paragraphs: [
        'Data you enter remains yours. We process it to provide the service and for no other purpose.',
        'What we process, on what legal basis and for how long is set out in the privacy policy, which forms part of your relationship with us alongside these terms.',
      ],
    },
    {
      id: 'ip',
      heading: '7. Rights in the service',
      paragraphs: [
        'The software, design and content of the service remain ours. You get a non-exclusive, non-transferable right to use it for your own business purposes while your account is open.',
      ],
    },
    {
      id: 'term',
      heading: '8. Term and termination',
      paragraphs: [
        'You may close your account at any time from your profile, and doing so erases your personal data as described in the privacy policy.',
        'We may terminate for good cause (§314 BGB), in particular a serious or repeated breach of section 4.',
      ],
    },
    {
      id: 'liability',
      heading: '9. Liability',
      paragraphs: [
        'We are liable without limitation for intent and gross negligence, and for injury to life, body or health.',
        'For slight negligence we are liable only where a material contractual obligation is breached - one whose fulfilment makes proper performance possible at all and on which you may reasonably rely - and then only for foreseeable damage typical of this kind of contract.',
        'Liability under the Produkthaftungsgesetz is unaffected. Any further liability is excluded.',
      ],
    },
    {
      id: 'changes',
      heading: '10. Changes to these terms',
      paragraphs: [
        'We may change these terms where there is a valid reason, such as a change in the law or in the service. We will tell you at least 30 days before a change takes effect.',
        'If you object before the date it takes effect, either of us may close the account. Silence counts as agreement only where we said so in that notice.',
      ],
    },
    {
      id: 'law',
      heading: '11. Governing law and venue',
      paragraphs: [
        'German law applies, excluding the UN Convention on Contracts for the International Sale of Goods.',
        'Where you are a merchant, a legal person under public law or a special fund under public law, the place of jurisdiction is Stuttgart.',
      ],
    },
  ],

  de: [
    {
      id: 'scope',
      heading: '1. Geltungsbereich',
      paragraphs: [
        'Diese Bedingungen regeln Ihre Nutzung der Beff-Website und, sofern Sie eines besitzen, Ihres Beff-Kontos. Sie gelten zwischen Ihnen und der Beff GmbH, Stuttgart.',
        'Das Angebot richtet sich an Unternehmer im Sinne des §14 BGB. Es richtet sich nicht an Verbraucher.',
      ],
    },
    {
      id: 'service',
      heading: '2. Was der Dienst heute ist',
      paragraphs: [
        'Beff befindet sich vor dem Marktstart. Verfügbar sind derzeit eine Warteliste und ein Konto, mit dem Sie das Produkt vorab ansehen können. Es gibt noch keinen kostenpflichtigen Tarif und kein kommerzielles Angebot.',
        'Die Inhalte dieser Website stellen kein Angebot im Sinne des §145 BGB dar. Gezeigte oder beschriebene Funktionen können sich vor der allgemeinen Verfügbarkeit ändern oder entfallen.',
      ],
    },
    {
      id: 'account',
      heading: '3. Ihr Konto',
      paragraphs: [
        'Sie sind dafür verantwortlich, Ihre Zugangsdaten vertraulich zu halten, und für das, was unter Ihrem Konto geschieht. Melden Sie uns unverzüglich, wenn Sie vermuten, dass Dritte Zugriff haben.',
        'Sie müssen bei der Registrierung zutreffende Angaben machen und diese aktuell halten. Ein Konto ist für eine Person bestimmt; gemeinsam genutzte Zugänge sind nicht zulässig.',
      ],
    },
    {
      id: 'use',
      heading: '4. Zulässige Nutzung',
      paragraphs: [
        'Versuchen Sie nicht, sich unbefugt Zugang zu verschaffen, den Dienst zu stören, ihn in einem Umfang automatisiert abzurufen, der ihn für andere beeinträchtigt, oder ihn zu rechtswidrigen Zwecken zu nutzen.',
        'Laden Sie keine Daten hoch, zu deren Weitergabe Sie nicht berechtigt sind - insbesondere keine Produktionsdaten Dritter und keine personenbezogenen Daten, für deren Verarbeitung Ihnen die Grundlage fehlt.',
      ],
    },
    {
      id: 'availability',
      heading: '5. Verfügbarkeit',
      paragraphs: [
        'Es besteht keine Vereinbarung über ein Service-Level. Der Dienst wird im vorhandenen Zustand bereitgestellt, kann für Wartungen unterbrochen werden und kann, solange er sich vor dem Marktstart befindet, geändert oder eingestellt werden.',
        'Vor der Einstellung eines von Ihnen aktiv genutzten Dienstes informieren wir Sie mit angemessener Frist und stellen Ihre Daten zuvor zum Export bereit.',
      ],
    },
    {
      id: 'data',
      heading: '6. Ihre Daten',
      paragraphs: [
        'Von Ihnen eingegebene Daten bleiben Ihre Daten. Wir verarbeiten sie, um den Dienst zu erbringen, und zu keinem anderen Zweck.',
        'Was wir auf welcher Rechtsgrundlage und wie lange verarbeiten, steht in der Datenschutzerklärung, die neben diesen Bedingungen Teil unseres Verhältnisses ist.',
      ],
    },
    {
      id: 'ip',
      heading: '7. Rechte am Dienst',
      paragraphs: [
        'Software, Gestaltung und Inhalte des Dienstes bleiben bei uns. Sie erhalten für die Dauer Ihres Kontos ein einfaches, nicht übertragbares Recht zur Nutzung für eigene geschäftliche Zwecke.',
      ],
    },
    {
      id: 'term',
      heading: '8. Laufzeit und Kündigung',
      paragraphs: [
        'Sie können Ihr Konto jederzeit in Ihrem Profil schließen. Damit werden Ihre personenbezogenen Daten gelöscht, wie in der Datenschutzerklärung beschrieben.',
        'Wir können aus wichtigem Grund kündigen (§314 BGB), insbesondere bei einem schwerwiegenden oder wiederholten Verstoß gegen Abschnitt 4.',
      ],
    },
    {
      id: 'liability',
      heading: '9. Haftung',
      paragraphs: [
        'Wir haften unbeschränkt für Vorsatz und grobe Fahrlässigkeit sowie für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit.',
        'Bei einfacher Fahrlässigkeit haften wir nur bei Verletzung einer wesentlichen Vertragspflicht - einer Pflicht, deren Erfüllung die ordnungsgemäße Durchführung überhaupt erst ermöglicht und auf deren Einhaltung Sie regelmäßig vertrauen dürfen - und dann begrenzt auf den vorhersehbaren, vertragstypischen Schaden.',
        'Die Haftung nach dem Produkthaftungsgesetz bleibt unberührt. Eine weitergehende Haftung ist ausgeschlossen.',
      ],
    },
    {
      id: 'changes',
      heading: '10. Änderungen dieser Bedingungen',
      paragraphs: [
        'Wir können diese Bedingungen ändern, wenn dafür ein sachlicher Grund besteht, etwa eine Änderung der Rechtslage oder des Dienstes. Wir informieren Sie mindestens 30 Tage vor Wirksamwerden.',
        'Widersprechen Sie vor dem Wirksamwerden, kann jede Seite das Konto schließen. Schweigen gilt nur dann als Zustimmung, wenn wir in der Mitteilung darauf hingewiesen haben.',
      ],
    },
    {
      id: 'law',
      heading: '11. Anwendbares Recht und Gerichtsstand',
      paragraphs: [
        'Es gilt deutsches Recht unter Ausschluss des UN-Kaufrechts.',
        'Sind Sie Kaufmann, juristische Person des öffentlichen Rechts oder öffentlich-rechtliches Sondervermögen, ist Gerichtsstand Stuttgart.',
      ],
    },
  ],
};
