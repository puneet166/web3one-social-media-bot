
// ============================================================
// Web3One — Automated Social Media Bot
// Runs daily via GitHub Actions. No server needed.
// Posts to X (Twitter) + LinkedIn Company Page
// ============================================================

const { TwitterApi } = require('twitter-api-v2');

// ── Environment Variables (set in GitHub Secrets) ───────────
const {
  CLAUDE_API_KEY,
  TWITTER_API_KEY,
  TWITTER_API_SECRET,
  TWITTER_ACCESS_TOKEN,
  TWITTER_ACCESS_SECRET,
  LINKEDIN_ACCESS_TOKEN,
  LINKEDIN_ORGANIZATION_ID,
} = process.env;

// ── Content Themes by Day ───────────────────────────────────
// 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
const THEMES = {
  0: 'weekly reflection — share a lesson learned building Web3One, keep it honest and personal',
  1: 'pain point — call out the agency problem (slow timelines, junior devs, hidden costs) and position Web3One as the fix',
  2: 'founder story — build trust by being transparent about being a new-but-experienced studio with receipts to show',
  3: 'education — teach startup founders how to evaluate a dev partner, 5 questions to ask before signing anything',
  4: 'service spotlight — highlight the MVP Launch package (₹5.4L / $6,500+, 4–6 weeks, everything included)',
  5: 'urgency CTA — Q2 2026 cohort has limited founding-client slots, drive bookings with honest scarcity',
  6: 'social proof — showcase a demo, technical achievement, or tool built (AI Contract Reader, DEX Swap, SaaS boilerplate)',
};

// ── Web3One Brand Context (fed to Claude every time) ────────
const BRAND_CONTEXT = `
You are the social media manager for Web3One (web3one.in).

ABOUT WEB3ONE:
- AI, SaaS & Web3 product studio based in New Delhi, India, serving globally
- Founded as Web3One Tech Labs LLP in 2025
- Senior engineers only — no juniors, no ghost teams
- Fixed price + fixed timeline on every project
- Direct founder access from day one
- 48-hour proposal turnaround, 12-hour reply time on weekdays
- Code ownership: client's GitHub repo from commit #1
- Q2 2026 cohort: only 3 founding-client slots available

SERVICES:
- AI App Development (LLM, RAG, agents, chatbots, voice interfaces)
- SaaS Platform Development (auth, billing, dashboards, multi-tenant)
- MVP in 4–6 weeks (most popular)
- Web3 & Smart Contracts (Solidity, Rust, DeFi, NFT, dApps)
- Trading Bot Development (crypto, backtesting, 24/7 execution)
- Business Automation Tools (AI workflows, scrapers, CRM integrations)
- Custom Web Apps

PRICING:
- Validation Sprint: $2,500 / ₹2,10,000 (14 days)
- MVP Launch: $6,500+ / ₹5,40,000+ (28–42 days) ← most popular
- Custom Build: From $15,000 / ₹12.5L

TECH STACK: Next.js 14, TypeScript, Supabase, Postgres, Tailwind, Stripe,
Clerk, Solidity, Rust, OpenAI, Anthropic, LangChain, PostHog, Vercel

KEY DIFFERENTIATORS vs typical Indian dev agencies:
1. Fixed price — no hourly billing games
2. Fixed timeline — we absorb overruns, not the client
3. Senior engineers write the code (verifiable on GitHub)
4. Client owns the GitHub repo from day one
5. Direct founder access (not account managers)
6. 48h written scope — what's IN and what's OUT

CONTACT: web3one.in | info@web3one.in | WhatsApp: +91 8920 921 153
`;

// ── Generate Post via Claude API ────────────────────────────
async function generatePost(platform, theme) {
  const isTwitter = platform === 'twitter';

  const prompt = isTwitter
    ? `${BRAND_CONTEXT}

TASK: Write ONE tweet for today's theme: "${theme}"

RULES:
- Maximum 280 characters (strictly enforce this)
- Bold, punchy, direct tone — like a confident indie hacker
- Use max 1–2 hashtags from: #buildinpublic #SaaS #indiehacker #web3 #aiapps #startups
- Include web3one.in if space allows
- No quotation marks around the tweet
- Output ONLY the tweet text — no labels, no intro, nothing else`
    : `${BRAND_CONTEXT}

TASK: Write ONE LinkedIn post for today's theme: "${theme}"

RULES:
- Professional but conversational — like a founder speaking to peers
- 150–300 words
- Use short paragraphs and line breaks for readability
- Include a soft CTA at the end (visit web3one.in OR DM me)
- Use 4–5 hashtags from: #StartupIndia #SaaSFounders #MVPDevelopment #AIApps #Web3 #TechStartup #IndianStartups #FounderLife #ProductDevelopment #Founders
- No quotation marks
- Output ONLY the post text — no labels, no intro, nothing else`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error: ${err}`);
  }

  const data = await res.json();
  return data.content[0].text.trim();
}

// ── Post to Twitter/X ───────────────────────────────────────
async function postToTwitter(text) {
  const client = new TwitterApi({
    appKey: TWITTER_API_KEY,
    appSecret: TWITTER_API_SECRET,
    accessToken: TWITTER_ACCESS_TOKEN,
    accessSecret: TWITTER_ACCESS_SECRET,
  });

  // Enforce 280 char limit (safety trim)
  const safeText = text.length > 280 ? text.substring(0, 277) + '...' : text;

  const tweet = await client.v2.tweet(safeText);
  console.log(`✅ Twitter posted | ID: ${tweet.data.id}`);
  return tweet.data.id;
}

// ── Post to LinkedIn Company Page ───────────────────────────
async function postToLinkedIn(text) {
  const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LINKEDIN_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      author: `urn:li:organization:${LINKEDIN_ORGANIZATION_ID}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LinkedIn API error: ${err}`);
  }

  const data = await res.json();
  console.log(`✅ LinkedIn posted | ID: ${data.id}`);
  return data.id;
}

// ── Main Orchestrator ────────────────────────────────────────
async function main() {
  const today = new Date();
  const dayIndex = today.getDay();
  const theme = THEMES[dayIndex];

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 Web3One Social Media Bot');
  console.log(`📅 ${today.toDateString()}`);
  console.log(`🎯 Theme: ${theme}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    // 1. Generate posts
    console.log('\n🤖 Generating Twitter post...');
    const twitterPost = await generatePost('twitter', theme);
    console.log(`\n📝 Tweet (${twitterPost.length} chars):\n${twitterPost}`);

    console.log('\n🤖 Generating LinkedIn post...');
    const linkedinPost = await generatePost('linkedin', theme);
    console.log(`\n📝 LinkedIn (${linkedinPost.length} chars):\n${linkedinPost.substring(0, 120)}...`);

    // 2. Publish
    console.log('\n📤 Publishing...');
    await postToTwitter(twitterPost);
    await postToLinkedIn(linkedinPost);

    console.log('\n🎉 Done! Both platforms updated successfully.');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  }
}

main();
