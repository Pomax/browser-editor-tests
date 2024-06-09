# Comparing browser editors

This repo is an attempt to explore the various browser-based editor frameworks like [Ace](https://ace.c9.io/), [Monaco](https://github.com/microsoft/monaco-editor), and [Codemirror](https://codemirror.net/).

I have no preference, but that doesn't mean they're all equally useful. These will be ranked based on a [list of criteria](https://github.com/Pomax/browser-editor-tests/issues/7) that no single editor will be able to hit, and that's the point: no one's actually written a real browser-based editor that you just install and off you go, even in 2024 it's a ridiculous "you get the LEGOs and now you get to 3D print your own additional LEGOs" situation.

Feel free to let me know what additional criteria you'd expect a proper browser-based editor to come with. These aren't "what editors offer" criteria, but "what I, as a user, expect" criteria.

## how do I use this?

It's a node project, so you'll need that installed (I recommend `nvm` or its windows equivalent), then clone this repo (or fork it and then clone that) and run `npm install`. Things should be cross-platform enough to work on Windows, Mac, and Linux by running `npm start` and then opening the URL that tells you things are running on.

In order to properly compare editors, this test suite comes with:

- a "user dir" that you can mess around with as much as you like without affecting the test itself
- a file tree that shows all the files (with the `.git` dir filtered out) in the user content dir.
- "one tab per file" with both tab based and filetree based "click to view that file"
- file create and delete, because obviously
- diff-based (debounced) edit syncing between the browser and the on-disk files at the server
- automatic (debounced) git commits on the server as you edit 
- autoformatting (using `prettier`) for JS, CSS, and HTML files
- a "do something with this content" in the form of aggregating files and loading it as `<graphics-element>`

## I want more

I know. Get in touch. We can do more.

- [Pomax](https://mastodon.social/deck/@TheRealPomax)
