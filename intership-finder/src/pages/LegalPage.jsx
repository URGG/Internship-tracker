import {
  ACCEPTABLE_USE_URL,
  COOKIES_URL,
  DISCLAIMER_URL,
  LEGAL_CONTACT_EMAIL,
  LEGAL_BUSINESS_ADDRESS,
  LEGAL_EFFECTIVE_DATE,
  LEGAL_ENTITY_NAME,
  MINIMUM_AGE,
  PRIVACY_URL,
  PRIVACY_VERSION,
  TERMS_URL,
  TERMS_VERSION,
  NOTICE_AT_COLLECTION_URL,
} from "../config";

const policyConfig = {
  terms: {
    title: "Terms of Service",
    eyebrow: "Terms & conditions",
    version: TERMS_VERSION,
    intro: "These Terms of Service explain the rules for using intern.track, including the tracker, search tools, optional AI features, workspaces, and paid plans.",
  },
  privacy: {
    title: "Privacy Policy",
    eyebrow: "Privacy & data",
    version: PRIVACY_VERSION,
    intro: "This Privacy Policy explains what intern.track collects, why it is used, which providers may process it, and the choices available to you.",
  },
  cookies: {
    title: "Cookie & Storage Notice",
    eyebrow: "Cookies & local storage",
    version: "v1",
    intro: "This notice explains the browser storage and similar technologies used to keep intern.track working and remember your choices.",
  },
  disclaimer: {
    title: "AI & Employment Disclaimer",
    eyebrow: "Important limitations",
    version: "v1",
    intro: "intern.track is an organization tool. It does not make hiring decisions, submit applications for you, or provide professional advice.",
  },
  acceptable: {
    title: "Acceptable Use Policy",
    eyebrow: "Responsible use",
    version: "v1",
    intro: "This policy describes the conduct expected when using intern.track and third-party job sources.",
  },
  notice: {
    title: "Notice at Collection",
    eyebrow: "Privacy notice",
    version: PRIVACY_VERSION,
    intro: "This notice summarizes the categories of information intern.track collects, why it is used, the providers that may process it, and the choices available to you.",
  },
};

function PolicyNavigation({ current }) {
  const links = [
    ["terms", "Terms", TERMS_URL],
    ["privacy", "Privacy", PRIVACY_URL],
    ["cookies", "Cookies", COOKIES_URL],
    ["disclaimer", "Disclaimer", DISCLAIMER_URL],
    ["acceptable", "Acceptable use", ACCEPTABLE_USE_URL],
    ["notice", "Notice at collection", NOTICE_AT_COLLECTION_URL],
  ];

  return (
    <nav className="legal-nav" aria-label="Legal pages">
      {links.map(([id, label, href]) => (
        <a className={current === id ? "active" : ""} href={href} key={id}>
          {label}
        </a>
      ))}
    </nav>
  );
}

function ContactLine({ children }) {
  return (
    <p>
      {children} Please contact <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>{LEGAL_BUSINESS_ADDRESS ? ` or write to ${LEGAL_BUSINESS_ADDRESS}` : ""} if you have a question or need to make a privacy request.
    </p>
  );
}

