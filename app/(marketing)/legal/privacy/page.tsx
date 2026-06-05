export const metadata = {
  title: "Privacy Policy",
  description:
    "Fanbase NG Privacy Policy — how we collect, use and protect your personal data under the Nigeria Data Protection Regulation (NDPR).",
};

export default function PrivacyPage() {
  return (
    <main className="prose prose-sm sm:prose mx-auto max-w-3xl px-6 py-16 dark:prose-invert">
      <h1>Privacy Policy</h1>
      <p className="lead">
        Effective date: <strong>1 June 2026</strong>
      </p>
      <p>
        Fanbase Technologies Limited (&ldquo;Fanbase NG&rdquo;,
        &ldquo;we&rdquo;, &ldquo;us&rdquo; or &ldquo;our&rdquo;) is committed
        to protecting the privacy of all users of our Platform. This Privacy
        Policy explains how we collect, use, share and safeguard your personal
        data and describes your rights under the{" "}
        <strong>
          Nigeria Data Protection Regulation 2019 (NDPR)
        </strong>{" "}
        as issued by the National Information Technology Development Agency
        (NITDA) and the Nigeria Data Protection Act 2023 (NDPA).
      </p>
      <p>
        Please read this policy carefully before using Fanbase NG. By accessing
        or using the Platform you acknowledge that you have read and understood
        this policy.
      </p>

      <h2>1. Data Controller</h2>
      <p>
        The data controller responsible for your personal data is:
        <br />
        <strong>Fanbase Technologies Limited</strong>
        <br />
        Lagos, Nigeria
        <br />
        Email: <strong>privacy@fanbaseng.com</strong>
      </p>

      <h2>2. Data Protection Officer (DPO)</h2>
      <p>
        In accordance with Article 4.1(2) of the NDPR, we have designated a
        Data Protection Officer. You may contact our DPO for any privacy-related
        queries at:
        <br />
        <strong>dpo@fanbaseng.com</strong>
      </p>

      <h2>3. Personal Data We Collect</h2>
      <p>
        We collect the following categories of personal data depending on how
        you use the Platform:
      </p>
      <h3>3.1 Data you provide directly</h3>
      <ul>
        <li>
          <strong>Account data:</strong> your name, username, email address,
          and password (stored as a cryptographic hash).
        </li>
        <li>
          <strong>Profile data:</strong> display name, biography, profile
          photo, banner image, and social media links you choose to share.
        </li>
        <li>
          <strong>Payment data:</strong> billing details processed by Paystack.
          We do not store full card numbers — these are held by Paystack under
          PCI DSS compliance. We receive and store transaction references,
          amounts and status.
        </li>
        <li>
          <strong>Bank account data (creators only):</strong> bank name, account
          name and the last four digits of your account number to facilitate
          payouts. Your full account number is encrypted at rest using AES-256
          and is never exposed to other users.
        </li>
        <li>
          <strong>Content:</strong> posts, photos, videos, messages and
          comments you create on the Platform.
        </li>
        <li>
          <strong>Communications:</strong> messages you send to other users and
          any correspondence with our support team.
        </li>
      </ul>
      <h3>3.2 Data collected automatically</h3>
      <ul>
        <li>
          <strong>Usage data:</strong> pages visited, features used, time and
          duration of sessions, and actions taken on the Platform.
        </li>
        <li>
          <strong>Device and connection data:</strong> IP address, browser type
          and version, operating system, and device identifiers.
        </li>
        <li>
          <strong>Log data:</strong> server logs including request IDs, HTTP
          status codes and error reports collected for security and performance
          monitoring.
        </li>
        <li>
          <strong>Cookies and similar technologies:</strong> session tokens and
          authentication cookies necessary to keep you logged in. See section 11
          for details.
        </li>
      </ul>

      <h2>4. Legal Basis for Processing</h2>
      <p>
        Under the NDPR and NDPA, we process your personal data on the following
        legal grounds:
      </p>
      <ul>
        <li>
          <strong>Performance of a contract:</strong> processing necessary to
          provide you with the Platform services, including account management,
          content delivery, subscription management and payments.
        </li>
        <li>
          <strong>Legitimate interests:</strong> security monitoring, fraud
          prevention, abuse detection, improving the Platform and product
          analytics — balanced against your privacy interests.
        </li>
        <li>
          <strong>Legal obligation:</strong> compliance with Nigerian law,
          including anti-money-laundering (AML) obligations, tax reporting and
          responding to lawful requests from authorities.
        </li>
        <li>
          <strong>Consent:</strong> for optional communications such as
          marketing emails and push notifications. You may withdraw consent at
          any time by updating your notification preferences in Settings.
        </li>
      </ul>

      <h2>5. How We Use Your Data</h2>
      <p>We use your personal data to:</p>
      <ul>
        <li>Create and manage your account;</li>
        <li>
          Process subscriptions, payments, tips and payouts through Paystack;
        </li>
        <li>Deliver, personalise and improve Platform features;</li>
        <li>Send transactional notifications (new subscriber, payout, etc.);</li>
        <li>Detect, investigate and prevent fraud, abuse and violations of our Terms;</li>
        <li>Comply with applicable Nigerian laws and regulations;</li>
        <li>Respond to your support requests;</li>
        <li>
          Maintain audit logs for security and compliance purposes.
        </li>
      </ul>

      <h2>6. Sharing Your Data</h2>
      <p>
        We do not sell your personal data. We share data with third parties only
        in the following circumstances:
      </p>
      <ul>
        <li>
          <strong>Paystack (Paystack Payments Limited):</strong> for processing
          card payments and subscription billing. Paystack is a licensed payment
          service provider regulated by the Central Bank of Nigeria (CBN).
        </li>
        <li>
          <strong>Supabase:</strong> our database and authentication
          infrastructure provider. Data is stored in Supabase-managed PostgreSQL
          databases.
        </li>
        <li>
          <strong>Cloudflare:</strong> we use Cloudflare R2 for media file
          storage and Cloudflare Stream for video hosting and delivery. Your
          uploaded content is stored on Cloudflare&rsquo;s infrastructure.
        </li>
        <li>
          <strong>Sentry:</strong> error tracking and application monitoring.
          Error reports may contain limited diagnostic information such as
          request paths and anonymised stack traces.
        </li>
        <li>
          <strong>Upstash:</strong> rate-limiting and caching service used to
          protect the Platform from abuse.
        </li>
        <li>
          <strong>Legal and regulatory disclosures:</strong> we may disclose
          your data to law enforcement, courts or government agencies when
          required by Nigerian law or a valid legal process, or when we believe
          disclosure is necessary to prevent harm.
        </li>
        <li>
          <strong>Business transfers:</strong> in the event of a merger,
          acquisition or sale of assets, personal data may be transferred to the
          acquiring entity, subject to equivalent privacy protections.
        </li>
      </ul>
      <p>
        Where we share data with third-party processors, we enter into data
        processing agreements requiring them to protect your data to standards
        equivalent to those required by the NDPR.
      </p>

      <h2>7. International Data Transfers</h2>
      <p>
        Some of our service providers (including Supabase, Cloudflare and
        Sentry) operate infrastructure outside Nigeria. When your data is
        transferred outside Nigeria, we ensure that appropriate safeguards are
        in place, including contractual clauses that meet the requirements of
        the NDPR and the requirements set by NITDA for international data
        transfers.
      </p>

      <h2>8. Data Retention</h2>
      <p>We retain your personal data for the following periods:</p>
      <ul>
        <li>
          <strong>Active account data:</strong> for as long as your account
          remains active.
        </li>
        <li>
          <strong>Transaction and payment records:</strong> for a minimum of
          6 years in accordance with Nigerian tax and financial reporting
          obligations.
        </li>
        <li>
          <strong>Audit logs:</strong> for 24 months.
        </li>
        <li>
          <strong>Content you have published:</strong> deleted when you archive
          or delete the content, or when your account is terminated, subject to
          any legal holds.
        </li>
        <li>
          <strong>Deleted account data:</strong> anonymised or deleted within
          90 days of account closure, except where retention is required by law.
        </li>
      </ul>

      <h2>9. Your Rights Under the NDPR and NDPA</h2>
      <p>
        As a data subject under the NDPR and Nigeria Data Protection Act 2023,
        you have the following rights:
      </p>
      <ul>
        <li>
          <strong>Right of access:</strong> you may request a copy of the
          personal data we hold about you.
        </li>
        <li>
          <strong>Right to rectification:</strong> you may request correction of
          inaccurate or incomplete personal data. You can update most of your
          profile information directly in Settings.
        </li>
        <li>
          <strong>Right to erasure:</strong> you may request that we delete your
          personal data where there is no legitimate reason for us to continue
          processing it.
        </li>
        <li>
          <strong>Right to restriction:</strong> you may request that we
          restrict processing of your data in certain circumstances.
        </li>
        <li>
          <strong>Right to data portability:</strong> you may request a copy of
          your data in a structured, commonly used and machine-readable format.
        </li>
        <li>
          <strong>Right to object:</strong> you may object to processing based
          on legitimate interests. We will cease processing unless we can
          demonstrate compelling legitimate grounds.
        </li>
        <li>
          <strong>Right to withdraw consent:</strong> where processing is based
          on consent, you may withdraw it at any time without affecting the
          lawfulness of prior processing.
        </li>
      </ul>
      <p>
        To exercise any of these rights, contact us at{" "}
        <strong>privacy@fanbaseng.com</strong>. We will respond within 30 days.
        We may need to verify your identity before processing your request.
      </p>

      <h2>10. Security</h2>
      <p>
        We implement technical and organisational measures to protect your
        personal data, including:
      </p>
      <ul>
        <li>
          Encrypted data transmission (TLS 1.2+) for all communications between
          your browser and our servers;
        </li>
        <li>
          AES-256-GCM encryption for sensitive financial data (bank account
          numbers) stored at rest;
        </li>
        <li>
          Row-level security (RLS) on our database ensuring users can only
          access their own data;
        </li>
        <li>
          Rate limiting and API origin verification to prevent abuse;
        </li>
        <li>
          Audit logging of all administrative and privileged actions;
        </li>
        <li>Regular security reviews and monitoring via Sentry.</li>
      </ul>
      <p>
        No system is completely secure. If you discover a security vulnerability,
        please report it responsibly to{" "}
        <strong>security@fanbaseng.com</strong>.
      </p>

      <h2>11. Cookies</h2>
      <p>
        We use only technically necessary cookies — specifically, session cookies
        issued by Supabase to keep you authenticated. We do not use advertising
        cookies or third-party tracking cookies. You can clear cookies through
        your browser settings, but doing so will log you out of your account.
      </p>

      <h2>12. Children&rsquo;s Privacy</h2>
      <p>
        Fanbase NG is not directed at persons under the age of 18. We do not
        knowingly collect personal data from children. If you believe a child
        has provided us with personal data, please contact us immediately at{" "}
        <strong>privacy@fanbaseng.com</strong> and we will delete it promptly.
      </p>

      <h2>13. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will notify you
        of material changes by email or by a prominent notice on the Platform at
        least 14 days before the changes take effect. The &ldquo;Effective
        date&rdquo; at the top of this page shows when the policy was last
        revised.
      </p>

      <h2>14. How to Make a Complaint</h2>
      <p>
        If you are not satisfied with how we have handled your personal data,
        you have the right to lodge a complaint with Nigeria&rsquo;s data
        protection supervisory authority:
      </p>
      <p>
        <strong>
          National Information Technology Development Agency (NITDA)
        </strong>
        <br />
        No. 28 Port Harcourt Crescent, Area 11, Garki, Abuja, FCT, Nigeria
        <br />
        Email: <strong>ndpr@nitda.gov.ng</strong>
        <br />
        Website:{" "}
        <a
          href="https://nitda.gov.ng"
          target="_blank"
          rel="noopener noreferrer"
        >
          nitda.gov.ng
        </a>
      </p>
      <p>
        We encourage you to contact us first at{" "}
        <strong>privacy@fanbaseng.com</strong> so we can try to resolve your
        concern directly.
      </p>

      <h2>15. Contact Us</h2>
      <p>
        For any privacy-related questions or requests:
        <br />
        <strong>Fanbase Technologies Limited</strong>
        <br />
        Lagos, Nigeria
        <br />
        Email: <strong>privacy@fanbaseng.com</strong>
        <br />
        DPO: <strong>dpo@fanbaseng.com</strong>
      </p>
    </main>
  );
}
