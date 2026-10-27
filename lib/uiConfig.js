/**
 * uiConfig.js — copy, tabs, example texts and colour classes used by the dashboard.
 * Edit this file to change wording or add examples without touching page.js.
 */

export const TABS = [
  {
    id: 'message',
    label: 'Message',
    fieldLabel: 'Paste the message or InMail',
    placeholder: 'Paste the full text of the direct message or InMail here…',
  },
  {
    id: 'job',
    label: 'Job post',
    fieldLabel: 'Paste the job description',
    placeholder: 'Paste the job title, description, pay and how to apply…',
  },
  {
    id: 'profile',
    label: 'Profile',
    fieldLabel: 'Paste the profile URL or bio text',
    placeholder: 'Paste the profile link, or copy the headline, About section and contact details…',
  },
];

export const EXAMPLES = {
  message: {
    scam:
      "Hi! I'm Sarah from Global Talent Partners. We found your profile and have an URGENT remote opening paying $450 per day, no experience needed. Congratulations, you are already shortlisted, no interview. Please message me on Telegram @sarah_hr_jobs to get started. A refundable security deposit of $120 for your equipment kit is required today. Send your details to sarah.recruits@gmail.com",
    safe:
      "Hi Priya, I'm a recruiter at Northwind Analytics. We're hiring a Senior Data Analyst (Pune, hybrid) and your SQL and dashboard work at Finlytics stood out. Would you be open to a 20-minute intro call this week? The role is listed at northwind-analytics.com/careers, and I'm happy to share the full job description here first.",
  },
  job: {
    scam:
      'URGENT HIRING!!! Data Entry Executive - Work From Home. Earn up to $300 per day. No interview, no experience required. Limited slots, apply within 24 hours. Pay a one-time registration fee of $50 (refundable). Send your passport copy and bank account details to hr.globaljobs@gmail.com or WhatsApp +1 555 0100.',
    safe:
      'Backend Engineer (Node.js), Acme Logistics, Bengaluru. 3+ years of experience with Node.js and PostgreSQL. You will build and maintain shipment-tracking APIs with a team of six. Salary band 18-26 LPA depending on experience. Apply through the Acme careers portal; shortlisted candidates complete a technical screen and two interviews.',
  },
  profile: {
    scam:
      'https://www.linkedin-careers-verify.com/in/jessica-miller-recruiter\nCEO | Founder | Investor | Recruiter | Crypto Trader. I help people double their money with guaranteed returns. DM me on Telegram for the investment opportunity.',
    safe:
      'Arjun Mehta - Senior Product Designer at Zomato. 9 years designing consumer apps. Previously at Flipkart and Razorpay. Mentor at ADPList. Open to speaking invitations. Contact through LinkedIn.',
  },
};

/** Tailwind classes per risk level. */
export const LEVEL_STYLES = {
  safe: { text: 'text-safe', soft: 'bg-safe/10', border: 'border-safe/30', solid: 'bg-safe' },
  suspicious: { text: 'text-warn', soft: 'bg-warn/10', border: 'border-warn/30', solid: 'bg-warn' },
  high: { text: 'text-danger', soft: 'bg-danger/10', border: 'border-danger/30', solid: 'bg-danger' },
};

export const SEVERITY_LABELS = { high: 'High', medium: 'Medium', low: 'Low' };

export const LOADING_STEPS = [
  'Checking for known red flags',
  'Asking the AI model for a second opinion',
  'Combining both scores',
];
