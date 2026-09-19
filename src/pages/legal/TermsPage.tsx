import { ROUTES } from '@/lib/routes'
import {
  LegalLayout,
  Section,
  H3,
  P,
  UL,
  Strong,
  Mail,
  DocLink,
  Ext,
} from './LegalLayout'
import { LEGAL } from './legalInfo'

export function TermsPage() {
  return (
    <LegalLayout
      title="Terms of Service"
      intro={
        <P>
          These Terms of Service (&ldquo;Terms&rdquo;) are a binding agreement
          between you and {LEGAL.operator}, doing business as Retrn
          (&ldquo;Retrn,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;). They govern
          your use of the Retrn website at {LEGAL.site}, the Retrn web app, the
          Retrn iOS app, the Retrn browser extension, and related services (the
          &ldquo;Service&rdquo;). Please read them carefully. Section 17 explains
          how disputes are resolved.
        </P>
      }
    >
      <Section n={1} title="Agreeing to these Terms">
        <P>
          By creating an account, downloading the app or extension, or otherwise
          using the Service, you agree to these Terms and acknowledge our{' '}
          <DocLink to={ROUTES.privacy}>Privacy Policy</DocLink>, which explains how
          we handle your information. If you don&rsquo;t agree, don&rsquo;t use
          the Service.
        </P>
        <P>
          If you use Retrn on behalf of an organization, you confirm that you have
          the authority to accept these Terms for it, and &ldquo;you&rdquo;
          includes that organization.
        </P>
      </Section>

      <Section n={2} title="Eligibility">
        <P>
          You must be at least <Strong>16 years old</Strong> to use Retrn. If you
          are under the age of majority where you live (18 in most U.S. states),
          you confirm that a parent or legal guardian has reviewed and agreed to
          these Terms, and you must have their permission before buying a paid
          plan. You may not use the Service if you are barred from doing so under
          applicable law.
        </P>
      </Section>

      <Section n={3} title="The Service">
        <P>
          Retrn is a personal CRM for capturing and keeping in touch with the
          people you meet. It includes contact management, reminders, a calendar
          and subscription feed, a recruiting pipeline, outreach templates, a
          shareable profile, import and export, optional AI features, and a
          browser extension. We are continually improving Retrn and may add,
          change, or remove features. If we remove a feature you pay for in a way
          that materially reduces your plan, we will tell you in advance.
        </P>
        <P>
          Retrn is a personal productivity tool. It is not designed for storing
          regulated data such as protected health information, payment card data,
          or government identifiers, and you should not use it for that.
        </P>
      </Section>

      <Section n={4} title="Your account">
        <UL
          items={[
            'Provide accurate information and keep your email address up to date; we use it for sign-in and important notices.',
            'Keep your password and devices secure. You are responsible for activity that happens under your account.',
            <>
              Tell us right away at <Mail to={LEGAL.emails.hello} /> if you
              believe your account has been accessed without permission.
            </>,
            'One person per account. Don’t share your account or create accounts using automated means.',
          ]}
        />
      </Section>

      <Section n={5} title="Your content">
        <P>
          <Strong>You own your content.</Strong> &ldquo;Your content&rdquo; means
          everything you put into Retrn: contacts, notes, photos, meetings,
          opportunities, templates, tags, profile details, and anything you type or
          dictate.
        </P>
        <P>
          To run the Service, you give us a worldwide, non-exclusive, royalty-free
          license to host, store, copy, process, transmit, and display your
          content, <em>only</em> as needed to provide, secure, and support the
          Service for you. This includes sending it to our service providers as
          described in the Privacy Policy, such as our AI provider when you use
          an AI feature. The license ends when your content is deleted from our
          systems, except for backups kept for a limited time.
        </P>
        <P>
          You are responsible for your content and confirm that you have the
          rights needed to store it in Retrn. We don&rsquo;t pre-screen content,
          but we may remove content or restrict accounts that violate these Terms
          or the law.
        </P>
        <P>
          You can export your data at any time from <em>Settings → Export</em>.
          You are responsible for keeping your own backups of anything important.
        </P>
      </Section>

      <Section n={6} title="Information about other people">
        <P>
          Retrn lets you store information about other people. When you do, you
          agree that:
        </P>
        <UL
          items={[
            'You have a legitimate, lawful reason to keep that information, such as a real personal or professional relationship, and you will follow the privacy laws that apply to you.',
            'You will only use it to manage your own relationships, not to build lists for sale, harassment, stalking, discrimination, or unsolicited bulk marketing.',
            'You will not store sensitive information about others (for example health, sexual orientation, religion, immigration status, financial-account numbers, or government IDs) without a clear lawful basis.',
            'You will delete someone’s information if they ask you to and the law requires it.',
          ]}
        />
        <P>
          Retrn processes this information for you and at your direction. You, not
          Retrn, decide what to record about the people in your network.
        </P>
      </Section>

      <Section n={7} title="Acceptable use">
        <P>You agree not to, and not to help anyone else:</P>
        <UL
          items={[
            'Break any law or violate anyone’s privacy, publicity, intellectual property, or other rights',
            'Use Retrn to send spam or bulk unsolicited messages, or to harass, threaten, or impersonate anyone',
            'Upload malware, or try to probe, scan, breach, or overload our systems or any other user’s account',
            'Get around usage limits, plan restrictions, verification, or security features',
            'Scrape, copy, or reverse-engineer the Service, except where the law allows despite this restriction',
            'Resell, sublicense, or offer the Service to others as a commercial service without our written permission',
            'Use the browser extension to collect data from websites in violation of those websites’ terms',
            'Use AI features to generate unlawful, deceptive, or harmful content, or to try to extract or misuse the underlying model',
          ]}
        />
      </Section>

      <Section n={8} title="AI features">
        <P>
          Some features use artificial intelligence to suggest contact details,
          tags, briefings, drafts, answers, and actions. AI output can be
          incomplete, outdated, or wrong. <Strong>Review AI output before relying
          on it</Strong>. Retrn only saves AI-proposed changes after you confirm
          them and never sends messages on your behalf. You are responsible for
          what you choose to save or send. AI features may be limited, changed, or
          temporarily unavailable, and when they are, Retrn falls back to its
          non-AI features.
        </P>
      </Section>

      <Section n={9} title="Plans, pricing & billing">
        <P>Retrn currently offers or plans to offer the following:</P>
        <UL
          items={[
            <>
              <Strong>Free:</Strong> $0, with up to 30 contacts and core
              features.
            </>,
            <>
              <Strong>Student:</Strong> $5 per month or $50 per year, for
              verified students (Section 11).
            </>,
            <>
              <Strong>Standard:</Strong> $15 per month or $150 per year.
            </>,
            <>
              <Strong>Groups &amp; Institutions:</Strong> custom pricing and terms
              set out in a separate order form or agreement, which controls if it
              conflicts with these Terms.
            </>,
          ]}
        />
        <P>
          Current features and prices are shown on our website and in the app at
          the time of purchase. Prices are in U.S. dollars and exclude applicable
          taxes unless stated otherwise.
        </P>
        <H3>9.1 Automatic renewal</H3>
        <P>
          Paid subscriptions are billed in advance and{' '}
          <Strong>renew automatically</Strong> at the end of each monthly or annual
          billing period, at the then-current price, until you cancel. By
          subscribing, you authorize the recurring charge to your payment method.
          You can cancel at any time. Cancellation stops future renewals, and you
          keep paid access through the end of the period you already paid for.
        </P>
        <P>
          <Strong>Introductory offers.</Strong> If you subscribe at an introductory
          price (for example, a discounted monthly rate for your first six months),
          that price applies only for the stated term. After it, the subscription
          renews at the regular price unless you cancel first. Introductory offers
          are for first-time subscribers and may be changed or withdrawn for new
          subscriptions at any time.
        </P>
        <H3>9.2 Where you subscribe matters</H3>
        <UL
          items={[
            <>
              <Strong>In the iOS app:</Strong> purchases are processed by Apple
              through your App Store account under Apple&rsquo;s terms. Payment is
              charged to your Apple ID at confirmation. Your subscription renews
              unless you turn off auto-renew at least 24 hours before the current
              period ends. Manage or cancel it in{' '}
              <em>iOS Settings → your name → Subscriptions</em>. Refunds for App
              Store purchases are handled by Apple under its policies at{' '}
              <Ext href="https://reportaproblem.apple.com">
                reportaproblem.apple.com
              </Ext>
              .
            </>,
            <>
              <Strong>On the web:</Strong> purchases are processed by Stripe, our
              payment processor; we never see or store your full card number. You
              can change plan, update your card or cancel from{' '}
              <em>Settings → Subscription → Manage billing</em>, or by emailing{' '}
              <Mail to={LEGAL.emails.billing} />.
            </>,
          ]}
        />
        <H3>9.3 Price changes, downgrades & failed payments</H3>
        <P>
          We will give you at least 30 days&rsquo; notice before a price increase
          takes effect for your subscription, and it will apply from your next
          renewal. You can cancel before then. If you downgrade or a subscription
          ends, paid-only features will stop being available, but we won&rsquo;t
          delete your data because of a downgrade, and you can still export it. If
          a payment fails, we or Apple may retry the charge or pause paid features
          until payment is resolved.
        </P>
      </Section>

      <Section n={10} title="Refunds: 14-day money-back guarantee">
        <P>
          For subscriptions bought directly from Retrn on the web, we offer a{' '}
          <Strong>14-day money-back guarantee</Strong>. If you&rsquo;re not
          satisfied, email <Mail to={LEGAL.emails.billing} /> within 14 days of your
          first purchase or of a renewal charge and we will refund that charge in
          full. This applies to both monthly and annual plans. Refunds go back to
          your original payment method, usually within 5 to 10 business days. After
          14 days, charges are non-refundable except where required by law.
        </P>
        <P>
          Purchases made through the Apple App Store are refunded by Apple, not by
          Retrn, as described in Section 9.2.
        </P>
      </Section>

      <Section n={11} title="Student pricing & school-based free access">
        <H3>11.1 Student pricing</H3>
        <P>
          Student pricing requires verifying an active student email address (for
          example, a .edu address) or other proof of current enrollment we accept.
          By choosing a student plan, you confirm you are eligible. If you
          misrepresent your eligibility, we may move your account to Standard
          pricing going forward or suspend it. We may periodically ask you to
          re-verify.
        </P>
        <H3>11.2 Babson student free access</H3>
        <P>
          Any student who verifies an active <Strong>@babson.edu</Strong> email
          address gets <Strong>Retrn&rsquo;s paid features for free</Strong> for as
          long as that address stays verified. No payment method is required, and
          there is no cap on how many Babson students can claim it.
        </P>
        <UL
          items={[
            'You can verify by signing in with your @babson.edu address (by password, magic link, or Google), or by adding and confirming your @babson.edu address from Settings with a code we email to it.',
            'One @babson.edu address covers one Retrn account. The offer is personal to you and cannot be transferred or sold.',
            'If you can no longer receive mail at that address, or we can no longer verify it as an active Babson address, we may end the free access with at least 30 days’ notice. Your data stays in your account either way.',
            'The offer covers standard individual use. It does not include future add-ons that carry separate usage-based costs, which will be clearly disclosed before you are charged for them.',
            'We may end or change this offer for new sign-ups at any time. If we end it for existing verified students, we will give at least 30 days’ notice.',
          ]}
        />
      </Section>

      <Section n={12} title="Third-party services">
        <P>
          Retrn works alongside services we don&rsquo;t control, such as Google
          and Apple sign-in, Gmail, Outlook, LinkedIn, calendar apps, and your
          email app. Your use of those services is governed by their own terms and
          privacy policies, and we aren&rsquo;t responsible for them. Retrn is not
          affiliated with, endorsed by, or sponsored by Google, Microsoft,
          LinkedIn, Apple, or Babson College. Their names are used only to
          describe compatibility and eligibility.
        </P>
      </Section>

      <Section n={13} title="Our intellectual property & your license to use Retrn">
        <P>
          The Service, including its software, design, text, graphics, logos, and
          the &ldquo;Retrn&rdquo; name, belongs to Retrn and its licensors and is
          protected by intellectual property laws. Subject to these Terms, we give
          you a personal, limited, non-exclusive, non-transferable, revocable
          license to use the Service for your own personal or internal business
          purposes. We reserve all rights not expressly granted.
        </P>
        <P>
          If you send us ideas or feedback, you let us use them without any
          obligation to you. This does not give us any rights to your content.
        </P>
      </Section>

      <Section n={14} title="Suspension & termination">
        <P>
          <Strong>You</Strong> can stop using Retrn at any time, clear your data
          from <em>Settings → Clear all data</em>, or delete your account outright
          from <em>Settings → Delete account</em> — which removes the account and
          all of its data permanently (see the{' '}
          <DocLink to={ROUTES.privacy}>Privacy Policy</DocLink>). Deleting your
          account or the app does not cancel an App Store subscription, so cancel
          that separately in <em>iOS Settings → your name → Subscriptions</em>.
        </P>
        <P>
          <Strong>We</Strong> may suspend or end your access if you materially or
          repeatedly break these Terms, if your use creates legal or security risk
          for us or others, if required by law, or if we stop offering the
          Service. Where reasonable, we will give you notice and a chance to fix
          the problem first. If we discontinue the Service or end your account
          without cause, we will give you at least 30 days&rsquo; notice to export
          your data and will refund any prepaid fees for the unused period of a
          direct (non-App Store) subscription.
        </P>
        <P>
          Sections that by their nature should survive termination, including 5
          (to the extent needed), 6, 13, 15 through 19, and 21, will survive.
        </P>
      </Section>

      <Section n={15} title="Disclaimers">
        <P>
          We work hard to keep Retrn reliable and your data safe, but the Service
          is provided <Strong>&ldquo;as is&rdquo; and &ldquo;as available.&rdquo;</Strong>{' '}
          To the fullest extent permitted by law, we disclaim all warranties,
          express or implied, including warranties of merchantability, fitness for
          a particular purpose, title, and non-infringement. We don&rsquo;t promise
          that the Service will be uninterrupted, error-free, or free of data loss,
          or that AI output, reminders, or other results will be accurate or
          complete. Keep your own backups of important information.
        </P>
      </Section>

      <Section n={16} title="Limitation of liability">
        <P>
          To the fullest extent permitted by law, Retrn and its operator will not be
          liable for any indirect, incidental, special, consequential, exemplary,
          or punitive damages, or for any loss of profits, revenue, data, goodwill,
          or opportunities, arising out of or relating to the Service or these
          Terms, even if we were told such damages were possible.
        </P>
        <P>
          Our total liability for all claims relating to the Service or these Terms
          is limited to the greater of (a) the amount you paid Retrn for the
          Service in the 12 months before the event giving rise to the claim, or
          (b) US $50.
        </P>
        <P>
          Some jurisdictions don&rsquo;t allow certain disclaimers or limitations,
          so some of the above may not apply to you. Nothing in these Terms limits
          liability that cannot be limited by law, such as for fraud, gross
          negligence, or willful misconduct, or any consumer rights you have that
          cannot be waived.
        </P>
      </Section>

      <Section n={17} title="Governing law & disputes">
        <P>
          These Terms are governed by the laws of the Commonwealth of{' '}
          {LEGAL.governingState} and applicable U.S. federal law, without regard to
          conflict-of-laws rules.
        </P>
        <P>
          <Strong>Talk to us first.</Strong> Most problems can be fixed quickly.
          Before filing a claim, email <Mail to={LEGAL.emails.hello} /> with a
          description of the issue and give us 30 days to try to resolve it
          informally.
        </P>
        <P>
          If we can&rsquo;t resolve it, any claim relating to the Service or these
          Terms will be brought exclusively in the state or federal courts located
          in {LEGAL.governingState}, and you and Retrn consent to their personal
          jurisdiction. Either of us may instead bring an individual claim in
          small-claims court where it qualifies. If you live in a country whose
          consumer laws give you the right to bring claims in your local courts,
          or under your local law, nothing in this section takes that away.
        </P>
      </Section>

      <Section n={18} title="Indemnification">
        <P>
          To the extent permitted by law, you agree to defend, indemnify, and hold
          harmless Retrn and its operator from third-party claims, losses, and
          reasonable costs (including legal fees) arising from your content, the
          information you store about other people, your misuse of the Service, or
          your violation of these Terms or the law. We will notify you of any such
          claim and let you participate in its defense.
        </P>
      </Section>

      <Section n={19} title="Additional terms for the Apple App Store">
        <P>
          If you download the Retrn iOS app from the Apple App Store, the following
          also applies:
        </P>
        <UL
          items={[
            'These Terms are between you and Retrn only, not Apple Inc. (“Apple”). Retrn, not Apple, is solely responsible for the app and its content.',
            'Your license to use the app is limited to use on Apple-branded products you own or control, as permitted by the Usage Rules in the Apple Media Services Terms and Conditions, except that the app may be accessed by other accounts associated with you through Family Sharing or volume purchasing.',
            'Retrn, not Apple, is solely responsible for providing maintenance and support for the app. Apple has no obligation to provide any maintenance or support.',
            'If the app fails to conform to any applicable warranty, you may notify Apple, and Apple will refund the purchase price (if any) for the app. To the maximum extent permitted by law, Apple has no other warranty obligation for the app, and any other claims, losses, liabilities, damages, costs, or expenses attributable to a failure to conform to a warranty are Retrn’s responsibility, to the extent not disclaimed in these Terms.',
            'Retrn, not Apple, is responsible for addressing any claims by you or a third party relating to the app or your possession or use of it, including product liability claims, claims that the app fails to meet legal or regulatory requirements, and claims under consumer protection, privacy, or similar laws.',
            'If a third party claims that the app or your possession and use of it infringes their intellectual property rights, Retrn, not Apple, is solely responsible for investigating, defending, settling, and discharging that claim.',
            'You confirm that you are not located in a country subject to a U.S. Government embargo or designated as a “terrorist supporting” country, and that you are not listed on any U.S. Government list of prohibited or restricted parties.',
            'You must comply with any applicable third-party terms when using the app, such as your wireless data service agreement.',
            'Apple and its subsidiaries are third-party beneficiaries of these Terms and, once you accept them, Apple will have the right (and will be deemed to have accepted the right) to enforce these Terms against you as a third-party beneficiary.',
          ]}
        />
        <P>
          Questions, complaints, or claims about the app should be directed to
          Retrn at <Mail to={LEGAL.emails.hello} />.
        </P>
      </Section>

      <Section n={20} title="Changes to these Terms">
        <P>
          We may update these Terms from time to time. We will post the new version
          here and update the dates at the top. If a change is material, we will
          notify you by email or in the app at least 14 days before it takes
          effect, unless the change is required by law or addresses a security
          issue. If you keep using Retrn after the changes take effect, you accept
          them. If you don&rsquo;t agree, stop using the Service and cancel any
          subscription before then.
        </P>
      </Section>

      <Section n={21} title="General">
        <UL
          items={[
            <>
              <Strong>Entire agreement.</Strong> These Terms, the Privacy Policy,
              and any order form you sign with us are the entire agreement between
              you and Retrn about the Service.
            </>,
            <>
              <Strong>Severability.</Strong> If any part of these Terms is found
              unenforceable, the rest stays in effect, and that part will be
              enforced as far as the law allows.
            </>,
            <>
              <Strong>No waiver.</Strong> If we don&rsquo;t enforce a provision
              right away, we haven&rsquo;t given up our right to enforce it later.
            </>,
            <>
              <Strong>Assignment.</Strong> You may not transfer these Terms without
              our consent. We may transfer them in connection with a merger,
              acquisition, incorporation, or sale of assets, and will notify you if
              we do.
            </>,
            <>
              <Strong>Force majeure.</Strong> We aren&rsquo;t liable for delays or
              failures caused by events beyond our reasonable control, such as
              outages at our providers, natural disasters, or acts of government.
            </>,
            <>
              <Strong>Notices.</Strong> We may send you notices by email to your
              account address or within the app. You can send notices to us at{' '}
              <Mail to={LEGAL.emails.hello} />.
            </>,
            <>
              <Strong>Relationship.</Strong> Nothing in these Terms creates a
              partnership, joint venture, employment, or agency relationship.
            </>,
          ]}
        />
      </Section>

      <Section n={22} title="Contact">
        <P>
          Questions about these Terms? Email <Mail to={LEGAL.emails.hello} />. For
          billing, email <Mail to={LEGAL.emails.billing} />. For privacy, email{' '}
          <Mail to={LEGAL.emails.privacy} />.
        </P>
      </Section>
    </LegalLayout>
  )
}
