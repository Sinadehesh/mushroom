/**
 * The privacy policy. One source for three places:
 *  - the app (Settings > Privacy policy),
 *  - the public web page linked from the Play Store listing (site/privacy/index.html, hosted on Vercel),
 *  - PRIVACY.md in the repository.
 * After editing, run `npm run privacy` to regenerate the page and PRIVACY.md; a test fails if they drift apart.
 */
export interface PolicySection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

export const PRIVACY_POLICY = {
  title: 'ShroomLock privacy policy',
  updated: '6 October 2026',
  url: 'https://www.sinadehesh.com/shroomlock/privacy/',
  summary:
    'ShroomLock has no accounts, no ads and no analytics, and it sends nothing off your phone. Everything it ' +
    'knows about you stays on your device. The optional ShroomLock Plus purchase is handled entirely by Google Play.',
  sections: [
    {
      heading: 'Who we are',
      paragraphs: [
        'This policy covers the ShroomLock app for Android (package com.shroomlock.app), an app blocker that asks ' +
          'you to identify a mushroom before a locked app opens. “We” means ShroomLock’s developer, the developer ' +
          'named on ShroomLock’s Google Play page. Contact details are at the end of this policy.',
      ],
    },
    {
      heading: 'What ShroomLock accesses on your phone, and why',
      paragraphs: [
        'To lock the apps you choose, ShroomLock asks for the permissions below. Each one is used only on your ' +
          'phone, only for the reason given, and you can turn it off at any time in Android settings.',
      ],
      bullets: [
        'Usage access: to see which app is on screen, so ShroomLock can show a mushroom question in front of an app ' +
          'you locked. It checks only the app in front at that moment and keeps no history of the apps you use.',
        'List of installed apps: so you can pick which apps to lock. Only app names and package names are read.',
        'Display over other apps: to show the mushroom question on top of a locked app.',
        'Notifications: Android requires a visible notification while the lock runs in the background.',
        'Run at start-up and ignore battery optimisation: so the lock keeps working after a restart and is not ' +
          'switched off by battery saving.',
      ],
    },
    {
      heading: 'What is stored, where, and for how long',
      paragraphs: [
        'ShroomLock stores your settings, the apps you chose to lock, short unlock windows, your learning progress ' +
          '(which mushrooms you have learned and how many answers were right) and whether you own ShroomLock Plus. All ' +
          'of it is kept only in ShroomLock’s private storage on your phone. We never receive it.',
        'It stays until you delete it: Settings > Reset learning progress erases your progress, and uninstalling ' +
          'ShroomLock or clearing its storage in Android settings erases everything.',
      ],
    },
    {
      heading: 'What is collected and shared',
      paragraphs: [
        'ShroomLock does not collect personal or sensitive data. It does not send any data to us or to anyone ' +
          'else, does not sell data, and contains no third-party analytics, advertising or tracking code. The ' +
          'mushroom photos are built into the app, so ShroomLock does not need the internet.',
      ],
    },
    {
      heading: 'Purchases',
      paragraphs: [
        'ShroomLock Plus is optional and sold through Google Play, as a one-time purchase or a monthly ' +
          'subscription. Google Play processes the payment under Google’s privacy policy ' +
          '(https://policies.google.com/privacy); ShroomLock never sees your card or payment details. The app only ' +
          'asks Google Play on your phone whether your Google account owns Plus or has an active subscription, and ' +
          'remembers the answer on your device.',
      ],
    },
    {
      heading: 'Security',
      paragraphs: [
        'Because your data never leaves your phone, it is protected by Android’s app sandbox: other apps cannot ' +
          'read ShroomLock’s private storage.',
      ],
    },
    {
      heading: 'Your choices',
      paragraphs: [
        'You can switch the lock off in ShroomLock, revoke any permission in Android settings, reset your progress, ' +
          'or uninstall the app. Because we hold no data about you, there is nothing for us to export or delete ' +
          'on request.',
      ],
    },
    {
      heading: 'Children',
      paragraphs: [
        'ShroomLock is not directed at children under 13 and does not knowingly collect personal information from ' +
          'anyone, including children.',
      ],
    },
    {
      heading: 'Mushroom photos',
      paragraphs: [
        'The mushroom photos come from iNaturalist observers and are used under CC0, CC BY and CC BY-SA licences. ' +
          'Credits are in the app under Settings > Photo credits.',
      ],
    },
    {
      heading: 'Changes and contact',
      paragraphs: [
        'If this policy changes, the new version will be published on this page with a new date.',
        'Questions about privacy: use the contact email on ShroomLock’s Google Play listing, or open an issue at ' +
          'https://github.com/Sinadehesh/mushroom/issues.',
      ],
    },
  ] satisfies PolicySection[],
};

/** PRIVACY.md, generated from the policy above. */
export function privacyMarkdown(policy = PRIVACY_POLICY): string {
  const lines = [
    `# ${policy.title}`,
    '',
    `_Last updated: ${policy.updated}_ · Web version: ${policy.url}`,
    '',
    policy.summary,
    '',
  ];
  for (const s of policy.sections as PolicySection[]) {
    lines.push(`## ${s.heading}`, '');
    for (const p of s.paragraphs) lines.push(p, '');
    if (s.bullets) lines.push(...s.bullets.map((b) => `- ${b}`), '');
  }
  return lines.join('\n');
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Escapes text and turns bare https:// URLs into links. */
const richText = (text: string) =>
  escapeHtml(text).replace(/https:\/\/[^\s)]+[^\s).,]/g, (url) => `<a href="${url}">${url}</a>`);

/** The public privacy page (site/privacy/index.html), generated from the policy above. */
export function privacyHtml(policy = PRIVACY_POLICY): string {
  const sections = (policy.sections as PolicySection[])
    .map((s) =>
      [
        `<h2>${escapeHtml(s.heading)}</h2>`,
        ...s.paragraphs.map((p) => `<p>${richText(p)}</p>`),
        s.bullets ? `<ul>\n${s.bullets.map((b) => `<li>${richText(b)}</li>`).join('\n')}\n</ul>` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(policy.title)}</title>
<meta name="description" content="${escapeHtml(policy.summary)}">
<link rel="icon" href="../favicon.png">
<style>
:root { --bg: #F6F4EE; --text: #1C2A21; --muted: #5E6B61; --accent: #2F5D43; --card: #FFFFFF; --border: #DCE1D5; }
@media (prefers-color-scheme: dark) {
  :root { --bg: #101612; --text: #E8EDE6; --muted: #9AA79D; --accent: #8CC9A0; --card: #18211B; --border: #2C3930; }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font: 17px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
main { max-width: 720px; margin: 0 auto; padding: 40px 20px 64px; }
h1 { font-family: Georgia, "Times New Roman", serif; font-size: 2rem; line-height: 1.2; margin: 0 0 4px; }
h2 { font-size: 1.15rem; margin: 32px 0 8px; }
.updated { color: var(--muted); margin: 0 0 24px; }
.summary { background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 16px 20px; font-weight: 600; }
a { color: var(--accent); overflow-wrap: anywhere; }
ul { padding-left: 1.2em; }
li { margin: 6px 0; }
</style>
</head>
<body>
<main>
<h1>${escapeHtml(policy.title)}</h1>
<p class="updated">Last updated: ${escapeHtml(policy.updated)}</p>
<p class="summary">${richText(policy.summary)}</p>
${sections}
</main>
</body>
</html>
`;
}
