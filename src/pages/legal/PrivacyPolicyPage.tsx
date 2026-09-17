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
  Table,
} from './LegalLayout'
import { LEGAL } from './legalInfo'

export function PrivacyPolicyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      intro={
        <>
          <P>
            Retrn is a personal CRM that helps you remember and keep in touch with
            the people you meet. Because Retrn holds information about you and the
            people in your network, we want to be clear about exactly what we
            collect, why, who we share it with, and the control you have over it.
          </P>
          <P>
            <Strong>The short version:</Strong> we collect what you put into Retrn
            so we can store it, sync it, and help you use it. We don&rsquo;t sell
            your data, we don&rsquo;t show ads, we don&rsquo;t track you across
            other apps or websites, and you can export or delete your data at any
            time.
          </P>
        </>
      }
    >
      <Section n={1} title="Who we are & what this policy covers">
        <P>
          Retrn (&ldquo;Retrn,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo;
          &ldquo;our&rdquo;) is operated by {LEGAL.operator}, an individual based in
          the United States, who is the controller of the personal information
          described in this policy. You can reach us at{' '}
          <Mail to={LEGAL.emails.privacy} />.
        </P>
        <P>
          This Privacy Policy applies to the Retrn website at {LEGAL.site}, the
          Retrn web app, the Retrn iOS app, the Retrn browser extension, and any
          related services that link to this policy (together, the
          &ldquo;Service&rdquo;). It should be read together with our{' '}
          <DocLink to={ROUTES.terms}>Terms of Service</DocLink>.
        </P>
      </Section>

      <Section n={2} title="Information we collect">
        <H3>2.1 Information you give us</H3>
        <UL
          items={[
            <>
              <Strong>Account information.</Strong> Your email address and a
              password (stored only as a salted hash by our authentication
              provider). If you sign in with Google or Apple, we receive the name,
              email address, and profile photo URL that provider shares with us;
              if you use Apple&rsquo;s &ldquo;Hide My Email,&rdquo; we receive only
              the relay address.
            </>,
            <>
              <Strong>Profile information.</Strong> Optional details you add to
              your own shareable profile: name, headline, company, school,
              graduation year, major, LinkedIn URL, X/Twitter handle, website,
              email, and phone number, and the college you select in the app.
            </>,
            <>
              <Strong>Contacts and network data.</Strong> Information you enter
              about people you know, such as their name, photo, company, job
              title, industry, email, phone, social links, school, graduation
              year, major, how and where you met, who introduced you, talking
              points, notes, tags, follow-up goals, last-contact date, and
              activity history.
            </>,
            <>
              <Strong>Other content you create.</Strong> Calendar meetings
              (title, description, location, time, attendees from your contacts),
              recruiting-pipeline opportunities (company, role, stage, deadlines,
              links, notes), outreach templates, and tags.
            </>,
            <>
              <Strong>Photos.</Strong> Images you take with your camera, choose
              from your photo library, or link by URL to use as a contact&rsquo;s
              photo. We only access your camera or photo library when you choose
              to add a photo, and only the image you select is uploaded.
            </>,
            <>
              <Strong>Voice and typed input.</Strong> Sentences you speak or type
              to add a contact or talk to the assistant (see Section 4 for how
              speech is handled).
            </>,
            <>
              <Strong>School email verification.</Strong> If you verify a school
              email (for example, an @babson.edu address), we store that address,
              its domain, and the date it was verified.
            </>,
            <>
              <Strong>Communications.</Strong> Messages you send us, such as
              support requests, feedback, and privacy requests.
            </>,
          ]}
        />

        <H3>2.2 Information collected automatically</H3>
        <UL
          items={[
            <>
              <Strong>Log and device data.</Strong> When your device talks to our
              servers, our hosting and database providers automatically record
              technical information such as IP address, browser or device type,
              operating system, the pages or endpoints requested, timestamps, and
              error information. We use this to run, secure, and debug the
              Service.
            </>,
            <>
              <Strong>On-device storage.</Strong> The app stores your sign-in
              session, theme preference, and a few interface preferences (like
              dismissed banners and cached results) in your browser&rsquo;s local
              storage or, in the iOS app, in the app&rsquo;s private on-device
              storage. The website also uses a service worker to cache the app
              shell so it loads quickly and works offline. None of this is used
              for advertising or cross-site tracking.
            </>,
          ]}
        />
        <P>
          We do <Strong>not</Strong> use third-party analytics, advertising, or
          tracking SDKs, and we do not use cookies for advertising. We do not
          collect your precise location, and we do not access your device&rsquo;s
          address book, calendar, or health data.
        </P>

        <H3>2.3 Information from other sources</H3>
        <UL
          items={[
            <>
              <Strong>Sign in with Google or Apple</Strong>, as described above.
            </>,
            <>
              <Strong>Other Retrn users.</Strong> If another Retrn user adds you
              as a contact (for example, by scanning your shareable QR profile or
              typing in your details), that information is stored in{' '}
              <em>their</em> account, not yours. See Section 6.
            </>,
            <>
              <Strong>The browser extension</Strong>, when you use it on Gmail,
              Outlook, or LinkedIn (see Section 5).
            </>,
          ]}
        />
      </Section>

      <Section n={3} title="How we use information">
        <P>We use the information described above to:</P>
        <UL
          items={[
            <>
              <Strong>Provide the Service</Strong>: create and secure your
              account, store your network, sync it across your devices, and run
              features like search, reminders, the calendar and its subscription
              feed, the recruiting pipeline, templates, and import/export.
            </>,
            <>
              <Strong>Power optional AI features</Strong> such as smart capture,
              the daily briefing, the assistant, outreach drafts, coffee-chat
              prep, and tag suggestions (see Section 4).
            </>,
            <>
              <Strong>Verify eligibility</Strong> for student or school-based
              access.
            </>,
            <>
              <Strong>Communicate with you</Strong>: sign-in links and codes,
              verification codes, security and account notices, responses to your
              requests, and (only with your consent) product updates.
            </>,
            <>
              <Strong>Keep the Service safe</Strong>: prevent abuse, fraud, and
              unauthorized access; rate-limit and authenticate requests; and debug
              problems.
            </>,
            <>
              <Strong>Improve the Service</Strong> based on aggregate technical
              information and feedback you send us.
            </>,
            <>
              <Strong>Comply with the law</Strong> and enforce our{' '}
              <DocLink to={ROUTES.terms}>Terms of Service</DocLink>.
            </>,
          ]}
        />
        <P>
          We do <Strong>not</Strong> sell your personal information, share it for
          cross-context behavioral advertising, use it to build advertising
          profiles, or use it for tracking as defined by Apple&rsquo;s App
          Tracking Transparency framework.
        </P>
        <P>
          <Strong>Legal bases (EEA/UK users).</Strong> Where the GDPR or UK GDPR
          applies, we process personal information to perform our contract with
          you (providing the Service), for our legitimate interests (securing and
          improving the Service, in ways that don&rsquo;t override your rights),
          with your consent (for example, optional marketing emails, which you can
          withdraw at any time), and to comply with legal obligations.
        </P>
      </Section>

      <Section n={4} title="AI features and voice input">
        <H3>4.1 AI features</H3>
        <P>
          Retrn&rsquo;s AI features are designed to help you act on your own
          network. When you use one, or when a screen that includes one loads
          (for example, the daily briefing on your dashboard or smart capture
          after you dictate a contact), Retrn sends the text needed for that task
          through our server to a third-party large language model provider. That
          text can include:
        </P>
        <UL
          items={[
            'What you typed or dictated, and your questions to the assistant',
            'Relevant details from your contacts (for example names, companies, roles, tags, notes, how you met, and last-contact dates)',
            'Relevant upcoming meetings, pipeline opportunities, and templates',
            "Today's date, so relative dates like \"next Tuesday\" can be resolved",
          ]}
        />
        <P>
          Our AI requests are currently processed by{' '}
          <Strong>Anthropic&rsquo;s Claude models</Strong>, reached through a model
          gateway hosted on <Strong>Microsoft Azure</Strong> in the United States.
          Requests are sent only on behalf of a signed-in Retrn user, and the
          results are returned to your device. Under the commercial terms that
          govern this access, the model provider does not use these inputs or
          outputs to train its models. We do not use your content to train AI
          models either.
        </P>
        <P>
          AI output can be wrong. Nothing an AI feature proposes is saved to your
          account until you review and confirm it, and AI features never send a
          message, email, or invitation on your behalf.
        </P>

        <H3>4.2 Voice input</H3>
        <P>
          Retrn never records, uploads, or stores audio. When you use the
          microphone to add a contact, speech-to-text is handled by your
          device&rsquo;s or browser&rsquo;s built-in speech recognition, and Retrn
          receives only the resulting text:
        </P>
        <UL
          items={[
            <>
              <Strong>iOS app:</Strong> Apple&rsquo;s speech recognition
              framework, which may process audio on your device or send it to
              Apple&rsquo;s servers, under{' '}
              <Ext href="https://www.apple.com/legal/privacy/">
                Apple&rsquo;s Privacy Policy
              </Ext>
              . We ask for microphone and speech-recognition permission before
              first use, and you can revoke it anytime in iOS Settings.
            </>,
            <>
              <Strong>Web app:</Strong> your browser&rsquo;s Web Speech API. In
              Chrome and Edge, audio is sent to Google&rsquo;s or
              Microsoft&rsquo;s speech service, respectively, under their privacy
              policies.
            </>,
          ]}
        />
        <P>
          The transcribed text is treated like anything else you type: it is
          saved only if you save the contact, and it may be sent to our AI
          provider for smart capture as described above.
        </P>
      </Section>

      <Section n={5} title="The Retrn browser extension">
        <P>
          The Retrn extension for Chrome lets you log an email or LinkedIn
          conversation to a contact, or add a contact from a LinkedIn profile. It
          works only when you click the Retrn toolbar button.
        </P>
        <UL
          items={[
            <>
              <Strong>What it reads:</Strong> when you click the button on Gmail,
              Outlook, or LinkedIn, it reads the page you are viewing to pick out
              the email subject, participants&rsquo; names and email addresses,
              the date, the page link, and the text of the latest message in the
              open thread (without quoted replies), or a LinkedIn profile&rsquo;s
              name, headline, company, and URL. It reads only the page you have
              open, never your inbox in the background, and never attachments.
            </>,
            <>
              <Strong>What it saves:</Strong> only what you confirm: an activity
              entry (type, date, your summary, and optionally a link back to the
              email or conversation) on the contact you choose, and, if needed, a
              new or updated contact. Message text is saved only if you choose to
              add it to the summary; otherwise it is discarded when the popup
              closes.
            </>,
            <>
              <Strong>Sign-in:</Strong> to connect, the extension reuses your
              Retrn session from an open Retrn tab (or a password you enter) and
              keeps it in the extension&rsquo;s local storage.
            </>,
          ]}
        />
        <P>
          The use of information received from the extension adheres to the{' '}
          <Ext href="https://developer.chrome.com/docs/webstore/program-policies/user-data-faq">
            Chrome Web Store User Data Policy
          </Ext>
          , including its Limited Use requirements. We use that information only to
          provide the extension&rsquo;s logging features; we don&rsquo;t sell it,
          use it for advertising, or let people read it except as described in
          this policy.
        </P>
      </Section>

      <Section n={6} title="Information about other people in your network">
        <P>
          Most of what Retrn stores is information <em>you</em> enter about{' '}
          <em>other people</em>. We process that information on your behalf, and
          only to provide the Service to you. We don&rsquo;t use it to contact
          those people, combine it across accounts, or build profiles of them, and
          one user&rsquo;s contacts are never visible to another user.
        </P>
        <P>
          You are responsible for having the right to record information about the
          people you add, and for using it lawfully and respectfully (see our{' '}
          <DocLink to={ROUTES.terms}>Terms of Service</DocLink>). Please avoid
          storing sensitive information about others, such as health,
          financial-account, government ID, or similar details, that you
          don&rsquo;t need.
        </P>
        <P>
          <Strong>If you think a Retrn user has stored your information</Strong>,
          we can&rsquo;t see or change the contents of other users&rsquo; private
          accounts on request, but you can ask that person to delete it. If you
          believe Retrn is being used to misuse your information, email{' '}
          <Mail to={LEGAL.emails.privacy} /> and we will look into it.
        </P>
      </Section>

      <Section n={7} title="How we share information">
        <P>
          We share personal information only in the following ways, and never
          sell it.
        </P>
        <H3>7.1 Service providers</H3>
        <P>
          We use the following companies to run the Service. They process data on
          our behalf, under contracts that require them to protect it and use it
          only to provide their services to us:
        </P>
        <Table
          head={['Provider', 'Purpose', 'Data involved']}
          rows={[
            [
              'Supabase',
              'Database, authentication, and sign-in / verification emails',
              'Account, profile, and all content you store in Retrn; log data',
            ],
            [
              'Vercel',
              'Website hosting and server functions (AI relay, calendar feed, school verification)',
              'Requests passing through our servers; log data such as IP address',
            ],
            [
              'Anthropic',
              'AI model processing for AI features',
              'Text sent for an AI request (Section 4)',
            ],
            [
              'Microsoft Azure',
              'Hosting for our AI model gateway',
              'Text sent for an AI request, in transit to the model provider',
            ],
            [
              'Google Fonts',
              'Typeface delivery for the website and app',
              'IP address and browser information',
            ],
            [
              'Google, Apple',
              'Optional sign-in with Google / Sign in with Apple',
              'Identity information described in Section 2',
            ],
          ]}
        />
        <P>
          If we introduce paid plans, payments will be handled by Apple (for
          purchases made in the iOS app) or by a payment processor for purchases
          made on the web. Your full card number will never be stored by Retrn. We
          will update this policy to name any new provider before it receives
          your data.
        </P>

        <H3>7.2 When you choose to share</H3>
        <UL
          items={[
            <>
              <Strong>Your shareable profile / QR code.</Strong> The profile
              details you choose to include are encoded into the link, so anyone
              you share it with (or who scans your code) can see them and add you
              to their own Retrn network.
            </>,
            <>
              <Strong>Calendar subscription feed.</Strong> If you turn on the
              calendar feed, anyone with its private link can view your Retrn
              meetings, including their titles, times, locations, and
              descriptions. Share it only with calendar apps you use; you can
              revoke the link at any time from the calendar&rsquo;s subscribe
              dialog.
            </>,
            <>
              <Strong>Emails you compose.</Strong> Outreach templates open in your
              own email app; Retrn does not send them.
            </>,
          ]}
        />

        <H3>7.3 Legal and safety reasons</H3>
        <P>
          We may disclose information if we believe in good faith that it is
          required by law, subpoena, or other legal process; necessary to protect
          the rights, property, or safety of Retrn, our users, or others; or needed
          to investigate fraud or security issues. Where legally allowed, we will
          tell you about requests for your data.
        </P>

        <H3>7.4 Business transfers</H3>
        <P>
          If Retrn is involved in a merger, acquisition, incorporation, or sale of
          assets, your information may be transferred as part of that transaction.
          We will notify you before your information becomes subject to a
          different privacy policy.
        </P>
      </Section>

      <Section n={8} title="Security">
        <UL
          items={[
            <>
              <Strong>Account isolation:</Strong> every record in our database is
              tied to your account and protected by row-level security, so other
              users can&rsquo;t read or change it.
            </>,
            <>
              <Strong>Encryption:</Strong> all traffic uses HTTPS/TLS, and our
              providers encrypt stored data at rest.
            </>,
            <>
              <Strong>Least privilege:</Strong> administrative credentials are
              kept server-side only, and our AI and verification endpoints
              authenticate every request.
            </>,
          ]}
        />
        <P>
          No system is perfectly secure. Please use a strong, unique password and
          tell us right away at <Mail to={LEGAL.emails.privacy} /> if you suspect
          unauthorized access to your account. If a breach affects your personal
          information, we will notify you and any required authorities as
          required by law.
        </P>
      </Section>

      <Section n={9} title="Data retention & deletion">
        <UL
          items={[
            <>
              <Strong>While your account is open</Strong>, we keep your data so
              the Service works. You can delete any contact, meeting, opportunity,
              template, or tag at any time, and deletions take effect immediately.
            </>,
            <>
              <Strong>Clear all data:</Strong> <em>Settings → Clear all data</em>{' '}
              permanently deletes every contact, activity, tag, opportunity, and
              template in your account while keeping your login.
            </>,
            <>
              <Strong>Deleting your account:</Strong>{' '}
              <em>Settings → Delete account</em> permanently deletes your account
              and everything in it, immediately and from inside the app — no
              request and no waiting period. When an account is deleted, all of
              its contacts, meetings, opportunities, templates, tags, calendar
              feed links, and verification records are deleted with it. If you
              would rather we did it for you, email{' '}
              <Mail to={LEGAL.emails.privacy} /> from the address on your account
              and we will delete it within 30 days.
            </>,
            <>
              <Strong>Backups and logs:</Strong> deleted data may remain in
              encrypted backups and server logs for a limited time, generally no
              more than 30 days, before being overwritten.
            </>,
            <>
              <Strong>Legal holds:</Strong> we may keep limited information longer
              if required by law (for example, billing or tax records) or to
              resolve disputes and enforce our agreements.
            </>,
          ]}
        />
        <P>
          Uninstalling the iOS app or the extension removes data stored on that
          device but does not delete your Retrn account.
        </P>
      </Section>

      <Section n={10} title="Your choices & rights">
        <P>Wherever you live, you can:</P>
        <UL
          items={[
            <>
              <Strong>Access and export</Strong> your data as JSON or CSV from{' '}
              <em>Settings → Export</em>, or ask us for a copy.
            </>,
            <>
              <Strong>Correct</Strong> information by editing it in the app.
            </>,
            <>
              <Strong>Delete</Strong> individual items, all of your data, or your
              whole account from <em>Settings → Delete account</em> (Section 9).
            </>,
            <>
              <Strong>Withdraw permissions</Strong> for the camera, photo library,
              microphone, and speech recognition in your device settings. The rest
              of Retrn keeps working.
            </>,
            <>
              <Strong>Opt out</Strong> of marketing emails using the unsubscribe
              link. Account and security emails will still be sent.
            </>,
            <>
              <Strong>Object to or restrict</Strong> certain processing, and{' '}
              <Strong>withdraw consent</Strong> where we rely on it.
            </>,
          ]}
        />
        <P>
          To make a request, email <Mail to={LEGAL.emails.privacy} />. We may need
          to verify your identity (usually by confirming control of your account
          email) and will respond within 30 days, or within the time required by
          your local law. You may use an authorized agent where the law allows.
          We will not discriminate against you for exercising your rights.
        </P>
        <P>
          <Strong>U.S. state privacy rights.</Strong> Residents of California and
          other states with consumer privacy laws have rights to know, access,
          correct, delete, and port their personal information, and to opt out of
          its sale, sharing for targeted advertising, or profiling. Retrn does not
          sell or share personal information for targeted advertising and does not
          engage in profiling that produces legal or similarly significant
          effects. In the last 12 months, the categories of personal information we
          have collected are those in Section 2 (identifiers, customer records,
          internet activity, audio-derived text, and professional or education
          information you enter), for the purposes in Section 3, disclosed only to
          the service providers in Section 7. If we deny your request, you may
          appeal by replying to our decision, and if you disagree with the outcome
          you may contact your state attorney general.
        </P>
        <P>
          <Strong>EEA, UK, and Swiss users.</Strong> You also have the right to
          data portability and to lodge a complaint with your local data
          protection authority.
        </P>
      </Section>

      <Section n={11} title="International data transfers">
        <P>
          Retrn is based in the United States, and our service providers store and
          process data primarily in the United States. If you use Retrn from
          outside the U.S., your information will be transferred to, stored, and
          processed there, where data protection laws may differ from those in
          your country. Where required, we rely on appropriate safeguards, such as
          the Standard Contractual Clauses offered by our providers.
        </P>
      </Section>

      <Section n={12} title="Children">
        <P>
          Retrn is not directed to children, and you must be at least 16 years old
          to use it. We do not knowingly collect personal information from anyone
          under 16. If you believe a child under 16 has given us personal
          information, contact <Mail to={LEGAL.emails.privacy} /> and we will
          delete it.
        </P>
      </Section>

      <Section n={13} title="Emails we send">
        <P>
          We send transactional emails you need to use Retrn, such as sign-in
          links, verification codes, and security or account notices. We will only
          send newsletters or promotional emails if you opt in. Every marketing
          email includes an unsubscribe link, and we honor opt-outs promptly, in
          line with the CAN-SPAM Act and similar laws.
        </P>
      </Section>

      <Section n={14} title="Changes to this policy">
        <P>
          We may update this Privacy Policy as Retrn changes. We will post the
          updated version here and change the dates at the top. If the changes are
          material, for example a new category of data or a new way of sharing it,
          we will notify you by email or in the app before they take effect, and we
          will ask for your consent where the law requires it.
        </P>
      </Section>

      <Section n={15} title="Contact us">
        <P>
          Questions, requests, or concerns about privacy? Email{' '}
          <Mail to={LEGAL.emails.privacy} />. For anything else, reach us at{' '}
          <Mail to={LEGAL.emails.hello} />.
        </P>
      </Section>
    </LegalLayout>
  )
}
