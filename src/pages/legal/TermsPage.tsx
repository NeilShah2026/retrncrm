import {
  LegalLayout,
  Section,
  P,
  UL,
  Strong,
  PlaceholderInline,
} from './LegalLayout'

export function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" effectiveDate="July 10, 2026">
      <Section n={1} title="Acceptance & eligibility">
        <P>
          These Terms of Service ("Terms") are a binding agreement between you and
          Retrn governing your use of the Retrn website and application (the
          "Service"). By creating an account or using the Service, you agree to
          these Terms and to our Privacy Policy.
        </P>
        <P>
          You must be at least <Strong>16 years old</Strong> to use Retrn, and you
          represent that you have the authority to accept these Terms. If you are 16
          or 17, the law of your state may require a parent or guardian to review or
          agree to these Terms on your behalf before you enter a paid plan; by
          subscribing, you confirm you have obtained any consent required.
        </P>
      </Section>

      <Section n={2} title="The service">
        <P>
          Retrn is a personal CRM for capturing and staying in touch with the people
          you meet. We may add, change, or remove features over time. Some features
          are available only on paid plans.
        </P>
      </Section>

      <Section n={3} title="Your account">
        <P>
          You are responsible for maintaining the security of your account and for
          all activity under it. Keep your credentials confidential and notify us
          promptly of any unauthorized use. You are responsible for the accuracy of
          the information you provide.
        </P>
      </Section>

      <Section n={4} title="Acceptable use">
        <P>You agree not to:</P>
        <UL
          items={[
            'Use the Service to violate any law or the rights of others',
            'Store or process personal data about others without a lawful basis (see Section 5)',
            'Upload malware, attempt to breach security, or disrupt the Service',
            'Reverse-engineer, scrape, or resell the Service except as permitted by law',
            'Use the Service to send spam or unlawful communications',
            'Impersonate others or misrepresent your affiliation',
          ]}
        />
        <P>
          We may suspend or terminate accounts that violate this policy.
        </P>
      </Section>

      <Section n={5} title="Data about third parties & indemnification">
        <P>
          Retrn lets you store information about other people. You are solely
          responsible for ensuring you have the right to collect, store, and use
          that information and for complying with all applicable privacy laws. To
          the fullest extent permitted by law, you agree to{' '}
          <Strong>indemnify and hold Retrn harmless</Strong> from any claims,
          losses, or liabilities arising from the information you store about others
          or your misuse of the Service.
        </P>
      </Section>

      <Section n={6} title="Subscriptions & billing">
        <P>Retrn offers the following plans:</P>
        <UL
          items={[
            <>
              <Strong>Free</Strong> — $0, up to 30 contacts.
            </>,
            <>
              <Strong>Student</Strong> — $5/month or $50/year, with valid .edu
              verification (see Section 8).
            </>,
            <>
              <Strong>Standard</Strong> — $15/month{' '}
              <PlaceholderInline>CONFIRM ANNUAL PRICE, e.g. $150/yr</PlaceholderInline>
              .
            </>,
            <>
              <Strong>Groups &amp; Institutions</Strong> — custom pricing; terms set
              in a separate order or agreement.
            </>,
          ]}
        />
        <P>
          Paid plans are billed in advance on a recurring basis (monthly or annual,
          as selected) and <Strong>automatically renew</Strong> at the end of each
          billing period until you cancel. You authorize us and our payment provider
          to charge your payment method for each renewal. You can cancel anytime;
          cancellation takes effect at the end of the current billing period, and
          you keep access until then. Prices may change with prior notice, effective
          on your next renewal.
        </P>
      </Section>

      <Section n={7} title="Refunds — 14-day money-back guarantee">
        <P>
          We offer a <Strong>14-day money-back guarantee</Strong> on paid plans. If
          you are not satisfied, email{' '}
          <a href="mailto:billing@retrncrm.com" className="text-white underline">
            billing@retrncrm.com
          </a>{' '}
          within 14 days of your initial purchase or renewal and we will refund that
          payment. This applies equally to monthly and annual plans. Refunds are
          issued to your original payment method, typically within{' '}
          <PlaceholderInline>5–10</PlaceholderInline> business days. After the 14-day
          window, payments are non-refundable except where required by law.
        </P>
      </Section>

      <Section n={8} title="Founding Member lifetime offer">
        <P>
          Anyone who creates a Retrn account <Strong>on or before August 31, 2026</Strong>{' '}
          becomes a Founding Member and receives <Strong>free lifetime access</Strong>{' '}
          to Retrn's then-current paid features at no charge. There is no cap on the
          number of Founding Members.
        </P>
        <P>"Lifetime" means:</P>
        <UL
          items={[
            'The offer is tied to your individual account and requires that account to remain active; it is non-transferable.',
            'It applies for as long as Retrn continues to operate the Service.',
            <>
              If we discontinue the Service, or in the event of a shutdown,
              acquisition, or material change to our business, we may end or modify
              this offer with at least{' '}
              <PlaceholderInline>30</PlaceholderInline> days' prior notice.
            </>,
            'The offer covers standard individual use and does not include future add-ons that carry separate, usage-based costs (e.g., third-party API fees), which will be disclosed before you incur them.',
          ]}
        />
      </Section>

      <Section n={9} title="Student pricing & verification">
        <P>
          Student pricing requires verification of a valid, active student email
          (e.g., a .edu address) or other proof of enrollment. By selecting a
          student plan, you represent that you are an eligible student. If you
          misrepresent your eligibility, we may, without refund, move your account to
          the applicable Standard price or suspend it, and charge the difference for
          any period you were incorrectly billed at the student rate.
        </P>
      </Section>

      <Section n={10} title="Termination">
        <P>
          You may stop using the Service and delete your account at any time. We may
          suspend or terminate your access if you violate these Terms, if required
          by law, or if we discontinue the Service. On termination, your right to use
          the Service ends; you may export your data beforehand, and we will handle
          remaining data as described in the Privacy Policy.
        </P>
      </Section>

      <Section n={11} title="Disclaimers & limitation of liability">
        <P>
          The Service is provided <Strong>"as is" and "as available,"</Strong>{' '}
          without warranties of any kind, whether express or implied, including
          fitness for a particular purpose and non-infringement. We do not warrant
          that the Service will be uninterrupted, error-free, or secure.
        </P>
        <P>
          To the fullest extent permitted by law, Retrn and its founder will not be
          liable for any indirect, incidental, special, consequential, or punitive
          damages, or any loss of data, profits, or goodwill. Our total liability for
          any claim relating to the Service will not exceed the greater of the amount
          you paid us in the 12 months before the claim, or US $50.
        </P>
      </Section>

      <Section n={12} title="Governing law">
        <P>
          These Terms will be governed by the laws of{' '}
          <PlaceholderInline>STATE / JURISDICTION — TBD ON INCORPORATION</PlaceholderInline>
          , without regard to its conflict-of-laws rules. This clause will be
          finalized once Retrn is incorporated and must be completed before paid
          plans launch.
        </P>
      </Section>

      <Section n={13} title="Dispute resolution">
        <P>
          We hope to resolve any dispute informally first — please email us. Any
          dispute not resolved informally will be settled by binding arbitration in{' '}
          <PlaceholderInline>VENUE — TBD, tied to governing law</PlaceholderInline>,
          on an individual basis; you and Retrn waive the right to a jury trial and
          to participate in a class action, to the extent permitted by law. The
          specific arbitration rules and venue will be finalized with the governing
          law clause above.
        </P>
      </Section>

      <Section n={14} title="Marketing communications">
        <P>
          With your consent, we may send you newsletters, product updates, and
          promotions. You can opt out at any time using the unsubscribe link in any
          marketing email; service-related messages will continue as needed to
          operate your account. See our Privacy Policy for details.
        </P>
      </Section>

      <Section n={15} title="Changes to these terms">
        <P>
          We may update these Terms from time to time. When we make material changes,
          we will update the effective date and notify you by email or in-app notice
          before they take effect. Your continued use of the Service after an update
          means you accept the revised Terms.
        </P>
      </Section>

      <Section n={16} title="Service availability">
        <P>
          We aim to keep Retrn available and reliable but do not guarantee any
          specific uptime. We may modify, suspend, or discontinue any part of the
          Service, and will give reasonable notice of significant changes where
          practical.
        </P>
      </Section>

      <Section n={17} title="Contact">
        <P>
          Questions about these Terms? Email{' '}
          <a href="mailto:hello@retrncrm.com" className="text-white underline">
            hello@retrncrm.com
          </a>
          .
        </P>
      </Section>
    </LegalLayout>
  )
}
