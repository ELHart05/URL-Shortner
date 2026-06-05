**Title:** I revived my first-ever API project after it had been broken for four years

**Tags:** `devchallenge`, `githubchallenge`, `webdev`, `javascript`

**Cover image:** docs/img/before-after.png

---

*This is a submission for the [GitHub Finish-Up-A-Thon Challenge](https://dev.to/challenges/github-2026-05-21).*

## What I Built

Shortly is a link shortener. It was the first project I ever built that called a real API, back in 2022 while I was learning. At some point it broke, and I never noticed. So for this challenge I fixed it, and added the things I couldn't build back then, the challenge may sound so simple but it has a special place in my heart.

Live demo: https://urlshortner-revival-2026.netlify.app/
Code: https://github.com/ELHart05/URL-Shortner (the original 2022 version is on the `v2022-before` tag)

What it does now:

- Shortens links again, for real, through the [spoo.me](https://spoo.me) API with tinyurl as a backup. There's no backend. It's still a plain static site.
- Custom aliases, like `spoo.me/my-brand`.
- Password-protected links, and links that delete themselves after a set number of clicks.
- Real click stats per link, with bar charts for the top browsers, operating systems and countries, plus total and unique clicks, all pulled straight from the API. The old 2022 page had an "Advanced Statistics" section that was just a heading with nothing behind it. Now there is actual data there.
- Downloadable QR codes, and a saved history you can search, sort, export, import, and annotate with a short note per link. There is also a bulk mode for shortening several links at once.
- Dark and light themes, offline support so it installs as an app, and proper keyboard and screen-reader handling.

I kept it plain HTML, CSS and JavaScript with no build step. That was deliberate. I wanted to write the same stack I used as a beginner and let the difference show, instead of hiding it behind a framework.

It's a small project on purpose. I taught myself most of this, and I graduate from my computer science degree in a few days, so bringing one of my earliest projects back felt like a good way to look at how far things have come.

## Demo

![Before in 2022 and after in 2026](https://raw.githubusercontent.com/ELHart05/URL-Shortner/revival-2026/docs/img/before-after.png)

Here is the "before" as it behaves *today*. Click "Shorten It!" on the 2022 version and it calls `api.shrtco.de`, which now fails with `net::ERR_NAME_NOT_RESOLVED`. All the user gets is:

> invalid input ... try again!

The URL was fine. The service it relied on had just disappeared.

And the after:

| Live stats, real data from the API | On a phone |
|---|---|
| ![Analytics](https://raw.githubusercontent.com/ELHart05/URL-Shortner/revival-2026/docs/img/analytics.png) | ![Mobile](https://raw.githubusercontent.com/ELHart05/URL-Shortner/revival-2026/docs/img/mobile.png) |

Here is the full thing in action (shorten a link, copy it, open the live
analytics with real click data, the QR code, the advanced options, and the
light/dark themes):

{% embed https://youtu.be/NQhghvRfUws %}

## The Comeback Story

In my first year of CS I was mostly teaching myself, building small things to work out how the web fit together. My GitHub still has all of it: landing pages, clones, a couple of games. Shortly was the first one that talked to a real API, and I remember being oddly proud of that one button. I made 34 commits over June and July 2022 and then never opened it again.

When I came back to it for this challenge, the funny thing was that the code mostly wasn't the problem. The site had just been switched off. The free API I'd used, shrtco.de, had shut down, so the one thing the whole page existed to do had been quietly failing for years and I had no idea.

The rest of it was a tour of beginner me:

- the API call written straight into the page, with an `alert()` doing all the error handling
- `alt="#"` on every image, dead `href="#"` links, and "Feautures" spelled wrong twice
- 765 lines of CSS held together with magic numbers and copy-pasted media queries
- a whole animation library committed into the repo
- an "Advanced Statistics" heading with no statistics under it

So I gave myself two jobs. First, get the dead feature working again, which meant replacing shrtco.de with spoo.me (and tinyurl as a fallback), both of which run straight from the browser with no key and no server. Then build the parts 2022 me couldn't: the real stats, the QR codes, the aliases, the password and self-destruct links, offline support, accessibility, theming.

My favourite moment wasn't any of the new features. It was deleting that `alert()` and watching a real short link show up for the first time in four years. Same button, same colours, finally doing what it was meant to.

Four years ago I was looking up what `fetch` does. I graduate in a few days. It is a simple project, I know, but it has a special place in my heart, and reviving it was a fun, quick way to take part in the challenge and to actually see the gap between then and now.

## My Experience with GitHub Copilot

I leaned on GitHub Copilot for a lot of this, and a "finish an old project" challenge turned out to suit it well, because most of the work is reading old code and rewriting it rather than starting from a blank file.

The parts where it earned its place:

- Figuring out what was broken. I described the symptom (the button does nothing, just alerts), and it followed the `fetch` to the dead `api.shrtco.de`, confirmed the service was gone, and helped me weigh up replacements before I settled on spoo.me with a tinyurl fallback.
- The data layer. It drafted `api.js` (the main call, the fallback, error handling, pulling the short code out of the URL) and the piece that turns spoo.me's stats response into the analytics popup. The dashboard I faked in 2022 runs on real responses now.
- The unglamorous work. Turning that 765-line stylesheet into CSS variables with fluid type and theming, drawing the QR code onto a canvas, the keyboard-accessible modals, the service worker. I'd say what I wanted, it would draft something, and I'd read it and fix what was off.
- Catching mistakes, old and new. It pointed out the 2022 `Feautures` and `alt="#"` slips, and kept me honest about escaping user input and respecting reduced motion.

What I'd say about it: Copilot is good at this kind of job. It can hold a small codebase in its head and explain what past me was probably thinking, which left me free to make the calls that actually matter, like which API to trust and how much to change before it stops being the same project.
