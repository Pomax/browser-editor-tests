# Comparing browser editors

This is an attempt at exploring the various browser-based editor frameworks like:

- [Ace](https://ace.c9.io/),
- [Monaco](https://github.com/microsoft/monaco-editor),
- [Codemirror](https://codemirror.net/), and
- [Visual Studio Code for the Web](https://code.visualstudio.com/docs/editor/vscode-web)

I have no strict preference, but that doesn't mean every solution is equally useful. As such, I'm working on this code to allow me to rank these things based on a [fairly long list of criteria](https://github.com/Pomax/browser-editor-tests/issues/7) that no single editor will be able to hit, and that's the point: no one's actually written a real browser-based editor that you just "set up somewhere" and off you go: even in 2024, it's a ridiculous "you get the LEGOs and now you get to 3D print your own additional LEGOs before you can build this model. Also, you don't get an instruction booklet" situation.

Feel free to let me know what additional criteria you'd expect a proper browser-based editor to come with. These aren't "what editors offer" criteria, but "what I, as a user, expect" criteria.

## how do I use this?

It's a node project, so you'll need that installed (I recommend `nvm` or its windows equivalent), then clone this repo (or fork it and then clone that) and run `npm install`. Things should be cross-platform enough to work on Windows, Mac, and Linux by running `npm start` and then opening the URL that tells you things are running on.

In order to properly compare editors, this test suite comes with:

- a content dir inside of which "user" dirs get built including anonymous user dirs. The latter of which get deleted if they get too old (and this is a test, so "too old" means 1 second =)
- a normal editor UI, meaning there's a file tree that shows all the files in a user content directory.
  - those files are backed by git on the server side, for "free" rewinding functionality (with the .git folder never shown in the UI)
  - "one tab per file" with both tab based and file tree based "click to view that file"
  - file create and delete, because obviously. And deletions are reversible, because of git.
- diff-based (debounced) edit syncing between the browser and the on-disk files at the server
  - syncs also trigger automatic (debounced) git commits on the server so there's no manual saving.
- autoformatting (using `prettier`) for JS, CSS, and HTML files
  - additional autoformatting entirely _possible_ but not actually relevant for "exhaustive enough" testing.
- a "do something with this content" mechanism, which in this case is a live website preview.
  - additional "do something"s entirely _possible_, but again not actually relevant for "exhaustive enough" testing.

## I want more

I know. Get in touch. We can do more.

## Why aren't you testing [...]?

Because no one ever told me that exists, [please file an issue](https://github.com/Pomax/browser-editor-tests/issues/new) so I can add it.

- [Pomax](https://mastodon.social/deck/@TheRealPomax)
