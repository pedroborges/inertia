# Inertia.js Light

Inertia.js lets you quickly build modern single-page React, Vue and Svelte apps using classic server-side routing and controllers.

The Light version is 100% compatible with Inertia.js. It doesn't require Axios nor Nprogress. Instead, it relies on native `fetch` and browser events. This helps Inertia.js Light weight just **2.3kb (gzipped)**, 11.5kb less than Inertia.js and its dependencies.

Visit [inertiajs.com](https://inertiajs.com/) to learn more.

## Installation

```
npm install @inertiajs/inertia@npm:inertia-light
yarn add @inertiajs/inertia@npm:inertia-light
```

## Events
Events allow you to track the navigation lifecycle and respond to page loading. Inertia.js Light fires browser events on the `document` object.

- `inertia:visit` fires immediately after a visit starts.
- `inertia:load` fires after every Inertia.js visit.
