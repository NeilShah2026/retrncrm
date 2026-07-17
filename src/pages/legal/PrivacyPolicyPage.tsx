import {
  LegalLayout,
  Section,
  P,
  UL,
  Strong,
  PlaceholderInline,
} from './LegalLayout'

export function PrivacyPolicyPage() {
  return (
    <LegalLayout title="Privacy Policy" effectiveDate="July 10, 2026">
      <Section n={1} title="Who we are & scope">
        <P>
          Retrn ("Retrn," "we," "us") is a personal CRM that helps you keep track
          of the people you meet. This Privacy Policy explains what information we
          collect, how we use and share it, and the choices and rights you have.
          It applies to the Retrn website and application (the "Service").
        </P>
        <P>
          Retrn is operated by an individual founder;{' '}
          <PlaceholderInline>LEGAL ENTITY / DATA CONTROLLER</PlaceholderInline>{' '}
          will be named here once Retrn is incorporated.
        </P>
      </Section>

      <Section n={2} title="Information we collect">
        <UL
          items={[
            <>
              <Strong>Account information</Strong> — your name, email address, and
              authentication details, plus optional profile fields you add (school,
              headline, links).
            </>,
            <>
              <Strong>Contact information you enter</Strong> — details about the
              people you add to your network, including their name, company, job
              title, email, phone number, notes, tags, interaction history, and any
              photos or business-card images you upload.
            </>,
            <>
              <Strong>Billing information</Strong> — if you subscribe to a paid
              plan, payment is processed by our payment provider (see Sub-processors).
              We do not store your full card number.
            </>,
            <>
              <Strong>Usage data</Strong> — how you interact with the Service
              (features used, actions taken, timestamps) to operate and improve it.
            </>,
            <>
              <Strong>Device &amp; technical data</Strong> — IP address, browser
              type, operating system, and similar diagnostic information.
            </>,
          ]}
        />
      </Section>

      <Section n={3} title="Information about people you add (third-party data)">
        <P>
          When you add someone as a contact, you provide information about another
          person. <Strong>You are responsible for having a lawful basis</Strong> to
          collect, store, and use that information (for example, that the person
          would reasonably expect you to keep their details, or that you have their
          consent). You agree not to use Retrn to store data about people in a way
          that violates applicable privacy laws. You can delete any contact — and
          all of their data — at any time.
        </P>
      </Section>

      <Section n={4} title="How we use information">
        <UL
          items={[
            'Provide, maintain, and secure the Service and your account',
            'Sync your data across your devices',
            'Process payments and manage subscriptions',
            'Respond to your requests and provide support',
            'Send service and, with your consent, marketing communications',
            'Detect, prevent, and address abuse, fraud, or technical issues',
            'Improve and develop features',
          ]}
        />
      </Section>

      <Section n={5} title="How your data is stored & secured">
        <P>
          Your data is stored in the cloud with <Strong>Supabase</Strong>, our
          hosting and database provider. Every record is scoped to your account
          using row-level security, so other users cannot read or write your data.
        </P>
        <UL
          items={[
            <>
              <Strong>Encryption in transit</Strong> — all traffic uses TLS/HTTPS.
            </>,
            <>
              <Strong>Encryption at rest</Strong> — data stored by our infrastructure
              providers is encrypted at rest.
            </>,
            <>
              <Strong>Access controls</Strong> — access to production systems is
              limited and authenticated; row-level security isolates each account.
            </>,
          ]}
        />
        <P>
          No method of transmission or storage is 100% secure, and we cannot
          guarantee absolute security.
        </P>
      </Section>

      <Section n={6} title="Sub-processors">
        <P>We rely on the following third parties to operate the Service:</P>
        <UL
          items={[
            <>
              <Strong>Supabase</Strong> — cloud database, authentication, and
              hosting (stores your account, contacts, and usage data).
            </>,
            <>
              <Strong>Stripe</Strong> — payment processing for paid plans.{' '}
              <PlaceholderInline>CONFIRM PROVIDER</PlaceholderInline>
            </>,
            <>
              <Strong>Email provider</Strong> (e.g., Resend or Postmark) — sending
              transactional and marketing email.{' '}
              <PlaceholderInline>CONFIRM PROVIDER</PlaceholderInline>
            </>,
            <>
              <Strong>Analytics</Strong> — product analytics, if enabled.{' '}
              <PlaceholderInline>CONFIRM TOOL, e.g. PostHog / GA</PlaceholderInline>
            </>,
            <>
              <Strong>OCR / enrichment</Strong> — if business-card scanning or data
              enrichment is enabled, the relevant provider will be listed here.{' '}
              <PlaceholderInline>ADD IF LAUNCHED</PlaceholderInline>
            </>,
          ]}
        />
        <P>
          We share only the data needed for each provider to perform its function,
          and require them to protect it.
        </P>
      </Section>

      <Section n={7} title="Data retention & account deletion">
        <P>
          We keep your data for as long as your account is active. You can delete
          individual contacts at any time, or clear all of your data from{' '}
          <Strong>Settings → Clear all data</Strong>.
        </P>
        <P>
          You may request deletion of your entire account by emailing{' '}
          <a href="mailto:privacy@retrncrm.com" className="text-white underline">
            privacy@retrncrm.com
          </a>
          . When you delete your account, we permanently remove your account data
          and contacts from our live systems within{' '}
          <PlaceholderInline>30</PlaceholderInline> days, except where we must keep
          limited records to comply with legal obligations (e.g., billing/tax
          records). Backups are purged on our standard rotation.
        </P>
      </Section>

      <Section n={8} title="Your privacy rights">
        <P>
          Regardless of where you live, we offer every user the ability to:
        </P>
        <UL
          items={[
            'Access the personal information we hold about you',
            'Export your data (JSON or CSV) from Settings',
            'Correct inaccurate information',
            'Delete your data or your entire account',
            'Object to or restrict certain processing, and withdraw consent',
          ]}
        />
        <P>
          To exercise these rights, use the in-app tools or email{' '}
          <a href="mailto:privacy@retrncrm.com" className="text-white underline">
            privacy@retrncrm.com
          </a>
          . We will not discriminate against you for exercising them.
        </P>
      </Section>

      <Section n={9} title="California privacy rights (CCPA/CPRA)">
        <P>
          If you are a California resident, you have the right to know what personal
          information we collect, use, and disclose; to request access to and
          deletion of that information; to correct it; and to opt out of any "sale"
          or "sharing" of personal information. <Strong>We do not sell your
          personal information</Strong>, and we do not share it for cross-context
          behavioral advertising. You may exercise these rights using the same
          contact method above, and you may designate an authorized agent to act on
          your behalf.
        </P>
      </Section>

      <Section n={10} title="Children & minors">
        <P>
          Retrn is <Strong>not intended for anyone under 16</Strong>, and we do not
          knowingly collect personal information from children under 16. You must be
          at least 16 years old to use the Service. If you are 16 or 17, additional
          protections may apply to you under the laws of your state, and you should
          review these terms with a parent or guardian. If we learn that we have
          collected information from someone under 16, we will delete it.
        </P>
      </Section>

      <Section n={11} title="Marketing emails & communications">
        <P>
          We may send you service emails (e.g., security, billing, and account
          notices), which are necessary to provide the Service. We will only send
          you marketing or promotional emails, newsletters, or product updates with
          your consent or where otherwise permitted by law. Every marketing email
          includes a one-click <Strong>unsubscribe</Strong> link, and we honor
          opt-outs promptly, in accordance with the CAN-SPAM Act and similar laws.
        </P>
      </Section>

      <Section n={12} title="Cookies & analytics">
        <P>
          We use strictly necessary cookies and local storage to keep you signed in
          and remember your preferences. If product analytics is enabled, it helps
          us understand how the Service is used so we can improve it.{' '}
          <PlaceholderInline>
            DISCLOSE ANALYTICS TOOL &amp; COOKIE DETAILS
          </PlaceholderInline>{' '}
          We do not use third-party advertising cookies.
        </P>
      </Section>

      <Section n={13} title="Data breach notification">
        <P>
          If we become aware of a security incident that compromises your personal
          information, we will notify affected users and any regulators without
          undue delay and as required by applicable law, and describe the steps we
          are taking in response.
        </P>
      </Section>

      <Section n={14} title="Where your data is processed">
        <P>
          Your data is processed and stored on our providers' infrastructure,
          which may be located in the United States or other countries. By using
          the Service, you understand your information may be transferred to and
          processed in these locations.{' '}
          <PlaceholderInline>CONFIRM SUPABASE REGION</PlaceholderInline>
        </P>
      </Section>

      <Section n={15} title="Changes to this policy">
        <P>
          We may update this Privacy Policy from time to time. When we make material
          changes, we will update the effective date above and notify you by email
          or an in-app notice before the changes take effect. Your continued use of
          the Service after an update means you accept the revised policy.
        </P>
      </Section>

      <Section n={16} title="Contact us">
        <P>
          Questions about this policy or your data? Email{' '}
          <a href="mailto:privacy@retrncrm.com" className="text-white underline">
            privacy@retrncrm.com
          </a>
          .
        </P>
      </Section>
    </LegalLayout>
  )
}
