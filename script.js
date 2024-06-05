import { basicSetup, EditorView } from "codemirror";
import { EditorState } from "@codemirror/state";
import { javascript } from "@codemirror/lang-javascript";
import { createPatch } from "./prebaked/vendor/diff.js";
import { DirTree } from "./prebaked/dirtree.js";

const filetree = document.getElementById(`filetree`);
const tabs = document.getElementById(`tabs`);
const editors = document.getElementById(`editors`);

const fileContent = {};
const cmInstances = {};

let dirTree = { tree: {} };
let dirList = [];
let currentView;
let graphics;

customElements.whenDefined(`graphics-element`).then(setupPage);

/**
 * Our main entry point
 */
async function setupPage() {
  console.log(`graphics element is ready`);
  graphics = document.getElementById(`graphics`);

  // Get the file tree
  const dirData = await fetch(`/dir`).then((r) => r.json());
  dirTree = new DirTree();
  dirTree.tree = dirData;
  buildDirTreeUI(dirTree);

  // And then load every file into memory. Because everything has enough RAM for that.
  dirList = dirTree.flat();
  await Promise.all(
    dirList.map(async (filename) => {
      const data = await fetch(`./${filename}`).then((r) => r.text());
      cmInstances[filename] ??= {};
      cmInstances[filename].content = data;
    })
  );

  setGraphicsSource();
  addGlobalEventHandling();
}

/**
 * Hook up the "Add new file" and "Format this file" buttons
 */
function addGlobalEventHandling() {
  document.getElementById(`add`).addEventListener(`click`, async () => {
    const filename = prompt("filename?");
    if (filename) {
      await fetch(`/new/${filename}`, { method: `post` });
      createFileEditTab(filename);
      dirTree.createNewFile(
        filename,
        (filename) => createFileEditTab(filename),
        filetree
      );
      // TODO: refresh the project dir listing?
    }
  });

  // TODO: add a "remove file" option, too

  document.getElementById(`format`).addEventListener(`click`, async () => {
    const tab = document.querySelector(`.active`);
    const filename = tab.title;
    await fetch(`/format/${filename}`, { method: `post` });
    const newText = await fetch(`./${filename}`).then((r) => r.text());
    currentView.dispatch({
      changes: {
        from: 0,
        to: currentView.state.doc.length,
        insert: newText,
      },
    });
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

  const data = await fetch(`./${filename}`).then((r) => r.text());
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
  return EditorState.create({
    extensions: [
      basicSetup,
      // add JS niceties
      javascript(),
      // Add debounced content change syncing
      EditorView.updateListener.of((e) => {
        if (e.docChanged) {
          const entry = cmInstances[filename];
          if (entry.debounce) {
            clearTimeout(entry.debounce);
          }
          entry.debounce = setTimeout(entry.sync, 1000);
        }
      }),
    ],
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
    currentView = view;
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
    setGraphicsSource();
  } else {
    // This should, if I did everything right, never happen.
    console.error(`PRE:`, currentContent);
    console.error(`POST:`, newContent);
    console.error(`HASH:`, getFileSum(newContent), responseHash);
    throw new Error(`desync for ${filename}, - do something smart!`);
  }
  entry.debounce = false;
}

/**
 * update the <graphics-element> based on the current file content.
 */
function setGraphicsSource() {
  const sourceCode = Object.values(cmInstances)
    .map((e) => e.content)
    .join(`\n\n`);
  graphics.loadSource(sourceCode);
}
