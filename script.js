import { basicSetup, EditorView } from "codemirror";
import { EditorState } from "@codemirror/state";
import { javascript } from "@codemirror/lang-javascript";
// import { createPatch } from "./prebaked/vendor/textdiff-create.js";
import { createPatch } from "./prebaked/vendor/diff.js";
import { DirTree } from "./prebaked/dirtree.js";

const create = (tag) => document.createElement(tag);

let dirListing = [];
let dirTree = { tree: {} };
const fileContent = {};
const cmInstances = {};
let currentView;
let graphics;

function getFileSum(data) {
  const enc = new TextEncoder();
  return enc.encode(data).reduce((t, e) => t + e, 0);
}

function setGraphicsSource() {
  graphics.loadSource(Object.values(fileContent).join(`\n\n`));
}

customElements.whenDefined(`graphics-element`).then(async () => {
  console.log(`graphics element is ready`);
  graphics = document.getElementById(`graphics`);

  (async function topLevelNonsense() {
    const dirData = await fetch(`/dir`).then((r) => r.json());
    dirTree = new DirTree();
    dirTree.tree = dirData;
    dirListing = dirTree.flat();
    dirListing.forEach(async (filename) => {
      const data = await fetch(`./${filename}`).then((r) => r.text());
      fileContent[filename] = data;
      setGraphicsSource();
    });
    buildDirTreeUI(dirTree);
  })();

  async function createFileEditTab(filename) {
    if (cmInstances[filename]) return;

    console.log(`setting up initial state for ${filename}`);
    let debounce = false;
    const data = await fetch(`./${filename}`).then((r) => r.text());

    fileContent[filename] = data;

    const initialState = EditorState.create({
      extensions: [
        basicSetup,
        javascript(),
        EditorView.updateListener.of((e) => {
          if (e.docChanged) {
            if (debounce) {
              clearTimeout(debounce);
            }
            debounce = setTimeout(syncContent, 1000);
          }
        }),
      ],
      doc: data.toString(),
    });

    // Set up an HTML editor panel for tying the code mirror editor to
    const editors = document.getElementById(`editors`);
    const panel = create(`div`);
    panel.classList.add(`editor`, `tab`);
    panel.id = filename;
    panel.title = filename;

    // Set up a tab for switching to that editor panel
    const tabs = document.getElementById(`tabs`);
    const tab = create(`div`);
    tab.textContent = filename;
    tab.title = filename;
    document
      .querySelectorAll(`.active`)
      .forEach((e) => e.classList.remove(`active`));
    tab.classList.add(`tab`, `active`);

    // And a close button to remove the editor panel and associated tab
    const close = create(`button`);
    close.textContent = `x`;
    close.classList.add(`close`);

    // update the DOM
    editors.appendChild(panel);
    tab.appendChild(close);
    tabs.appendChild(tab);

    // Create a CodeMirror 6 instance
    console.log(`setting up view`);
    const view = new EditorView({
      state: initialState,
      parent: panel,
    });

    // Add tab and tab-close event hanlding:

    tab.addEventListener(`click`, () => {
      console.log(`${filename} tab clicked~`);
      if (!cmInstances[filename]) return;
      document
        .querySelectorAll(`.editor`)
        .forEach((e) => e.setAttribute(`hidden`, `hidden`));
      panel.removeAttribute(`hidden`);
      document
        .querySelectorAll(`.active`)
        .forEach((e) => e.classList.remove(`active`));
      tab.classList.add(`active`);
      currentView = view;
    });

    close.addEventListener(`click`, () => {
      if (tab.classList.contains(`active`)) {
        const tabs = Object.keys(cmInstances);
        const tabPos = tabs.indexOf(filename);
        let newTab = tabPos === 0 ? tabs[1] : tabs[tabPos - 1];
        if (newTab) cmInstances[newTab].tab.click();
      }
      tab.remove();
      panel.remove();
      delete cmInstances[filename];
    });

    // Track this collection
    cmInstances[filename] = { tab, panel, view, syncContent };

    // Make this view active!
    tab.click();

    // Content sync code
    let currentContent = view.state.doc.toString();

    async function syncContent() {
      const newContent = cmInstances[filename].view.state.doc.toString();
      const changes = createPatch(filename, currentContent, newContent);
      // console.log(changes);
      const response = await fetch(`/sync/${filename}`, {
        headers: {
          "Content-Type": `text/plain`,
        },
        method: `post`,
        body: changes,
      });
      const responseHash = await response.text();
      if (parseFloat(responseHash) === getFileSum(newContent)) {
        currentContent = newContent;
        fileContent[filename] = currentContent;
      } else {
        throw new Error(`desync for ${filename}, - do something smart!`);
      }
      // TODO: this should be a pre/post hash comparison, where the browser
      // and the server need to agree on the content, and if they don't, the
      // browser should be forced to refetch the content.
      debounce = false;
      setGraphicsSource();
    }

    syncContent();

    cmInstances[filename].syncContent = syncContent;
  }

  document.getElementById(`add`).addEventListener(`click`, async () => {
    const filename = prompt("filename?");
    if (filename) {
      await fetch(`/new/${filename}`, { method: `post` });
      createFileEditTab(filename);
    }
  });

  document.getElementById(`format`).addEventListener(`click`, async () => {
    const tab = document.querySelector(`.active`);
    const filename = tab.title;
    await fetch(`/format/${filename}`, { method: `post` });
    console.log(`format done, requesting the new content`);
    const newText = await fetch(`./${filename}`).then((r) => r.text());
    console.log(`new content`, newText);
    currentView.dispatch({
      changes: {
        from: 0,
        to: currentView.state.doc.length,
        insert: newText,
      },
    });
  });

  function buildDirTreeUI(tree) {
    const filetree = document.getElementById(`filetree`);
    tree.addToPage((filename) => createFileEditTab(filename), filetree);
  }
});