function TermsContent() {
  return (
    <>
      <h2>1. Agreement and eligibility</h2>
      <p>By creating an account or using intern.track, you agree to these Terms of Service and the policies linked on this page. You must be at least {MINIMUM_AGE} years old and able to enter into a binding agreement. If you use intern.track for an organization or shared workspace, you confirm that you have authority to do so.</p>

      <h2>2. The service</h2>
      <p>intern.track provides tools to organize job leads, applications, deadlines, follow-ups, interviews, notes, exports, workspaces, and optional search or AI-assisted drafting. Features may change, be limited, or be temporarily unavailable as we maintain and improve the service.</p>

      <h2>3. Your account</h2>
      <p>Provide accurate information, keep your password and authentication methods secure, and tell us promptly if you believe your account has been compromised. You are responsible for activity under your account and for choosing who can access a shared workspace.</p>

      <h2>4. Your content and permissions</h2>
      <p>You retain ownership of the resumes, profile details, job notes, and other content you submit. You give intern.track permission to host, store, process, and display that content only as needed to provide, secure, support, and improve the service. You represent that you have the right to provide it and that it does not violate another person’s rights.</p>

      <h2>5. Acceptable use</h2>
      <p>You may not use intern.track to impersonate someone, create deceptive applications, upload unlawful or malicious material, misuse provider data, bypass rate limits or security controls, scrape restricted sources, or interfere with the service. See the <a href={ACCEPTABLE_USE_URL}>Acceptable Use Policy</a> for the full rules.</p>

      <h2>6. Job listings and third-party services</h2>
      <p>Listings and search results may be supplied by third parties and can be incomplete, outdated, duplicated, or unavailable. Employers and listing providers control eligibility, deadlines, application status, and hiring decisions. Review the original listing and apply on the employer or provider site. Third-party services remain subject to their own terms and privacy policies.</p>

      <h2>7. AI-assisted features</h2>
      <p>AI features can generate drafts, summaries, comparisons, research, and suggestions. They may be inaccurate or incomplete and are not legal, employment, immigration, financial, medical, or other professional advice. You must review every output, correct it, and decide whether to use it before sharing or submitting anything.</p>

      <h2>8. Paid plans</h2>
      <p>When you purchase a paid plan, the price, billing interval, renewal, cancellation, and refund terms shown at checkout apply to that purchase. Payment processing is handled by the payment provider identified at checkout. We may suspend paid features when a payment is reversed, overdue, or associated with fraud.</p>

      <h2>9. Disclaimers and limits</h2>
      <p>To the maximum extent allowed by law, intern.track is provided “as is” and “as available,” without guarantees that it will be uninterrupted, error-free, secure, or produce a job, interview, or offer. We are not responsible for employer decisions, third-party listings, provider outages, or actions you take based on content in the service. Nothing in these Terms limits rights that cannot legally be limited.</p>

      <h2>10. Suspension, termination, and changes</h2>
      <p>You may stop using the service at any time and can request account deletion from Settings. We may suspend or terminate access for security, abuse, nonpayment, legal compliance, or a material breach. We may update these Terms; if an update materially changes your rights or obligations, we will provide notice and request renewed acceptance where required.</p>

      <h2>11. Contact</h2>
      <ContactLine>For questions about these Terms,</ContactLine>
    </>
  );
}

function PrivacyContent() {
  return (
    <>
      <h2>1. What this policy covers</h2>
      <p>This policy applies to the intern.track website, web app, browser extension, account services, and related support. It does not govern an employer’s or job provider’s separate website when you follow a listing link.</p>

      <h2>2. Information we collect</h2>
      <p>Depending on how you use the service, we may collect your username, email address, password hash, profile and education details, resume text, saved jobs, application activity, notes, workspace membership, support messages, privacy choices, payment status, security events, and device or network information used to protect the service. We do not need a resume or profile to provide the basic account and tracker.</p>

      <h2>3. How we use information</h2>
      <p>We use information to create and secure accounts, sync your tracker, provide search and optional AI features you request, manage workspaces, process payments, prevent abuse, troubleshoot issues, respond to requests, measure product activity where enabled, and comply with law. We do not submit an application to an employer on your behalf.</p>

      <h2>4. Providers and sharing</h2>
      <p>We share information with service providers that help us host data, authenticate accounts, send email, process payments, protect against abuse, provide job search, or provide AI features that you choose to use. A provider may receive the minimum query, job details, or content needed for the requested feature. Provider names and purposes are disclosed in the app when applicable, and each provider may have its own terms and privacy policy.</p>

      <h2>5. Browser storage</h2>
      <p>The app stores essential session and convenience data in your browser, including authentication state and active-workspace selection. Profile, resume, tracker, and workspace records are synchronized with the server rather than kept as an account cache in browser storage. See the <a href={COOKIES_URL}>Cookie & Storage Notice</a> for details. You can clear browser storage, but doing so may sign you out and reset your selected workspace.</p>

      <h2>6. Your choices and rights</h2>
      <p>Settings includes privacy preferences, data export, privacy requests, password controls, session revocation, and account deletion. Depending on where you live, you may also have rights to access, correct, delete, restrict, or object to certain processing. We may ask for information needed to verify a request and may retain limited records for security, fraud prevention, payment, dispute resolution, or legal obligations.</p>

      <h2>7. Retention and security</h2>
      <p>We retain information for as long as needed to provide the service and the purposes described here, then delete or de-identify it when practical unless a longer period is required. We use password hashing, access controls, encrypted stored API keys, session revocation, and audit records. No online service can guarantee absolute security.</p>

      <h2>8. Children</h2>
      <p>intern.track is not intended for children under {MINIMUM_AGE}. If you believe a child provided personal information, contact us so we can investigate and take appropriate action.</p>

      <h2>9. Changes and contact</h2>
      <p>We may update this policy as the service or legal requirements change. The version and effective date at the top identify the current public version.</p>
      <ContactLine>For privacy questions or requests,</ContactLine>
    </>
  );
}

