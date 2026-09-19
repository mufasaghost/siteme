// examples/jev/triage-contact-message.mjs
//
// EXAMPLE — not wired into the site.
//
// `siteme` is currently a single static index.html with no server-side
// contact form or other request handler, so there is no real classification
// use case to hook Jev (https://typesafe.ai) into yet. This file is a small,
// self-contained example of how a future contact-form handler could use Jev
// to triage an incoming message: route it to a category and flag likely
// spam, before it's emailed or filed. It is not imported by index.html and
// has no effect on the deployed site today.
//
// Usage:
//   npm install                    # pulls in @typesafe-ai/sdk
//   TYPESAFE_API_KEY=sk-... npm run example:jev
//
// Docs: https://docs.typesafe.ai/
// SDK:  https://www.npmjs.com/package/@typesafe-ai/sdk

/**
 * @typedef {Object} TriageResult
 * @property {string} category
 * @property {number} confidence
 * @property {boolean} isLikelySpam
 * @property {number} spamProbability
 */

/**
 * Classify a contact-form message with Jev's `system_one`, using `choice`
 * to route it to a category and `noul` to flag likely spam.
 *
 * Degrades gracefully instead of throwing when the SDK isn't installed or
 * `TYPESAFE_API_KEY` isn't set, so a caller can fall back to "no triage"
 * behavior (e.g. deliver every message untouched) rather than fail the
 * request.
 *
 * @param {string} message - The raw text a visitor submitted.
 * @returns {Promise<TriageResult | { error: string }>}
 */
export async function triageContactMessage(message) {
  if (typeof message !== "string" || message.trim() === "") {
    return { error: "No message text provided." };
  }

  if (!process.env.TYPESAFE_API_KEY) {
    return { error: "TYPESAFE_API_KEY is not set; skipping Jev triage." };
  }

  let sdk;
  try {
    // Lazy import: only pull in the SDK when triage is actually requested,
    // and never let a missing dependency crash the caller.
    sdk = await import("@typesafe-ai/sdk");
  } catch {
    return {
      error:
        "@typesafe-ai/sdk is not installed; run `npm install` to enable Jev triage.",
    };
  }

  const { TypeSafeClient, choice, noul } = sdk;

  try {
    const client = new TypeSafeClient(); // reads TYPESAFE_API_KEY from env
    const { answers } = await client.systemOne({
      state: message,
      questions: {
        category: choice("What is this contact-form message about?", {
          work: "A job opportunity, collaboration, or freelance inquiry.",
          feedback: "Feedback or a comment on the site or its content.",
          spam: "Unsolicited advertising, scams, or link spam.",
          other: null,
        }),
        spam: noul("Is this message spam or an automated solicitation?"),
      },
    });

    return {
      category: answers.category.choice,
      confidence: answers.category.confidence,
      isLikelySpam: answers.spam.noul > 0.5,
      spamProbability: answers.spam.noul,
    };
  } catch (err) {
    // Any API/network failure: report it clearly, never throw into the caller.
    return {
      error: `Jev triage failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// Allow running this file directly for a quick manual check:
//   TYPESAFE_API_KEY=sk-... node examples/jev/triage-contact-message.mjs "some message"
if (import.meta.url === `file://${process.argv[1]}`) {
  const sample =
    process.argv.slice(2).join(" ") ||
    "Hi, I loved your portfolio — are you available for freelance work in October?";
  const result = await triageContactMessage(sample);
  console.log(result);
}
