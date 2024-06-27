import { basicSetup, EditorView } from "codemirror";
import { EditorState } from "@codemirror/state";
import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { markdown } from "@codemirror/lang-markdown";
// and https://github.com/orgs/codemirror/repositories?q=lang for more options

import { createPatch } from "../public/vendor/diff.js";
import { DirTree } from "../public/dirtree.js";

// This is *technically* unnecessary, but it's better to be explicit.
const changeUser = document.getElementById(`switch`);
const all = document.getElementById(`all`);
const add = document.getElementById(`add`);
const format = document.getElementById(`format`);
const left = document.getElementById(`left`);
const right = document.getElementById(`right`);
const filetree = document.getElementById(`filetree`);
const tabs = document.getElementById(`tabs`);
const editors = document.getElementById(`editors`);
const preview = document.getElementById(`preview`);

const user = document.querySelector(`.username`)?.textContent;
let CONTENT_DIR = `content/${user ?? `anonymous`}`;
const cmInstances = {};
let dirTree = { tree: {} };
let dirList = [];

setupPage();

// -------------------------------

/**
 * Our main entry point
 */
async function setupPage() {
  await refreshDirTree();

  // Load every file into memory. Because everything has enough RAM for that.
  dirList = dirTree.flat();
  await Promise.all(
    dirList.map(async (filename) => {
      const data = await fetchFileContents(filename);
      cmInstances[filename] ??= {};
      cmInstances[filename].content = data;
    })
  );

  addGlobalEventHandling();
  updatePreview();
}

/**
 * helper function for getting file text content:
 */
async function fetchFileContents(filename) {
  return await fetch(`./${CONTENT_DIR}/${filename}`).then((r) => r.text());
}

/**
 * Make sure we're in sync with the server...
 */
async function refreshDirTree() {
  const dirData = await fetch(`/dir`).then((r) => r.json());
  dirTree = new DirTree();
  dirTree.tree = dirData;
  buildDirTreeUI(dirTree);
}

/**
 * Hook up the "Add new file" and "Format this file" buttons
 */
function addGlobalEventHandling() {
  changeUser.addEventListener(`click`, async () => {
    const name = prompt(`Username?`).trim();
    if (name) {
      const response = await fetch(`/login/${name}`, { method: `post` });
      if (response.status === 200) {
        location.reload();
      } else {
        alert(await response.text());
      }
    }
  });

  all.addEventListener(`click`, async () => {
    document.querySelectorAll(`li.file`).forEach((e) => e.click());
  });

  addTabScrollHandling();

  add.addEventListener(`click`, async () => {
    const filename = prompt(
      "Please specify a filename.\nUse / as directory delimiter (e.g. cake/yum.js)"
    );
    if (filename) {
      await fetch(`/new/${filename}`, { method: `post` });
      await refreshDirTree();
      const qs = filename
        .split(`/`)
        .map((v, i, list) => {
          if (i === list.length - 1) {
            return `li.file[title="${v}"]`;
          }
          return `li.dir[title="${v}"]`;
        })
        .join(` `);
      document.querySelector(qs)?.click();
      setTimeout(() => cmInstances[filename].view.focus(), 100);
    }
  });

  format.addEventListener(`click`, async () => {
    const tab = document.querySelector(`.active`);
    const entry = Object.values(cmInstances).find((e) => e.tab === tab);
    const filename = entry.filename;
    format.hidden = true;
    await fetch(`/format/${filename}`, { method: `post` });
    entry.content = await fetchFileContents(filename);
    format.hidden = false;
    entry.view.dispatch({
      changes: {
        from: 0,
        to: entry.view.state.doc.length,
        insert: entry.content,
      },
    });
  });

  addFileDropFunctionality();
}

/**
 * Basic tab scrolling: click/touch-and-hold
 */
function addTabScrollHandling() {
  let scrolling = false;

  function scrollTabs(step) {
    if (!scrolling) return;
    tabs.scrollBy(step, 0);
    setTimeout(() => scrollTabs(step), 4);
  }

  for (const type of [`mouseup`, `touchend`]) {
    document.addEventListener(type, () => (scrolling = false));
  }

  for (const type of [`mouseout`, `touchend`]) {
    left.addEventListener(type, () => (scrolling = false));
    right.addEventListener(type, () => (scrolling = false));
  }

  for (const type of [`mousedown`, `touchstart`]) {
    left.addEventListener(type, () => {
      scrolling = true;
      scrollTabs(-2);
    });
    right.addEventListener(type, () => {
      scrolling = true;
      scrollTabs(2);
    });
  }
}