function CookiesContent() {
  return (
    <>
      <h2>What we use</h2>
      <p>intern.track currently uses essential browser storage rather than advertising cookies. The web app uses local storage to keep your sign-in state and remember the active workspace. Tracker, profile, and resume data are saved through the authenticated API.</p>

      <h2>Essential security technologies</h2>
      <p>When bot protection is enabled, Cloudflare Turnstile may load its own security technology to distinguish normal users from automated abuse. Payment and job-search providers may also use their own technologies when you visit their sites or use their hosted flows.</p>

      <h2>Your choices</h2>
      <p>You can clear local storage through your browser settings. Clearing it may sign you out and remove locally cached or draft data. You can control optional product preferences from the Privacy Center in Settings. Blocking scripts or provider technologies may prevent some features from working.</p>

      <h2>Updates</h2>
      <p>If we add analytics, marketing, or other non-essential tracking, we will update this notice and provide any choices or consent controls required by applicable law.</p>
      <ContactLine>For questions about browser storage,</ContactLine>
    </>
  );
}

function DisclaimerContent() {
  return (
    <>
      <h2>Organization tool only</h2>
      <p>intern.track helps you organize your own job search. It is not an employer, staffing agency, recruiter, career counselor, immigration adviser, lawyer, financial adviser, or hiring decision-maker.</p>

      <h2>Listings and outcomes</h2>
      <p>Search results and imported job details come from third-party sources and may be inaccurate, expired, duplicated, or missing important requirements. Confirm the original posting, employer, deadline, compensation, work authorization requirements, and application instructions before relying on them. intern.track does not guarantee an interview, offer, or employment.</p>

      <h2>AI output</h2>
      <p>AI output is probabilistic and may contain errors, invented details, biased suggestions, or outdated information. Do not present generated content as fact without checking it. Do not include confidential information in a third-party AI feature unless you understand and accept how that provider processes it.</p>

      <h2>Review before submitting</h2>
      <p>You are responsible for every resume, answer, message, and application you send. Review for accuracy, truthfulness, tone, accessibility, and fit, then submit directly through the employer or job provider’s website.</p>

      <h2>Contact</h2>
      <ContactLine>For questions about this disclaimer,</ContactLine>
    </>
  );
}

function AcceptableUseContent() {
  return (
    <>
      <h2>Use the service honestly</h2>
      <p>Use intern.track for your own lawful job-search organization or an authorized team workspace. Keep account information accurate and do not misrepresent your identity, qualifications, employment history, or authorization to work.</p>

      <h2>Do not abuse the service</h2>
      <p>You may not probe or bypass security controls, overload the service, introduce malware, access another user’s data, harvest credentials, evade provider limits, or use automation in a way that violates a provider’s rules.</p>

      <h2>Respect third-party sources</h2>
      <p>Do not remove source attribution, misrepresent a listing as your own, scrape restricted content, or use saved provider data outside the permissions granted by the relevant source. Follow the terms of the employer, job board, API provider, and any service you connect to intern.track.</p>

      <h2>Content and applications</h2>
      <p>Do not upload unlawful, infringing, abusive, discriminatory, or malicious content. Do not use intern.track to generate or send deceptive applications, spam, harassment, or impersonation. You remain responsible for reviewing content and obtaining permission before using someone else’s personal information.</p>

      <h2>Enforcement</h2>
      <p>We may remove content, limit features, suspend sessions, or terminate accounts when we reasonably believe this policy or the Terms of Service has been violated, or when necessary to protect users, providers, or the service.</p>

      <ContactLine>To report abuse or ask about this policy,</ContactLine>
    </>
  );
}

function NoticeAtCollectionContent() {
  return (
    <>
      <h2>Categories we collect</h2>
      <p>Depending on the features you use, intern.track collects account identifiers such as username and email; profile, education, contact, resume, and application information; saved job and workspace data; security and session records; privacy choices and requests; payment status; and device or network information used to protect the service. We do not ask for Social Security numbers, passwords for employer sites, demographic information, or uploaded files to provide the core tracker.</p>

      <h2>Why we collect it</h2>
      <p>We use this information to create and secure accounts, save and sync your tracker, provide workspaces, process requested search or AI features, operate paid plans, prevent abuse, troubleshoot the service, respond to privacy requests, and meet legal or security obligations. AI and job-search providers receive only the information needed for a feature you choose to use.</p>

      <h2>Sale and sharing</h2>
      <p>intern.track does not sell personal information. It does not share personal information for cross-context behavioral advertising. Service providers may process information on our behalf for hosting, email, payments, security, job search, or AI features, subject to their applicable terms and agreements.</p>

      <h2>Retention</h2>
      <p>Account and tracker information is kept while your account is active or as needed to provide the service. Security, payment, legal, and audit records may be retained longer when necessary for security, fraud prevention, dispute resolution, or legal obligations. Account deletion and privacy requests are available in Settings and are handled subject to those limited exceptions.</p>

      <h2>Your choices</h2>
      <p>You can review the <a href={PRIVACY_URL}>Privacy Policy</a>, manage optional preferences, download your personal data, request correction or deletion, and delete your account from Settings. Optional product-usage analytics remain off unless you opt in. You can also contact us using the address listed below.</p>
      <ContactLine>For questions about this notice,</ContactLine>
    </>
  );
}

export default function LegalPage({ kind = "privacy" }) {
  const current = policyConfig[kind] ? kind : "privacy";
  const page = policyConfig[current];

  return (
    <main className="legal-page">
      <div className="legal-card">
        <div className="legal-topbar">
          <a className="legal-back" href="/">← Back to intern.track</a>
          <span className="legal-entity">{LEGAL_ENTITY_NAME}</span>
        </div>
        <PolicyNavigation current={current} />
        <header className="legal-header">
          <div className="landing-kicker">{page.eyebrow}</div>
          <h1>{page.title}</h1>
          <p className="legal-meta">Version {page.version} · Effective {LEGAL_EFFECTIVE_DATE}</p>
          <p className="legal-intro">{page.intro}</p>
        </header>

        <article className="legal-content">
          {current === "terms" && <TermsContent />}
          {current === "privacy" && <PrivacyContent />}
          {current === "cookies" && <CookiesContent />}
          {current === "disclaimer" && <DisclaimerContent />}
          {current === "acceptable" && <AcceptableUseContent />}
          {current === "notice" && <NoticeAtCollectionContent />}
        </article>

        <footer className="legal-footer">
          <span>Questions? <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a></span>
          <a href={current === "terms" ? PRIVACY_URL : TERMS_URL}>{current === "terms" ? "Read the Privacy Policy" : "Read the Terms of Service"}</a>
        </footer>
      </div>
    </main>
  );
}