/**
 * Make sure we can drop files (and entire dirs) onto the file tree:
 */
function addFileDropFunctionality() {
  // fie drag and drop
  filetree.addEventListener(`dragover`, function dropHandler(ev) {
    ev.preventDefault();
    filetree.classList.add(`drop`);
  });

  filetree.addEventListener(`dragenter`, function dropHandler(ev) {
    ev.preventDefault();
    filetree.classList.add(`drop`);
  });

  filetree.addEventListener(`dragleave`, function dropHandler(ev) {
    ev.preventDefault();
    filetree.classList.remove(`drop`);
  });

  /*async*/ function getFileContent(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = ({ target }) => resolve(target.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  filetree.addEventListener(`drop`, async function dropHandler(ev) {
    filetree.classList.remove(`drop`);

    async function traverseFileTree(item, path) {
      path = path || "";
      if (item.isFile) {
        item.file(async (file) => {
          const content = await getFileContent(file);
          const destination = path + file.name;
          const form = new FormData();
          form.append(`filename`, destination);
          form.append(`content`, content);
          await fetch(`/upload/${destination}`, {
            method: `post`,
            body: form,
          });
          console.log("File:", path + file.name);
          console.log("File content:", content);
        });
      } else if (item.isDirectory) {
        item.createReader().readEntries(function (entries) {
          entries.forEach(async (entry) => {
            await traverseFileTree(entry, path + item.name + "/");
          });
        });
      }
    }

    // Prevent default behavior (Prevent file from being opened)
    ev.preventDefault();
    await Promise.all(
      [...ev.dataTransfer.items].map(async (item) =>
        traverseFileTree(item.webkitGetAsEntry())
      )
    );

    // Not a fan, we should be tallying what we need to upload,
    // then upload that, then run this after all uploads finish.
    setTimeout(refreshDirTree, 1000);
  });
}

/**
 * nice than always typing document.createElement
 */
function create(tag) {
  return document.createElement(tag);
}

/**
 * A very dumb digest function that just sums the
 * bytes in a file. We don't care about collision, we just
 * care that it's good enough to signal that two files that
 * should be the same, are somehow not the same.
 */
function getFileSum(data) {
  const enc = new TextEncoder();
  return enc.encode(data).reduce((t, e) => t + e, 0);
}

/**
 * Walk the dir tree and set up clickable entries that create (or
 * switch to) an associated editor for that file's content.
 * TODO: make sure we switch when we click a file with an open editor
 */
function buildDirTreeUI(tree) {
  filetree.innerHTML = ``;
  tree.addToPage((filename) => createFileEditTab(filename), filetree);
}

/**
 * Create the collection of pqge UI elements and associated editor
 * component for a given file.
 */
async function createFileEditTab(filename) {
  const entry = cmInstances[filename];
  if (entry?.view) {
    return entry.tab?.click();
  }

  const panel = setupEditorPanel(filename);
  editors.appendChild(panel);

  const { tab, close } = setupEditorTab(filename);
  tabs.appendChild(tab);

  const data = await fetchFileContents(filename);
  const initialState = getInitialState(filename, data);
  const view = setupView(panel, initialState);

  // Add tab and tab-close event hanlding:
  addEventHandling(filename, panel, tab, close, view);

  // Track this collection
  const properties = {
    filename,
    tab,
    panel,
    view,
    content: view.state.doc.toString(),
    sync: () => syncContent(filename),
  };

  if (entry) {
    Object.assign(entry, properties);
  } else {
    cmInstances[filename] = properties;
  }

  // And activate this editor
  tab.click();
}

/**
 * Create an initial CodeMirror6 state object
 */
function getInitialState(filename, data) {
  const ext = filename.substring(filename.lastIndexOf(`.`) + 1);
  const syntax = {
    html: html,
    css: css,
    js: javascript,
    md: markdown,
  }[ext];

  const extensions = [basicSetup];

  if (syntax) {
    extensions.push(syntax());
  }

  extensions.push(
    // Add debounced content change syncing
    EditorView.updateListener.of((e) => {
      if (e.docChanged) {
        const entry = cmInstances[filename];
        if (entry.debounce) {
          clearTimeout(entry.debounce);
        }
        entry.debounce = setTimeout(entry.sync, 1000);
      }
    })
  );

  return EditorState.create({
    extensions,
    // And make sure the editor starts with whatever content is in our file.
    doc: data.toString(),
  });
}

/**
 * Create the editor's on-page container
 */
function setupEditorPanel(filename) {
  const panel = create(`div`);
  panel.id = filename;
  panel.title = filename;
  panel.classList.add(`editor`, `tab`);
  return panel;
}

/**
 * Create an editor's associated "tab" in the tab row
 */
function setupEditorTab(filename) {
  const tab = create(`div`);
  tab.title = filename;
  tab.textContent = filename;
  document
    .querySelectorAll(`.active`)
    .forEach((e) => e.classList.remove(`active`));
  tab.classList.add(`tab`, `active`);

  const close = create(`button`);
  close.textContent = `x`;
  close.classList.add(`close`);
  tab.appendChild(close);

  return { tab, close };
}

/**
 * Set up a CodeMirror6 view
 */
function setupView(parent, state) {
  const view = new EditorView({ parent, state });
  return view;
}

/**
 * Add all the event handling we're using in this experiment:
 * tabs should trigger the editor they're associated with and mark themselves as active,
 * close buttons should remove the UI elements associated with an editor.
 * @param {*} filename
 * @param {*} panel
 * @param {*} tab
 * @param {*} close
 * @param {*} view
 */
function addEventHandling(filename, panel, tab, close, view) {
  tab.addEventListener(`click`, () => {
    if (!cmInstances[filename]) return;
    document
      .querySelectorAll(`.editor`)
      .forEach((e) => e.setAttribute(`hidden`, `hidden`));
    panel.removeAttribute(`hidden`);
    document
      .querySelectorAll(`.active`)
      .forEach((e) => e.classList.remove(`active`));
    tab.classList.add(`active`);
    tab.scrollIntoView();
  });

  close.addEventListener(`click`, () => {
    if (tab.classList.contains(`active`)) {
      const tabs = Object.keys(cmInstances);
      const tabPos = tabs.indexOf(filename);
      let newTab = tabPos === 0 ? tabs[1] : tabs[tabPos - 1];
      // newTab might exist as entry but not have an editor associated with it.
      if (newTab) cmInstances[newTab].tab?.click();
    }
    tab.remove();
    panel.remove();
    delete cmInstances[filename];
  });
}

/**
 * Sync the content of a file with the server by calculating
 * the diffing patch, sending it over to the server so it can
 * apply it to the file on disk, and then verifying the change
 * made was correct by comparing the on-disk "hash" value with
 * the same value based on the current editor content.
 */
async function syncContent(filename) {
  const entry = cmInstances[filename];
  const currentContent = entry.content;
  const newContent = entry.view.state.doc.toString();
  const changes = createPatch(filename, currentContent, newContent);
  const response = await fetch(`/sync/${filename}`, {
    headers: {
      "Content-Type": `text/plain`,
    },
    method: `post`,
    body: changes,
  });
  const responseHash = parseFloat(await response.text());
  if (responseHash === getFileSum(newContent)) {
    entry.content = newContent;
    updatePreview();
  } else {
    // This should, if I did everything right, never happen.
    console.error(`PRE:`, currentContent);
    console.error(`POST:`, newContent);
    console.error(`HASH:`, getFileSum(newContent), responseHash);
    console.log(`forced sync: fetching file content from server`);
    entry.content = await fetchFileContents(entry.filename);
    entry.view.dispatch({
      changes: {
        from: 0,
        to: entry.view.state.doc.length,
        insert: entry.content,
      },
    });
  }
  entry.debounce = false;
}

/**
 * update the <graphics-element> based on the current file content.
 */
function updatePreview(find, replace) {
  const iframe = preview.querySelector(`iframe`);
  const newFrame = document.createElement(`iframe`);
  newFrame.onload = () => {
    setTimeout(() => {
      newFrame.style.opacity = 1;
      setTimeout(() => iframe.remove(), 750);
    }, 250);
  };
  newFrame.style.opacity = 0;
  newFrame.style.transition = "opacity 0.25s";
  preview.append(newFrame);
  const src = iframe.src ? iframe.src : iframe.dataset.src;
  if (find && replace) {
    newFrame.src = src.replace(find, replace);
  } else {
    newFrame.src = src;
  }
}
